(() => {
  const state = window.SIM_STATE;
  if (!state) return;

  const STYLE = `
    .topbar{top:10px;left:10px;right:10px;z-index:90;pointer-events:none}
    .brand{background:linear-gradient(180deg,rgba(25,36,31,.96),rgba(18,27,24,.96));border:2px solid #111a17;box-shadow:4px 4px #111a17;padding:7px 11px}
    .brand-mark{font-size:20px}.brand h1{font-size:17px;letter-spacing:1px;text-shadow:2px 2px #111a17}
    .controls{position:fixed;left:50%;bottom:12px;transform:translateX(-50%);z-index:1000;max-width:calc(100vw - 24px);overflow-x:auto;overflow-y:hidden;padding:7px;background:rgba(18,27,24,.96);border:2px solid #111a17;box-shadow:4px 4px #111a17;border-radius:6px;gap:5px}
    .controls button{white-space:nowrap;font-size:10px;padding:6px 8px}.speed-control{white-space:nowrap}
    .stats-bar{top:58px;left:10px;z-index:90;background:rgba(18,27,24,.92);border-color:#111a17;box-shadow:3px 3px #111a17}
    .world-toolbar{bottom:72px;background:rgba(18,27,24,.94);border-color:#111a17;box-shadow:3px 3px #111a17}
    .side{bottom:68px}
    #everglenStart{position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle at 50% 36%,rgba(71,105,78,.30),rgba(8,14,12,.96) 60%),#0b1110;color:#f2f0dc}
    #everglenStart .card{width:min(560px,calc(100vw - 36px));padding:34px;background:rgba(18,27,24,.97);border:3px solid #111a17;box-shadow:8px 8px #060a09;text-align:center}
    #everglenStart .sigil{font-size:42px;color:#e6c35d;margin-bottom:4px}
    #everglenStart h1{font:700 34px Georgia,serif;letter-spacing:2px;margin:0 0 6px;color:#f2f0dc}
    #everglenStart .sub{font:11px monospace;color:#9eaaa0;margin-bottom:26px}
    #everglenStart .save{font:10px monospace;color:#d7dfd4;margin:0 0 18px}
    #everglenStart .actions{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
    #everglenStart button{min-width:190px;padding:11px 15px;font-size:11px}
    #everglenStart .new{background:#5b8f59;border-color:#294b2d}.continue{background:#3a4a43}
    #everglenStart .note{margin-top:22px;font:8px monospace;color:#6f7d73}
    #worldPolishCanvas{position:absolute;inset:0;width:100%;height:100%;display:block;image-rendering:pixelated;pointer-events:none}
  `;
  const style = document.createElement('style'); style.id='everglenDesktopPolish'; style.textContent=STYLE; document.head.appendChild(style);

  state.running = false;
  const oldCanvas = document.getElementById('world2dCanvas');
  if (oldCanvas) oldCanvas.style.display='none';
  const viewport = document.getElementById('worldViewport');
  if (!viewport) return;
  let canvas = document.getElementById('worldPolishCanvas');
  if (!canvas) { canvas=document.createElement('canvas'); canvas.id='worldPolishCanvas'; viewport.appendChild(canvas); }
  const ctx=canvas.getContext('2d'); ctx.imageSmoothingEnabled=false;
  const W=320,H=180;
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
  const hash=(x,y,s=17)=>{const v=Math.sin(x*12.9898+y*78.233+s*37.719)*43758.5453;return v-Math.floor(v)};
  const noise=(x,y)=>{const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;const a=hash(ix,iy),b=hash(ix+1,iy),c=hash(ix,iy+1),d=hash(ix+1,iy+1);const u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy);return a+(b-a)*u+((c+(d-c)*u)-(a+(b-a)*u))*v};
  const landAt=(x,y)=>{const nx=x/1150,ny=y/760;const blobs=[[.16,-.18,.34,.38],[.56,-.22,.39,.30],[.78,.12,.25,.42],[.36,.30,.34,.34],[.05,.43,.24,.27],[-.36,.15,.35,.43],[-.62,-.25,.23,.28]];for(const [cx,cy,rx,ry] of blobs){const dx=(nx-cx)/rx,dy=(ny-cy)/ry,d=dx*dx+dy*dy;if(d<1&&d+noise(x/110,y/110)*.16<1.06)return true}return false};
  const biomeAt=(x,y)=>{if(!landAt(x,y))return'water';const n=noise(x/170,y/170),q=noise(x/65+8,y/65+3);if(y>310||(n>.72&&q>.55))return'snow';if(n<.23)return'forest';if(n>.82)return'mountain';if(q<.2)return'plains';return n>.58?'meadow':'plains'};
  const C={water:'#276f91',water2:'#1e5c7b',foam:'#76b9ca',plains:'#799f4f',meadow:'#6f9b51',forest:'#3d7445',forest2:'#2b5e38',mount:'#717974',mount2:'#565f5c',snow:'#d7e1df',sand:'#c9ae6b',dirt:'#8b6547',wood:'#7a563d',roof:'#8d473b',stone:'#747976',outline:'#1c2924',white:'#f4efd9',gold:'#e7c65e',skin:'#b87952',hair:'#29231f'};
  const transform=()=>{const z=state.camera.zoom||1;return{z,cx:160-state.camera.x*z/8,cy:90-state.camera.y*z/8}};
  const ws=(x,y,t)=>[t.cx+x*t.z/8,t.cy+y*t.z/8];
  function resize(){const r=viewport.getBoundingClientRect();canvas.width=W;canvas.height=H;canvas.style.width=Math.max(1,r.width)+'px';canvas.style.height=Math.max(1,r.height)+'px'}
  function rect(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h))}
  function terrain(t){rect(0,0,W,H,C.water);for(let sy=0;sy<H;sy+=2){for(let sx=0;sx<W;sx+=2){const wx=(sx-t.cx)*8/t.z,wy=(sy-t.cy)*8/t.z,b=biomeAt(wx,wy);if(b==='water'){const a=((Math.floor((sx+sy)/9)+Math.floor(state.tick/8))%4===0);rect(sx,sy,2,2,a?C.foam:C.water2);if(a&&sx%7<3)rect(sx+1,sy,3,1,C.water);continue}const n=hash(Math.floor(wx/7),Math.floor(wy/7),4);let c=C.plains;if(b==='meadow')c=C.meadow;if(b==='forest')c=n>.5?C.forest:C.forest2;if(b==='mountain')c=n>.5?C.mount:C.mount2;if(b==='snow')c=n>.5?C.snow:'#b8cac7';rect(sx,sy,2,2,c);if(b==='forest'&&n>.35){rect(sx,sy,2,1,C.forest);rect(sx+1,sy+1,1,2,C.forest2)}else if(b==='mountain'&&n>.35){rect(sx,sy,2,1,C.snow);rect(sx+2,sy+1,1,2,C.mount2)}else if(b==='plains'&&n>.9)rect(sx+1,sy,1,1,C.sand)}}for(let sy=0;sy<H;sy+=2)for(let sx=0;sx<W;sx+=2){const wx=(sx-t.cx)*8/t.z,wy=(sy-t.cy)*8/t.z;if(landAt(wx,wy)&&[landAt(wx+10,wy),landAt(wx-10,wy),landAt(wx,wy+10),landAt(wx,wy-10)].some(v=>!v))rect(sx,sy,2,2,C.sand)}}
  function roads(t){ctx.strokeStyle=C.outline;state.roads?.forEach(r=>{if(!r.path||r.path.length<2)return;for(let i=1;i<r.path.length;i++){const a=ws(r.path[i-1].x,r.path[i-1].y,t),b=ws(r.path[i].x,r.path[i].y,t);ctx.lineWidth=1.6;ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke();ctx.strokeStyle=C.dirt;ctx.lineWidth=.8;ctx.stroke();ctx.strokeStyle=C.outline}})}
  function building(x,y,kind,scale){const s=Math.max(1,Math.round(scale));rect(x-5*s,y-3*s,10*s,7*s,C.outline);rect(x-4*s,y-2*s,8*s,5*s,kind?'#777b78':C.wood);rect(x-5*s,y-3*s,10*s,2*s,kind?C.stone:C.roof);rect(x-1*s,y+1*s,2*s,3*s,C.dirt)}
  function settlement(s,t){const [x,y]=ws(s.x,s.y,t);if(x<-35||x>355||y<-30||y>210)return;const pop=state.npcs.filter(n=>n.alive&&n.settlementId===s.id).length;const sc=s.type==='kingdom'?1.45:s.type==='city'?1.2:.9;const count=Math.max(3,Math.min(8,2+Math.floor(pop/14)));for(let i=0;i<count;i++)building(x+((i*17)%25)-12,y+((i*11)%15)-6,i%3===0&&sc>1,sc);if(s.type==='kingdom'||s.type==='city'){rect(x-2,y-12,4,8,C.outline);rect(x-1,y-11,2,6,C.gold);rect(x-5,y-14,10,2,s.type==='kingdom'?C.gold:'#866aa2')}if(state.showNames!==false){const label=s.name||'Settlement';ctx.font='7px monospace';ctx.textAlign='center';const tw=Math.min(95,ctx.measureText(label).width+12);rect(x-tw/2,y-27,tw,11,'rgba(15,22,19,.94)');rect(x-tw/2,y-27,tw,1,C.gold);ctx.fillStyle=C.white;ctx.fillText(label,x,y-19);ctx.textAlign='left'}}
  function npc(n,t){const [x,y]=ws(n.x,n.y,t);if(x<-15||x>335||y<-15||y>195)return;const v=n.visual||{},role=n.roleId||'citizen',child=(n.ageBand==='child'||n.age<13),sold=['soldier','knight','captain','general','marshal','archer','spearman','cavalry'].includes(role),roy=['king','emperor','heir'].includes(role)||v.outfit==='royal';const scale=child?.72:1;const ox=Math.round(x),oy=Math.round(y);rect(ox-3,oy+3,7*scale,7*scale,C.outline);rect(ox-2,oy+3,5*scale,4*scale,sold?'#5a7291':roy?C.gold:v.outfit==='merchant'?'#5f8159':'#80684f');rect(ox-1,oy-1,3*scale,4*scale,v.skin||C.skin);rect(ox-1,oy-2,4*scale,2*scale,v.hair||C.hair);rect(ox-2,oy+9*scale,2*scale,2*scale,C.outline);rect(ox+2,oy+9*scale,2*scale,2*scale,C.outline);if(roy){rect(ox-3,oy-5,7,1,C.gold);rect(ox-2,oy-4,1,2,C.gold);rect(ox+2,oy-4,1,2,C.gold)}else if(v.outfit==='noble'){rect(ox-3,oy-3,7,1,'#b592c7')}if(sold){rect(ox+4,oy+1,1,8,C.outline);rect(ox+5,oy,1,6,C.white)}if(n.id===state.selected){ctx.strokeStyle=C.white;ctx.lineWidth=1;ctx.strokeRect(ox-6,oy-7,13,17)}if(state.showNames!==false&&state.camera.zoom>1.15&&n.id===state.selected){ctx.font='7px monospace';ctx.textAlign='center';ctx.fillStyle=C.white;ctx.fillText(n.name||'NPC',ox,oy-9);ctx.textAlign='left'}}
  function draw(){resize();const t=transform();terrain(t);roads(t);state.settlements?.forEach(s=>settlement(s,t));state.npcs.filter(n=>n.alive).forEach(n=>npc(n,t))}
  window.EVERGLEN_POLISH_RENDER={draw};
  if(window.EVERGLEN_RENDER?.register)window.EVERGLEN_RENDER.register({name:'desktop-polish-world',priority:900,draw});
  window.addEventListener('resize',draw);

  // Keep NPCs on the same land mask used by the polished renderer. This runs after normal AI movement.
  function nearestLand(x,y){if(landAt(x,y))return{x,y};for(let r=20;r<=180;r+=20){for(let a=0;a<16;a++){const q=a*Math.PI/8,px=x+Math.cos(q)*r,py=y+Math.sin(q)*r;if(landAt(px,py))return{x:px,y:py}}}return{x:0,y:0}}
  if(state.registerSystem)state.registerSystem({name:'surface-safety',priority:990,step(){if(!state.running)return;for(const n of state.npcs||[]){if(!n.alive)continue;if(!landAt(n.x,n.y)){const p=nearestLand(n.x,n.y);n.x=p.x;n.y=p.y;n.target=null}}}});

  function startScreen(){
    if(document.getElementById('everglenStart'))return;
    const hasSave=!!state.hasSave?.();
    const overlay=document.createElement('div');overlay.id='everglenStart';
    overlay.innerHTML=`<div class="card"><div class="sigil">✦</div><h1>EVERGLEN</h1><div class="sub">A living medieval world</div><p class="save">${hasSave?'A saved world is available. No world will be opened until you choose one.':'No saved world found. Create your first world.'}</p><div class="actions"><button class="new" id="everglenNew">🌱 New World</button>${hasSave?'<button class="continue" id="everglenContinue">📜 Continue Saved World</button>':''}</div><div class="note">Your world only begins when you choose.</div></div>`;
    document.body.appendChild(overlay);
    const finish=()=>{state.running=true;overlay.remove();window.SIM_RENDER?.();};
    document.getElementById('everglenNew').addEventListener('click',()=>{const b=document.querySelector('[data-event="reset"]');if(b)b.click();state.running=true;finish()});
    const c=document.getElementById('everglenContinue');if(c)c.addEventListener('click',()=>{state.loadWorld?.();finish()});
  }
  startScreen();
})();
