// Phase 1 deep causality: outcome -> memory -> learning -> future policy.
(() => {
  const state=window.SIM_STATE;if(!state)return;
  const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,v));
  const alive=()=> (state.npcs||[]).filter(n=>n.alive);
  const learning=()=>window.NPC_LEARNING;
  const memory=()=>window.NPC_MEMORY;
  const goals=()=>window.NPC_GOALS;
  const personality=()=>window.NPC_PERSONALITY;
  const actionSucceeded=(n,a)=>!!a&&(n.actionHistory||[]).some(x=>x.tick===state.tick&&x.action===a);
  const actionIntensity=a=>({confront:1.5,trade:1.15,wealth:1.1,govern:1.2,explore:1.1,train:1,study:.9,socialize:.8,belong:.8,work:.75,safety:1.15,eat:.5,drink:.5,rest:.5}[a]||.7);
  const ensure=n=>{
    n.causality=n.causality||{outcomes:0,successes:0,failures:0,actionValue:{},goalOutcomes:{},recent:[],confidence:50};
    n.causality.actionValue ||= {};
    n.causality.goalOutcomes ||= {};
    n.causality.recent ||= [];
    return n.causality;
  };
  function applyOutcome(n,action,success,text){
    const c=ensure(n),l=learning()?.ensure?.(n);if(!action)return;
    c.outcomes++; if(success)c.successes++;else c.failures++;
    const old=c.actionValue[action]??50;
    const intensity=actionIntensity(action);
    const target=success?clamp(50+18*intensity,0,100):clamp(50-22*intensity,0,100);
    c.actionValue[action]=clamp(old+(target-old)*.12,0,100);
    if(l){l.causalWeights ||= {};const prior=l.causalWeights[action]??50;const shift=success?2.2*intensity:-2.8*intensity;l.causalWeights[action]=clamp(prior+shift,0,100);}
    const goal=n.longTermGoal;
    if(goal?.id){const g=c.goalOutcomes[goal.id]||{successes:0,failures:0,progress:0};if(success){g.successes++;g.progress=clamp(g.progress+Math.max(1.2,goal.stakes?.urgency?1.8:1.4),0,100);}else{g.failures++;g.progress=clamp(g.progress-Math.min(2.5,1+intensity*.5),0,100);}c.goalOutcomes[goal.id]=g;}
    c.confidence=clamp(c.confidence+(success?1.1:-1.4)*intensity,0,100);
    c.lastOutcome={tick:state.tick,action,success,text,confidence:c.confidence,policy:l?.causalWeights?.[action]??null};
    c.recent.unshift(c.lastOutcome);c.recent=c.recent.slice(0,8);
    n.causalFeedback=n.causalFeedback||{};
    n.causalFeedback[action]={tick:state.tick,success,confidence:c.confidence};
    if(memory()?.experience && (success||!success&&((c.failures%3===0)||c.actionValue[action]<30))){
      memory().experience(n,`${success?'Success':'Failure'} while trying to ${action}: ${text||action}.`,'causal_outcome',success?1.8:2.4,null,success?'pride':'fear',success?.8:1.1);
    }
    if(personality()?.develop){
      const event=action==='study'?'study':action==='work'?'work':action==='explore'?'explore':action==='socialize'||action==='belong'?'social':action==='govern'?'leadership':action==='confront'||action==='train'?'combat':null;
      if(event)personality().develop(n,event,success?.18:.08);
    }
    goals()?.recordOutcome?.(n,success,text||action);
  }
  function step(){
    if(!state.running)return;
    const people=window.SIM_BUDGET?.npcBatch?window.SIM_BUDGET.npcBatch():alive();
    people.forEach(n=>{
      ensure(n);
      const d=n.aiDecision;
      if(!d?.action||n.lastDecisionAt!==state.tick||n._deepCausalityTick===state.tick)return;
      const success=actionSucceeded(n,d.action);
      applyOutcome(n,d.action,success,n.lastAction||`Could not complete ${d.action}.`);
      n._deepCausalityTick=state.tick;
    });
  }
  function actionModifier(n,action){const c=ensure(n);return ((c.actionValue[action]??50)-50)*.18+(c.confidence-50)*.04;}
  window.NPC_DEEP_CAUSALITY={ensure,step,actionModifier,applyOutcome};
  if(state.registerSystem)state.registerSystem({name:'deep-causality',step,priority:115});
})();
