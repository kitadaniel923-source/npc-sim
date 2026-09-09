// Runtime verification for the asset integration and Phase 1 causal loop.
(() => {
  const state=window.SIM_STATE;
  if(!state)return;
  const original=window.EVERGLEN_DEEP_AUDIT?.test;
  function test(){
    const base=original?original():{ok:true,checks:[],errors:[]};
    const errors=Array.isArray(base.errors)?base.errors.slice():[];
    const assets=window.EVERGLEN_SUPPLEMENTAL_ASSETS?.status;
    const causal=window.EVERGLEN_PHASE1_CAUSALITY;
    const npcs=(state.npcs||[]).filter(n=>n&&n.alive);
    const learned=npcs.filter(n=>n.learning&&n.goalLearning);
    const outcomes=npcs.filter(n=>n.longTermGoal?.outcomeCount>0||n.consequence?.tick!=null);
    if(!assets?.available)errors.push('supplemental asset atlas not available at runtime');
    if((assets?.totalAssets||0)<600)errors.push(`supplemental asset catalog too small: ${assets?.totalAssets||0}`);
    if((assets?.draws||0)<1)errors.push('supplemental asset renderer has produced no draws');
    if(!causal)errors.push('Phase 1 deep causality bridge not loaded');
    if(learned.length===0)errors.push('NPCs did not receive learned goal/outcome state');
    if(outcomes.length===0)errors.push('no NPC action outcomes reached goal feedback');
    return {...base,ok:errors.length===0,errors,checks:[...(base.checks||[]),{name:'supplemental assets',ok:!!assets?.available&&assets.totalAssets>=600&&assets.draws>0,details:`${assets?.totalAssets||0} catalogued assets, ${assets?.draws||0} draws`},{name:'deep causality',ok:!!causal&&learned.length>0&&outcomes.length>0,details:`${learned.length} learned NPCs, ${outcomes.length} NPCs with outcome feedback`}]};
  }
  if(original){window.EVERGLEN_DEEP_AUDIT.test=test;}
  window.EVERGLEN_RUNTIME_INTEGRATION_AUDIT={test};
})();
