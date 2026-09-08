// Adaptive learning layer for Phase 1 AI.
// Converts experience into persistent skill, preference, trust and risk adaptation.
(() => {
  const state = window.SIM_STATE;
  if (!state) return;

  const personality = () => window.NPC_PERSONALITY;
  const memory = () => window.NPC_MEMORY;
  const clamp = (v,a=0,b=100) => Math.max(a,Math.min(b,v));
  const alive = () => (state.npcs || []).filter(n => n.alive);

  const ACTIONS = {
    work:'work', wealth:'work', train:'combat', study:'study', explore:'explore',
    socialize:'social', belong:'social', govern:'leadership', confront:'leadership',
    safety:'safety', eat:'survival', drink:'survival', rest:'survival'
  };

  function ensure(n) {
    n.learning = n.learning || {
      attempts:{}, successes:{}, failures:{}, expertise:{}, preferences:{},
      lastLesson:null, adaptation:0
    };
    n.learning.attempts ||= {};
    n.learning.successes ||= {};
    n.learning.failures ||= {};
    n.learning.expertise ||= {};
    n.learning.preferences ||= {};
    return n.learning;
  }

  function learn(n, action, success=true, intensity=1, reason='') {
    if (!n?.alive || !action) return null;
    const l = ensure(n);
    const a = String(action);
    l.attempts[a] = (l.attempts[a] || 0) + 1;
    if (success) l.successes[a] = (l.successes[a] || 0) + 1;
    else l.failures[a] = (l.failures[a] || 0) + 1;

    const attempts = l.attempts[a];
    const successRate = (l.successes[a] || 0) / Math.max(1, attempts);
    const lesson = Math.min(5, intensity * (success ? 1 : .8));
    l.expertise[a] = clamp((l.expertise[a] || 0) + lesson, 0, 100);
    l.preferences[a] = clamp((l.preferences[a] || 50) + (success ? lesson*.75 : -lesson*.9), 0, 100);
    l.adaptation = clamp((l.adaptation || 0) + lesson*.18, 0, 100);
    l.lastLesson = {tick:state.tick,action:a,success,reason,successRate};

    const growth = ACTIONS[a];
    if (growth && personality()?.develop) personality().develop(n, growth, Math.min(1.5, lesson*.22));

    if (!success && memory()?.remember && attempts >= 2) {
      const text = reason || `My attempt to ${a} failed.`;
      memory().remember(n, `${text} I should adapt next time.`, 'learning', Math.min(3.5, 1+attempts*.12), null, 'fear');
    }
    return l.lastLesson;
  }

  function actionModifier(n, action) {
    const l = ensure(n);
    const expertise = l.expertise[action] || 0;
    const preference = l.preferences[action] ?? 50;
    const failures = l.failures[action] || 0;
    const successes = l.successes[action] || 0;
    return (expertise*.11) + ((preference-50)*.16) - Math.min(10, failures*.16) + Math.min(6, successes*.08);
  }

  function goalPressure(n) {
    const g = n.longTermGoal;
    if (!g) return 0;
    const l = ensure(n);
    const category = g.category;
    const action = category==='family'?'belong':category==='wealth'?'wealth':category==='knowledge'?'study':category==='honor'?'train':category==='exploration'?'explore':category==='social'?'socialize':category==='conflict'?'confront':category==='realm'?'train':category==='status'?'govern':'safety';
    return actionModifier(n, action);
  }

  function adaptFromMemory(n) {
    if (!n?.alive) return;
    const memories = (n.memories || []).filter(m => (m.importance || 0) >= 2.5).slice(0, 12);
    memories.forEach(m => {
      const text = String(m.text || '').toLowerCase();
      if (m.type === 'war' || m.type === 'disaster' || text.includes('danger')) {
        n.learning.riskTolerance = clamp((n.learning.riskTolerance ?? 50) - .04, 0, 100);
      }
      if (m.type === 'relationship' && m.emotion === 'trust') {
        n.learning.socialConfidence = clamp((n.learning.socialConfidence ?? 50) + .025, 0, 100);
      }
      if (m.type === 'betrayal' || m.emotion === 'anger') {
        n.learning.trustCaution = clamp((n.learning.trustCaution ?? 50) + .035, 0, 100);
      }
    });
  }

  function step() {
    if (!state.running) return;
    const budget = window.SIM_BUDGET;
    const people = budget?.npcBatch ? budget.npcBatch() : alive();
    people.forEach(n => {
      ensure(n);
      adaptFromMemory(n);
      const d = n.aiDecision;
      if (d?.action && n.lastAction && n.lastDecisionAt === state.tick) {
        const failed = /^Failed|could not|unable/i.test(String(n.lastAction));
        learn(n, d.action, !failed, failed ? 1.1 : .8, n.lastAction);
      }
      if (n.career?.roleId) {
        const role = n.career.roleId;
        n.learning.expertise[role] = clamp((n.learning.expertise[role] || 0) + .025, 0, 100);
      }
    });
  }

  window.NPC_LEARNING = {ensure,learn,actionModifier,goalPressure,adaptFromMemory,step};
  if (state.registerSystem) state.registerSystem({name:'npc-learning',step,priority:82});
})();
