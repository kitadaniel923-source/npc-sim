// Everglen deep causality layer.
// Safely adapts legacy and partially initialized memory/causality records into the learning pipeline.
(() => {
  const state=window.SIM_STATE;
  if(!state)return;
  const learning=window.EVERGLEN_NPC_LEARNING||window.NPC_LEARNING;
  const goals=window.EVERGLEN_GOALS||window.NPC_GOALS;
  const alive=()=>Array.isArray(state.npcs)?state.npcs:[];
  const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,Number(v)||0));

  function adaptMemory(n){
    if(!n?.alive||!learning)return;
    // Some older save/runtime paths create causality without its processed map.
    // Always normalize the nested map before indexing it.
    if(!n.causality||typeof n.causality!=='object'||Array.isArray(n.causality))n.causality={};
    if(!n.causality.processed||typeof n.causality.processed!=='object'||Array.isArray(n.causality.processed))n.causality.processed={};
    if(!Number.isFinite(n.causality.lastTick))n.causality.lastTick=-1;
    const memories=Array.isArray(n.memories)?n.memories:[];
    const high=memories.filter(m=>m&&(m.importance||0)>=2.5).slice(0,16);
    high.forEach(m=>{
      const id=String(m.tick||0)+'|'+String(m.type||'')+'|'+String(m.text||'').slice(0,48);
      if(n.causality.processed[id])return;
      n.causality.processed[id]=1;
      const text=String(m.text||'').toLowerCase();
      n.learning=learning.ensure(n);
      if(m.type==='war'||m.type==='disaster'||text.includes('danger'))n.learning.riskTolerance=clamp((n.learning.riskTolerance??50)-1.2);
      if(m.type==='relationship'&&m.emotion==='joy')n.learning.socialConfidence=clamp((n.learning.socialConfidence??50)+1.0);
      if(m.type==='betrayal'||m.emotion==='anger')n.learning.trustCaution=clamp((n.learning.trustCaution??50)+1.4);
    });
    const keys=Object.keys(n.causality.processed);if(keys.length>64)keys.slice(0,keys.length-64).forEach(k=>delete n.causality.processed[k]);
    n.causality.lastTick=state.tick;
  }

  function step(){alive().filter(n=>n.alive).forEach(n=>{adaptMemory(n);if(n.goalReassessmentAt!=null&&state.tick>=n.goalReassessmentAt){goals?.refresh?.(n,true);n.goalReassessmentAt=null;}});}
  window.EVERGLEN_PHASE1_CAUSALITY={step,adaptMemory};
  if(state.registerSystem)state.registerSystem({name:'phase1-deep-causality',step,priority:112});
})();
