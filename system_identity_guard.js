/* Scheduler identity guard. Keeps registered system names unique without adding a simulation tick. */
(() => {
  'use strict';
  const state = window.SIM_STATE;
  if (!state || !Array.isArray(state.systems)) return;

  const seen = new Map();
  state.systems.forEach(system => {
    if (!system || typeof system.step !== 'function') return;
    const base = String(system.name || system.step.name || 'anonymous-system');
    const count = seen.get(base) || 0;
    seen.set(base, count + 1);
    if (count > 0) system.name = `${base}#${count + 1}`;
    else system.name = base;
  });
})();
