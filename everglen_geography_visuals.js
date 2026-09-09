// Everglen geography visual pass.
// Turns the shared world model into stronger coastlines, beaches, rivers,
// elevation bands and visual land texture without replacing the asset stages.
(() => {
  'use strict';
  const state = window.SIM_STATE;
  const art = window.EVERGLEN_2D_ART;
  const registry = window.EVERGLEN_RENDER;
  if (!state || !art?.canvas || !registry) return;

  const ctx = art.canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const screen = (x, y) => {
    const z = state.camera?.zoom || 1;
    return [160 + (x - (state.camera?.x || 0)) * z / 8, 90 + (y - (state.camera?.y || 0)) * z / 8];
  };
  const world = () => window.EVERGLEN_WORLD;
  const land = (x, y) => !!world()?.landAt?.(x, y);
  const elevation = (x, y) => world()?.elevationAt?.(x, y) || 0;
  const biome = (x, y) => world()?.biomeAt?.(x, y) || 'water';

  function coast(x, y) {
    const d = 14;
    return land(x, y) && (!land(x + d, y) || !land(x - d, y) || !land(x, y + d) || !land(x, y - d));
  }

  function river(x, y) {
    return world()?.riverAt?.(x, y) || 0;
  }

  function draw() {
    ctx.save();

    // Fine water shimmer gives large lakes and oceans some life while retaining pixel readability.
    for (let y = 0; y < 180; y += 6) {
      for (let x = 0; x < 320; x += 8) {
        const wx = (x - 160) * 8 / (state.camera?.zoom || 1) + (state.camera?.x || 0);
        const wy = (y - 90) * 8 / (state.camera?.zoom || 1) + (state.camera?.y || 0);
        if (land(wx, wy) || river(wx, wy) <= 0.18) continue;
        if ((Math.floor(wx / 24) + Math.floor(wy / 24) + Math.floor(state.tick / 12)) % 3 === 0) {
          ctx.fillRect(x + 2, y + 2, 3, 1);
        }
      }
    }

    // Beaches and elevation contours are drawn as tiny pixel bands rather than smooth gradients.
    for (let x = -680; x <= 680; x += 16) {
      for (let y = -480; y <= 480; y += 16) {
        if (!land(x, y)) continue;
        const [sx, sy] = screen(x, y);
        if (sx < -8 || sx > 328 || sy < -8 || sy > 188) continue;
        const h = elevation(x, y);

        if (coast(x, y)) {
          ctx.fillRect(Math.floor(sx), Math.floor(sy), 4, 2);
        } else if (h > 0.76) {
          ctx.fillRect(Math.floor(sx), Math.floor(sy), 3, 2);
        } else if (h > 0.60 && (x + y) % 32 === 0) {
          ctx.fillRect(Math.floor(sx), Math.floor(sy), 2, 1);
        }

        // Sparse biome texture keeps plains from becoming a flat carpet.
        const b = biome(x, y);
        const n = Math.abs(Math.sin(x * 0.071 + y * 0.037));
        if (b === 'steppe' && n > 0.78) ctx.fillRect(Math.floor(sx + 2), Math.floor(sy + 1), 1, 3);
        if (b === 'tundra' && n > 0.84) ctx.fillRect(Math.floor(sx), Math.floor(sy), 2, 2);
      }
    }

    // Rivers get a continuous pixel channel independent of the base terrain atlas.
    for (let x = -680; x <= 680; x += 10) {
      for (let y = -480; y <= 480; y += 10) {
        const r = river(x, y);
        if (r <= 0.35 || !land(x, y)) continue;
        const [sx, sy] = screen(x, y);
        if (sx < -5 || sx > 325 || sy < -5 || sy > 185) continue;
        ctx.fillRect(Math.floor(sx), Math.floor(sy), 2 + Math.floor(r * 2), 1);
      }
    }

    ctx.restore();
  }

  window.EVERGLEN_GEOGRAPHY_VISUALS = { draw };
  registry.register({ name: 'geography-visuals', priority: 279, draw });
})();
