// Phase 1 deep causality bridge.
// Converts outcomes into persistent momentum that changes future goals, planning and decisions.
(() => {
  const state=window.SIM_STATE;if(!state)return;
  const goals=window.NPC_GOALS,learning=window.NPC_LEARNING;
  const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,Number(v)||0));
  const alive=()=>state.npcs||[];

  if(goals?.recordOutcome&&!goals.recordOutcome._deepCausality){
    const original=goals.recordOutcome;
    const wrapped=(n,success=true,reason='')=>{
      if(!n)return;
      const outcomeKey=String(state.tick)+'|'+String(n.aiDecision?.action||n.currentPlan?.id||'')+'|'+String(success)+'|'+String(reason);
      if(n._deepOutcomeKey===outcomeKey)return;
      n._deepOutcomeKey=outcomeKey;
      const g=n.longTermGoal;
      original(n,success,reason);
      n.goalLearning=n.goalLearning||{successes:0,failures:0,momentum:0,streak:0,lastTick:-1};
      const gl=n.goalLearning;
      if(success){gl.successes++;gl.streak=Math.max(0,gl.streak)+1;gl.momentum=clamp(gl.momentum+1.4+Math.min(1.5,gl.streak*.08),-25,25)}
      else{gl.failures++;gl.streak=Math.min(0,gl.streak)-1;gl.momentum=clamp(gl.momentum-1.8-Math.min(2,Math.abs(gl.streak)*.12),-25,25)}
      gl.lastTick=state.tick;
      if(g){g.outcomeCount=(g.outcomeCount||0)+1;g.successCount=(g.successCount||0)+(success?1:0);g.failureCount=(g.failureCount||0)+(success?0:1);g.momentum=clamp((g.momentum||0)+(success?1.1:-1.5),-20,20);g.lastOutcome={success,tick:state.tick,reason};if((g.failureCount||0)>=3&&!success)n.goalReassessmentAt=state.tick+1;}
    };
    wrapped._deepCausality=true;goals.recordOutcome=wrapped;
  }

  if(goals?.scoreAction&&!goals.scoreAction._deepCausality){
    const original=goals.scoreAction;
    const wrapped=(n,action)=>{
      const base=Number(original(n,action))||0;
      const learned=Number(learning?.actionModifier?.(n,action))||0;
      const momentum=Number(n?.longTermGoal?.momentum)||0;
      return base+learned*.55+momentum*.18;
    };
    wrapped._deepCausality=true;goals.scoreAction=wrapped;
  }

  if(goals?.refresh&&!goals.refresh._deepCausality){
    const original=goals.refresh;
    const wrapped=(n,force=false)=>{
      const result=original(n,force||n.goalReassessmentAt===state.tick);
      if(result?.momentum!=null)result.score=Math.max(1,Math.round((result.score||1)+result.momentum));
      return result;
    };
    wrapped._deepCausality=true;goals.refresh=wrapped;
  }

  function adaptMemory(n){
    if(!n?.alive||!learning)return;
    n.causality=n.causality||{processed:{},lastTick:-1};
    const high=(n.memories||[]).filter(m=>(m.importance||0)>=2.5).slice(0,16);
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
  }

  function step(){alive().filter(n=>n.alive).forEach(n=>{adaptMemory(n);if(n.goalReassessmentAt!=null&&state.tick>=n.goalReassessmentAt){goals?.refresh?.(n,true);n.goalReassessmentAt=null;}});}
  window.EVERGLEN_PHASE1_CAUSALITY={step};
  if(state.registerSystem)state.registerSystem({name:'phase1-deep-causality',step,priority:112});
})();
