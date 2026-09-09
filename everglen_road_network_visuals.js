// Everglen road and territorial connectivity layer.
// Converts simulated settlement infrastructure into visible civilization-scale routes.
(() => {
  'use strict';
  const state=window.SIM_STATE, art=window.EVERGLEN_2D_ART, registry=window.EVERGLEN_RENDER;
  if(!state||!art?.canvas||!registry)return;
  const ctx=art.canvas.getContext('2d');
  const screen=(x,y)=>{const z=state.camera?.zoom||1;return [160+(x-(state.camera?.x||0))*z/8,90+(y-(state.camera?.y||0))*z/8];};
  const dist=(a,b)=>Math.hypot((a.x-b.x),(a.y-b.y));
  const owner=s=>String(s?.kingdomId??s?.kingdom??s?.factionId??s?.faction??'');
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function landPoint(x,y){return window.EVERGLEN_WORLD?.landAt?.(x,y)!==false;}
  function nearestLand(p){if(landPoint(p.x,p.y))return p;for(let r=10;r<180;r+=10)for(let a=0;a<Math.PI*2;a+=Math.PI/12){const q={x:p.x+Math.cos(a)*r,y:p.y+Math.sin(a)*r};if(landPoint(q.x,q.y))return q;}return p;}
  function buildLinks(){
    const ss=(state.settlements||[]).map(s=>({...s,x:Number(s.x)||0,y:Number(s.y)||0})).filter(s=>s.population||s.populationPeak||s.homes);
    const links=[];
    const seen=new Set();
    ss.forEach(s=>{
      const max=clamp(1+Math.floor((s.infrastructure?.roads||0)/18),1,4);
      const candidates=ss.filter(t=>t!==s && (owner(t)===owner(s)||!owner(s)||!owner(t))).map(t=>({t,d:dist(s,t)})).filter(v=>v.d<360).sort((a,b)=>a.d-b.d);
      candidates.slice(0,max).forEach(v=>{const a=s,b=v.t,id=[a.id,b.id].sort().join('|');if(seen.has(id))return;seen.add(id);links.push({a,b,kind:owner(a)===owner(b)?'local':'frontier'});});
    });
    return links;
  }
  function drawRoad(a,b,kind,zoom){
    const p=screen(a.x,a.y),q=screen(b.x,b.y);
    if((p[0]<-30&&q[0]<-30)||(p[0]>350&&q[0]>350)||(p[1]<-30&&q[1]<-30)||(p[1]>210&&q[1]>210))return;
    const mx=(a.x+b.x)/2,my=(a.y+b.y)/2;
    const bend=clamp(dist(a,b)*.08,5,28)*(a.y<b.y?1:-1);
    const m=screen(mx,my+bend);
    ctx.beginPath();ctx.moveTo(Math.floor(p[0]),Math.floor(p[1]));ctx.quadraticCurveTo(Math.floor(m[0]),Math.floor(m[1]),Math.floor(q[0]),Math.floor(q[1]));
    ctx.globalAlpha=kind==='frontier'?.62:.78;
    ctx.strokeStyle=kind==='frontier'?'#a78b62':'#8b6a48';
    ctx.lineWidth=Math.max(1,Math.min(2.8,zoom*.7));
    ctx.setLineDash(kind==='frontier'?[3,3]:[]);ctx.stroke();ctx.setLineDash([]);
  }
  function draw(){
    const links=buildLinks(),zoom=state.camera?.zoom||1;
    ctx.save();
    links.forEach(l=>drawRoad(l.a,l.b,l.kind,zoom));
    // Route hubs make major towns readable at kingdom scale.
    (state.settlements||[]).forEach(s=>{
      const roads=Number(s.infrastructure?.roads||0);if(roads<15)return;
      const p=nearestLand({x:Number(s.x)||0,y:Number(s.y)||0});const [sx,sy]=screen(p.x,p.y);
      if(sx<-10||sx>330||sy<-10||sy>190)return;
      const r=clamp(1+roads/35,1,3);
      ctx.globalAlpha=.72;ctx.strokeStyle='#c9a66b';ctx.lineWidth=1;
      ctx.beginPath();ctx.arc(Math.floor(sx),Math.floor(sy),r,0,Math.PI*2);ctx.stroke();
    });
    ctx.restore();
  }
  window.EVERGLEN_ROAD_NETWORK={draw,buildLinks};
  registry.register({name:'road-network',priority:282,draw});
})();
