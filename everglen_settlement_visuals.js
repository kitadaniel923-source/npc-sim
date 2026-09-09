// Everglen settlement visual layer.
// Draws readable villages, farms, roads, resource sites and city cores from
// the existing settlement/infrastructure simulation state.
(() => {
  'use strict';
  const state=window.SIM_STATE, art=window.EVERGLEN_2D_ART, registry=window.EVERGLEN_RENDER;
  if(!state||!art?.canvas||!registry)return;
  const ctx=art.canvas.getContext('2d');
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const screen=(x,y)=>{const z=state.camera?.zoom||1;return [160+(x-(state.camera?.x||0))*z/8,90+(y-(state.camera?.y||0))*z/8];};
  const world=()=>window.EVERGLEN_WORLD;
  const land=(x,y)=>!!world()?.landAt?.(x,y);
  const nearest=(x,y)=>{if(land(x,y))return{x,y};for(let r=12;r<180;r+=12)for(let a=0;a<Math.PI*2;a+=Math.PI/10){const px=x+Math.cos(a)*r,py=y+Math.sin(a)*r;if(land(px,py))return{x:px,y:py};}return{x,y};};
  function drawRoads(s,x,y,r){
    const [sx,sy]=screen(x,y); const count=clamp(Math.round((s.infrastructure?.roads||0)/10),1,8);
    ctx.beginPath();
    for(let i=0;i<count;i++){const a=i*Math.PI/count-Math.PI/2;const ex=sx+Math.cos(a)*r,ey=sy+Math.sin(a)*r;ctx.moveTo(Math.floor(sx),Math.floor(sy));ctx.lineTo(Math.floor(ex),Math.floor(ey));}
    ctx.stroke();
  }
  function drawFarm(s,x,y,r){
    if((s.environment||'plains')==='water'||(s.specialization||'')==='military')return;
    const food=s.resources?.food||0, pressure=s.growthPressure||0;
    const fields=clamp(1+Math.floor((food+Math.max(0,pressure))/45),1,7);
    for(let i=0;i<fields;i++){
      const a=i*2.399, d=r+4+(i%3)*3, [fx,fy]=screen(x+Math.cos(a)*d,y+Math.sin(a)*d);
      ctx.fillRect(Math.floor(fx),Math.floor(fy),4+(i%2)*2,2);
      ctx.fillRect(Math.floor(fx),Math.floor(fy)+3,4+(i%2)*2,1);
    }
  }
  function drawBuildings(s,x,y,r){
    const [sx,sy]=screen(x,y); const type=s.type||'village';
    const houses=clamp(Math.round((s.homes||5)/5),2,18);
    for(let i=0;i<houses;i++){
      const a=i*2.399, d=4+(i%4)*2, bx=Math.floor(sx+Math.cos(a)*d),by=Math.floor(sy+Math.sin(a)*d);
      ctx.fillRect(bx,by,3,3); if(type!=='village'&&i%3===0)ctx.fillRect(bx+1,by-2,1,2);
    }
    if(type==='city'||type==='kingdom'){
      const core=type==='kingdom'?7:5;
      ctx.fillRect(Math.floor(sx-core/2),Math.floor(sy-core/2),core,core);
      ctx.fillRect(Math.floor(sx-1),Math.floor(sy-core-2),2,core);
      if((s.infrastructure?.defenses||0)>12){ctx.strokeRect(Math.floor(sx-core-2),Math.floor(sy-core-2),core+4,core+4);}
    }
    if((s.infrastructure?.workshops||0)>4)ctx.fillRect(Math.floor(sx+r*.5),Math.floor(sy-r*.25),4,4);
    if((s.districts||[]).some(d=>d.type==='market'||d.type==='exchange'))ctx.fillRect(Math.floor(sx-r*.55),Math.floor(sy+r*.2),5,3);
  }
  function drawResourceSites(){
    const nodes=state.worldGen?.resources||[];
    nodes.forEach(n=>{if(n.depleted)return;const [sx,sy]=screen(n.x,n.y);if(sx<-6||sx>326||sy<-6||sy>186)return;const t=n.type;if(t==='wood'){ctx.fillRect(Math.floor(sx),Math.floor(sy),2,4);ctx.fillRect(Math.floor(sx-2),Math.floor(sy),2,2);}else if(t==='iron'||t==='gold'||t==='stone'){ctx.fillRect(Math.floor(sx),Math.floor(sy),4,3);ctx.fillRect(Math.floor(sx+1),Math.floor(sy-2),2,2);}else if(t==='food'||t==='cloth'){ctx.fillRect(Math.floor(sx),Math.floor(sy),5,2);}});
  }
  function draw(){
    ctx.save();
    drawResourceSites();
    (state.settlements||[]).forEach((raw,i)=>{
      const p=nearest(raw.x||0,raw.y||0), s=raw;
      const radius=clamp(7+Math.sqrt(Math.max(1,s.populationPeak||0))*0.65,7,24);
      drawRoads(s,p.x,p.y,radius);
      drawFarm(s,p.x,p.y,radius);
      drawBuildings(s,p.x,p.y,radius);
      const [sx,sy]=screen(p.x,p.y);
      if(sx>-20&&sx<340&&sy>-20&&sy<200){
        ctx.fillRect(Math.floor(sx-1),Math.floor(sy+radius+2),2,2);
        if(s.type==='city'||s.type==='kingdom')ctx.fillRect(Math.floor(sx-2),Math.floor(sy-radius-3),4,1);
      }
    });
    ctx.restore();
  }
  window.EVERGLEN_SETTLEMENT_VISUALS={draw};
  registry.register({name:'settlement-visuals',priority:281,draw});
})();
