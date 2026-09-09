// Visual-only settlement composition layer.
// Builds deterministic roads, zones and workplace props from authoritative settlement state.
(() => {
  const state = window.SIM_STATE, art = window.EVERGLEN_2D_ART, registry = window.EVERGLEN_RENDER;
  if (!state || !art?.canvas || !registry) return;
  const ctx = art.canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const hash=(x,y,s=31)=>{const v=Math.sin(x*12.9898+y*78.233+s*37.719)*43758.5453;return v-Math.floor(v);};
  const screen=(x,y)=>{const z=state.camera.zoom||1;return [160-state.camera.x*z/8+x*z/8,90-state.camera.y*z/8+y*z/8];};
  const roles=(sid,ids)=>state.npcs.filter(n=>n.alive&&n.settlementId===sid&&ids.includes(n.roleId));
  const drawRoad=(a,b,w=1)=>{const [x1,y1]=screen(a.x,a.y),[x2,y2]=screen(b.x,b.y);ctx.save();ctx.lineWidth=w;ctx.strokeStyle='rgba(92,76,57,.75)';ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();ctx.restore();};
  function settlement(s,si){
    const pop=state.npcs.filter(n=>n.alive&&n.settlementId===s.id).length;
    const radius=Math.min(34,12+Math.sqrt(Math.max(1,pop))*2.1);
    const center={x:s.x,y:s.y};
    const buildings=[];
    const add=(kind,count,ring)=>{for(let i=0;i<count;i++){const a=(i/Math.max(1,count))*Math.PI*2+hash(si,i,7)*.45;const r=ring+(hash(si,i,9)-.5)*5;buildings.push({kind,x:s.x+Math.cos(a)*r,y:s.y+Math.sin(a)*r});}};
    const homes=Math.min(18,Math.max(2,Math.floor(pop/3)));
    add('home',homes,Math.max(10,radius*.72));
    const farmers=roles(s.id,['farmer','rancher','baker','cook','brewer']).length;
    const craftsmen=roles(s.id,['blacksmith','carpenter','weaver','mason','builder','engineer','armorer']).length;
    const merchants=roles(s.id,['merchant','trader','shopkeeper','peddler']).length;
    const scholars=roles(s.id,['scholar','teacher','scribe','librarian']).length;
    const soldiers=roles(s.id,['militia','soldier','archer','spearman','knight','cavalry','captain','general','marshal']).length;
    if(farmers) add('farm',Math.min(4,Math.max(1,Math.ceil(farmers/5))),radius+14);
    if(craftsmen) add('workshop',Math.min(3,Math.max(1,Math.ceil(craftsmen/4))),radius*.72);
    if(merchants) add('market',Math.min(2,Math.max(1,Math.ceil(merchants/5))),radius*.55);
    if(scholars>1) add('academy',1,radius*.4);
    if(soldiers>2) add('barracks',1,radius*.9);
    // Central square and radial roads make the existing asset sprites read as a town.
    const [cx,cy]=screen(center.x,center.y);
    ctx.save();ctx.fillStyle='rgba(117,96,68,.38)';ctx.fillRect(cx-4,cy-4,8,8);ctx.restore();
    for(let i=0;i<Math.min(8,buildings.length);i++) drawRoad(center,buildings[i],1);
    if(pop>15){for(let i=0;i<4;i++){const a=i*Math.PI/2+.35;drawRoad(center,{x:s.x+Math.cos(a)*radius*1.8,y:s.y+Math.sin(a)*radius*1.8},1.4);}}
    // Store composition metadata for other visual layers and inspector/debugging.
    s.visualComposition={version:1,radius:Math.round(radius),homes,farms:buildings.filter(b=>b.kind==='farm').length,workshops:buildings.filter(b=>b.kind==='workshop').length,markets:buildings.filter(b=>b.kind==='market').length,academy:buildings.some(b=>b.kind==='academy'),barracks:buildings.some(b=>b.kind==='barracks'),tick:state.tick};
  }
  function draw(){if(!state.running)return;(state.settlements||[]).forEach(settlement);}
  window.EVERGLEN_SETTLEMENT_COMPOSITION={draw,compose:settlement};
  if(registry.register) registry.register({name:'settlement-composition',priority:255,draw});
})();
