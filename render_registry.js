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
      // Imported assets own the visual surface once the canonical asset renderer
      // is active. Legacy procedural stages and the legacy combined asset-world
      // stage must not paint a second NPC body pass.
      if (window.EVERGLEN_CANONICAL_ASSET_RENDER && (r.name === 'art-2d' || r.name === 'npc-visuals' || r.name === 'asset-world')) continue;
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
    // The legacy base renderer can directly paint procedural NPCs. Once imported
    // assets are canonical, skip that pass entirely so Pixel Crawler owns NPCs.
    if (baseRender && !window.EVERGLEN_CANONICAL_ASSET_RENDER) {
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
