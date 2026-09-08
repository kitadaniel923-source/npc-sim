// Decision ledger: records why an NPC's goal/action changed and which subsystem influenced it.
(() => {
  const state = window.SIM_STATE;
  if (!state) return;

  const MAX = 40;
  const history = npc => {
    npc.decisionTrace = Array.isArray(npc.decisionTrace) ? npc.decisionTrace : [];
    return npc.decisionTrace;
  };

  function record(npc, reason, source='unknown', action=null, weight=1) {
    if (!npc) return;
    const trace = history(npc);
    const entry = {
      tick: state.tick,
      year: state.year,
      day: state.day,
      source,
      reason: String(reason || 'No reason recorded'),
      action: action || npc.goal || npc.lastAction || null,
      weight: Math.max(0, Number(weight) || 0)
    };
    trace.unshift(entry);
    npc.decisionReason = entry.reason;
    npc.decisionSource = source;
    npc.decisionWeight = entry.weight;
    npc.decisionTrace = trace.slice(0, MAX);
    return entry;
  }

  function top(npc, limit=5) {
    return history(npc).slice(0, Math.max(1, limit));
  }

  function explain(npc) {
    const recent = top(npc, 3);
    if (!recent.length) return 'No decision trace recorded.';
    return recent.map(x => `${x.source}: ${x.reason}`).join(' | ');
  }

  function step() {
    if (!state.running) return;
    const planning = window.NPC_PLANNING;
    const behavior = window.NPC_BEHAVIOR;
    const careers = window.NPC_CAREERS;
    const relationships = window.NPC_RELATIONSHIPS;

    (state.npcs || []).filter(n => n.alive).forEach(n => {
      if (n.currentPlan?.reason && n._lastTracePlanReason !== n.currentPlan.reason) {
        record(n, n.currentPlan.reason, 'planning', n.currentPlan.name || n.currentPlan.type || n.goal, 1.0);
        n._lastTracePlanReason = n.currentPlan.reason;
      }
      if (n.goal && n.goal !== n._lastTraceGoal) {
        record(n, `Goal became "${n.goal}"`, 'behavior', n.goal, 0.8);
        n._lastTraceGoal = n.goal;
      }
      if (n.career && n.career !== n._lastTraceCareer) {
        record(n, `Career changed to ${typeof n.career === 'string' ? n.career : n.career.name || n.career.id || 'new career'}`, 'career', n.career, 0.9);
        n._lastTraceCareer = n.career;
      }
      if (n.careerId && n.careerId !== n._lastTraceCareerId) {
        record(n, `Career assignment changed to ${n.careerId}`, 'career', n.careerId, 0.9);
        n._lastTraceCareerId = n.careerId;
      }
      if (n.spouseId && n.spouseId !== n._lastTraceSpouse) {
        const spouse = state.npcs.find(x => x.id === n.spouseId);
        record(n, `Bonded with ${spouse?.name || 'a spouse'}`, 'relationships', 'family', 1.0);
        n._lastTraceSpouse = n.spouseId;
      }
      if (n.planFailure?.reason && n.planFailure.reason !== n._lastTraceFailure) {
        record(n, `Plan failed: ${n.planFailure.reason}`, 'planning', 'replan', 1.2);
        n._lastTraceFailure = n.planFailure.reason;
      }
    });

    void planning;
    void behavior;
    void careers;
    void relationships;
  }

  window.NPC_DECISION_TRACE = {record, top, explain, step};
  if (state.registerSystem) state.registerSystem({name:'decision-trace', step, priority:105});
})();
