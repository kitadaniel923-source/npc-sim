/* Everglen Phase 5Q: Economic Development & Long-Term Growth
 * Persistent development replaces one-dimensional prosperity. Kingdoms and settlements
 * accumulate capital, skills, infrastructure quality, productivity, human capital and
 * institutional capacity over generations. Medieval progression only: no modern industry.
 */
(function(){
  'use strict';
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(v)?v:a));
  const num=(v,d=0)=>Number.isFinite(+v)?+v:d;
  const arr=v=>Array.isArray(v)?v:[];
  const stateOf=()=>window.state||window.worldState||window.SIM_STATE||{};
  const year=()=>num(stateOf().year,0);
  const kingdoms=()=>arr(stateOf().kingdoms||stateOf().factions);
  const settlements=()=>arr(stateOf().settlements);
  const npcs=()=>arr(stateOf().npcs||stateOf().population);
  const kingdomIdOf=s=>s && (s.kingdomId||s.faction||s.ownerId);
  const ensureKingdom=k=>{
    k.development=k.development||{};
    const d=k.development;
    if(!Number.isFinite(d.capital)) d.capital=20;
    if(!Number.isFinite(d.productivity)) d.productivity=.35;
    if(!Number.isFinite(d.humanCapital)) d.humanCapital=.25;
    if(!Number.isFinite(d.institutionalCapacity)) d.institutionalCapacity=.25;
    if(!Number.isFinite(d.infrastructure)) d.infrastructure=.25;
    if(!Number.isFinite(d.innovation)) d.innovation=.12;
    if(!Number.isFinite(d.livingStandards)) d.livingStandards=.3;
    if(!Number.isFinite(d.inequality)) d.inequality=.25;
    if(!Number.isFinite(d.growth)) d.growth=0;
    if(!Number.isFinite(d.developmentLevel)) d.developmentLevel=0;
    if(!Number.isFinite(d.pathDependence)) d.pathDependence=.2;
    if(!Number.isFinite(d.lastYear)) d.lastYear=year();
    if(!Array.isArray(d.history)) d.history=[];
    return d;
  };
  const ensureSettlement=s=>{
    s.development=s.development||{};
    const d=s.development;
    if(!Number.isFinite(d.capital)) d.capital=5;
    if(!Number.isFinite(d.productivity)) d.productivity=.3;
    if(!Number.isFinite(d.skills)) d.skills=.25;
    if(!Number.isFinite(d.infrastructure)) d.infrastructure=.25;
    if(!Number.isFinite(d.marketDepth)) d.marketDepth=.2;
    if(!Number.isFinite(d.livingStandards)) d.livingStandards=.3;
    if(!Number.isFinite(d.growth)) d.growth=0;
    if(!Number.isFinite(d.specialization)) d.specialization=0;
    if(!Array.isArray(d.history)) d.history=[];
    return d;
  };
  const peopleIn=s=>npcs().filter(n=>n&&kingdomIdOf(n)===kingdomIdOf(s)&&(n.settlementId===s.id||n.settlement===s.id));
  const popOf=s=>Math.max(1,peopleIn(s).length||num(s.population,10));
  const settlementScore=(s,ks)=>{
    const d=ensureSettlement(s);
    const econ=num(s.prosperity,.5);
    const infra=d.infrastructure;
    const market=d.marketDepth;
    const skills=d.skills;
    const capital=clamp(d.capital/100);
    return clamp(.26*econ+.2*infra+.18*market+.18*skills+.18*capital + num(ks?.development?.productivity,.3)*.1);
  };
  const annualize=k=>{
    const d=ensureKingdom(k);
    const kid=k.id;
    const ss=settlements().filter(s=>s&&kingdomIdOf(s)===kid);
    const local=ss.length?ss.reduce((a,s)=>a+settlementScore(s,k),0)/ss.length:.25;
    const pop=npcs().filter(n=>n&&kingdomIdOf(n)===kid).length||num(k.population,10)||10;
    const bank=k.banking||{};
    const treasury=num(k.treasury, num(k.finances?.treasury,0));
    const debt=num(k.debt, num(k.finances?.debt,0));
    const education=num(k.society?.education, k.education||0);
    const stability=clamp(num(k.stability,.7)/100,.0,1);
    const trade=clamp(num(k.tradeNetwork?.power,.2)/100,.0,1);
    const crisis=(k.economicCycle?.phase==='financial-crisis'?0.12:k.economicCycle?.phase==='recession'?.06:0);
    const investment=clamp(num(k.finances?.spending?.infrastructure,.12)+num(k.development?.innovation,.12)*.25);
    const humanInvestment=.02*clamp(education/100)+.01*stability;
    const capitalReturn=.004*(1+local)+investment*.015;
    const debtDrag=clamp(debt/(debt+Math.max(10,treasury+num(bank.reserves,0)+1)))*.006;
    const shock=crisis + (num(k.tradeSanctions?.length,0)>0?.01:0);
    const growth=clamp(.006 + capitalReturn + humanInvestment + d.innovation*.002 + trade*.002 - debtDrag - shock,-.08,.08);
    d.capital=Math.max(0,d.capital*(1+growth)+capitalReturn*100);
    d.productivity=clamp(d.productivity + growth*.7 + d.humanCapital*.004 - .002*shock);
    d.humanCapital=clamp(d.humanCapital + humanInvestment + local*.002 - .002*shock);
    d.institutionalCapacity=clamp(d.institutionalCapacity + stability*.003 + local*.002 - debtDrag*.2);
    d.infrastructure=clamp(d.infrastructure + investment*.01 - .002*(1-stability));
    d.innovation=clamp(d.innovation + d.humanCapital*.002 + trade*.001 - .001*shock);
    d.livingStandards=clamp(d.livingStandards + (d.productivity*.004) + growth*.5 - shock*.08);
    d.inequality=clamp(d.inequality + (d.livingStandards>.7?.001:-.001) + Math.max(0,growth-.02)*.12 - .002*shock);
    d.growth=growth;
    const level=clamp((d.productivity+d.humanCapital+d.institutionalCapacity+d.infrastructure+d.livingStandards)/5);
    d.developmentLevel=Math.round(level*100);
    d.pathDependence=clamp(d.pathDependence + Math.abs(growth)*.004);
    if(year()!==d.lastYear){
      d.lastYear=year();
      d.history.push({year:year(),growth:Math.round(growth*10000)/100,level:d.developmentLevel,capital:Math.round(d.capital)});
      if(d.history.length>80)d.history.shift();
    }
    k.developmentLevel=d.developmentLevel;
    k.economicGrowth=growth;
    k.productivity=d.productivity;
  };
  const developSettlement=s=>{
    const d=ensureSettlement(s), kid=kingdomIdOf(s), k=kingdoms().find(x=>x&&x.id===kid);
    const kd=k?ensureKingdom(k):null;
    const pop=popOf(s);
    const skilled=npcs().filter(n=>n&&kingdomIdOf(n)===kid&&(n.settlementId===s.id||n.settlement===s.id)&&num(n.skill,num(n.experience,0))>.55).length;
    const skillRatio=clamp(skilled/pop);
    const prosperity=clamp(num(s.prosperity,.5));
    const marketAccess=clamp(num(s.tradeAccess,num(s.marketAccess,.25)));
    const construction=clamp(num(s.infrastructure?.quality,num(s.infrastructureScore,.25))/100);
    const shocks=settlements().some(x=>x&&x.id===s.id&&(x.crisis||x.unrest>70))?.04:0;
    const gain=.004 + skillRatio*.004 + marketAccess*.003 + (kd?kd.productivity*.002:0) + construction*.002 - shocks;
    const loss=Math.max(0,.003-(prosperity-.35)*.004);
    d.capital=Math.max(0,d.capital + pop*.012 + d.productivity*.08);
    d.skills=clamp(d.skills + skillRatio*.008 + (kd?kd.humanCapital*.002:0));
    d.infrastructure=clamp(d.infrastructure + (construction*.004));
    d.marketDepth=clamp(d.marketDepth + marketAccess*.006 + (kd?kd.institutionalCapacity*.001:0));
    d.productivity=clamp(d.productivity + d.skills*.003 + d.marketDepth*.002 - shocks*.03);
    d.livingStandards=clamp(d.livingStandards + d.productivity*.003 + prosperity*.002);
    d.growth=clamp(gain-loss,-.05,.05);
    d.specialization=clamp(.6*d.specialization+.4*(kd?kd.productivity:.3));
    if(Number.isFinite(s.prosperity)) s.prosperity=clamp(s.prosperity+d.growth*.8);
    if(year()%5===0){d.history.push({year:year(),growth:d.growth,skills:d.skills,productivity:d.productivity});if(d.history.length>40)d.history.shift();}
  };
  const applyHumanCapital=()=>{
    const ns=npcs();
    for(let i=0;i<ns.length;i+=Math.max(1,Math.floor(ns.length/500)+1)){
      const n=ns[i]; if(!n)continue;
      const k=kingdoms().find(x=>x&&x.id===kingdomIdOf(n));
      const d=k?ensureKingdom(k):null;
      if(!d)continue;
      n.economicDevelopmentSkill=clamp(num(n.economicDevelopmentSkill,num(n.skill,.3)) + d.humanCapital*.0015);
    }
  };
  const step=()=>{
    kingdoms().forEach(annualize);
    settlements().forEach(developSettlement);
    applyHumanCapital();
  };
  window.EVERGLEN_DEVELOPMENT={ensureKingdom,ensureSettlement,step,developmentLevel:k=>ensureKingdom(k).developmentLevel,growth:k=>ensureKingdom(k).growth};
  if(typeof window.registerSystem==='function') window.registerSystem({name:'economic-development',step,priority:66});
})();
