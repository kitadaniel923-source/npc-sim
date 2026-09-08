(() => {
  const state=window.SIM_STATE;if(!state)return;
  const personality=window.NPC_PERSONALITY;
  const memory=window.NPC_MEMORY;
  const resources=window.NPC_RESOURCES;
  const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,v));
  const alive=()=> (state.npcs||[]).filter(n=>n.alive);
  const score=(n,k)=>personality?.score(n,k)??50;
  const has=(n,t)=>personality?.has(n,t)||n.trait===t;
  const log=t=>typeof window.SIM_LOG==='function'?window.SIM_LOG(t):state.feed?.unshift(`Year ${state.year}, Day ${state.day}: ${t}`);
  const FALLBACK_BASE={food:8,wood:5,stone:7,iron:14,silver:32,gold:55,cloth:11,leather:13,wool:10,medicine:22,herbs:12,reagents:28,glass:26,paper:16,books:38,weapons:35,armor:42,tools:18,boats:70,battle_boats:150,horses:50};
  const FOOD_CONSUMERS=new Set(['farmer','hunter','soldier','knight','cavalry','captain','general','marshal','militia','cleric','druid','merchant','trader','teacher','scholar']);
  function ensure(n){
    n.wealth=Math.max(0,n.wealth||0);n.wallet=n.wallet??n.wealth;n.wage=n.wage??0;n.debt=n.debt??0;n.business=n.business||null;n.marketMood=n.marketMood||'stable';n.lifetimeIncome=n.lifetimeIncome||0;
  }
  function settlement(n){return state.settlements?.find(s=>s.id===n.settlementId)||null;}
  function basePrice(id){return resources?.RESOURCES?.[id]?.base??FALLBACK_BASE[id]??10;}
  function price(s,r){
    const stock=s?.resources?.[r]??0;
    const people=Math.max(1,state.npcs.filter(n=>n.alive&&n.settlementId===s?.id).length);
    const target=Math.max(8,people*(r==='food'?.9:.35));
    const scarcity=clamp((target-stock)/target,-.45,1.4);
    const demand=(s?.market?.demand?.[r]??0);
    const demandPressure=clamp(demand/Math.max(10,people*.8),0,1.5);
    return Math.max(1,basePrice(r)*(1+scarcity*.85+demandPressure*.22));
  }
  function outputValue(n,s){
    const recipe=resources?.OUTPUT?.[n.roleId];if(!recipe)return 0;
    return Object.entries(recipe).reduce((sum,[id,value])=>{if(value<=0)return sum;return sum+value*price(s,id);},0);
  }
  function consume(n){
    ensure(n);const s=settlement(n);if(!s)return;
    s.resources=s.resources||{};s.market=s.market||{demand:{}};s.market.demand=s.market.demand||{};
    const amount=.035*state.speed*(n.age<13?.7:n.age>60?.9:1);
    if(amount<=0)return;
    const cost=amount*price(s,'food');
    s.market.demand.food=(s.market.demand.food||0)+amount;
    if(n.wealth>=cost&&s.resources.food>0){n.wealth-=cost;s.resources.food=Math.max(0,s.resources.food-amount);n.needFoodCost=cost;n.needs&&(n.needs.hunger=clamp((n.needs.hunger||0)-1.5));}
    else {n.needs=n.needs||{};n.needs.hunger=clamp((n.needs.hunger||0)+2.8*state.speed);n.grievance=clamp((n.grievance||0)+.3*state.speed);}
  }
  function earn(n){
    ensure(n);if(n.age<16||n.roleId==='child')return;const s=settlement(n);if(!s)return;
    const gross=outputValue(n,s);const skill=(0.7+score(n,'discipline')/250)*(has(n,'hardworking')?1.12:1)*(has(n,'lazy')?.78:1);
    const demandBoost=1+clamp((s.market?.demand?.[n.roleId==='farmer'?'food':n.roleId==='blacksmith'?'weapons':n.roleId==='healer'?'medicine':n.roleId==='scholar'?'books':'tools']||0)/30,0,.35);
    const wage=Math.max(.15,gross*.18*skill*demandBoost);
    n.wage=wage;n.wealth+=wage*state.speed*.12;n.lifetimeIncome+=wage*state.speed*.12;s.wealth+=wage*state.speed*.025;
  }
  function demandResourceFor(n){
    if(['farmer','hunter','soldier','knight','cavalry','captain','general','marshal','militia','cleric','druid','merchant','trader'].includes(n.roleId))return'food';
    if(['blacksmith','soldier','knight','cavalry','captain','general','marshal','militia','archer','spearman'].includes(n.roleId))return'weapons';
    if(['healer','doctor','cleric','druid'].includes(n.roleId))return'medicine';
    if(['scholar','teacher','scribe','librarian'].includes(n.roleId))return n.roleId==='scholar'||n.roleId==='librarian'?'books':'paper';
    if(['builder','engineer','architect'].includes(n.roleId))return'tools';
    if(['shipwright','sailor'].includes(n.roleId))return'boats';
    return'cloth';
  }
  function householdDemand(n,s){
    if(!s)return;const r=demandResourceFor(n);s.market=s.market||{demand:{}};s.market.demand=s.market.demand||{};
    const budget=clamp((n.wealth*.004+.08)*state.speed,0,.8);s.market.demand[r]=(s.market.demand[r]||0)+budget;
    const cost=Math.min(n.wealth,budget*price(s,r));
    if(cost>0){n.wealth-=cost;s.resources[r]=Math.max(0,(s.resources[r]||0)-budget);}
  }
  function businessStep(n){
    ensure(n);if(n.age<18||!['merchant','trader','blacksmith','baker','carpenter','weaver','builder','healer','alchemist','farmer','shipwright'].includes(n.roleId))return;
    const s=settlement(n);if(!s)return;s.businesses=s.businesses||[];
    if(!n.business&&(has(n,'entrepreneur')||has(n,'ambitious')||score(n,'sociability')>72)&&n.wealth>30&&Math.random()<.012*state.speed){
      n.business={name:`${n.name}'s ${n.roleName||'Workshop'}`,capital:Math.min(60,n.wealth*.25),revenue:0,employees:0};n.wealth-=n.business.capital;s.businesses.push({ownerId:n.id,name:n.business.name,type:n.roleId,capital:n.business.capital});log(`${n.name} opened a business in ${s.name}.`);memory?.remember(n,'I opened my own business.','economy',2,n.settlementId,'pride');
    }
    if(!n.business)return;
    const output=outputValue(n,s);const product=n.roleId==='farmer'?'food':n.roleId==='blacksmith'?'weapons':n.roleId==='baker'?'food':n.roleId==='weaver'?'cloth':n.roleId==='healer'?'medicine':n.roleId==='alchemist'?'reagents':n.roleId==='shipwright'?'boats':'tools';
    const marketPrice=price(s,product);const scarcityBoost=clamp((marketPrice/basePrice(product))-1,0,1.2);const demand=(s.market?.demand?.[product]||0);const revenue=Math.max(.05,Math.min(output*.03,marketPrice*.03)*(1+scarcityBoost*.7+clamp(demand/20,0,.6)))*state.speed;
    n.business.revenue+=revenue;n.wealth+=revenue*.42;n.reputation=clamp((n.reputation||50)+revenue*.015);s.wealth+=revenue*.08;
    if(Math.random()<.008*state.speed&&score(n,'ambition')>70)n.business.employees=Math.min(8,n.business.employees+1);
  }
  function debtStep(n){
    ensure(n);
    if(n.wealth<2&&n.age>=18&&n.debt<50&&Math.random()<.006*state.speed){n.debt+=10+Math.random()*15;n.wealth+=10;memory?.experience(n,'I borrowed money to survive.','debt',2,null,'fear',1);}
    if(n.debt>0&&n.wealth>n.debt){const pay=Math.min(n.debt,n.wealth*.12);n.wealth-=pay;n.debt-=pay;}
    if(n.debt>40){n.grievance=clamp((n.grievance||0)+.04*state.speed);if(score(n,'risk')>70)n.goal='Find a way out of debt';}
  }
  function marketStep(s){
    if(!s?.resources)return;s.market=s.market||{prices:{},demand:{},lastUpdate:0,volume:0,trend:'stable'};s.market.demand=s.market.demand||{};
    const ids=resources?.catalog?Object.keys(resources.catalog()):Object.keys(FALLBACK_BASE);let total=0,scarce=0;
    ids.forEach(r=>{const p=price(s,r);s.market.prices[r]=Number(p.toFixed(2));if(p>basePrice(r)*1.5)scarce++;total+=p;});
    s.market.volume=Math.max(0,(s.market.volume||0)*.94+state.npcs.filter(n=>n.alive&&n.settlementId===s.id&&(n.roleId==='merchant'||n.roleId==='trader')).length);
    s.market.trend=scarce>=3?'inflation':scarce===0?'stable':'tight';
    Object.keys(s.market.demand).forEach(r=>s.market.demand[r]*=.86);
  }
  function tradeStep(n){
    if(n.age<18)return;const s=settlement(n);if(!s||!['merchant','trader','smuggler'].includes(n.roleId))return;
    const food=price(s,'food');
    if(food>basePrice('food')*1.7&&n.wealth>12){const profit=Math.min(2,n.wealth*.02);n.wealth+=profit;n.reputation=clamp((n.reputation||50)+.15);n.lastAction='Sold scarce goods at a premium';}
    if(food<basePrice('food')*.8&&n.roleId==='trader'&&Math.random()<.02){n.wealth+=3;n.lastAction='Bought cheap food for resale';}
  }
  function economyStep(){
    if(!state.running)return;
    state.settlements?.forEach(marketStep);
    alive().forEach(n=>{ensure(n);earn(n);consume(n);householdDemand(n,settlement(n));businessStep(n);debtStep(n);tradeStep(n);});
    state.food=clamp((state.settlements||[]).reduce((a,s)=>a+(s.resources?.food||0),0)/Math.max(1,state.settlements?.length||1),0,100);
  }
  window.NPC_ECONOMY={price,earn,consume,businessStep,marketStep,step:economyStep};
  if(state.registerSystem)state.registerSystem({name:'economy',step:economyStep,priority:50});
})();
