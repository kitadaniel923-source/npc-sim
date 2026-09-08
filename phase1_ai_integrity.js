// Phase 1 AI runtime integrity monitor.
// Verifies the core AI chain remains loaded and exposes the expected seams.
(() => {
  const state = window.SIM_STATE;
  if (!state) return;

  const REQUIRED = [
    ['personality', () => window.NPC_PERSONALITY?.score && window.NPC_PERSONALITY?.develop],
    ['needs', () => window.NPC_NEEDS?.update],
    ['goals', () => window.NPC_GOALS?.refresh && window.NPC_GOALS?.scoreAction],
    ['planning', () => window.NPC_PLANNING?.plan && window.NPC_PLANNING?.nextStep],
    ['careers', () => window.NPC_CAREERS?.chooseCareer],
    ['memory', () => window.NPC_MEMORY?.remember && window.NPC_MEMORY?.experience],
    ['relationships', () => window.NPC_RELATIONSHIPS?.interact && window.NPC_RELATIONSHIPS?.compatibility],
    ['decisions', () => window.NPC_DECISIONS?.choose],
    ['behavior', () => window.NPC_BEHAVIOR?.action],
    ['learning', () => window.NPC_LEARNING?.learn && window.NPC_LEARNING?.actionModifier],
    ['integration', () => window.PHASE1_AI?.ensure && window.PHASE1_AI?.applyGoalInfluence]
  ];

  function check() {
    const missing = REQUIRED.filter(([,test]) => !test()).map(([name]) => name);
    const population = (state.npcs || []).filter(n => n.alive);
    const initialized = population.filter(n => n.ai?.phase === 'phase1' && n.personality && n.needs && n.longTermGoal);
    state.phase1AI = {
      status: missing.length ? 'degraded' : 'complete',
      missing,
      checkedAt: state.tick,
      population: population.length,
      initialized: initialized.length,
      coverage: population.length ? initialized.length / population.length : 1
    };
    return state.phase1AI;
  }

  function step() {
    if (!state.running) return;
    check();
  }

  window.PHASE1_AI_INTEGRITY = {check,step,required:REQUIRED.map(([name])=>name)};
  if (state.registerSystem) state.registerSystem({name:'phase1-ai-integrity',step,priority:88});
})();
