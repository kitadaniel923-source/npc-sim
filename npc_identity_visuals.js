// Everglen NPC identity visuals.
// Imported race/profession pixel assets are the canonical NPC body.
// Imported equipment assets are layered on top when available.
// Animation is driven by the simulation tick, so rendering stays timer-free.
(() => {
  const state=window.SIM_STATE, registry=window.EVERGLEN_RENDER;
  if(!state||!registry)return;
  window.EVERGLEN_CANONICAL_ASSET_RENDER=true;
  const canvas=window.EVERGLEN_2D_ART?.canvas||document.getElementById('world2dCanvas')||document.getElementById('worldCanvas');
  const hash=(value,salt=0)=>{let h=2166136261>>>0;const text=`${value}|${salt}`;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}return(h>>>0)/4294967296;};
  const militaryRoles=new Set(['militia','soldier','archer','spearman','cavalry','knight','paladin','captain','general','marshal','berserker','bodyguard']);
  const professionVisual={farmer:'farmer',miner:'blacksmith',woodcutter:'woodcutter',builder:'blacksmith',blacksmith:'blacksmith',armorer:'blacksmith',carpenter:'woodcutter',weaver:'farmer',baker:'farmer',cook:'farmer',healer:'apothecary',doctor:'apothecary',merchant:'banker',trader:'banker',shipwright:'woodcutter',sailor:'farmer',scholar:'apothecary',teacher:'apothecary',engineer:'blacksmith',architect:'blacksmith',hunter:'woodcutter',forager:'farmer',fisher:'farmer',thief:'banker',burglar:'banker',bandit:'blacksmith',smuggler:'banker',spy:'banker',cleric:'apothecary',druid:'apothecary',mage:'apothecary',wizard:'apothecary',alchemist:'apothecary',enchanter:'apothecary',mason:'blacksmith',herbalist:'apothecary',peddler:'banker',innkeeper:'farmer',shopkeeper:'banker',beastmaster:'woodcutter',farrier:'blacksmith',artist:'farmer',musician:'farmer',courier:'farmer',scribe:'apothecary',lawkeeper:'blacksmith',tax_collector:'banker',judge:'banker',librarian:'apothecary',furniture_maker:'woodcutter'};
  const ageScale=n=>window.EVERGLEN_AGE_VISUALS?.visualScale?.(window.EVERGLEN_AGE_VISUALS.ageBand?.(n.age))||1;
  const bodyProfile=n=>{const g=String(n.gender??n.sex??'').toLowerCase(),female=g==='f'||g==='female'||g==='woman';return{gender:female?'female':'male',width:(.94+hash(n.id||`${n.x}:${n.y}`,72)*.12)*(female?.97:1.02)};};
  function findAsset(race,visual){
    const reg=window.EVERGLEN_ASSET_REGISTRY;
    if(!reg?.ready)return null;
    const r=String(race||'human').toLowerCase(),v=String(visual||'farmer').toLowerCase();
    const exact=reg.sprites.find(s=>s.variant===0&&s.tags.includes(r)&&s.tags.includes(v));
    return exact||reg.sprites.find(s=>s.variant===0&&s.tags.includes(v)&&s.category==='character')||null;
  }
  function isMoving(n){
    const a=String(n.action||n.currentAction||n.behavior||n.state||'').toLowerCase();
    return a.includes('walk')||a.includes('travel')||a.includes('move')||a.includes('explore')||a.includes('patrol')||a.includes('trade')||a.includes('migrate');
  }
  function animationFrame(n){
    const phase=Math.floor((Number(state.tick)||0)/2)+Math.floor(hash(n.id||`${n.x}:${n.y}`,91)*4);
    return phase&3;
  }
  function drawAsset(ctx,n,sx,sy){
    const role=n.roleId||n.professionId||'farmer',visual=professionVisual[role]||'farmer',asset=findAsset(n.raceId,visual);
    if(!asset?.image)return false;
    const scale=(n.visual?.bodyScale||1)*ageScale(n),base=militaryRoles.has(role)?14:12,dh=base*1.08*scale,aspect=asset.w/Math.max(1,asset.h),profile=bodyProfile(n),dw=Math.max(4,dh*aspect*.88*profile.width),moving=isMoving(n),frame=animationFrame(n);
    const bob=moving?[0,-.35,0,.35][frame]:[0,-.18,0,.18][frame];
    const stride=moving?[0,.35,0,-.35][frame]:0;
    ctx.save();
    ctx.imageSmoothingEnabled=false;
    ctx.drawImage(asset.image,asset.x,asset.y,asset.w,asset.h,Math.round(sx-dw/2+stride),Math.round(sy-dh+bob),Math.round(dw),Math.round(dh));
    ctx.restore();
    return true;
  }
  function equipmentClass(n){const role=n.roleId||n.professionId||'citizen';if(militaryRoles.has(role)||['guard','warrior','fighter','mercenary','raider'].includes(role))return'weapon';if(['miner','blacksmith','armorer','builder','mason','carpenter','engineer','architect','farrier','furniture_maker'].includes(role))return'axe';if(['farmer','rancher','woodcutter','hunter','forager','fisher','beastmaster'].includes(role))return'axe';if(['merchant','trader','peddler','shopkeeper','banker','innkeeper'].includes(role))return'armor';return'equipment';}
  function drawEquipment(ctx,n,sx,sy,size){const reg=window.EVERGLEN_ASSET_REGISTRY;if(!reg?.ready)return false;const seed=Math.floor(hash(n.id||`${n.x}:${n.y}`,81)*100000),pick=reg.pick([equipmentClass(n),'equipment'],seed);if(!pick)return false;const h=Math.max(8,size*1.15),w=h*.72,ox=militaryRoles.has(n.roleId)?size*.52:size*.45,oy=militaryRoles.has(n.roleId)?size*.54:size*.42;return reg.drawSprite(ctx,pick,sx+ox,sy-oy,w,h,false);}
  function drawMarker(ctx,n,sx,sy,base,scale){if(n.id!==state.selected)return;ctx.save();ctx.strokeStyle='#fff';ctx.globalAlpha=.95;ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(sx,sy-base*.45,base*.8*scale,0,Math.PI*2);ctx.stroke();ctx.restore();}
  function draw(){
    if(!canvas)return;const ctx=canvas.getContext('2d');if(!ctx||!state.camera)return;const z=state.camera.zoom||1,cx=160-state.camera.x*z/8,cy=90-state.camera.y*z/8;
    ctx.save();ctx.translate(cx,cy);ctx.scale(z/8,z/8);
    (state.npcs||[]).forEach(n=>{if(!n.alive)return;const sx=n.x,sy=n.y;if(sx<-40||sx>360||sy<-40||sy>220)return;const scale=(n.visual?.bodyScale||1)*ageScale(n),base=militaryRoles.has(n.roleId)?14:12;if(drawAsset(ctx,n,sx,sy))drawEquipment(ctx,n,sx,sy,base*scale);drawMarker(ctx,n,sx,sy,base,scale);});
    ctx.restore();
  }
  window.EVERGLEN_IDENTITY_VISUALS={bodyProfile,professionVisual,findAsset,animationFrame,isMoving,equipmentClass};
  registry.register({name:'npc-identity-asset-fidelity',priority:285,draw});
})();
