(() => {
  const TRAITS = {
    brave:      { courage: 25, risk: 12, aggression: 8, sociability: 0, ambition: 4, discipline: 2, curiosity: 0, kindness: 0, loyalty: 2 },
    curious:    { courage: 0, risk: 5, aggression: -2, sociability: 2, ambition: 2, discipline: 0, curiosity: 25, kindness: 1, loyalty: 0 },
    ambitious:  { courage: 3, risk: 6, aggression: 2, sociability: 0, ambition: 25, discipline: 6, curiosity: 3, kindness: -1, loyalty: 0 },
    kind:       { courage: 0, risk: -2, aggression: -10, sociability: 8, ambition: -1, discipline: 2, curiosity: 1, kindness: 25, loyalty: 5 },
    greedy:     { courage: 0, risk: 7, aggression: 3, sociability: -1, ambition: 10, discipline: 1, curiosity: 0, kindness: -8, loyalty: -4 },
    loyal:      { courage: 2, risk: -1, aggression: 0, sociability: 5, ambition: 1, discipline: 7, curiosity: 0, kindness: 4, loyalty: 25 },
    stubborn:   { courage: 5, risk: 3, aggression: 4, sociability: -4, ambition: 7, discipline: 6, curiosity: -6, kindness: -2, loyalty: 5 },
    clever:     { courage: 0, risk: 2, aggression: 0, sociability: 2, ambition: 7, discipline: 5, curiosity: 12, kindness: 0, loyalty: 1 },
    reckless:   { courage: 10, risk: 25, aggression: 10, sociability: 0, ambition: 4, discipline: -10, curiosity: 6, kindness: -2, loyalty: -2 },
    calm:       { courage: 2, risk: -8, aggression: -10, sociability: 4, ambition: 0, discipline: 8, curiosity: 2, kindness: 4, loyalty: 3 },
    social:     { courage: 0, risk: 0, aggression: -3, sociability: 25, ambition: 1, discipline: 0, curiosity: 4, kindness: 6, loyalty: 4 },
    hardworking:{ courage: 0, risk: 0, aggression: 0, sociability: -2, ambition: 7, discipline: 25, curiosity: 1, kindness: 2, loyalty: 3 }
  };

  const clamp = (v) => Math.max(0, Math.min(100, Math.round(v)));
  const hash = (id) => { let h = 2166136261; for (const c of String(id)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };

  function ensure(n) {
    if (!n.personality) {
      const base = 35 + (hash(n.id) % 31);
      const primary = n.trait || 'calm';
      const secondary = Object.keys(TRAITS)[hash(String(n.id) + ':secondary') % Object.keys(TRAITS).length];
      n.personality = {
        traits: [primary, secondary === primary ? 'clever' : secondary],
        courage: base,
        risk: base,
        aggression: base,
        sociability: base,
        ambition: n.ambition ?? base,
        discipline: base,
        curiosity: base,
        kindness: base,
        loyalty: n.loyalty ?? base
      };
      applyTraits(n);
    }
    return n.personality;
  }

  function applyTraits(n) {
    const p = n.personality;
    const traits = p.traits || [];
    const keys = ['courage','risk','aggression','sociability','ambition','discipline','curiosity','kindness','loyalty'];
    const values = Object.fromEntries(keys.map(k => [k, p[k] ?? 50]));
    traits.forEach(t => {
      const mod = TRAITS[t];
      if (!mod) return;
      keys.forEach(k => values[k] += mod[k] || 0);
    });
    keys.forEach(k => p[k] = clamp(values[k]));
    n.ambition = p.ambition;
    n.loyalty = p.loyalty;
    return p;
  }

  function addTrait(n, trait) {
    const p = ensure(n);
    p.traits = p.traits || [];
    if (!p.traits.includes(trait) && TRAITS[trait]) p.traits.push(trait);
    applyTraits(n);
    return p;
  }

  function has(n, trait) { return ensure(n).traits.includes(trait); }
  function score(n, key) { return ensure(n)[key] ?? 50; }

  window.NPC_PERSONALITY = { TRAITS, ensure, applyTraits, addTrait, has, score };
})();
