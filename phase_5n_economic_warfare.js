// Phase 5N: economic warfare, sanctions, embargoes, seizures, blockades and financial pressure.
(() => {
  const state=window.SIM_STATE;if(!state)return;
  const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,v));
  const ks=()=>state.kingdoms||[];
  const ss=()=>state.settlements||[];
  const npcs=()=>state.npcs||[];
  const alive=()=>npcs().filter(n=>n.alive);
  const key=(a,b)=>[String(a),String(b)].sort().join(':');
  const log=t=>window.SIM_API?.log?.(t);
  const memory=window.NPC_MEMORY;

  function ensureKingdom(k){
    k.economicWarfare=k.economicWarfare||{};
    const e=k.economicWarfare;
    e.sanctions=e.sanctions||[];e.embargoes=e.embargoes||[];e.blockades=e.blockades||[];e.seizedAssets=e.seizedAssets||[];
    e.outgoingPressure=e.outgoingPressure??0;e.incomingPressure=e.incomingPressure??0;e.tradeLoss=e.tradeLoss??0;e.blackMarket=e.blackMarket??0;e.history=e.history||[];
    e.targetRelations=e.targetRelations||{};
    return e;
  }
  function ensureSettlement(s){
    s.economicWarfare=s.economicWarfare||{};
    const e=s.economicWarfare;
    e.shortage=e.shortage||{};e.tradeDisruption=e.tradeDisruption??0;e.blockadeRisk=e.blockadeRisk??0;e.blackMarket=e.blackMarket??0;e.history=e.history||[];
    return e;
  }
  function relation(a,b){return state.diplomacy?.relations?.[key(a,b)]?.score??0;}
  function kingdom(id){return ks().find(k=>String(k.id)===String(id))||null;}
  function settlementsOf(k){return ss().filter(s=>String(s.kingdomId)===String(k.id));}
  function issue(type,from,to,resource=null,severity=25,duration=6){
    const k=kingdom(from),target=kingdom(to);if(!k||!target||k.id===target.id)return false;
    const e=ensureKingdom(k);const list=e[type];const exists=list.find(x=>x.targetId===target.id&&x.resource===resource);
    if(exists){exists.severity=clamp(exists.severity+severity*.25);exists.expires=Math.max(exists.expires,state.year+duration);return true;}
    const item={id:`${type}-${k.id}-${target.id}-${state.year}-${list.length+1}`,targetId:target.id,resource,severity:clamp(severity),issuedYear:state.year,expires:state.year+duration};list.push(item);e.history.push({year:state.year,type,targetId:target.id,resource,severity});e.history=e.history.slice(-60);return true;
  }
  function tradeWarTargets(){
    return ks().flatMap(k=>{ensureKingdom(k);return ks().filter(t=>t.id!==k.id).map(t=>({k,t})).filter(x=>relation(x.k.id,x.t.id)<-50||state.war);});
  }
  function considerSanctions(){
    tradeWarTargets().slice(0,8).forEach(({k,t})=>{
      const kt=ensureKingdom(k),power=k.tradeNetwork?.power||k.economy?.tradePower||0,enemyPower=t.tradeNetwork?.power||t.economy?.tradePower||0;
      if(power<20)return;
      const anger=clamp(50-relation(k.id,t.id));
      if(state.war&&power>enemyPower*.75&&Math.random()<.18)issue('sanctions',k.id,t.id,null,Math.max(20,anger*.7),8);
      else if(!state.war&&anger>55&&Math.random()<.05)issue('embargoes',k.id,t.id,null,Math.max(18,anger*.55),6);
      if(k.tradeNetwork?.routeControl>55&&Math.random()<.04)issue('blockades',k.id,t.id,null,35,4);
      kt.targetRelations[t.id]=relation(k.id,t.id);
    });
  }
  function activeAction(list,fromId,toId,resource){return list.some(x=>String(x.targetId)===String(toId)&&(!resource||!x.resource||x.resource===resource)&&state.year<=x.expires);}
  function targetPressure(k){
    const e=ensureKingdom(k),out={},targets=new Set();
    e.sanctions.concat(e.embargoes,e.blockades).forEach(x=>{if(state.year<=x.expires)targets.add(String(x.targetId));});
    targets.forEach(id=>{const t=kingdom(id);if(!t)return;let pressure=0;
      e.sanctions.filter(x=>String(x.targetId)===String(id)&&state.year<=x.expires).forEach(x=>pressure+=x.severity*.8);
      e.embargoes.filter(x=>String(x.targetId)===String(id)&&state.year<=x.expires).forEach(x=>pressure+=x.severity*.65);
      e.blockades.filter(x=>String(x.targetId)===String(id)&&state.year<=x.expires).forEach(x=>pressure+=x.severity*1.15);
      out[id]=clamp(pressure);
    });
    return out;
  }
  function applyToSettlements(k){
    const e=ensureKingdom(k),pressure=targetPressure(k);Object.entries(pressure).forEach(([targetId,value])=>{
      const target=kingdom(targetId);if(!target)return;const local=settlementsOf(target);
      local.forEach(s=>{const se=ensureSettlement(s);se.tradeDisruption=clamp(se.tradeDisruption*.86+value*.06);se.blockadeRisk=clamp(value*.55);
        const imports=s.economicGeography?.imports||{};Object.keys(imports).forEach(r=>{se.shortage[r]=clamp((se.shortage[r]||0)+value*.03);if(s.market){s.market.demand=s.market.demand||{};s.market.demand[r]=(s.market.demand[r]||0)+value*.015;}});
        s.prosperity=clamp((s.prosperity||50)-value*.006);s.stability=clamp((s.stability||60)-value*.0025);
        if(value>45){se.blackMarket=clamp(se.blackMarket+value*.008);if(s.market)s.market.inflation=clamp((s.market.inflation||0)+value*.002);}
        if(value>60&&state.tick%48===0){se.history.push(`Year ${state.year}: Trade restrictions caused economic pressure.`);se.history=se.history.slice(-40);}
      });
      target.economicWarfare=target.economicWarfare||{};const te=ensureKingdom(target);te.incomingPressure=clamp(te.incomingPressure*.9+value*.1);te.tradeLoss=clamp(te.tradeLoss*.92+value*.08);te.blackMarket=clamp(te.blackMarket*.95+value*.025);
      target.wealth=Math.max(0,(target.wealth||0)-value*.012);target.legitimacy=clamp((target.legitimacy||55)-value*.006);target.tension=clamp((target.tension||0)+value*.01);
    });
  }
  function disruptRoutes(){
    const routes=(window.EverglenLogistics?.routes||window.EVERGLEN_LOGISTICS?.routes||[]);
    routes.forEach(r=>{const a=ss().find(s=>s.id===r.from),b=ss().find(s=>s.id===r.to);if(!a||!b)return;const ka=kingdom(a.kingdomId),kb=kingdom(b.kingdomId);if(!ka||!kb||ka.id===kb.id)return;
      const ea=ensureKingdom(ka),eb=ensureKingdom(kb);const pressured=activeAction(ea.sanctions,ka.id,kb.id,r.resource)||activeAction(ea.embargoes,ka.id,kb.id,r.resource)||activeAction(ea.blockades,ka.id,kb.id,r.resource)||activeAction(eb.sanctions,kb.id,ka.id,r.resource)||activeAction(eb.embargoes,kb.id,ka.id,r.resource)||activeAction(eb.blockades,kb.id,ka.id,r.resource);
      if(pressured){const severity=Math.max(...ea.sanctions.concat(ea.embargoes,ea.blockades,eb.sanctions,eb.embargoes,eb.blockades).filter(x=>(String(x.targetId)===String(kb.id)||String(x.targetId)===String(ka.id))&&(!x.resource||x.resource===r.resource)&&state.year<=x.expires).map(x=>x.severity),0);r.active=Math.random()>Math.min(.9,severity/100);r.economicWarfare=clamp((r.economicWarfare||0)*.9+severity*.1);r.traffic=r.active?(r.traffic||0)*Math.max(.15,1-severity*.006):0;ea.tradeLoss=clamp(ea.tradeLoss*.92+severity*.015);eb.tradeLoss=clamp(eb.tradeLoss*.92+severity*.02);}
    });
  }
  function seizeMerchantAssets(k){
    const e=ensureKingdom(k);if(!e.sanctions.length&&!e.embargoes.length)return;
    const targets=new Set(e.sanctions.concat(e.embargoes).filter(x=>state.year<=x.expires).map(x=>String(x.targetId)));
    alive().filter(n=>['merchant','trader','shopkeeper','peddler'].includes(n.roleId)).slice(0,80).forEach(n=>{
      const s=ss().find(x=>x.id===n.settlementId),nk=s&&kingdom(s.kingdomId);if(!nk||!targets.has(String(nk.id)))return;
      if(Math.random()<.018){const amount=Math.min(Math.max(0,n.wealth*.12),18);if(amount>0){n.wealth-=amount;e.seizedAssets.push({year:state.year,npcId:n.id,targetKingdomId:nk.id,amount});n.grievance=(n.grievance||0)+6;memory?.experience?.(n,'My commercial assets were seized during an economic dispute.','asset-seizure',3.5,k.id,'anger',6,false);}}
    });
    e.seizedAssets=e.seizedAssets.slice(-120);
  }
  function reliefAndAdaptation(k){
    const e=ensureKingdom(k),f=k.finance||{},pressure=e.incomingPressure||0;
    if(pressure<25)return;
    if((f.spending?.relief||0)<.18){f.spending=f.spending||{};f.spending.relief=.18;}
    const local=settlementsOf(k);local.forEach(s=>{s.substitutionEconomy=s.substitutionEconomy||{};s.substitutionEconomy.level=clamp((s.substitutionEconomy.level||0)+pressure*.004);if(s.substitutionEconomy.level>45){s.prosperity=clamp((s.prosperity||50)+.015);s.economicWarfare.blackMarket=clamp(s.economicWarfare.blackMarket-.01);}});
    if(k.strategy&&pressure>55){k.strategy.posture=k.strategy.posture||{};k.strategy.posture.economicDefense=clamp((k.strategy.posture.economicDefense||0)+.5);}
  }
  function expire(){ks().forEach(k=>{const e=ensureKingdom(k);['sanctions','embargoes','blockades'].forEach(type=>{e[type]=e[type].filter(x=>state.year<=x.expires);});});}
  function history(){ks().forEach(k=>{const e=ensureKingdom(k);const active=e.sanctions.length+e.embargoes.length+e.blockades.length;const sig=`${active}:${Math.round(e.incomingPressure)}`;const last=e.history[e.history.length-1];if(!last||last.signature!==sig)e.history.push({year:state.year,type:'snapshot',active,incomingPressure:Number(e.incomingPressure.toFixed(1)),tradeLoss:Number(e.tradeLoss.toFixed(1)),signature:sig});e.history=e.history.slice(-60);});}
  function step(){
    if(!state.running)return;
    ks().forEach(ensureKingdom);ss().forEach(ensureSettlement);
    if(state.tick%36===0)considerSanctions();
    if(state.tick%18===0)ks().forEach(applyToSettlements);
    if(state.tick%24===0)disruptRoutes();
    if(state.tick%48===0)ks().forEach(seizeMerchantAssets);
    if(state.tick%30===0)ks().forEach(reliefAndAdaptation);
    if(state.tick%72===0){expire();history();}
    ks().forEach(k=>{const e=ensureKingdom(k);k.economicWarfarePressure=e.incomingPressure;k.tradeSanctions=e.sanctions.length>0;k.tradeEmbargoes=e.embargoes.length>0;k.tradeBlockaded=e.blockades.length>0;});
  }
  window.EVERGLEN_ECONOMIC_WARFARE={step,issue,targetPressure};
  if(state.registerSystem)state.registerSystem({name:'economic-warfare',step,priority:66});
})();
