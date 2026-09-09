// Everglen static imported-asset stage.
// Natural terrain, coastlines, forests, mountains, resources and settlements.
(() => {
  const state=window.SIM_STATE,art=window.EVERGLEN_2D_ART,registry=window.EVERGLEN_RENDER;
  if(!state||!art?.canvas||!registry)return;
  const ctx=art.canvas.getContext('2d');ctx.imageSmoothingEnabled=false;
  const world=()=>window.EVERGLEN_WORLD;
  const hash=(x,y,s=17)=>{const v=Math.sin(x*12.9898+y*78.233+s*37.719)*43758.5453;return v-Math.floor(v);};
  const screen=(x,y)=>{const z=state.camera.zoom||1;return[160+(x-state.camera.x)*z/8,90+(y-state.camera.y)*z/8];};
  const biomeAt=(x,y)=>world()?.biomeAt?.(x,y)||'water';
  const landAt=(x,y)=>world()?.landAt?.(x,y)||false;
  const elevationAt=(x,y)=>world()?.elevationAt?.(x,y)||0;
  function adjacentWater(x,y){const d=22;return !landAt(x-d,y)||!landAt(x+d,y)||!landAt(x,y-d)||!landAt(x,y+d);}
  function draw(){
    const a=window.EVERGLEN_ASSETS;
    if(!a?.ready)return;
    const m=a.manifest,i=a.images;
    const sprite=(atlas,key,x,y,w,h)=>{const r=m[atlas]?.[key],im=i[atlas];if(!r||!im)return false;ctx.drawImage(im,r.x,r.y,r.w,r.h,x,y,w,h);return true;};
    const frame=(atlas,key,count,index,x,y,w,h)=>{const r=m[atlas]?.[key],im=i[atlas];if(!r||!im)return false;const fw=Math.floor(r.w/count);ctx.drawImage(im,r.x+fw*index,r.y,fw,r.h,x,y,w,h);return true;};
    ctx.save();
    const tile=8;
    // Base map: every tile is classified by the same procedural world generator used by NPC placement.
    for(let sy=0;sy<180;sy+=tile){
      for(let sx=0;sx<320;sx+=tile){
        const wx=(sx-160)*8/(state.camera.zoom||1)+(state.camera.x||0),wy=(sy-90)*8/(state.camera.zoom||1)+(state.camera.y||0);
        const b=biomeAt(wx,wy);
        let key='water';
        if(b!=='water'){
          if(adjacentWater(wx,wy))key='desert';
          else if(b==='forest')key='forest';
          else key='grass';
        }
        sprite('terrain',key,sx,sy,tile,tile);
      }
    }
    // Natural detail pass. High elevation gets exposed stone, forest gets clustered trees, plains get shrubs.
    for(let x=-680;x<=680;x+=52)for(let y=-480;y<=480;y+=52){
      if(!landAt(x,y))continue;
      const [sx,sy]=screen(x,y);if(sx<-18||sx>338||sy<-18||sy>198)continue;
      const b=biomeAt(x,y),h=elevationAt(x,y),r=hash(Math.floor(x/52),Math.floor(y/52),5);
      if(b==='forest'&&r>.22){
        sprite('world',r>.82?'tree_oak':'bush',sx-(r>.82?7:4),sy-(r>.82?13:5),r>.82?14:8,r>.82?15:8);
      }else if(h>.72&&r>.32){
        sprite('world',['rock_summer','rock_summer','rock_summer'][Math.floor(r*3)],sx-5,sy-6,10,10);
        if(r>.82)sprite('world','rock_summer',sx+4,sy-2,7,7);
      }else if(r>.84&&b!=='steppe')sprite('world','bush',sx-4,sy-5,8,8);
    }
    // Rivers are represented by the shared world generator as water corridors. Add bridges where settlements/roads cross them.
    (state.roads||[]).forEach(r=>{if(!r.path?.length)return;for(let p=1;p<r.path.length;p+=3){const q=r.path[p];if(!q)continue;const [sx,sy]=screen(q.x,q.y);if(sx<-8||sx>328||sy<-8||sy>188)continue;if(biomeAt(q.x,q.y)==='water'&&landAt(q.x+18,q.y)||landAt(q.x-18,q.y)){sprite('world','bridge',sx-7,sy-4,14,8);}}});
    // Settlements are anchored to real generated land and grow visually with population/buildings.
    (state.settlements||[]).forEach((s,si)=>{
      const [x,y]=screen(s.x,s.y);if(x<-45||x>365||y<-45||y>225)return;
      const pop=(state.npcs||[]).filter(n=>n.alive&&n.settlementId===s.id).length;
      const scale=s.type==='kingdom'?1.25:s.type==='city'?1.05:0.9;
      if(s.type==='kingdom')sprite('structures','castle_a',x-24*scale,y-34*scale,48*scale,34*scale);
      else if(s.type==='city')sprite('structures','castle_b',x-20*scale,y-28*scale,40*scale,29*scale);
      else sprite('world','well',x-9,y-10,18,18);
      const houses=Math.min(8,Math.max(1,Math.floor(pop/5)));
      for(let h=0;h<houses;h++){
        const angle=(h/Math.max(1,houses))*Math.PI*2+si*.7,rad=20+((h*13+si*7)%17),hx=x+Math.cos(angle)*rad,hy=y+Math.sin(angle)*rad*.55;
        sprite('world',h%3===0?'tavern':'hay',hx-5,hy-5,h%3===0?10:9,h%3===0?11:8);
      }
      if(pop>10)sprite('world','anvil',x-18,y+5,9,9);
      if(pop>18)sprite('world','market',x-28,y+6,14,14);
      sprite('world','banner',x+12,y-22,7,11);
    });
    // Farms are placed around populated settlements, with visible growth stages.
    (state.settlements||[]).forEach((s,si)=>{
      const pop=(state.npcs||[]).filter(n=>n.alive&&n.settlementId===s.id).length;if(pop<5)return;
      const rows=Math.min(4,1+Math.floor(pop/18));
      for(let row=0;row<rows;row++)for(let col=0;col<5;col++){
        const wx=s.x-36+col*17+((si*7)%5),wy=s.y+28+row*10;
        if(biomeAt(wx,wy)==='water')continue;
        const [sx,sy]=screen(wx,wy);if(sx<-10||sx>330||sy<-10||sy>190)continue;
        const key=['plant_001','plant_003','plant_004','plant_005','plant_007','plant_009'][(si+row+col)%6];
        const stage=Math.min(2,Math.floor((state.tick/80+si+row+col)%3));
        frame('plants',key,3,stage,sx-4,sy-5,8,8);
      }
    });
    // Resource nodes and ruins use the actual generated coordinates.
    const resources=state.worldGen?.resources||[];
    resources.forEach((r,n)=>{if(r.depleted)return;const [x,y]=screen(r.x,r.y);if(x<-12||x>332||y<-12||y>192)return;sprite('ruins',['rock_01','rock_02','rock_03','rock_04','rock_05','rock_06','rock_07'][n%7],x-5,y-5,10,10);});
    (state.worldGen?.landmarks||[]).forEach((r,n)=>{const [x,y]=screen(r.x,r.y);if(x<-14||x>334||y<-14||y>194)return;if(hash(n,3,8)>.5)sprite('ruins',['rock_01','rock_03','rock_05','rock_07'][n%4],x-5,y-5,10,10);});
    // Ships only travel through genuine water.
    for(let k=0;k<4;k++){const x=-560+k*370+Math.sin((state.tick+k*37)/35)*70,y=Math.sin(x/180)*100+80;if(biomeAt(x,y)!=='water')continue;const [sx,sy]=screen(x,y);if(sx<-25||sx>345||sy<-20||sy>200)continue;sprite('world',k%3===2?'ship':k%3===1?'boat':'raft',sx-7,sy-4,14,8);}
    ctx.restore();
  }
  window.EVERGLEN_STATIC_ASSET_STAGE={draw};registry.register({name:'static-imported-assets',priority:280,draw});
})();
