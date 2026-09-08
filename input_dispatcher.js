// Everglen shared world input dispatcher.
// Runtime contract: this file owns world-canvas DOM input and routes behavior to registered handlers.
(() => {
  const canvas = document.getElementById('worldCanvas');
  if (!canvas) return;

  const handlers = [];
  const drag = { active:false, startX:0, startY:0, cameraX:0, cameraY:0 };

  const state = () => window.SIM_STATE;
  const register = handler => {
    if (!handler || typeof handler.handle !== 'function') return () => {};
    const entry = {
      name: handler.name || `handler-${handlers.length+1}`,
      priority: Number.isFinite(handler.priority) ? handler.priority : 100,
      events: Array.isArray(handler.events) ? handler.events : ['click'],
      hitTest: typeof handler.hitTest === 'function' ? handler.hitTest : null,
      handle: handler.handle
    };
    handlers.push(entry);
    handlers.sort((a,b) => a.priority - b.priority);
    return () => {
      const i = handlers.indexOf(entry);
      if (i >= 0) handlers.splice(i,1);
    };
  };

  const worldPoint = (clientX, clientY) => {
    const s = state();
    const r = canvas.getBoundingClientRect();
    const sx = (clientX-r.left) * canvas.width / Math.max(1,r.width);
    const sy = (clientY-r.top) * canvas.height / Math.max(1,r.height);
    const cam = s?.camera || {x:0,y:0,zoom:1};
    return {
      x: cam.x + (sx-canvas.width/2) / Math.max(.01,cam.zoom),
      y: cam.y + (sy-canvas.height/2) / Math.max(.01,cam.zoom)
    };
  };

  const dispatch = (type, event, pointOverride) => {
    const p = pointOverride || worldPoint(event.clientX, event.clientY);
    for (const h of handlers.slice()) {
      if (!h.events.includes(type) && !h.events.includes('*')) continue;
      if (h.hitTest && h.hitTest(p, event, type) === false) continue;
      try {
        if (h.handle(p, event, type) === true) return true;
      } catch (error) {
        console.error(`Everglen input handler '${h.name}' failed`, error);
      }
    }
    return false;
  };

  canvas.addEventListener('click', event => {
    if (dispatch('click', event)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  canvas.addEventListener('wheel', event => {
    if (dispatch('wheel', event)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, {capture:true, passive:false});

  canvas.addEventListener('mousedown', event => {
    if (dispatch('mousedown', event)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  window.addEventListener('mousemove', event => {
    if (dispatch('mousemove', event)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  window.addEventListener('mouseup', event => {
    if (dispatch('mouseup', event)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  register({
    name:'camera-controls',
    priority:900,
    events:['wheel','mousedown','mousemove','mouseup'],
    handle:(p,event,type) => {
      const s = state();
      if (!s) return false;
      if (type === 'wheel') {
        s.camera.zoom = Math.max(.45, Math.min(3, s.camera.zoom * (event.deltaY < 0 ? 1.1 : .9)));
        window.SIM_RENDER?.();
        return true;
      }
      if (type === 'mousedown') {
        if (event.button !== 0) return false;
        drag.active = true;
        drag.startX = event.clientX;
        drag.startY = event.clientY;
        drag.cameraX = s.camera.x;
        drag.cameraY = s.camera.y;
        return true;
      }
      if (type === 'mousemove') {
        if (!drag.active) return false;
        s.camera.x = drag.cameraX - (event.clientX-drag.startX) / Math.max(.01,s.camera.zoom);
        s.camera.y = drag.cameraY - (event.clientY-drag.startY) / Math.max(.01,s.camera.zoom);
        window.SIM_RENDER?.();
        return true;
      }
      if (type === 'mouseup') {
        drag.active = false;
        return true;
      }
      return false;
    }
  });

  register({
    name:'npc-selection',
    priority:1000,
    events:['click'],
    hitTest:() => !state()?.godMode,
    handle:(p) => {
      const s = state();
      if (!s) return false;
      let hit = null;
      let best = 16 / Math.max(.01,s.camera?.zoom || 1);
      (s.npcs || []).forEach(n => {
        if (!n.alive) return;
        const d = Math.hypot((n.x||0)-p.x,(n.y||0)-p.y);
        if (d < best) { hit = n; best = d; }
      });
      if (!hit) return false;
      s.selected = hit.id;
      window.SIM_RENDER?.();
      return true;
    }
  });

  window.EVERGLEN_INPUT = {
    register,
    unregister: fn => fn?.(),
    screenToWorld: (clientX,clientY) => worldPoint(clientX,clientY),
    dispatch,
    handlers
  };
})();
