// Everglen NPC identity visuals.
// Pixel Crawler Body_A is the primary animated NPC body. This stage is visual-only.
(() => {
  const state=window.SIM_STATE, registry=window.EVERGLEN_RENDER;
  if(!state||!registry)return;
  const canvas=window.EVERGLEN_2D_ART?.canvas||document.getElementById('world2dCanvas');
  const military=new Set(['militia','soldier','archer','spearman','cavalry','knight','paladin','captain','general','marshal','berserker','bodyguard','guard','warrior','fighter','mercenary','raider']);
  const hash=(value,salt=0)=>{let h=2166136261>>>0;const text=`${value}|${salt}`;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}return(h>>>0)/4294967296;};
  const trait=(n,t)=>(Array.isArray(n.traits)&&n.traits.includes(t))||n.trait===t;
  const ageScale=n=>window.EVERGLEN_AGE_VISUALS?.visualScale?.(window.EVERGLEN_AGE_VISUALS.ageBand?.(n.age))||1;

  const pc={ready:false,loading:false,error:null,image:null,manifest:null};
  async function loadPixelCrawler(){
    if(pc.loading||pc.ready)return; pc.loading=true;
    try{
      const [atlasRes,manifestRes]=await Promise.all([
        fetch('assets/everglen/pixel_crawler_runtime_atlas.b64'),
        fetch('assets/everglen/pixel_crawler_runtime_manifest.json')
      ]);
      if(!atlasRes.ok||!manifestRes.ok)throw new Error('Pixel Crawler runtime assets unavailable');
      // The checked-in .b64 path is a binary PNG blob despite its historical filename.
      // Read it as a Blob directly so the browser does not attempt UTF-8 decoding.
      const image=new Image();
      const url=URL.createObjectURL(await atlasRes.blob());
      await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;image.src=url;});
      pc.image=image; pc.manifest=await manifestRes.json(); pc.ready=true;
      window.EVERGLEN_PIXEL_CRAWLER={ready:true,source:'Pixel Crawler Free Pack 2.11',frame:pc.manifest.frame,animations:Object.keys(pc.manifest.animations||{}),error:null};
    }catch(e){
      pc.error=String(e?.message||e); window.EVERGLEN_PIXEL_CRAWLER={ready:false,error:pc.error};
      console.warn('Pixel Crawler load failed:',pc.error);
    }finally{pc.loading=false;}
  }
  loadPixelCrawler();

  const history=new Map();
  function movement(n){
    const id=String(n.id??`${n.x}:${n.y}`),p=history.get(id),x=Number(n.x)||0,y=Number(n.y)||0;
    const dx=p?x-p.x:0,dy=p?y-p.y:0,moving=Math.abs(dx)+Math.abs(dy)>.015;
    let direction=p?.direction||'down';
    if(Math.abs(dx)>Math.abs(dy)&&Math.abs(dx)>.01)direction='side';
    else if(Math.abs(dy)>.01)direction=dy<0?'up':'down';
    history.set(id,{x,y,direction});
    return{dx,dy,moving,direction};
  }
  function animationFor(n,m){
    const role=String(n.roleId||n.professionId||'').toLowerCase(),action=String(n.lastAction||n.action||'').toLowerCase();
    if(role==='fisher'||action.includes('fish'))return'fishing';
    if(['farmer','rancher','gardener'].includes(role)||action.includes('water'))return'watering';
    if(['miner','blacksmith','mason'].includes(role)||action.includes('mine')||action.includes('crush'))return'crush';
    if(['woodcutter','hunter','forager'].includes(role)||action.includes('chop')||action.includes('collect'))return'collect';
    if(military.has(role)||action.includes('attack')||action.includes('fight')||action.includes('confront'))return(action.includes('pierce')||['archer','spearman'].includes(role))?'pierce':'slice';
    if(action.includes('hit'))return'hit';
    return m.moving?'walk':'idle';
  }
  function getFrame(n,now){
    if(!pc.ready)return null;
    const m=movement(n),animations=pc.manifest.animations||{};
    let animation=animationFor(n,m),direction=m.direction;
    let key=animation==='pierce'&&direction==='up'?'pierce|top':`${animation}|${direction}`;
    if(!animations[key]){animation=m.moving?'walk':'idle';key=`${animation}|${direction}`;}
    const sheet=animations[key]||animations['idle|down']; if(!sheet)return null;
    const count=Math.max(1,sheet.frames||1),fps=animation==='idle'?3:8;
    const index=Math.floor(now/1000*fps+hash(n.id||`${n.x}:${n.y}`,11)*count)%count;
    return{sheet,index,m,animation};
  }
  function drawBody(ctx,n,x,y,now){
    const f=getFrame(n,now); if(!f)return false;
    const scale=(n.visual?.bodyScale||1)*ageScale(n),size=(military.has(String(n.roleId||'').toLowerCase())?38:36)*scale;
    const m=f.sheet,srcX=m.x+f.index*m.frameW,srcY=m.y;
    ctx.save();ctx.imageSmoothingEnabled=false;
    if(f.m.direction==='side'&&f.m.dx<0){ctx.translate(Math.round(x+size/2),Math.round(y));ctx.scale(-1,1);ctx.drawImage(pc.image,srcX,srcY,m.frameW,m.frameH,Math.round(-size/2),Math.round(-size),Math.round(size),Math.round(size));}
    else ctx.drawImage(pc.image,srcX,srcY,m.frameW,m.frameH,Math.round(x-size/2),Math.round(y-size),Math.round(size),Math.round(size));
    ctx.restore(); return true;
  }
  function draw(){
    if(!canvas)return; const ctx=canvas.getContext('2d'); if(!ctx||!state.camera)return;
    const z=state.camera.zoom||1,cx=160-state.camera.x*z/8,cy=90-state.camera.y*z/8,now=performance.now();
    ctx.save();ctx.translate(cx,cy);ctx.scale(z/8,z/8);
    (state.npcs||[]).forEach(n=>{
      if(!n.alive)return;const x=n.x,y=n.y;if(x<-40||x>360||y<-40||y>220)return;
      const scale=ageScale(n)*(n.visual?.bodyScale||1),base=military.has(String(n.roleId||'').toLowerCase())?17:16;
      drawBody(ctx,n,x,y,now);
      if(trait(n,'immortal')||trait(n,'blessed')){ctx.save();ctx.globalAlpha=.55;ctx.fillStyle='#e6c35d';ctx.fillRect(Math.round(x-base*.3),Math.round(y-base*.98),Math.max(2,Math.round(base*.6)),1);ctx.restore();}
      if(trait(n,'cursed')){ctx.save();ctx.globalAlpha=.65;ctx.fillStyle='#876da7';ctx.fillRect(Math.round(x-base*.38),Math.round(y-base*1.02),1,2);ctx.fillRect(Math.round(x+base*.34),Math.round(y-base*1.02),1,2);ctx.restore();}
      if(n.id===state.selected){ctx.save();ctx.strokeStyle='#fff';ctx.globalAlpha=.95;ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(x,y-base*.48,base*.78*scale,0,Math.PI*2);ctx.stroke();ctx.restore();}
    });
    ctx.restore();
  }
  window.EVERGLEN_CANONICAL_ASSET_RENDER=true;
  window.EVERGLEN_IDENTITY_VISUALS={trait,ageScale,animationFor,getFrame};
  registry.register({name:'npc-identity-pixel-crawler',priority:290,draw});
})();
