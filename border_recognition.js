// Everglen border recognition: infer, cache and register political frontier rendering.
(() => {
  const state = window.SIM_STATE;
  if (!state) return;

  const viewport = document.getElementById('worldViewport');
  if (!viewport) return;

  const W = 320, H = 180, STEP = 35;
  const ownerKey = v => v === null || v === undefined || v === '' ? null : String(v);
  const key = (x,y) => `${Math.round(x)},${Math.round(y)}`;

  function settlementOwner(s) {
    if (!s) return null;
    return ownerKey(s.kingdomId ?? s.kingdom ?? s.factionId ?? s.faction ?? s.ownerId ?? s.owner);
  }

  function territoryOwner(x,y) {
    const t = state.territory;
    if (!t) return null;
    const k = key(x,y);
    if (Array.isArray(t)) {
      const hit = t.find(c => {
        if (!c) return false;
        const cx = Number(c.x), cy = Number(c.y);
        return Number.isFinite(cx) && Number.isFinite(cy) && Math.abs(cx-x) <= STEP*.55 && Math.abs(cy-y) <= STEP*.55;
      });
      return ownerKey(hit?.kingdomId ?? hit?.kingdom ?? hit?.factionId ?? hit?.faction ?? hit?.ownerId ?? hit?.owner);
    }
    if (typeof t === 'object') {
      const direct = t[k] ?? t[`${Math.floor(x/STEP)},${Math.floor(y/STEP)}`];
      if (typeof direct === 'string' || typeof direct === 'number') return ownerKey(direct);
      if (direct && typeof direct === 'object') return ownerKey(direct.kingdomId ?? direct.kingdom ?? direct.factionId ?? direct.faction ?? direct.ownerId ?? direct.owner);
    }
    return null;
  }

  function nearestSettlementOwner(x,y) {
    const ss = state.settlements || [];
    let best = null, bd = Infinity;
    for (const s of ss) {
      const ox = Number(s.x), oy = Number(s.y);
      if (!Number.isFinite(ox) || !Number.isFinite(oy)) continue;
      const d = (ox-x)*(ox-x) + (oy-y)*(oy-y);
      const radius = s.type === 'kingdom' ? 170 : s.type === 'city' ? 120 : 85;
      if (d <= radius*radius && d < bd) { best = s; bd = d; }
    }
    return settlementOwner(best);
  }

  function nearestOwner(x,y) {
    return territoryOwner(x,y) ?? nearestSettlementOwner(x,y) ?? (state.kingdoms?.length === 1 ? ownerKey(state.kingdoms[0].id) : null);
  }

  function kingdomInfo(id) {
    return (state.kingdoms || []).find(x => ownerKey(x.id) === ownerKey(id)) || null;
  }

  function palette(id) {
    const k = kingdomInfo(id);
    if (k?.color) return k.color;
    const n = Number.parseInt(String(id || '0').replace(/\D/g,''),10) || 0;
    const colors = ['#c96b5f','#5e8fbd','#7aa95b','#9673ad','#c39b52','#4b9b92','#b56f91','#7b7f8f','#a4774e','#5f86a8'];
    return colors[n % colors.length];
  }

  function build() {
    const cells = [], byCell = new Map(), borders = [];
    for (let gy = -760; gy <= 760; gy += STEP) {
      for (let gx = -1150; gx <= 1150; gx += STEP) {
        const owner = nearestOwner(gx,gy);
        const c = {x:gx,y:gy,owner};
        cells.push(c); byCell.set(key(gx,gy), c);
      }
    }
    for (const c of cells) {
      if (!c.owner) continue;
      for (const [dx,dy] of [[STEP,0],[0,STEP]]) {
        const n = byCell.get(key(c.x+dx,c.y+dy));
        if (!n || !n.owner || n.owner === c.owner) continue;
        borders.push({x1:c.x,y1:c.y,x2:n.x,y2:n.y,a:c.owner,b:n.owner,
          contested: !!(state.war && ((kingdomInfo(c.owner)?.atWar) || (kingdomInfo(n.owner)?.atWar)))});
      }
    }
    return {cells,borders,updatedTick:state.tick,updatedYear:state.year};
  }

  function ensureCanvas() {
    let canvas = document.getElementById('borderRecognitionCanvas');
    if (canvas) return canvas;
    canvas = document.createElement('canvas');
    canvas.id = 'borderRecognitionCanvas';
    canvas.width = W; canvas.height = H;
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none;z-index:5;';
    viewport.appendChild(canvas);
    return canvas;
  }

  function transform() {
    const z = state.camera?.zoom || 1;
    return {z, cx:160-(state.camera?.x || 0)*z/8, cy:90-(state.camera?.y || 0)*z/8};
  }
  function ws(x,y,t) { return [t.cx + x*t.z/8, t.cy + y*t.z/8]; }

  function draw() {
    const canvas = ensureCanvas(), ctx = canvas.getContext('2d');
    ctx.clearRect(0,0,W,H);
    const data = state.borderRecognition;
    if (!data || !state.showBorders) return;
    const t = transform();
    ctx.save();
    for (const b of data.borders) {
      const a=ws(b.x1,b.y1,t), c=ws(b.x2,b.y2,t);
      if ((a[0] < -5 && c[0] < -5) || (a[0] > W+5 && c[0] > W+5) || (a[1] < -5 && c[1] < -5) || (a[1] > H+5 && c[1] > H+5)) continue;
      ctx.strokeStyle = b.contested ? '#f2c65f' : palette(b.a);
      ctx.globalAlpha = b.contested ? .9 : .72;
      ctx.lineWidth = Math.max(1, Math.min(2.4, t.z*.65));
      ctx.setLineDash(b.contested ? [3,2] : [5,3]);
      ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...c); ctx.stroke();
    }
    ctx.setLineDash([]);
    if (state.selected) {
      const n = (state.npcs || []).find(x => x.id === state.selected && x.alive);
      const id = n ? nearestOwner(n.x,n.y) : null;
      if (id) {
        ctx.globalAlpha=.35; ctx.fillStyle=palette(id);
        for (const b of data.borders) if (b.a===id || b.b===id) {
          const a=ws(b.x1,b.y1,t), c=ws(b.x2,b.y2,t); ctx.beginPath(); ctx.arc((a[0]+c[0])/2,(a[1]+c[1])/2,2.2,0,Math.PI*2); ctx.fill();
        }
      }
    }
    ctx.restore();
  }

  function recalculate() {
    state.borderRecognition = build();
    const frontier = new Map();
    for (const b of state.borderRecognition.borders) {
      for (const id of [b.a,b.b]) {
        if (!frontier.has(id)) frontier.set(id,{kingdomId:id,borderLength:0,neighbors:new Set(),contested:0});
        const f=frontier.get(id); f.borderLength += STEP; f.neighbors.add(id===b.a?b.b:b.a); if(b.contested)f.contested++;
      }
    }
    state.borderRecognition.frontiers = [...frontier.values()].map(f=>({...f,neighbors:[...f.neighbors]}));
  }

  function ownerAt(x,y) { return nearestOwner(x,y); }
  function isForeign(n,x,y) {
    if (!n) return false;
    const home = ownerAt(n.x,n.y), there = ownerAt(x,y);
    return !!(home && there && home !== there);
  }
  function borderBetween(a,b) {
    const A=ownerKey(a), B=ownerKey(b); if(!A||!B||A===B) return false;
    return (state.borderRecognition?.borders||[]).some(e => (e.a===A&&e.b===B)||(e.a===B&&e.b===A));
  }

  let last= -1;
  function step(){
    if (!state.running) return;
    if (state.tick === last) return;
    last=state.tick;
    if (state.tick % 18 === 0 || !state.borderRecognition) recalculate();
  }

  state.showBorders = state.showBorders !== false;
  window.BORDER_RECOGNITION = {recalculate,draw,ownerAt,isForeign,borderBetween,nearestOwner};
  if (state.registerSystem) state.registerSystem({name:'border-recognition',step,priority:108});
  window.EVERGLEN_RENDER?.register?.({name:'border-recognition',priority:300,draw});
  recalculate();
})();
