(() => {
  const state=window.SIM_STATE; if(!state)return;
  const render=window.SIM_RENDER; if(typeof render!=='function')return;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const ctxOf=()=>document.getElementById('worldCanvas')?.getContext('2d');
  function colors(n){
    const v=n.visual||{};
    const outfit=v.outfit||'plain';
    const map={plain:'#6d8a79',worker:'#87684e',merchant:'#8066a6',military:'#5f748b',noble:'#a98b57',royal:'#c6a24d'};
    return {skin:v.skin||'#b97950',hair:v.hair||'#2a211d',cloth:map[outfit]||map.plain};
  }
  function drawNPC(ctx,n){
    const v=n.visual||{},c=colors(n),s=(v.bodyScale||1);
    const r=v.ageBand==='child'?4.1:s*5;
    ctx.save();
    ctx.translate(n.x,n.y);
    if(v.mount){ctx.fillStyle='#76553d';ctx.beginPath();ctx.ellipse(0,5,8*s,4*s,0,0,Math.PI*2);ctx.fill();}
    ctx.fillStyle=c.cloth;ctx.beginPath();ctx.roundRect(-r*.72,-r*.05,r*1.44,r*1.65,r*.3);ctx.fill();
    ctx.fillStyle=c.skin;ctx.beginPath();ctx.arc(0,-r*.75,r*.62,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=c.hair;ctx.beginPath();ctx.arc(0,-r*.92,r*.7,Math.PI,Math.PI*2);ctx.fill();
    if(v.hairStyle==='braided'){ctx.fillRect(r*.52,-r*.65,1.8*r,.7);}
    if(v.outfit==='royal'){ctx.strokeStyle='#ead38a';ctx.lineWidth=1.5;ctx.strokeRect(-r*.78,-r*.1,r*1.56,r*1.7);ctx.fillStyle='#dfc56e';ctx.beginPath();ctx.arc(0,-r*1.42,r*.22,0,Math.PI*2);ctx.fill();}
    else if(v.outfit==='noble'){ctx.strokeStyle='#d9c08a';ctx.lineWidth=1.1;ctx.strokeRect(-r*.7,-r*.05,r*1.4,r*1.55);}
    if(v.weapon){ctx.strokeStyle='#d6d6d6';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(r*.65,.2*r);ctx.lineTo(r*1.55,-r*1.15);ctx.stroke();}
    if(n.traits?.includes('giant')){ctx.globalAlpha=.18;ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,r*1.8,0,Math.PI*2);ctx.stroke();}
    if(n.traits?.includes('dwarf')){ctx.scale(.82,.92);}
    if(n.traits?.includes('immortal')||n.traits?.includes('blessed')){ctx.strokeStyle='#f4dd82';ctx.globalAlpha=.55;ctx.beginPath();ctx.arc(0,0,r*1.55,0,Math.PI*2);ctx.stroke();}
    ctx.restore();
  }
  window.EVERGLEN_NPC_VISUALS={drawNPC};
  window.SIM_RENDER=()=>{
    render();
    const ctx=ctxOf(); if(!ctx)return;
    const canvas=document.getElementById('worldCanvas');
    ctx.save();
    ctx.translate(canvas.clientWidth/2-state.camera.x*state.camera.zoom,canvas.clientHeight/2-state.camera.y*state.camera.zoom);
    ctx.scale(state.camera.zoom,state.camera.zoom);
    state.npcs.filter(n=>n.alive).forEach(n=>drawNPC(ctx,n));
    ctx.restore();
  };
  setInterval(()=>{if(state.running)window.SIM_RENDER();},850);
})();
