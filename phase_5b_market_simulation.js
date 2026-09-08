// Phase 5B: dynamic market formation, regional price gaps and merchant arbitrage.
(() => {
  const state=window.SIM_STATE;if(!state)return;
  const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,v));
  const ss=()=>state.settlements||[];
  const npcs=()=>state.npcs||[];
  const res=window.NPC_RESOURCES;
  const base={food:8,fish:10,grain:7,livestock:24,wood:5,stone:7,iron:14,silver:32,gold:55,mithril:95,adamantine:125,emberite:85,moonstone:90,voidstone:120,starsteel:150,cloth:11,leather:13,wool:10,medicine:22,herbs:12,reagents:28,glass:26,paper:16,books:38,weapons:35,armor:42,tools:18,boats:70,battle_boats:150,horses:50};
  const catalog=()=>res?.catalog?Object.keys(res.catalog()):Object.keys(base);
  const ensure=s=>{s.market=s.market||{};s.market.prices=s.market.prices||{};s.market.demand=s.market.demand||{};s.market.supply=s.market.supply||{};s.market.volume=s.market.volume||0;s.market.priceHistory=s.market.priceHistory||{};s.market.orderFlow=s.market.orderFlow||{};s.market.inflation=s.market.inflation||0;s.market.lastClearYear=s.market.lastClearYear??state.year;return s.market;};
  const inv=s=>s.resources||{};
  const bPrice=r=>res?.RESOURCES?.[r]?.base??base[r]??10;
  function targetStock(s,r){const pop=Math.max(1,npcs().filter(n=>n.alive&&n.settlementId===s.id).length);return Math.max(5,pop*(r==='food'?.95:['wood','grain','stone','water'].includes(r)?.28:.18));}
  function calculate(s,r){
    const m=ensure(s),stock=inv(s)[r]||0,target=targetStock(s,r);
    const shortage=clamp((target-stock)/target,-.75,3);
    const demand=(m.demand[r]||0)/Math.max(1,target);
    const supply=(m.supply[r]||0)/Math.max(1,target);
    const pressure=clamp(shortage*.95+demand*.34-supply*.22,-.7,3.4);
    const velocity=clamp((m.orderFlow[r]||0)/Math.max(1,target),0,2);
    const regional=clamp((m.inflation||0),-0.15,.5);
    return Math.max(1,bPrice(r)*(1+pressure*.72+velocity*.08+regional));
  }
  function seed(s){const m=ensure(s);catalog().forEach(r=>{if(!(r in m.prices))m.prices[r]=bPrice(r);if(!(r in m.demand))m.demand[r]=0;if(!(r in m.supply))m.supply[r]=0;if(!(r in m.orderFlow))m.orderFlow[r]=0;if(!m.priceHistory[r])m.priceHistory[r]=[];});}
  function regionalReference(s,r){const peers=ss().filter(x=>x.id!==s.id&&Math.hypot((x.x||0)-(s.x||0),(x.y||0)-(s.y||0))<800);if(!peers.length)return bPrice(r);return peers.reduce((a,x)=>a+ensure(x).prices[r],0)/peers.length;}
  function clearMarket(s){
    const m=ensure(s);seed(s);
    catalog().forEach(r=>{
      const p=calculate(s,r);const old=m.prices[r]||bPrice(r);const next=old*.72+p*.28;const ref=regionalReference(s,r);m.prices[r]=Number(Math.max(1,next).toFixed(2));
      m.priceHistory[r].push({year:state.year,price:m.prices[r]});m.priceHistory[r]=m.priceHistory[r].slice(-24);
      const gap=(m.prices[r]-ref)/Math.max(1,ref);m.orderFlow[r]*=.78;m.demand[r]*=.84;m.supply[r]*=.84;
      if(Math.abs(gap)>.35)m.marketSignal=m.marketSignal||{},m.marketSignal[r]=gap>0?'import':'export';
    });
    m.priceIndex=Number((catalog().reduce((a,r)=>a+m.prices[r],0)/Math.max(1,catalog().length)/Math.max(1,catalog().reduce((a,r)=>a+bPrice(r),0)/Math.max(1,catalog().length))).toFixed(3));
    m.lastClearYear=state.year;m.volume=Math.max(0,m.volume*.8);m.inflation=clamp(((m.priceIndex||1)-1)*.12,-.12,.3);
  }
  function order(s,r,qty,kind='household'){const m=ensure(s);seed(s);const q=Math.max(0,qty||0);m.orderFlow[r]=(m.orderFlow[r]||0)+q;m[kind==='buy'?'buyVolume':'sellVolume']=(m[kind==='buy'?'buyVolume':'sellVolume']||0)+q;return calculate(s,r);}
  function arbitrage(){
    const merchants=npcs().filter(n=>n.alive&&['merchant','trader','shopkeeper','peddler','smuggler'].includes(n.roleId)).slice(0,120);
    merchants.forEach(n=>{
      const from=ss().find(s=>s.id===n.settlementId);if(!from)return;seed(from);
      let best=null;
      for(const to of ss()){
        if(to.id===from.id)continue;const d=Math.hypot((to.x||0)-(from.x||0),(to.y||0)-(from.y||0));if(d>900)continue;seed(to);
        for(const r of catalog()){
          const buy=ensure(from).prices[r],sell=ensure(to).prices[r];const margin=(sell-buy)/Math.max(1,buy);
          if(margin>.35&&(!best||margin>best.margin))best={to,r,buy,sell,margin,d};
        }
      }
      if(best){const qty=Math.min(2+Math.max(0,n.wealth*.015),Math.max(0,inv(from)[best.r]||0));if(qty>.2){inv(from)[best.r]-=qty;inv(best.to)[best.r]=(inv(best.to)[best.r]||0)+qty;const profit=qty*(best.sell-best.buy)*.45;n.wealth+=Math.max(0,profit);n.tradeProfit=(n.tradeProfit||0)+Math.max(0,profit);n.reputation=clamp((n.reputation||50)+profit*.01);order(from,best.r,qty,'sell');order(best.to,best.r,qty,'buy');n.lastMarketRun={resource:best.r,to:best.to.id,margin:Number((best.margin*100).toFixed(1)),year:state.year};}}
    });
  }
  function merchantFeedback(s){
    const local=npcs().filter(n=>n.alive&&n.settlementId===s.id&&['merchant','trader','shopkeeper','peddler'].includes(n.roleId));
    if(!local.length)return;
    const m=ensure(s);m.merchantPower=clamp(local.reduce((a,n)=>a+(n.tradeProfit||0),0)*.02+local.length*2);
    if(m.merchantPower>20){s.prosperity=clamp((s.prosperity||0)+.08);s.stability=clamp((s.stability||60)+.02);}
  }
  function step(){
    if(!state.running)return;
    ss().forEach(seed);
    if(state.tick%12===0)ss().forEach(clearMarket);
    if(state.tick%6===0){npcs().filter(n=>n.alive&&n.settlementId).forEach(n=>{const s=ss().find(x=>x.id===n.settlementId);if(!s)return;const food=.03*state.speed;order(s,'food',food,'buy');const demanded=window.NPC_ECONOMY?.demandResourceFor?.(n);if(demanded)order(s,demanded,.012*state.speed,'buy');});}
    if(state.tick%18===0)arbitrage();
    if(state.tick%24===0)ss().forEach(merchantFeedback);
    ss().forEach(s=>{const m=ensure(s);s.marketPriceIndex=m.priceIndex||1;s.marketInflation=m.inflation||0;});
  }
  function price(s,r){return Number((ensure(s).prices[r]||calculate(s,r)).toFixed(2));}
  window.EVERGLEN_MARKETS={step,price,order,clearMarket,arbitrage,regionalReference};
  if(state.registerSystem)state.registerSystem({name:'market-simulation',step,priority:52});
})();
