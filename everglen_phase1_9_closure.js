// Everglen Phase 1-9 closure layer.
// Integrates and audits the existing simulation stack without becoming a second authority.
// No DOM listeners, render loop, or independent timer. Runs only through registerSystem.
(() => {
  'use strict';
  const state=window.SIM_STATE;
  if(!state)return;
  const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,Number(v)||0));
  const arr=v=>Array.isArray(v)?v:[];
  const finite=v=>Number.isFinite(Number(v));
  const alive=()=>arr(state.npcs).filter(n=>n&&n.alive!==false);
  const findById=(list,id)=>arr(list).find(x=>String(x?.id)===String(id));
  const phaseApis={
    1:()=>!!window.PHASE1_AI&&!!window.PHASE1_AI_INTEGRITY,
    2:()=>!!window.SOCIETY_CIVILIZATION_EVOLUTION||!!window.SOCIETY_CIVILIZATION,
    3:()=>!!window.KINGDOM_STRATEGIC_AI||!!window.KINGDOM_DIPLOMACY_AI||!!window.GEOPOLITICAL_INTELLIGENCE,
    4:()=>!!window.EVERGLEN_ASSET_REGISTRY&&!!window.EVERGLEN_ASSETS,
    5:()=>!!window.EVERGLEN_ECONOMIC_GEOGRAPHY||!!window.EVERGLEN_REGIONAL_ECONOMY||!!window.EVERGLEN_MARKETS,
    6:()=>!!window.EVERGLEN_PERF,
    7:()=>!!window.NPC_DEEP_CAUSALITY||!!window.WORLD_ECOLOGY||!!window.CLIMATE_CYCLES,
    8:()=>!!window.EVERGLEN_PERSISTENCE||!!window.WORLD_PERSISTENCE,
    9:()=>!!window.EVERGLEN_PERF&&!!window.EVERGLEN_DEEP_AUDIT
  };
  const metrics={runs:0,lastTick:0,lastMs:0,avgMs:0,maxMs:0,repairs:0,invalids:0};
  function normalizeNpc(n){
    if(!n)return;
    if(!finite(n.x))n.x=0,metrics.repairs++;
    if(!finite(n.y))n.y=0,metrics.repairs++;
    if(!finite(n.age))n.age=18,metrics.repairs++;
    if(!finite(n.wealth)||Number(n.wealth)<0)n.wealth=Math.max(0,finite(n.wealth)?Number(n.wealth):0),metrics.repairs++;
    n.visual=n.visual&&typeof n.visual==='object'?n.visual:{};
    n.visual.bodyScale=clamp(n.visual.bodyScale??1,.55,1.5);
    n.visual.animationSpeed=clamp(n.visual.animationSpeed??1,.5,1.75);
    n.ai=n.ai&&typeof n.ai==='object'?n.ai:{};
    n.inventory=n.inventory&&typeof n.inventory==='object'?n.inventory:{};
  }
  function normalizeWorld(){
    arr(state.npcs).forEach(normalizeNpc);
    const npcIds=new Set(arr(state.npcs).map(n=>String(n?.id)));
    arr(state.npcs).forEach(n=>{
      if(n.settlementId!=null&&!findById(state.settlements,n.settlementId))n.settlementId=null,metrics.repairs++;
      if(n.familyId!=null&&!findById(state.families,n.familyId))n.familyId=null,metrics.repairs++;
      if(n.faction!=null&&!findById(state.kingdoms,n.faction)&&!findById(state.kingdoms,n.kingdomId))n.faction=null,metrics.repairs++;
      if(Array.isArray(n.parentIds))n.parentIds=n.parentIds.filter(id=>npcIds.has(String(id)));
      if(Array.isArray(n.childrenIds))n.childrenIds=n.childrenIds.filter(id=>npcIds.has(String(id)));
      if(n.partnerId!=null&&!npcIds.has(String(n.partnerId)))n.partnerId=null,metrics.repairs++;
    });
    arr(state.settlements).forEach(s=>{
      s.stability=clamp(s.stability??70);s.wealth=Math.max(0,finite(s.wealth)?Number(s.wealth):0);
      s.resources=s.resources&&typeof s.resources==='object'?s.resources:{};
      s.history=Array.isArray(s.history)?s.history:[];
      if(s.kingdomId!=null&&!findById(state.kingdoms,s.kingdomId))s.kingdomId=null,metrics.repairs++;
    });
    arr(state.kingdoms).forEach(k=>{
      k.stability=clamp(k.stability??70);k.treasury=Math.max(0,finite(k.treasury)?Number(k.treasury):0);
      k.history=Array.isArray(k.history)?k.history:[];
      if(k.leaderId!=null&&!npcIds.has(String(k.leaderId)))k.leaderId=null,metrics.repairs++;
    });
  }
  function deriveProfiles(){
    const people=alive();
    const settlementPop=new Map(),kingdomPop=new Map();
    people.forEach(n=>{if(n.settlementId!=null)settlementPop.set(String(n.settlementId),(settlementPop.get(String(n.settlementId))||0)+1);const kid=n.faction??n.kingdomId;if(kid!=null)kingdomPop.set(String(kid),(kingdomPop.get(String(kid))||0)+1);});
    arr(state.settlements).forEach(s=>{const p=settlementPop.get(String(s.id))||0;s.population=p;s.populationDensity=clamp(p/Math.max(1,Number(s.homes)||5)*100);s.demographicPressure=clamp(p/Math.max(1,(Number(s.homes)||5)*1.8)*100);s.economicHealth=clamp((Number(s.wealth)||0)/Math.max(1,p)*2+(s.stability||0)*.35);});
    arr(state.kingdoms).forEach(k=>{const p=kingdomPop.get(String(k.id))||0;const ss=arr(state.settlements).filter(s=>String(s.kingdomId)===String(k.id));const wealth=ss.reduce((v,s)=>v+(Number(s.wealth)||0),0)+(Number(k.treasury)||0);k.population=p;k.settlementCount=ss.length;k.economicHealth=clamp(wealth/Math.max(1,p)*1.8+(k.stability||0)*.3);k.strategicPower=clamp((Number(k.power)||0)*.55+k.economicHealth*.25+Math.min(20,p/20));});
  }
  function significance(text){const s=String(text||'').toLowerCase();return /war|rebell|famine|plague|king|queen|emperor|capital|conquest|annex|alliance|treaty|succession|collapse|revolution|independence|crisis|disaster|found(ed|ation)|death/.test(s)?3:/trade|market|migration|marriage|crime|election|promotion|festival|storm/.test(s)?2:1;}
  function compactHistory(){
    const seen=new Set(),limit=180;
    arr(state.settlements).forEach(s=>{if(!Array.isArray(s.history))s.history=[];s.history=s.history.filter(x=>{const key=`${s.id}|${String(x)}`;if(seen.has(key))return false;seen.add(key);return significance(x)>=2;}).slice(-limit);});
    arr(state.kingdoms).forEach(k=>{if(!Array.isArray(k.history))k.history=[];k.history=k.history.filter(x=>{const key=`${k.id}|${String(x)}`;if(seen.has(key))return false;seen.add(key);return significance(x)>=2;}).slice(-limit);});
  }
  function finiteAudit(){
    let bad=0;arr(state.npcs).forEach(n=>['x','y','age','wealth','health','hunger','energy','reputation','honor'].forEach(k=>{if(n[k]!=null&&!finite(n[k]))bad++;}));arr(state.settlements).forEach(s=>['x','y','stability','wealth'].forEach(k=>{if(s[k]!=null&&!finite(s[k]))bad++;}));arr(state.kingdoms).forEach(k=>['stability','treasury','power'].forEach(x=>{if(k[x]!=null&&!finite(k[x]))bad++;}));metrics.invalids=bad;return bad===0;}
  function phaseStatus(){
    const phases={};for(let i=1;i<=9;i++)phases[i]=!!phaseApis[i]();
    const perf=window.EVERGLEN_PERF?.perf||{};
    const audit=window.EVERGLEN_DEEP_AUDIT?.test?.();
    state.phase1_9={status:Object.values(phases).every(Boolean)&&metrics.invalids===0?'ready':'degraded',phases,performance:{tickMs:metrics.lastMs,avgMs:metrics.avgMs,maxMs:metrics.maxMs},repairs:metrics.repairs,invalids:metrics.invalids,auditOk:audit?.ok??null,checkedAt:state.tick};
    return state.phase1_9;
  }
  function snapshot(){
    const perf=window.EVERGLEN_PERF?.perf||{};return{tick:state.tick,year:state.year,population:alive().length,settlements:arr(state.settlements).length,kingdoms:arr(state.kingdoms).length,families:arr(state.families).length,systems:arr(state.systems).length,avgTickMs:Number((perf.avgMs||metrics.avgMs||0).toFixed(3)),maxSystemMs:Number((perf.maxMs||0).toFixed(3)),spatialIndexed:perf.spatial?.indexed||0,repairs:metrics.repairs,invalids:metrics.invalids};
  }
  function playtestReadiness(){
    const s=phaseStatus(),p=window.EVERGLEN_PERF?.perf||{};const checks=[
      ['phases 1-9 loaded',Object.values(s.phases).every(Boolean)],
      ['finite world state',metrics.invalids===0],
      ['no duplicate simulation systems',new Set(arr(state.systems).map(x=>x?.name).filter(Boolean)).size===arr(state.systems).map(x=>x?.name).filter(Boolean).length],
      ['population exists',alive().length>0],
      ['settlement exists',arr(state.settlements).length>0],
      ['kingdom exists',arr(state.kingdoms).length>0],
      ['performance telemetry',!!window.EVERGLEN_PERF],
      ['deep audit available',!!window.EVERGLEN_DEEP_AUDIT]
    ];
    const result={ok:checks.every(x=>x[1]),checks,snapshot:snapshot()};state.phase1_9Playtest=result;return result;
  }
  function stressSnapshot(){
    const people=alive(),start=performance.now();const buckets={hero:0,near:0,local:0,background:0};if(window.EVERGLEN_PERF)people.forEach(n=>buckets[window.EVERGLEN_PERF.tier(n)]++);const elapsed=performance.now()-start;return{population:people.length,buckets,classificationMs:Number(elapsed.toFixed(3)),tickMs:Number(((window.EVERGLEN_PERF?.perf?.lastMs)||0).toFixed(3)),avgTickMs:Number(((window.EVERGLEN_PERF?.perf?.avgMs)||0).toFixed(3))};
  }
  function step(){
    if(!state.running)return;
    const started=performance.now();metrics.runs++;metrics.lastTick=state.tick;
    if(state.tick%30===0){normalizeWorld();deriveProfiles();compactHistory();finiteAudit();phaseStatus();}
    metrics.lastMs=performance.now()-started;metrics.avgMs=metrics.avgMs?metrics.avgMs*.9+metrics.lastMs*.1:metrics.lastMs;metrics.maxMs=Math.max(metrics.maxMs,metrics.lastMs);
    if(state.tick%120===0)playtestReadiness();
  }
  window.EVERGLEN_PHASE1_9={step,snapshot,playtestReadiness,stressSnapshot,phaseStatus,normalizeWorld,deriveProfiles,metrics};
  state.registerSystem?.({name:'phase1-9-closure',step,priority:125});
})();
