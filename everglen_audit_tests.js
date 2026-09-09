/* Everglen deep simulation invariant tests. Runtime-only diagnostics, no simulation ownership. */
(() => {
  'use strict';

  function arr(v){ return Array.isArray(v) ? v : []; }
  function idOf(v){ return v == null ? null : String(v); }
  function alive(n){ return !!n && n.alive !== false; }
  function finite(v){ return Number.isFinite(Number(v)); }
  function check(name, ok, detail=''){ return {name, ok:!!ok, detail:String(detail||'')}; }

  function test(){
    const state = window.SIM_STATE;
    const npcs=arr(state?.npcs);
    const settlements=arr(state?.settlements);
    const kingdoms=arr(state?.kingdoms);
    const families=arr(state?.families);
    const results=[];
    const aliveNpcs=npcs.filter(alive);
    const byId=new Map(npcs.map(n=>[idOf(n?.id),n]).filter(([id])=>id));

    results.push(check('state exists', !!state));
    results.push(check('NPC collection', Array.isArray(state?.npcs)));
    results.push(check('settlement collection', Array.isArray(state?.settlements)));
    results.push(check('kingdom collection', Array.isArray(state?.kingdoms)));

    const ids=npcs.map(n=>idOf(n?.id)).filter(Boolean);
    const uniqueIds=new Set(ids);
    results.push(check('unique NPC ids', ids.length===uniqueIds.size, `${ids.length} ids / ${uniqueIds.size} unique`));

    let badLinks=0, deadSpouse=0, badChildren=0, badParents=0, badFamilies=0;
    npcs.forEach(n=>{
      if(!n) return;
      const spouse=idOf(n.spouseId ?? n.partnerId);
      if(spouse){
        const p=byId.get(spouse);
        if(!p || p.alive===false || idOf(p.spouseId ?? p.partnerId)!==idOf(n.id)){ deadSpouse++; badLinks++; }
      }
      arr(n.childrenIds).forEach(cid=>{ const c=byId.get(idOf(cid)); if(!c || !arr(c.parentIds).map(idOf).includes(idOf(n.id))) badChildren++; });
      arr(n.parentIds).forEach(pid=>{ const p=byId.get(idOf(pid)); if(!p || !arr(p.childrenIds).map(idOf).includes(idOf(n.id))) badParents++; });
      if(n.familyId!=null && families.length){
        const f=families.find(x=>idOf(x?.id)===idOf(n.familyId));
        if(!f) badFamilies++;
      }
    });
    results.push(check('spouse symmetry', badLinks===0, `${deadSpouse} broken spouse links`));
    results.push(check('parent-child symmetry', badChildren===0 && badParents===0, `${badChildren} child links / ${badParents} parent links`));
    results.push(check('family references', badFamilies===0, `${badFamilies} NPCs reference missing families`));

    let badNumbers=0, negativeWealth=0;
    npcs.forEach(n=>{
      ['age','wealth','gold','wallet','debt','reputation','honor'].forEach(k=>{ if(n[k]!=null && !finite(n[k])) badNumbers++; });
      if(Number(n.wealth)<0 || Number(n.wallet)<0) negativeWealth++;
    });
    results.push(check('finite NPC economic/demographic values', badNumbers===0, `${badNumbers} invalid numeric fields`));
    results.push(check('non-negative personal cash', negativeWealth===0, `${negativeWealth} NPCs below zero`));

    let badProperty=0, badOwner=0;
    const seenOwners=new Map();
    npcs.forEach(n=>arr(n?.property?.assets).forEach(a=>{
      if(!a) return;
      if(a.ownerId!=null && !byId.has(idOf(a.ownerId))) badOwner++;
      if(a.id!=null){
        const key=idOf(a.id); if(seenOwners.has(key) && seenOwners.get(key)!==idOf(n.id)) badProperty++; else seenOwners.set(key,idOf(n.id));
      }
    }));
    results.push(check('property owner references', badOwner===0, `${badOwner} assets reference missing NPCs`));
    results.push(check('property unique ownership records', badProperty===0, `${badProperty} duplicated asset ownership records`));

    let badSettlement=0;
    aliveNpcs.forEach(n=>{ if(n.settlementId!=null && settlements.length && !settlements.some(s=>idOf(s?.id)===idOf(n.settlementId))) badSettlement++; });
    results.push(check('NPC settlement references', badSettlement===0, `${badSettlement} invalid settlement links`));

    let badFiniteFamilies=0;
    families.forEach(f=>{
      ['wealth','prestige','legacy','economicPower','netWorth'].forEach(k=>{ if(f[k]!=null && !finite(f[k])) badFiniteFamilies++; });
    });
    results.push(check('finite family metrics', badFiniteFamilies===0, `${badFiniteFamilies} invalid family metrics`));

    const systems=arr(state?.systems);
    const names=systems.map(s=>s?.name).filter(Boolean);
    const duplicateNames=names.filter((n,i)=>names.indexOf(n)!==i);
    results.push(check('unique simulation systems', duplicateNames.length===0, duplicateNames.join(', ')));

    const assets=window.EVERGLEN_ASSET_REGISTRY;
    results.push(check('supplemental asset registry', !!assets, assets?.error||'registry missing'));
    if(assets){
      results.push(check('supplemental asset atlas loaded', !!assets.ready, assets.error||`${assets.stats?.loadedSprites||0} sprites`));
      results.push(check('supplemental asset usage', (assets.stats?.draws||0)>0, `${assets.stats?.draws||0} supplemental draws`));
    }

    let causalReady=0, causalOutcomes=0, learnedPolicies=0;
    aliveNpcs.forEach(n=>{
      if(n.causality) causalReady++;
      causalOutcomes += Number(n.causality?.outcomes||0);
      learnedPolicies += Object.keys(n.learning?.causalWeights||{}).length;
    });
    results.push(check('deep causality initialized', causalReady>0, `${causalReady}/${aliveNpcs.length} living NPCs`));
    results.push(check('deep causality outcomes', causalOutcomes>0, `${causalOutcomes} recorded outcomes`));
    results.push(check('causal learned policies', learnedPolicies>0, `${learnedPolicies} action policies`));

    return {
      ok:results.every(r=>r.ok),
      results,
      summary:{
        tick:state?.tick??null,
        year:state?.year??null,
        population:aliveNpcs.length,
        settlements:settlements.length,
        kingdoms:kingdoms.length,
        families:families.length,
        systems:names.length,
        assets:assets?.stats?.loadedSprites||0,
        assetDraws:assets?.stats?.draws||0,
        causalOutcomes,
        learnedPolicies
      }
    };
  }

  function show(){
    const report=test();
    const old=document.getElementById('everglenDeepAuditOverlay'); if(old) old.remove();
    const panel=document.createElement('div');
    panel.id='everglenDeepAuditOverlay';
    panel.style.cssText='position:fixed;right:18px;top:18px;z-index:100000;max-width:560px;max-height:80vh;overflow:auto;background:rgba(10,14,20,.97);color:#eef2f7;border:1px solid rgba(255,255,255,.16);border-radius:10px;padding:14px 16px;font:12px/1.45 system-ui,sans-serif;box-shadow:0 12px 40px rgba(0,0,0,.45)';
    const rows=report.results.map(r=>`<div style="display:flex;justify-content:space-between;gap:16px;padding:3px 0"><span>${r.name}</span><b style="color:${r.ok?'#8fe39b':'#ff8f8f'}">${r.ok?'PASS':'FAIL'}${r.detail?` · ${r.detail}`:''}</b></div>`).join('');
    panel.innerHTML=`<div style="font-weight:800;font-size:15px;margin-bottom:5px">Everglen Deep Audit</div><div style="margin-bottom:9px">${report.ok?'ALL INVARIANTS PASS':'INVARIANT FAILURES DETECTED'} · Year ${report.summary.year??'?'} · Tick ${report.summary.tick??'?'}</div>${rows}<div style="margin-top:9px;padding-top:8px;border-top:1px solid rgba(255,255,255,.12)">Population ${report.summary.population} · Settlements ${report.summary.settlements} · Kingdoms ${report.summary.kingdoms} · Families ${report.summary.families} · Systems ${report.summary.systems} · Assets ${report.summary.assets} · Causal outcomes ${report.summary.causalOutcomes}</div>`;
    document.body.appendChild(panel);
    return report;
  }

  window.EVERGLEN_DEEP_AUDIT={test,show};
})();
