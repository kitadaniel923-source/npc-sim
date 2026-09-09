// Everglen road and territorial connectivity layer.
// Converts simulated settlement infrastructure into readable civilization-scale routes.
(() => {
  'use strict';
  const state=window.SIM_STATE,art=window.EVERGLEN_2D_ART,registry=window.EVERGLEN_RENDER;
  if(!state||!art?.canvas||!registry)return;
  const ctx=art.canvas.getContext('2d');
  const screen=(x,y)=>{const z=state.camera?.zoom||1;return[160+(x-(state.camera?.x||0))*z/8,90+(y-(state.camera?.y||0))*z/8];};
  const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const owner=s=>String(s?.kingdomId??s?.kingdom??s?.factionId??s?.faction??'');
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const landPoint=(x,y)=>window.EVERGLEN_WORLD?.landAt?.(x,y)!==false;
  function nearestLand(p){if(landPoint(p.x,p.y))return p;for(let r=10;r<180;r+=10)for(let a=0;a<Math.PI*2;a+=Math.PI/12){const q={x:p.x+Math.cos(a)*r,y:p.y+Math.sin(a)*r};if(landPoint(q.x,q.y))return q;}return p;}
  function buildLinks(){
    const ss=(state.settlements||[]).map(s=>({...s,x:Number(s.x)||0,y:Number(s.y)||0})).filter(s=>s.population||s.populationPeak||s.homes);
    const links=[],seen=new Set();
    ss.forEach(s=>{
      const max=clamp(1+Math.floor((Number(s.infrastructure?.roads)||0)/22),1,3);
      ss.filter(t=>t!==s&&(owner(t)===owner(s)||!owner(s)||!owner(t))).map(t=>({t,d:dist(s,t)})).filter(v=>v.d<330).sort((a,b)=>a.d-b.d).slice(0,max).forEach(v=>{const id=[s.id,v.t.id].sort().join('|');if(seen.has(id))return;seen.add(id);links.push({a:s,b:v.t,kind:owner(s)===owner(v.t)?'local':'frontier'});});
    });
    return links;
  }
  function drawRoad(a,b,kind,zoom){
    const p=screen(a.x,a.y),q=screen(b.x,b.y);if((p[0]<-30&&q[0]<-30)||(p[0]>350&&q[0]>350)||(p[1]<-30&&q[1]<-30)||(p[1]>210&&q[1]>210))return;
    const bend=clamp(dist(a,b)*.08,5,24)*(a.y<b.y?1:-1),m=screen((a.x+b.x)/2,(a.y+b.y)/2+bend);
    ctx.beginPath();ctx.moveTo(Math.floor(p[0]),Math.floor(p[1]));ctx.quadraticCurveTo(Math.floor(m[0]),Math.floor(m[1]),Math.floor(q[0]),Math.floor(q[1]));
    ctx.globalAlpha=zoom<1.35?(kind==='frontier'?.18:.25):(kind==='frontier'?.40:.52);
    ctx.strokeStyle=kind==='frontier'?'#b99b6c':'#9b7954';ctx.lineWidth=zoom<1.35?Math.max(.5,zoom*.35):Math.min(1.8,zoom*.55);ctx.setLineDash(kind==='frontier'?[2,3]:[]);ctx.stroke();ctx.setLineDash([]);
  }
  function draw(){
    const zoom=state.camera?.zoom||1;ctx.save();buildLinks().forEach(l=>drawRoad(l.a,l.b,l.kind,zoom));
    (state.settlements||[]).forEach(s=>{const roads=Number(s.infrastructure?.roads||0);if(roads<15)return;const p=nearestLand({x:Number(s.x)||0,y:Number(s.y)||0}),[sx,sy]=screen(p.x,p.y);if(sx<-10||sx>330||sy<-10||sy>190)return;const r=clamp(1+roads/40,1,3);ctx.globalAlpha=zoom<1.35?.35:.62;ctx.strokeStyle='#c9a66b';ctx.lineWidth=1;ctx.beginPath();ctx.arc(Math.floor(sx),Math.floor(sy),r,0,Math.PI*2);ctx.stroke();});ctx.restore();
  }
  window.EVERGLEN_ROAD_NETWORK={draw,buildLinks};registry.register({name:'road-network',priority:282,draw});
})();
