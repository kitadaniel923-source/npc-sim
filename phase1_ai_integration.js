// Phase 1 AI integration seam.
// Connects personality, careers, needs, goals, decisions, behavior, relationships and memory
// without replacing the existing specialist systems.
(() => {
  const state = window.SIM_STATE;
  if (!state) return;

  const clamp = (v,a=0,b=100) => Math.max(a,Math.min(b,v));
  const goals = () => window.NPC_GOALS;
  const personality = () => window.NPC_PERSONALITY;
  const careerSeen = new Map();
  const actionSeen = new Map();

  function ensure(n) {
    if (!n) return;
    personality()?.ensure?.(n);
    goals()?.refresh?.(n);
    n.ai = n.ai || {};
    n.ai.phase = 'phase1';
    n.ai.longTermGoal = n.longTermGoal?.id || null;
    n.ai.goalCategory = n.longTermGoal?.category || null;
    n.ai.goalScore = n.longTermGoal?.score || 0;
    n.ai.stakes = n.goalStakes || n.longTermGoal?.stakes || [];
  }

  function goalScore(n, action) {
    return goals()?.scoreAction?.(n, action) || 0;
  }

  function applyGoalInfluence(n) {
    if (!n?.aiDecision) return;
    const d = n.aiDecision;
    const g = goals()?.refresh?.(n);
    if (!g) return;
    const influence = goalScore(n, d.action);
    d.goalInfluence = Math.round(influence * 100) / 100;
    d.score = Math.max(0, Math.round((d.score || d.priority || 0) + influence));
    d.priority = d.score;
    d.reason = `${d.reason || 'Selected action'} | long-term goal: ${g.label}`;
    n.decisionReason = d.reason;
    n.decisionPriority = d.priority;
    n.ai.goalScore = g.score || 0;
    n.ai.stakes = g.stakes || [];
  }

  function wrapDecisionEngine() {
    const api = window.NPC_DECISIONS;
    if (!api || api.__phase1DecisionWrapped) return;
    const original = api.choose;
    if (typeof original !== 'function') return;
    api.choose = function(n) {
      ensure(n);
      const result = original(n);
      applyGoalInfluence(n);
      return result;
    };
    api.__phase1DecisionWrapped = true;
  }

  function syncCareer(n) {
    if (!n?.alive || n.age < 18) return;
    const role = n.roleId || 'citizen';
    const previous = careerSeen.get(n.id);
    careerSeen.set(n.id, role);
    if (previous === undefined || previous === role || !n.longTermGoal) return;
    n.aiCareerReason = `Career change supports ${n.longTermGoal.label}`;
    n.career = n.career || {};
    n.career.goalId = n.longTermGoal.id;
    n.career.goalScore = n.longTermGoal.score || 0;
    n.career.goalHistory = n.career.goalHistory || [];
    n.career.goalHistory.unshift({tick:state.tick,role,goalId:n.longTermGoal.id});
    n.career.goalHistory = n.career.goalHistory.slice(0,6);
    window.NPC_MEMORY?.remember?.(n, `${n.lastAction || `Became a ${n.roleName || role}`}. My career now supports ${n.longTermGoal.label.toLowerCase()}.`, 'career', 2, null, 'pride');
  }

  function syncAction(n) {
    if (!n?.alive || !n.aiDecision?.action) return;
    const action = n.aiDecision.action;
    const key = `${n.lastDecisionAt || state.tick}:${action}`;
    if (actionSeen.get(n.id) === key) return;
    actionSeen.set(n.id, key);
    const goalId = n.longTermGoal?.id;
    if (!goalId) return;
    const actionSucceeded = !!n.lastAction && !/^Failed/i.test(n.lastAction);
    goals()?.recordOutcome?.(n, actionSucceeded, actionSucceeded ? `Completed ${action}` : `Attempted ${action}`);
    if (actionSucceeded) {
      const growthMap = {work:'work',wealth:'work',train:'combat',study:'study',explore:'explore',socialize:'social',confront:'leadership',govern:'leadership'};
      const growth = growthMap[action];
      if (growth) personality()?.develop?.(n, growth, .15);
    }
  }

  function step() {
    if (!state.running) return;
    wrapDecisionEngine();
    const people = state.npcs || [];
    people.forEach(n => {
      if (!n.alive) return;
      ensure(n);
      syncCareer(n);
      syncAction(n);
    });
    const selected = people.find(n => n.id === state.selected && n.alive);
    if (selected) {
      selected.ai.goal = selected.longTermGoal?.label || 'No long-term goal';
      selected.ai.goalCategory = selected.longTermGoal?.category || null;
    }
  }

  window.PHASE1_AI = { ensure, goalScore, applyGoalInfluence, step };
  if (state.registerSystem) state.registerSystem({name:'phase1-ai-integration',step,priority:85});
})();
