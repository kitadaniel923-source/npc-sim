/* Everglen Phase 5S: Regional Inequality & Economic Convergence
 * Development is uneven. Rich settlements attract people and capital, poor regions
 * can fall behind, while trade, infrastructure, institutions and migration can create
 * catch-up. Medieval geography only: towns, ports, roads, estates and royal centers.
 */
(function(){
  'use strict';
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(+v)?+v:a));
  const num=(v,d=0)=>Number.isFinite(+v)?+v:d;
  const arr=v=>Array.isArray(v)?v:[];
  const state=()=>window.SIM_STATE||window.state||window.worldState||{};
  const year=()=>num(state().year,0);
  const ss=()=>arr(state().settlements);
  const ks=()=>arr(state().kingdoms||state().factions);
  const kid=o=>o&&(o.kingdomId||o.faction||o.ownerId);
  const ensure=s=>{s.regionalEconomy=s.regionalEconomy||{};const r=s.regionalEconomy;
    r.development=d=>d; return r;
  };
  function safeEnsure(s){
    s.regionalEconomy=s.regionalEconomy||{};const r=s.regionalEconomy;
    r.developmentLevel=r.developmentLevel??num(s.development?.developmentLevel,.3);
    r.productivity=r.productivity??num(s.development?.productivity,.3);
    r.capital=r.capital??num(s.development?.capital,5);
    r.humanCapital=r.humanCapital??num(s.development?.skills,.25);
    r.access=r.access??num(s.tradeAccess,num(s.marketAccess,.25));
    r.inequality=r.inequality??0;
    r.catchUp=r.catchUp??0;
    r.history=Array.isArray(r.history)?r.history:[];
    return r;
  }
  function score(s){
    const d=s.development||{}, r=s.regionalEconomy||{};
    return clamp(.26*clamp(num(d.developmentLevel,num(r.developmentLevel,.3))/100)+
      .22*clamp(num(d.productivity,num(r.productivity,.3)))+
      .18*clamp(num(d.humanCapital,num(r.humanCapital,.25)))+
      .16*clamp(num(d.infrastructure,num(s.infrastructureScore,.25)))+
      .18*clamp(num(d.livingStandards,num(s.prosperity,.5))));
  }
  function neighboringCapital(s){
    const x=num(s.x,0),y=num(s.y,0);let best=0,dist=Infinity;
    ss().forEach(o=>{if(o===s)return;const dx=num(o.x,0)-x,dy=num(o.y,0)-y,d=Math.hypot(dx,dy);if(d<dist&&d>0){dist=d;best=score(o);}});
    return best;
  }
  function updateSettlement(s){
    const r=safeEnsure(s), self=score(s), neighbor=neighboringCapital(s);
    const gap=clamp(neighbor-self);
    const trade=clamp(num(s.tradeAccess,num(s.marketAccess,.25)));
    const stability=clamp(num(s.stability,.6)/100);
    const mobility=clamp(num(s.migrationPressure,.2));
    r.inequality=clamp(Math.abs(self-neighbor));
    r.catchUp=clamp(gap*.5+trade*.15+stability*.1-mobility*.08,-1,1);
    const dev=s.development;
    if(dev){
      dev.productivity=clamp(num(dev.productivity,.3)+r.catchUp*.0015);
      dev.humanCapital=clamp(num(dev.humanCapital,.25)+r.catchUp*.001);
      dev.infrastructure=clamp(num(dev.infrastructure,.25)+Math.max(0,r.catchUp)*.0008);
      dev.livingStandards=clamp(num(dev.livingStandards,.3)+r.catchUp*.0008);
    }
    if(year()%5===0){r.history.push({year:year(),score:Number(self.toFixed(3)),neighbor:Number(neighbor.toFixed(3)),gap:Number((neighbor-self).toFixed(3)),catchUp:Number(r.catchUp.toFixed(3))});if(r.history.length>40)r.history.shift();}
  }
  function kingdomSummary(k){
    const list=ss().filter(s=>kid(s)===k.id);if(!list.length)return;
    const vals=list.map(score), mean=vals.reduce((a,v)=>a+v,0)/vals.length;
    const max=Math.max.apply(null,vals),min=Math.min.apply(null,vals);
    k.regionalInequality=clamp(max-min);
    k.regionalDevelopment=clamp(mean);
    k.developmentGap=clamp(max-min);
    k.catchUpPressure=clamp(list.reduce((a,s)=>a+Math.max(0,(score(list.reduce((m,o)=>score(o)>score(m)?o:m,s))-score(s))),0)/Math.max(1,list.length));
    const dev=k.development;if(dev){
      dev.inequality=clamp(num(dev.inequality,.25)*.97+k.regionalInequality*.03);
      dev.pathDependence=clamp(num(dev.pathDependence,.2)+k.regionalInequality*.0005);
    }
  }
  function step(){
    if(state().running===false)return;
    ss().forEach(s=>{safeEnsure(s);updateSettlement(s);});
    ks().forEach(kingdomSummary);
  }
  window.EVERGLEN_REGIONAL_ECONOMY={step,score,safeEnsure};
  if(typeof window.registerSystem==='function')window.registerSystem({name:'regional-inequality',step,priority:68});
})();
