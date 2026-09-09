// Decision consequences: turns important actions into persistent memory and feedback signals.
(() => {
  const state = window.SIM_STATE;
  if (!state) return;

  const memory = () => window.NPC_MEMORY;
  const trace = () => window.NPC_DECISION_TRACE;
  const relationships = () => window.NPC_RELATIONSHIPS;
  const goals = () => window.NPC_GOALS;
  const clamp = (v,a=0,b=100) => Math.max(a,Math.min(b,Number(v)||0));
  const alive = () => (state.npcs || []).filter(n => n.alive);

  function remember(n, text, kind='consequence', importance=2, targetId=null, emotion='pride') {
    memory()?.experience?.(n,text,kind,importance,targetId,emotion,0,false);
  }

  function actionSucceeded(n, action) {
    return !!action && (n.actionHistory || []).some(x => x.tick === state.tick && x.action === action);
  }

  function applyRelationshipConsequence(n) {
    if (!n.aiDecision?.targetId) return;
    const target = (state.npcs || []).find(x => x.id === n.aiDecision.targetId && x.alive);
    if (!target) return;
    const action = n.aiDecision.action;
    if (action === 'socialize') {
      relationships()?.interact?.(n,target,'help',0.8);
      n.mood = clamp((n.mood || 65) + 1);
    } else if (action === 'trade' || action === 'wealth') {
      relationships()?.interact?.(n,target,'trade',0.4);
    } else if (action === 'confront') {
      relationships()?.interact?.(n,target,'insult',1.2);
    }
  }

  function consequence(n) {
    if (!n.lastAction || (n._lastConsequenceTick === state.tick && n._lastConsequenceAction === n.lastAction)) return;
    const action = n.aiDecision?.action;
    const text = n.lastAction;
    const success = actionSucceeded(n, action);

    // Close the Phase 1 causal loop: decision -> action -> outcome -> goal feedback.
    // This lets future goal selection use actual successes/failures instead of only
    // personality and current needs.
    if (action) {
      goals()?.recordOutcome?.(n, success, text);
    }

    if (action === 'eat') {
      remember(n, 'Eating restored my immediate need for food.', 'need', 2, null, 'relief');
    } else if (action === 'drink') {
      remember(n, 'Finding water relieved my thirst.', 'need', 2, null, 'relief');
    } else if (action === 'rest') {
      remember(n, 'Rest helped restore my energy.', 'need', 1.5, null, 'relief');
    } else if (action === 'socialize') {
      remember(n, text, 'relationship', success ? 2 : 2.4, n.aiDecision?.targetId || null, success ? 'joy' : 'sadness');
      if (success) applyRelationshipConsequence(n);
    } else if (action === 'belong') {
      remember(n, 'I spent time with family and strengthened my sense of belonging.', 'family', 2.5, n.spouseId || null, 'joy');
    } else if (action === 'work') {
      remember(n, text, 'career', success ? 1.5 : 2, null, success ? 'pride' : 'frustration');
      if (success) n.reputation = clamp((n.reputation || 50) + .15);
    } else if (action === 'wealth' || action === 'trade') {
      remember(n, text, 'economy', 2, n.aiDecision?.targetId || null, success ? 'pride' : 'frustration');
    } else if (action === 'safety') {
      remember(n, text, 'safety', 2, null, 'relief');
    } else if (action === 'explore') {
      remember(n, text, 'exploration', 2, null, success ? 'curiosity' : 'fear');
    } else if (action === 'govern') {
      remember(n, text, 'politics', 2.5, null, success ? 'pride' : 'frustration');
      if (success) n.influence = clamp((n.influence || 0) + .05, 0, 50);
    } else if (action === 'train') {
      remember(n, text, 'training', 1.5, null, success ? 'pride' : 'frustration');
    } else if (action === 'study') {
      remember(n, text, 'education', 1.5, null, success ? 'pride' : 'frustration');
    } else if (action === 'confront') {
      remember(n, text, 'conflict', 2.5, n.aiDecision?.targetId || null, success ? 'anger' : 'fear');
      if (success) applyRelationshipConsequence(n);
    }

    trace()?.record?.(n, `${success ? 'Action completed' : 'Action failed'}: ${text}`, 'consequence', action || text, success ? .7 : 1.0);
    n.consequence = {tick:state.tick, action:action || text, text, success};
    n._lastConsequenceTick = state.tick;
    n._lastConsequenceAction = text;
  }

  function step() {
    if (!state.running) return;
    alive().forEach(consequence);
  }

  window.NPC_CONSEQUENCES = {consequence, step};
  if (state.registerSystem) state.registerSystem({name:'consequences',step,priority:110});
})();
