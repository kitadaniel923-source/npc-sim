// Everglen world/border interaction: inspect political territory and expose frontier consequences to the player.
(() => {
  const state = window.SIM_STATE;
  const canvas = document.getElementById('worldCanvas');
  if (!state || !canvas || !window.BORDER_RECOGNITION) return;

  let lastInfo = null;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const point = e => {
    const r = canvas.getBoundingClientRect();
    const sx = (e.clientX-r.left)*canvas.width/Math.max(1,r.width);
    const sy = (e.clientY-r.top)*canvas.height/Math.max(1,r.height);
    const cam = state.camera || {x:0,y:0,zoom:1};
    return {x:cam.x+(sx-canvas.width/2)/Math.max(.01,cam.zoom), y:cam.y+(sy-canvas.height/2)/Math.max(.01,cam.zoom)};
  };

  function kingdom(id) { return (state.kingdoms || []).find(k => String(k.id) === String(id)); }
  function ownerName(id) { return kingdom(id)?.name || `Kingdom ${id}`; }

  function frontierFor(id) {
    return (state.borderRecognition?.frontiers || []).find(f => String(f.kingdomId) === String(id)) || null;
  }

  function nearestBorder(p) {
    let best = null, bd = Infinity;
    for (const b of state.borderRecognition?.borders || []) {
      const vx=b.x2-b.x1, vy=b.y2-b.y1;
      const len2=vx*vx+vy*vy || 1;
      const t=Math.max(0,Math.min(1,((p.x-b.x1)*vx+(p.y-b.y1)*vy)/len2));
      const qx=b.x1+t*vx, qy=b.y1+t*vy;
      const d=Math.hypot(p.x-qx,p.y-qy);
      if(d<bd){bd=d;best={border:b,distance:d};}
    }
    return best;
  }

  function popup(html) {
    let el=document.getElementById('borderInteractionPopup');
    if(!el){
      el=document.createElement('div');
      el.id='borderInteractionPopup';
      el.style.cssText='position:absolute;left:12px;top:12px;z-index:30;min-width:230px;max-width:320px;background:rgba(28,37,34,.97);color:#eee9d6;border:2px solid #17211d;box-shadow:4px 4px #17211d;padding:10px;font:11px Segoe UI,sans-serif;pointer-events:auto;';
      document.getElementById('worldViewport')?.appendChild(el);
    }
    el.innerHTML=html;
    el.style.display='block';
    clearTimeout(popup.timer); popup.timer=setTimeout(()=>{el.style.display='none';},5000);
  }

  function inspect(p) {
    const owner=window.BORDER_RECOGNITION.ownerAt(p.x,p.y);
    const b=nearestBorder(p);
    if(b && b.distance<34){
      const left=kingdom(b.border.a), right=kingdom(b.border.b);
      const aFront=frontierFor(b.border.a), bFront=frontierFor(b.border.b);
      const contested=b.border.contested;
      lastInfo={type:'border',a:b.border.a,b:b.border.b,x:p.x,y:p.y};
      popup(`<strong>⚔ Frontier</strong><div style="margin-top:6px"><b>${esc(ownerName(b.border.a))}</b> ↔ <b>${esc(ownerName(b.border.b))}</b></div><div style="margin-top:5px;color:#aeb8af">${contested?'CONTESTED BORDER':'Recognized border'}${left?.atWar||right?.atWar?' • War active':''}</div><div style="margin-top:6px">Approx. frontier: ${Math.round((aFront?.borderLength||0))} / ${Math.round((bFront?.borderLength||0))}</div><div style="margin-top:7px;color:#9eaaa0">Borders are political edges. War, settlement growth and player actions can change them.</div>`);
      state.selectedBorder=lastInfo;
      return true;
    }
    if(owner){
      const k=kingdom(owner), f=frontierFor(owner);
      lastInfo={type:'territory',kingdomId:owner,x:p.x,y:p.y};
      popup(`<strong>🏰 Territory</strong><div style="margin-top:6px"><b>${esc(k?.name||ownerName(owner))}</b></div><div style="margin-top:5px">Power ${Math.round(k?.power||0)} • Legitimacy ${Math.round(k?.legitimacy||0)} • Tension ${Math.round(k?.tension||0)}</div><div style="margin-top:4px">Neighbors: ${Math.max(0,(f?.neighbors||[]).length)}</div><div style="margin-top:4px">Frontier: ${Math.round(f?.borderLength||0)} world-units</div>`);
      state.selectedBorder=lastInfo;
      return true;
    }
    state.selectedBorder=null;
    return false;
  }

  function addToggle(){
    const actions=document.querySelector('.toolbar-actions');
    if(!actions || document.getElementById('toggleBorders')) return;
    const b=document.createElement('button');
    b.id='toggleBorders'; b.textContent=state.showBorders===false?'◇ Borders':'◇ Borders';
    b.title='Show or hide recognized kingdom borders';
    b.addEventListener('click',()=>{state.showBorders=state.showBorders===false; b.textContent=state.showBorders?'◇ Borders':'◇ Borders'; window.BORDER_RECOGNITION.draw();});
    actions.appendChild(b);
  }

  canvas.addEventListener('click',e=>{
    if(state.godMode) return;
    const p=point(e);
    inspect(p);
  },false);

  window.EVERGLEN_BORDER_INTERACTION={inspect,nearestBorder,get selected(){return lastInfo;}};
  addToggle(); setTimeout(addToggle,0);
})();
