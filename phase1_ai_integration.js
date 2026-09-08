// Phase 1 AI integration seam.
// Connects personality, careers, needs, goals, decisions, behavior, relationships and memory
// without replacing the existing specialist systems.
(() => {
  const state = window.SIM_STATE;
  if (!state) return;

  const clamp = (v,a=0,b=100) => Math.max(a,Math.min(b,v));
  const goals = () => window.NPC_GOALS;
  const personality = () => window.NPC_PERSONALITY;

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
    if (!api || api.__phase1Wrapped) return;
    const original = api.choose;
    if (typeof original !== 'function') return;
    api.choose = function(n) {
      ensure(n);
      const result = original(n);
      applyGoalInfluence(n);
      return result;
    };
    api.__phase1Wrapped = true;
  }

  function wrapCareerSystem() {
    const api = window.NPC_CAREERS;
    if (!api || api.__phase1Wrapped) return;
    const original = api.chooseCareer;
    if (typeof original !== 'function') return;
    api.chooseCareer = function(n) {
      ensure(n);
      const before = n.roleId;
      const result = original(n);
      if (n.roleId !== before && n.longTermGoal) {
        n.aiCareerReason = `Career selected to support ${n.longTermGoal.label}`;
        n.career = n.career || {};
        n.career.goalId = n.longTermGoal.id;
        n.career.goalScore = n.longTermGoal.score;
        window.NPC_MEMORY?.remember?.(n, `${n.lastAction}. This career supports my goal to ${n.longTermGoal.label.toLowerCase()}.`, 'career', 2, null, 'pride');
      }
      return result;
    };
    api.__phase1Wrapped = true;
  }

  function wrapBehavior() {
    const api = window.NPC_BEHAVIOR;
    if (!api || api.__phase1Wrapped) return;
    const original = api.action;
    if (typeof original !== 'function') return;
    api.action = function(n) {
      const before = n?.lastAction;
      const goalId = n?.longTermGoal?.id;
      const action = n?.aiDecision?.action;
      const result = original(n);
      if (n && action) {
        const changed = n.lastAction !== before;
        const success = changed || ['eat','drink','rest','socialize','belong','work','wealth','trade','safety','explore','govern','train','study'].includes(action);
        if (goalId && goals()?.recordOutcome) {
          goals().recordOutcome(n, !!success, success ? `Completed ${action}` : `Failed ${action}`);
        }
        if (success && changed) {
          personality()?.develop?.(n, action === 'confront' ? 'leadership' : action, .25);
        }
      }
      return result;
    };
    api.__phase1Wrapped = true;
  }

  function step() {
    if (!state.running) return;
    wrapDecisionEngine();
    wrapCareerSystem();
    wrapBehavior();
    const selected = state.npcs?.find(n => n.id === state.selected && n.alive);
    if (selected) {
      ensure(selected);
      selected.ai.goal = selected.longTermGoal?.label || 'No long-term goal';
      selected.ai.goalCategory = selected.longTermGoal?.category || null;
    }
  }

  window.PHASE1_AI = { ensure, goalScore, applyGoalInfluence, step };
  if (state.registerSystem) state.registerSystem({name:'phase1-ai-integration',step,priority:85});
})();
