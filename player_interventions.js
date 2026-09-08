// Everglen player intervention ledger: durable history for every world-altering player action.
(() => {
  const state = window.SIM_STATE;
  if (!state) return;

  const MAX_INTERVENTIONS = 2500;
  state.playerInterventions = Array.isArray(state.playerInterventions) ? state.playerInterventions : [];
  let sequence = state.playerInterventions.length;

  function id() {
    sequence += 1;
    return `player-${Date.now().toString(36)}-${sequence.toString(36)}`;
  }

  function record(action, details = {}) {
    const entry = {
      id: id(),
      actor: 'player',
      playerCaused: true,
      tick: Number(state.tick) || 0,
      year: Number(state.year) || 1,
      day: Number(state.day) || 1,
      hour: Number(state.hour) || 0,
      action: String(action),
      tool: details.tool || null,
      target: details.target || null,
      position: Number.isFinite(Number(details.x)) && Number.isFinite(Number(details.y))
        ? { x: Number(details.x), y: Number(details.y) } : null,
      details: details.details || null,
      consequences: Array.isArray(details.consequences) ? details.consequences.slice(0, 20) : [],
      entityId: details.entityId || null,
      createdAt: new Date().toISOString()
    };
    state.playerInterventions.unshift(entry);
    state.playerInterventions = state.playerInterventions.slice(0, MAX_INTERVENTIONS);
    return entry;
  }

  function recent(limit = 25) {
    return state.playerInterventions.slice(0, Math.max(0, Number(limit) || 25));
  }

  function clear() {
    state.playerInterventions.length = 0;
    sequence = 0;
  }

  window.EVERGLEN_PLAYER = { record, recent, history: recent, clear, MAX_INTERVENTIONS };
  window.EVERGLEN_PLAYER_RECORD = record;
})();
