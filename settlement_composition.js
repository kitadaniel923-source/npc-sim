// Visual-only settlement composition layer using real Everglen medieval atlas assets.
(() => {
  const state=window.SIM_STATE, art=window.EVERGLEN_2D_ART, registry=window.EVERGLEN_RENDER;
  if(!state||!art?.canvas||!registry)return;
  const ctx=art.canvas.getContext('2d');ctx.imageSmoothingEnabled=false;
  const hash=(x,y,s=31)=>{const v=Math.sin(x*12.9898+y*78.233+s*37.719)*43758.5453;return v-Math.floor(v);};
  const screen=(x,y)=>{const z=state.camera.zoom||1;return[160-state.camera.x*z/8+x*z/8,90-state.camera.y*z/8+y*z/8];};
  const roles=(sid,ids)=>state.npcs.filter(n=>n.alive&&n.settlementId===sid&&ids.includes(n.roleId));
  const assets=()=>window.EVERGLEN_ASSETS;
  const sprite=(atlas,key,x,y,w,h)=>{const a=assets(),r=a?.manifest?.[atlas]?.[key],im=a?.images?.[atlas];if(!r||!im)return false;ctx.drawImage(im,r.x,r.y,r.w,r.h,x,y,w,h);return true;};
  const road=(a,b,w=1)=>{const[x1,y1]=screen(a.x,a.y),[x2,y2]=screen(b.x,b.y);ctx.save();ctx.lineWidth=w;ctx.strokeStyle='rgba(88,70,48,.78)';ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();ctx.restore();};
  function prop(kind,x,y,scale=1){const[sx,sy]=screen(x,y);if(sx<-30||sx>350||sy<-30||sy>210)return;switch(kind){case'home':sprite('structures','pc_roofs',sx-6*scale,sy-6*scale,12*scale,12*scale);break;case'market':sprite('world','market',sx-6*scale,sy-7*scale,12*scale,14*scale);break;case'tavern':sprite('world','tavern',sx-5*scale,sy-7*scale,10*scale,13*scale);break;case'workshop':sprite('world','anvil',sx-5*scale,sy-6*scale,10*scale,11*scale);break;case'well':sprite('world','well',sx-7*scale,sy-7*scale,14*scale,15*scale);break;case'banner':sprite('world','banner',sx-4*scale,sy-9*scale,8*scale,13*scale);break;}}
  function farm(s,si,count){for(let i=0;i<count;i++){const a=(i/count)*Math.PI*2+hash(si,i,91)*.3,r=30+(hash(si,i,92)-.5)*7;for(let row=0;row<2;row++){const[sx,sy]=screen(s.x+Math.cos(a)*r+row*3,s.y+Math.sin(a)*r+row*5);ctx.fillStyle='rgba(142,112,58,.5)';ctx.fillRect(sx-4,sy-2,8,2);for(let c=0;c<3;c++)ctx.fillRect(sx-4+c*3,sy-5,1,2);}}}
  function settlement(s,si){
    const pop=state.npcs.filter(n=>n.alive&&n.settlementId===s.id).length,radius=Math.min(36,12+Math.sqrt(Math.max(1,pop))*2.1);
    const farmers=roles(s.id,['farmer','rancher','baker','cook','brewer']).length,craftsmen=roles(s.id,['blacksmith','carpenter','weaver','mason','builder','engineer','armorer']).length,merchants=roles(s.id,['merchant','trader','shopkeeper','peddler']).length,scholars=roles(s.id,['scholar','teacher','scribe','librarian']).length,soldiers=roles(s.id,['militia','soldier','archer','spearman','knight','cavalry','captain','general','marshal']).length;
    const homes=Math.min(20,Math.max(2,Math.floor(pop/3))),buildings=[];
    for(let i=0;i<homes;i++){const a=i/homes*Math.PI*2+hash(si,i,7)*.35,r=Math.max(10,radius*.72)+(hash(si,i,9)-.5)*5;buildings.push({kind:'home',x:s.x+Math.cos(a)*r,y:s.y+Math.sin(a)*r});}
    const add=(kind,count,ring)=>{for(let i=0;i<count;i++){const a=i/Math.max(1,count)*Math.PI*2+hash(si,i,17+kind.length)*.3,r=ring+(hash(si,i,29+kind.length)-.5)*5;buildings.push({kind,x:s.x+Math.cos(a)*r,y:s.y+Math.sin(a)*r});}};
    if(craftsmen)add('workshop',Math.min(3,Math.max(1,Math.ceil(craftsmen/4))),radius*.72);if(merchants)add('market',Math.min(2,Math.max(1,Math.ceil(merchants/5))),radius*.55);if(scholars>1)add('academy',1,radius*.42);if(soldiers>2)add('barracks',1,radius*.9);if(pop>7)add('tavern',1,radius*.48);
    const center={x:s.x,y:s.y};buildings.slice(0,Math.min(10,buildings.length)).forEach(b=>road(center,b,1));if(pop>15)for(let i=0;i<4;i++){const a=i*Math.PI/2+.35;road(center,{x:s.x+Math.cos(a)*radius*1.8,y:s.y+Math.sin(a)*radius*1.8},1.4);}
    if(farmers&&pop>5)farm(s,si,Math.min(4,Math.max(1,Math.ceil(farmers/5))));prop('well',s.x,s.y,1);buildings.forEach(b=>prop(b.kind,b.x,b.y,b.kind==='home'?.72:.9));if(pop>8)prop('tavern',s.x+7,s.y-6,1);if(merchants)prop('market',s.x-8,s.y+7,1);if(craftsmen)prop('workshop',s.x-15,s.y+8,.9);if(pop>12)prop('banner',s.x+10,s.y-14,.8);
    s.visualComposition={version:2,radius:Math.round(radius),homes,farms:Math.min(4,Math.max(0,Math.ceil(farmers/5))),workshops:Math.min(3,Math.max(0,Math.ceil(craftsmen/4))),markets:Math.min(2,Math.max(0,Math.ceil(merchants/5))),academy:scholars>1,barracks:soldiers>2,assetDriven:true,tick:state.tick};
  }
  function draw(){if(!state.running)return;(state.settlements||[]).forEach(settlement);}
  window.EVERGLEN_SETTLEMENT_COMPOSITION={draw,compose:settlement};if(registry.register)registry.register({name:'settlement-composition',priority:255,draw});
})();
