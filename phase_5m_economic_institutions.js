// Phase 5M: merchant houses, guild dynasties, monopolies and economic institutions.
(() => {
  const state=window.SIM_STATE;if(!state)return;
  const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,v));
  const ss=()=>state.settlements||[];
  const ks=()=>state.kingdoms||[];
  const npcs=()=>state.npcs||[];
  const alive=()=>npcs().filter(n=>n.alive);
  const memory=window.NPC_MEMORY;
  const score=(n,k)=>window.NPC_PERSONALITY?.score?.(n,k)??50;
  const dist=(a,b)=>Math.hypot((a.x||0)-(b.x||0),(a.y||0)-(b.y||0));
  const HOUSE_TYPES=['merchant-house','guild-house','banking-house','shipping-house','industrial-house','estate-house'];
  const TRADE_ROLES=['merchant','trader','shopkeeper','peddler'];
  function ensureKingdom(k){
    k.economicInstitutions=k.economicInstitutions||{};const e=k.economicInstitutions;
    e.houses=e.houses||[];e.guilds=e.guilds||[];e.monopolies=e.monopolies||[];e.rivalries=e.rivalries||[];e.influence=e.influence??0;e.businessWealth=e.businessWealth??0;e.marketControl=e.marketControl??0;e.history=e.history||[];
    return e;
  }
  function ensureSettlement(s){
    s.economicInstitutions=s.economicInstitutions||{};const e=s.economicInstitutions;
    e.houses=e.houses||[];e.guilds=e.guilds||[];e.monopolies=e.monopolies||[];e.commerce=e.commerce??0;e.institutionPower=e.institutionPower??0;e.history=e.history||[];
    return e;
  }
  function ensureNpc(n){
    n.business=n.business||{};const b=n.business;
    b.capital=b.capital??Math.max(0,(n.wealth||0)*.25);b.revenue=b.revenue??0;b.profit=b.profit??0;b.influence=b.influence??0;b.houseId=b.houseId||null;b.guildId=b.guildId||null;b.businessAge=b.businessAge??0;b.reputation=b.reputation??50;b.successions=b.successions||[];
  }
  function candidates(s){return alive().filter(n=>n.settlementId===s.id&&n.age>=25&&TRADE_ROLES.includes(n.roleId)).sort((a,b)=>{
    const sa=score(a,'ambition')+score(a,'charisma')+score(a,'discipline')+(a.wealth||0)*.25;
    const sb=score(b,'ambition')+score(b,'charisma')+score(b,'discipline')+(b.wealth||0)*.25;return sb-sa;
  });}
  function houseName(founder,type){
    const root=String(founder?.name||'House').split(/\s+/)[0];
    const suffix={ 'merchant-house':'Mercantile','guild-house':'Guild','banking-house':'Exchange','shipping-house':'Shipping','industrial-house':'Works','estate-house':'Estates'}[type]||'Company';
    return `${root} ${suffix}`;
  }
  function establishHouse(s,founder){
    ensureSettlement(s);ensureNpc(founder);if(founder.business.houseId)return s.economicInstitutions.houses.find(h=>h.id===founder.business.houseId)||null;
    const k=ks().find(x=>String(x.id)===String(s.kingdomId));if(k)ensureKingdom(k);
    const spec=s.economicGeography?.specialization||'mixed';
    const type=spec==='naval'?'shipping-house':spec==='mining'||spec==='artisan'?'industrial-house':spec==='trade'?'merchant-house':founder.business.capital>150?'banking-house':'estate-house';
    const house={id:`house-${s.id}-${state.year}-${s.economicInstitutions.houses.length+1}`,name:houseName(founder,type),type,founderId:founder.id,heirId:null,settlementId:s.id,kingdomId:s.kingdomId,capital:Math.max(20,founder.business.capital),wealth:Math.max(20,founder.wealth||0),reputation:clamp((founder.reputation||50)+10),influence:0,marketShare:0,monopoly:false,sector:spec,partners:[],competitors:[],employees:[],history:[],lastDividendYear:state.year,active:true};
    s.economicInstitutions.houses.push(house);founder.business.houseId=house.id;
    if(k)k.economicInstitutions.houses.push({id:house.id,name:house.name,type:house.type,settlementId:s.id});
    house.history.push({year:state.year,type:'founded',founderId:founder.id});s.economicInstitutions.history.push({year:state.year,type:'house-founded',houseId:house.id});
    return house;
  }
  function ensureHouseHouse(house){
    house.capital=Math.max(0,house.capital||0);house.wealth=Math.max(0,house.wealth||0);house.reputation=clamp(house.reputation??50);house.influence=clamp(house.influence??0);house.marketShare=clamp(house.marketShare??0);house.partners=house.partners||[];house.competitors=house.competitors||[];house.employees=house.employees||[];house.history=house.history||[];house.active=house.active!==false;
  }
  function appointHeir(house,s){
    if(house.heirId&&alive().some(n=>n.id===house.heirId))return;
    const founder=alive().find(n=>n.id===house.founderId);
    const pool=alive().filter(n=>n.settlementId===s.id&&n.age>=18&&n.age<=55).sort((a,b)=>{
      const fitA=score(a,'ambition')+score(a,'discipline')+score(a,'charisma')+(a.wealth||0)*.05;
      const fitB=score(b,'ambition')+score(b,'discipline')+score(b,'charisma')+(b.wealth||0)*.05;return fitB-fitA;
    });
    const direct=founder?pool.filter(n=>n.familyId&&n.familyId===founder.familyId)[0]:null;
    const heir=direct||pool[0];if(!heir)return;
    house.heirId=heir.id;ensureNpc(heir);heir.business.houseId=house.id;house.history.push({year:state.year,type:'heir-appointed',heirId:heir.id});
  }
  function houseOperations(s){
    const ge=s.economicGeography||{},market=s.market||{},t=s.tradeNetwork||{};
    ensureSettlement(s);
    s.economicInstitutions.houses.forEach(h=>{
      ensureHouseHouse(h);
      const founder=alive().find(n=>n.id===h.founderId);const heir=alive().find(n=>n.id===h.heirId);const leader=founder||heir;
      if(leader)ensureNpc(leader);
      const baseTurnover=Math.max(0,(ge.trade||0)+(t.hubScore||0)*.35+(s.prosperity||50)*.22);
      const specializationBonus={farming:1.05,mining:1.18,artisan:1.15,textile:1.08,trade:1.3,naval:1.32,scholarship:1.02,military:.95,luxury:1.25,mixed:1}[h.sector]||1;
      const routeBonus=(t.routePower||0)*.02;
      const turnover=(baseTurnover*specializationBonus+routeBonus)*.03;
      const risk=(s.economicPhase==='recession'?1.25:s.economicPhase==='financial-crisis'?1.5:s.economicPhase==='boom'?.7:1);
      h.revenue=Math.max(0,turnover);h.profit=Math.max(-turnover*.45,turnover*(.22-(risk-.7)*.15));
      h.capital=Math.max(0,h.capital+h.profit*.18);h.wealth=Math.max(0,h.wealth+h.profit*.05);h.reputation=clamp(h.reputation+(h.profit>0?.05:-.08));h.influence=clamp(h.influence+h.profit*.015);
      h.employees=(h.employees||[]).filter(id=>alive().some(n=>n.id===id));
      if(leader){leader.business.capital=h.capital;leader.business.revenue=(leader.business.revenue||0)+Math.max(0,h.revenue);leader.business.profit=(leader.business.profit||0)+h.profit;leader.business.influence=clamp((leader.business.influence||0)+h.influence*.01);leader.wealth=Math.max(0,(leader.wealth||0)+Math.max(0,h.profit*.02));}
      if(h.profit>0&&state.tick%48===0){const dividend=Math.min(h.profit*.2,Math.max(0,h.capital*.01));h.capital=Math.max(0,h.capital-dividend);if(leader)leader.wealth+=(dividend||0);h.history.push({year:state.year,type:'dividend',amount:Number(dividend.toFixed(2))});}
      appointHeir(h,s);
    });
  }
  function recruitHouses(s){
    ensureSettlement(s);const existing=s.economicInstitutions.houses.length;
    const pool=candidates(s).slice(0,8);
    pool.forEach((n,i)=>{ensureNpc(n);if(n.business.houseId)return;const threshold=i===0?120:220;if((n.wealth||0)+(n.business.capital||0)>threshold){establishHouse(s,n);}});
    if(existing<s.economicInstitutions.houses.length)s.economicInstitutions.history.push({year:state.year,type:'institution-growth',count:s.economicInstitutions.houses.length});
  }
  function marketShare(s){
    ensureSettlement(s);const houses=s.economicInstitutions.houses;const total=Math.max(1,houses.reduce((a,h)=>a+h.capital,0));houses.forEach(h=>{h.marketShare=clamp(h.capital/total*100);h.monopoly=h.marketShare>62;});s.economicInstitutions.institutionPower=clamp(houses.reduce((a,h)=>a+h.influence,0)*.5);s.economicInstitutions.commerce=clamp((s.tradeNetwork?.hubScore||0)*.35+(s.economicInstitutions.institutionPower||0)*.55);
  }
  function rivalry(s){
    ensureSettlement(s);const houses=s.economicInstitutions.houses.filter(h=>h.active);for(let i=0;i<houses.length;i++)for(let j=i+1;j<houses.length;j++){
      const a=houses[i],b=houses[j],difference=Math.abs(a.marketShare-b.marketShare);
      if(difference<18)continue;
      const existing=s.economicInstitutions.rivalries.find(r=>key(r.a,r.b)===key(a.id,b.id));
      if(existing){existing.tension=clamp(existing.tension+(difference>45?.4:.12));existing.lastYear=state.year;}
      else s.economicInstitutions.rivalries.push({a:a.id,b:b.id,tension:Number(clamp(15+difference*.3).toFixed(1)),startedYear:state.year,lastYear:state.year});
      a.competitors.includes(b.id)||a.competitors.push(b.id);b.competitors.includes(a.id)||b.competitors.push(a.id);
    }
    s.economicInstitutions.rivalries=s.economicInstitutions.rivalries.slice(-30);
  }
  function monopolyFeedback(s){
    ensureSettlement(s);const monopolists=s.economicInstitutions.houses.filter(h=>h.active&&h.monopoly);if(!monopolists.length)return;
    monopolists.forEach(h=>{
      const leader=alive().find(n=>n.id===h.founderId)||alive().find(n=>n.id===h.heirId);if(leader){leader.influence=(leader.influence||0)+.025;leader.reputation=clamp((leader.reputation||50)+.01);}
      s.market=s.market||{};s.market.monopolyPressure=(s.market.monopolyPressure||0)+.08;s.economicInstitutions.history.push({year:state.year,type:'monopoly',houseId:h.id,share:h.marketShare});
    });
    s.stability=clamp((s.stability||60)-monopolists.length*.01);
  }
  function guildIntegration(s){
    const society=s.society||{};const guilds=society.guilds||[];ensureSettlement(s);guilds.slice(0,8).forEach(g=>{if(!g.id)return;const existing=s.economicInstitutions.guilds.find(x=>x.id===g.id);if(!existing)s.economicInstitutions.guilds.push({id:g.id,name:g.name||`Guild of ${s.name}`,members:g.members||[],power:g.power||10});});
    s.economicInstitutions.guilds.forEach(g=>{g.power=clamp((g.power||10)+(g.members?.length||0)*.01);});
  }
  function kingdomFeedback(k){
    ensureKingdom(k);const locals=ss().filter(s=>s.kingdomId===k.id);const houses=locals.flatMap(s=>s.economicInstitutions?.houses||[]);const guilds=locals.flatMap(s=>s.economicInstitutions?.guilds||[]);
    k.economicInstitutions.businessWealth=houses.reduce((a,h)=>a+h.wealth,0);k.economicInstitutions.marketControl=clamp(houses.reduce((a,h)=>a+h.marketShare,0)/Math.max(1,locals.length));k.economicInstitutions.influence=clamp(houses.reduce((a,h)=>a+h.influence,0)*.35+guilds.reduce((a,g)=>a+g.power,0)*.22);
    if(k.finance){k.finance.taxBase=Math.max(0,(k.finance.taxBase||0)+k.economicInstitutions.businessWealth*.002);if(k.economicInstitutions.businessWealth>200)k.finance.credit=(k.finance.credit||50)+.04;}
    if(k.politics)k.politics.wealthPower=clamp((k.politics.wealthPower||0)+k.economicInstitutions.influence*.015);
    if(k.economicGeography)k.economicGeography.businessCenters=locals.filter(s=>(s.economicInstitutions?.institutionPower||0)>35).map(s=>s.id).slice(0,20);
  }
  function succession(){
    ss().forEach(s=>s.economicInstitutions?.houses?.forEach(h=>{
      const founder=npcs().find(n=>n.id===h.founderId);if(founder?.alive)return;
      const heir=npcs().find(n=>n.id===h.heirId);if(heir){h.founderId=heir.id;h.heirId=null;h.history.push({year:state.year,type:'succession',newLeaderId:heir.id});ensureNpc(heir);heir.business.houseId=h.id;}
      else {h.active=false;h.reputation=clamp(h.reputation-12);}
    }));
  }
  function createGuildHouseLinks(s){
    ensureSettlement(s);s.economicInstitutions.houses.forEach(h=>{const compatible=s.economicInstitutions.guilds.find(g=>String(g.name||'').toLowerCase().includes(h.sector));if(compatible&&!h.guildId)h.guildId=compatible.id;});
  }
  function key(a,b){return [String(a),String(b)].sort().join(':');}
  function step(){
    if(!state.running)return;
    ss().forEach(ensureSettlement);ks().forEach(ensureKingdom);alive().forEach(ensureNpc);
    if(state.tick%48===0)ss().forEach(recruitHouses);
    if(state.tick%24===0)ss().forEach(houseOperations);
    if(state.tick%36===0)ss().forEach(marketShare);
    if(state.tick%60===0)ss().forEach(rivalry);
    if(state.tick%72===0)ss().forEach(monopolyFeedback);
    if(state.tick%48===0)ss().forEach(guildIntegration);
    if(state.tick%84===0)ss().forEach(createGuildHouseLinks);
    if(state.tick%96===0)ks().forEach(kingdomFeedback);
    if(state.tick%120===0)succession();
  }
  window.EVERGLEN_ECONOMIC_INSTITUTIONS={step,establishHouse,marketShare,rivalry,succession};
  if(state.registerSystem)state.registerSystem({name:'economic-institutions',step,priority:66});
})();
