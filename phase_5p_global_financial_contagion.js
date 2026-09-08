// Phase 5P: global economic crises, financial contagion and international recovery.
(() => {
  const state=window.SIM_STATE;if(!state)return;
  const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,v));
  const ks=()=>state.kingdoms||[];
  const ss=()=>state.settlements||[];
  const alive=()=> (state.npcs||[]).filter(n=>n.alive);
  const memory=window.NPC_MEMORY;
  const key=(a,b)=>[String(a),String(b)].sort().join(':');
  const hostile=(a,b)=>{
    if(!a||!b||a.id===b.id)return false;
    const rel=state.diplomacy?.relations?.[key(a.id,b.id)]?.score??0;
    return !!state.war||rel<-65;
  };
  function ensureKingdom(k){
    k.globalFinance=k.globalFinance||{};const g=k.globalFinance;
    g.exposure=g.exposure??0;g.contagion=g.contagion??0;g.externalDebt=g.externalDebt??0;g.foreignAssets=g.foreignAssets??0;g.tradeShock=g.tradeShock??0;g.bankShock=g.bankShock??0;g.currencyShock=g.currencyShock??0;g.confidence=g.confidence??55;g.crisis=g.crisis||'contained';g.recovery=g.recovery??0;g.history=g.history||[];g.lastShockYear=g.lastShockYear??0;
    return g;
  }
  function networkPartners(k){
    const partners=new Map();
    const routes=window.EVERGLEN_LOGISTICS?.routes||window.EverglenLogistics?.routes||[];
    routes.forEach(r=>{const a=ss().find(s=>s.id===r.from),b=ss().find(s=>s.id===r.to);if(!a||!b)return;const otherA=ks().find(x=>x.id===a.kingdomId),otherB=ks().find(x=>x.id===b.kingdomId);if(!otherA||!otherB||otherA.id===otherB.id)return;if(otherA.id===k.id)partners.set(otherB.id,(partners.get(otherB.id)||0)+1);if(otherB.id===k.id)partners.set(otherA.id,(partners.get(otherA.id)||0)+1);});
    (k.diplomacy?.relations||[]).forEach(()=>{});
    return partners;
  }
  function financialExposure(k){
    const g=ensureKingdom(k),finance=k.finance||{},trade=k.tradeNetwork||{},currency=k.currency||{};
    const debt=(finance.debt||0),credit=Math.max(1,finance.credit||50),tradePower=trade.power||k.economy?.tradePower||0;
    const externalDebt=debt*.35+(trade.importDependence||0)*.55;
    g.externalDebt=externalDebt;g.foreignAssets=Math.max(0,(trade.wealth||0)*.4+(tradePower*.3));
    g.exposure=clamp(externalDebt*.55+tradePower*.4+(currency.inflation||0)*.35+(100-(currency.trust||55))*.3);
    return g.exposure;
  }
  function crisisSeverity(k){
    const g=ensureKingdom(k),e=k.economicCycle||{},f=k.finance||{},c=k.currency||{},t=k.tradeNetwork||{};
    const local=(e.phase==='financial-crisis'?34:e.phase==='recession'?20:e.phase==='famine'?24:e.phase==='inflation'?16:0);
    const debt=Math.min(30,(f.debt||0)/Math.max(1,f.treasury||50)*28);
    const bank=Math.min(22,100-(f.credit||55));
    const currency=Math.min(22,(c.inflation||0)*.32+(100-(c.trust||55))*.16);
    const trade=Math.min(18,(t.importDependence||0)*.14+(t.routeControl||0)*.05);
    return clamp(local+debt+bank+currency+trade);
  }
  function classify(severity){if(severity>=72)return'global-crisis';if(severity>=48)return'systemic-crisis';if(severity>=25)return'financial-stress';return'contained';}
  function propagate(){
    const list=ks();
    const sourceData=list.map(k=>({k,g:ensureKingdom(k),severity:crisisSeverity(k)}));
    sourceData.forEach(({k,g,severity})=>{
      const partners=networkPartners(k);
      partners.forEach((weight,id)=>{
        const target=list.find(x=>x.id===id);if(!target)return;const tg=ensureKingdom(target);if(severity<22)return;
        const relation=state.diplomacy?.relations?.[key(k.id,target.id)]?.score??0;
        const connected=clamp(weight*8+Math.max(0,relation+40)*.12);
        const transmission=(severity-15)*(.006+connected*.0007);
        if(transmission<=0)return;
        tg.contagion=clamp(tg.contagion+transmission);
        tg.tradeShock=clamp(tg.tradeShock+transmission*.7);
        tg.bankShock=clamp(tg.bankShock+transmission*(g.externalDebt>20?.7:.4));
        if(g.currencyShock>10)tg.currencyShock=clamp(tg.currencyShock+transmission*.45);
        if(hostile(k,target))tg.contagion=clamp(tg.contagion-transmission*.15);
      });
    });
  }
  function domesticPropagation(k){
    const g=ensureKingdom(k),locals=ss().filter(s=>s.kingdomId===k.id);if(!locals.length)return;
    locals.forEach(s=>{
      s.globalEconomicShock=s.globalEconomicShock||0;
      s.globalEconomicShock=clamp(s.globalEconomicShock+g.contagion*.018+g.tradeShock*.012+g.bankShock*.01);
      if(s.globalEconomicShock>8){s.prosperity=clamp((s.prosperity||50)-s.globalEconomicShock*.002);s.stability=clamp((s.stability||60)-s.globalEconomicShock*.0015);if(s.market){s.market.inflation=clamp((s.market.inflation||0)+s.globalEconomicShock*.0006);}}
      const localsHere=alive().filter(n=>n.settlementId===s.id).slice(0,18);
      if(s.globalEconomicShock>22)localsHere.forEach(n=>{n.grievance=clamp((n.grievance||0)+.012);if(Math.random()<.012&&memory?.experience)memory.experience(n,'A distant financial crisis damaged our local economy.','global-financial-crisis',3,s.id,'fear',4,false);});
    });
  }
  function triggerGlobalResponse(k){
    const g=ensureKingdom(k),f=k.finance||{},c=k.currency||{},e=k.economicCycle||{};
    if(g.crisis==='systemic-crisis'||g.crisis==='global-crisis'){
      if(f.spending){f.spending.relief=Math.max(f.spending.relief||0,.22);f.spending.reserves=Math.max(f.spending.reserves||0,.12);}
      if(c.velocity!=null)c.velocity=clamp(c.velocity-.025,.6,1.8);
      if(f.credit!=null)f.credit=clamp(f.credit-0.18);
      if(e.confidence!=null)e.confidence=clamp(e.confidence-.08);
    }
    if(g.crisis==='global-crisis'){
      k.tension=clamp((k.tension||0)+.09);k.legitimacy=clamp((k.legitimacy||55)-.06);
    }
  }
  function updateKingdom(k){
    const g=ensureKingdom(k);financialExposure(k);
    const severity=crisisSeverity(k)+g.contagion*.65;
    const next=classify(severity),old=g.crisis;
    g.crisis=next;
    if(next!==old){g.lastShockYear=state.year;g.history.push({year:state.year,type:next,severity:Number(severity.toFixed(1))});g.history=g.history.slice(-60);if(window.SIM_API?.log&&next!=='contained')window.SIM_API.log(`${k.name} entered ${next} from international financial contagion.`);}
    if(next==='contained')g.contagion=Math.max(0,g.contagion-.45);else g.contagion=Math.max(0,g.contagion-.08);
    g.tradeShock=Math.max(0,g.tradeShock*.94);g.bankShock=Math.max(0,g.bankShock*.94);g.currencyShock=Math.max(0,g.currencyShock*.95);
    if(next==='contained')g.recovery=clamp(g.recovery+.22);else g.recovery=Math.max(0,g.recovery-.12);
    if(g.recovery>40&&next==='contained'){g.confidence=clamp(g.confidence+.06);if(foreignStability(k)>55)g.confidence=clamp(g.confidence+.04);}
    triggerGlobalResponse(k);domesticPropagation(k);
  }
  function foreignStability(k){
    const partners=networkPartners(k);let sum=0,count=0;partners.forEach((w,id)=>{const other=ks().find(x=>x.id===id);if(other){sum+=clamp(ensureKingdom(other).confidence);count++;}});return count?sum/count:55;
  }
  function systemicEvent(){
    const bad=ks().filter(k=>['systemic-crisis','global-crisis'].includes(ensureKingdom(k).crisis));
    if(bad.length>=Math.max(2,Math.ceil(ks().length*.45))){state.globalEconomy=state.globalEconomy||{};state.globalEconomy.crisis='global-recession';state.globalEconomy.severity=clamp(bad.length/Math.max(1,ks().length)*100);state.globalEconomy.lastYear=state.year;state.globalEconomy.history=state.globalEconomy.history||[];const h=state.globalEconomy.history;const last=h[h.length-1];if(!last||last.year!==state.year)h.push({year:state.year,severity:state.globalEconomy.severity,affected:bad.length});state.globalEconomy.history=h.slice(-30);}
    else if(state.globalEconomy){state.globalEconomy.severity=Math.max(0,(state.globalEconomy.severity||0)-.4);if(state.globalEconomy.severity<12)state.globalEconomy.crisis='normal';}
  }
  function step(){
    if(!state.running)return;
    ks().forEach(ensureKingdom);
    if(state.tick%36===0)propagate();
    if(state.tick%24===0)ks().forEach(updateKingdom);
    if(state.tick%72===0)systemicEvent();
    ks().forEach(k=>{const g=ensureKingdom(k);k.globalFinancialCrisis=g.crisis;k.globalFinancialExposure=g.exposure;k.globalContagion=g.contagion;});
  }
  window.EVERGLEN_GLOBAL_FINANCE={step,financialExposure,crisisSeverity,propagate};
  if(state.registerSystem)state.registerSystem({name:'global-financial-contagion',step,priority:66});
})();
