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
    fetch(root+'terrain_manifest.json').then(r=>r.json()),fetch(root+'world_manifest.json').then(r=>r.json()),
    fetch(root+'characters_manifest.json').then(r=>r.json()),fetch(root+'structures_manifest.json').then(r=>r.json()),
    fetch(root+'plants_manifest.json').then(r=>r.json()),fetch(root+'ruins_manifest.json').then(r=>r.json()),
    loadImage('terrain_atlas.webp'),loadImage('world_atlas.webp'),loadImage('characters_atlas.webp'),loadImage('structures_atlas.webp'),
    loadImage('plants_atlas.png'),loadImage('ruins_atlas.png')
  ]).then(([t,w,c,s,p,r,ti,wi,ci,si,pi,ri])=>{
    manifest.terrain=t.atlas;manifest.world=w.atlas;manifest.characters=c.atlas;manifest.structures=s.atlas;
    manifest.plants=p.atlas;manifest.ruins=r.atlas;
    imgs.terrain=ti;imgs.world=wi;imgs.characters=ci;imgs.structures=si;imgs.plants=pi;imgs.ruins=ri;
    ready=true;window.EVERGLEN_ASSETS={manifest,images:imgs,ready:true};registry.run({state});
  }).catch(e=>console.error('Everglen asset load failed',e));
  const hash=(x,y,s=17)=>{const v=Math.sin(x*12.9898+y*78.233+s*37.719)*43758.5453;return v-Math.floor(v);};
  const noise=(x,y)=>{const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,a=hash(ix,iy),b=hash(ix+1,iy),c=hash(ix,iy+1),d=hash(ix+1,iy+1),u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy);return a+(b-a)*u+((c+(d-c)*u)-(a+(b-a)*u))*v;};
  const landAt=(x,y)=>{const nx=x/1150,ny=y/760,blobs=[[.16,-.18,.34,.38],[.56,-.22,.39,.30],[.78,.12,.25,.42],[.36,.30,.34,.34],[.05,.43,.24,.27],[-.36,.15,.35,.43],[-.62,-.25,.23,.28]];for(const [cx,cy,rx,ry] of blobs){const dx=(nx-cx)/rx,dy=(ny-cy)/ry,d=dx*dx+dy*dy;if(d<1&&d+noise(x/110,y/110)*.16<1.06)return true;}return false;};
  const biomeAt=(x,y)=>{if(!landAt(x,y))return'water';const n=noise(x/170,y/170),q=noise(x/65+8,y/65+3);if(y>310||(n>.72&&q>.55))return'snow';if(n<.23)return'forest';if(n>.82)return'mountain';if(q<.2)return'plains';return n>.58?'meadow':'plains';};
  const toScreen=(x,y,t)=>[t.cx+x*t.z/8,t.cy+y*t.z/8];
  const sprite=(atlas,key,dx,dy,dw,dh,sx=0,sy=0,sw=null,sh=null,flip=false)=>{const r=manifest[atlas]?.[key],im=imgs[atlas];if(!r||!im)return false;sw??=r.w;sh??=r.h;ctx.save();if(flip){ctx.translate(dx+dw,dy);ctx.scale(-1,1);dx=0;}ctx.drawImage(im,r.x+sx,r.y+sy,sw,sh,dx,dy,dw,dh);ctx.restore();return true;};
  const frame=(atlas,key,count,index)=>{const r=manifest[atlas]?.[key];if(!r)return null;const fw=Math.floor(r.w/count);return{x:r.x+fw*index,y:r.y,w:fw,h:r.h};};
  const drawFrame=(atlas,key,count,index,dx,dy,dw,dh,flip=false)=>{const f=frame(atlas,key,count,index);return f?sprite(atlas,key,dx,dy,dw,dh,f.x-manifest[atlas][key].x,0,f.w,f.h,flip):false;};
  const transform=()=>{const z=state.camera.zoom||1;return{z,cx:160-state.camera.x*z/8,cy:90-state.camera.y*z/8};};

  function terrain(t){const tile=8;for(let sy=0;sy<180;sy+=tile)for(let sx=0;sx<320;sx+=tile){const wx=(sx-t.cx)*8/t.z,wy=(sy-t.cy)*8/t.z;sprite('terrain',biomeAt(wx,wy)==='water'?'water':biomeAt(wx,wy)==='forest'?'forest':biomeAt(wx,wy)==='snow'?'grass':biomeAt(wx,wy)==='mountain'?'grass':'grass',sx,sy,tile,tile);}for(let sy=0;sy<180;sy+=4)for(let sx=0;sx<320;sx+=4){const wx=(sx-t.cx)*8/t.z,wy=(sy-t.cy)*8/t.z;if(landAt(wx,wy)&&[landAt(wx+12,wy),landAt(wx-12,wy),landAt(wx,wy+12),landAt(wx,wy-12)].some(v=>!v))sprite('terrain','desert',sx,sy,4,4);}}

  function nature(t){for(let x=-1200;x<1200;x+=90)for(let y=-800;y<800;y+=90){const n=hash(x/90,y/90,4);if(n<.63||!landAt(x,y))continue;const[sx,sy]=toScreen(x,y,t);if(sx<-20||sx>340||sy<-20||sy>200)continue;const b=biomeAt(x,y);if(b==='forest')sprite('world','tree_oak',sx-7,sy-12,14,15);else if(b==='snow'&&n>.78)sprite('world','rock_summer',sx-4,sy-4,8,8);else if(b==='desert')sprite('world','cactus',sx-3,sy-6,6,6);else if(n>.78)sprite('world','bush',sx-4,sy-5,8,8);else sprite('world','rock_summer',sx-4,sy-4,8,8);}}

  function settlements(t){state.settlements.forEach(s=>{const[x,y]=toScreen(s.x,s.y,t);if(x<-40||x>360||y<-40||y>220)return;const pop=state.npcs.filter(n=>n.alive&&n.settlementId===s.id).length;const king=s.type==='kingdom',city=s.type==='city';if(king)sprite('structures','castle_a',x-20,y-29,40,29);else if(city)sprite('structures','castle_b',x-17,y-24,34,25);else sprite('world','well',x-9,y-10,18,18);if(pop>8)sprite('world','hay',x+8,y+1,10,8);if(pop>12)sprite('world','tavern',x+8,y-7,10,12);if(pop>20)sprite('world','anvil',x-17,y+2,9,9);if(pop>30)sprite('world','market',x-27,y+4,14,14);sprite('world','banner',x+11,y-20,7,11);ctx.font='6px monospace';ctx.textAlign='center';const label=s.name||'Settlement',w=Math.min(92,ctx.measureText(label).width+8);ctx.fillStyle='rgba(22,29,27,.9)';ctx.fillRect(x-w/2,y-38,w,9);ctx.fillStyle='#f2f0dc';ctx.fillText(label,x,y-31);ctx.textAlign='start';});}

  function crops(t){state.settlements.forEach((s,si)=>{if(!s.x||!s.y)return;const pop=state.npcs.filter(n=>n.alive&&n.settlementId===s.id).length;if(pop<5)return;const rows=Math.min(3,1+Math.floor(pop/25));for(let row=0;row<rows;row++)for(let col=0;col<4;col++){const wx=s.x-26+col*17+((si*7)%5),wy=s.y+20+row*10;const[sx,sy]=toScreen(wx,wy,t);if(sx<-10||sx>330||sy<-10||sy>190)continue;const key=['plant_001','plant_003','plant_004','plant_005','plant_007','plant_009'][(si+row+col)%6],stage=Math.min(2,Math.floor((state.tick/80+si+row+col)%3));drawFrame('plants',key,3,stage,sx-4,sy-5,8,8);}});}

  function ruins(t){const resources=Array.isArray(state.resources)?state.resources:[];resources.forEach((r,i)=>{if(r.depleted)return;const[sx,sy]=toScreen(r.x,r.y,t);if(sx<-12||sx>332||sy<-12||sy>192)return;const key=['rock_01','rock_02','rock_03','rock_04','rock_05','rock_06','rock_07'][i%7];sprite('ruins',key,sx-5,sy-5,10,10);});state.settlements.forEach((s,si)=>{const dead=state.npcs.filter(n=>!n.alive&&n.settlementId===s.id).length;if(dead<3)return;for(let i=0;i<Math.min(4,Math.floor(dead/3));i++){const[sx,sy]=toScreen(s.x-18+i*11,s.y-18,t);sprite('ruins',['grave_01','grave_02','grave_03','grave_04','grave_05','grave_06','grave_07'][(si+i)%7],sx-4,sy-8,8,10);}});state.settlements.forEach((s,si)=>{const[sx,sy]=toScreen(s.x+18,s.y+12,t);if(sx>-10&&sx<330&&sy>-10&&sy<190)sprite('ruins',si%2?'crate_02':'crate_01',sx-5,sy-5,10,10);});}

  function boats(t){for(let i=0;i<3;i++){const x=-520+i*390+Math.sin((state.tick+i*37)/35)*90,y=Math.sin(x/180)*100+80,[sx,sy]=toScreen(x,y,t);if(sx<-25||sx>345||sy<-20||sy>200)continue;if(i===2){sprite('world','ship',sx-9,sy-4,18,8);ctx.font='5px monospace';ctx.fillStyle='#f2f0dc';ctx.fillText('WARSHIP',sx-14,sy+10);}else sprite('world',i===1?'boat':'raft',sx-5,sy-4,i===1?10:12,7);}}

  function animals(t){for(let i=0;i<18;i++){const x=-1050+hash(i,3)*2100,y=-700+hash(i,9)*1400;if(!landAt(x,y))continue;const[sx,sy]=toScreen(x,y,t);if(sx<-10||sx>330||sy<-10||sy>190)continue;const key=i%4===0?'fox':i%4===1?'boar':i%4===2?'sheep':'piglet',count=(key==='sheep'||key==='piglet')?3:4;if(!manifest.characters[key])continue;drawFrame('characters',key,count,Math.floor(state.tick/14+i)%count,sx-4,sy-4,8,8);}}

  function npcs(t){state.npcs.forEach(n=>{if(!n.alive||!landAt(n.x,n.y))return;const[sx,sy]=toScreen(n.x,n.y,t);if(sx<-12||sx>332||sy<-12||sy>192)return;const military=['militia','soldier','archer','spearman','cavalry','knight','paladin','captain','general','marshal'].includes(n.roleId),moving=Array.isArray(n.path)&&n.path.length>1,dx=moving?n.path[n.path.length-1].x-n.x:0,dy=moving?n.path[n.path.length-1].y-n.y:1,side=Math.abs(dx)>Math.abs(dy),key=military?'knight_walk':side?'npc_walk_side':'npc_walk_down',count=military?8:6,r=manifest.characters[key];if(!r)return;const idx=Math.floor(state.tick/(moving?5:10)+String(n.id||'').length)%count,size=(military?16:12)*(n.visual?.bodyScale||1);drawFrame('characters',key,count,idx,sx-size/2,sy-size,size,size,side&&dx<0);if(n.id===state.selected){ctx.strokeStyle='#fff';ctx.strokeRect(sx-7,sy-size-3,14,size+6);}});}

  function draw(){if(!ready)return;const t=transform();ctx.clearRect(0,0,320,180);terrain(t);nature(t);crops(t);ruins(t);boats(t);settlements(t);animals(t);npcs(t);ctx.font='7px monospace';ctx.fillStyle='#f2f0dc';ctx.fillText(`EVERGLEN  YEAR ${state.year||1}`,6,8);ctx.fillStyle='#e6c35d';ctx.fillText(`${String(state.season||'Spring').toUpperCase()}  •  ${state.npcs.filter(n=>n.alive).length}`,6,16);if(state.war){ctx.fillStyle='#f2f0dc';ctx.fillText('⚔ WAR',270,9);}if(state.godMode){ctx.fillStyle='#e6c35d';ctx.fillText('GOD MODE',6,174);}}
  window.EVERGLEN_ASSET_RENDERER={draw,ready:()=>ready};
  registry.register({name:'asset-world',priority:260,draw});
})();
