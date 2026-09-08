// Phase 5J: economic geography, regional specialization and settlement comparative advantage.
(() => {
  const state=window.SIM_STATE;if(!state)return;
  const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,v));
  const ss=()=>state.settlements||[];
  const ks=()=>state.kingdoms||[];
  const alive=()=> (state.npcs||[]).filter(n=>n.alive);
  const base={
    farming:['food','grain','livestock','leather','wool'],
    forestry:['wood','paper'],
    mining:['stone','iron','silver','gold','mithril','adamantine','emberite','moonstone','voidstone','starsteel'],
    artisan:['tools','weapons','armor','glass','cloth','leather'],
    textile:['cloth','wool','leather'],
    trade:['books','glass','tools','cloth','medicine'],
    naval:['boats','battle_boats','fish'],
    scholarship:['books','paper','medicine','reagents'],
    military:['weapons','armor','horses','iron'],
    luxury:['silver','gold','mithril','moonstone','books']
  };
  const score=(n,k)=>window.NPC_PERSONALITY?.score?.(n,k)??50;
  const keyResources=()=>window.NPC_RESOURCES?.catalog?Object.keys(window.NPC_RESOURCES.catalog()):Object.keys(base).reduce((a,x)=>a.concat(base[x]),[]).filter((x,i,a)=>a.indexOf(x)===i);
  const pop=s=>Math.max(1,alive().filter(n=>n.settlementId===s.id).length);
  const inv=s=>s.resources||{};
  const price=(s,r)=>window.EVERGLEN_MARKETS?.price?.(s,r)??s.market?.prices?.[r]??1;
  const infrastructure=s=>{
    const a=s.advanced?.projects||{},i=s.infrastructure||{};
    return clamp((i.quality||45)+((a.roads||0)*3)+((a.workshops||0)*2)+((a.ports||0)*8)+((a.mills||0)*2));
  };
  const settlementType=(s)=>{
    const n=pop(s),coast=(s.advanced?.projects?.ports||0)>0?1:0;
    const land=s.landValue||s.property?.landValue||50;
    const climate=s.climate?.fertility??s.ecology?.fertility??50;
    const mines=(inv(s).iron||0)+(inv(s).gold||0)+(inv(s).silver||0)+(inv(s).mithril||0)+(inv(s).adamantine||0);
    const farms=(inv(s).food||0)+(inv(s).grain||0)+(inv(s).livestock||0);
    if(coast&&n>35)return 'port-trade';
    if(mines>Math.max(20,n*.18))return 'mining';
    if(climate>70&&farms>Math.max(30,n*.8))return 'farming';
    if((s.buildings||0)>8&&n>55)return 'artisan';
    if(s.education?.literacy>65)return 'scholarship';
    return 'mixed';
  };
  function ensureSettlement(s){
    s.economicGeography=s.economicGeography||{};const g=s.economicGeography;
    g.specialization=g.specialization||'mixed';g.scores=g.scores||{};g.exports=g.exports||{};g.imports=g.imports||{};g.infrastructure=g.infrastructure??45;g.marketAccess=g.marketAccess??50;g.diversification=g.diversification??50;g.industrialization=g.industrialization??20;g.agriculture=g.agriculture??20;g.mining=g.mining??10;g.trade=g.trade??10;g.maritime=g.maritime??0;g.knowledge=g.knowledge??15;g.employment=g.employment??50;g.prosperity=g.prosperity??50;g.history=g.history||[];g.lastChangeYear=g.lastChangeYear??0;return g;
  }
  function resourcePotential(s,r){
    const g=s.economicGeography,m=price(s,r),stock=inv(s)[r]||0,n=pop(s);
    const productive=['food','grain','livestock','wood','stone','iron','fish','cloth','wool','tools','weapons','armor','books'];
    const basePotential=stock/Math.max(1,n*.16);
    const pricePull=clamp(m/Math.max(1,(window.NPC_RESOURCES?.RESOURCES?.[r]?.base||10)),.5,3);
    const existing=g.exports[r]||0;
    return clamp(basePotential*18+pricePull*14+existing*.7+(productive.includes(r)?4:0),0,100);
  }
  function scoreProfiles(s){
    const g=ensureSettlement(s),n=pop(s),infra=infrastructure(s),port=(s.advanced?.projects?.ports||0)>0,lit=s.education?.literacy??45;
    const climate=s.climate?.fertility??s.ecology?.fertility??50;
    const farm=clamp(resourcePotential(s,'food')*.5+resourcePotential(s,'grain')*.45+resourcePotential(s,'livestock')*.25+climate*.38+infra*.08);
    const mine=clamp(resourcePotential(s,'iron')*.7+resourcePotential(s,'gold')*.8+resourcePotential(s,'silver')*.7+resourcePotential(s,'mithril')*.8+resourcePotential(s,'adamantine')*.9+infra*.12);
    const artisan=clamp((s.buildings||0)*3+resourcePotential(s,'tools')*.3+resourcePotential(s,'weapons')*.3+resourcePotential(s,'armor')*.3+infra*.35+n*.08);
    const textile=clamp(resourcePotential(s,'cloth')*.45+resourcePotential(s,'wool')*.5+resourcePotential(s,'leather')*.35+n*.08+infra*.2);
    const trade=clamp((window.EVERGLEN_LOGISTICS?.routes||[]).filter(r=>r.from===s.id||r.to===s.id).length*12+infra*.42+(s.market?.volume||0)*.02+g.marketAccess*.35+(s.wealth||0)*.015);
    const naval=clamp((port?38:0)+resourcePotential(s,'boats')*.55+resourcePotential(s,'battle_boats')*.35+resourcePotential(s,'fish')*.3+g.marketAccess*.15);
    const scholar=clamp(lit*.7+(s.knowledge||s.education?.knowledge||0)*.25+resourcePotential(s,'books')*.35+resourcePotential(s,'paper')*.2+infra*.1);
    const military=clamp(resourcePotential(s,'weapons')*.55+resourcePotential(s,'armor')*.55+resourcePotential(s,'horses')*.45+(s.military||{}).readiness*.2+infra*.1);
    const luxury=clamp(resourcePotential(s,'gold')*.45+resourcePotential(s,'silver')*.4+resourcePotential(s,'mithril')*.5+resourcePotential(s,'moonstone')*.5+resourcePotential(s,'books')*.15);
    return {farming:farm,mining:mine,artisan,textile,trade,naval,scholarship:scholar,military,luxury};
  }
  function chooseSpecialization(s){
    const g=ensureSettlement(s),scores=scoreProfiles(s);g.scores=scores;
    const ranked=Object.entries(scores).sort((a,b)=>b[1]-a[1]);
    const best=ranked[0],second=ranked[1];
    if(!best)return 'mixed';
    const dominance=best[1]-((second?.[1])||0);
    const previous=g.specialization;
    const next=best[1]>52&&dominance>5?best[0]:(best[1]>44&&dominance>2?best[0]:'mixed');
    g.specialization=next;
    if(previous!==next){
      g.history.push({year:state.year,from:previous,to:next,score:Number(best[1].toFixed(1))});g.history=g.history.slice(-30);g.lastChangeYear=state.year;
      if(window.SIM_API?.log)window.SIM_API.log(`${s.name} developed as a ${next} settlement.`);
    }
    return next;
  }
  function calculateAccess(s){
    const routes=(window.EVERGLEN_LOGISTICS?.routes||[]).filter(r=>r.from===s.id||r.to===s.id);
    const roads=(window.EverglenLogistics?.roads||[]).filter(r=>r.from===s.id||r.to===s.id);
    const port=(s.advanced?.projects?.ports||0)>0;
    return clamp(34+routes.length*7+roads.length*5+infrastructure(s)*.32+(port?15:0));
  }
  function applySpecialization(s){
    const g=ensureSettlement(s),spec=g.specialization,p=pop(s);g.infrastructure=infrastructure(s);g.marketAccess=calculateAccess(s);
    const weights={farming:.03,mining:.028,artisan:.032,textile:.025,trade:.04,naval:.038,scholarship:.02,military:.018,luxury:.022,mixed:.012};
    const output=weights[spec]??.012;
    if(spec==='farming'){g.agriculture=clamp(g.agriculture+output*p*.06);s.foodSecurity=clamp((s.foodSecurity||50)+output*.25);}
    if(spec==='mining'){g.mining=clamp(g.mining+output*p*.055);s.wealth=(s.wealth||0)+output*p*.03;}
    if(spec==='artisan'){g.industrialization=clamp(g.industrialization+output*p*.045);}
    if(spec==='textile'){g.industrialization=clamp(g.industrialization+output*p*.035);}
    if(spec==='trade'||spec==='naval'){g.trade=clamp(g.trade+output*p*.06);}
    if(spec==='naval')g.maritime=clamp(g.maritime+output*p*.07);
    if(spec==='scholarship')g.knowledge=clamp(g.knowledge+output*p*.05);
    if(spec==='military')g.industrialization=clamp(g.industrialization+output*p*.018);
    if(spec==='luxury')g.trade=clamp(g.trade+output*p*.025);
    const dominant=spec==='mixed'?0:1;
    const diversity=Math.max(1,Object.values(g.scores||{}).filter(v=>v>35).length);
    g.diversification=clamp((diversity-1)*22+(1-dominant)*28+Math.min(20,(g.scores?.mixed||0)*.2));
    const employment=s.labor?.workers?1-(s.labor.unemployed||0)/Math.max(1,s.labor.workers):.5;
    g.employment=clamp(employment*100);
    const prosperity=s.prosperity||50;
    g.prosperity=clamp(prosperity+((g.marketAccess-50)*.008)+(g.trade*.002)+(g.industrialization*.0015));
    s.economicSpecialization=spec;s.economicAccess=g.marketAccess;s.regionalProsperity=g.prosperity;
  }
  function updateTradeProfile(s){
    const g=ensureSettlement(s),resources=keyResources();const exports={},imports={};
    resources.forEach(r=>{const potential=resourcePotential(s,r),local=inv(s)[r]||0,need=(pop(s)*(r==='food'?1.0:.16));if(potential>42&&local>need*.9)exports[r]=Number(clamp((local-need)*.12,0,20).toFixed(2));else if((local<need*.5||price(s,r)>(window.NPC_RESOURCES?.RESOURCES?.[r]?.base||10)*1.25))imports[r]=Number(clamp((need-local)*.08,0,15).toFixed(2));});
    g.exports=exports;g.imports=imports;
    if(s.market){Object.entries(exports).forEach(([r,q])=>{s.market.supply=s.market.supply||{};s.market.supply[r]=(s.market.supply[r]||0)+q*.06;});Object.entries(imports).forEach(([r,q])=>{s.market.demand=s.market.demand||{};s.market.demand[r]=(s.market.demand[r]||0)+q*.08;});}
  }
  function workforceFeedback(s){
    const g=ensureSettlement(s),locals=alive().filter(n=>n.settlementId===s.id&&n.age>=16),spec=g.specialization;
    if(!locals.length)return;
    let matching=0;
    locals.forEach(n=>{
      const role=n.roleId||'';
      if(spec==='farming'&&['farmer','herder','hunter'].includes(role))matching++;
      else if(spec==='mining'&&['miner','smith','blacksmith'].includes(role))matching++;
      else if(spec==='artisan'&&['craftsman','blacksmith','carpenter','builder'].includes(role))matching++;
      else if(spec==='trade'&&['merchant','trader','shopkeeper','peddler'].includes(role))matching++;
      else if(spec==='naval'&&['sailor','shipwright','fisherman'].includes(role))matching++;
      else if(spec==='scholarship'&&['scholar','healer','mage','alchemist'].includes(role))matching++;
      else if(spec==='military'&&['soldier','knight','captain','general','marshal'].includes(role))matching++;
      else if(spec==='textile'&&['weaver','tailor','leatherworker'].includes(role))matching++;
      else if(spec==='luxury'&&['merchant','craftsman','jeweler','smith'].includes(role))matching++;
    });
    const fit=matching/Math.max(1,locals.length);g.employment=clamp(g.employment*.8+fit*100*.2);
    if(window.EVERGLEN_LABOR?.ensure)window.EVERGLEN_LABOR.ensure(s);
    if(s.labor)s.labor.specializationFit=fit;
  }
  function kingdomProfile(k){
    const locals=ss().filter(s=>s.kingdomId===k.id);if(!locals.length)return;
    const profile={};locals.forEach(s=>{const spec=ensureSettlement(s).specialization;profile[spec]=(profile[spec]||0)+1;});
    const ranked=Object.entries(profile).sort((a,b)=>b[1]-a[1]);
    k.economicGeography=k.economicGeography||{};k.economicGeography.profile=profile;k.economicGeography.primarySpecialization=ranked[0]?.[0]||'mixed';k.economicGeography.diversity=Object.keys(profile).length;k.economicGeography.resourceCenters=locals.filter(s=>['mining','farming'].includes(ensureSettlement(s).specialization)).map(s=>s.id).slice(0,20);k.economicGeography.tradeHubs=locals.filter(s=>['trade','naval'].includes(ensureSettlement(s).specialization)).map(s=>s.id).slice(0,20);k.economicGeography.industrialCenters=locals.filter(s=>['artisan','textile','military'].includes(ensureSettlement(s).specialization)).map(s=>s.id).slice(0,20);
  }
  function frontierEffects(){
    ss().forEach(s=>{const g=ensureSettlement(s),trade=(window.EVERGLEN_LOGISTICS?.routes||[]).filter(r=>r.from===s.id||r.to===s.id);if(trade.length===0&&g.marketAccess<35){s.prosperity=clamp((s.prosperity||50)-.012);g.trade=clamp(g.trade-.02);}if(g.specialization==='mining'&&g.mining>75)s.wealth=(s.wealth||0)+.018;if(g.specialization==='farming'&&g.agriculture>75)s.foodSecurity=clamp((s.foodSecurity||50)+.018);if(g.specialization==='trade'&&g.marketAccess>70)s.prosperity=clamp((s.prosperity||50)+.015);});
  }
  function step(){
    if(!state.running)return;
    if(state.tick%24===0){ss().forEach(s=>{ensureSettlement(s);chooseSpecialization(s);applySpecialization(s);updateTradeProfile(s);workforceFeedback(s);});}
    if(state.tick%48===0)ks().forEach(kingdomProfile);
    if(state.tick%36===0)frontierEffects();
  }
  window.EVERGLEN_ECONOMIC_GEOGRAPHY={step,ensureSettlement,chooseSpecialization,resourcePotential,settlementType};
  if(state.registerSystem)state.registerSystem({name:'economic-geography',step,priority:60});
})();
