// Everglen NPC activity routes.
// Visualizes where existing NPCs are trying to go, using simulation state only.
(() => {
  'use strict';
  const state=window.SIM_STATE,art=window.EVERGLEN_2D_ART,registry=window.EVERGLEN_RENDER;
  if(!state||!art?.canvas||!registry)return;
  const ctx=art.canvas.getContext('2d');
  const screen=(x,y)=>{const z=state.camera?.zoom||1;return [160+(x-(state.camera?.x||0))*z/8,90+(y-(state.camera?.y||0))*z/8];};
  const roleSet={farm:new Set(['farmer','rancher','baker','cook','fisher','hunter','forager']),craft:new Set(['blacksmith','carpenter','weaver','mason','builder','engineer']),trade:new Set(['merchant','trader','shopkeeper','peddler']),military:new Set(['soldier','militia','archer','spearman','knight','captain','general','marshal']),knowledge:new Set(['scholar','teacher','scribe','librarian'])};
  const roleOf=n=>String(n.roleId||n.professionId||'citizen').toLowerCase();
  const category=n=>{const r=roleOf(n);for(const k of Object.keys(roleSet))if(roleSet[k].has(r))return k;return 'civilian';};
  const nearestSettlement=(n)=>{
    if(n.settlementId){const own=(state.settlements||[]).find(s=>s.id===n.settlementId);if(own)return own;}
    return (state.settlements||[]).filter(s=>s).sort((a,b)=>Math.hypot(a.x-n.x,a.y-n.y)-Math.hypot(b.x-n.x,b.y-n.y))[0]||null;
  };
  function targetFor(n,s){
    const decision=n.aiDecision||{};
    if(decision.targetId){const t=(state.npcs||[]).find(x=>x?.id===decision.targetId&&x.alive);if(t)return {x:t.x,y:t.y,kind:'person'};}
    const a=String(decision.action||'').toLowerCase();
    const infra=s?.infrastructure||{};
    const roads=Array.isArray(infra.roads)?infra.roads:[];
    const points=roads.map(r=>({x:Number(r.x??r.startX??s.x)||s.x,y:Number(r.y??r.startY??s.y)||s.y})).filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y));
    const role=category(n);
    let kind=role;
    if(a==='socialize'||a==='belong')kind='social';
    else if(a==='trade'||a==='wealth')kind='trade';
    else if(a==='train'||a==='safety'||a==='confront')kind='military';
    else if(a==='study')kind='knowledge';
    else if(a==='work')kind=role;
    const angle=((Number(n.id?.replace?.(/\D/g,''))||1)*2.399+state.tick*.0007)%6.283;
    const radius=18+((Number(n.status)||0)%7)*2;
    const offsets={farm:[1.8,.65],craft:[-1.3,.5],trade:[-.3,1.8],military:[1.5,-1.4],knowledge:[-1.5,-1.2],social:[0,1.1],civilian:[.7,.9]};
    const o=offsets[kind]||offsets.civilian;
    if(points.length&&kind==='trade'){
      const p=points[Math.abs(Math.floor(Number(n.id?.replace?.(/\D/g,''))||0))%points.length];
      return {x:p.x,y:p.y,kind};
    }
    return {x:s.x+Math.cos(angle)*radius*o[0],y:s.y+Math.sin(angle)*radius*o[1],kind};
  }
  function draw(){
    const z=state.camera?.zoom||1;
    if(z<.72)return;
    const people=(state.npcs||[]).filter(n=>n?.alive&&Number.isFinite(Number(n.x))&&Number.isFinite(Number(n.y)));
    ctx.save();
    people.forEach((n,i)=>{
      if(i%2&&people.length>1800)return;
      const s=nearestSettlement(n);if(!s)return;
      const t=targetFor(n,s);if(!t)return;
      const [x1,y1]=screen(Number(n.x),Number(n.y)),[x2,y2]=screen(t.x,t.y);
      if((x1<-8&&x2<-8)||(x1>328&&x2>328)||(y1<-8&&y2<-8)||(y1>188&&y2>188))return;
      const role=category(n);
      ctx.globalAlpha=role==='military'?0.22:0.13;
      ctx.beginPath();ctx.moveTo(Math.floor(x1),Math.floor(y1));ctx.lineTo(Math.floor(x2),Math.floor(y2));ctx.stroke();
      const phase=((state.tick*.08)+(i*.71))%1;
      const px=Math.floor(x1+(x2-x1)*phase),py=Math.floor(y1+(y2-y1)*phase);
      ctx.globalAlpha=role==='military'?0.65:0.45;
      ctx.fillRect(px,py,1,1);
    });
    ctx.globalAlpha=1;
    (state.settlements||[]).forEach(s=>{
      const people=(state.npcs||[]).filter(n=>n?.alive&&n.settlementId===s.id);
      if(!people.length)return;
      const [sx,sy]=screen(Number(s.x)||0,Number(s.y)||0);
      if(sx<-20||sx>340||sy<-20||sy>200)return;
      const counts={farm:0,craft:0,trade:0,military:0,knowledge:0,civilian:0};
      people.forEach(n=>counts[category(n)]++);
      const labels=[['farm',8,4],['craft',-11,-3],['trade',-4,9],['military',8,-6],['knowledge',-10,6],['civilian',-2,-11]];
      labels.forEach(([k,dx,dy])=>{if(counts[k]){ctx.globalAlpha=.55;ctx.fillRect(Math.floor(sx+dx),Math.floor(sy+dy),Math.min(6,Math.max(1,Math.ceil(counts[k]/6))),1);}});
    });
    ctx.restore();
  }
  window.EVERGLEN_NPC_ACTIVITY_ROUTES={draw,targetFor};
  registry.register({name:'npc-activity-routes',priority:285,draw});
})();
