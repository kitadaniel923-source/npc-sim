// Everglen persistence v2: data-only world snapshots with safe runtime preservation.
(() => {
  const state = window.SIM_STATE;
  if (!state) return;

  const KEY = 'everglen.world.v2';
  const AUTO_SAVE_MS = 30000;
  const RUNTIME = new Set(['running','dragging','dragStart','systems','_cache','registerSystem','getNpc','getSettlement','getKingdom','saveWorld','loadWorld','hasSave']);

  function clone(value) {
    if (value === undefined || typeof value === 'function') return undefined;
    try { return JSON.parse(JSON.stringify(value)); }
    catch (_) { return null; }
  }

  function snapshot() {
    const data = {};
    for (const key of Object.keys(state)) {
      if (RUNTIME.has(key) || typeof state[key] === 'function') continue;
      const value = clone(state[key]);
      if (value !== undefined) data[key] = value;
    }
    return {
      version: 2,
      savedAt: new Date().toISOString(),
      year: state.year || 1,
      day: state.day || 1,
      population: (state.npcs || []).filter(n => n?.alive).length,
      settlements: (state.settlements || []).length,
      state: data
    };
  }

  function feedback(message) {
    const old = document.getElementById('persistenceToast');
    if (old) old.remove();
    const toast = document.createElement('div');
    toast.id = 'persistenceToast';
    toast.textContent = message;
    toast.style.cssText = 'position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:10000;padding:9px 13px;border-radius:9px;background:rgba(24,31,29,.96);color:#f2f0dc;border:1px solid rgba(255,255,255,.14);font:12px Segoe UI,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.25);';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 1800);
  }

  function save(show = true) {
    try {
      localStorage.setItem(KEY, JSON.stringify(snapshot()));
      if (show) feedback(`World saved • Year ${state.year || 1}`);
      return true;
    } catch (error) {
      console.error('Everglen save failed:', error);
      if (show) feedback('Save failed. Browser storage may be full.');
      return false;
    }
  }

  function read() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      return data?.version === 2 && data.state ? data : null;
    } catch (error) {
      console.error('Everglen load read failed:', error);
      return null;
    }
  }

  function load(show = true) {
    const data = read();
    if (!data) { if (show) feedback('No saved world found.'); return false; }
    try {
      for (const key of Object.keys(state)) {
        if (RUNTIME.has(key) || typeof state[key] === 'function') continue;
        delete state[key];
      }
      Object.assign(state, data.state);
      state.dragging = false;
      state.dragStart = null;
      state.selected = null;
      if (!state.camera) state.camera = {x:0,y:0,zoom:1};
      state.camera.zoom = Math.max(.45, Math.min(3, Number(state.camera.zoom) || 1));
      window.SIM_BUDGET?.cacheMaps?.();
      window.SIM_RENDER?.();
      if (show) feedback(`World loaded • Year ${state.year || 1}`);
      return true;
    } catch (error) {
      console.error('Everglen restore failed:', error);
      if (show) feedback('Load failed.');
      return false;
    }
  }

  function injectControls() {
    const controls = document.querySelector('.controls');
    if (!controls || document.getElementById('saveWorld')) return;
    const saveBtn = document.createElement('button');
    saveBtn.id = 'saveWorld'; saveBtn.textContent = '💾 Save'; saveBtn.title = 'Save this world to this browser';
    const loadBtn = document.createElement('button');
    loadBtn.id = 'loadWorld'; loadBtn.textContent = '↥ Load'; loadBtn.title = 'Load the last saved world';
    saveBtn.addEventListener('click', () => save(true));
    loadBtn.addEventListener('click', () => load(true));
    controls.append(saveBtn, loadBtn);
  }

  state.saveWorld = () => save(false);
  state.loadWorld = () => load(false);
  state.hasSave = () => !!localStorage.getItem(KEY);
  window.EVERGLEN_PERSISTENCE = {KEY, snapshot, save, load, hasSave: state.hasSave};

  injectControls();
  setTimeout(injectControls, 0);
  setTimeout(() => { if (state.hasSave()) load(false); }, 250);
  setInterval(() => { if (state.running) save(false); }, AUTO_SAVE_MS);
  window.addEventListener('beforeunload', () => save(false));
})();
