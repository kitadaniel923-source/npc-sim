// Phase 3D/3E: kingdom war objectives and military strategy commands.
// This module plans; npc_war.js remains the battle/siege executor.
(() => {
  const state=window.SIM_STATE;if(!state)return;
  const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,v));
  const alive=()=>state.npcs.filter(n=>n.alive);
  const settlementsOf=k=>state.settlements.filter(s=>String(s.kingdomId)===String(k.id));
  const relation=(a,b)=>window.SOCIETY_CIVILIZATION_EVOLUTION?.relationScore?.(a,b)??0;
  const distance=(a,b)=>Math.hypot((a.x||0)-(b.x||0),(a.y||0)-(b.y||0));
  const log=t=>window.SIM_LOG?.(t);
  const goalTypes=['defend-homeland','seize-border','capture-capital','secure-resource','punish-rival','support-ally','enforce-treaty','force-concessions'];
  function ensure(k){k.warPlan=k.warPlan||{objectives:[],participants:[],history:[],posture:'defensive',mobilized:false,lastPlanYear:0};k.warPlan.objectives=Array.isArray(k.warPlan.objectives)?k.warPlan.objectives:[];return k.warPlan;}
  function targetFor(k){
    const gp=k.geopolitics||{}, threats=gp.threats||[], opp=gp.opportunities||[];
    if(threats[0])return state.kingdoms.find(o=>String(o.id)===String(threats[0].kingdomId))||null;
    if(opp[0])return state.kingdoms.find(o=>String(o.id)===String(opp[0].kingdomId))||null;
    return state.kingdoms.find(o=>o.id!==k.id&&!o.civilWarRebel&&relation(k.id,o.id)<-35)||null;
  }
  function makeObjective(k){
    const plan=ensure(k),ss=settlementsOf(k),target=targetFor(k),strategy=k.strategy?.type||'cautious';
    const atRisk=ss.filter(s=>(s.stability||70)<40),capitalTarget=target&&state.settlements.find(s=>String(s.id)===String(target.capitalId));
    let type='defend-homeland',targetSettlementId=atRisk[0]?.id||null,score=30,reason='protect the realm';
    if(strategy==='expansionist'&&target){type='seize-border';score=58;reason='expand into a vulnerable frontier';targetSettlementId=state.settlements.find(s=>String(s.kingdomId)===String(target.id))?.id||null;}
    else if(strategy==='militarist'&&capitalTarget){type='capture-capital';score=64;reason='cripple a rival by taking its capital';targetSettlementId=capitalTarget.id;}
    else if(target&&relation(k.id,target.id)<-45){type='punish-rival';score=55;reason='punish hostile relations';targetSettlementId=state.settlements.find(s=>String(s.kingdomId)===String(target.id))?.id||null;}
    if(!plan.objectives.length||state.year-(plan.objectives[0].createdYear||0)>12)plan.objectives.unshift({id:`wo-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,type,targetKingdomId:target?.id||null,targetSettlementId,priority:score,progress:0,status:'planned',createdYear:state.year,reason});
    plan.objectives=plan.objectives.slice(0,8);return plan.objectives[0];
  }
  function strategicTarget(a){
    const k=state.kingdoms.find(x=>String(x.id)===String(a.kingdomId));if(!k)return null;const p=ensure(k).objectives.find(o=>o.status!=='complete'&&o.targetSettlementId);if(p)return state.settlements.find(s=>String(s.id)===String(p.targetSettlementId))||null;
    const enemies=state.settlements.filter(s=>String(s.kingdomId)!==String(a.kingdomId));return enemies.sort((x,y)=>{const vx=(x.id===k.capitalId?1000:0)+(x.wealth||0)+(x.resources?.gold||0)*3;const vy=(y.id===k.capitalId?1000:0)+(y.wealth||0)+(y.resources?.gold||0)*3;return vy-vx;})[0]||null;
  }
  function mobilize(k){const p=ensure(k),ss=settlementsOf(k),need=Math.max(0,(k.strategy?.readiness||35)-45);p.mobilized=!!state.war&&((k.strategy?.warWillingness||30)>need||p.objectives.some(o=>o.type==='defend-homeland'));p.posture=p.mobilized?'offensive-readiness':(k.strategy?.posture||'neutral');if(!p.mobilized)return;state.armies.filter(a=>String(a.kingdomId)===String(k.id)).forEach(a=>{a.active=true;const t=strategicTarget(a);if(t){a.targetSettlementId=t.id;a.strategicTargetId=t.id;}});if(!state.armies.some(a=>String(a.kingdomId)===String(k.id))&&ss.length){const s=ss[0];state.armies.push({id:`strat-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,kingdomId:k.id,x:s.x,y:s.y,targetSettlementId:null,route:[],routeIndex:0,routeDistance:0,soldiers:Math.max(8,Math.round((k.power||25)*.7)),supply:100,morale:82,speed:.82,active:true});}}
  function step(){if(!state.running)return;if(state.tick%36!==0)return;(state.kingdoms||[]).filter(k=>!k.civilWarRebel).forEach(k=>{ensure(k);if(k.strategy?.goals)makeObjective(k);if(state.war)mobilize(k);});}
  window.WAR_STRATEGY={step,ensure,makeObjective,strategicTarget};state.registerSystem?.({name:'war-strategy',step,priority:106});
})();
