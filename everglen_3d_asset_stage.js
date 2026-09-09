// Baked 3D asset stage for Everglen's 2D renderer.
// 3D source meshes are converted at build time into an orthographic sprite atlas.
(() => {
  'use strict';
  const state = window.SIM_STATE;
  const art = window.EVERGLEN_2D_ART;
  const render = window.EVERGLEN_RENDER;
  if (!state || !art?.canvas || !render) return;

  const root = 'assets/everglen/';
  const canvas = art.canvas;
  const ctx = canvas.getContext('2d');
  const status = { ready: false, error: null, frames: 0, draws: 0 };
  let image = null;
  let manifest = null;

  const load = async () => {
    try {
      const [meta, response] = await Promise.all([
        fetch(root + 'medieval_3d_manifest.json').then(r => {
          if (!r.ok) throw new Error(`manifest HTTP ${r.status}`);
          return r.json();
        }),
        new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error('medieval_3d_atlas.webp failed to load'));
          img.src = root + 'medieval_3d_atlas.webp';
        })
      ]);
      manifest = meta;
      image = response;
      status.frames = Number(meta.frames) || 0;
      status.ready = true;
      window.EVERGLEN_3D_ASSETS = { status, manifest };
    } catch (error) {
      status.error = String(error?.message || error);
      status.ready = false;
      window.EVERGLEN_3D_ASSETS = { status, manifest };
      console.error('Everglen baked 3D asset load failed:', status.error);
    }
  };

  const hash = (x, y, s = 0) => {
    const v = Math.sin(x * 12.9898 + y * 78.233 + s * 37.719) * 43758.5453;
    return v - Math.floor(v);
  };

  const screen = (x, y) => {
    const z = state.camera?.zoom || 1;
    return [160 + (x - (state.camera?.x || 0)) * z / 8, 90 + (y - (state.camera?.y || 0)) * z / 8];
  };

  const drawFrame = (frame, x, y, w, h, flip = false) => {
    if (!status.ready || !image || !manifest?.frames) return false;
    const count = Math.max(1, Number(manifest.frames));
    const cellW = Number(manifest.cell?.[0]) || image.width / count;
    const cellH = Number(manifest.cell?.[1]) || image.height;
    const i = ((Math.floor(frame) % count) + count) % count;
    ctx.save();
    if (flip) {
      ctx.translate(x + w, y);
      ctx.scale(-1, 1);
      x = 0;
    }
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, i * cellW, 0, cellW, cellH, x, y, w, h);
    ctx.restore();
    status.draws++;
    return true;
  };

  function draw() {
    if (!status.ready) return;

    const settlements = state.settlements || [];
    settlements.forEach((s, si) => {
      const [sx, sy] = screen(s.x, s.y);
      if (sx < -30 || sx > 350 || sy < -30 || sy > 210) return;

      const population = (state.npcs || []).filter(n => n.alive && n.settlementId === s.id).length;
      const prosperity = Number(s.prosperity ?? s.wealth ?? s.resources?.gold ?? 0);
      const placements = Math.min(4, 1 + Math.floor(population / 25) + (prosperity > 100 ? 1 : 0));

      for (let i = 0; i < placements; i++) {
        const frame = Math.floor(state.tick / 90) + si * 3 + i;
        const px = sx - 20 + hash(si, i, 101) * 40;
        const py = sy - 18 + hash(si, i, 103) * 18;
        const size = 11 + hash(si, i, 107) * 5;
        drawFrame(frame, px - size / 2, py - size, size, size, hash(si, i, 109) > .5);
      }
    });

    // Ports receive the same baked medieval source as an environmental prop layer.
    // The frame changes slowly so the scene does not flicker while the simulation runs.
    const ports = settlements.filter(s => s.isPort || s.port || s.coastal);
    ports.forEach((s, i) => {
      const [sx, sy] = screen(s.x + 18, s.y + 10);
      if (sx < -30 || sx > 350 || sy < -30 || sy > 210) return;
      drawFrame(Math.floor(state.tick / 120) + i + 4, sx - 7, sy - 7, 14, 14, i % 2 === 1);
    });

    window.EVERGLEN_3D_ASSETS = { status, manifest };
  }

  window.EVERGLEN_3D_ASSETS = { status, manifest };
  window.EVERGLEN_3D_ASSET_STAGE = { draw, drawFrame, status };
  render.register({ name: 'baked-3d-assets', priority: 280, draw });
  load();
})();
