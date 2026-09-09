// Everglen imported-world asset loader.
// Loads manifests/atlases and exposes the canonical static asset catalog.
(() => {
  'use strict';
  const state = window.SIM_STATE;
  const art = window.EVERGLEN_2D_ART;
  if (!state || !art?.canvas) return;
  const root='assets/everglen/', images={}, manifest={};
  const loadImage=src=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=root+src;});
  Promise.all([
    fetch(root+'terrain_manifest.json').then(r=>r.json()),fetch(root+'world_manifest.json').then(r=>r.json()),
    fetch(root+'characters_manifest.json').then(r=>r.json()),fetch(root+'structures_manifest.json').then(r=>r.json()),
    fetch(root+'plants_manifest.json').then(r=>r.json()),fetch(root+'ruins_manifest.json').then(r=>r.json()),fetch(root+'race_prof_manifest.json').then(r=>r.json()),
    loadImage('terrain_atlas.webp'),loadImage('world_atlas.webp'),loadImage('characters_atlas.webp'),loadImage('structures_atlas.webp'),
    loadImage('plants_atlas.png'),loadImage('ruins_atlas.png'),loadImage('race_prof_atlas.webp')
  ]).then(([t,w,c,s,p,r,rp,ti,wi,ci,si,pi,ri,rpi])=>{
    manifest.terrain=t.atlas;manifest.world=w.atlas;manifest.characters=c.atlas;manifest.structures=s.atlas;
    manifest.plants=p.atlas;manifest.ruins=r.atlas;manifest.raceProf=rp.races;
    images.terrain=ti;images.world=wi;images.characters=ci;images.structures=si;images.plants=pi;images.ruins=ri;images.raceProf=rpi;
    window.EVERGLEN_ASSETS={manifest,images,ready:true};
    window.EVERGLEN_ASSET_LOADER={ready:true,manifest,images};
    window.EVERGLEN_RENDER?.run?.({state});
  }).catch(error=>{
    window.EVERGLEN_ASSET_LOADER={ready:false,error};
    console.error('Everglen imported asset load failed',error);
  });
})();
