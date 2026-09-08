// Everglen persistence: save and restore complete simulation worlds in the browser.
(() => {
  const state = window.SIM_STATE;
  if (!state) return;

  const KEY = 'everglen.world.v1';
  const SAVE_INTERVAL = 30000;
  const memory = {};

  const clone = value => {
    if (value === undefined) return undefined;
    try { return JSON.parse(JSON.stringify(value)); }
    catch (_) { return null; }
  };

  function metadata() {
    return {
      version: 1,
      savedAt: new Date().toISOString(),
      year: state.year || 1,
      day: state.day || 1,
      population: (state.npcs || []).filter(n => n && n.alive).length,
      settlements: (state.settlements || []).length
    };
  }

  function snapshot() {
    const copy = {};
    Object.keys(state).forEach(key => {
      if (key === 'dragging' || key === 'dragStart') return;
      const value = clone(state[key]);
      if (value !== undefined) copy[key] = value;
    });
    return { meta: metadata(), state: copy };
  }

  function writeSnapshot(showFeedback = true) {
    try {
      const payload = JSON.stringify(snapshot());
      localStorage.setItem(KEY, payload);
      memory.lastSaved = Date.now();
      if (showFeedback) feedback(`World saved • Year ${state.year || 1}`);
      return true;
    } catch (error) {
      console.error('Everglen save failed:', error);
      feedback('Save failed. Browser storage may be full.');
      return false;
    }
  }

  function readSnapshot() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.state || parsed.meta?.version !== 1) return null;
      return parsed;
    } catch (error) {
      console.error('Everglen save read failed:', error);
      return null;
    }
  }

  function restore(showFeedback = true) {
    const parsed = readSnapshot();
    if (!parsed) {
      feedback('No saved world found.');
      return false;
    }
    try {
      const keepRunning = state.running;
      Object.keys(state).forEach(key => {
        if (key === 'running' || key === 'dragging' || key === 'dragStart') return;
        delete state[key];
      });
      Object.assign(state, parsed.state);
      state.running = keepRunning;
      state.dragging = false;
      state.dragStart = null;
      state.selected = null;
      if (state.camera) {
        state.camera.zoom = Math.max(.45, Math.min(3, Number(state.camera.zoom) || 1));
      }
      if (typeof state.getNpc === 'function') state.getNpc = undefined;
      if (typeof state.getSettlement === 'function') state.getSettlement = undefined;
      if (typeof state.getKingdom === 'function') state.getKingdom = undefined;
      window.SIM_BUDGET?.cacheMaps?.();
      window.SIM_RENDER?.();
      window.NPC_INSPECTOR?.refresh?.();
      if (showFeedback) feedback(`World loaded • Year ${state.year || 1}`);
      return true;
    } catch (error) {
      console.error('Everglen restore failed:', error);
      feedback('Load failed.');
      return false;
    }
  }

  function hasSave() { return !!localStorage.getItem(KEY); }

  function feedback(message) {
    const existing = document.getElementById('persistenceToast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.id = 'persistenceToast';
    toast.textContent = message;
    toast.style.cssText = 'position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:10000;padding:9px 13px;border-radius:9px;background:rgba(24,31,29,.96);color:#f2f0dc;border:1px solid rgba(255,255,255,.14);font:12px Segoe UI,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.25);';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 1800);
  }

  function injectControls() {
    const controls = document.querySelector('.controls');
    if (!controls || document.getElementById('saveWorld')) return;
    const divider = document.createElement('span');
    divider.style.cssText = 'width:1px;height:22px;background:rgba(255,255,255,.12);display:inline-block;margin:0 2px;';
    const save = document.createElement('button');
    save.id = 'saveWorld'; save.textContent = '💾 Save'; save.title = 'Save this world to this browser';
    const load = document.createElement('button');
    load.id = 'loadWorld'; load.textContent = '↥ Load'; load.title = 'Load the last saved world';
    save.addEventListener('click', () => writeSnapshot(true));
    load.addEventListener('click', () => restore(true));
    controls.append(divider, save, load);
  }

  state.saveWorld = () => writeSnapshot(false);
  state.loadWorld = () => restore(false);
  state.hasSave = hasSave;
  window.EVERGLEN_PERSISTENCE = { KEY, snapshot, save: writeSnapshot, load: restore, hasSave, feedback };

  injectControls();
  setTimeout(injectControls, 0);
  setInterval(() => {
    if (!state.running) return;
    writeSnapshot(false);
  }, SAVE_INTERVAL);

  window.addEventListener('beforeunload', () => writeSnapshot(false));
})();
