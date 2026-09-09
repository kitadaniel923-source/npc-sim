// Everglen Pixel Crawler NPC renderer.
// Canonical NPC body renderer with imported race/profession identity cues.
(() => {
  const state=window.SIM_STATE,registry=window.EVERGLEN_RENDER;
  if(!state||!registry)return;
  const pc=window.EVERGLEN_PIXEL_CRAWLER,history=new Map();
  let identityCatalog=null,identityImage=null,identityLoading=false;
  const military=new Set(['militia','soldier','archer','spearman','cavalry','knight','paladin','captain','general','marshal','berserker','bodyguard','guard','warrior','fighter','mercenary','raider','ranger']);
  const trait=(n,t)=>(Array.isArray(n.traits)&&n.traits.includes(t))||n.trait===t;
  const hash=(v,s=0)=>{let h=2166136261>>>0,x=`${v}|${s}`;for(let i=0;i<x.length;i++){h^=x.charCodeAt(i);h=Math.imul(h,16777619);}return(h>>>0)/4294967296;};
  const ageScale=n=>window.EVERGLEN_AGE_VISUALS?.visualScale?.(window.EVERGLEN_AGE_VISUALS.ageBand?.(n.age))||1;
  function movement(n){const id=String(n.id??`${n.x}:${n.y}`),p=history.get(id),x=Number(n.x)||0,y=Number(n.y)||0;let dx=0,dy=0;if(p){dx=x-p.x;dy=y-p.y;}const moving=Math.abs(dx)+Math.abs(dy)>.015;let dir=p?.dir||'down';if(Math.abs(dx)>Math.abs(dy)&&Math.abs(dx)>.01)dir='side';else if(Math.abs(dy)>.01)dir=dy<0?'up':'down';history.set(id,{x,y,dir});return{moving,dir,dx,dy};}
  function identity(n){const map=pc?.roles||{},role=String(n.roleId||n.professionId||'').toLowerCase(),race=String(n.raceId||n.race||'human').toLowerCase(),profession=String(n.professionId||n.profession||role).toLowerCase();return{role,race,profession,roleMode:map.roles?.[role]||map.professionDefaults?.[profession]||map.default||'idle',raceScale:Number(map.races?.[race]?.scale)||1};}
  function animation(n,m,id){const a=String(n.aiDecision?.action||n.lastAction||'').toLowerCase();if(military.has(id.role)||/attack|fight|confront|train/.test(a))return'moving_combat';if(/fish/.test(a)||id.role==='fisher')return'moving';if(/water|farm|plant/.test(a)||id.role==='farmer')return'moving';if(id.roleMode==='run')return m.moving?'moving_combat':'idle';return m.moving?'moving':'idle';}
  function sheetFor(kind,dir){const a=pc?.manifest?.animations||{};const key=kind==='moving_combat'?`run|${dir}`:kind==='moving'?`walk|${dir}`:`idle|${dir}`;return a[key]||a[`idle|${dir}`]||a['idle|down'];}
  async function loadIdentity(){if(identityLoading||identityImage)return;identityLoading=true;try{const [m,a]=await Promise.all([fetch('assets/everglen/race_prof_manifest.json').then(r=>r.json()),fetch('assets/everglen/race_prof_atlas.webp')]);if(!a.ok)throw new Error('race_prof_atlas unavailable');const blob=await a.blob(),url=URL.createObjectURL(blob),im=new Image();im.decoding='async';await new Promise((resolve,reject)=>{im.onload=()=>{URL.revokeObjectURL(url);resolve();};im.onerror=reject;im.src=url;});identityCatalog=m;identityImage=im;window.EVERGLEN_NPC_IDENTITY_ASSETS={ready:true,manifest:m,image:im};}catch(e){window.EVERGLEN_NPC_IDENTITY_ASSETS={ready:false,error:String(e?.message||e)};}finally{identityLoading=false;}}
  function professionBucket(prof,role){const p=String(prof||role||'').toLowerCase();if(['blacksmith','armorer'].includes(p))return'blacksmith';if(['merchant','trader','banker'].includes(p))return'banker';if(['healer','doctor','mage','wizard','alchemist','apothecary'].includes(p))return'apothecary';if(['woodcutter','carpenter','miner','fisher'].includes(p))return'woodcutter';return'farmer';}
  function drawIdentityCue(ctx,n,id){if(!identityImage||!identityCatalog)return;const race=identityCatalog.races?.[id.race]||identityCatalog.races?.human,bucket=professionBucket(id.profession,id.role),r=race?.[bucket]||identityCatalog.races?.human?.[bucket];if(!r)return;const s=.42*(n.visual?.bodyScale||1)*ageScale(n),w=Math.max(4,Math.round(r.w*s)),h=Math.max(6,Math.round(r.h*s));ctx.globalAlpha=.78;ctx.drawImage(identityImage,r.x,r.y,r.w,r.h,Math.round(n.x-w/2),Math.round(n.y-h*.92),w,h);ctx.globalAlpha=1;}
  function activateCanonical(){
    if(!pc?.ready||!pc.image||!pc.manifest)return false;
    if(!window.EVERGLEN_CANONICAL_ASSET_RENDER){
      window.EVERGLEN_CANONICAL_ASSET_RENDER=true;
      const base=document.getElementById('worldCanvas');
      if(base)base.style.opacity='0';
    }
    return true;
  }
  function draw(){const canvas=window.EVERGLEN_2D_ART?.canvas||document.getElementById('world2dCanvas');if(!canvas||!pc?.ready||!pc.image||!pc.manifest)return;activateCanonical();const ctx=canvas.getContext('2d');if(!ctx||!state.camera)return;loadIdentity();const z=state.camera.zoom||1,cx=160-state.camera.x*z/8,cy=90-state.camera.y*z/8,now=performance.now();ctx.save();ctx.translate(cx,cy);ctx.scale(z/8,z/8);ctx.imageSmoothingEnabled=false;(state.npcs||[]).forEach(n=>{if(!n.alive)return;const m=movement(n),id=identity(n),kind=animation(n,m,id),sheet=sheetFor(kind,m.dir);if(!sheet)return;const speed=Math.max(.5,Number(n.visual?.animationSpeed)||1)*(trait(n,'swift')?1.15:(trait(n,'slow')?0.8:1)),fps=kind==='idle'?3:kind==='moving_combat'?9:8,frame=Math.floor(now/1000*fps*speed+hash(n.id||`${n.x}:${n.y}`,11)*sheet.frames)%sheet.frames,scale=(n.visual?.bodyScale||1)*ageScale(n)*id.raceScale*(trait(n,'giant')?1.12:(trait(n,'dwarf')?0.88:1)),size=(military.has(id.role)?38:36)*scale,sx=n.x,sy=n.y,srcX=sheet.x+frame*sheet.frameW;ctx.save();if(m.dir==='side'&&m.dx<0){ctx.translate(Math.round(sx),0);ctx.scale(-1,1);ctx.drawImage(pc.image,srcX,sheet.y,sheet.frameW,sheet.frameH,Math.round(-size/2),Math.round(sy-size),Math.round(size),Math.round(size));}else ctx.drawImage(pc.image,srcX,sheet.y,sheet.frameW,sheet.frameH,Math.round(sx-size/2),Math.round(sy-size),Math.round(size),Math.round(size));ctx.restore();drawIdentityCue(ctx,n,id);});ctx.restore();}
  window.EVERGLEN_CANONICAL_ASSET_RENDER=false;window.EVERGLEN_PIXEL_CRAWLER_NPC_RENDERER={draw,movement,identity,animation,sheetFor,professionBucket};registry.register({name:'npc-pixel-crawler',priority:286,draw});
})();
