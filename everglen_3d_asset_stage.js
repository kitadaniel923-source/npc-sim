// Everglen 3D asset stage.
// Preferred path: Blender Blend/FBX -> orthographic sprite bake -> mega atlas.
// Legacy single-atlas files remain a fallback until the next bake is generated.
(() => {
  'use strict';
  const state = window.SIM_STATE;
  const art = window.EVERGLEN_2D_ART;
  const render = window.EVERGLEN_RENDER;
  if (!state || !art?.canvas || !render) return;

  const root = 'assets/everglen/';
  const ctx = art.canvas.getContext('2d');
  const status = { ready: false, error: null, frames: 0, draws: 0, assets: 0, usedAssets: {}, pipeline: 'blender-export-sprite-bake-mega-atlas' };
  let image = null;
  let manifest = null;
  let mega = false;

  const loadImage = src => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`${src} failed to load`));
    img.src = root + src;
  });

  const load = async () => {
    try {
      try {
        const [meta, atlas] = await Promise.all([
          fetch(root + 'medieval_3d_mega_manifest.json').then(r => { if (!r.ok) throw new Error(`mega manifest HTTP ${r.status}`); return r.json(); }),
          loadImage('medieval_3d_mega_atlas.webp')
        ]);
        manifest = meta;
        image = atlas;
        mega = true;
      } catch (_) {
        const [meta, atlas] = await Promise.all([
          fetch(root + 'medieval_3d_manifest.json').then(r => { if (!r.ok) throw new Error(`legacy manifest HTTP ${r.status}`); return r.json(); }),
          loadImage('medieval_3d_atlas.webp')
        ]);
        manifest = meta;
        image = atlas;
      }
      status.frames = Number(manifest.framesPerAsset || manifest.frames) || 0;
      status.assets = Array.isArray(manifest.assets) ? manifest.assets.length : 1;
      status.ready = true;
      window.EVERGLEN_3D_ASSETS = { status, manifest };
    } catch (error) {
      status.error = String(error?.message || error);
      status.ready = false;
      window.EVERGLEN_3D_ASSETS = { status, manifest };
      console.error('Everglen baked 3D asset load failed:', status.error);
    }
  };

  const hash = (x, y, s = 0) => { const value = Math.sin(x * 12.9898 + y * 78.233 + s * 37.719) * 43758.5453; return value - Math.floor(value); };
  const screen = (x, y) => { const zoom = state.camera?.zoom || 1; return [160 + (x - (state.camera?.x || 0)) * zoom / 8, 90 + (y - (state.camera?.y || 0)) * zoom / 8]; };

  const pickAsset = (seed, role = '') => {
    const assets = Array.isArray(manifest?.assets) ? manifest.assets : [];
    if (!assets.length) return null;
    const preferred = assets.filter(asset => {
      const name = String(asset.name || asset.id || '').toLowerCase();
      if (role === 'port') return /dock|boat|ship|port|pier|harbor/.test(name);
      if (role === 'market') return /market|shop|stall|cart|crate|barrel/.test(name);
      if (role === 'military') return /sword|armor|weapon|knight|wall|tower/.test(name);
      return true;
    });
    const pool = preferred.length ? preferred : assets;
    return pool[Math.abs(Math.floor(seed)) % pool.length];
  };

  const drawMega = (asset, frame, x, y, w, h, flip = false) => {
    if (!asset || !image) return false;
    const cellW = Number(manifest.cell?.[0]) || asset.w;
    const cellH = Number(manifest.cell?.[1]) || asset.h;
    const count = Number(asset.frames || manifest.framesPerAsset || 1);
    const index = ((Math.floor(frame) % count) + count) % count;
    ctx.save();
    if (flip) { ctx.translate(x + w, y); ctx.scale(-1, 1); x = 0; }
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, Number(asset.x) + index * cellW, Number(asset.y), cellW, cellH, x, y, w, h);
    ctx.restore();
    status.draws++;
    const id = asset.id || asset.name || 'legacy';
    status.usedAssets[id] = (status.usedAssets[id] || 0) + 1;
    return true;
  };

  const drawLegacy = (frame, x, y, w, h, flip = false) => {
    const count = Math.max(1, Number(manifest?.frames) || 1);
    const cellW = Number(manifest?.cell?.[0]) || image.width / count;
    const cellH = Number(manifest?.cell?.[1]) || image.height;
    const index = ((Math.floor(frame) % count) + count) % count;
    ctx.save();
    if (flip) { ctx.translate(x + w, y); ctx.scale(-1, 1); x = 0; }
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, index * cellW, 0, cellW, cellH, x, y, w, h);
    ctx.restore();
    status.draws++;
    return true;
  };

  const drawAsset = (asset, frame, x, y, w, h, flip) => mega ? drawMega(asset, frame, x, y, w, h, flip) : drawLegacy(frame, x, y, w, h, flip);

  function draw() {
    if (!status.ready || !image) return;
    const settlements = state.settlements || [];
    settlements.forEach((settlement, si) => {
      const [sx, sy] = screen(settlement.x, settlement.y);
      if (sx < -40 || sx > 360 || sy < -40 || sy > 220) return;
      const population = (state.npcs || []).filter(n => n.alive && n.settlementId === settlement.id).length;
      const prosperity = Number(settlement.prosperity ?? settlement.wealth ?? settlement.resources?.gold ?? 0);
      const count = Math.min(5, 1 + Math.floor(population / 20) + (prosperity > 100 ? 1 : 0));
      const port = settlement.isPort || settlement.port || settlement.coastal;
      for (let i = 0; i < count; i++) {
        const role = i === 0 && port ? 'port' : i % 3 === 0 ? 'market' : 'default';
        const asset = mega ? pickAsset(si * 31 + i + Math.floor(state.tick / 120), role) : null;
        const frame = Math.floor(state.tick / 90) + si * 3 + i;
        const px = sx - 22 + hash(si, i, 101) * 44;
        const py = sy - 20 + hash(si, i, 103) * 20;
        const size = 12 + hash(si, i, 107) * 6;
        drawAsset(asset, frame, px - size / 2, py - size, size, size, hash(si, i, 109) > .5);
      }
    });

    if (mega) {
      const military = new Set(['militia', 'soldier', 'archer', 'spearman', 'cavalry', 'knight', 'paladin', 'captain', 'general', 'marshal']);
      (state.npcs || []).forEach((npc, index) => {
        if (!npc.alive || !military.has(npc.roleId)) return;
        const [sx, sy] = screen(npc.x, npc.y);
        if (sx < -20 || sx > 340 || sy < -25 || sy > 205) return;
        const asset = pickAsset(index + Math.floor(state.tick / 60), 'military');
        if (asset) drawMega(asset, Math.floor(state.tick / 6), sx - 7, sy - 15, 14, 14, index % 2 === 1);
      });
    }
    window.EVERGLEN_3D_ASSETS = { status, manifest };
  }

  window.EVERGLEN_3D_ASSETS = { status, manifest };
  window.EVERGLEN_3D_ASSET_STAGE = { draw, drawFrame: drawAsset, status };
  render.register({ name: 'baked-3d-assets', priority: 280, draw });
  load();
})();
