// Phase 5O: economic diplomacy, sovereign lending, aid, investment, debt leverage and financial alliances.
(() => {
  const state=window.SIM_STATE;if(!state)return;
  const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,v));
  const ks=()=>state.kingdoms||[];
  const ss=()=>state.settlements||[];
  const alive=()=> (state.npcs||[]).filter(n=>n.alive);
  const key=(a,b)=>[String(a),String(b)].sort().join(':');
  const rel=(a,b)=>state.diplomacy?.relations?.[key(a,b)]||null;
  const memory=window.NPC_MEMORY;
  const log=t=>window.SIM_API?.log?.(t);

  function ensureKingdom(k){
    k.economicDiplomacy=k.economicDiplomacy||{};const e=k.economicDiplomacy;
    e.loans=e.loans||[];e.aid=e.aid||[];e.investments=e.investments||[];e.alliances=e.alliances||[];e.leverage=e.leverage??0;e.receivedAid=e.receivedAid??0;e.sentAid=e.sentAid??0;e.foreignAssets=e.foreignAssets??0;e.foreignDebt=e.foreignDebt??0;e.creditorPower=e.creditorPower??0;e.debtorPressure=e.debtorPressure??0;e.history=e.history||[];e.lastDecisionYear=e.lastDecisionYear??0;
    return e;
  }
  function capacity(k){
    const f=k.finance||{},c=k.currency||{},t=k.tradeNetwork||{};
    return Math.max(0,(f.treasury||0)+(k.wealth||0)*.2+(t.power||0)*.35+(c.trust||50)*.2);
  }
  function security(k){return clamp((k.power||25)*.55+(k.legitimacy||55)*.2-(k.tension||0)*.15);}
  function friendly(a,b){return (rel(a.id,b.id)?.score??0)>5;}
  function relationShift(a,b,delta,reason){
    const r=rel(a,b);if(r)r.score=clamp((r.score||0)+delta,-100,100);
    a.economicDiplomacy.history.push({year:state.year,type:'relation-shift',other:b.id,delta,reason});
  }
  function lend(a,b,amount,terms='friendly-loan'){
    ensureKingdom(a);ensureKingdom(b);const af=a.economicDiplomacy,bf=b.economicDiplomacy;
    const f=a.finance||{},available=Math.max(0,(f.treasury||0)*.22);const q=Math.min(Math.max(0,amount),available);if(q<3)return false;
    f.treasury-=q;b.finance=b.finance||{};b.finance.treasury=(b.finance.treasury||0)+q;
    const loan={id:`sovereign-loan-${a.id}-${b.id}-${state.year}-${Math.floor(Math.random()*1e6)}`,lenderId:a.id,borrowerId:b.id,principal:q,balance:q*1.08,rate:.08,startedYear:state.year,dueYear:state.year+5,terms,status:'active',payments:0};af.loans.push(loan);bf.loans.push({id:loan.id,lenderId:a.id,principal:q,balance:loan.balance,dueYear:loan.dueYear,status:'active'});
    af.leverage=clamp(af.leverage+q*.12);bf.foreignDebt+=q;bf.debtorPressure=clamp(bf.debtorPressure+q*.08);relationShift(a,b,Math.min(8,q*.08),'sovereign-loan');
    log(`${a.name} extended a sovereign loan to ${b.name}.`);return true;
  }
  function aid(a,b,amount,reason='famine-relief'){
    ensureKingdom(a);ensureKingdom(b);const available=Math.max(0,(a.finance?.treasury||0)*.12);const q=Math.min(Math.max(0,amount),available);if(q<2)return false;
    a.finance.treasury-=q;b.finance=b.finance||{};b.finance.treasury=(b.finance.treasury||0)+q;
    a.economicDiplomacy.sentAid+=q;b.economicDiplomacy.receivedAid+=q;
    b.legitimacy=clamp((b.legitimacy||55)+Math.min(2,q*.025));b.tension=clamp((b.tension||0)-Math.min(4,q*.04));
    relationShift(a,b,Math.min(10,q*.09),reason);
    a.economicDiplomacy.history.push({year:state.year,type:'aid-sent',recipient:b.id,amount:q,reason});b.economicDiplomacy.history.push({year:state.year,type:'aid-received',from:a.id,amount:q,reason});
    return true;
  }
  function invest(a,b,amount,sector='trade'){
    ensureKingdom(a);ensureKingdom(b);const available=Math.max(0,(a.finance?.treasury||0)*.18);const q=Math.min(Math.max(0,amount),available);if(q<3)return false;
    a.finance.treasury-=q;b.finance=b.finance||{};b.finance.treasury=(b.finance.treasury||0)+q;
    const inv={id:`foreign-investment-${a.id}-${b.id}-${state.year}-${Math.floor(Math.random()*1e6)}`,investorId:a.id,hostId:b.id,principal:q,sector,startedYear:state.year,returnRate:.035,status:'active',value:q};a.economicDiplomacy.investments.push(inv);a.economicDiplomacy.foreignAssets+=q;b.economicDiplomacy.history.push({year:state.year,type:'foreign-investment',from:a.id,amount:q,sector});
    b.wealth=(b.wealth||0)+q*.01;relationShift(a,b,Math.min(6,q*.05),'foreign-investment');return true;
  }
  function serviceLoans(){
    ks().forEach(borrower=>{
      ensureKingdom(borrower);const local=borrower.economicDiplomacy.loans.filter(l=>l.status==='active'&&l.borrowerId===borrower.id);
      local.forEach(l=>{const lender=ks().find(k=>String(k.id)===String(l.lenderId));if(!lender)return;const pay=Math.min(l.balance,Math.max(0,(borrower.finance?.treasury||0)*.018));if(pay>0){borrower.finance.treasury-=pay;l.balance-=pay;l.payments=(l.payments||0)+1;lender.finance=lender.finance||{};lender.finance.treasury=(lender.finance.treasury||0)+pay;borrower.economicDiplomacy.foreignDebt=Math.max(0,borrower.economicDiplomacy.foreignDebt-pay);borrower.economicDiplomacy.debtorPressure=clamp(borrower.economicDiplomacy.debtorPressure-pay*.03);lender.economicDiplomacy.leverage=clamp(lender.economicDiplomacy.leverage+pay*.01);}
        if(l.balance<=.05){l.status='repaid';relationShift(lender,borrower,4,'loan-repaid');}
        else if(state.year>l.dueYear){borrower.economicDiplomacy.debtorPressure=clamp(borrower.economicDiplomacy.debtorPressure+1.2);relationShift(lender,borrower,-3,'loan-default-risk');if(Math.random()<.035){l.status='defaulted';borrower.economicDiplomacy.history.push({year:state.year,type:'default',lenderId:l.lenderId,amount:l.balance});lender.economicDiplomacy.leverage=clamp(lender.economicDiplomacy.leverage+8);borrower.legitimacy=clamp((borrower.legitimacy||55)-1.2);borrower.tension=clamp((borrower.tension||0)+2);memory?.remember?.(alive().find(n=>n.faction===borrower.id),'Our kingdom defaulted on a foreign debt.','sovereign-default',4,lender.id,'fear');}}
      });
    });
  }
  function yieldInvestments(){
    ks().forEach(k=>ensureKingdom(k));
    ks().forEach(a=>a.economicDiplomacy.investments.filter(x=>x.status==='active').forEach(inv=>{const host=ks().find(k=>k.id===inv.hostId);if(!host)return;const gain=inv.value*.0045;inv.value+=gain;a.finance=a.finance||{};a.finance.treasury=(a.finance.treasury||0)+gain*.55;a.economicDiplomacy.foreignAssets+=gain*.25;host.wealth=(host.wealth||0)+gain*.08;if(host.economicDiplomacy)host.economicDiplomacy.history.push({year:state.year,type:'investment-yield',from:a.id,amount:gain});}));
  }
  function debtLeverage(){
    ks().forEach(k=>{const e=ensureKingdom(k),borrowed=clamp(e.foreignDebt/Math.max(20,(k.wealth||0)+50)*100);e.debtorPressure=clamp(e.debtorPressure*.9+borrowed*.1);if(e.debtorPressure>70){k.legitimacy=clamp((k.legitimacy||55)-.025);k.tension=clamp((k.tension||0)+.05);}}
    );
  }
  function chooseActions(k){
    ensureKingdom(k);if(state.year-k.economicDiplomacy.lastDecisionYear<2)return;
    const others=ks().filter(x=>x.id!==k.id);if(!others.length)return;
    const target=others.sort((a,b)=>security(a)-security(b))[0];
    const relScore=rel(k.id,target.id)?.score??0;
    const cap=capacity(k);
    if(k.economicDiplomacy.leverage>55&&relScore<40&&Math.random()<.2){aid(k,target,Math.min(8,(k.finance?.treasury||0)*.04),'leverage-building');k.economicDiplomacy.lastDecisionYear=state.year;return;}
    if(cap>90&&relScore>10&&security(k)>security(target)*1.05){lend(k,target,Math.min(18,(k.finance?.treasury||0)*.08));k.economicDiplomacy.lastDecisionYear=state.year;return;}
    if(cap>80&&relScore>15){invest(k,target,Math.min(20,(k.finance?.treasury||0)*.09),target.tradeNetwork?.status||'trade');k.economicDiplomacy.lastDecisionYear=state.year;return;}
    if((target.economicCycle?.phase==='famine'||target.economicCycle?.phase==='financial-crisis')&&friendly(k,target)){aid(k,target,Math.min(14,(k.finance?.treasury||0)*.1),'crisis-relief');k.economicDiplomacy.lastDecisionYear=state.year;}
  }
  function updatePower(){
    ks().forEach(k=>{const e=ensureKingdom(k),assets=e.foreignAssets||0;const creditors=e.loans.filter(x=>x.lenderId===k.id&&x.status==='active').reduce((a,x)=>a+x.balance,0);e.creditorPower=clamp(creditors*.35+assets*.22+e.sentAid*.08);e.leverage=clamp(e.leverage*.96+e.creditorPower*.04);e.history.push({year:state.year,foreignDebt:Number(e.foreignDebt.toFixed(1)),creditorPower:Number(e.creditorPower.toFixed(1)),leverage:Number(e.leverage.toFixed(1)),receivedAid:Number(e.receivedAid.toFixed(1))});e.history=e.history.slice(-60);k.foreignFinancialPower=e.creditorPower;k.foreignDebt=e.foreignDebt;});
  }
  function step(){
    if(!state.running)return;
    ks().forEach(ensureKingdom);
    if(state.tick%48===0)ks().forEach(chooseActions);
    if(state.tick%30===0)serviceLoans();
    if(state.tick%36===0)yieldInvestments();
    if(state.tick%60===0)debtLeverage();
    if(state.tick%72===0)updatePower();
  }
  window.EVERGLEN_ECONOMIC_DIPLOMACY={step,lend,aid,invest,serviceLoans,yieldInvestments};
  if(state.registerSystem)state.registerSystem({name:'economic-diplomacy',step,priority:66});
})();
