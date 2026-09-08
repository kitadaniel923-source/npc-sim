// Phase 2: Civilization economy + class conflict feedback.
// Consumes society_civilization outputs and existing economy/resource state.
// Does not create a second economy, input owner, or render loop.
(() => {
  const state=window.SIM_STATE;if(!state)return;
  const P=()=>window.NPC_PERSONALITY,M=()=>window.NPC_MEMORY;
  const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,v));
  const alive=()=>state.npcs.filter(n=>n.alive);
  const score=(n,k)=>P()?.score?.(n,k)??50;
  const log=t=>window.SIM_LOG?.(t);
  const peopleAt=s=>alive().filter(n=>n.settlementId===s.id);

  const CLASS_NEEDS={
    peasant:{food:1.2,wealth:.8,safety:1.1,voice:1.0},
    artisan:{food:.8,wealth:1.1,voice:1.2,order:.8},
    merchant:{wealth:1.5,trade:1.4,voice:1.2,law:.9},
    scholar:{knowledge:1.5,voice:1.1,freedom:1.1},
    clergy:{faith:1.4,legitimacy:1.2,voice:.9},
    soldier:{pay:1.4,safety:1.5,glory:1.0,voice:.8},
    nobility:{land:1.5,status:1.5,authority:1.5,voice:1.2},
    royalty:{authority:2,stability:1.7,loyalty:1.5}
  };

  function ensure(s){
    s.society=s.society||{};
    s.society.economy=s.society.economy||{prices:{},markets:0,tradeVolume:0,production:0,prosperity:50};
    s.society.classGrievances=s.society.classGrievances||{};
    s.society.conflicts=s.society.conflicts||[];
    s.society.strikes=s.society.strikes||[];
    s.society.concessions=s.society.concessions||[];
  }

  function classProfile(s,p){
    const out={};
    for(const n of p){const c=n.society?.class||window.SOCIETY_CIVILIZATION?.classFor?.(n)||'peasant';const x=out[c]||(out[c]={count:0,wealth:0,influence:0,grievance:0});x.count++;x.wealth+=n.wealth||0;x.influence+=n.influence||0;x.grievance+=n.grievance||0;}
    return out;
  }

  function economyStep(s,p){
    const effects=s.society?.institutionEffects||{};
    const econ=s.society.economy;
    const resources=s.resources||{};
    const food=Number(resources.food??50),wood=Number(resources.wood??40),iron=Number(resources.iron??8),gold=Number(resources.gold??20);
    const trade=(effects.trade||0)+((s.society?.institutionEffects?.production||0)*.25);
    const production=(effects.production||0)+Math.min(1,food/100)*.2;
    const scarcity={food:clamp(70-food*.7,0,100),wood:clamp(55-wood*.6,0,100),iron:clamp(45-iron*2,0,100),gold:clamp(45-gold*.7,0,100)};
    econ.prices={food:clamp(100+scarcity.food*1.25-trade*12),wood:clamp(100+scarcity.wood-trade*8),iron:clamp(100+scarcity.iron*1.15-trade*5),gold:clamp(100+scarcity.gold-trade*3)};
    econ.markets=clamp(15+(s.guilds?0:0)+trade*26+(s.wealth||0)*.035);
    econ.tradeVolume=Math.max(0,(econ.tradeVolume||0)*.97+trade*3+p.length*.08);
    econ.production=Math.max(0,(econ.production||0)*.97+production*18);
    econ.prosperity=clamp(48+trade*16+production*12-(scarcity.food*.2));

    if(food<18){
      p.forEach(n=>{n.grievance=clamp((n.grievance||0)+.018*(state.speed||1));});
    }
    if(econ.prosperity>65) p.forEach(n=>{n.grievance=Math.max(0,(n.grievance||0)-.008);});
  }

  function grievanceStep(s,p){
    const profile=classProfile(s,p),effects=s.society?.institutionEffects||{},tax=s.feudal?.taxRate??.1,order=s.law?.order??60,leg=(s.society?.governance?.legitimacy??50),pros=(s.society?.economy?.prosperity??50),war=state.war?15:0;
    for(const [c,x] of Object.entries(profile)){
      const avgWealth=x.wealth/Math.max(1,x.count), avgInfluence=x.influence/Math.max(1,x.count), avgPersonal=x.grievance/Math.max(1,x.count), cfg=CLASS_NEEDS[c]||{};
      let g=35;
      g+=(tax-.09)*cfg.wealth*170;
      g+=(50-pros)*.35;
      g+=(50-order)*.18;
      g+=(50-leg)*.2;
      g+=war*(c==='soldier'?.35:.12);
      if(c==='peasant')g+=(28-Math.min(28,avgWealth))*.55+(50-(effects.legitimacy||0))*.15;
      if(c==='merchant')g+=Math.max(0,45-(effects.trade||0)*22)*.5;
      if(c==='scholar')g+=Math.max(0,40-(effects.knowledge||0)*55)*.42;
      if(c==='soldier')g+=Math.max(0,25-(effects.levy||0)*55)*.4;
      if(c==='nobility'||c==='royalty')g+=Math.max(0,35-(effects.legitimacy||0)*30)*.25;
      g+=avgPersonal*.35-avgInfluence*.03;
      s.society.classGrievances[c]=clamp(g);
    }
  }

  function classPair(a,b,s){
    const ga=s.society.classGrievances[a]??0,gb=s.society.classGrievances[b]??0;
    const pair=ga+gb;
    const ideological=(a==='peasant'&&['nobility','royalty'].includes(b))||(a==='merchant'&&b==='nobility')||(a==='scholar'&&['clergy','royalty'].includes(b))||(a==='soldier'&&b==='royalty');
    return pair*.52+(ideological?14:0);
  }

  function conflictStep(s,p){
    const classes=Object.keys(s.society.classGrievances||{}),conflicts=s.society.conflicts;
    for(let i=0;i<classes.length;i++)for(let j=i+1;j<classes.length;j++){
      const a=classes[i],b=classes[j],pressure=classPair(a,b,s);if(pressure<48)continue;
      const key=`${a}:${b}`;let c=conflicts.find(x=>x.key===key);
      if(!c){c={id:`class-conflict-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,key,a,b,pressure:0,status:'tension',support:[],history:[]};conflicts.push(c);}
      c.pressure=clamp(c.pressure*.93+pressure*.07);
      c.status=c.pressure>78?'open-conflict':c.pressure>58?'organized-pressure':'tension';
      const candidates=p.filter(n=>[a,b].includes(n.society?.class)).sort((x,y)=>(y.grievance||0)-(x.grievance||0));
      c.support=(c.support||[]).slice(-24);candidates.slice(0,24).forEach(n=>{if((n.grievance||0)>45&&!c.support.includes(n.id)&&Math.random()<.035)c.support.push(n.id);});
      if(state.tick%48===0){c.history=(c.history||[]).slice(-9);c.history.push({year:state.year,pressure:Math.round(c.pressure),status:c.status});}
      if(c.status==='open-conflict'&&state.tick%120===0){
        const target=c.support.map(id=>state.npcs.find(n=>n.id===id)).find(Boolean);
        if(target) M()?.remember?.(target,`Conflict grew between ${a} and ${b} in ${s.name}.`,'class-conflict',3,s.id,'anger');
      }
    }
    s.society.conflicts=conflicts.filter(c=>c.pressure>8).slice(-24);
  }

  function strikeStep(s,p){
    const merchants=s.society.classGrievances.merchant||0,artisans=s.society.classGrievances.artisan||0,scholars=s.society.classGrievances.scholar||0;
    const trigger=Math.max(merchants,artisans,scholars);
    if(trigger<65)return;
    const existing=s.society.strikes.find(x=>x.active);
    if(existing){existing.strength=clamp(existing.strength+trigger*.012);return;}
    const cls=trigger===merchants?'merchant':trigger===scholars?'scholar':'artisan';
    const m={id:`strike-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,class:cls,active:true,strength:12+trigger*.18,startedYear:state.year,history:[]};
    s.society.strikes.push(m);
    const workers=p.filter(n=>n.society?.class===cls).slice(0,10);workers.forEach(n=>{n.workBlocked=true;M()?.remember?.(n,`I joined a ${cls} strike in ${s.name}.`,'labor-conflict',2.5,s.id,'anger');});
    log(`${s.name} faces a ${cls} strike as class grievances rise.`);
  }

  function concessionsStep(s,p){
    const gov=s.society.governance,conf=s.society.conflicts.filter(c=>c.status==='open-conflict').sort((a,b)=>b.pressure-a.pressure)[0];
    if(!conf||conf.pressure<82||gov.legitimacy>55)return;
    if(state.tick%180!==0)return;
    const already=s.society.concessions.at(-1);if(already&&already.year===state.year)return;
    const change=conf.a==='peasant'||conf.b==='peasant'?-.012:conf.a==='merchant'||conf.b==='merchant'?.008:0;
    if(s.feudal)s.feudal.taxRate=clamp((s.feudal.taxRate||.1)+change,.03,.2);
    s.stability=clamp((s.stability||60)+4);gov.legitimacy=clamp((gov.legitimacy||50)+6);
    s.society.concessions.push({year:state.year,conflict:conf.key,effect:change<0?'tax relief':'trade concession'});s.society.concessions=s.society.concessions.slice(-8);
    log(`${s.name} granted concessions after pressure from ${conf.a} and ${conf.b}.`);
    p.filter(n=>n.society?.class===conf.a||n.society?.class===conf.b).slice(0,8).forEach(n=>{n.grievance=Math.max(0,(n.grievance||0)-8);M()?.remember?.(n,`The authorities granted concessions after our pressure.`,'class-conflict',2,s.id,'relief');});
  }

  function step(){
    if(!state.running||!window.SOCIETY_CIVILIZATION)return;
    state.settlements?.forEach(s=>{const p=peopleAt(s);if(!p.length)return;ensure(s);p.forEach(n=>{if(!n.society)window.SOCIETY_CIVILIZATION.ensureNpc(n);});economyStep(s,p);grievanceStep(s,p);conflictStep(s,p);strikeStep(s,p);concessionsStep(s,p);});
    state.kingdoms?.forEach(k=>{
      const settlements=state.settlements.filter(s=>(s.kingdomId||null)===k.id);k.society=k.society||{};k.society.prosperity=settlements.length?settlements.reduce((a,s)=>a+(s.society?.economy?.prosperity||50),0)/settlements.length:50;k.society.classConflict=settlements.reduce((a,s)=>a+(s.society?.conflicts?.filter(c=>c.status==='open-conflict').length||0),0);
    });
  }

  window.SOCIETY_ECONOMY={ensure,economyStep,grievanceStep,conflictStep,strikeStep,concessionsStep};
  state.registerSystem?.({name:'society-economy-conflict',step,priority:96});
})();
