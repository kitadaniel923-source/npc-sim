// Everglen event feedback: additive visual response for a fixed list of major events.
(() => {
  const state = window.SIM_STATE;
  if (!state) return;

  const MAJOR_TYPES = new Set([
    'war-declared','war-ended','plague-outbreak','plague-contained',
    'meteor-impact','settlement-tier-up','ruler-death','player-intervention'
  ]);
  const prefersReduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  let enabled = state.feedbackEnabled !== false;
  let active = null;

  state.feedbackEnabled = enabled;
  state.feedbackQueue = Array.isArray(state.feedbackQueue) ? state.feedbackQueue : [];

  function notify(event = {}) {
    const type = String(event.type || '');
    if (!MAJOR_TYPES.has(type)) return false;
    const item = {
      severity: 'major',
      type,
      text: String(event.text || 'A major event has occurred.'),
      cause: event.cause === 'player' ? 'player' : 'organic',
      x: Number.isFinite(Number(event.x)) ? Number(event.x) : null,
      y: Number.isFinite(Number(event.y)) ? Number(event.y) : null,
      year: Number(state.year) || 1,
      tick: Number(state.tick) || 0,
      createdAt: Date.now()
    };
    state.feedbackQueue.unshift(item);
    state.feedbackQueue = state.feedbackQueue.slice(0, 12);
    active = item;
    if (enabled && !prefersReduced()) nudgeCamera(item);
    return true;
  }

  function nudgeCamera(item) {
    if (item.x == null || item.y == null || !state.camera) return;
    const dx = item.x - (Number(state.camera.x) || 0);
    const dy = item.y - (Number(state.camera.y) || 0);
    state.camera.feedbackNudge = { x: dx, y: dy, until: Date.now() + 850 };
  }

  function draw() {
    if (!enabled || !active) return;
    const age = Date.now() - active.createdAt;
    if (age > 2200) { active = null; return; }
    const canvas = document.getElementById('worldCanvas');
    const viewport = document.getElementById('worldViewport');
    if (!viewport) return;

    let toast = document.getElementById('eventFeedbackToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'eventFeedbackToast';
      toast.style.cssText = 'position:absolute;left:50%;top:18px;transform:translateX(-50%);z-index:55;min-width:280px;max-width:520px;padding:10px 14px;text-align:center;border:2px solid #26312c;box-shadow:4px 4px #17211d;font:700 13px Segoe UI,sans-serif;pointer-events:none;transition:opacity .15s ease;';
      viewport.appendChild(toast);
    }
    toast.style.background = active.cause === 'player' ? 'rgba(90,69,24,.96)' : 'rgba(45,48,44,.96)';
    toast.style.color = active.cause === 'player' ? '#ffe59a' : '#f2f0dc';
    toast.textContent = active.text;
    toast.style.opacity = String(Math.max(0, Math.min(1, 1 - age / 2200)));

    if (canvas && canvas.width) {
      const ctx = canvas.getContext('2d');
      const pulse = Math.sin(age / 120 * Math.PI) * .5 + .5;
      const alpha = (1 - age / 2200) * (.16 + pulse * .12);
      ctx.save();
      ctx.fillStyle = active.cause === 'player' ? `rgba(242,198,95,${alpha})` : `rgba(235,235,220,${alpha})`;
      const w = canvas.clientWidth || canvas.width;
      const h = canvas.clientHeight || canvas.height;
      ctx.fillRect(0,0,w,6);
      ctx.fillRect(0,h-6,w,6);
      ctx.fillRect(0,0,6,h);
      ctx.fillRect(w-6,0,6,h);
      ctx.restore();
    }

    if (state.camera?.feedbackNudge?.until && Date.now() > state.camera.feedbackNudge.until) {
      state.camera.feedbackNudge = null;
    }
  }

  function setEnabled(value) {
    enabled = !!value;
    state.feedbackEnabled = enabled;
    if (!enabled) {
      active = null;
      const toast = document.getElementById('eventFeedbackToast');
      if (toast) toast.remove();
    }
    window.EVERGLEN_RENDER?.run?.({state});
  }

  function injectToggle() {
    const controls = document.querySelector('.world-toolbar .toolbar-actions');
    if (!controls || document.getElementById('toggleFeedback')) return;
    const button = document.createElement('button');
    button.id = 'toggleFeedback';
    button.textContent = enabled ? '✦ Feedback' : '✦ Feedback Off';
    button.title = 'Toggle major-event screen feedback';
    button.addEventListener('click', () => { setEnabled(!enabled); button.textContent = enabled ? '✦ Feedback' : '✦ Feedback Off'; });
    controls.appendChild(button);
  }

  window.EVERGLEN_EVENT_FEEDBACK = {
    notify,
    setEnabled,
    isEnabled: () => enabled,
    majorTypes: [...MAJOR_TYPES]
  };
  window.EVERGLEN_NOTIFY = notify;
  if (state.registerSystem) state.registerSystem({name:'event-feedback',step:()=>{},priority:999});
  window.EVERGLEN_RENDER?.register?.({name:'event-feedback',priority:1000,draw});
  injectToggle();
  setTimeout(injectToggle,0);
})();