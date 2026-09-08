(() => {
  const state=window.SIM_STATE; if(!state)return;
  const render=window.SIM_RENDER; if(typeof render!=='function')return;
  const ctxOf=()=>document.getElementById('worldCanvas')?.getContext('2d');
  const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,v));
  function colors(n){const v=n.visual||{},map={plain:'#6d8a79',worker:'#87684e',merchant:'#8066a6',military:'#5f748b',noble:'#a98b57',royal:'#c6a24d'};return{skin:v.skin||'#b97950',hair:v.hair||'#2a211d',cloth:map[v.outfit||'plain']||map.plain};}
  function drawWorldOverlay(ctx){
    const g=state.worldGen;if(g){
      ctx.save();(g.biomes||[]).forEach(b=>{ctx.globalAlpha=.1;ctx.fillStyle={forest:'#4d8a50',highlands:'#b19b84',wetlands:'#4b8ea0',steppe:'#b49b56',coast:'#4d87a0',plains:'#8ab36e'}[b.biome]||'#777';ctx.beginPath();ctx.arc(b.x,b.y,24*b.scale,0,Math.PI*2);ctx.fill();});
      ctx.globalAlpha=.65;ctx.font='12px Segoe UI';(g.resources||[]).forEach(r=>{const glyph={iron:'◆',gold:'✦',stone:'■',wood:'♣',food:'•',cloth:'◇',medicine:'✚',reagents:'✧'}[r.type]||'•';ctx.fillStyle={iron:'#8590a0',gold:'#e4c76a',stone:'#a0a0a0',wood:'#7c9c67',food:'#95bf69',cloth:'#d6c5df',medicine:'#76cfa2',reagents:'#b78ce0'}[r.type]||'#aaa';ctx.fillText(glyph,r.x-4,r.y+4);});
      (g.landmarks||[]).forEach(l=>{ctx.strokeStyle=l.discovered?'#e5d08a':'rgba(229,208,138,.45)';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(l.x,l.y,7,0,Math.PI*2);ctx.stroke();});ctx.restore();
    }
    state.settlements?.forEach(s=>{
      const e=s.economy||{},radius=s.type==='kingdom'?26:s.type==='city'?19:12,prosperity=e.prosperity||35;
      ctx.save();ctx.globalAlpha=.16;ctx.fillStyle=prosperity>70?'#f2d476':'#8fc7a0';ctx.beginPath();ctx.arc(s.x,s.y,radius+4+prosperity*.035,0,Math.PI*2);ctx.fill();
      if((s.districts||[]).length){ctx.globalAlpha=.5;ctx.strokeStyle='#e6ddbd';ctx.lineWidth=1;ctx.beginPath();ctx.arc(s.x,s.y,radius+7,0,Math.PI*2);ctx.stroke();}
      ctx.restore();
    });
  }
  function drawRelationshipLinks(ctx,n){
    const rels=(n.relations||[]).filter(r=>r.score>42||r.score<-42).slice(0,10);
    rels.forEach(r=>{const t=state.npcs.find(x=>x.id===r.targetId&&x.alive);if(!t)return;ctx.save();ctx.globalAlpha=.28;ctx.strokeStyle=r.score<0?'#e97777':'#7ed39a';ctx.lineWidth=Math.max(.8,1.4/state.camera.zoom);ctx.beginPath();ctx.moveTo(n.x,n.y);ctx.lineTo(t.x,t.y);ctx.stroke();ctx.restore();});
  }
  function drawNPC(ctx,n){
    const v=n.visual||{},c=colors(n),s=v.bodyScale||1,r=v.ageBand==='child'?4.1:s*5;ctx.save();ctx.translate(n.x,n.y);
    if(v.mount){ctx.fillStyle='#76553d';ctx.beginPath();ctx.ellipse(0,5,8*s,4*s,0,0,Math.PI*2);ctx.fill();}
    ctx.fillStyle=c.cloth;ctx.beginPath();ctx.roundRect(-r*.72,-r*.05,r*1.44,r*1.65,r*.3);ctx.fill();
    ctx.fillStyle=c.skin;ctx.beginPath();ctx.arc(0,-r*.75,r*.62,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=c.hair;ctx.beginPath();ctx.arc(0,-r*.92,r*.7,Math.PI,Math.PI*2);ctx.fill();
    if(v.hairStyle==='braided')ctx.fillRect(r*.52,-r*.65,1.8*r,.7);
    if(v.outfit==='royal'){ctx.strokeStyle='#ead38a';ctx.lineWidth=1.5;ctx.strokeRect(-r*.78,-r*.1,r*1.56,r*1.7);ctx.fillStyle='#dfc56e';ctx.beginPath();ctx.arc(0,-r*1.42,r*.22,0,Math.PI*2);ctx.fill();}
    else if(v.outfit==='noble'){ctx.strokeStyle='#d9c08a';ctx.lineWidth=1.1;ctx.strokeRect(-r*.7,-r*.05,r*1.4,r*1.55);}
    if(v.weapon){ctx.strokeStyle='#d6d6d6';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(r*.65,.2*r);ctx.lineTo(r*1.55,-r*1.15);ctx.stroke();}
    if(n.traits?.includes('giant')){ctx.globalAlpha=.18;ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,r*1.8,0,Math.PI*2);ctx.stroke();}
    if(n.traits?.includes('immortal')||n.traits?.includes('blessed')){ctx.strokeStyle='#f4dd82';ctx.globalAlpha=.55;ctx.beginPath();ctx.arc(0,0,r*1.55,0,Math.PI*2);ctx.stroke();}
    if(n.needState==='critical'||(n.needs?.health??100)<30){ctx.strokeStyle='#ef7272';ctx.globalAlpha=.7;ctx.lineWidth=1.8;ctx.beginPath();ctx.arc(0,0,r*1.7,0,Math.PI*2);ctx.stroke();}
    if(state.war&&['soldier','militia','archer','spearman','knight','captain','general','marshal'].includes(n.roleId)){ctx.strokeStyle='#d9d9d9';ctx.globalAlpha=.55;ctx.lineWidth=1;ctx.beginPath();ctx.arc(0,0,r*1.35,0,Math.PI*2);ctx.stroke();}
    if(n.id===state.selected){ctx.strokeStyle='#fff';ctx.globalAlpha=.95;ctx.lineWidth=2.4;ctx.beginPath();ctx.arc(0,0,r*1.95,0,Math.PI*2);ctx.stroke();}
    ctx.restore();
  }
  window.EVERGLEN_NPC_VISUALS={drawNPC,drawWorldOverlay,drawRelationshipLinks};
  window.SIM_RENDER=()=>{
    render();const ctx=ctxOf(),canvas=document.getElementById('worldCanvas');if(!ctx||!canvas)return;
    ctx.save();ctx.translate(canvas.clientWidth/2-state.camera.x*state.camera.zoom,canvas.clientHeight/2-state.camera.y*state.camera.zoom);ctx.scale(state.camera.zoom,state.camera.zoom);
    drawWorldOverlay(ctx);
    const selected=state.npcs.find(n=>n.id===state.selected&&n.alive);if(selected)drawRelationshipLinks(ctx,selected);
    state.npcs.filter(n=>n.alive).forEach(n=>drawNPC(ctx,n));
    ctx.restore();
  };
  setInterval(()=>{if(state.running)window.SIM_RENDER();},850);
})();
