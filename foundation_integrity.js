// Foundation integrity layer: keeps long-running Everglen simulations coherent and debuggable.
(() => {
  const state=window.SIM_STATE;if(!state)return;
  const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,Number.isFinite(Number(v))?Number(v):a));
  const alive=()=>state.npcs.filter(n=>n.alive);
  const moneyKeys=['wealth','wallet','wage','debt','influence','reputation','grievance','mood'];
  const resourceRegistry=()=>window.NPC_RESOURCES?.RESOURCES||{};
  const metrics={passes:0,repairs:0,orphanRelations:0,invalidValues:0,duplicateSystems:0,lastTick:0};
  function num(n,k,min=0,max=1e9){const v=Number(n[k]);if(!Number.isFinite(v)){n[k]=min;metrics.invalidValues++;return;}if(v<min||v>max){n[k]=clamp(v,min,max);metrics.repairs++;}}
  function ensureNpc(n){
    if(!Array.isArray(n.relations))n.relations=[];
    if(!Array.isArray(n.memories))n.memories=[];
    if(!n.needs)n.needs={};
    moneyKeys.forEach(k=>num(n,k,0));
    ['hunger','thirst','energy','safety','social','belonging','wealth','purpose','health'].forEach(k=>{if(n.needs[k]!=null)n.needs[k]=clamp(n.needs[k]);});
    if(n.age!=null)n.age=clamp(n.age,0,130);
    if(n.maxAge!=null)n.maxAge=clamp(n.maxAge,16,160);
  }
  function ensureSettlement(s){
    s.resources=s.resources||{};
    Object.keys(resourceRegistry()).forEach(id=>{const v=Number(s.resources[id]||0);if(!Number.isFinite(v)||v<0){s.resources[id]=0;metrics.repairs++;}});
    ['wealth','stability','prosperity','populationPeak'].forEach(k=>{if(s[k]!=null)num(s,k,0);});
    if(s.feudal){s.feudal.taxRate=clamp(s.feudal.taxRate,.01,.3);s.feudal.levyRate=clamp(s.feudal.levyRate,.01,.25);s.feudal.legitimacy=clamp(s.feudal.legitimacy||50);}
  }
  function cleanRelations(){
    const ids=new Set(state.npcs.map(n=>n.id));
    alive().forEach(n=>{const seen=new Set();n.relations=n.relations.filter(r=>{if(!r||!r.targetId||r.targetId===n.id||!ids.has(r.targetId)){metrics.orphanRelations++;return false;}if(seen.has(r.targetId))return false;seen.add(r.targetId);r.score=clamp(r.score,-100,100);r.trust=clamp(r.trust||50);r.respect=clamp(r.respect||50);r.familiarity=clamp(r.familiarity||0);return true;});});
  }
  function cleanFamilies(){
    const ids=new Set(state.npcs.map(n=>n.id));
    state.families?.forEach(f=>{if(Array.isArray(f.members))f.members=f.members.filter(id=>ids.has(id));if(Array.isArray(f.childrenIds))f.childrenIds=f.childrenIds.filter(id=>ids.has(id));if(Array.isArray(f.parentIds))f.parentIds=f.parentIds.filter(id=>ids.has(id));});
  }
  function cleanSystems(){
    if(!Array.isArray(state.systems))return;
    const seen=new Set();const duplicate=state.systems.filter(s=>{const key=s?.name||s;if(seen.has(key))return true;seen.add(key);return false;}).length;
    if(duplicate)metrics.duplicateSystems+=duplicate;
    const unique=[];const names=new Set();state.systems.forEach(s=>{const key=s?.name||s;if(names.has(key))return;names.add(key);unique.push(s);});
    if(unique.length!==state.systems.length){state.systems=unique;metrics.repairs+=state.systems.length-unique.length;}
  }
  function step(){
    if(!state.running)return;
    if(state.tick%60!==0)return;
    metrics.passes++;metrics.lastTick=state.tick;
    alive().forEach(ensureNpc);
    state.settlements?.forEach(ensureSettlement);
    cleanRelations();cleanFamilies();cleanSystems();
    state.foundationHealth={ok:metrics.invalidValues===0||metrics.invalidValues<25,metrics:{...metrics},tick:state.tick};
  }
  window.FOUNDATION_INTEGRITY={metrics,step,ensureNpc,ensureSettlement};
  if(state.registerSystem)state.registerSystem({name:'foundation-integrity',step,priority:110});
})();
