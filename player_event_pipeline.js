// Everglen player event pipeline: one canonical path for attribution, history, entity tags and player-caused memories.
(() => {
  const state = window.SIM_STATE;
  if (!state) return;

  function record(action, details = {}) {
    const entry = window.EVERGLEN_PLAYER?.record?.(action, details) || null;
    if (entry) {
      const ids = Array.isArray(details.entityIds) ? details.entityIds : (details.entityId ? [details.entityId] : []);
      const byId = new Map((state.npcs || []).concat(state.settlements || []).map(x => [x?.id, x]));
      (state.worldGen?.resources || []).forEach(x => byId.set(x?.id, x));
      ids.forEach(id => {
        const entity = byId.get(id);
        if (!entity) return;
        entity.playerCreated = entity.playerCreated || details.created === true;
        entity.playerFounded = entity.playerFounded || details.founded === true;
        entity.playerPlaced = entity.playerPlaced || details.placed === true;
        entity.playerCaused = true;
        entity.playerInterventionId = entry.id;
      });
    }
    return entry;
  }

  function remember(npc, memory = {}) {
    if (!npc || !window.NPC_MEMORY?.remember) return null;
    const interventionId = memory.interventionId || memory.id || null;
    return window.NPC_MEMORY.remember(npc, {
      ...memory,
      source: 'player',
      playerCaused: true,
      interventionId
    });
  }

  function apply(action, details = {}) {
    const entry = record(action, details);
    const ids = Array.isArray(details.memoryNpcIds) ? details.memoryNpcIds : [];
    ids.forEach(id => {
      const npc = (state.npcs || []).find(n => n?.id === id);
      if (!npc) return;
      remember(npc, {
        ...(details.memory || {}),
        interventionId: entry?.id || null
      });
    });
    return entry;
  }

  window.EVERGLEN_PLAYER_EVENTS = { record, remember, apply };
})();
