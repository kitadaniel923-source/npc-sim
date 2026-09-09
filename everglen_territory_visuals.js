// Everglen territory influence layer.
// Paints soft kingdom influence behind settlements while leaving the existing
// border-recognition system as the authoritative political frontier owner.
(() => {
  'use strict';
  const state=window.SIM_STATE, art=window.EVERGLEN_2D_ART, registry=window.EVERGLEN_RENDER;
  if(!state||!art?.canvas||!registry)return;
  const ctx=art.canvas.getContext('2d');
  const W=320,H=180,STEP=45;
  const palette=['#c96b5f','#5e8fbd','#7aa95b','#9673ad','#c39b52','#4b9b92','#b56f91','#7b7f8f','#a4774e','#5f86a8'];
  const owner=s=>String(s?.kingdomId??s?.kingdom??s?.factionId??s?.faction??s?.ownerId??s?.owner??'');
  const color=id=>{const k=(state.kingdoms||[]).find(v=>String(v.id)===String(id));if(k?.color)return k.color;const n=parseInt(String(id).replace(/\D/g,''),10)||0;return palette[n%palette.length];};
  const screen=(x,y)=>{const z=state.camera?.zoom||1;return [160+(x-(state.camera?.x||0))*z/8,90+(y-(state.camera?.y||0))*z/8];};
  function cells(){
    const ss=(state.settlements||[]).filter(s=>owner(s));
    const out=[];
    for(let gy=-500;gy<=500;gy+=STEP){for(let gx=-700;gx<=700;gx+=STEP){
      let best=null,bd=Infinity;
      for(const s of ss){const dx=gx-(Number(s.x)||0),dy=gy-(Number(s.y)||0);const d=dx*dx+dy*dy;const influence=(Number(s.populationPeak)||Number(s.population)||20)*2.2+(Number(s.infrastructure?.roads)||0)*18;const score=d/Math.max(1,influence);if(score<bd){bd=score;best=s;}}
      if(best&&bd<4200)out.push({x:gx,y:gy,id:owner(best),strength:Math.max(0,1-bd/4200)});
    }}
    return out;
  }
  function draw(){
    if(state.showBorders===false)return;
    const cs=cells();ctx.save();
    cs.forEach(c=>{const [sx,sy]=screen(c.x,c.y);if(sx<-5||sx>325||sy<-5||sy>185)return;ctx.globalAlpha=.055+.035*c.strength;ctx.fillStyle=color(c.id);ctx.fillRect(Math.floor(sx),Math.floor(sy),Math.max(1,Math.ceil(state.camera?.zoom||1)),Math.max(1,Math.ceil(state.camera?.zoom||1)));});
    ctx.restore();
  }
  window.EVERGLEN_TERRITORY_VISUALS={draw,cells};
  registry.register({name:'territory-influence',priority:278,draw});
})();
