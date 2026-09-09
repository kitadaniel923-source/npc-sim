// Everglen NPC age visual layer.
// Visual-only: reads authoritative NPC age and adds tiny low-resolution age cues.
(() => {
  const state = window.SIM_STATE;
  const registry = window.EVERGLEN_RENDER;
  if (!state || !registry) return;

  const ageBand = age => {
    const a = Number.isFinite(Number(age)) ? Number(age) : 30;
    if (a < 13) return 'child';
    if (a < 18) return 'teen';
    if (a < 40) return 'adult';
    if (a < 60) return 'mature';
    return 'elder';
  };

  const visualScale = band => ({child:.72, teen:.86, adult:1, mature:.98, elder:.94}[band] || 1);

  const hash = (value, salt = 0) => {
    let h = 2166136261 >>> 0;
    const text = `${value}|${salt}`;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0) / 4294967296;
  };

  const landAt = (x, y) => {
    const nx = x / 1150, ny = y / 760;
    const blobs = [[.16,-.18,.34,.38],[.56,-.22,.39,.30],[.78,.12,.25,.42],[.36,.30,.34,.34],[.05,.43,.24,.27],[-.36,.15,.35,.43],[-.62,-.25,.23,.28]];
    for (const [cx, cy, rx, ry] of blobs) {
      const dx = (nx - cx) / rx, dy = (ny - cy) / ry;
      if (dx * dx + dy * dy < 1) return true;
    }
    return false;
  };

  const transform = () => {
    const z = state.camera.zoom || 1;
    return { z, cx: 160 - state.camera.x * z / 8, cy: 90 - state.camera.y * z / 8 };
  };

  function drawAgeCue(ctx, n, sx, sy, baseSize) {
    const band = ageBand(n.age);
    const scale = visualScale(band);
    const seed = hash(n.id || `${n.x}:${n.y}`, 29);
    const width = Math.max(5, baseSize * scale);
    const top = sy - width * scale;
    const jitter = (seed - .5) * 2;

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.lineWidth = 1;

    // A very small ground shadow reinforces the age-dependent body scale without
    // replacing the race/profession artwork underneath it.
    ctx.globalAlpha = .18;
    ctx.fillStyle = '#111';
    ctx.fillRect(Math.round(sx - width * .32), Math.round(sy - 1), Math.max(3, Math.round(width * .64)), 1);
    ctx.globalAlpha = 1;

    if (band === 'child') {
      // Small satchel/hood cue. Kept deliberately tiny at the game's internal resolution.
      ctx.fillStyle = '#d8b46a';
      ctx.fillRect(Math.round(sx + width * .28), Math.round(sy - width * .48), 2, 2);
      ctx.fillStyle = '#f0d59a';
      ctx.fillRect(Math.round(sx - 1 + jitter), Math.round(top + 2), 2, 1);
    } else if (band === 'teen') {
      // A narrow shoulder sash distinguishes the transitional age band without
      // changing the underlying race or profession art.
      ctx.fillStyle = seed > .5 ? '#b86f58' : '#5d7891';
      ctx.fillRect(Math.round(sx - width * .36), Math.round(sy - width * .60), 1, Math.max(2, Math.round(width * .24)));
    } else if (band === 'mature') {
      // Mature NPCs receive a restrained collar/shoulder highlight.
      ctx.fillStyle = '#d7c18a';
      ctx.fillRect(Math.round(sx - width * .30), Math.round(sy - width * .73), 2, 1);
    } else if (band === 'elder') {
      // Elder cue: a tiny pale hair highlight and walking-stick pixel cluster.
      ctx.fillStyle = '#c9c9c0';
      ctx.fillRect(Math.round(sx - 2 + jitter), Math.round(top + 1), 2, 1);
      ctx.fillRect(Math.round(sx - width * .45), Math.round(sy - width * .58), 1, 2);
      ctx.fillRect(Math.round(sx - width * .45), Math.round(sy - width * .36), 1, 2);
      ctx.fillRect(Math.round(sx - width * .45), Math.round(sy - width * .14), 1, 2);
    }

    ctx.restore();
    return { band, scale };
  }

  function draw() {
    if (!state.camera || !Array.isArray(state.npcs)) return;
    const canvas = document.getElementById('worldCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const t = transform();

    state.npcs.forEach(n => {
      if (!n.alive || !landAt(n.x, n.y)) return;
      const sx = t.cx + n.x * t.z / 8;
      const sy = t.cy + n.y * t.z / 8;
      if (sx < -14 || sx > 334 || sy < -14 || sy > 194) return;
      const military = ['militia','soldier','archer','spearman','cavalry','knight','paladin','captain','general','marshal'].includes(n.roleId);
      const baseSize = military ? 16 : 12;
      drawAgeCue(ctx, n, sx, sy, baseSize);
    });
  }

  window.EVERGLEN_AGE_VISUALS = { ageBand, visualScale };
  registry.register({ name:'npc-age-visuals', priority:275, draw });
})();
