(() => {
  const state = window.SIM_STATE;
  if (!state) return;

  const clamp = (v,a=0,b=100) => Math.max(a, Math.min(b, v));
  const alive = () => (state.npcs || []).filter(n => n.alive);
  const personality = window.NPC_PERSONALITY;
  const memory = window.NPC_MEMORY;
  const familySystem = window.FAMILY_SYSTEM;
  const life = window.EVERGLEN_LIFE_ENGINE;

  function log(text) {
    if (typeof window.SIM_LOG === 'function') window.SIM_LOG(text);
    else if (state.feed) state.feed.unshift(`Year ${state.year}, Day ${state.day}: ${text}`);
  }

  function ensure(n) {
    n.age = Number.isFinite(n.age) ? n.age : 18;
    n.maxAge = n.maxAge || (72 + ((n.id * 37) % 31));
    n.birthYear = n.birthYear || Math.max(1, state.year - Math.floor(n.age));
    n.generation = n.generation || (n.parentIds?.length ? 2 : 1);
    n.childrenIds = Array.isArray(n.childrenIds) ? n.childrenIds : [];
    n.parentIds = Array.isArray(n.parentIds) ? n.parentIds : [];
    n.spouseId = n.spouseId || n.partnerId || null;
    n.partnerId = n.partnerId || n.spouseId || null;
    n.mortality = n.mortality ?? 0;
    return n;
  }

  function ageOneYear(n) {
    ensure(n);
    const before = Math.floor(n.age);
    n.age += 1;
    n.ageStage = n.age < 5 ? 'infant' : n.age < 13 ? 'child' : n.age < 18 ? 'adolescent' : n.age < 40 ? 'adult' : n.age < 60 ? 'mature' : n.age < 75 ? 'elder' : 'aged';
    if (before < 13 && n.age >= 13) {
      n.lastAction = 'Entered adolescence';
      memory?.remember(n, 'I came of age.', 'life', 2, null, 'pride');
    }
    if (before < 18 && n.age >= 18) {
      n.lastAction = 'Reached adulthood';
      memory?.remember(n, 'I became an adult.', 'life', 2.2, null, 'pride', true);
    }
    if (n.age >= 60) n.mortality = Math.min(100, n.mortality + 0.8);
    if (n.age >= 75) n.mortality = Math.min(100, n.mortality + 2.2);
    n.needs = n.needs || {};
    n.needs.energy = clamp((n.needs.energy ?? n.energy ?? 80) - (n.age >= 60 ? 0.8 : 0));
  }

  function createChild(a,b) {
    if (!a || !b || !a.alive || !b.alive) return null;
    if (a.id === b.id || a.age < 20 || b.age < 20) return null;
    if (a.age > 42 || b.age > 50) return null;
    const sameFamily = a.familyId && a.familyId === b.familyId;
    if (sameFamily && Math.random() < 0.85) return null;

    const child = window.SIM_API?.createNpc?.(state.npcs.length, a.faction) || {
      id: state.npcs.length + 1, name: `Child ${state.npcs.length + 1}`, alive: true
    };
    child.age = 0;
    child.birthYear = state.year;
    child.generation = Math.max((a.generation || 1), (b.generation || 1)) + 1;
    child.parentIds = [a.id, b.id];
    child.parents = [a.id, b.id];
    child.childrenIds = [];
    child.spouseId = null;
    child.partnerId = null;
    child.settlementId = a.settlementId || b.settlementId || null;
    child.home = a.home || b.home || null;
    child.x = (a.x + b.x) / 2 + (Math.random() * 24 - 12);
    child.y = (a.y + b.y) / 2 + (Math.random() * 24 - 12);
    child.wealth = 0;
    child.education = 0;
    child.reputation = clamp(((a.reputation || 50) + (b.reputation || 50)) / 2 + (Math.random() * 10 - 5));
    child.honor = clamp(((a.honor || 50) + (b.honor || 50)) / 2 + (Math.random() * 10 - 5));
    child.roleId = 'child';
    child.roleName = 'Child';
    child.lastAction = 'Born into the world';
    child.memories = [];

    state.npcs.push(child);
    if (!a.childrenIds.includes(child.id)) a.childrenIds.push(child.id);
    if (!b.childrenIds.includes(child.id)) b.childrenIds.push(child.id);

    if (familySystem?.onBirth) familySystem.onBirth(state, child, [a,b]);
    if (life?.inheritTraits) life.inheritTraits(child, a, b);
    if (personality?.ensure) personality.ensure(child);

    if (memory) {
      memory.experience(a, `${child.name} was born to our family.`, 'family', 3.2, child.id, 'joy', -3, true);
      memory.experience(b, `${child.name} was born to our family.`, 'family', 3.2, child.id, 'joy', -3, true);
      memory.experience(child, `I was born to ${a.name} and ${b.name}.`, 'birth', 4, a.id, 'joy', 0, true);
      memory.experience(child, `I was born to ${a.name} and ${b.name}.`, 'birth', 4, b.id, 'joy', 0, true);
    }
    a.mood = clamp((a.mood || 65) + 5);
    b.mood = clamp((b.mood || 65) + 5);
    a.lastAction = `Welcomed ${child.name}`;
    b.lastAction = `Welcomed ${child.name}`;
    log(`${a.name} and ${b.name} welcomed ${child.name}.`);
    return child;
  }

  function fertilityStep() {
    if (state.tick % 90 !== 0) return;
    const adults = alive().filter(n => n.age >= 20 && n.age <= 42 && (n.spouseId || n.partnerId));
    const seen = new Set();
    adults.forEach(a => {
      const partnerId = a.spouseId || a.partnerId;
      if (!partnerId || seen.has(a.id) || seen.has(partnerId)) return;
      const b = state.npcs.find(x => x.id === partnerId && x.alive);
      if (!b || b.age < 18) return;
      seen.add(a.id); seen.add(b.id);
      const rel = window.NPC_RELATIONSHIPS?.get(a,b,false);
      const trust = window.NPC_RELATIONSHIPS?.trustValue(a,b.id,rel) ?? 50;
      const chance = 0.025 + Math.max(0, trust - 55) * 0.0007 + ((a.needs?.belonging || 0) > 55 ? 0.008 : 0);
      if (Math.random() < chance) createChild(a,b);
    });
  }

  function deathStep() {
    if (state.tick % 60 !== 0) return;
    for (const n of alive()) {
      ensure(n);
      let chance = 0;
      if (n.age >= n.maxAge) chance = 0.08 + (n.age - n.maxAge) * 0.025;
      else if (n.age >= 70) chance = (n.age - 70) * 0.0011;
      if (n.health < 25) chance += 0.004;
      if (state.plague) chance += 0.006;
      if (state.war && n.age >= 16 && ['soldier','knight','captain','general','marshal'].includes(n.roleId)) chance += 0.0025;
      if (Math.random() < chance) die(n, n.age >= n.maxAge ? 'old age' : state.plague ? 'plague' : n.health < 25 ? 'illness' : 'war');
    }
  }

  function die(n, reason) {
    if (!n?.alive) return;
    n.alive = false;
    if (n.partnerId || n.spouseId) {
      const partnerId = n.partnerId || n.spouseId;
      const p = state.npcs.find(x => x.id === partnerId && x.alive);
      if (p) { p.partnerId = null; p.spouseId = null; p.grief = clamp((p.grief || 0) + 18); memory?.experience(p, `${n.name} died.`, 'death', 4.5, n.id, 'grief', 6, true); }
    }
    memory?.experience(n, `I died at age ${Math.floor(n.age)}.`, 'death', 5, null, 'grief', 0, true);
    if (familySystem?.inherit) familySystem.inherit(state, n);
    if (life?.inheritOnDeath) life.inheritOnDeath(n);
    const family = state.families?.find(f => f.id === n.familyId);
    if (family) family.deadMembers = (family.deadMembers || 0) + 1;
    if (state.selected === n.id) state.selected = null;
    log(`${n.name} died at age ${Math.floor(n.age)} (${reason}).`);
  }

  function syncYear() {
    state._lifecycleYear = state._lifecycleYear ?? state.year;
    if (state.year === state._lifecycleYear) return;
    while (state._lifecycleYear < state.year) {
      state._lifecycleYear++;
      alive().forEach(ageOneYear);
    }
  }

  function step() {
    if (!state.running) return;
    alive().forEach(ensure);
    syncYear();
    fertilityStep();
    deathStep();
  }

  window.NPC_LIFECYCLE = { step, ageOneYear, createChild, die };
  if (state.registerSystem) state.registerSystem({name:'lifecycle', step, priority:40});
  step();
})();
