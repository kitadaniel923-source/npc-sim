// Decision consequences: turns important actions into persistent memory and feedback signals.
(() => {
  const state = window.SIM_STATE;
  if (!state) return;

  const memory = () => window.NPC_MEMORY;
  const trace = () => window.NPC_DECISION_TRACE;
  const relationships = () => window.NPC_RELATIONSHIPS;
  const clamp = (v,a=0,b=100) => Math.max(a,Math.min(b,Number(v)||0));
  const alive = () => (state.npcs || []).filter(n => n.alive);

  function remember(n, text, kind='consequence', importance=2, targetId=null, emotion='pride') {
    memory()?.experience?.(n,text,kind,importance,targetId,emotion,0,false);
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
    }
  }

  function consequence(n) {
    if (!n.lastAction || n.lastAction === n._lastConsequenceAction) return;
    const action = n.aiDecision?.action;
    const text = n.lastAction;
    n._lastConsequenceAction = text;

    if (action === 'eat') {
      remember(n, 'Eating restored my immediate need for food.', 'need', 2, null, 'relief');
    } else if (action === 'drink') {
      remember(n, 'Finding water relieved my thirst.', 'need', 2, null, 'relief');
    } else if (action === 'rest') {
      remember(n, 'Rest helped restore my energy.', 'need', 1.5, null, 'relief');
    } else if (action === 'socialize') {
      remember(n, text, 'relationship', 2, n.aiDecision?.targetId || null, 'joy');
      applyRelationshipConsequence(n);
    } else if (action === 'belong') {
      remember(n, 'I spent time with family and strengthened my sense of belonging.', 'family', 2.5, n.spouseId || null, 'joy');
    } else if (action === 'work') {
      remember(n, text, 'career', 1.5, null, 'pride');
      n.reputation = clamp((n.reputation || 50) + .15);
    } else if (action === 'wealth' || action === 'trade') {
      remember(n, text, 'economy', 2, n.aiDecision?.targetId || null, 'pride');
    } else if (action === 'safety') {
      remember(n, text, 'safety', 2, null, 'relief');
    } else if (action === 'explore') {
      remember(n, text, 'exploration', 2, null, 'curiosity');
    } else if (action === 'govern') {
      remember(n, text, 'politics', 2.5, null, 'pride');
      n.influence = clamp((n.influence || 0) + .05, 0, 50);
    } else if (action === 'train') {
      remember(n, text, 'training', 1.5, null, 'pride');
    } else if (action === 'study') {
      remember(n, text, 'education', 1.5, null, 'pride');
    }

    trace()?.record?.(n, `Action completed: ${text}`, 'consequence', action || text, .7);
    n.consequence = {tick:state.tick, action:action || text, text};
  }

  function step() {
    if (!state.running) return;
    alive().forEach(consequence);
  }

  window.NPC_CONSEQUENCES = {consequence, step};
  if (state.registerSystem) state.registerSystem({name:'consequences',step,priority:110});
})();
