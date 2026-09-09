(() => {
  const state = window.SIM_STATE;
  if (!state) return;

  const personalityApi = window.NPC_PERSONALITY;
  const planner = window.NPC_PLANNING;
  const memory = window.NPC_MEMORY;
  const trace = window.NPC_DECISION_TRACE;
  const learning = window.NPC_LEARNING;
  const role = (n, r) => n.roleId === r;

  const personality = n => {
    personalityApi?.ensure?.(n);
    const keys = ['courage','aggression','sociability','risk','ambition','discipline','curiosity','kindness','loyalty','cleverness'];
    return Object.fromEntries(keys.map(k => [k, personalityApi?.score?.(n, k) ?? 50]));
  };

  function memoryState(n) {
    memory?.ensure?.(n);
    const ids = new Set([
      ...(n.relations || []).map(r => r.targetId),
      ...Object.keys(n.grudgeMap || {}),
      ...Object.keys(n.fearMap || {})
    ]);
    let trust = 0, fear = 0, grudge = 0, count = 0, bestGrudgeId = null, bestGrudge = -1;
    ids.forEach(id => {
      const t = Number(n.trustMap?.[id] || 0);
      const f = Number(n.fearMap?.[id] || 0);
      const g = Number(n.grudgeMap?.[id] || 0);
      trust += t;
      fear += f;
      grudge += g;
      count++;
      if (g > bestGrudge) {
        bestGrudge = g;
        bestGrudgeId = id;
      }
    });
    return {
      avgTrust: count ? trust / count : 0,
      avgFear: count ? fear / count : 0,
      avgGrudge: count ? grudge / count : 0,
      bestGrudgeId,
      bestGrudge
    };
  }

  function cultureState(n) {
    const c = n.culture || {};
    return {
      id: c.id || 'tradition',
      name: c.name || c.id || 'tradition',
      strength: Number(c.strength ?? 45),
      belief: c.belief || 'Ancestor Keepers'
    };
  }

  function familyState(n) {
    const f = state.families?.find(x => x.id === n.familyId);
    const kin = n.familyId
      ? state.npcs.filter(x => x.alive && x.familyId === n.familyId && x.id !== n.id).length
      : 0;
    return {
      family: f,
      familyPower: f ? Number(f.wealth || 0) * 0.05 + Number(f.influence || 0) * 1.2 + Number(f.prestige || 0) * 0.35 : 0,
      kin
    };
  }

  function urgentDecision(n, p, q) {
    const danger = state.war && n.settlementId && q.safety >= 55;
    if (n.roleId === 'prisoner' && n.term > 0) return { action:'safety', goal:'Survive imprisonment', priority:100, reason:'Prison sentence requires survival' };
    if ((n.health ?? 100) < 25) return { action:'safety', goal:'Protect health', priority:100, reason:'Health is critically low' };
    if (q.hunger >= 88) return { action:'eat', goal:'Find food now', priority:99, reason:`Hunger emergency (${Math.round(q.hunger)})` };
    if (q.thirst >= 88) return { action:'drink', goal:'Find water now', priority:99, reason:`Thirst emergency (${Math.round(q.thirst)})` };
    if (q.rest >= 90) return { action:'rest', goal:'Recover energy', priority:96, reason:`Severe fatigue (${Math.round(q.rest)})` };
    if (danger) return { action:'safety', goal:'Escape danger', priority:94, reason:'War has made the current area unsafe' };
    if (q.safety >= 82) return { action:'safety', goal:'Seek safety', priority:92, reason:`Safety pressure (${Math.round(q.safety)})` };
    return null;
  }

  function careerFit(n) {
    const c = n.roleId || 'citizen';
    const p = personality(n);
    const fit = {
      farmer: p.kindness * 0.08 + p.discipline * 0.2,
      hunter: p.courage * 0.15 + p.risk * 0.15,
      blacksmith: p.discipline * 0.18 + p.cleverness * 0.05,
      merchant: p.sociability * 0.15 + p.ambition * 0.2,
      scholar: p.curiosity * 0.22 + p.discipline * 0.15,
      soldier: p.courage * 0.2 + p.discipline * 0.15,
      healer: p.kindness * 0.2,
      teacher: p.kindness * 0.12 + p.curiosity * 0.18,
      builder: p.discipline * 0.2 + p.cleverness * 0.12
    };
    return fit[c] ?? p.discipline * 0.08;
  }

  function reasons(n, action, q, p, m, c, f, scoreValue) {
    const why = [];
    const add = (label, value, threshold = 5) => {
      if (Number(value) > threshold) why.push({ label, value:Number(value) });
    };
    if (action === 'eat') add('hunger pressure', q.hunger * 1.8, 12);
    if (action === 'drink') add('thirst pressure', q.thirst * 1.5, 12);
    if (action === 'rest') add('fatigue', q.rest * 1.2, 12);
    if (action === 'socialize') {
      add('sociability', p.sociability * 0.5);
      add('trusted relationships', m.avgTrust * 0.25);
      add('family ties', f.kin * 0.8);
    }
    if (action === 'belong') {
      add('belonging need', q.belonging + (f.kin ? 10 : 0));
      add('family legacy', f.familyPower * 0.15);
    }
    if (action === 'work') {
      add('purpose need', q.purpose);
      add('discipline', p.discipline * 0.3);
      add('career fit', careerFit(n));
    }
    if (action === 'wealth') {
      add('wealth pressure', q.wealth);
      add('ambition', p.ambition * 0.35);
      add('prosperity culture', c.id === 'prosperity' ? c.strength * 0.3 : 0);
    }
    if (action === 'safety') {
      add('safety pressure', q.safety + (state.war ? 25 : 0));
      add('remembered danger', m.avgFear * 0.55);
      add('cautious personality', (100 - p.risk) * 0.05);
    }
    if (action === 'explore') {
      add('curiosity', p.curiosity * 0.45);
      add('risk appetite', p.risk * 0.15);
      add('discovery culture', c.id === 'curiosity' ? c.strength * 0.35 : 0);
      add('low remembered fear', Math.max(0, 12 - m.avgFear));
    }
    if (action === 'govern') add('political role', (role(n,'mayor') || role(n,'king') || role(n,'duke') || role(n,'count') || role(n,'heir')) ? 55 + p.ambition : 0);
    if (action === 'train') {
      add('war pressure', state.war && n.age >= 16 ? 55 + p.aggression * 0.4 : 0);
      add('combat temperament', p.courage * 0.15);
      add('honor culture', c.id === 'honor' || c.id === 'strength' ? c.strength * 0.3 : 0);
      add('old grudges', m.avgGrudge * 0.35);
    }
    if (action === 'study') {
      add('curiosity', p.curiosity * 0.5);
      add('education culture', c.id === 'curiosity' ? c.strength * 0.4 : 0);
      add('education gap', Math.max(0, 45 - (n.education || 0)));
    }
    if (action === 'confront') {
      add('remembered grievance', m.bestGrudge * 0.9, 20);
      add('aggression', p.aggression * 0.3);
      add('courage', p.courage * 0.2);
    }
    if (scoreValue > 0) add('current utility', scoreValue, 18);
    const learned = learning?.actionModifier?.(n, action) || 0;
    if (Math.abs(learned) > 1) add('learned experience', learned, 1);
    why.sort((a,b) => b.value - a.value);
    return why.slice(0, 4);
  }

  function writeDecision(n, d, source = 'interrupt') {
    n.aiDecision = {
      action:d.action, score:d.priority, at:state.tick, priority:d.priority,
      reason:d.reason, decisionReason:d.reason, targetId:d.targetId || null, interrupted:true
    };
    n.goal = d.goal;
    n.decisionReason = d.reason;
    n.decisionSource = source;
    n.decisionPriority = d.priority;
    n.decisionInterrupt = { active:true, reason:d.reason, startedAt:state.tick, until:state.tick + 2 };
    trace?.record?.(n, d.reason, source, d.action, d.priority);
  }

  function choose(n) {
    if (!n?.alive || n.age < 13) return;
    const p = personality(n);
    const q = n.needPressure || {};
    const m = memoryState(n);
    const c = cultureState(n);
    const f = familyState(n);
    const emergency = urgentDecision(n, p, q);
    if (emergency) {
      writeDecision(n, emergency);
      return;
    }
    if (n.decisionInterrupt?.active) {
      if (state.tick <= n.decisionInterrupt.until) return;
      n.decisionInterrupt.active = false;
    }

    if (planner) {
      const plan = n.currentPlan || planner.plan?.(n);
      const step = planner.nextStep?.(n);
      if (plan && step) {
        const planPriority = Math.max(20, Number(plan.score) || 20);
        if (m.bestGrudge >= 65 && p.aggression > 45 && p.courage > 35 && m.bestGrudgeId != null) {
          writeDecision(n, {
            action:'confront', goal:'Confront an enemy', priority:planPriority + 15,
            targetId:m.bestGrudgeId, reason:'A strong remembered grudge overrides the current plan'
          }, 'memory-interrupt');
          return;
        }
        const cultureBonus =
          (c.id === 'tradition' && step.action === 'belong' ? c.strength * 0.16 : 0) +
          (c.id === 'prosperity' && step.action === 'wealth' ? c.strength * 0.18 : 0) +
          (c.id === 'honor' && step.action === 'train' ? c.strength * 0.2 : 0) +
          (c.id === 'curiosity' && ['explore','study'].includes(step.action) ? c.strength * 0.2 : 0);
        const familyBonus =
          (step.action === 'belong' ? f.kin * 1.3 : 0) +
          (step.action === 'govern' ? f.familyPower * 0.08 : 0);
        const learnedBonus = learning?.actionModifier?.(n, step.action) || 0;
        const priority = planPriority + cultureBonus + familyBonus + learnedBonus;
        n.aiDecision = {
          action:step.action, score:priority, at:state.tick, planId:plan.id,
          targetId:step.targetId || null, priority, interrupted:false
        };
        n.goal = plan.goal;
        n.decisionReason = `${plan.reason || `Plan selected: ${plan.goal}`} | culture ${c.name}, family power ${Math.round(f.familyPower)}`;
        n.decisionSource = 'planning';
        n.decisionPriority = priority;
        n.decisionWeights = { plan:planPriority, culture:cultureBonus, family:familyBonus, learning:learnedBonus, memory:m };
        trace?.record?.(n, n.decisionReason, 'planning', step.action, priority);
        return;
      }
    }

    const options = [
      ['eat','Find food',q.hunger * 1.8 + (n.roleId === 'farmer' ? 8 : 0)],
      ['drink','Find water',q.thirst * 1.5],
      ['rest','Rest and recover',q.rest * 1.2],
      ['socialize','Spend time with others',q.social + p.sociability * 0.5 + m.avgTrust * 0.25 + f.kin * 0.6 - m.avgGrudge * 0.18],
      ['belong','Visit family',q.belonging + (n.familyId ? 12 : 0) + f.kin * 1.2 + f.familyPower * 0.04],
      ['work','Work as ' + (n.roleName || 'Citizen'),q.purpose + p.discipline * 0.35 + careerFit(n)],
      ['wealth','Earn wealth',q.wealth + p.ambition * 0.35 + (c.id === 'prosperity' ? c.strength * 0.28 : 0)],
      ['safety','Seek safety',q.safety + (state.war ? 25 : 0) + (100 - p.risk) * 0.06 + m.avgFear * 0.55],
      ['explore','Explore',18 + p.curiosity * 0.45 + p.risk * 0.15 - m.avgFear * 0.35 + (c.id === 'curiosity' ? c.strength * 0.3 : 0)],
      ['govern','Govern',(role(n,'mayor') || role(n,'king') || role(n,'duke') || role(n,'count') || role(n,'heir')) ? 65 + p.ambition + f.familyPower * 0.05 : 0],
      ['train','Train for combat',state.war && n.age >= 16 ? 55 + p.aggression * 0.4 + m.avgGrudge * 0.25 : (c.id === 'honor' || c.id === 'strength' ? 18 + c.strength * 0.2 + p.courage * 0.15 : 0)],
      ['study','Study',p.curiosity * 0.5 + (n.education || 0) * 0.1 + (c.id === 'curiosity' ? c.strength * 0.2 : 0)],
      ['confront','Confront an enemy',m.bestGrudge >= 45 ? p.aggression * 0.45 + p.courage * 0.3 + m.bestGrudge * 0.85 : 0]
    ];

    const viable = options.filter(x => x[2] > 0);
    viable.forEach(x => { x[2] += learning?.actionModifier?.(n, x[0]) || 0; });
    viable.forEach(x => { x[2] *= 0.9 + Math.random() * 0.2; });
    viable.sort((a,b) => b[2] - a[2]);
    const picked = viable[0];
    if (!picked) return;
    const why = reasons(n, picked[0], q, p, m, c, f, picked[2]);
    const targetId = picked[0] === 'confront' ? m.bestGrudgeId : null;
    const priority = Math.max(20, Math.round(picked[2]));
    n.aiDecision = {
      action:picked[0], score:priority, at:state.tick, priority,
      influences:why, targetId, interrupted:false
    };
    n.goal = picked[1];
    n.decisionReason = why.map(x => `${x.label} ${Math.round(x.value)}`).join(', ') || `${picked[0]} has the highest utility`;
    n.decisionSource = picked[0] === 'confront' ? 'memory' : 'decision-engine';
    n.decisionPriority = priority;
    n.decisionWeights = {
      utility:priority, influences:why, memory:m, culture:c, family:f,
      learning:learning?.actionModifier?.(n, picked[0]) || 0
    };
    trace?.record?.(n, n.decisionReason, n.decisionSource, picked[0], picked[2]);
  }

  window.NPC_DECISIONS = { choose, personality, urgentDecision, memoryState };
  if (state.registerSystem) state.registerSystem({ name:'decision-engine', step:() => {}, priority:55 });
})();
