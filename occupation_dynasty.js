// Phase 3F/3G: post-war settlement and dynastic geopolitics.
(() => {
  const state=window.SIM_STATE;if(!state)return;
  const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,v));
  const log=t=>window.SIM_LOG?.(t);
  const alive=()=>state.npcs.filter(n=>n.alive);
  const kingdoms=()=>state.kingdoms.filter(k=>!k.civilWarRebel);
  function ensure(k){k.dynasticGeopolitics=k.dynasticGeopolitics||{claimants:[],marriages:[],backers:{},history:[]};k.occupation=k.occupation||{overlordId:null,tribute:0,resistance:0,installedRulerId:null,history:[],conquests:[]};k.occupation.conquests=k.occupation.conquests||[];return k;}
  function capture(target,winner,loser,mode){
    if(!target||!winner||!loser||String(target.kingdomId)!==String(loser.id))return false;
    target.kingdomId=winner.id;
    target.history=target.history||[];
    target.history.push(`Year ${state.year}: ${mode==='annex'?'annexed':'occupied'} by ${winner.name}.`);
    target.history=target.history.slice(-20);
    state.counties.filter(c=>String(c.settlementId)===String(target.id)).forEach(c=>c.kingdomId=winner.id);
    target.occupation={overlordId:winner.id,startYear:state.year,resistance:mode==='annex'?8:18,tribute:mode==='annex'?0:.035,mode};
    if(String(target.id)===String(loser.capitalId)){loser.capitalId=state.settlements.find(s=>String(s.kingdomId)===String(loser.id)&&s.id!==target.id)?.id||null;winner.capitalId=winner.capitalId||target.id;}
    if(window.SIM_API?.recomputeTerritory)window.SIM_API.recomputeTerritory(true);
    ensure(winner).occupation.history.push({year:state.year,type:mode==='annex'?'annexation':'occupation',settlementId:target.id,from:loser.id});
    log(`${winner.name} ${mode==='annex'?'annexed':'occupied'} ${target.name}.`);
    return true;
  }
  function settleConquest(winner,loser){
    const wk=ensure(winner),owned=state.settlements.filter(s=>String(s.kingdomId)===String(loser.id)&&!s.occupation);
    if(!owned.length||!state.war)return null;
    const target=owned.sort((a,b)=>(b.wealth||0)-(a.wealth||0))[0];
    const mode=(winner.power||25)>=(loser.power||25)*1.4?'annex':'occupation';
    const occ={overlordId:winner.id,startYear:state.year,resistance:mode==='annex'?8:18,tribute:mode==='annex'?0:.035,mode};
    target.occupation=occ;
    wk.occupation.conquests.push({settlementId:target.id,startYear:state.year,mode,resistance:occ.resistance});
    wk.occupation.conquests=wk.occupation.conquests.slice(-16);
    return target;
  }
  function occupationStep(){
    state.settlements.forEach(s=>{
      const o=s.occupation;if(!o)return;
      const winner=state.kingdoms.find(k=>String(k.id)===String(o.overlordId));
      const loser=state.kingdoms.find(k=>String(k.id)===String(s.kingdomId));
      if(!winner||!loser||winner.id===loser.id){delete s.occupation;return;}
      const pop=alive().filter(n=>String(n.settlementId)===String(s.id));
      const grievance=pop.reduce((v,n)=>v+(n.grievance||0),0)/Math.max(1,pop.length);
      o.resistance=clamp((o.resistance||0)*.965+grievance*.025-(o.mode==='annex'?1.2:.45));
      if(o.resistance>75&&o.mode==='occupation')pop.slice(0,Math.max(2,Math.min(5,Math.floor(pop.length*.04)))).forEach(n=>{n.roleId='rebel';n.roleName='Rebel';n.grievance=clamp((n.grievance||0)+8);});
      if(((o.mode==='annex'&&o.resistance<10)||(o.mode==='occupation'&&o.resistance<12&&state.year-o.startYear>=3))&&String(s.kingdomId)===String(loser.id))capture(s,winner,loser,o.mode||'occupation');
    });
  }
  function dynasticStep(){
    const ks=kingdoms();ks.forEach(ensure);
    for(let i=0;i<ks.length;i++)for(let j=i+1;j<ks.length;j++){
      const a=ks[i],b=ks[j],la=alive().find(n=>String(n.id)===String(a.leaderId)),lb=alive().find(n=>String(n.id)===String(b.leaderId));if(!la||!lb)continue;
      const fa=state.families.find(f=>String(f.id)===String(la.familyId)),fb=state.families.find(f=>String(f.id)===String(lb.familyId)),r=window.SOCIETY_CIVILIZATION_EVOLUTION?.relationScore?.(a.id,b.id)??0;
      if(r+(fa&&fb&&fa.rivalry<10&&fb.rivalry<10?10:0)>65&&Math.random()<.16){const m={year:state.year,a:la.id,b:lb.id,kingdomA:a.id,kingdomB:b.id};a.dynasticGeopolitics.marriages.push(m);b.dynasticGeopolitics.marriages.push(m);a.stability=clamp((a.stability||70)+2);b.stability=clamp((b.stability||70)+2);log(`${a.name} and ${b.name} strengthened ties through a dynastic marriage.`);}
    }
    ks.forEach(k=>{(k.dynasty?.rivalClaims||[]).slice(0,4).forEach(c=>k.dynasticGeopolitics.claimants.push({id:c.id||`${k.id}-${state.year}`,year:state.year,claimantId:c.claimantId||null,legitimacy:c.legitimacy||50}));k.dynasticGeopolitics.claimants=k.dynasticGeopolitics.claimants.slice(-12);});
  }
  function step(){if(!state.running)return;if(state.tick%48===0)occupationStep();if(state.tick%960===0)dynasticStep();if(state.war&&state.tick%120===0){const ks=kingdoms();ks.forEach(w=>ks.filter(l=>l.id!==w.id&&(w.power||0)>(l.power||0)*1.3).forEach(l=>settleConquest(w,l)));}}
  window.OCCUPATION_DYNASTY={step,ensure,settleConquest,capture};state.registerSystem?.({name:'occupation-dynasty',step,priority:108});
})();
