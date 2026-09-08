/* Everglen Phase 5R: Demographic Development & Urbanization
 * Long-run population structure feeds economic growth. Births, mortality, migration,
 * age balance, urbanization and skill density create reinforcing or limiting loops.
 * Medieval progression only: cities, towns, villages and estates, never modern industry.
 */
(function(){
  'use strict';
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(v)?v:a));
  const num=(v,d=0)=>Number.isFinite(+v)?+v:d;
  const arr=v=>Array.isArray(v)?v:[];
  const state=()=>window.SIM_STATE||window.state||window.worldState||{};
  const kingdoms=()=>arr(state().kingdoms||state().factions);
  const settlements=()=>arr(state().settlements);
  const npcs=()=>arr(state().npcs||state().population);
  const kid=o=>o&&(o.kingdomId||o.faction||o.ownerId);
  const age=n=>clamp((num(n?.age,25)-0)/85);
  const ensureK=k=>{k.demography=k.demography||{};const d=k.demography;
    d.population=d.population??0; d.birthRate=d.birthRate??.018; d.deathRate=d.deathRate??.009;
    d.dependency=d.dependency??.35; d.urbanization=d.urbanization??.2; d.skillDensity=d.skillDensity??.3;
    d.migrationPressure=d.migrationPressure??0; d.foodPressure=d.foodPressure??0; d.growth=d.growth??0;
    d.history=Array.isArray(d.history)?d.history:[]; return d;};
  const ensureS=s=>{s.demography=s.demography||{};const d=s.demography;
    d.population=d.population??0; d.households=d.households??0; d.urbanization=d.urbanization??.2;
    d.birthRate=d.birthRate??.018; d.deathRate=d.deathRate??.009; d.skillDensity=d.skillDensity??.3;
    d.migrationIn=d.migrationIn??0; d.migrationOut=d.migrationOut??0; d.growth=d.growth??0;
    return d;};
  function localPeople(s){return npcs().filter(n=>n&&kid(n)===kid(s)&&(n.settlementId===s.id||n.settlement===s.id));}
  function updateSettlement(s){
    const d=ensureS(s), people=localPeople(s), pop=people.length||Math.max(1,num(s.population,10));
    let births=0,deaths=0,children=0,elderly=0,skilled=0;
    people.forEach(n=>{const a=num(n.age,25);if(a<16)children++;else if(a>=60)elderly++;if(num(n.skill,num(n.experience,0))>.55)skilled++;});
    const food=clamp(num(s.food,.8)/100); const prosperity=clamp(num(s.prosperity,.55));
    const overcrowding=clamp((pop/Math.max(10,num(s.capacity,100)))-.75);
    const fertility=clamp(.75+prosperity*.25+food*.2-overcrowding*.35,.45,1.15);
    const mortality=clamp(1+Math.max(0,.4-food)*.8+Math.max(0,.45-prosperity)*.45+num(s.diseasePressure,0)*.01,.65,1.8);
    d.birthRate=.018*fertility; d.deathRate=.009*mortality;
    const net=d.birthRate-d.deathRate;
    d.population=pop; d.households=Math.max(1,Math.round(pop/Math.max(1,2.6-(prosperity*.5))));
    d.urbanization=clamp(d.urbanization + (num(s.rank,0)>1?.002:.0006) + Math.max(0, prosperity-.65)*.001 - overcrowding*.001);
    d.skillDensity=clamp((skilled/Math.max(1,pop))*.7+d.skillDensity*.3);
    d.migrationIn=Math.max(0,num(s.migrationIn,0)); d.migrationOut=Math.max(0,num(s.migrationOut,0));
    d.growth=clamp(net + (d.migrationIn-d.migrationOut)/Math.max(1,pop),-.08,.08);
    s.population=Math.max(1,Math.round(pop*(1+d.growth)));
    s.demographicPressure=clamp((children+elderly)/Math.max(1,pop));
    s.skillDensity=d.skillDensity; s.urbanization=d.urbanization;
    if(d.growth<-.015)s.stability=Math.max(0,num(s.stability,60)-.03);
  }
  function updateKingdom(k){
    const d=ensureK(k), ss=settlements().filter(s=>s&&kid(s)===k.id);
    if(!ss.length)return;
    const total=ss.reduce((a,s)=>a+Math.max(1,num(s.population,ensureS(s).population||10)),0);
    let weighted=0,dep=0,skills=0,urban=0,growth=0;
    ss.forEach(s=>{const sd=ensureS(s),p=Math.max(1,num(s.population,sd.population||10));const w=p/Math.max(1,total);weighted+=p*w;dep+=(num(s.demographicPressure,.35))*w;skills+=sd.skillDensity*w;urban+=sd.urbanization*w;growth+=sd.growth*w;});
    d.population=total; d.dependency=clamp(dep); d.skillDensity=clamp(skills); d.urbanization=clamp(urban); d.growth=clamp(growth);
    d.foodPressure=clamp(num(k.foodPressure,0)/100 + Math.max(0,total/Math.max(1,num(k.foodSupply,total))-1)*.25);
    d.migrationPressure=clamp(Math.max(0,-growth)*5 + Math.max(0,d.dependency-.45)*.5 + Math.max(0,d.foodPressure-.5)*.4);
    d.birthRate=clamp(ss.reduce((a,s)=>a+ensureS(s).birthRate,0)/ss.length);
    d.deathRate=clamp(ss.reduce((a,s)=>a+ensureS(s).deathRate,0)/ss.length);
    if(state().year!=null && state().year%5===0){d.history.push({year:state().year,population:Math.round(total),growth:Number((growth*100).toFixed(2)),urbanization:Number((urban*100).toFixed(1)),skillDensity:Number((skills*100).toFixed(1))});if(d.history.length>60)d.history.shift();}
    k.population=total; k.demographicGrowth=growth; k.urbanization=urban; k.dependencyRatio=dep;
    const dev=k.development; if(dev){dev.humanCapital=clamp(num(dev.humanCapital,.25)+Math.max(0,skills-.3)*.0015-Math.max(0,dep-.5)*.0008);dev.productivity=clamp(num(dev.productivity,.35)+Math.max(0,skills-.35)*.0012-Math.max(0,dep-.55)*.0007);}
  }
  function step(){kingdoms().forEach(ensureK);settlements().forEach(updateSettlement);kingdoms().forEach(updateKingdom);}
  window.EVERGLEN_DEMOGRAPHY={ensureKingdom:ensureK,ensureSettlement:ensureS,step,kingdomGrowth:k=>ensureK(k).growth};
  if(typeof window.registerSystem==='function')window.registerSystem({name:'demographic-development',step,priority:67});
})();
