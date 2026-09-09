// Everglen population activity layer.
// Makes inhabited areas visibly busy without creating fake simulation entities.
(() => {
  'use strict';
  const state=window.SIM_STATE,art=window.EVERGLEN_2D_ART,registry=window.EVERGLEN_RENDER;
  if(!state||!art?.canvas||!registry)return;
  const ctx=art.canvas.getContext('2d');
  const screen=(x,y)=>{const z=state.camera?.zoom||1;return [160+(x-(state.camera?.x||0))*z/8,90+(y-(state.camera?.y||0))*z/8];};
  const roleSet={farm:new Set(['farmer','rancher','baker','cook','fisher','hunter','forager']),craft:new Set(['blacksmith','carpenter','weaver','mason','builder','engineer']),trade:new Set(['merchant','trader','shopkeeper','peddler']),military:new Set(['soldier','militia','archer','spearman','knight','captain','general','marshal']),knowledge:new Set(['scholar','teacher','scribe','librarian'])};
  const roleOf=n=>String(n.roleId||n.professionId||'citizen').toLowerCase();
  function drawActivity(){
    const npcs=(state.npcs||[]).filter(n=>n.alive&&n.settlementId);
    const groups=new Map();
    npcs.forEach(n=>{if(!groups.has(n.settlementId))groups.set(n.settlementId,[]);groups.get(n.settlementId).push(n);});
    ctx.save();
    groups.forEach((people,id)=>{
      const s=(state.settlements||[]).find(v=>v.id===id);if(!s)return;
      const x=Number(s.x)||0,y=Number(s.y)||0;
      const [sx,sy]=screen(x,y);if(sx<-30||sx>350||sy<-30||sy>210)return;
      const counts={farm:0,craft:0,trade:0,military:0,knowledge:0};
      people.forEach(n=>{const r=roleOf(n);for(const k of Object.keys(counts))if(roleSet[k].has(r))counts[k]++;});
      const total=people.length;
      const dots=Math.min(18,Math.max(2,Math.floor(Math.sqrt(total)*1.8)));
      for(let i=0;i<dots;i++){
        const a=(i/dots)*Math.PI*2+(state.tick*.012),d=6+(i%5)*3;
        const px=Math.floor(sx+Math.cos(a)*d),py=Math.floor(sy+Math.sin(a)*d*.62);
        ctx.fillRect(px,py,1,1);
      }
      if(counts.farm>0)ctx.fillRect(Math.floor(sx+8),Math.floor(sy+5),Math.min(5,counts.farm),1);
      if(counts.craft>0)ctx.fillRect(Math.floor(sx-11),Math.floor(sy-3),Math.min(5,counts.craft),1);
      if(counts.trade>0)ctx.fillRect(Math.floor(sx-4),Math.floor(sy+10),Math.min(5,counts.trade),1);
      if(counts.military>0)ctx.fillRect(Math.floor(sx+8),Math.floor(sy-7),Math.min(5,counts.military),1);
      if(counts.knowledge>0)ctx.fillRect(Math.floor(sx-10),Math.floor(sy+7),Math.min(5,counts.knowledge),1);
    });
    ctx.restore();
  }
  window.EVERGLEN_POPULATION_VISUALS={draw:drawActivity};
  registry.register({name:'population-activity',priority:284,draw:drawActivity});
})();
