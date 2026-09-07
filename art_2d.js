(() => {
  const state = window.SIM_STATE;
  if (!state) return;

  const base = document.getElementById('worldCanvas');
  const viewport = document.getElementById('worldViewport');
  if (!base || !viewport) return;

  base.style.opacity = '0';

  const canvas = document.createElement('canvas');
  canvas.id = 'world2dCanvas';
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none;image-rendering:auto;';
  viewport.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const randPick=a=>a[Math.floor(Math.random()*a.length)];
  const alive=()=>state.npcs.filter(n=>n.alive);
  const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const terrainAt=(x,y)=>{
    const wx=Math.round(x), wy=Math.round(y);
    if (typeof window.EVERGLEN_WORLD?.biomeAt === 'function') return window.EVERGLEN_WORLD.biomeAt(wx,wy);
    return 'plains';
  };

  const PAL={
    plains:'#5e8f54', forest:'#3f7548', highlands:'#6f776c', wetlands:'#4f8477', steppe:'#a08d54', coast:'#3f718c'
  };
  const WATER='#356f86';
  const ROAD='#876b4e';

  function resize(){
    const r=viewport.getBoundingClientRect(),d=window.devicePixelRatio||1;
    canvas.width=Math.max(1,Math.floor(r.width*d));
    canvas.height=Math.max(1,Math.floor(r.height*d));
    ctx.setTransform(d,0,0,d,0,0);
  }

  function screenTransform(){
    const w=canvas.clientWidth,h=canvas.clientHeight,z=state.camera.zoom;
    return {w,h,z,cx:w/2-state.camera.x*z,cy:h/2-state.camera.y*z};
  }

  function drawWaterAndTiles(t){
    const {w,h,z,cx,cy}=t;
    ctx.save();
    ctx.fillStyle=WATER;
    ctx.fillRect(0,0,w,h);
    ctx.translate(cx,cy);ctx.scale(z,z);

    const tile=48, left=-state.camera.x-w/(2*z)-tile, right=-state.camera.x+w/(2*z)+tile;
    const top=-state.camera.y-h/(2*z)-tile, bottom=-state.camera.y+h/(2*z)+tile;
    const sx=Math.floor(left/tile)*tile, sy=Math.floor(top/tile)*tile;

    for(let x=sx;x<right;x+=tile){
      for(let y=sy;y<bottom;y+=tile){
        const b=terrainAt(x,y);
        ctx.fillStyle=PAL[b]||PAL.plains;
        ctx.fillRect(x,y,tile+1,tile+1);
        ctx.globalAlpha=.13;
        ctx.fillStyle=b==='forest'?'#193c27':b==='highlands'?'#263128':b==='wetlands'?'#214b45':b==='steppe'?'#6c572c':'#31512f';
        if(b==='forest'){
          for(let i=0;i<3;i++){const px=x+9+(i*13+(Math.abs(x+y)%7)),py=y+12+(i*11);ctx.beginPath();ctx.arc(px,py,5,0,Math.PI*2);ctx.fill()}
        }else if(b==='highlands'){
          ctx.beginPath();ctx.moveTo(x+8,y+38);ctx.lineTo(x+22,y+13);ctx.lineTo(x+35,y+38);ctx.fill();
        }else if(b==='wetlands'){
          for(let i=0;i<3;i++){ctx.fillRect(x+6+i*13,y+30+(i%2)*6,8,2)}
        }
        ctx.globalAlpha=1;
      }
    }

    ctx.restore();
  }

  function drawRiver(t){
    const {w,h,z,cx,cy}=t;
    ctx.save();ctx.translate(cx,cy);ctx.scale(z,z);
    const start=-1400,end=1400;
    ctx.strokeStyle='#427f9a';ctx.lineWidth=25;ctx.lineCap='round';
    ctx.beginPath();
    for(let x=start;x<=end;x+=18){const y=Math.sin(x/180)*100+80; if(x===start)ctx.moveTo(x,y);else ctx.lineTo(x,y)}
    ctx.stroke();
    ctx.strokeStyle='#63a6bd';ctx.lineWidth=9;
    ctx.beginPath();
    for(let x=start;x<=end;x+=18){const y=Math.sin(x/180)*100+80; if(x===start)ctx.moveTo(x,y);else ctx.lineTo(x,y)}
    ctx.stroke();
    ctx.restore();
  }

  function drawGeneratedResources(t){
    const {z,cx,cy}=t;
    const nodes=state.worldGen?.resources||[];
    ctx.save();ctx.translate(cx,cy);ctx.scale(z,z);
    nodes.forEach(n=>{
      if(n.depleted)return;
      ctx.globalAlpha=.72;
      const s=n.type==='gold'?'#e7c65b':n.type==='iron'?'#9aa2ab':n.type==='stone'?'#a8a39a':n.type==='wood'?'#6d9a5a':n.type==='medicine'?'#c87ab6':n.type==='reagents'?'#aa86d7':'#8acb6c';
      ctx.fillStyle=s;
      ctx.beginPath();ctx.arc(n.x,n.y,4,0,Math.PI*2);ctx.fill();
      ctx.globalAlpha=.35;ctx.beginPath();ctx.arc(n.x,n.y,8,0,Math.PI*2);ctx.strokeStyle=s;ctx.stroke();ctx.globalAlpha=1;
    });
    ctx.restore();
  }

  function drawRoads(t){
    const {z,cx,cy}=t;
    ctx.save();ctx.translate(cx,cy);ctx.scale(z,z);
    state.roads.forEach(r=>{
      if(!r.path||r.path.length<2)return;
      ctx.strokeStyle=ROAD;ctx.globalAlpha=.82;ctx.lineWidth=5;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(r.path[0].x,r.path[0].y);r.path.slice(1).forEach(p=>ctx.lineTo(p.x,p.y));ctx.stroke();
      ctx.globalAlpha=.35;ctx.lineWidth=2;ctx.strokeStyle='#b99a70';ctx.beginPath();ctx.moveTo(r.path[0].x,r.path[0].y);r.path.slice(1).forEach(p=>ctx.lineTo(p.x,p.y));ctx.stroke();ctx.globalAlpha=1;
    });
    ctx.restore();
  }

  function drawSettlement(s,t){
    const {z,cx,cy}=t;ctx.save();ctx.translate(cx,cy);ctx.scale(z,z);
    const pop=state.npcs.filter(n=>n.alive&&n.settlementId===s.id).length;
    const scale=s.type==='kingdom'?1.55:s.type==='city'?1.3:1;
    const size=14*scale;
    ctx.fillStyle='rgba(38,28,22,.28)';ctx.beginPath();ctx.ellipse(s.x,s.y+size*.65,size*1.35,size*.55,0,0,Math.PI*2);ctx.fill();
    const count=clamp(Math.floor(2+pop/16),2,9);
    for(let i=0;i<count;i++){
      const a=(i/count)*Math.PI*2, rr=size*(.55+(i%2)*.28),x=s.x+Math.cos(a)*rr,y=s.y+Math.sin(a)*rr*.65;
      ctx.fillStyle=s.architecture==='stone'?'#706d67':s.architecture==='wood'?'#725439':s.architecture==='mud'?'#9b7650':'#8a7563';
      ctx.fillRect(x-5,y-4,10,8);ctx.fillStyle='#b94f43';ctx.beginPath();ctx.moveTo(x-7,y-4);ctx.lineTo(x,y-10);ctx.lineTo(x+7,y-4);ctx.closePath();ctx.fill();
    }
    ctx.fillStyle=s.type==='kingdom'?'#e7c866':s.type==='city'?'#c5a2e5':'#9ed080';
    ctx.fillRect(s.x-size*.18,s.y-size*.65,size*.36,size*.9);
    ctx.fillStyle='#e8e2cf';ctx.fillRect(s.x-size*.13,s.y-size*.83,size*.26,size*.2);
    ctx.fillStyle='#ece8dd';ctx.font=`${Math.max(9,Math.round(10/Math.max(.8,z)))}px Segoe UI`;ctx.textAlign='center';ctx.fillText(s.name,s.x,s.y-size-7);ctx.textAlign='start';
    ctx.restore();
  }

  function drawNPC(n,t){
    const {z,cx,cy}=t;ctx.save();ctx.translate(cx+n.x*z,cy+n.y*z);ctx.scale(z,z);
    const v=n.visual||{};
    const age=n.ageBand || v.ageBand || (n.age<13?'child':n.age<18?'teen':n.age<45?'adult':n.age<65?'mature':'elder');
    const size=age==='child'?5:age==='teen'?6:age==='elder'?7:7;
    const trait=n.traits||[n.trait];
    let skin=v.skin||'#b97950',hair=v.hair||'#2a211d',cloth='#68886d';
    if(['royal'].includes(v.outfit)||n.classTier==='royal')cloth='#c5a044';
    else if(['noble'].includes(v.outfit)||n.classTier==='noble')cloth='#9473a7';
    else if(v.outfit==='merchant')cloth='#5e779b';
    else if(v.outfit==='military')cloth='#5d6e78';
    else if(v.outfit==='worker')cloth='#80634d';
    ctx.globalAlpha=.22;ctx.fillStyle='#1d271f';ctx.beginPath();ctx.ellipse(0,7,size*.9,size*.4,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
    ctx.fillStyle=cloth;ctx.beginPath();ctx.roundRect(-size*.65,-1,size*1.3,size*1.35,2);ctx.fill();
    ctx.fillStyle=skin;ctx.beginPath();ctx.arc(0,-size*.72,size*.52,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=hair;ctx.beginPath();ctx.arc(0,-size*.86,size*.58,Math.PI,Math.PI*2);ctx.fill();
    if(age==='elder'){ctx.strokeStyle='#ddd';ctx.lineWidth=1;ctx.beginPath();ctx.arc(0,-size*.72,size*.55,0,Math.PI*2);ctx.stroke()}
    if(trait.includes('giant')){ctx.strokeStyle='#dfbd66';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(0,-1,size*1.45,0,Math.PI*2);ctx.stroke()}
    if(trait.includes('dwarf'))ctx.scale(.78,.86);
    if(trait.includes('immortal')||trait.includes('blessed')){ctx.strokeStyle='#f4db6b';ctx.globalAlpha=.55;ctx.beginPath();ctx.arc(0,-1,size*1.25,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1}
    if(v.weapon||['soldier','knight','captain','general','marshal','duelist','marksman','ranger'].includes(n.roleId)){ctx.strokeStyle='#d6d6d6';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(size*.55,1);ctx.lineTo(size*1.15,-size*1.05);ctx.stroke()}
    if(v.mount){ctx.fillStyle='#775840';ctx.beginPath();ctx.ellipse(0,7,size*1.5,size*.65,0,0,Math.PI*2);ctx.fill()}
    if(n.id===state.selected){ctx.strokeStyle='#fff';ctx.lineWidth=1.7;ctx.beginPath();ctx.arc(0,-1,size*1.35,0,Math.PI*2);ctx.stroke()}
    ctx.restore();
  }

  function drawLandmarks(t){
    const {z,cx,cy}=t;ctx.save();ctx.translate(cx,cy);ctx.scale(z,z);
    (state.worldGen?.landmarks||[]).forEach(l=>{
      ctx.fillStyle=l.discovered?'#d7b45e':'#8b8c83';ctx.globalAlpha=l.discovered?.9:.7;
      ctx.fillRect(l.x-5,l.y-5,10,10);ctx.strokeStyle='#312d25';ctx.strokeRect(l.x-6,l.y-6,12,12);
      if(z>.8){ctx.fillStyle='#eee7d4';ctx.font='8px Segoe UI';ctx.fillText(l.name,l.x+8,l.y+3)}
    });ctx.restore();
  }

  function draw(){
    resize();
    const t=screenTransform();
    ctx.clearRect(0,0,canvas.clientWidth,canvas.clientHeight);
    drawWaterAndTiles(t);drawRiver(t);drawGeneratedResources(t);drawRoads(t);drawLandmarks(t);
    state.settlements.forEach(s=>drawSettlement(s,t));
    state.caravans.forEach(c=>{ctx.save();const x=t.cx+c.x*t.z,y=t.cy+c.y*t.z;ctx.fillStyle='#e8be58';ctx.fillRect(x-3,y-3,7,5);ctx.restore()});
    alive().forEach(n=>drawNPC(n,t));
  }

  window.EVERGLEN_2D_ART={canvas,draw,resize};
  window.addEventListener('resize',draw);
  setInterval(()=>{if(state.running)draw()},160);
  draw();
})();
