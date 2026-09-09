// Everglen NPC identity overlay.
// The supplied Pixel Crawler Body_A renderer owns the NPC body and animation.
// This stage only adds deterministic identity/selection cues.
(() => {
  const state=window.SIM_STATE, registry=window.EVERGLEN_RENDER;
  if(!state||!registry)return;
  const military=new Set(['militia','soldier','archer','spearman','cavalry','knight','paladin','captain','general','marshal','berserker','bodyguard','guard','warrior','fighter','mercenary','raider']);
  const hash=(value,salt=0)=>{let h=2166136261>>>0;const text=`${value}|${salt}`;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}return(h>>>0)/4294967296;};
  const trait=(n,t)=>(Array.isArray(n.traits)&&n.traits.includes(t))||n.trait===t;
  const ageScale=n=>window.EVERGLEN_AGE_VISUALS?.visualScale?.(window.EVERGLEN_AGE_VISUALS.ageBand?.(n.age))||1;
  function draw(){
    const canvas=window.EVERGLEN_2D_ART?.canvas||document.getElementById('world2dCanvas');
    if(!canvas)return;const ctx=canvas.getContext('2d');if(!ctx||!state.camera)return;
    const z=state.camera.zoom||1,cx=160-state.camera.x*z/8,cy=90-state.camera.y*z/8;
    ctx.save();ctx.translate(cx,cy);ctx.scale(z/8,z/8);
    (state.npcs||[]).forEach(n=>{if(!n.alive)return;const x=n.x,y=n.y;if(x<-40||x>360||y<-40||y>220)return;const base=military.has(String(n.roleId||'').toLowerCase())?17:16,scale=ageScale(n)*(n.visual?.bodyScale||1),w=base*scale;
      if(trait(n,'immortal')||trait(n,'blessed')){ctx.save();ctx.globalAlpha=.55;ctx.fillStyle='#e6c35d';ctx.fillRect(Math.round(x-w*.3),Math.round(y-w*.98),Math.max(2,Math.round(w*.6)),1);ctx.restore();}
      if(trait(n,'cursed')){ctx.save();ctx.globalAlpha=.65;ctx.fillStyle='#876da7';ctx.fillRect(Math.round(x-w*.38),Math.round(y-w*1.02),1,2);ctx.fillRect(Math.round(x+w*.34),Math.round(y-w*1.02),1,2);ctx.restore();}
      if(n.id===state.selected){ctx.save();ctx.strokeStyle='#fff';ctx.globalAlpha=.95;ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(x,y-base*.48,base*.78*scale,0,Math.PI*2);ctx.stroke();ctx.restore();}
    });
    ctx.restore();
  }
  window.EVERGLEN_CANONICAL_ASSET_RENDER=true;
  window.EVERGLEN_IDENTITY_VISUALS={trait,ageScale};
  registry.register({name:'npc-identity-cues',priority:287,draw});
})();
