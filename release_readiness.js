/* Everglen 1.0 runtime readiness and test-mode diagnostics. */
(() => {
  'use strict';
  const state=window.SIM_STATE;
  const requiredGlobals=[
    ['SIM_STATE',()=>!!window.SIM_STATE],
    ['SIM_RENDER',()=>typeof window.SIM_RENDER==='function'],
    ['SIM_API',()=>!!window.SIM_API],
    ['input dispatcher',()=>!!window.EVERGLEN_INPUT_DISPATCHER||!!window.EVERGLEN_INPUT],
    ['render registry',()=>!!window.EVERGLEN_RENDER_REGISTRY||!!window.EVERGLEN_RENDER],
    ['player events',()=>!!window.EVERGLEN_PLAYER_EVENTS],
    ['persistence',()=>!!window.EVERGLEN_PERSISTENCE||!!window.WORLD_PERSISTENCE],
    ['God Mode',()=>!!window.GOD_MODE||!!window.EVERGLEN_GOD_MODE],
    ['geopolitics',()=>!!window.PLAYER_GEOPOLITICS],
    ['development',()=>!!window.EVERGLEN_DEVELOPMENT],
    ['demography',()=>!!window.EVERGLEN_DEMOGRAPHY],
    ['regional economy',()=>!!window.EVERGLEN_REGIONAL_ECONOMY]
  ];
  function test(){
    const results=[];
    requiredGlobals.forEach(([name,fn])=>{let ok=false;try{ok=!!fn()}catch(_){ok=false}results.push({name,ok});});
    const systems=Array.isArray(state?.systems)?state.systems:[];
    const names=systems.map(s=>s?.name).filter(Boolean);
    const dup=names.filter((n,i)=>names.indexOf(n)!==i);
    results.push({name:'system scheduler',ok:!!state&&typeof state.registerSystem==='function'&&systems.length>0});
    results.push({name:'unique system names',ok:dup.length===0,detail:dup.length?dup.join(', '):''});
    results.push({name:'canvas',ok:!!document.getElementById('worldCanvas')});
    results.push({name:'core panels',ok:['worldStats','factionList','eventFeed','inspectorContent','needsChart','microLog'].every(id=>!!document.getElementById(id))});
    const alive=Array.isArray(state?.npcs)?state.npcs.filter(n=>n&&n.alive):[];
    const settlements=Array.isArray(state?.settlements)?state.settlements:[];
    const kingdoms=Array.isArray(state?.kingdoms)?state.kingdoms:[];
    results.push({name:'world has population',ok:alive.length>0,detail:String(alive.length)});
    results.push({name:'world has settlement',ok:settlements.length>0,detail:String(settlements.length)});
    results.push({name:'world has kingdom',ok:kingdoms.length>0,detail:String(kingdoms.length)});
    const hardFailures=results.filter(r=>!r.ok);
    return {ok:hardFailures.length===0,results,summary:{tick:state?.tick??null,year:state?.year??null,population:alive.length,settlements:settlements.length,kingdoms:kingdoms.length,systems:names.length}};
  }
  function renderReport(report){
    const old=document.getElementById('everglenTestOverlay');if(old)old.remove();
    const panel=document.createElement('div');panel.id='everglenTestOverlay';panel.style.cssText='position:fixed;inset:18px auto auto 18px;z-index:99999;max-width:460px;background:rgba(12,16,22,.97);color:#eef2f7;border:1px solid rgba(255,255,255,.16);border-radius:10px;padding:14px 16px;font:12px/1.45 system-ui,sans-serif;box-shadow:0 12px 40px rgba(0,0,0,.4)';
    const rows=report.results.map(r=>`<div style="display:flex;justify-content:space-between;gap:12px;padding:3px 0"><span>${r.name}</span><b style="color:${r.ok?'#8fe39b':'#ff8f8f'}">${r.ok?'PASS':'FAIL'}${r.detail?` · ${r.detail}`:''}</b></div>`).join('');
    panel.innerHTML=`<div style="font-weight:800;font-size:15px;margin-bottom:6px">Everglen 1.0 Readiness</div><div style="margin-bottom:8px">${report.ok?'READY FOR PLAYTEST':'NOT READY'} · Year ${report.summary.year??'?'} · Tick ${report.summary.tick??'?'}</div>${rows}<div style="margin-top:9px;padding-top:8px;border-top:1px solid rgba(255,255,255,.12)">Population ${report.summary.population} · Settlements ${report.summary.settlements} · Kingdoms ${report.summary.kingdoms} · Systems ${report.summary.systems}</div>`;
    document.body.appendChild(panel);
  }
  const api={test,show:()=>renderReport(test())};
  window.EVERGLEN_1_0_TESTS=api;
  if(new URLSearchParams(location.search).get('test')==='1'){
    const run=()=>renderReport(test());
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
  }
})();
