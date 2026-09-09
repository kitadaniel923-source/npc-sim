// Everglen static imported-asset stage.
// Runs alongside the canonical Pixel Crawler NPC renderer and never draws NPC bodies.
(() => {
  const state=window.SIM_STATE,art=window.EVERGLEN_2D_ART,registry=window.EVERGLEN_RENDER;
  if(!state||!art?.canvas||!registry)return;
  const ctx=art.canvas.getContext('2d');ctx.imageSmoothingEnabled=false;
  const hash=(x,y,s=17)=>{const v=Math.sin(x*12.9898+y*78.233+s*37.719)*43758.5453;return v-Math.floor(v);};
  const noise=(x,y)=>{const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,a=hash(ix,iy),b=hash(ix+1,iy),c=hash(ix,iy+1),d=hash(ix+1,iy+1),u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy);return a+(b-a)*u+((c+(d-c)*u)-(a+(b-a)*u))*v;};
  const land=(x,y)=>{const nx=x/1150,ny=y/760,b=[[.16,-.18,.34,.38],[.56,-.22,.39,.30],[.78,.12,.25,.42],[.36,.30,.34,.34],[.05,.43,.24,.27],[-.36,.15,.35,.43],[-.62,-.25,.23,.28]];for(const[cx,cy,rx,ry]of b){const dx=(nx-cx)/rx,dy=(ny-cy)/ry;if(dx*dx+dy*dy<1)return true;}return false;};
  const biome=(x,y)=>{if(!land(x,y))return'water';const n=noise(x/170,y/170),q=noise(x/65+8,y/65+3);if(y>310||(n>.72&&q>.55))return'snow';if(n<.23)return'forest';if(n>.82)return'mountain';if(q<.2)return'plains';return n>.58?'meadow':'plains';};
  const screen=(x,y)=>{const z=state.camera.zoom||1;return[160+(x-state.camera.x)*z/8,90+(y-state.camera.y)*z/8];};
  function draw(){const a=window.EVERGLEN_ASSETS;if(!a?.ready)return;const m=a.manifest,i=a.images;
    const sprite=(atlas,key,x,y,w,h)=>{const r=m[atlas]?.[key],im=i[atlas];if(!r||!im)return false;ctx.drawImage(im,r.x,r.y,r.w,r.h,x,y,w,h);return true;};
    const frame=(atlas,key,count,index,x,y,w,h)=>{const r=m[atlas]?.[key],im=i[atlas];if(!r||!im)return false;const fw=Math.floor(r.w/count);ctx.drawImage(im,r.x+fw*index,r.y,fw,r.h,x,y,w,h);return true;};
    ctx.save();
    // Imported terrain is the foundation of the static world. Keep it beneath all actors.
    const tile=8;
    for(let sy=0;sy<180;sy+=tile)for(let sx=0;sx<320;sx+=tile){const wx=(sx-160)*8/(state.camera.zoom||1)/1+(state.camera.x||0),wy=(sy-90)*8/(state.camera.zoom||1)/1+(state.camera.y||0),b=biome(wx,wy),key=b==='water'?'water':b==='forest'?'forest':b==='desert'?'desert':'grass';sprite('terrain',key,sx,sy,tile,tile);}
    for(let x=-1200;x<1200;x+=90)for(let y=-800;y<800;y+=90){const n=hash(x/90,y/90,4);if(n<.63||!land(x,y))continue;const[sx,sy]=screen(x,y);if(sx<-20||sx>340||sy<-20||sy>200)continue;const b=biome(x,y);if(b==='forest')sprite('world','tree_oak',sx-7,sy-12,14,15);else if(b==='snow'&&n>.78)sprite('world','rock_summer',sx-4,sy-4,8,8);else if(n>.9)sprite('world','rock_summer',sx-4,sy-4,8,8);else sprite('world','bush',sx-4,sy-5,8,8);}
    (state.settlements||[]).forEach((s,si)=>{const[x,y]=screen(s.x,s.y);if(x<-40||x>360||y<-40||y>220)return;const pop=(state.npcs||[]).filter(n=>n.alive&&n.settlementId===s.id).length;if(s.type==='kingdom')sprite('structures','castle_a',x-20,y-29,40,29);else if(s.type==='city')sprite('structures','castle_b',x-17,y-24,34,25);else sprite('world','well',x-9,y-10,18,18);if(pop>8)sprite('world','hay',x+8,y+1,10,8);if(pop>12)sprite('world','tavern',x+8,y-7,10,12);if(pop>20)sprite('world','anvil',x-17,y+2,9,9);if(pop>30)sprite('world','market',x-27,y+4,14,14);sprite('world','banner',x+11,y-20,7,11);});
    (state.settlements||[]).forEach((s,si)=>{const pop=(state.npcs||[]).filter(n=>n.alive&&n.settlementId===s.id).length;if(pop<5)return;const rows=Math.min(3,1+Math.floor(pop/25));for(let row=0;row<rows;row++)for(let col=0;col<4;col++){const wx=s.x-26+col*17+((si*7)%5),wy=s.y+20+row*10,[sx,sy]=screen(wx,wy);if(sx<-10||sx>330||sy<-10||sy>190)continue;const key=['plant_001','plant_003','plant_004','plant_005','plant_007','plant_009'][(si+row+col)%6];const stage=Math.min(2,Math.floor((state.tick/80+si+row+col)%3));frame('plants',key,3,stage,sx-4,sy-5,8,8);}});
    (state.resources||[]).forEach((r,n)=>{if(r.depleted)return;const[x,y]=screen(r.x,r.y);if(x<-12||x>332||y<-12||y>192)return;sprite('ruins',['rock_01','rock_02','rock_03','rock_04','rock_05','rock_06','rock_07'][n%7],x-5,y-5,10,10);});
    (state.settlements||[]).forEach((s,si)=>{const dead=(state.npcs||[]).filter(n=>!n.alive&&n.settlementId===s.id).length;if(dead<3)return;for(let k=0;k<Math.min(4,Math.floor(dead/3));k++){const[x,y]=screen(s.x-18+k*11,s.y-18);sprite('ruins',['grave_01','grave_02','grave_03','grave_04','grave_05','grave_06','grave_07'][(si+k)%7],x-4,y-8,8,10);}});
    for(let k=0;k<3;k++){const x=-520+k*390+Math.sin((state.tick+k*37)/35)*90,y=Math.sin(x/180)*100+80,[sx,sy]=screen(x,y);if(sx<-25||sx>345||sy<-20||sy>200)continue;sprite('world',k===2?'ship':k===1?'boat':'raft',sx-7,sy-4,14,8);}
    ctx.restore();
  }
  window.EVERGLEN_STATIC_ASSET_STAGE={draw};registry.register({name:'static-imported-assets',priority:280,draw});
})();
