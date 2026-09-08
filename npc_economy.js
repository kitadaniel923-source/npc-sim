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
  const FALLBACK_BASE={food:8,fish:10,grain:7,livestock:24,wood:5,stone:7,iron:14,silver:32,gold:55,mithril:95,adamantine:125,emberite:85,moonstone:90,voidstone:120,starsteel:150,cloth:11,leather:13,wool:10,medicine:22,herbs:12,reagents:28,glass:26,paper:16,books:38,weapons:35,armor:42,tools:18,boats:70,battle_boats:150,horses:50};
  const PRODUCERS=new Set(['farmer','hunter','miner','woodcutter','builder','blacksmith','carpenter','weaver','healer','merchant','trader','shipwright','alchemist','enchanter','druid']);
  function ensure(n){n.wealth=Math.max(0,n.wealth||0);n.wallet=n.wallet??n.wealth;n.wage=n.wage??0;n.debt=n.debt??0;n.business=n.business||null;n.marketMood=n.marketMood||'stable';n.lifetimeIncome=n.lifetimeIncome||0;n.economicOutput=n.economicOutput||0;}
  function settlement(n){return state.settlements?.find(s=>s.id===n.settlementId)||null;}
  function basePrice(id){return resources?.RESOURCES?.[id]?.base??resources?.catalog?.()?.[id]?.base??FALLBACK_BASE[id]??10;}
  function inventory(s){s.resources=s.resources||{};return s.resources;}
  function price(s,r){
    if(!s)return basePrice(r);
    const stock=inventory(s)[r]??0;
    const people=Math.max(1,state.npcs.filter(n=>n.alive&&n.settlementId===s.id).length);
    const target=Math.max(6,people*(r==='food'?.9:r==='wood'||r==='stone'?.25:.18));
    const scarcity=clamp((target-stock)/target,-.55,1.8);
    const demand=s.market?.demand?.[r]??0;
    const demandPressure=clamp(demand/Math.max(6,people*.55),0,2);
    const trend=s.market?.trend==='inflation'?.08:s.market?.trend==='tight'?.04:0;
    return Math.max(1,basePrice(r)*(1+scarcity*.92+demandPressure*.28+trend));
  }
  function recipe(n){return resources?.OUTPUT?.[n.roleId]||null;}
  function outputValue(n,s){const out=recipe(n);if(!out)return 0;return Object.entries(out).reduce((sum,[id,value])=>value>0?sum+value*price(s,id):sum,0);}
  function outputUnits(n,s){
    const out=recipe(n);if(!out)return {};
    const skill=(.72+score(n,'discipline')/230)*(has(n,'hardworking')?1.12:1)*(has(n,'lazy')?.78:1);
    const prosperity=clamp(((s?.prosperity??50)-35)/100,.7,1.35);
    const fatigue=clamp((n.needs?.energy??n.energy??80)/90,.55,1.08);
    const units={};Object.entries(out).forEach(([id,v])=>{if(v>0)units[id]=v*.16*skill*prosperity*fatigue*state.speed;});return units;
  }
  function produce(n,s){
    if(!PRODUCERS.has(n.roleId)||n.age<16||!s)return 0;
    const inv=inventory(s),out=recipe(n);if(!out)return 0;
    const units=outputUnits(n,s);let producedValue=0;
    for(const [id,value] of Object.entries(out)){
      if(value<0){const need=Math.abs(value)*.16*state.speed;const have=inv[id]??0;const used=Math.min(have,need);if(used<need*.55)return 0;inv[id]=Math.max(0,have-used);}
    }
    for(const [id,unitsMade] of Object.entries(units)){inv[id]=(inv[id]||0)+unitsMade;producedValue+=unitsMade*price(s,id);}
    n.economicOutput+=producedValue;n.lastOutputValue=producedValue;
    return producedValue;
  }
  function consume(n){ensure(n);const s=settlement(n);if(!s)return;const inv=inventory(s);s.market=s.market||{demand:{}};s.market.demand=s.market.demand||{};const amount=.022*state.speed*(n.age<13?.7:n.age>60?.9:1);const cost=amount*price(s,'food');s.market.demand.food+=(amount*1.8);if(n.wealth>=cost&&inv.food>0){n.wealth-=cost;inv.food=Math.max(0,inv.food-amount);n.needFoodCost=cost;n.needs&&(n.needs.hunger=clamp((n.needs.hunger||0)-1.7));}else{n.needs=n.needs||{};n.needs.hunger=clamp((n.needs.hunger||0)+2.5*state.speed);n.grievance=clamp((n.grievance||0)+.32*state.speed);}}
  function demandResourceFor(n){if(['farmer','hunter','soldier','knight','cavalry','captain','general','marshal','militia','cleric','druid','merchant','trader'].includes(n.roleId))return'food';if(['blacksmith','soldier','knight','cavalry','captain','general','marshal','militia','archer','spearman'].includes(n.roleId))return'weapons';if(['healer','doctor','cleric','druid'].includes(n.roleId))return'medicine';if(['scholar','teacher','scribe','librarian'].includes(n.roleId))return n.roleId==='scholar'||n.roleId==='librarian'?'books':'paper';if(['builder','engineer','architect'].includes(n.roleId))return'tools';if(['shipwright','sailor'].includes(n.roleId))return'boats';return'cloth';}
  function householdDemand(n,s){if(!s)return;const r=demandResourceFor(n);s.market=s.market||{demand:{}};s.market.demand=s.market.demand||{};const budget=clamp((n.wealth*.0025+.05)*state.speed,0,.55);s.market.demand[r]=(s.market.demand[r]||0)+budget*.8;const cost=Math.min(n.wealth,budget*price(s,r));if(cost>0){n.wealth-=cost;inventory(s)[r]=Math.max(0,(inventory(s)[r]||0)-budget);}}
  function earn(n,producedValue){ensure(n);if(n.age<16)return;const s=settlement(n);if(!s)return;const value=producedValue??n.lastOutputValue??0;const skill=clamp(.72+score(n,'discipline')/260,.7,1.12);const productivity=Math.max(.15,value);const wage=Math.max(.1,productivity*.12*skill);n.wage=wage;n.wealth+=wage*state.speed*.08;n.lifetimeIncome+=wage*state.speed*.08;s.wealth+=wage*state.speed*.02;}
  function businessStep(n){ensure(n);if(n.age<18||!['merchant','trader','blacksmith','baker','carpenter','weaver','builder','healer','alchemist','farmer','shipwright'].includes(n.roleId))return;const s=settlement(n);if(!s)return;s.businesses=s.businesses||[];if(!n.business&&(has(n,'entrepreneur')||has(n,'ambitious')||score(n,'sociability')>72)&&n.wealth>30&&Math.random()<.012*state.speed){n.business={name:`${n.name}'s ${n.roleName||'Workshop'}`,capital:Math.min(60,n.wealth*.25),revenue:0,employees:0,production:0};n.wealth-=n.business.capital;s.businesses.push({ownerId:n.id,name:n.business.name,type:n.roleId,capital:n.business.capital});log(`${n.name} opened a business in ${s.name}.`);memory?.remember(n,'I opened my own business.','economy',2,n.settlementId,'pride');}if(!n.business)return;const produced=n.lastOutputValue||0;const product=n.roleId==='farmer'?'food':n.roleId==='blacksmith'?'weapons':n.roleId==='baker'?'food':n.roleId==='weaver'?'cloth':n.roleId==='healer'?'medicine':n.roleId==='alchemist'?'reagents':n.roleId==='shipwright'?'boats':'tools';const marketPrice=price(s,product);const demand=(s.market?.demand?.[product]||0);const sales=Math.min(produced*.35,marketPrice*.05)*(1+clamp(demand/18,0,.8));const revenue=Math.max(0,sales)*state.speed;n.business.production+=produced;n.business.revenue+=revenue;n.wealth+=revenue*.4;n.reputation=clamp((n.reputation||50)+revenue*.012);s.wealth+=revenue*.06;if(Math.random()<.008*state.speed&&score(n,'ambition')>70)n.business.employees=Math.min(8,n.business.employees+1);}
  function debtStep(n){ensure(n);if(n.wealth<2&&n.age>=18&&n.debt<50&&Math.random()<.006*state.speed){n.debt+=10+Math.random()*15;n.wealth+=10;memory?.experience(n,'I borrowed money to survive.','debt',2,null,'fear',1);}if(n.debt>0&&n.wealth>n.debt){const pay=Math.min(n.debt,n.wealth*.12);n.wealth-=pay;n.debt-=pay;}if(n.debt>40){n.grievance=clamp((n.grievance||0)+.04*state.speed);if(score(n,'risk')>70)n.goal='Find a way out of debt';}}
  function marketStep(s){if(!s?.resources)return;s.market=s.market||{prices:{},demand:{},lastUpdate:0,volume:0,trend:'stable'};s.market.demand=s.market.demand||{};const ids=resources?.catalog?Object.keys(resources.catalog()):Object.keys(FALLBACK_BASE);let scarce=0,total=0;ids.forEach(r=>{const p=price(s,r);s.market.prices[r]=Number(p.toFixed(2));if(p>basePrice(r)*1.5)scarce++;total+=p;});s.market.volume=Math.max(0,(s.market.volume||0)*.94+state.npcs.filter(n=>n.alive&&n.settlementId===s.id&&(n.roleId==='merchant'||n.roleId==='trader')).length);s.market.trend=scarce>=3?'inflation':scarce===0?'stable':'tight';s.market.priceIndex=Number((total/Math.max(1,ids.length)).toFixed(2));Object.keys(s.market.demand).forEach(r=>s.market.demand[r]*=.86);}
  function tradeStep(n){if(n.age<18)return;const s=settlement(n);if(!s||!['merchant','trader','smuggler'].includes(n.roleId))return;const nearby=state.settlements?.filter(x=>x.id!==s.id).map(x=>({s:x,food:(x.resources?.food||0)})).filter(x=>x.food>8).sort((a,b)=>b.food-a.food)[0];const localFood=inventory(s).food||0;if(nearby&&localFood<12&&Math.random()<.035){const imported=Math.min(3,nearby.food*.08);nearby.food-=imported;inventory(s).food+=imported;n.wealth=Math.max(0,n.wealth-imported*price(s,'food')*.55);n.lastAction=`Imported ${imported.toFixed(1)} food from ${nearby.s.name}`;memory?.remember(n,n.lastAction,'trade',2,nearby.s.id,'pride');return;}const foodPrice=price(s,'food');if(foodPrice>basePrice('food')*1.7&&n.wealth>12){const profit=Math.min(2,n.wealth*.02);n.wealth+=profit;n.reputation=clamp((n.reputation||50)+.15);n.lastAction='Sold scarce goods at a premium';}}
  function economyStep(){if(!state.running)return;state.settlements?.forEach(s=>{marketStep(s);});alive().forEach(n=>{ensure(n);const s=settlement(n);const produced=produce(n,s);earn(n,produced);consume(n);householdDemand(n,s);businessStep(n);debtStep(n);tradeStep(n);});state.settlements?.forEach(s=>{const p=state.npcs.filter(n=>n.alive&&n.settlementId===s.id);const stock=inventory(s);const foodPerCap=p.length?((stock.food||0)/p.length):0;s.foodSecurity=clamp(foodPerCap*70);s.prosperity=clamp(((s.wealth||0)/Math.max(1,p.length))*1.5+(s.foodSecurity||0)*.25);});state.food=clamp((state.settlements||[]).reduce((a,s)=>a+(s.resources?.food||0),0)/Math.max(1,state.settlements?.length||1),0,100);}
  window.NPC_ECONOMY={price,produce,earn,consume,businessStep,marketStep,tradeStep,step:economyStep};
  if(state.registerSystem)state.registerSystem({name:'economy',step:economyStep,priority:50});
})();
