(() => {
  const state = window.SIM_STATE;
  if (!state) return;

  const clamp = (v,a=0,b=100)=>Math.max(a,Math.min(b,v));
  const alive = ()=>state.npcs.filter(n=>n.alive);
  const log = text => {
    if (typeof window.SIM_API?.log === 'function') window.SIM_API.log(text);
    else if (typeof window.SIM_LOG === 'function') window.SIM_LOG(text);
  };
  const memory = () => window.NPC_MEMORY;
  const personality = () => window.NPC_PERSONALITY;
  const has = (n,t)=>personality()?.has(n,t) || n.trait===t || n.traits?.includes(t);
  const score = (n,k)=>personality()?.score(n,k) ?? 50;

  function population(s){ return alive().filter(n=>n.settlementId===s.id); }

  function settlementScore(n,s){
    const p=population(s);
    const food=Math.min(30,(s.resources?.food||0)/4);
    const wealth=Math.min(24,(s.wealth||0)/10);
    const jobs=Math.min(18,Math.max(0,s.homes-p.length)*1.4 + (s.buildings||0)*.25);
    const safety=(s.stability||50)*.14;
    const size=p.length*.08;
    const sameRealm=s.kingdomId===n.faction?8:0;
    const familyNearby=alive().some(x=>x.id!==n.id&&x.familyId&&x.familyId===n.familyId&&x.settlementId===s.id)?18:0;
    const crimePenalty=p.reduce((a,x)=>a+(x.crimeHeat||0),0)/Math.max(1,p.length)*.03;
    const warPenalty=state.war&&s.kingdomId!==n.faction?10:0;
    return food+wealth+jobs+safety+size+sameRealm+familyNearby-crimePenalty-warPenalty;
  }

  function shouldLeave(n,home){
    if(!home || n.age<13 || n.roleId==='prisoner') return false;
    const pressure=(n.needs?.hunger??n.hunger??0)*.22 + (100-(n.needs?.safety??75))*.3 + (n.needs?.wealth??40)*.16 + (n.grievance||0)*.18;
    const poor=(n.wealth||0)<18 ? 18 : 0;
    const war=state.war && home.kingdomId===n.faction ? 18 : 0;
    const adventurous=has(n,'curious')||has(n,'reckless')||has(n,'ambitious') ? 7 : 0;
    const anchored=alive().filter(x=>x.id!==n.id&&x.familyId===n.familyId&&x.settlementId===home.id).length;
    return pressure+poor+war+adventurous > 74 + Math.min(anchored,6)*5;
  }

  function migrate(n,to,reason){
    const from=state.settlements.find(s=>s.id===n.settlementId);
    if(!to || (from && to.id===from.id)) return false;
    n.settlementId=to.id;
    n.home=to.name;
    n.x=to.x+(Math.random()*80-40);
    n.y=to.y+(Math.random()*80-40);
    n.roleId=n.roleId==='refugee'?'citizen':n.roleId;
    n.roleName=n.roleId==='citizen'?'Citizen':n.roleName;
    n.migration={fromId:from?.id||null,toId:to.id,year:state.year,reason};
    n.grievance=clamp((n.grievance||0)-10);
    memory()?.remember(n,`I moved to ${to.name} because ${reason}.`,'migration',3.1,to.id,'hope');
    if(from) from.history?.push(`Year ${state.year}: ${n.name} left for ${to.name}.`);
    to.history?.push(`Year ${state.year}: ${n.name} arrived from ${from?.name||'the frontier'}.`);
    if(Math.random()<.18) log(`${n.name} migrated from ${from?.name||'the frontier'} to ${to.name}.`);
    return true;
  }

  function refugeeResponse(n,home){
    if(!state.war && !state.plague) return false;
    if(!home) return false;
    if(Math.random()>0.012) return false;
    const targets=state.settlements.filter(s=>s.id!==home.id).sort((a,b)=>settlementScore(n,b)-settlementScore(n,a));
    const target=targets[0];
    if(!target) return false;
    const reason=state.war?'war made home unsafe':'disease made home dangerous';
    n.roleId='refugee'; n.roleName='Refugee';
    return migrate(n,target,reason);
  }

  function findMigration(n){
    const home=state.settlements.find(s=>s.id===n.settlementId);
    if(!home) return false;
    if(refugeeResponse(n,home)) return true;
    if(!shouldLeave(n,home)) return false;
    const options=state.settlements.filter(s=>s.id!==home.id && (s.kingdomId===n.faction || !state.war))
      .map(s=>({s,v:settlementScore(n,s)})).sort((a,b)=>b.v-a.v);
    const best=options[0];
    if(!best || best.v < settlementScore(n,home)+8) return false;
    return migrate(n,best.s,best.v>60?'better work and living conditions':'a search for safety');
  }

  function settleFounderCandidate(s){
    const people=population(s).filter(n=>n.age>=18);
    return people.sort((a,b)=>{
      const av=(a.wealth||0)*.15+(a.reputation||50)*.18+(a.influence||0)*.9+score(a,'ambition')*.22+score(a,'discipline')*.08;
      const bv=(b.wealth||0)*.15+(b.reputation||50)*.18+(b.influence||0)*.9+score(b,'ambition')*.22+score(b,'discipline')*.08;
      return bv-av;
    })[0]||null;
  }

  function foundSettlement(){
    if(state.settlements.length>=12 || state.year<5) return false;
    if(Math.random()>0.0012) return false;
    const candidates=alive().filter(n=>n.age>=20 && (n.settlementId==null || score(n,'curiosity')>72 || has(n,'ambitious')));
    if(!candidates.length) return false;
    const founder=candidates[Math.floor(Math.random()*candidates.length)];
    const origin=state.settlements.find(s=>s.id===founder.settlementId);
    if(origin && population(origin).length<14) return false;
    const angle=Math.random()*Math.PI*2, dist=300+Math.random()*260;
    const x=(origin?.x||founder.x)+Math.cos(angle)*dist;
    const y=(origin?.y||founder.y)+Math.sin(angle)*dist;
    if(Math.abs(x)>650||Math.abs(y)>450) return false;
    const nameBase=founder.name.split(' ')[0];
    if(!window.SIM_API?.createSettlement) return false;
    const s=window.SIM_API.createSettlement(`${nameBase} Haven`,x,y,'village',founder.faction,founder);
    if(!s) return false;
    founder.settlementId=s.id; founder.home=s.name; founder.x=x; founder.y=y;
    founder.roleId='mayor'; founder.roleName='Mayor';
    s.foundingCulture=has(founder,'curious')?'explorer-led':has(founder,'ambitious')?'frontier':'traditional';
    s.history?.push(`Year ${state.year}: founded by ${founder.name}.`);
    if(typeof window.SIM_API?.log==='function') window.SIM_API.log(`${founder.name} founded ${s.name} on the frontier.`);
    if(typeof window.makeCounty==='function') window.makeCounty(s);
    return true;
  }

  function evolveSettlement(s){
    const p=population(s), adults=p.filter(n=>n.age>=18), food=s.resources?.food||0;
    const density=p.length/Math.max(1,s.homes||1);
    const prosperity=(s.wealth||0)+food*1.5+(s.buildings||0)*7;
    s.population=p.length;
    s.capacity=s.homes||0;
    s.pressure=clamp((density-1)*55+(25-food)*.5);
    s.growth={population:p.length,prosperity:Math.round(prosperity),density:+density.toFixed(2)};
    if(s.type==='village' && p.length>=20 && adults.length>=12 && food>=45 && prosperity>=260){
      s.homes=Math.max(s.homes||5,12); s.buildings=Math.max(s.buildings||2,6);
      s.history?.push(`Year ${state.year}: village expanded into a town.`);
      s.type='town'; s.level=1.5; s.influence=Math.max(s.influence||1,1.7);
      log(`${s.name} grew into a town.`);
    } else if(s.type==='town' && p.length>=45 && adults.length>=25 && food>=65 && prosperity>=500 && s.stability>=60){
      s.homes=Math.max(s.homes||12,28); s.buildings=Math.max(s.buildings||6,14);
      s.history?.push(`Year ${state.year}: town expanded into a city.`);
      s.type='city'; s.level=2; s.influence=Math.max(s.influence||1.7,2.5);
      log(`${s.name} grew into a city.`);
    }
    if(p.length>Math.max(1,s.homes||1)*1.15) s.stability=clamp((s.stability||70)-.08,0,100);
    else if(p.length<Math.max(1,s.homes||1)*.65) s.stability=clamp((s.stability||70)-.02,0,100);
    else s.stability=clamp((s.stability||70)+.01,0,100);
  }

  function migrationTick(){
    if(!state.running) return;
    if(state.tick%18===0){
      const movers=alive().filter(n=>n.age>=16 && n.settlementId && n.roleId!=='king').slice(0,80);
      movers.forEach(n=>{ if(Math.random()<.12) findMigration(n); });
    }
    if(state.tick%30===0) state.settlements.forEach(evolveSettlement);
    if(state.tick%60===0) foundSettlement();
  }

  window.NPC_MIGRATION={step:migrationTick,migrate,settlementScore,evolveSettlement,findMigration};
  if(state.registerSystem) state.registerSystem({name:'migration',step:migrationTick,priority:82});
})();
