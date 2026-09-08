// Phase 3F/3G: post-war political settlement and dynastic geopolitics.
// Uses existing settlement/kingdom/dynasty/civil-war structures, adding durable political consequences.
(() => {
  const state=window.SIM_STATE;if(!state)return;
  const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,v));
  const log=t=>window.SIM_LOG?.(t);
  const alive=()=>state.npcs.filter(n=>n.alive);
  function ensure(k){k.dynasticGeopolitics=k.dynasticGeopolitics||{claimants:[],marriages:[],backers:{},history:[]};k.occupation=k.occupation||{overlordId:null,tribute:0,resistance:0,installedRulerId:null,history:[]};return k;}
  function settleConquest(winner,loser){
    const wk=ensure(winner);const owned=state.settlements.filter(s=>String(s.kingdomId)===String(loser.id));if(!owned.length||!state.war)return;
    const target=owned.sort((a,b)=>(b.wealth||0)-(a.wealth||0))[0];const existing=wk.occupation?.conquests?.find?.(x=>String(x.settlementId)===String(target.id));
    wk.occupation.conquests=wk.occupation.conquests||[];if(existing)return;
    wk.occupation.conquests.push({settlementId:target.id,startYear:state.year,mode:(winner.power||25)>=(loser.power||25)*1.4?'annex':'occupation',resistance:12});
    target.occupation={overlordId:winner.id,startYear:state.year,resistance:12,tribute:.03,mode:wk.occupation.conquests.at(-1).mode};
    target.history=target.history||[];target.history.push(`Year ${state.year}: conquered by ${winner.name}.`);target.history=target.history.slice(-20);
  }
  function occupationStep(){
    state.settlements.forEach(s=>{const o=s.occupation;if(!o)return;const pop=alive().filter(n=>String(n.settlementId)===String(s.id));const grievance=pop.reduce((v,n)=>v+(n.grievance||0),0)/Math.max(1,pop.length);o.resistance=clamp((o.resistance||0)*.96+grievance*.02-(o.mode==='annex'?1.1:.35));if(o.mode==='occupation'&&o.resistance>72&&Math.random()<.01){pop.slice(0,2).forEach(n=>{n.roleId='rebel';n.roleName='Rebel';n.grievance=clamp((n.grievance||0)+8)});log(`${s.name} is resisting occupation.`);}if(o.mode==='annex'&&o.resistance<18&&state.tick%240===0){delete s.occupation;log(`${s.name} has been fully integrated into its new realm.`);}});
  }
  function dynasticStep(){
    const kingdoms=(state.kingdoms||[]).filter(k=>!k.civilWarRebel);kingdoms.forEach(ensure);
    for(let i=0;i<kingdoms.length;i++)for(let j=i+1;j<kingdoms.length;j++){const a=kingdoms[i],b=kingdoms[j],la=alive().find(n=>String(n.id)===String(a.leaderId)),lb=alive().find(n=>String(n.id)===String(b.leaderId));if(!la||!lb)continue;const familyA=state.families.find(f=>String(f.id)===String(la.familyId)),familyB=state.families.find(f=>String(f.id)===String(lb.familyId));const score=(window.SOCIETY_CIVILIZATION_EVOLUTION?.relationScore?.(a.id,b.id)??0)+(familyA&&familyB&&familyA.rivalry<10&&familyB.rivalry<10?10:0);if(score>65&&state.tick%960===0&&Math.random()<.16){a.dynasticGeopolitics.marriages.push({year:state.year,a:la.id,b:lb.id,kingdomA:a.id,kingdomB:b.id});a.stability=clamp((a.stability||70)+2);b.stability=clamp((b.stability||70)+2);a.dynasticGeopolitics.history.push({year:state.year,type:'marriage-alliance',partner:b.id});b.dynasticGeopolitics.history.push({year:state.year,type:'marriage-alliance',partner:a.id});log(`${a.name} and ${b.name} strengthened ties through a dynastic marriage.`);}};
    kingdoms.forEach(k=>{const rivals=(k.dynasty?.rivalClaims||[]);rivals.slice(0,4).forEach(c=>{k.dynasticGeopolitics.claimants.push({id:c.id||`${k.id}-${state.year}`,year:state.year,claimantId:c.claimantId||null,legitimacy:c.legitimacy||50});});k.dynasticGeopolitics.claimants=k.dynasticGeopolitics.claimants.slice(-12);});
  }
  function step(){if(!state.running)return;if(state.tick%48===0){occupationStep();dynasticStep();}if(state.war&&state.tick%120===0){const kingdoms=(state.kingdoms||[]).filter(k=>!k.civilWarRebel);kingdoms.forEach(w=>{kingdoms.filter(l=>l.id!==w.id).forEach(l=>{if((w.power||0)>(l.power||0)*1.3)settleConquest(w,l);});});}}
  window.OCCUPATION_DYNASTY={step,ensure,settleConquest};state.registerSystem?.({name:'occupation-dynasty',step,priority:108});
})();
