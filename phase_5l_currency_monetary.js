// Phase 5L: medieval currency, minting, exchange rates, debasement, inflation and monetary crises.
(() => {
  const state=window.SIM_STATE;if(!state)return;
  const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,v));
  const kingdoms=()=>state.kingdoms||[];
  const settlements=()=>state.settlements||[];
  const npcs=()=>state.npcs||[];
  const alive=()=>npcs().filter(n=>n.alive);
  const memory=window.NPC_MEMORY;
  const baseMetalValue={copper:0.35,silver:1,gold:1.7};
  const safeName=s=>String(s?.name||'Realm').replace(/[^a-zA-Z0-9]+/g,'').slice(0,12)||'Realm';
  const key=(a,b)=>[String(a),String(b)].sort().join(':');

  function ensureKingdom(k){
    k.currency=k.currency||{};
    const c=k.currency;
    c.name=c.name||`${safeName(k)} Crown`;
    c.code=c.code||`C${String(k.id).replace(/[^a-z0-9]/gi,'').slice(-3)||'01'}`;
    c.metal=c.metal||'silver';
    c.fineness=c.fineness??0.88;
    c.faceValue=c.faceValue??1;
    c.goldReserve=c.goldReserve??Math.max(5,(k.wealth||0)*.01);
    c.silverReserve=c.silverReserve??Math.max(25,(k.wealth||0)*.045);
    c.copperReserve=c.copperReserve??Math.max(50,(k.wealth||0)*.08);
    c.minted=c.minted??Math.max(50,(k.wealth||0)*.65);
    c.moneySupply=c.moneySupply??Math.max(50,c.minted);
    c.velocity=c.velocity??1;
    c.inflation=c.inflation??0;
    c.trust=c.trust??58;
    c.exchangeRates=c.exchangeRates||{};
    c.history=c.history||[];
    c.minting=c.minting??0;
    c.debasement=c.debasement??0;
    c.hoarding=c.hoarding??0;
    c.blackMarket=c.blackMarket??0;
    c.crisis=c.crisis||'stable';
    c.lastReformYear=c.lastReformYear??0;
    c.lastShockYear=c.lastShockYear??0;
    return c;
  }

  function ensureNpc(n){
    n.money=n.money??Math.max(0,n.wealth||0);
    n.cash=n.cash??Math.max(0,(n.wealth||0)*.45);
    n.currency=n.currency||{};
    n.currency.hoarded=n.currency.hoarded??0;
    n.currency.recentTransactions=n.currency.recentTransactions||0;
  }

  function ensureSettlement(s){
    s.monetary=s.monetary||{};
    const m=s.monetary;
    m.currencyId=m.currencyId??null;
    m.cashDemand=m.cashDemand??0;
    m.cashShortage=m.cashShortage??0;
    m.exchangeActivity=m.exchangeActivity??0;
    m.moneyConfidence=m.moneyConfidence??55;
  }

  function kingdomOfSettlement(s){return kingdoms().find(k=>String(k.id)===String(s.kingdomId))||null;}
  function kingdomOfNpc(n){const s=settlements().find(x=>x.id===n.settlementId);return s?kingdomOfSettlement(s):null;}
  function metalValue(c){return (c.metalValue??baseMetalValue[c.metal]??1)*Math.max(.2,c.fineness||.2)*Math.max(.5,c.faceValue||1);}

  function issueCurrency(k,amount,reason='mint'){ 
    ensureKingdom(k);const c=k.currency;
    const q=Math.max(0,amount||0);if(q<=0)return 0;
    const reserve=metalValue(c)*Math.max(0,(c.metal==='gold'?c.goldReserve:c.metal==='copper'?c.copperReserve:c.silverReserve));
    const safe=Math.max(1,reserve*5+c.trust*2);
    const minted=Math.min(q,safe);
    c.minted+=minted;c.moneySupply+=minted;c.minting+=minted;
    c.history.push({year:state.year,type:'mint',amount:Number(minted.toFixed(2)),reason});c.history=c.history.slice(-60);
    return minted;
  }

  function debase(k,amount=5){
    ensureKingdom(k);const c=k.currency;
    const q=clamp(amount,0,20);if(q<=0)return false;
    c.fineness=clamp(c.fineness-q*.01,.35,.995);
    c.debasement=clamp(c.debasement+q*.4);
    c.trust=clamp(c.trust-q*.45);
    c.faceValue=Math.max(.55,c.faceValue*(1+q*.002));
    c.lastShockYear=state.year;
    c.history.push({year:state.year,type:'debasement',points:q,fineness:Number(c.fineness.toFixed(3))});c.history=c.history.slice(-60);
    return true;
  }

  function meltPressure(k){
    ensureKingdom(k);const c=k.currency;
    const intrinsic=metalValue(c),confidence=clamp(c.trust/100,.2,1.2);
    const premium=Math.max(0,(1/c.faceValue)-1);
    return clamp((intrinsic>1?intrinsic*18:intrinsic*10)+premium*14-confidence*18);
  }

  function targetInflation(k){
    const c=ensureKingdom(k),f=k.finance||{},growth=k.economicCycle?.growth||0;
    const moneyGrowth=c.moneySupply>0?((c.minting||0)/c.moneySupply)*100:0;
    const fiscal=f.deficit||0;
    return clamp(moneyGrowth*.72+(c.velocity-1)*4+Math.max(0,fiscal*.015)-growth*.12-2,-10,80);
  }

  function priceAdjustment(k){
    const c=ensureKingdom(k),infl=clamp(targetInflation(k));
    c.inflation=c.inflation*.74+infl*.26;
    const settlementsForK=settlements().filter(s=>String(s.kingdomId)===String(k.id));
    settlementsForK.forEach(s=>{
      const market=s.market;if(market?.prices){Object.keys(market.prices).forEach(r=>{market.prices[r]=Number(Math.max(1,market.prices[r]*(1+c.inflation*.00065)).toFixed(2));});}
      s.marketInflation=clamp((s.marketInflation||0)+c.inflation*.0008,-20,100);
    });
  }

  function exchangeRates(){
    const ks=kingdoms();
    ks.forEach(k=>{const c=ensureKingdom(k);c.exchangeRates={};});
    for(let i=0;i<ks.length;i++)for(let j=i+1;j<ks.length;j++){
      const a=ks[i],b=ks[j],ca=ensureKingdom(a),cb=ensureKingdom(b);
      const valueA=metalValue(ca)*(1+(ca.trust-50)*.004)*(1-clamp(ca.inflation,-20,80)*.004);
      const valueB=metalValue(cb)*(1+(cb.trust-50)*.004)*(1-clamp(cb.inflation,-20,80)*.004);
      const rate=clamp(valueA/Math.max(.05,valueB),.08,12);
      ca.exchangeRates[cb.code]=Number(rate.toFixed(4));
      cb.exchangeRates[ca.code]=Number((1/rate).toFixed(4));
    }
  }

  function settlementMoney(s){
    const k=kingdomOfSettlement(s);if(!k)return;
    ensureSettlement(s);ensureKingdom(k);
    const locals=alive().filter(n=>n.settlementId===s.id);locals.forEach(ensureNpc);
    const population=Math.max(1,locals.length);
    const cash=locals.reduce((a,n)=>a+n.cash,0);
    const hoarded=locals.reduce((a,n)=>a+n.currency.hoarded,0);
    const householdTransactions=locals.reduce((a,n)=>a+n.currency.recentTransactions,0);
    s.monetary.currencyId=k.id;
    s.monetary.cashDemand=Math.max(1,population*.35+householdTransactions*.02);
    s.monetary.cashShortage=clamp((s.monetary.cashDemand-cash)/Math.max(1,s.monetary.cashDemand)*100);
    s.monetary.exchangeActivity=(s.monetary.exchangeActivity||0)*.82+Math.max(0,locals.length*.015+(k.tradeNetwork?.tradePower||0)*.002);
    s.monetary.moneyConfidence=clamp(k.currency.trust-s.monetary.cashShortage*.35);
    if(s.monetary.cashShortage>55){s.prosperity=clamp((s.prosperity||50)-.018);s.stability=clamp((s.stability||60)-.01);}
    k.currency.hoarding=clamp(k.currency.hoarding*.92+hoarded*.015);
  }

  function householdMoney(n){
    ensureNpc(n);const k=kingdomOfNpc(n);if(!k)return;ensureKingdom(k);const c=k.currency;
    const wealth=Math.max(0,n.wealth||0),desiredCash=wealth*clamp(.42+c.inflation*.004,.18,.82);
    if(n.cash<desiredCash){const move=Math.min(desiredCash-n.cash,Math.max(0,n.savings||0)*.08);n.cash+=move;n.savings=Math.max(0,(n.savings||0)-move);}
    if(c.inflation>20&&wealth>35){const hoard=Math.min(Math.max(0,n.cash)*.035,wealth*.025);n.cash-=hoard;n.currency.hoarded+=hoard;c.hoarding+=hoard*.01;}
    if(c.inflation>35&&wealth>80){const hedge=Math.min(n.cash*.04,wealth*.02);n.cash=Math.max(0,n.cash-hedge);n.wealth+=hedge*(c.trust<45?1.02:.98);}
    n.money=n.cash+(n.currency.hoarded||0)+(n.savings||0);
    n.currency.recentTransactions*=.7;
  }

  function reform(k){
    ensureKingdom(k);const c=k.currency;
    if(c.inflation>28&&c.trust>40){
      c.velocity=clamp(c.velocity-.04,.6,1.8);c.minting*=.55;c.lastReformYear=state.year;c.history.push({year:state.year,type:'tightening',inflation:Number(c.inflation.toFixed(1))});
    }
    if(c.inflation>45&&c.trust<45){
      c.crisis='currency-crisis';c.blackMarket=clamp(c.blackMarket+1.2);c.trust=clamp(c.trust-.8);
      if(state.year-c.lastShockYear>2)debase(k,Math.min(8,c.inflation*.05));
    }
    if(c.inflation<8&&c.trust>62&&c.silverReserve>10){
      issueCurrency(k,Math.min(12,c.silverReserve*.015),'measured-minting');
      c.velocity=clamp(c.velocity+.008,.6,1.8);
    }
    if(c.inflation<15&&c.trust>55)c.crisis='stable';
  }

  function tradeCurrencyFeedback(k){
    ensureKingdom(k);const c=k.currency;
    const foreign=Object.keys(c.exchangeRates||{}).length;
    const tradePower=k.tradeNetwork?.power||k.economy?.tradePower||0;
    c.velocity=clamp(c.velocity+.0015*foreign+.0008*tradePower,-1.8,1.8);
    if(c.blackMarket>0)c.blackMarket=Math.max(0,c.blackMarket-.035);
    if(c.inflation>25&&tradePower>50)c.trust=clamp(c.trust+.025);
    if(c.crisis==='currency-crisis'){k.legitimacy=clamp((k.legitimacy||55)-.035);k.tension=clamp((k.tension||0)+.06);k.wealth=Math.max(0,(k.wealth||0)-.08);}
  }

  function history(k){
    ensureKingdom(k);const c=k.currency;
    const signature=`${c.crisis}:${Math.round(c.inflation)}:${Math.round(c.trust)}`;
    const last=c.history[c.history.length-1];
    if(!last||last.signature!==signature)c.history.push({year:state.year,type:'snapshot',inflation:Number(c.inflation.toFixed(2)),trust:Number(c.trust.toFixed(1)),moneySupply:Number(c.moneySupply.toFixed(1)),signature});
    c.history=c.history.slice(-80);
    if(c.crisis==='currency-crisis'&&memory){const people=alive().filter(n=>kingdomOfNpc(n)?.id===k.id).slice(0,6);people.forEach(n=>memory.experience?.(n,'The value of our coin collapsed and trust in money fell.','currency-crisis',3,k.id,'fear',5,false));}
  }

  function step(){
    if(!state.running)return;
    kingdoms().forEach(ensureKingdom);settlements().forEach(ensureSettlement);alive().forEach(ensureNpc);
    if(state.tick%24===0){kingdoms().forEach(k=>{const c=ensureKingdom(k);if(c.inflation>18&&c.minted<Math.max(20,(k.wealth||0)*.3))c.velocity=clamp(c.velocity-.01,.6,1.8);priceAdjustment(k);});}
    if(state.tick%36===0){kingdoms().forEach(reform);exchangeRates();}
    if(state.tick%18===0){alive().slice(0,220).forEach(householdMoney);settlements().forEach(settlementMoney);}
    if(state.tick%60===0)kingdoms().forEach(tradeCurrencyFeedback);
    if(state.tick%72===0)kingdoms().forEach(history);
    kingdoms().forEach(k=>{const c=ensureKingdom(k);k.currencyInflation=c.inflation;k.currencyTrust=c.trust;k.currencyCode=c.code;k.currencyCrisis=c.crisis;});
  }

  window.EVERGLEN_CURRENCY={step,issueCurrency,debase,exchangeRates,ensureKingdom};
  if(state.registerSystem)state.registerSystem({name:'currency-monetary',step,priority:64});
})();
