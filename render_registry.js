// Everglen shared renderer registry.
// Runtime contract: one canonical render owner invokes ordered renderer stages.
(() => {
  const renderers = [];
  let baseRender = null;

  const register = renderer => {
    const draw = typeof renderer === 'function' ? renderer : renderer?.draw;
    if (typeof draw !== 'function') return () => {};
    const entry = {
      name: typeof renderer === 'function' ? renderer.name || `renderer-${renderers.length+1}` : renderer.name || `renderer-${renderers.length+1}`,
      priority: typeof renderer === 'function' ? 100 : (Number.isFinite(renderer.priority) ? renderer.priority : 100),
      draw
    };
    renderers.push(entry);
    renderers.sort((a,b) => a.priority - b.priority);
    return () => {
      const i = renderers.indexOf(entry);
      if (i >= 0) renderers.splice(i,1);
    };
  };

  const run = context => {
    const payload = context || { state:window.SIM_STATE };
    for (const r of renderers.slice()) {
      try { r.draw(payload); }
      catch (error) { console.error(`Everglen renderer '${r.name}' failed`, error); }
    }
  };

  function installBaseOwner() {
    if (typeof window.SIM_RENDER !== 'function' || window.SIM_RENDER === canonicalRender) return;
    if (!baseRender) baseRender = window.SIM_RENDER;
    window.SIM_RENDER = canonicalRender;
  }

  function canonicalRender() {
    if (baseRender) {
      try { baseRender(); } catch (error) { console.error('Everglen base renderer failed', error); }
    }
    run({ state:window.SIM_STATE });
  }

  Object.defineProperty(window,'EVERGLEN_RENDER',{value:{
    register,
    unregister: fn => fn?.(),
    run,
    installBaseOwner,
    get renderers(){ return renderers; }
  }, configurable:false, enumerable:true});

  const hook = () => installBaseOwner();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',hook,{once:true});
  else hook();
})();
