// Everglen canvas ownership layer.
// Owns the world2dCanvas and preserves the EVERGLEN_2D_ART compatibility API.
(() => {
  'use strict';
  const state = window.SIM_STATE;
  if (!state) return;

  const base = document.getElementById('worldCanvas');
  const viewport = document.getElementById('worldViewport');
  if (!base || !viewport) return;

  // Keep the proven simulation canvas visible until imported assets are genuinely
  // ready. The Pixel Crawler renderer hides it only after its atlas is available.
  base.style.opacity = '1';
  base.style.pointerEvents = 'auto';

  const old = document.getElementById('world2dCanvas');
  if (old) old.remove();

  const canvas = document.createElement('canvas');
  canvas.id = 'world2dCanvas';
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;image-rendering:pixelated;pointer-events:none;';
  viewport.appendChild(canvas);

  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.imageSmoothingEnabled = false;

  function resize() {
    const r = viewport.getBoundingClientRect();
    canvas.width = 320;
    canvas.height = 180;
    canvas.style.width = Math.max(1, r.width) + 'px';
    canvas.style.height = Math.max(1, r.height) + 'px';
    ctx.imageSmoothingEnabled = false;
  }

  function draw() {
    // Canvas ownership only. Render stages own all pixels.
  }

  window.EVERGLEN_2D_ART = { canvas, ctx, draw, resize };
  window.EVERGLEN_WORLD_CANVAS = canvas;
  window.addEventListener('resize', resize, { passive: true });
  if (window.ResizeObserver) new ResizeObserver(resize).observe(viewport);
  resize();
})();
