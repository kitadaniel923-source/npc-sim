// Everglen supplemental asset integration layer.
// Optional runtime atlas: assets/everglen/supplemental_asset_atlas.webp + manifest.
// Keeps visual selection behind the canonical EVERGLEN_RENDER registry.
(() => {
  const state=window.SIM_STATE, art=window.EVERGLEN_2D_ART, registry=window.EVERGLEN_RENDER;
  if(!state||!art?.canvas||!registry)return;
  const root='assets/everglen/', canvas=art.canvas, ctx=canvas.getContext('2d');
  ctx.imageSmoothingEnabled=false;
  const status={ready:false,available:false,error:null,used:{},draws:0};
  const catalog={atlas:{},sources:{}}; let image=null;
  const load=async()=>{try{
    const [mr,ir]=await Promise.all([fetch(root+'supplemental_asset_manifest.json'),fetch(root+'supplemental_asset_atlas.webp')]);
    if(!mr.ok||!ir.ok)throw new Error('Supplemental atlas files are not present in this build.');
    const manifest=await mr.json(),blob=await ir.blob(); image=await createImageBitmap(blob);
    Object.assign(catalog,manifest); status.available=true; window.EVERGLEN_SUPPLEMENTAL_ASSETS={status,catalog};
  }catch(e){status.error=String(e?.message||e); console.info('Everglen supplemental assets unavailable:',status.error)}finally{status.ready=true;window.EVERGLEN_SUPPLEMENTAL_ASSETS={status,catalog};}};
  const hash=(x,y,s=17)=>{const v=Math.sin(x*12.9898+y*78.233+s*37.719)*43758.5453;return v-Math.floor(v)};
  const entries=prefix=>Object.entries(catalog.atlas||{}).filter(([k])=>k.startsWith(prefix));
  const pick=(list,seed)=>list.length?list[Math.abs(Math.floor(seed))%list.length]:null;
  const draw=(key,x,y,w,h)=>{const r=catalog.atlas?.[key];if(!r||!image)return false;ctx.drawImage(image,r.x,r.y,r.w,r.h,x,y,w,h);status.used[key]=(status.used[key]||0)+1;status.draws++;return true};
  const pos=(x,y,t)=>[t.cx+x*t.z/8,t.cy+y*t.z/8];
  function terrainVariation(t){const all=entries('overworld:ow_terrain_base_');if(!all.length)return;for(let sy=0;sy<180;sy+=8)for(let sx=0;sx<320;sx+=8){const wx=(sx-t.cx)*8/t.z,wy=(sy-t.cy)*8/t.z;if(hash(Math.floor(wx/8),Math.floor(wy/8),53)>.88){const hit=pick(all,hash(wx,wy,51)*all.length);if(hit)draw(hit[0],sx,sy,8,8)}}}
  function nature(t){const all=entries('overworld:ow_props_nature_');if(!all.length)return;for(let x=-1100;x<1100;x+=72)for(let y=-720;y<720;y+=72){if(hash(x/72,y/72,61)<.72)continue;const[sx,sy]=pos(x,y,t);if(sx<-12||sx>332||sy<-12||sy>192)continue;const hit=pick(all,hash(x,y,62)*all.length);if(hit)draw(hit[0],sx-4,sy-7,8,8)}}
  function rocks(t){const all=entries('rocks:rockpack_');if(!all.length)return;(state.resources||[]).forEach((r,i)=>{if(r?.depleted||typeof r.x!=='number'||typeof r.y!=='number')return;const[sx,sy]=pos(r.x,r.y,t);if(sx<-12||sx>332||sy<-12||sy>192)return;const hit=pick(all,i+Math.floor(state.tick/90));if(hit)draw(hit[0],sx-6,sy-6,12,12)})}
  const oreMap={coal:'ore_coal',iron:'ore_iron_ore',gold:'ore_gold_ore',copper:'ore_copper_ore',diamond:'ore_diamond',emerald:'ore_emerald',lapis:'ore_lapis',redstone:'ore_redstone'};
  function ores(t){const all=entries('mystic_ores:ore_');if(!all.length)return;(state.resources||[]).forEach((r,i)=>{if(r?.depleted||typeof r.x!=='number'||typeof r.y!=='number')return;const type=String(r.type||r.resource||r.kind||'').toLowerCase(),mapped=oreMap[type],key=mapped&&catalog.atlas?.['mystic_ores:'+mapped]?'mystic_ores:'+mapped:pick(all,i)?.[0];const[sx,sy]=pos(r.x,r.y,t);if(key&&sx>-10&&sx<330&&sy>-10&&sy<190)draw(key,sx+4,sy-7,7,7)})}
  function vessels(t){const all=entries('vessels:vessel_');if(!all.length)return;for(let i=0;i<3;i++){const x=-650+i*420+Math.sin((state.tick+i*41)/40)*80,y=80+Math.sin(x/170)*100,[sx,sy]=pos(x,y,t),hit=pick(all,i+Math.floor(state.tick/30));if(!hit||sx<-20||sx>340||sy<-20||sy>200)continue;const r=catalog.atlas[hit[0]],frames=r.frames||3,fw=r.w/frames,fi=Math.floor(state.tick/12)%frames;ctx.drawImage(image,r.x+fi*fw,r.y,fw,r.h,sx-8,sy-5,16,9);status.used[hit[0]]=(status.used[hit[0]]||0)+1;status.draws++}}
  function settlementProps(t){const groups=['mega_props:mp_Tiles_VillageProps_','mega_props:mp_Tiles_VillageFixtures_','mega_props:mp_Tiles_Market_','mega_props:mp_Tiles_Blacksmith_','mega_props:mp_Tiles_Tavern_','mega_props:mp_Tiles_Architecture_','mega_props:mp_Tiles_Adventure_','mega_props:mp_Tiles_Nature_'];(state.settlements||[]).forEach((s,si)=>{const pop=(state.npcs||[]).filter(n=>n.alive&&n.settlementId===s.id).length,group=groups[si%groups.length],all=entries(group);if(!all.length)return;const count=Math.min(6,2+Math.floor(pop/12));for(let i=0;i<count;i++){const hit=pick(all,si*17+i+Math.floor(state.tick/180)),wx=s.x-18+(i%3)*18,wy=s.y+14+Math.floor(i/3)*12,[sx,sy]=pos(wx,wy,t);if(hit&&sx>-15&&sx<335&&sy>-15&&sy<195)draw(hit[0],sx-5,sy-6,10,10)}})}
  function kingdomTerrain(t){const sets=['acker','duneveil','frosthold','knochen','korallen','lichtung','pilze','pilzfeld'];sets.forEach((set,si)=>{const all=entries('kingdom:king_'+set+'_'),s=state.settlements?.[si];if(!all.length||!s)return;for(let i=0;i<2;i++){const[sx,sy]=pos(s.x+(i?12:-12),s.y-10,t),hit=pick(all,Math.floor(state.tick/120)+i*7);if(hit&&sx>-15&&sx<335&&sy>-15&&sy<195)draw(hit[0],sx-5,sy-5,10,10)}})}
  function military(t){const all=entries('knights:knight_');if(!all.length)return;const roles=new Set(['militia','soldier','archer','spearman','cavalry','knight','paladin','captain','general','marshal']);(state.npcs||[]).forEach((n,i)=>{if(!n.alive||!roles.has(n.roleId))return;const[sx,sy]=pos(n.x,n.y,t);if(sx<-15||sx>335||sy<-20||sy>200)return;const action=n.aiDecision?.action,token=action==='confront'?'attack_1':action==='train'?'defend':'walk',c=all.filter(([k])=>k.includes('_'+token)),hit=pick(c.length?c:all,i+Math.floor(state.tick/5));if(hit){const r=catalog.atlas[hit[0]],frames=r.frames||1,fw=r.w/frames,fi=Math.floor(state.tick/5)%frames;draw(hit[0],sx-7,sy-14,14,14,fw,fi)}})}
  function render(){if(!status.available||!image)return;const z=state.camera?.zoom||1,t={z,cx:160-(state.camera?.x||0)*z/8,cy:90-(state.camera?.y||0)*z/8};terrainVariation(t);nature(t);rocks(t);ores(t);kingdomTerrain(t);settlementProps(t);vessels(t);military(t)}
  registry.register({name:'supplemental-assets',priority:275,draw:render});
  window.EVERGLEN_SUPPLEMENTAL_ASSETS={status,catalog}; load();
})();
