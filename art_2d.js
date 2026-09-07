(() => {
  const state = window.SIM_STATE;
  if (!state) return;

  const base = document.getElementById('worldCanvas');
  const viewport = document.getElementById('worldViewport');
  if (!base || !viewport) return;

  base.style.opacity = '0';
  base.style.pointerEvents = 'auto';

  const old = document.getElementById('world2dCanvas');
  if (old) old.remove();

  const canvas = document.createElement('canvas');
  canvas.id = 'world2dCanvas';
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;image-rendering:pixelated;pointer-events:none;';
  viewport.appendChild(canvas);
  const ctx = canvas.getContext('2d', { alpha:false });
  ctx.imageSmoothingEnabled = false;

  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const alive=()=>state.npcs.filter(n=>n.alive);
  const hash=(x,y,s=17)=>{const v=Math.sin(x*12.9898+y*78.233+s*37.719)*43758.5453;return v-Math.floor(v)};
  const noise=(x,y)=>{
    const ix=Math.floor(x), iy=Math.floor(y), fx=x-ix, fy=y-iy;
    const a=hash(ix,iy),b=hash(ix+1,iy),c=hash(ix,iy+1),d=hash(ix+1,iy+1);
    const u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy);
    return a+(b-a)*u+((c+(d-c)*u)-(a+(b-a)*u))*v;
  };
  const landAt=(x,y)=>{
    const nx=x/1150, ny=y/760;
    const blobs=[
      [0.16,-0.18,0.34,0.38],[0.56,-0.22,0.39,0.30],[0.78,0.12,0.25,0.42],
      [0.36,0.30,0.34,0.34],[0.05,0.43,0.24,0.27],[-0.36,0.15,0.35,0.43],[-0.62,-0.25,0.23,0.28]
    ];
    for(const [cx,cy,rx,ry] of blobs){
      const dx=(nx-cx)/rx,dy=(ny-cy)/ry;
      const d=dx*dx+dy*dy;
      if(d<1 && d+noise(x/110,y/110)*.16<1.06) return true;
    }
    return false;
  };
  const biomeAt=(x,y)=>{
    if(!landAt(x,y)) return 'water';
    const n=noise(x/170,y/170), q=noise(x/65+8,y/65+3);
    if(y>310 || (n>.72 && q>.55)) return 'snow';
    if(n<.23) return 'forest';
    if(n>.82) return 'mountain';
    if(q<.2) return 'plains';
    return n>.58?'meadow':'plains';
  };

  const C={
    water:'#3f88ad', water2:'#34799d', waterHi:'#63a9c4',
    plains:'#86ad55', meadow:'#78a75a', forest:'#4e874d', forestDark:'#31653e',
    mountain:'#858c83', mountainDark:'#5f6965', snow:'#dfe6e5', snowShade:'#b8c9cb',
    sand:'#d2bc78', dirt:'#a4774e', road:'#876343', roadHi:'#b28a5d',
    outline:'#29352f', wood:'#7b563c', roof:'#8f493c', stone:'#777b77',
    white:'#f2f0dc', gold:'#e6c35d', red:'#bd5549', blue:'#5485b8',
    purple:'#876da7', green:'#5f9b5b'
  };

  function resize(){
    const r=viewport.getBoundingClientRect();
    canvas.width=320; canvas.height=180;
    canvas.style.width=Math.max(1,r.width)+'px'; canvas.style.height=Math.max(1,r.height)+'px';
  }

  function transform(){
    const z=state.camera.zoom||1;
    return {z,cx:160-state.camera.x*z/8,cy:90-state.camera.y*z/8};
  }

  function pxRect(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));}
  function worldToScreen(x,y,t){return [t.cx+x*t.z/8,t.cy+y*t.z/8];}

  function drawTerrain(t){
    ctx.fillStyle=C.water;ctx.fillRect(0,0,320,180);
    const tile=4;
    for(let sy=0;sy<180;sy+=tile){
      for(let sx=0;sx<320;sx+=tile){
        const wx=(sx-t.cx)*8/t.z, wy=(sy-t.cy)*8/t.z;
        const b=biomeAt(wx,wy);
        if(b==='water'){
          const wave=(Math.floor((sx+sy)/12)+Math.floor(state.tick/18))%3===0;
          pxRect(sx,sy,tile,tile,wave?C.waterHi:C.water2);
          if(wave)pxRect(sx+1,sy+1,2,1,C.waterHi);
          continue;
        }
        const n=hash(Math.floor(wx/8),Math.floor(wy/8),4);
        let col=C.plains;
        if(b==='meadow')col=C.meadow;
        if(b==='forest')col=n>.55?C.forest:C.forestDark;
        if(b==='mountain')col=n>.5?C.mountain:C.mountainDark;
        if(b==='snow')col=n>.55?C.snow:C.snowShade;
        pxRect(sx,sy,tile,tile,col);
        if(b==='forest' && n>.25){
          pxRect(sx+1,sy+1,1,2,C.forestDark);pxRect(sx,sy,3,2,C.forest);
        } else if(b==='mountain' && n>.3){
          pxRect(sx+1,sy,2,1,C.snow);pxRect(sx,sy+1,4,2,C.mountainDark);
        } else if(b==='plains' && n>.88){
          pxRect(sx+2,sy+1,1,2,C.sand);
        }
      }
    }
    drawShore(t);
  }

  function drawShore(t){
    for(let sy=0;sy<180;sy+=2){
      for(let sx=0;sx<320;sx+=2){
        const wx=(sx-t.cx)*8/t.z,wy=(sy-t.cy)*8/t.z;
        if(landAt(wx,wy)){
          const nearWater=[landAt(wx+9,wy),landAt(wx-9,wy),landAt(wx,wy+9),landAt(wx,wy-9)].some(v=>!v);
          if(nearWater)pxRect(sx,sy,2,2,C.sand);
        }
      }
    }
  }

  function drawRiver(t){
    ctx.save();
    for(let x=-1150;x<=1150;x+=10){
      const y=Math.sin(x/180)*100+80;
      const [sx,sy]=worldToScreen(x,y,t);
      pxRect(sx,sy,2,2,C.waterHi);
      if(Math.abs(Math.sin(x/180))>.65)pxRect(sx,sy+1,2,1,C.water);
    }
    ctx.restore();
  }

  function drawRoads(t){
    ctx.save();
    state.roads.forEach(r=>{
      if(!r.path||r.path.length<2)return;
      for(let i=1;i<r.path.length;i++){
        const a=worldToScreen(r.path[i-1].x,r.path[i-1].y,t),b=worldToScreen(r.path[i].x,r.path[i].y,t);
        ctx.strokeStyle=C.outline;ctx.lineWidth=Math.max(1,Math.round(t.z*.9));ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke();
        ctx.strokeStyle=C.road;ctx.lineWidth=Math.max(1,Math.round(t.z*.45));ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke();
      }
    });
    ctx.restore();
  }

  function drawResource(n,t){
    if(n.depleted)return;
    const [x,y]=worldToScreen(n.x,n.y,t);
    const colors={gold:C.gold,iron:'#aeb5b2',stone:C.stone,wood:C.green,medicine:'#d47eae',reagents:'#9e79c7',food:'#d5c45b'};
    const c=colors[n.type]||C.gold;
    pxRect(x-1,y-1,3,3,C.outline);pxRect(x,y-1,1,2,c);
    if(n.type==='gold')pxRect(x+1,y-2,1,1,C.gold);
  }

  function drawBuilding(x,y,type,scale=1){
    const s=Math.max(1,Math.round(scale));
    pxRect(x-5*s,y-3*s,10*s,7*s,C.outline);
    pxRect(x-4*s,y-2*s,8*s,5*s,type==='stone'?C.stone:C.wood);
    pxRect(x-5*s,y-3*s,10*s,2*s,type==='stone'?C.stone:C.roof);
    pxRect(x-1*s,y+1*s,2*s,3*s,C.dirt);
  }

  function drawSettlement(s,t){
    const [x,y]=worldToScreen(s.x,s.y,t);
    if(x<-20||x>340||y<-20||y>200)return;
    const pop=state.npcs.filter(n=>n.alive&&n.settlementId===s.id).length;
    const scale=s.type==='kingdom'?1.35:s.type==='city'?1.1:.8;
    const count=clamp(2+Math.floor(pop/18),2,8);
    for(let i=0;i<count;i++){
      const ox=((i*17)%23)-11,oy=((i*11)%13)-6;
      drawBuilding(x+ox,y+oy,i%4===0&&scale>1,scale);
    }
    if(s.type==='kingdom'||s.type==='city'){
      pxRect(x-2,y-11,4,8,C.outline);pxRect(x-1,y-10,2,6,C.gold);
      pxRect(x-4,y-12,8,2,s.type==='kingdom'?C.gold:C.purple);
    }
    if(state.showNames!==false && (t.z>.7 || s.type==='kingdom')){
      const label=s.name||'Settlement';
      ctx.font='6px monospace';ctx.textAlign='center';
      const w=Math.min(76,ctx.measureText(label).width+8);
      pxRect(x-w/2,y-20,w,9,'rgba(25,34,31,.88)');
      ctx.fillStyle=C.white;ctx.fillText(label,x,y-14);
      ctx.textAlign='start';
    }
  }

  function npcPalette(n){
    const v=n.visual||{};
    let outfit=v.outfit||'';
    if(n.classTier==='royal'||outfit==='royal')return {body:C.gold,trim:'#f1e0a1',skin:v.skin||'#b97850'};
    if(n.classTier==='noble'||outfit==='noble')return {body:C.purple,trim:'#d2a9e2',skin:v.skin||'#b97850'};
    if(['military','soldier','knight'].includes(outfit)||['soldier','knight','captain','general','marshal'].includes(n.roleId))return {body:C.blue,trim:'#d5d8db',skin:v.skin||'#b97850'};
    if(outfit==='merchant'||['merchant','trader'].includes(n.roleId))return {body:'#66855f',trim:C.gold,skin:v.skin||'#b97850'};
    return {body:'#7b6b55',trim:'#b79b6d',skin:v.skin||'#b97850'};
  }

  function drawNPC(n,t){
    const [x,y]=worldToScreen(n.x,n.y,t);
    if(x<-8||x>328||y<-8||y>188)return;
    const age=n.ageBand||(n.age<13?'child':n.age<18?'teen':n.age<45?'adult':n.age<65?'mature':'elder');
    const p=npcPalette(n), trait=n.traits||[n.trait];
    let h=age==='child'?4:age==='elder'?6:5;
    if(trait.includes('giant'))h+=2;
    if(trait.includes('dwarf'))h=Math.max(3,h-1);
    pxRect(x-2,y+3,5,h,C.outline);
    pxRect(x-1,y+h+2,1,2,C.outline);pxRect(x+1,y+h+2,1,2,C.outline);
    pxRect(x-2,y+3,4,4,p.body);pxRect(x-1,y+4,2,2,p.trim);
    pxRect(x-1,y-1,3,4,p.skin);pxRect(x,y-2,2,2,n.visual?.hair||'#2d2520');
    if(['soldier','knight','captain','general','marshal','duelist','marksman','ranger'].includes(n.roleId)){
      pxRect(x+3,y+1,1,6,C.outline);pxRect(x+3,y,1,5,C.white);
    }
    if(n.visual?.mount){pxRect(x-5,y+5,4,3,C.outline);pxRect(x-4,y+4,5,3,'#79573d');}
    if(trait.includes('immortal')||trait.includes('blessed')){pxRect(x-3,y-4,6,1,C.gold);pxRect(x-4,y-3,1,2,C.gold);pxRect(x+3,y-3,1,2,C.gold);}
    if(trait.includes('cursed')){pxRect(x-3,y-5,1,2,C.purple);pxRect(x+3,y-5,1,2,C.purple);}
    if(n.id===state.selected){
      ctx.strokeStyle=C.white;ctx.lineWidth=1;ctx.strokeRect(x-5,y-6,10,12);
    }
    if(state.showNames!==false && t.z>1.7 && n.id===state.selected){
      ctx.font='6px monospace';ctx.fillStyle=C.white;ctx.textAlign='center';ctx.fillText(n.name||'NPC',x,y-8);ctx.textAlign='start';
    }
  }

  function drawCaravan(c,t){
    const [x,y]=worldToScreen(c.x,c.y,t);
    pxRect(x-3,y-2,7,5,C.outline);pxRect(x-2,y-1,5,3,C.wood);pxRect(x-1,y-3,3,2,C.gold);
    pxRect(x-4,y+3,2,2,C.outline);pxRect(x+3,y+3,2,2,C.outline);
  }

  function drawLandmarks(t){
    (state.worldGen?.landmarks||[]).forEach(l=>{
      const [x,y]=worldToScreen(l.x,l.y,t);
      pxRect(x-2,y-2,5,5,C.outline);pxRect(x-1,y-1,3,3,l.discovered?C.gold:C.stone);
    });
  }

  function drawTopLabels(){
    const year=state.year||1, season=state.season||'Spring', pop=alive().length;
    pxRect(5,5,112,17,'rgba(24,32,30,.9)');
    ctx.font='7px monospace';ctx.fillStyle=C.white;ctx.fillText('EVERGLEN',9,12);
    ctx.fillStyle=C.gold;ctx.fillText(`YEAR ${year}`,9,19);
    ctx.fillStyle=C.white;ctx.fillText(`${season.toUpperCase()}  •  ${pop}`,63,19);
    if(state.war){pxRect(255,5,60,13,'rgba(118,38,35,.94)');ctx.fillStyle=C.white;ctx.font='7px monospace';ctx.fillText('⚔ WAR',273,14);}
  }

  function draw(){
    resize();
    const t=transform();
    ctx.clearRect(0,0,320,180);
    drawTerrain(t);drawRiver(t);drawRoads(t);
    (state.worldGen?.resources||[]).forEach(n=>drawResource(n,t));
    drawLandmarks(t);
    state.settlements.forEach(s=>drawSettlement(s,t));
    state.caravans.forEach(c=>drawCaravan(c,t));
    alive().forEach(n=>drawNPC(n,t));
    drawTopLabels();
  }

  window.EVERGLEN_2D_ART={canvas,draw,resize};
  window.addEventListener('resize',draw);
  setInterval(()=>{if(state.running)draw()},120);
  draw();
})();
