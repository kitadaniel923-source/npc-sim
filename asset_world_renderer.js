// Everglen unified pixel-art asset renderer.
// Visual-only stage. Simulation state stays authoritative; rendering stays inside EVERGLEN_RENDER.
(() => {
  const state = window.SIM_STATE, art = window.EVERGLEN_2D_ART, registry = window.EVERGLEN_RENDER;
  if (!state || !art?.canvas || !registry) return;
  const canvas = art.canvas, ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const root='assets/everglen/', imgs={}, manifest={};
  let ready=false;
  const loadImage=src=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=root+src;});
  Promise.all([
    fetch(root+'terrain_manifest.json').then(r=>r.json()), fetch(root+'world_manifest.json').then(r=>r.json()),
    fetch(root+'characters_manifest.json').then(r=>r.json()), fetch(root+'structures_manifest.json').then(r=>r.json()),
    loadImage('terrain_atlas.webp'),loadImage('world_atlas.webp'),loadImage('characters_atlas.webp'),loadImage('structures_atlas.webp')
  ]).then(([t,w,c,s,ti,wi,ci,si])=>{
    manifest.terrain=t.atlas;manifest.world=w.atlas;manifest.characters=c.atlas;manifest.structures=s.atlas;
    imgs.terrain=ti;imgs.world=wi;imgs.characters=ci;imgs.structures=si;ready=true;
    window.EVERGLEN_ASSETS={manifest,images:imgs,ready:true}; registry.run({state});
  }).catch(e=>console.error('Everglen asset load failed',e));
  const hash=(x,y,s=17)=>{const v=Math.sin(x*12.9898+y*78.233+s*37.719)*43758.5453;return v-Math.floor(v);};
  const noise=(x,y)=>{const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,a=hash(ix,iy),b=hash(ix+1,iy),c=hash(ix,iy+1),d=hash(ix+1,iy+1),u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy);return a+(b-a)*u+((c+(d-c)*u)-(a+(b-a)*u))*v;};
  const landAt=(x,y)=>{const nx=x/1150,ny=y/760,blobs=[[.16,-.18,.34,.38],[.56,-.22,.39,.30],[.78,.12,.25,.42],[.36,.30,.34,.34],[.05,.43,.24,.27],[-.36,.15,.35,.43],[-.62,-.25,.23,.28]];for(const [cx,cy,rx,ry] of blobs){const dx=(nx-cx)/rx,dy=(ny-cy)/ry,d=dx*dx+dy*dy;if(d<1&&d+noise(x/110,y/110)*.16<1.06)return true;}return false;};
  const biomeAt=(x,y)=>{if(!landAt(x,y))return'water';const n=noise(x/170,y/170);return n>.78?'desert':n<.25?'forest':'grass';};
  const toScreen=(x,y,t)=>[t.cx+x*t.z/8,t.cy+y*t.z/8];
  const sprite=(atlas,key,dx,dy,dw,dh,sx=0,sy=0,sw=null,sh=null,flip=false)=>{const r=manifest[atlas]?.[key],im=imgs[atlas];if(!r||!im)return false;sw??=r.w;sh??=r.h;ctx.save();if(flip){ctx.translate(dx+dw,dy);ctx.scale(-1,1);dx=0;}ctx.drawImage(im,r.x+sx,r.y+sy,sw,sh,dx,dy,dw,dh);ctx.restore();return true;};
  const frame=(atlas,key,count,index)=>{const r=manifest[atlas]?.[key];if(!r)return null;const fw=Math.floor(r.w/count);return{x:r.x+fw*index,y:r.y,w:fw,h:r.h};};
  const drawFrame=(atlas,key,count,index,dx,dy,dw,dh,flip=false)=>{const f=frame(atlas,key,count,index);return f?sprite(atlas,key,dx,dy,dw,dh,f.x-manifest[atlas][key].x,0,f.w,f.h,flip):false;};
  const transform=()=>{const z=state.camera.zoom||1;return{z,cx:160-state.camera.x*z/8,cy:90-state.camera.y*z/8};};

  function terrain(t){
    const tile=8;
    for(let sy=0;sy<180;sy+=tile)for(let sx=0;sx<320;sx+=tile){const wx=(sx-t.cx)*8/t.z,wy=(sy-t.cy)*8/t.z;sprite('terrain',biomeAt(wx,wy),sx,sy,tile,tile);}
    for(let sy=0;sy<180;sy+=4)for(let sx=0;sx<320;sx+=4){const wx=(sx-t.cx)*8/t.z,wy=(sy-t.cy)*8/t.z;if(landAt(wx,wy)&&[landAt(wx+12,wy),landAt(wx-12,wy),landAt(wx,wy+12),landAt(wx,wy-12)].some(v=>!v))sprite('terrain','desert',sx,sy,4,4);}
  }
  function nature(t){
    for(let x=-1200;x<1200;x+=90)for(let y=-800;y<800;y+=90){const n=hash(x/90,y/90,4);if(n<.63||!landAt(x,y))continue;const [sx,sy]=toScreen(x,y,t);if(sx<-20||sx>340||sy<-20||sy>200)continue;const b=biomeAt(x,y);if(b==='forest')sprite('world',n>.82?'tree_oak':'tree_oak',sx-7,sy-12,14,15);else if(b==='desert')sprite('world','cactus',sx-3,sy-6,6,6);else if(n>.78)sprite('world','bush',sx-4,sy-5,8,8);else sprite('world','rock_summer',sx-4,sy-4,8,8);}
  }
  function settlements(t){
    state.settlements.forEach(s=>{const [x,y]=toScreen(s.x,s.y,t);if(x<-40||x>360||y<-40||y>220)return;const pop=state.npcs.filter(n=>n.alive&&n.settlementId===s.id).length;const king=s.type==='kingdom',city=s.type==='city';if(king)sprite('structures','castle_a',x-20,y-29,40,29);else if(city)sprite('structures','castle_b',x-17,y-24,34,25);else sprite('world','well',x-9,y-10,18,18);if(pop>8)sprite('world','hay',x+8,y+1,10,8);if(pop>12)sprite('world','tavern',x+8,y-7,10,12);if(pop>20)sprite('world','anvil',x-17,y+2,9,9);if(pop>30)sprite('world','market',x-27,y+4,14,14);sprite('world','banner',x+11,y-20,7,11);ctx.font='6px monospace';ctx.textAlign='center';const label=s.name||'Settlement',w=Math.min(92,ctx.measureText(label).width+8);ctx.fillStyle='rgba(22,29,27,.9)';ctx.fillRect(x-w/2,y-38,w,9);ctx.fillStyle='#f2f0dc';ctx.fillText(label,x,y-31);ctx.textAlign='start';});
  }
  function boats(t){for(let i=0;i<3;i++){const x=-520+i*390+Math.sin((state.tick+i*37)/35)*90,y=Math.sin(x/180)*100+80,[sx,sy]=toScreen(x,y,t);if(sx<-25||sx>345||sy<-20||sy>200)continue;if(i===2){sprite('world','ship',sx-9,sy-4,18,8);ctx.font='5px monospace';ctx.fillStyle='#f2f0dc';ctx.fillText('WARSHIP',sx-14,sy+10);}else sprite('world',i===1?'boat':'raft',sx-5,sy-4,i===1?10:12,7);}}
  function animals(t){for(let i=0;i<18;i++){const x=-1050+hash(i,3)*2100,y=-700+hash(i,9)*1400;if(!landAt(x,y))continue;const[sx,sy]=toScreen(x,y,t);if(sx<-10||sx>330||sy<-10||sy>190)continue;const key=i%4===0?'fox':i%4===1?'boar':i%4===2?'sheep':'piglet',count=(key==='sheep'||key==='piglet')?3:4,r=manifest.characters[key];if(!r)continue;const idx=Math.floor(state.tick/14+i)%count;drawFrame('characters',key,count,idx,sx-4,sy-4,8,8);}}
  function npcs(t){state.npcs.forEach(n=>{if(!n.alive||!landAt(n.x,n.y))return;const[sx,sy]=toScreen(n.x,n.y,t);if(sx<-12||sx>332||sy<-12||sy>192)return;const military=['militia','soldier','archer','spearman','cavalry','knight','paladin','captain','general','marshal'].includes(n.roleId),moving=Array.isArray(n.path)&&n.path.length>1,dx=moving?n.path[n.path.length-1].x-n.x:0,dy=moving?n.path[n.path.length-1].y-n.y:1,side=Math.abs(dx)>Math.abs(dy),key=military?'knight_walk':side?'npc_walk_side':'npc_walk_down',count=military?8:6,r=manifest.characters[key];if(!r)return;const idx=Math.floor(state.tick/(moving?5:10)+String(n.id||'').length)%count,size=military?16:12;drawFrame('characters',key,count,idx,sx-size/2,sy-size,size,size,side&&dx<0);if(n.id===state.selected){ctx.strokeStyle='#fff';ctx.strokeRect(sx-7,sy-size-3,14,size+6);}});}
  function draw(){if(!ready)return;const t=transform();ctx.clearRect(0,0,320,180);terrain(t);nature(t);boats(t);settlements(t);animals(t);npcs(t);ctx.font='7px monospace';ctx.fillStyle='#f2f0dc';ctx.fillText(`EVERGLEN  YEAR ${state.year||1}`,6,8);ctx.fillStyle='#e6c35d';ctx.fillText(`${String(state.season||'Spring').toUpperCase()}  •  ${state.npcs.filter(n=>n.alive).length}`,6,16);if(state.war){ctx.fillStyle='#f2f0dc';ctx.fillText('⚔ WAR',270,9);}if(state.godMode){ctx.fillStyle='#e6c35d';ctx.fillText('GOD MODE',6,174);}}
  window.EVERGLEN_ASSET_RENDERER={draw,ready:()=>ready};
  registry.register({name:'asset-world',priority:260,draw});
})();
