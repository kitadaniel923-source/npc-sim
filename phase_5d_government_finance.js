// Phase 5D: medieval taxation, treasury management and public spending.
(() => {
  const state=window.SIM_STATE;if(!state)return;
  const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,v));
  const npcs=()=>state.npcs||[];
  const settlements=()=>state.settlements||[];
  const kingdoms=()=>state.kingdoms||[];
  const log=t=>window.SIM_API?.log?.(t);
  const memory=window.NPC_MEMORY;

  const CLASS_TAX={destitute:.01,poor:.018,working:.028,comfortable:.04,wealthy:.065,elite:.085};
  const DEFAULT_BUDGET={army:.28,infrastructure:.22,court:.1,relief:.16,faith:.07,education:.07,reserves:.1};

  function ensureKingdom(k){
    k.finance=k.finance||{};
    const f=k.finance;
    f.treasury=f.treasury??Math.max(30,(k.wealth||0)*.25+20);
    f.income=f.income??0;f.expenses=f.expenses??0;f.taxCollected=f.taxCollected??0;
    f.debt=f.debt??0;f.interest=f.interest??0;f.deficit=f.deficit??0;f.surplus=f.surplus??0;
    f.taxPolicy=f.taxPolicy||'balanced';f.taxRate=f.taxRate??.035;
    f.spending=Object.assign({},DEFAULT_BUDGET,f.spending||{});
    f.reserves=f.reserves??Math.max(10,f.treasury*.2);
    f.stability=f.stability??60;f.credit=f.credit??60;f.history=f.history||[];
  }

  function classOf(n){return n.wealthClass||n.economicClass||'working';}
  function settlementOf(n){return settlements().find(s=>s.id===n.settlementId)||null;}
  function householdValue(n){return Math.max(0,n.wealth||0)+(n.business?.capital||0)+(n.savings?.balance||0);}
  function taxableCapacity(n){
    const c=classOf(n);const multiplier={destitute:0,poor:.35,working:.75,comfortable:1.1,wealthy:1.7,elite:2.5}[c]??.75;
    return householdValue(n)*multiplier;
  }
  function effectiveRate(k,n){
    const f=k.finance,policy=f.taxPolicy;
    const policyMult=policy==='light'?.7:policy==='heavy'?1.35:policy==='austere'?1.15:1;
    const wealthAdjustment=classOf(n)==='elite' || classOf(n)==='wealthy' ? 1.08 : 1;
    return clamp((f.taxRate||.035)*policyMult*wealthAdjustment,0,.18);
  }

  function collectTaxes(k){
    ensureKingdom(k);let collected=0,workers=0;
    const members=npcs().filter(n=>n.alive&&String(n.faction??n.kingdomId)===String(k.id));
    for(const n of members){
      const cap=taxableCapacity(n);if(cap<=0)continue;
      const tax=cap*effectiveRate(k,n)*.018*state.speed;
      const paid=Math.min(Math.max(0,n.wealth||0),tax);
      if(paid>0){n.wealth-=paid;collected+=paid;workers++;n.taxBurden=(n.taxBurden||0)+paid;}
    }
    // Settlement commerce contributes a smaller fiscal stream.
    k.finance.taxCollected+=collected;
    k.finance.income+=collected;
    k.finance.treasury+=collected;
    k.finance.taxpayers=workers;
    return collected;
  }

  function policy(k){
    const f=k.finance;
    const tension=k.society?.unrest?.pressure??k.unrest??0;
    const war=state.war?1:0;
    if(f.treasury<15&&f.debt<40)f.taxPolicy='heavy';
    else if((f.deficit||0)>20||war)f.taxPolicy='austere';
    else if(tension>55)f.taxPolicy='light';
    else f.taxPolicy='balanced';
    f.taxRate=clamp(f.taxPolicy==='heavy'?.07:f.taxPolicy==='austere'?.05:f.taxPolicy==='light'?.022:.035,.01,.12);
  }

  function spend(k){
    ensureKingdom(k);const f=k.finance;const budget=Math.max(0,f.treasury*.055*state.speed);if(budget<=0)return;
    const weights=f.spending,total=Object.values(weights).reduce((a,v)=>a+Math.max(0,v),0)||1;
    let spent=0;
    for(const [category,w] of Object.entries(weights)){
      const amount=budget*(Math.max(0,w)/total);if(amount<=0)continue;spent+=amount;
      switch(category){
        case 'army': k.military=k.military||{};k.military.funding=(k.military.funding||0)+amount*.55; k.military.readiness=clamp((k.military.readiness||40)+amount*.08);break;
        case 'infrastructure': k.infrastructure=k.infrastructure||{};k.infrastructure.funding=(k.infrastructure.funding||0)+amount;settlements().filter(s=>String(s.kingdomId)===String(k.id)).forEach(s=>{s.infrastructure=s.infrastructure||{};s.infrastructure.funding=(s.infrastructure.funding||0)+amount/Math.max(1,settlements().length);s.infrastructure.quality=clamp((s.infrastructure.quality||45)+amount*.012);});break;
        case 'court': k.legitimacy=clamp((k.legitimacy??55)+amount*.018);break;
        case 'relief': settlements().filter(s=>String(s.kingdomId)===String(k.id)).forEach(s=>{s.foodSecurity=clamp((s.foodSecurity||50)+amount*.018);s.stability=clamp((s.stability||60)+amount*.012);});break;
        case 'faith': k.culture=k.culture||{};k.culture.faithFunding=(k.culture.faithFunding||0)+amount;break;
        case 'education': k.education=k.education||{};k.education.funding=(k.education.funding||0)+amount;break;
        case 'reserves': f.reserves+=amount*.7;break;
      }
    }
    f.expenses+=spent;f.treasury=Math.max(0,f.treasury-spent);
  }

  function borrow(k){
    ensureKingdom(k);const f=k.finance;if(f.treasury>20||f.deficit<8)return;
    const bank=window.EVERGLEN_BANKING;
    const amount=Math.min(60,Math.max(10,15+f.deficit));
    if(bank?.lendGovernment&&bank.lendGovernment(k,amount)){
      f.debt+=amount;f.treasury+=amount;f.credit=clamp(f.credit-2);return;
    }
    f.debt+=amount;f.treasury+=amount;f.credit=clamp(f.credit-4);
  }

  function serviceDebt(k){
    ensureKingdom(k);const f=k.finance;if(f.debt<=0)return;
    const interest=f.debt*(.004+((100-f.credit)/100)*.003)*state.speed;f.interest+=interest;
    f.debt+=interest;
    const payment=Math.min(f.debt,Math.max(0,f.treasury*.018*state.speed));
    f.debt-=payment;f.treasury-=payment;f.expenses+=payment;
    if(f.debt>90){f.credit=clamp(f.credit-.12);k.legitimacy=clamp((k.legitimacy??50)-.035);k.society=k.society||{};k.society.unrestPressure=(k.society.unrestPressure||0)+.02;}
  }

  function fiscalFeedback(k){
    ensureKingdom(k);const f=k.finance;const members=npcs().filter(n=>n.alive&&String(n.faction??n.kingdomId)===String(k.id));
    const burden=members.length?members.reduce((a,n)=>a+(n.taxBurden||0),0)/members.length:0;
    f.deficit=Math.max(0,f.expenses-f.income);f.surplus=Math.max(0,f.income-f.expenses);
    f.stability=clamp(52+(f.treasury/Math.max(1,members.length))*1.2-f.deficit*.65-(f.debt>80?15:0));
    f.credit=clamp(60+Math.min(25,f.reserves*.35)-f.debt*.28-f.deficit*.45);
    if(f.taxPolicy==='heavy'&&burden>1)members.slice(0,40).forEach(n=>{n.grievance=clamp((n.grievance||0)+.035*state.speed);if(memory&&Math.random()<.012*state.speed)memory.remember(n,'The crown taxes my household heavily.','taxation',2,k.id,'anger');});
    if(f.surplus>15&&f.reserves<25)f.reserves+=f.surplus*.08;
    k.wealth=Math.max(0,(k.wealth||0)+f.income-f.expenses);
  }

  function step(){
    if(!state.running)return;
    kingdoms().forEach(k=>ensureKingdom(k));
    if(state.tick%24===0)kingdoms().forEach(policy);
    if(state.tick%12===0)kingdoms().forEach(collectTaxes);
    if(state.tick%18===0)kingdoms().forEach(spend);
    if(state.tick%30===0)kingdoms().forEach(borrow);
    if(state.tick%20===0)kingdoms().forEach(serviceDebt);
    if(state.tick%12===0)kingdoms().forEach(fiscalFeedback);
  }

  window.EVERGLEN_GOVERNMENT_FINANCE={step,collectTaxes,spend,borrow,serviceDebt};
  if(state.registerSystem)state.registerSystem({name:'government-finance',step,priority:88});
})();
