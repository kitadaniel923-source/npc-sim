// Phase 5H: physical supply chains, warehouses, transport capacity, delivery delays and military logistics.
(() => {
  const state=window.SIM_STATE;if(!state)return;
  const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,v));
  const settlements=()=>state.settlements||[];
  const npcs=()=>state.npcs||[];
  const logistics=()=>window.EverglenLogistics;
  const alive=()=>npcs().filter(n=>n.alive);
  const dist=(a,b)=>Math.hypot((a.x||0)-(b.x||0),(a.y||0)-(b.y||0));
  const log=t=>window.SIM_API?.log?.(t);
  const GOODS=['food','grain','wood','stone','iron','tools','weapons','armor','cloth','medicine','books','horses','boats'];
  function ensure(s){
    s.supply=s.supply||{};
    s.supply.warehouse=s.supply.warehouse||{capacity:25,stock:{},quality:50};
    s.supply.inTransit=s.supply.inTransit||[];
    s.supply.backorders=s.supply.backorders||{};
    s.supply.losses=s.supply.losses||0;
    s.supply.deliveryHistory=s.supply.deliveryHistory||[];
    s.supply.transportDemand=s.supply.transportDemand||0;
    s.supply.transportCapacity=s.supply.transportCapacity||10;
    s.supply.access=s.supply.access??50;
    s.supply.blockaded=!!s.supply.blockaded;
    s.supply.militaryDemand=s.supply.militaryDemand||0;
  }
  function population(s){return alive().filter(n=>n.settlementId===s.id).length;}
  function warehouseCapacity(s){ensure(s);return 25+(s.construction?.completed?.filter(x=>x.type==='warehouse').length||0)*15+(s.infrastructure?.knowledge||0)*.12+(s.infrastructure?.roads||0)*.12;}
  function roadQuality(a,b){
    const l=logistics();if(!l)return .45;
    const roads=l.roads||[];const r=roads.find(x=>(x.from===a.id&&x.to===b.id)||(x.from===b.id&&x.to===a.id));
    if(!r)return .3;return clamp((r.condition||70)/100,.3,1)*(1+(r.capacity||10)/60);
  }
  function route(a,b){const l=logistics();return l?.routes?.find(r=>(r.from===a.id&&r.to===b.id)||(r.from===b.id&&r.to===a.id))||null;}
  function transportCapacity(s){
    const merchants=alive().filter(n=>n.settlementId===s.id&&['merchant','trader','sailor','shipwright'].includes(n.roleId)).length;
    const roads=s.infrastructure?.roads||0,ports=s.advanced?.projects?.port||s.advanced?.projects?.ports||0;
    return Math.max(5,8+roads*.35+merchants*1.2+ports*5);
  }
  function demandFor(s,r){
    const p=Math.max(1,population(s));
    const base={food:p*1.35,grain:p*.5,wood:p*.34,stone:p*.22,iron:p*.16,tools:p*.1,weapons:p*.1,armor:p*.06,cloth:p*.13,medicine:p*.08,books:p*.025,horses:p*.035,boats:p*.01};
    return base[r]??p*.06;
  }
  function moveLocalToWarehouse(s){
    ensure(s);const inv=s.resources=s.resources||{},w=s.supply.warehouse;w.capacity=warehouseCapacity(s);let used=Object.values(w.stock).reduce((a,v)=>a+v,0);for(const r of GOODS){const spare=Math.max(0,w.capacity-used);if(spare<=0)break;const move=Math.min(inv[r]||0,Math.max(0,spare));if(move>0){inv[r]-=move;w.stock[r]=(w.stock[r]||0)+move;used+=move;}}
  }
  function warehouseToLocal(s){
    ensure(s);const inv=s.resources=s.resources||{},w=s.supply.warehouse;for(const r of GOODS){const need=Math.max(0,demandFor(s,r)-((inv[r]||0)+(w.stock[r]||0)));if(need<=0)continue;const release=Math.min(w.stock[r]||0,need*.55);if(release>0){w.stock[r]-=release;inv[r]=(inv[r]||0)+release;}}
  }
  function chooseFlow(){
    const ss=settlements();let best=null,bestScore=-Infinity;
    for(const from of ss){ensure(from);for(const to of ss){if(from.id===to.id)continue;const d=dist(from,to);if(d>1000)continue;const rr=route(from,to);if(!rr)continue;for(const r of GOODS){const available=(from.resources?.[r]||0)+(from.supply?.warehouse?.stock?.[r]||0);const need=Math.max(0,demandFor(to,r)-((to.resources?.[r]||0)+(to.supply?.warehouse?.stock?.[r]||0)));if(available<Math.max(1,demandFor(from,r)*1.05)||need<1)continue;const margin=((window.EVERGLEN_MARKETS?.price?.(to,r)||8)-(window.EVERGLEN_MARKETS?.price?.(from,r)||8));const score=need*1.8+margin*.4+roadQuality(from,to)*8-d*.012+(to.supply.blockaded?-18:0);if(score>bestScore){bestScore=score;best={from,to,r,amount:Math.min(4,need,available*.18),distance:d,rr};}}}}
    return best;
  }
  function ship(flow){
    if(!flow||flow.amount<=0)return false;const {from,to,r,rr,distance}=flow;ensure(from);ensure(to);const inv=from.resources=from.resources||{},w=from.supply.warehouse;let amount=flow.amount;if((inv[r]||0)<amount){const take=Math.min(amount,w.stock[r]||0);w.stock[r]=(w.stock[r]||0)-take;inv[r]=(inv[r]||0)+take;}if((inv[r]||0)<amount)return false;inv[r]-=amount;const capacity=(from.supply.transportCapacity||transportCapacity(from));const travel=Math.max(2,Math.round(distance/70));const risk=clamp(distance/1200+(rr?.safety?0:(100-(to.stability||60))/250),0,.5);const shipment={id:`shipment-${state.year}-${state.tick}-${Math.floor(Math.random()*1e6)}`,fromId:from.id,toId:to.id,resource:r,amount,remaining:travel,travel,lossRisk:risk,status:'in-transit',startedYear:state.year};from.supply.inTransit.push(shipment);to.supply.backorders[r]=(to.supply.backorders[r]||0)+amount;return true;
  }
  function processShipments(s){
    ensure(s);const all=settlements();const keep=[];for(const sh of s.supply.inTransit){sh.remaining--;if(sh.remaining>0){keep.push(sh);continue;}const to=all.find(x=>x.id===sh.toId);if(!to)continue;ensure(to);let delivered=sh.amount;if(to.supply.blockaded){delivered*=.3;sh.status='blockaded';}const loss=delivered*sh.lossRisk*(.2+Math.random()*.8);delivered=Math.max(0,delivered-loss);to.resources=to.resources||{};to.resources[sh.resource]=(to.resources[sh.resource]||0)+delivered;to.supply.backorders[sh.resource]=Math.max(0,(to.supply.backorders[sh.resource]||0)-sh.amount);to.supply.losses+=loss;to.supply.deliveryHistory.push({year:state.year,from:sh.fromId,resource:sh.resource,ordered:sh.amount,delivered,status:sh.status||'delivered'});to.supply.deliveryHistory=to.supply.deliveryHistory.slice(-40);}
    s.supply.inTransit=keep;
  }
  function militarySupply(){
    const armies=(state.armies||[]).filter(a=>a.active&&a.soldiers>0);armies.forEach(a=>{
      const k=state.kingdoms?.find(k=>k.id===a.kingdomId),cap=k?settlements().find(s=>s.id===k.capitalId):null;if(!cap)return;ensure(cap);const need=Math.max(1,a.soldiers*.012);cap.supply.militaryDemand+=need;const local=Math.min(need*.45,cap.resources?.food||0);cap.resources.food=Math.max(0,(cap.resources.food||0)-local);a.supply=clamp((a.supply||0)+local*1.6-need*.08*state.speed);a.logisticsPenalty=clamp(100-(a.supply||0));if(a.supply<35){a.morale=clamp((a.morale||60)-.06*state.speed);a.exhaustion=clamp((a.exhaustion||0)+.08*state.speed);}});
  }
  function blockadeFeedback(s){ensure(s);if(!s.supply.blockaded)return;const shortage=Object.entries(s.supply.backorders).reduce((a,[r,v])=>a+v*(r==='food'?1.5:1),0);if(shortage>5){s.foodSecurity=clamp((s.foodSecurity||50)-.05*state.speed);s.stability=clamp((s.stability||60)-.025*state.speed);s.economy=s.economy||{};s.economy.prosperity=clamp((s.economy.prosperity||40)-.03*state.speed);}}
  function blockades(){
    const ss=settlements();ss.forEach(s=>s.supply.blockaded=false);(state.borderWars||[]).forEach(w=>{const a=ss.find(s=>s.kingdomId===w.a||s.kingdomId===w.attackerId),b=ss.find(s=>s.kingdomId===w.b||s.kingdomId===w.defenderId);if(a)a.supply.blockaded=true;if(b)b.supply.blockaded=true;});
  }
  function step(){
    if(!state.running)return;const ss=settlements();ss.forEach(ensure);ss.forEach(moveLocalToWarehouse);ss.forEach(warehouseToLocal);ss.forEach(s=>s.supply.transportCapacity=transportCapacity(s));blockades();if(state.tick%5===0){for(let i=0;i<2;i++){const f=chooseFlow();if(!f)break;ship(f);}}ss.forEach(processShipments);if(state.tick%8===0)militarySupply();if(state.tick%12===0)ss.forEach(blockadeFeedback);ss.forEach(s=>{const pending=Object.values(s.supply.backorders).reduce((a,v)=>a+Math.max(0,v),0);s.supply.transportDemand=pending;s.supply.access=clamp((s.infrastructure?.roads||0)*.5+(s.services?.trade||0)*.3+(s.supply.warehouse.quality||50)*.2-pending*.4);});
  }
  window.EVERGLEN_SUPPLY={step,ship,chooseFlow,warehouseCapacity,transportCapacity};
  if(state.registerSystem)state.registerSystem({name:'supply-chains',step,priority:56});
})();
