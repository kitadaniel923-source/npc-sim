// Family, clan, dynasty and inheritance system.
// The main simulator calls window.familyTick(state) when this module is loaded.
window.FAMILY_SYSTEM = {
  familyNames: ['Alder','Ashford','Blackwood','Bright','Cedar','Crowe','Dawn','Ember','Frost','Hawthorne','Ironheart','Kingsley','Moon','Oak','Raven','Rivera','Stone','Thorne','Vale','Wren'],
  clanNames: ['Alder Clan','Ashen Clan','Brightwood Clan','Cedar Clan','Crow Clan','Ember Clan','Frost Clan','Iron Clan','Moon Clan','Oak Clan','Raven Clan','Stone Clan','Thorn Clan','Vale Clan'],
  initialize(state) {
    if (state._familiesReady) return;
    state._familiesReady = true;
    state.families = [];
    state.dynasties = [];
    state.clans = [];
    state.npcs.forEach((n, i) => {
      n.familyId = `family-${n.id}`;
      n.familyName = this.familyNames[i % this.familyNames.length];
      n.parents = [];
      n.spouseId = null;
      n.childrenIds = [];
      n.inheritancePreference = 'eldest';
      n.estate = { gold: Math.max(0, n.wealth || 0), land: 0, buildings: 0, titles: [] };
      n.legitimacy = 50 + Math.random() * 45;
      state.families.push({ id: n.familyId, name: n.familyName, founderId: n.id, members: [n.id], wealth: n.wealth || 0, influence: 5, reputation: 50, generation: 1, seat: n.home || null });
    });
    this.rebuildClans(state);
  },
  rebuildClans(state) {
    const byFamily = new Map((state.families || []).map(f => [f.id, f]));
    const clanMap = new Map();
    state.npcs.filter(n => n.alive).forEach(n => {
      const family = byFamily.get(n.familyId);
      if (!family) return;
      const clanName = family.clanName || this.clanNames[Math.floor((n.id - 1) / 3) % this.clanNames.length];
      family.clanName = clanName;
      if (!clanMap.has(clanName)) clanMap.set(clanName, { id: `clan-${clanName}`, name: clanName, families: [], members: 0, influence: 0, wealth: 0 });
      const clan = clanMap.get(clanName);
      if (!clan.families.includes(family.id)) clan.families.push(family.id);
      clan.members++;
      clan.wealth += n.wealth || 0;
      clan.influence += n.legitimacy || 0;
    });
    state.clans = [...clanMap.values()];
  },
  marry(state, a, b) {
    if (!a || !b || a.id === b.id || a.spouseId || b.spouseId || !a.alive || !b.alive) return false;
    if (Math.abs(a.age - b.age) > 22 || a.age < 18 || b.age < 18) return false;
    a.spouseId = b.id; b.spouseId = a.id;
    a.estate.gold = (a.estate.gold || 0) + (b.estate.gold || 0) * 0.2;
    b.estate.gold = (b.estate.gold || 0) + (a.estate.gold || 0) * 0.1;
    return true;
  },
  inherit(state, deceased) {
    if (!deceased || deceased._inheritanceSettled || deceased.alive) return;
    deceased._inheritanceSettled = true;
    const eligible = deceased.childrenIds
      .map(id => state.npcs.find(n => n.id === id))
      .filter(n => n && n.alive)
      .sort((a,b) => {
        const rank = n => (n.roleId === 'heir' ? 1000 : 0) + (n.legitimacy || 0) + (n.age >= 18 ? 40 : 0);
        return rank(b) - rank(a) || b.age - a.age;
      });
    const spouse = deceased.spouseId ? state.npcs.find(n => n.id === deceased.spouseId && n.alive) : null;
    const heir = eligible[0] || spouse;
    if (!heir) return;
    const estate = deceased.estate || { gold: deceased.wealth || 0, land: 0, buildings: 0, titles: [] };
    heir.wealth = (heir.wealth || 0) + (estate.gold || deceased.wealth || 0);
    heir.estate = heir.estate || { gold: 0, land: 0, buildings: 0, titles: [] };
    heir.estate.gold += estate.gold || deceased.wealth || 0;
    heir.estate.land += estate.land || 0;
    heir.estate.buildings += estate.buildings || 0;
    heir.estate.titles = [...new Set([...(heir.estate.titles || []), ...(estate.titles || [])])];
    if (deceased.roleId && ['king','queen','duke','count','baron','prince','emperor','empress','governor','mayor','chancellor'].includes(deceased.roleId)) {
      heir.roleId = this.nextTitle(deceased.roleId);
      heir.roleName = window.ROLE_BY_ID?.[heir.roleId]?.name || heir.roleId;
      heir.legitimacy = Math.min(100, (heir.legitimacy || 50) + 20);
      if (typeof window.addFamilyMemory === 'function') window.addFamilyMemory(heir, `Inherited ${deceased.roleName || deceased.roleId} after ${deceased.name}'s death.`);
    }
    if (typeof window.addFamilyMemory === 'function') window.addFamilyMemory(heir, `Inherited the estate of ${deceased.name}.`);
  },
  nextTitle(roleId) {
    const map = { king:'king', queen:'queen', duke:'duke', count:'count', baron:'baron', prince:'prince', emperor:'emperor', empress:'empress', governor:'governor', mayor:'mayor', chancellor:'chancellor' };
    return map[roleId] || 'heir';
  },
  onBirth(state, child, parents) {
    const [a,b] = parents.filter(Boolean);
    const family = a?.familyId ? state.families.find(f => f.id === a.familyId) : null;
    const chosenFamily = family || (b?.familyId ? state.families.find(f => f.id === b.familyId) : null);
    child.familyId = chosenFamily?.id || `family-${child.id}`;
    child.familyName = chosenFamily?.name || a?.familyName || b?.familyName || this.familyNames[child.id % this.familyNames.length];
    child.parents = parents.filter(Boolean).map(n => n.id);
    child.spouseId = null; child.childrenIds = []; child.legitimacy = 45 + Math.random() * 30;
    child.estate = { gold: 0, land: 0, buildings: 0, titles: [] };
    if (chosenFamily) {
      chosenFamily.members.push(child.id);
      chosenFamily.generation = Math.max(chosenFamily.generation || 1, 1 + Math.max(...parents.map(p => {
        const f = state.families.find(x => x.id === p.familyId); return f?.generation || 1;
      }), 1));
    }
    parents.forEach(parent => {
      if (!parent.childrenIds) parent.childrenIds = [];
      parent.childrenIds.push(child.id);
    });
    child.roleId = child.roleId || 'child'; child.roleName = 'Child';
  },
  tick(state) {
    this.initialize(state);
    const alive = state.npcs.filter(n => n.alive);
    // Form marriages organically.
    for (const n of alive) {
      if (n.spouseId || n.age < 18 || Math.random() > 0.0015 * (state.speed || 1)) continue;
      const candidates = alive.filter(x => x.id !== n.id && !x.spouseId && x.sex !== n.sex && x.age >= 18 && Math.abs(x.age - n.age) <= 10 && x.faction === n.faction);
      if (candidates.length) this.marry(state, n, candidates[Math.floor(Math.random() * candidates.length)]);
    }
    // Deliver estates whenever an NPC dies.
    state.npcs.filter(n => !n.alive && !n._inheritanceSettled).forEach(n => this.inherit(state, n));
    // Families gain influence from titles, wealth and membership.
    state.families.forEach(f => {
      const members = alive.filter(n => n.familyId === f.id);
      f.members = members.map(n => n.id);
      f.wealth = members.reduce((sum,n) => sum + (n.wealth || 0), 0);
      f.influence = members.length * 2 + members.reduce((sum,n) => sum + (n.legitimacy || 0), 0) / 10;
    });
    if (state.tick % 25 === 0) this.rebuildClans(state);
  }
};
window.addFamilyMemory = function(npc, text) {
  npc.memories = npc.memories || [];
  npc.memories.unshift({ text, year: window.SIM_STATE?.year || 1 });
  npc.memories = npc.memories.slice(0, 10);
};
window.familyTick = state => window.FAMILY_SYSTEM.tick(state);
