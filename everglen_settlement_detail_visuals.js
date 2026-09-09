// Everglen settlement detail pass.
// Turns simulated settlement state into a readable medieval town silhouette.
(() => {
  'use strict';
  const state=window.SIM_STATE, art=window.EVERGLEN_2D_ART, registry=window.EVERGLEN_RENDER;
  if(!state||!art?.canvas||!registry)return;
  const ctx=art.canvas.getContext('2d');
  const screen=(x,y)=>{const z=state.camera?.zoom||1;return [160+(x-(state.camera?.x||0))*z/8,90+(y-(state.camera?.y||0))*z/8];};
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const hash=(a,b)=>{const n=Math.sin(a*127.1+b*311.7)*43758.5453;return n-Math.floor(n);};
  function settlementScale(s){return clamp(1+Math.sqrt(Math.max(1,Number(s.populationPeak)||Number(s.population)||10))/18,1,5);}
  function drawField(x,y,w,h,angle){ctx.save();ctx.translate(x,y);ctx.rotate(angle);for(let i=0;i<w;i+=3){ctx.fillRect(i-w/2,-h/2,1,h);}ctx.restore();}
  function drawSettlement(s,index){
    const [sx,sy]=screen(Number(s.x)||0,Number(s.y)||0);if(sx<-45||sx>365||sy<-45||sy>225)return;
    const sc=settlementScale(s), type=String(s.type||'village').toLowerCase();
    const homes=clamp(Number(s.homes)||5,3,60), roads=Number(s.infrastructure?.roads)||0, workshops=Number(s.infrastructure?.workshops)||0, defenses=Number(s.infrastructure?.defenses)||0;
    const farmCount=clamp(Math.floor(homes/7)+(Number(s.resources?.food)||0>70?2:0),1,9);
    ctx.save();
    // Defensive footprint and gate.
    if(defenses>8 && (type==='town'||type==='city'||type==='kingdom')){const r=8+sc*3;ctx.globalAlpha=.55;ctx.strokeStyle='#6f5a43';ctx.lineWidth=1;ctx.strokeRect(Math.floor(sx-r),Math.floor(sy-r*.7),Math.floor(r*2),Math.floor(r*1.4));ctx.fillRect(Math.floor(sx),Math.floor(sy-r*.7),2,3);}
    // Farms sit outside the settlement core.
    for(let i=0;i<farmCount;i++){const a=hash(index,i)*Math.PI*2,d=13+hash(i,index+4)*11;const fx=sx+Math.cos(a)*d,fy=sy+Math.sin(a)*d*.65;ctx.globalAlpha=.7;drawField(fx,fy,7+(i%3)*2,3+(i%2),a+.25);}
    // Houses and specialist buildings.
    const houseCount=clamp(Math.round(homes/3),4,22);
    for(let i=0;i<houseCount;i++){
      const a=i*2.399+hash(index,7)*.7,d=3+(i%5)*1.9;const bx=Math.floor(sx+Math.cos(a)*d*sc*.72),by=Math.floor(sy+Math.sin(a)*d*sc*.5);
      ctx.globalAlpha=.9;ctx.fillRect(bx,by,2+(sc>2?1:0),2);if(i%4===0)ctx.fillRect(bx,by-1,2,1);
    }
    if(workshops>0){for(let i=0;i<Math.min(3,Math.ceil(workshops/5));i++){const bx=Math.floor(sx+7+i*4),by=Math.floor(sy-6);ctx.fillRect(bx,by,3,3);ctx.fillRect(bx+1,by-2,1,2);}}
    if((s.districts||[]).some(d=>d.type==='market'||d.type==='exchange')){ctx.fillRect(Math.floor(sx-9),Math.floor(sy+5),6,3);ctx.fillRect(Math.floor(sx-8),Math.floor(sy+4),1,1);ctx.fillRect(Math.floor(sx-5),Math.floor(sy+4),1,1);}
    // Church/administrative landmark for mature settlements.
    if(type==='city'||type==='kingdom'||homes>35){ctx.fillRect(Math.floor(sx-1),Math.floor(sy-10),3,5);ctx.fillRect(Math.floor(sx-2),Math.floor(sy-8),5,2);ctx.fillRect(Math.floor(sx),Math.floor(sy-13),1,3);}
    // Road spokes are thicker as infrastructure grows.
    if(roads>0){ctx.globalAlpha=.55;ctx.strokeStyle='#8b6a48';ctx.lineWidth=Math.max(1,Math.min(2,sc/2));const spokes=clamp(Math.floor(roads/12)+1,2,6);for(let i=0;i<spokes;i++){const a=i*Math.PI*2/spokes;ctx.beginPath();ctx.moveTo(Math.floor(sx),Math.floor(sy));ctx.lineTo(Math.floor(sx+Math.cos(a)*(7+sc*2)),Math.floor(sy+Math.sin(a)*(5+sc)));ctx.stroke();}}
    // Settlement tier marker.
    ctx.globalAlpha=.9;ctx.fillRect(Math.floor(sx-1),Math.floor(sy+9),2,1);
    ctx.restore();
  }
  function draw(){ctx.save();(state.settlements||[]).forEach(drawSettlement);ctx.restore();}
  window.EVERGLEN_SETTLEMENT_DETAIL={draw};
  registry.register({name:'settlement-detail',priority:283,draw});
})();
