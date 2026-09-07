(() => {
  const state=window.SIM_STATE;if(!state)return;
  const personality=window.NPC_PERSONALITY;
  const memory=window.NPC_MEMORY;
  const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,v));
  const alive=()=> (state.npcs||[]).filter(n=>n.alive);
  const score=(n,k)=>personality?.score(n,k)??50;
  const has=(n,t)=>personality?.has(n,t)||n.trait===t;
  const log=t=>typeof window.SIM_LOG==='function'?window.SIM_LOG(t):state.feed?.unshift(`Year ${state.year}, Day ${state.day}: ${t}`);
  const BASE={food:8,wood:5,stone:7,iron:14,cloth:11,medicine:22,reagents:28,weapons:35,armor:42,tools:18};

  function ensure(n){
    n.wealth=Math.max(0,n.wealth||0); n.wallet=n.wallet??n.wealth;
    n.wage=n.wage??0; n.debt=n.debt??0; n.business=n.business||null; n.marketMood=n.marketMood||'stable';
  }
  function settlement(n){return state.settlements?.find(s=>s.id===n.settlementId)||null;}
  function price(s,r){
    const stock=s?.resources?.[r]??0;
    const people=Math.max(1,state.npcs.filter(n=>n.alive&&n.settlementId===s?.id).length);
    const target=Math.max(12,people*.7);
    const scarcity=clamp((target-stock)/target*70,-45,140);
    return Math.max(1,(BASE[r]||10)*(1+scarcity/100));
  }
  function earn(n){
    ensure(n); if(n.age<16||n.roleId==='child')return;
    const skill={farmer:1.0,hunter:1.05,miner:1.1,woodcutter:.95,builder:1.08,blacksmith:1.2,merchant:1.35,trader:1.45,healer:1.25,scholar:1.15,teacher:1.1,engineer:1.35,architect:1.3,soldier:.95,captain:1.25,cleric:1.0,alchemist:1.3,thief:1.15,smuggler:1.35}[n.roleId]||.8;
    let wage=(2.2*skill)*(0.8+score(n,'discipline')/200);
    if(n.roleId==='merchant'||n.roleId==='trader') wage*=1.15;
    if(has(n,'hardworking'))wage*=1.15;
    if(has(n,'lazy'))wage*=.75;
    if(n.term>0)wage=0;
    n.wage=wage; n.wealth+=wage*.25*state.speed;
  }
  function consume(n){
    ensure(n);const s=settlement(n);if(!s)return;
    s.resources=s.resources||{};
    const base=BASE.food||8;
    let need=.035*state.speed;
    if(n.age<13)need*=.7;
    if(n.age>60)need*=.9;
    const p=price(s,'food'); const cost=need*p;
    if((n.wealth||0)>=cost){n.wealth-=cost;s.resources.food=Math.max(0,(s.resources.food||0)-need);n.needFoodCost=cost;}
    else {n.needs=n.needs||{};n.needs.hunger=clamp((n.needs.hunger||0)+2.5*state.speed);n.grievance=clamp((n.grievance||0)+.25*state.speed);}
  }
  function businessStep(n){
    ensure(n); if(n.age<18||!['merchant','trader','blacksmith','baker','carpenter','weaver','builder','healer','alchemist','farmer'].includes(n.roleId))return;
    const s=settlement(n); if(!s)return;
    if(!n.business && (has(n,'entrepreneur')||has(n,'ambitious')||score(n,'sociability')>72) && n.wealth>30 && Math.random()<.012*state.speed){
      n.business={name:`${n.name}'s ${n.roleName||'Workshop'}`,capital:Math.min(60,n.wealth*.25),revenue:0,employees:0};n.wealth-=n.business.capital;log(`${n.name} opened a business in ${s.name}.`);memory?.remember(n,`I opened my own business.`,'economy',2,n.settlementId,'pride');
    }
    if(!n.business)return;
    const demand=['merchant','trader'].includes(n.roleId)?1.25:1;
    const revenue=Math.max(.1,(price(s,n.roleId==='farmer'?'food':n.roleId==='blacksmith'?'weapons':n.roleId==='baker'?'food':n.roleId==='weaver'?'cloth':n.roleId==='healer'?'medicine':n.roleId==='alchemist'?'reagents':'tools')*.025*demand);
    n.business.revenue+=revenue; n.wealth+=revenue*.35*state.speed; n.reputation=clamp((n.reputation||50)+.04);
    if(Math.random()<.01&&score(n,'ambition')>70){n.business.employees=Math.min(8,n.business.employees+1);}
  }
  function debtStep(n){
    ensure(n);
    if(n.wealth<2 && n.age>=18 && n.debt<50){
      if(Math.random()<.006*state.speed){n.debt+=10+Math.random()*15;n.wealth+=10;memory?.experience(n,'I borrowed money to survive.','debt',2,null,'fear',1);}
    }
    if(n.debt>0 && n.wealth>n.debt){const pay=Math.min(n.debt,n.wealth*.12);n.wealth-=pay;n.debt-=pay;}
    if(n.debt>40){n.grievance=clamp((n.grievance||0)+.04*state.speed);if(score(n,'risk')>70)n.goal='Find a way out of debt';}
  }
  function marketStep(s){
    if(!s?.resources)return;
    s.market=s.market||{prices:{},lastUpdate:0,volume:0,trend:'stable'};
    const resources=['food','wood','stone','iron','cloth','medicine','reagents','weapons','armor','tools'];
    let total=0,scarce=0;
    resources.forEach(r=>{const p=price(s,r);s.market.prices[r]=Number(p.toFixed(2));if(p>BASE[r]*1.5)scarce++;total+=p;});
    s.market.volume=Math.max(0,(s.market.volume||0)*.96+state.npcs.filter(n=>n.alive&&n.settlementId===s.id&&(n.roleId==='merchant'||n.roleId==='trader')).length);
    s.market.trend=scarce>=3?'inflation':scarce===0?'stable':'tight';
  }
  function tradeStep(n){
    if(n.age<18)return;const s=settlement(n);if(!s)return;
    if(!['merchant','trader','smuggler'].includes(n.roleId))return;
    const food=price(s,'food');
    if(food>BASE.food*1.7 && n.wealth>12){n.wealth-=2;n.reputation=clamp((n.reputation||50)+.15);n.lastAction='Sold scarce goods at a premium';}
    if(food<BASE.food*.8 && n.roleId==='trader' && Math.random()<.02){n.wealth+=3;n.lastAction='Bought cheap food for resale';}
  }
  function economyStep(){
    if(!state.running)return;
    state.settlements?.forEach(marketStep);
    alive().forEach(n=>{ensure(n);earn(n);consume(n);businessStep(n);debtStep(n);tradeStep(n);});
    state.food=clamp((state.settlements||[]).reduce((a,s)=>a+(s.resources?.food||0),0)/Math.max(1,state.settlements?.length||1),0,100);
  }
  window.NPC_ECONOMY={price,earn,consume,businessStep,marketStep,step:economyStep};
  if(state.registerSystem)state.registerSystem({name:'economy',step:economyStep,priority:50});
})();
