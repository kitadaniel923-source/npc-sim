// Uses the supplemental mega atlas in-world. Selection is deterministic, contextual,
// and the catalog sweep guarantees every imported source sprite is reachable.
(() => {
  const state=window.SIM_STATE, art=window.EVERGLEN_2D_ART, registry=window.EVERGLEN_RENDER;
  const assets=window.EVERGLEN_ASSET_REGISTRY;
  if(!state||!art?.canvas||!registry||!assets)return;
  const ctx=art.canvas.getContext('2d');
  const hash=(x,y,s=0)=>{const v=Math.sin(x*12.9898+y*78.233+s*37.719)*43758.5453;return v-Math.floor(v);};
  const toScreen=(x,y)=>{const z=state.camera.zoom||1;return[160+(x-state.camera.x)*z/8,90+(y-state.camera.y)*z/8];};
  const tagsForSettlement=s=>{
    const pop=state.npcs.filter(n=>n.alive&&n.settlementId===s.id).length;
    const tags=['village','house','nature'];
    if(pop>8)tags.push('market','tavern');
    if(pop>20)tags.push('blacksmith','architecture','fixture');
    if(pop>35)tags.push('castle','wall');
    return tags;
  };
  function draw(){
    if(!assets.ready)return;
    const settlements=state.settlements||[];
    settlements.forEach((s,si)=>{
      const [sx,sy]=toScreen(s.x,s.y);
      if(sx<-30||sx>350||sy<-30||sy>210)return;
      const tags=tagsForSettlement(s);
      for(let slot=0;slot<3;slot++){
        const seed=state.tick*3+si*31+slot*997;
        const px=sx-25+hash(si,slot,2)*50, py=sy-4+hash(si,slot,7)*24;
        const size=7+hash(si,slot,13)*7;
        assets.draw(ctx,tags,px-size/2,py-size,size,size,seed,hash(si,slot,17)>.5);
      }
    });
    (state.resources||[]).slice(0,18).forEach((r,i)=>{
      if(r.depleted)return;
      const [sx,sy]=toScreen(r.x,r.y); if(sx<-20||sx>340||sy<-20||sy>200)return;
      assets.draw(ctx,['ore','mineral','rock','resource'],sx-4,sy-8,8,8,state.tick+i*71);
    });
    for(let i=0;i<3;i++){
      const x=-520+i*390+Math.sin((state.tick+i*37)/35)*90,y=Math.sin(x/180)*100+80;
      const [sx,sy]=toScreen(x,y); if(sx<-30||sx>350||sy<-20||sy>200)continue;
      assets.draw(ctx,['boat','ship','raft','vessel','dock'],sx-8,sy-5,16,10,state.tick+i*101);
    }
    // Slow catalog sweep: one source sprite every 12 ticks, while the normal
    // contextual renderer continues to choose appropriate variants for the world.
    if(state.tick%12===0&&assets.stats.sourceSprites){
      const index=Math.floor(state.tick/12)%assets.stats.sourceSprites;
      const target=settlements[index%Math.max(1,settlements.length)];
      if(target){
        const [sx,sy]=toScreen(target.x,target.y);
        assets.drawCatalog(ctx,sx-5,sy-18,10,10,index,hash(index,3,17)>.5);
      }
    }
  }
  window.EVERGLEN_ASSET_INTEGRATION={draw};
  registry.register({name:'supplemental-assets',priority:275,draw});
})();
