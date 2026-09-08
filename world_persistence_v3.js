// Everglen persistence v3: versioned, data-only snapshots with explicit typed-array serialization.
(() => {
  const state = window.SIM_STATE;
  if (!state) return;

  const KEY = 'everglen.world.v3';
  const LEGACY_V2_KEY = 'everglen.world.v2';
  const LEGACY_V1_KEY = 'everglen.world.v1';
  const VERSION = 3;
  const AUTO_SAVE_MS = 30000;
  const RUNTIME = new Set([
    'running','dragging','dragStart','systems','_cache','registerSystem',
    'getNpc','getSettlement','getKingdom','getFamily','saveWorld','loadWorld','hasSave'
  ]);

  function encode(value) {
    if (value === undefined || typeof value === 'function') return undefined;
    if (ArrayBuffer.isView(value) && !(value instanceof DataView)) {
      return { __everglenType: value.constructor.name, data: Array.from(value) };
    }
    if (value instanceof ArrayBuffer) {
      return { __everglenType: 'ArrayBuffer', data: Array.from(new Uint8Array(value)) };
    }
    if (Array.isArray(value)) return value.map(encode).filter(v => v !== undefined);
    if (value && typeof value === 'object') {
      const out = {};
      for (const [key, item] of Object.entries(value)) {
        const encoded = encode(item);
        if (encoded !== undefined) out[key] = encoded;
      }
      return out;
    }
    return value;
  }

  const TYPED_ARRAYS = {
    Int8Array, Uint8Array, Uint8ClampedArray, Int16Array, Uint16Array,
    Int32Array, Uint32Array, Float32Array, Float64Array, BigInt64Array, BigUint64Array
  };

  function decode(value) {
    if (!value || typeof value !== 'object') return value;
    if (value.__everglenType) {
      const Ctor = TYPED_ARRAYS[value.__everglenType];
      if (Ctor) return new Ctor(value.data || []);
      if (value.__everglenType === 'ArrayBuffer') return Uint8Array.from(value.data || []).buffer;
    }
    if (Array.isArray(value)) return value.map(decode);
    const out = {};
    for (const [key, item] of Object.entries(value)) out[key] = decode(item);
    return out;
  }

  function normalizeLegacyTyped(stateData) {
    if (!stateData || typeof stateData !== 'object') return stateData;
    const copy = stateData;
    for (const [key, Ctor] of [['territory', Int16Array], ['territoryCost', Float32Array]]) {
      const value = copy[key];
      if (!value || value.constructor !== Object) continue;
      const numericKeys = Object.keys(value).filter(k => /^(0|[1-9]\d*)$/.test(k));
      if (!numericKeys.length) continue;
      const arr = new Ctor(Math.max(...numericKeys.map(Number)) + 1);
      numericKeys.forEach(k => { arr[Number(k)] = Number(value[k]) || 0; });
      copy[key] = arr;
    }
    return copy;
  }

  function snapshot() {
    const data = {};
    for (const key of Object.keys(state)) {
      if (RUNTIME.has(key)) continue;
      const encoded = encode(state[key]);
      if (encoded !== undefined) data[key] = encoded;
    }
    return {
      schema: 'everglen-world',
      version: VERSION,
      savedAt: new Date().toISOString(),
      invariants: {
        runtimeExcluded: true,
        typedArraysEncoded: true,
        relationReferences: 'id-only',
        playerInterventionsPersisted: true
      },
      meta: {
        year: state.year || 1,
        day: state.day || 1,
        population: (state.npcs || []).filter(n => n?.alive).length,
        settlements: (state.settlements || []).length,
        playerInterventions: (state.playerInterventions || []).length
      },
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

  function migrated(raw, sourceVersion, sourceState, sourceMeta = {}) {
    const normalized = normalizeLegacyTyped(sourceState || {});
    return {
      schema: 'everglen-world',
      version: VERSION,
      savedAt: raw.savedAt || sourceMeta.savedAt || new Date().toISOString(),
      invariants: {
        runtimeExcluded: true,
        typedArraysEncoded: true,
        relationReferences: 'id-only',
        playerInterventionsPersisted: Array.isArray(normalized.playerInterventions)
      },
      meta: sourceMeta || {
        year: raw.year || 1,
        day: raw.day || 1,
        population: raw.population || 0,
        settlements: raw.settlements || 0,
        playerInterventions: (normalized.playerInterventions || []).length
      },
      state: encode(normalized),
      migratedFrom: sourceVersion
    };
  }

  function read() {
    try {
      const current = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (current?.schema === 'everglen-world' && current.version === VERSION && current.state) return current;

      const legacyV2 = JSON.parse(localStorage.getItem(LEGACY_V2_KEY) || 'null');
      if (legacyV2?.version === 2 && legacyV2.state) return migrated(legacyV2, 2, legacyV2.state, legacyV2.meta || {
        year: legacyV2.year || 1,
        day: legacyV2.day || 1,
        population: legacyV2.population || 0,
        settlements: legacyV2.settlements || 0,
        playerInterventions: (legacyV2.state.playerInterventions || []).length
      });

      const legacyV1 = JSON.parse(localStorage.getItem(LEGACY_V1_KEY) || 'null');
      if (legacyV1?.state) return migrated(legacyV1, 1, legacyV1.state, legacyV1.meta || {
        year: legacyV1.meta?.year || legacyV1.year || 1,
        day: legacyV1.meta?.day || legacyV1.day || 1,
        population: legacyV1.meta?.population || legacyV1.population || 0,
        settlements: legacyV1.meta?.settlements || legacyV1.settlements || 0,
        playerInterventions: (legacyV1.state.playerInterventions || []).length
      });
      return null;
    } catch (error) {
      console.error('Everglen load read failed:', error);
      return null;
    }
  }

  function load(show = true) {
    const data = read();
    if (!data) { if (show) feedback('No compatible saved world found.'); return false; }
    try {
      const decoded = decode(data.state);
      for (const key of Object.keys(state)) {
        if (RUNTIME.has(key)) continue;
        delete state[key];
      }
      Object.assign(state, decoded);
      state.dragging = false;
      state.dragStart = null;
      state.selected = null;
      state.running = state.running !== false;
      if (!state.camera) state.camera = {x:0,y:0,zoom:1};
      state.camera.zoom = Math.max(.45, Math.min(3, Number(state.camera.zoom) || 1));
      if (!(state.territory instanceof Int16Array)) state.territory = new Int16Array(state.territory || []);
      if (!(state.territoryCost instanceof Float32Array)) state.territoryCost = new Float32Array(state.territoryCost || []);
      if (!Array.isArray(state.territoryOwner)) state.territoryOwner = [];
      if (!Array.isArray(state.playerInterventions)) state.playerInterventions = [];
      window.SIM_BUDGET?.cacheMaps?.();
      window.BORDER_RECOGNITION?.recalculate?.();
      window.SIM_RENDER?.();
      window.NPC_INSPECTOR?.refresh?.();
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
  state.hasSave = () => !!localStorage.getItem(KEY) || !!localStorage.getItem(LEGACY_V2_KEY) || !!localStorage.getItem(LEGACY_V1_KEY);
  window.EVERGLEN_PERSISTENCE = { KEY, VERSION, snapshot, save, load, hasSave: state.hasSave };

  injectControls();
  setTimeout(injectControls, 0);
  setTimeout(() => { if (state.hasSave()) load(false); }, 250);
  setInterval(() => { if (state.running) save(false); }, AUTO_SAVE_MS);
  window.addEventListener('beforeunload', () => save(false));
})();