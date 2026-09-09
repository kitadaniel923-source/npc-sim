// Everglen Pixel Crawler NPC renderer.
// Canonical NPC body renderer with imported race/profession identity cues.
// Visual pass: larger readable bodies, depth sorting, shadows, role/race accents,
// and a procedural fallback so the population never disappears while assets load.
(() => {
  const state=window.SIM_STATE,registry=window.EVERGLEN_RENDER;
  if(!state||!registry)return;
  const pc=window.EVERGLEN_PIXEL_CRAWLER,history=new Map();
  let identityCatalog=null,identityImage=null,identityLoading=false;
  const military=new Set(['militia','soldier','archer','spearman','cavalry','knight','paladin','captain','general','marshal','berserker','bodyguard','guard','warrior','fighter','mercenary','raider','ranger']);
  const worker=new Set(['farmer','miner','woodcutter','builder','blacksmith','armorer','carpenter','weaver','baker','cook','healer','merchant','trader','shipwright','sailor','scholar','teacher','engineer','architect','hunter','forager','fisher']);
  const trait=(n,t)=>(Array.isArray(n.traits)&&n.traits.includes(t))||n.trait===t;
  const hash=(v,s=0)=>{let h=2166136261>>>0,x=`${v}|${s}`;for(let i=0;i<x.length;i++){h^=x.charCodeAt(i);h=Math.imul(h,16777619);}return(h>>>0)/4294967296;};
  const ageScale=n=>window.EVERGLEN_AGE_VISUALS?.visualScale?.(window.EVERGLEN_AGE_VISUALS.ageBand?.(n.age))||1;
  function movement(n){const id=String(n.id??`${n.x}:${n.y}`),p=history.get(id),x=Number(n.x)||0,y=Number(n.y)||0;let dx=0,dy=0;if(p){dx=x-p.x;dy=y-p.y;}const moving=Math.abs(dx)+Math.abs(dy)>.015;let dir=p?.dir||'down';if(Math.abs(dx)>Math.abs(dy)&&Math.abs(dx)>.01)dir='side';else if(Math.abs(dy)>.01)dir=dy<0?'up':'down';history.set(id,{x,y,dir});return{moving,dir,dx,dy};}
  function identity(n){const map=pc?.roles||{},role=String(n.roleId||n.professionId||'').toLowerCase(),race=String(n.raceId||n.race||'human').toLowerCase(),profession=String(n.professionId||n.profession||role).toLowerCase();return{role,race,profession,roleMode:map.roles?.[role]||map.professionDefaults?.[profession]||map.default||'idle',raceScale:Number(map.races?.[race]?.scale)||1};}
  function animation(n,m,id){const a=String(n.aiDecision?.action||n.lastAction||'').toLowerCase();if(military.has(id.role)||/attack|fight|confront|train/.test(a))return'moving_combat';if(/fish/.test(a)||id.role==='fisher')return'moving';if(/water|farm|plant/.test(a)||id.role==='farmer')return'moving';if(id.roleMode==='run')return m.moving?'moving_combat':'idle';return m.moving?'moving':'idle';}
  function sheetFor(kind,dir){const a=pc?.manifest?.animations||{};const key=kind==='moving_combat'?`run|${dir}`:kind==='moving'?`walk|${dir}`:`idle|${dir}`;return a[key]||a[`idle|${dir}`]||a['idle|down'];}
  async function loadIdentity(){if(identityLoading||identityImage)return;identityLoading=true;try{const [m,a]=await Promise.all([fetch('assets/everglen/race_prof_manifest.json').then(r=>r.json()),fetch('assets/everglen/race_prof_atlas.webp')]);if(!a.ok)throw new Error('race_prof_atlas unavailable');const blob=await a.blob(),url=URL.createObjectURL(blob),im=new Image();im.decoding='async';await new Promise((resolve,reject)=>{im.onload=()=>{URL.revokeObjectURL(url);resolve();};im.onerror=reject;im.src=url;});identityCatalog=m;identityImage=im;window.EVERGLEN_NPC_IDENTITY_ASSETS={ready:true,manifest:m,image:im};}catch(e){window.EVERGLEN_NPC_IDENTITY_ASSETS={ready:false,error:String(e?.message||e)};}finally{identityLoading=false;}}
  function professionBucket(prof,role){const p=String(prof||role||'').toLowerCase();if(['blacksmith','armorer'].includes(p))return'blacksmith';if(['merchant','trader','banker'].includes(p))return'banker';if(['healer','doctor','mage','wizard','alchemist','apothecary'].includes(p))return'apothecary';if(['woodcutter','carpenter','miner','fisher'].includes(p))return'woodcutter';return'farmer';}
  function drawIdentityCue(ctx,n,id){if(!identityImage||!identityCatalog)return;const race=identityCatalog.races?.[id.race]||identityCatalog.races?.human,bucket=professionBucket(id.profession,id.role),r=race?.[bucket]||identityCatalog.races?.human?.[bucket];if(!r)return;const s=.52*(n.visual?.bodyScale||1)*ageScale(n),w=Math.max(6,Math.round(r.w*s)),h=Math.max(8,Math.round(r.h*s));ctx.globalAlpha=.84;ctx.drawImage(identityImage,r.x,r.y,r.w,r.h,Math.round(n.x-w/2),Math.round(n.y-h*.92),w,h);ctx.globalAlpha=1;}
  function drawFallback(ctx,n,id,m,size){
    const x=Math.round(n.x),y=Math.round(n.y),s=Math.max(5,size*.16),body=Math.max(7,size*.30),head=Math.max(4,size*.18);
    const race=id.race;
    const skin={human:'#e7b58d',dwarf:'#c98e69',elf:'#f0c6a1',orc:'#77a65d',halfling:'#d9a879'}[race]||'#e7b58d';
    const cloth={farmer:'#8f6a3c',miner:'#56616b',woodcutter:'#65482e',blacksmith:'#6b6b72',merchant:'#6b4f8c',healer:'#d9d9d9',soldier:'#4b5d72',archer:'#536f45',knight:'#9aa2ad'}[id.role]||n.color||'#6b7f9a';
    ctx.save();
    ctx.fillStyle='rgba(0,0,0,.28)';ctx.fillRect(x-Math.round(body*.65),y-Math.round(s*.02),Math.round(body*1.3),Math.max(1,Math.round(s*.18)));
    ctx.fillStyle=cloth;ctx.fillRect(x-Math.floor(body/2),y-body,body,body+Math.round(s*.35));
    ctx.fillStyle=skin;ctx.fillRect(x-Math.floor(head/2),y-body-head,head,head);
    if(military.has(id.role)){ctx.fillStyle='#303640';ctx.fillRect(x-Math.floor(head/2)-1,y-body-head-1,head+2,Math.max(2,Math.round(head*.38)));}
    else if(worker.has(id.role)){ctx.fillStyle='#b58a48';ctx.fillRect(x-Math.floor(head/2)-1,y-body-head-1,head+2,Math.max(1,Math.round(head*.22)));}
    if(id.race==='elf'){ctx.fillStyle=skin;ctx.fillRect(x-Math.floor(head/2)-2,y-body-head+1,2,Math.max(2,Math.floor(head*.65)));ctx.fillRect(x+Math.floor(head/2),y-body-head+1,2,Math.max(2,Math.floor(head*.65)));}
    ctx.restore();
  }
  function drawSelection(ctx,n,id,size){
    if(state.selected!==n.id)return;
    const x=Math.round(n.x),y=Math.round(n.y-size*.12),r=Math.max(5,size*.44);
    ctx.save();ctx.strokeStyle='rgba(255,245,180,.95)';ctx.lineWidth=Math.max(1,size*.055);ctx.beginPath();ctx.ellipse(x,y,r,r*.38,0,0,Math.PI*2);ctx.stroke();ctx.restore();
  }
  function drawLabel(ctx,n,id,size){
    if(!state.showNames)return;
    const important=state.selected===n.id||id.role==='mayor'||id.role==='king'||id.role==='duke'||id.role==='general';
    if(!important)return;
    const label=String(n.name||id.role||'NPC');
    ctx.save();ctx.font=`${Math.max(5,Math.round(size*.18))}px monospace`;ctx.textAlign='center';ctx.textBaseline='bottom';ctx.fillStyle='rgba(18,22,28,.82)';const w=ctx.measureText(label).width+4;ctx.fillRect(Math.round(n.x-w/2),Math.round(n.y-size-7),w,7);ctx.fillStyle='#fff';ctx.fillText(label,Math.round(n.x),Math.round(n.y-size-1));ctx.restore();
  }
  function activateCanonical(){if(!pc?.ready||!pc.image||!pc.manifest)return false;if(!window.EVERGLEN_CANONICAL_ASSET_RENDER){window.EVERGLEN_CANONICAL_ASSET_RENDER=true;const base=document.getElementById('worldCanvas');if(base)base.style.opacity='0';}return true;}
  function draw(){
    const canvas=window.EVERGLEN_2D_ART?.canvas||document.getElementById('world2dCanvas');
    if(!canvas)return;
    const ctx=canvas.getContext('2d');if(!ctx||!state.camera)return;
    const ready=!!(pc?.ready&&pc.image&&pc.manifest);if(ready)activateCanonical();
    if(identityCatalog===null&&!identityLoading)loadIdentity();
    const z=state.camera.zoom||1,cx=160-state.camera.x*z/8,cy=90-state.camera.y*z/8,now=performance.now();
    ctx.save();ctx.translate(cx,cy);ctx.scale(z/8,z/8);ctx.imageSmoothingEnabled=false;
    const npcs=(state.npcs||[]).filter(n=>n.alive).slice().sort((a,b)=>(Number(a.y)||0)-(Number(b.y)||0));
    npcs.forEach(n=>{
      const m=movement(n),id=identity(n),kind=animation(n,m,id),sheet=sheetFor(kind,m.dir);
      const speed=Math.max(.5,Number(n.visual?.animationSpeed)||1)*(trait(n,'swift')?1.15:(trait(n,'slow')?0.8:1));
      const fps=kind==='idle'?3:kind==='moving_combat'?9:8;
      const scale=(n.visual?.bodyScale||1)*ageScale(n)*id.raceScale*(trait(n,'giant')?1.12:(trait(n,'dwarf')?0.88:1));
      const size=(military.has(id.role)?70:64)*scale;
      if(sheet&&ready){
        const frame=Math.floor(now/1000*fps*speed+hash(n.id||`${n.x}:${n.y}`,11)*sheet.frames)%sheet.frames,srcX=sheet.x+frame*sheet.frameW,sx=n.x,sy=n.y;
        ctx.save();
        ctx.fillStyle='rgba(0,0,0,.25)';ctx.fillRect(Math.round(sx-size*.24),Math.round(sy-size*.04),Math.round(size*.48),Math.max(1,Math.round(size*.07)));
        if(m.dir==='side'&&m.dx<0){ctx.translate(Math.round(sx),0);ctx.scale(-1,1);ctx.drawImage(pc.image,srcX,sheet.y,sheet.frameW,sheet.frameH,Math.round(-size/2),Math.round(sy-size),Math.round(size),Math.round(size));}
        else ctx.drawImage(pc.image,srcX,sheet.y,sheet.frameW,sheet.frameH,Math.round(sx-size/2),Math.round(sy-size),Math.round(size),Math.round(size));
        ctx.restore();
      }else drawFallback(ctx,n,id,m,size);
      drawIdentityCue(ctx,n,id);
      drawSelection(ctx,n,id,size);
      drawLabel(ctx,n,id,size);
    });
    ctx.restore();
  }
  window.EVERGLEN_CANONICAL_ASSET_RENDER=false;
  window.EVERGLEN_PIXEL_CRAWLER_NPC_RENDERER={draw,movement,identity,animation,sheetFor,professionBucket};
  registry.register({name:'npc-pixel-crawler',priority:286,draw});
})();