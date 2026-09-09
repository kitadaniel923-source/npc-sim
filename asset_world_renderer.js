// Everglen unified pixel-art asset renderer.
// Visual-only stage: simulation state remains authoritative and render ownership stays with EVERGLEN_RENDER.
(() => {
  const state = window.SIM_STATE;
  const art = window.EVERGLEN_2D_ART;
  const registry = window.EVERGLEN_RENDER;
  if (!state || !art?.canvas || !registry) return;

  const canvas = art.canvas;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const root = 'assets/everglen/';
  const imgs = {};
  let manifest = null;
  let ready = false;
  let loading = null;

  const loadImage = src => new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = reject;
    im.src = root + src;
  });

  loading = Promise.all([
    fetch(root + 'terrain_manifest.json').then(r => r.json()),
    fetch(root + 'world_manifest.json').then(r => r.json()),
    fetch(root + 'characters_manifest.json').then(r => r.json()),
    fetch(root + 'structures_manifest.json').then(r => r.json()),
    loadImage('terrain_atlas.webp'),
    loadImage('world_atlas.webp'),
    loadImage('characters_atlas.webp'),
    loadImage('structures_atlas.webp')
  ]).then(([terrain, world, characters, structures, terrainImg, worldImg, charImg, structImg]) => {
    manifest = { terrain: terrain.atlas, world: world.atlas, characters: characters.atlas, structures: structures.atlas };
    imgs.terrain = terrainImg; imgs.world = worldImg; imgs.characters = charImg; imgs.structures = structImg;
    ready = true;
    window.EVERGLEN_ASSETS = { manifest, images: imgs, ready:true };
    registry.run({ state });
  }).catch(err => console.error('Everglen asset load failed', err));

  const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
  const hash = (x,y,s=17) => { const v = Math.sin(x*12.9898+y*78.233+s*37.719)*43758.5453; return v-Math.floor(v); };
  const noise = (x,y) => { const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy; const a=hash(ix,iy),b=hash(ix+1,iy),c=hash(ix,iy+1),d=hash(ix+1,iy+1); const u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy); return a+(b-a)*u+((c+(d-c)*u)-(a+(b-a)*u))*v; };
  const landAt = (x,y) => {
    const nx=x/1150, ny=y/760;
    const blobs=[[.16,-.18,.34,.38],[.56,-.22,.39,.30],[.78,.12,.25,.42],[.36,.30,.34,.34],[.05,.43,.24,.27],[-.36,.15,.35,.43],[-.62,-.25,.23,.28]];
    for(const [cx,cy,rx,ry] of blobs){ const dx=(nx-cx)/rx,dy=(ny-cy)/ry,d=dx*dx+dy*dy; if(d<1 && d+noise(x/110,y/110)*.16<1.06) return true; }
    return false;
  };
  const biomeAt = (x,y) => {
    if(!landAt(x,y)) return 'water';
    const n=noise(x/170,y/170), q=noise(x/65+8,y/65+3);
    if(n>.78) return 'desert';
    if(n<.25 || ((state.year||1)%7===0 && q>.72)) return 'forest';
    return 'grass';
  };
  const worldToScreen=(x,y,t)=>[t.cx+x*t.z/8,t.cy+y*t.z/8];
  const drawSprite=(atlas,key,dx,dy,dw,dh,sx=0,sy=0,sw=null,sh=null,flip=false)=>{
    const r=manifest?.[atlas]?.[key], im=imgs[atlas]; if(!r||!im) return false;
    sw ??= r.w; sh ??= r.h;
    ctx.save();
    if(flip){ctx.translate(dx+dw,dy);ctx.scale(-1,1);dx=0;}
    ctx.drawImage(im,r.x+sx,r.y+sy,sw,sh,dx,dy,dw,dh);
    ctx.restore();
    return true;
  };
  const frame=(atlas,key,count,index)=>{
    const r=manifest?.[atlas]?.[key]; if(!r) return null;
    const fw=Math.floor(r.w/count);
    return {x:r.x+fw*index,y:r.y,w:fw,h:r.h};
  };
  const drawFrame=(atlas,key,count,index,dx,dy,dw,dh,flip=false)=>{
    const f=frame(atlas,key,count,index); if(!f) return false;
    return drawSprite(atlas,key,dx,dy,dw,dh,f.x-(manifest[atlas][key].x),0,f.w,f.h,flip);
  };
  const transform=()=>{const z=state.camera.zoom||1;return {z,cx:160-state.camera.x*z/8,cy:90-state.camera.y*z/8};};

  function drawTerrain(t){
    const tile=8;
    for(let sy=0;sy<180;sy+=tile){
      for(let sx=0;sx<320;sx+=tile){
        const wx=(sx-t.cx)*8/t.z, wy=(sy-t.cy)*8/t.z;
        const b=biomeAt(wx,wy);
        drawSprite('terrain',b,sx,sy,tile,tile);
      }
    }
    // Soft pixel shoreline using the same world water/grass palette.
    for(let sy=0;sy<180;sy+=4){
      for(let sx=0;sx<320;sx+=4){
        const wx=(sx-t.cx)*8/t.z, wy=(sy-t.cy)*8/t.z;
        if(landAt(wx,wy)){
          const nearWater=[landAt(wx+12,wy),landAt(wx-12,wy),landAt(wx,wy+12),landAt(wx,wy-12)].some(v=>!v);
          if(nearWater) drawSprite('terrain','desert',sx,sy,4,4);
        }
      }
    }
  }

  function scatterNature(t){
    const step=90;
    for(let x=-1200;x<1200;x+=step){
      for(let y=-800;y<800;y+=step){
        const n=hash(x/step,y/step,4); if(n<.63 || !landAt(x,y)) continue;
        const [sx,sy]=worldToScreen(x,y,t); if(sx<-20||sx>340||sy<-20||sy>200) continue;
        const b=biomeAt(x,y);
        if(b==='forest') drawSprite('world',n>.82?'tree_birch':'tree_oak',sx-7,sy-12,14,15);
        else if(b==='desert') drawSprite('world','cactus',sx-3,sy-6,6,6);
        else if(n>.78) drawSprite('world','bush',sx-4,sy-5,8,8);
        else drawSprite('world',state.season==='Winter'?'rock_winter':state.season==='Autumn'?'rock_autumn':'rock_summer',sx-4,sy-4,8,8);
      }
    }
  }

  function drawSettlements(t){
    state.settlements.forEach(s=>{
      const [x,y]=worldToScreen(s.x,s.y,t); if(x<-35||x>355||y<-35||y>215) return;
      const pop=state.npcs.filter(n=>n.alive&&n.settlementId===s.id).length;
      const isKing=s.type==='kingdom'; const isCity=s.type==='city';
      if(isKing) drawSprite('structures','castle_a',x-20,y-29,40,29);
      else if(isCity) drawSprite('structures','castle_b',x-17,y-24,34,25);
      else drawSprite('world','well',x-10,y-11,20,20);
      if(pop>8) drawSprite('world','hay',x+8,y+2,12,9);
      if(pop>12) drawSprite('world','tavern',x+8,y-7,10,12);
      if(pop>20) drawSprite('world','anvil',x-17,y+2,9,9);
      if(pop>30) drawSprite('world','market',x-28,y+5,14,14);
      drawSprite('world','banner',x+12,y-20,7,11);
      ctx.font='6px monospace'; ctx.textAlign='center';
      const label=s.name||'Settlement'; const w=Math.min(92,ctx.measureText(label).width+8);
      ctx.fillStyle='rgba(22,29,27,.9)'; ctx.fillRect(x-w/2,y-38,w,9);
      ctx.fillStyle='#f2f0dc'; ctx.fillText(label,x,y-31); ctx.textAlign='start';
    });
  }

  function drawBoats(t){
    for(let i=0;i<3;i++){
      const x=-520+i*390+Math.sin((state.tick+i*37)/35)*90;
      const y=Math.sin(x/180)*100+80;
      const [sx,sy]=worldToScreen(x,y,t); if(sx<-25||sx>345||sy<-20||sy>200) continue;
      if(i===2){
        drawSprite('world','ship',sx-9,sy-4,18,8);
        ctx.font='5px monospace';ctx.fillStyle='#f2f0dc';ctx.fillText('WARSHIP',sx-14,sy+10);
      } else drawSprite('world',i===1?'boat':'raft',sx-5,sy-4,i===1?10:12,7);
    }
  }

  function drawAnimals(t){
    for(let i=0;i<18;i++){
      const x=-1050+hash(i,3)*2100,y=-700+hash(i,9)*1400;
      if(!landAt(x,y)) continue;
      const [sx,sy]=worldToScreen(x,y,t); if(sx<-10||sx>330||sy<-10||sy>190) continue;
      const key=i%4===0?'fox':i%4===1?'boar':i%4===2?'sheep':'piglet';
      const count=(key==='sheep'||key==='piglet')?3:4;
      const idx=Math.floor(state.tick/14+i)%count;
      const r=manifest.characters[key]; if(!r) continue;
      const fw=Math.floor(r.w/count), fh=r.h;
      drawSprite('characters',key,sx-4,sy-4,8,8,fw*idx,0,fw,fh);
    }
  }

  function drawNPC(n,t){
    if(!n.alive || !landAt(n.x,n.y)) return;
    const [sx,sy]=worldToScreen(n.x,n.y,t); if(sx<-12||sx>332||sy<-12||sy>192) return;
    const military=['militia','soldier','archer','spearman','cavalry','knight','paladin','captain','general','marshal'].includes(n.roleId);
    const moving=Array.isArray(n.path)&&n.path.length>1;
    const dx=moving?n.path[n.path.length-1].x-n.x:0, dy=moving?n.path[n.path.length-1].y-n.y:1;
    const side=Math.abs(dx)>Math.abs(dy);
    const key=military?'knight_walk':moving?(side?'npc_walk_side':'npc_walk_down'):(side?'npc_idle_side':'npc_idle_down');
    const count=military?8:(key.includes('idle')?4:6);
    const r=manifest.characters[key]; if(!r) return;
    const fw=Math.floor(r.w/count), fh=r.h;
    const idx=Math.floor(state.tick/(moving?5:12)+String(n.id||'').length)%count;
    const size=military?16:12;
    drawSprite('characters',key,sx-size/2,sy-size,size,size,fw*idx,0,fw,fh,side&&dx<0);
    if(n.id===state.selected){ctx.strokeStyle='#fff';ctx.lineWidth=1;ctx.strokeRect(sx-7,sy-size-3,14,size+6);}
  }

  function drawTop(t){
    ctx.font='7px monospace'; ctx.fillStyle='#f2f0dc'; ctx.fillText(`EVERGLEN  YEAR ${state.year||1}`,6,8);
    ctx.fillStyle='#e6c35d'; ctx.fillText(`${String(state.season||'Spring').toUpperCase()}  •  ${state.npcs.filter(n=>n.alive).length}`,6,16);
    if(state.war){ctx.fillStyle='#f2f0dc';ctx.fillText('⚔ WAR',270,9);}
    if(state.godMode){ctx.fillStyle='#e6c35d';ctx.fillText('GOD MODE',6,174);}
  }

  function draw(){
    if(!ready) return;
    const t=transform();
    ctx.clearRect(0,0,320,180);
    drawTerrain(t);
    scatterNature(t);
    drawBoats(t);
    drawSettlements(t);
    drawAnimals(t);
    state.npcs.forEach(n=>drawNPC(n,t));
    drawTop(t);
  }

  window.EVERGLEN_ASSET_RENDERER={ draw, ready:()=>ready, loading };
  registry.register({name:'asset-world',priority:260,draw});
})();
