(async () => {
  try {
    const loadScript = src => new Promise((resolve, reject) => {
      const script = document.createElement('script'); script.src = src;
      script.onload = resolve; script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.body.appendChild(script);
    });
    const loadPatchedSource = async (src, patcher) => {
      const response = await fetch(src, {cache:'no-store'}); if (!response.ok) throw new Error(`${src} returned ${response.status}`);
      const source = await response.text(), patched = patcher ? patcher(source) : source;
      const script = document.createElement('script'); script.textContent = patched; document.body.appendChild(script);
    };
    await loadPatchedSource('simulation.js', source => {
      const marker = source.lastIndexOf('})();'); if (marker < 0) throw new Error('simulation.js bootstrap marker not found');
      let patched = source.replace(/function moveArmies\(\)\{[\s\S]*?\nfunction recomputeTerritory/, match => match.replace(/a\.supply=clamp\(a\.supply-\.02\*state\.speed,0,100\)\}\}\}\nfunction recomputeTerritory/, 'a.supply=clamp(a.supply-.02*state.speed,0,100)}});}\nfunction recomputeTerritory'));
      patched = patched.replace(/function controls\(\)\{[\s\S]*?\nfunction eventAction/, `function controls(){canvas.addEventListener('click',e=>{const p={x:(e.offsetX-canvas.clientWidth/2)/state.camera.zoom+state.camera.x,y:(e.offsetY-canvas.clientHeight/2)/state.camera.zoom+state.camera.y};let hit=null,bd=16/state.camera.zoom;alive().forEach(n=>{const d=dist(n,p);if(d<bd){hit=n;bd=d}});if(hit){state.selected=hit.id;render()}});canvas.addEventListener('wheel',e=>{e.preventDefault();state.camera.zoom=clamp(state.camera.zoom*(e.deltaY<0?1.1:.9),.45,3);render()},{passive:false});canvas.addEventListener('mousedown',e=>{state.dragging=true;state.dragStart={x:e.clientX,y:e.clientY,cx:state.camera.x,cy:state.camera.y}});window.addEventListener('mouseup',()=>state.dragging=false);window.addEventListener('mousemove',e=>{if(!state.dragging)return;state.camera.x=state.dragStart.cx-(e.clientX-state.dragStart.x)/state.camera.zoom;state.camera.y=state.dragStart.cy-(e.clientY-state.dragStart.y)/state.camera.zoom;render()})}\nfunction eventAction`);
      return patched.slice(0, marker)+'\nwindow.SIM_STATE=state; window.SIM_RENDER=render;\n'+patched.slice(marker);
    });
    await loadScript('logistics.js');
    await loadScript('trait_expansion.js');
    const traitResponse = await fetch('social_traits.js',{cache:'no-store'}); if(!traitResponse.ok)throw new Error(`social_traits.js returned ${traitResponse.status}`);
    const traitSource=await traitResponse.text(),traitMarker=traitSource.indexOf('  const SECONDARIES = {'); if(traitMarker<0)throw new Error('social_traits.js trait merge point not found');
    const traitScript=document.createElement('script'); traitScript.textContent=traitSource.slice(0,traitMarker)+'  Object.assign(TRAIT_PROFILES, window.EVERGLEN_TRAIT_PROFILES || {});\n\n'+traitSource.slice(traitMarker); document.body.appendChild(traitScript);
    await loadScript('social_combinations.js');
    await loadPatchedSource('npc_life_engine.js', source => {
      let patched=source.replace("f.bloodlineTraits=[...new Set([...(f.bloodlineTraits||[]),...child.traits.filter(t=>GENETIC.has(t)))].slice(0,12)];","f.bloodlineTraits=[...new Set([...(f.bloodlineTraits||[]),...child.traits.filter(t=>GENETIC.has(t))])].slice(0,12);");
      patched=patched.replace(`    if(role==='heir'){\n      add(n,'legitimate_heir');\n      add(n,'favored_heir');\n    }`,`    if(role==='heir' && has(n,'royal_blood') && !has(n,'illegitimate') && !has(n,'bastard_blood')){\n      add(n,'legitimate_heir');\n    }`);
      patched=patched.replace(`const heirs=alive().filter(x=>x.familyId===dead.familyId && x.id!==dead.id).sort((a,b)=>{\n      const ca=(a.childrenIds||[]).includes(dead.id)?2:0;\n      const cb=(b.childrenIds||[]).includes(dead.id)?2:0;\n      return cb-ca || (b.status||0)-(a.status||0) || b.age-a.age;\n    });`,`const heirs=alive().filter(x=>x.familyId===dead.familyId && x.id!==dead.id).sort((a,b)=>{\n      const ca=(a.parentIds||[]).includes(dead.id)?12:0;\n      const cb=(b.parentIds||[]).includes(dead.id)?12:0;\n      const caClaim=has(a,'legitimate_heir')?5:0;\n      const cbClaim=has(b,'legitimate_heir')?5:0;\n      return (cb+cbClaim)-(ca+caClaim) || (b.status||0)-(a.status||0) || b.age-a.age;\n    });`);
      patched=patched.replace("if(n.successionClaim>85&&has(n,'rebellious')||has(n,'rebel'))add(n,'strong_claim');","if(n.successionClaim>85&&(has(n,'rebellious')||has(n,'rebel')))add(n,'strong_claim');"); return patched;
    });
    await loadScript('npc_needs.js');
    await loadScript('npc_memory.js');
    await loadScript('npc_decisions.js');
    await loadScript('npc_behavior.js');
    await loadScript('world_generation.js');
    await loadScript('npc_visuals.js'); await loadScript('art_2d.js'); await loadScript('social_ui.js'); await loadScript('interaction_fix.js'); await loadScript('spawn_system.js');
  } catch(error){console.error('Everglen bootstrap failed:',error);const banner=document.createElement('div');banner.style.cssText='position:fixed;left:16px;bottom:16px;z-index:9999;padding:10px 14px;border-radius:10px;background:#421b24;color:#fff;font:12px Segoe UI,sans-serif;border:1px solid rgba(255,255,255,.15)';banner.textContent='Simulation bootstrap failed. Check the console for details.';document.body.appendChild(banner)}
})();
