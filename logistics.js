// Logistics + political territory layer for Everglen.
// This module is intentionally modular: it can sit beside the existing NPC engine
// and gradually consume real settlement/NPC state as those systems mature.
(function () {
  const RESOURCE_KEYS = ['food','wood','stone','iron','gold','cloth','medicine','reagents','weapons','armor','tools'];
  const clamp = (v,a,b) => Math.max(a, Math.min(b,v));
  const pick = a => a[Math.floor(Math.random()*a.length)];
  const dist = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
  const money = n => Math.max(0, Math.floor(n));

  const logistics = {
    roads: [],
    routes: [],
    caravans: [],
    regions: [],
    counties: [],
    duchies: [],
    taxes: [],
    initialized: false,
    tick: 0,
    enabled: true,
    overlay: true
  };
  window.EverglenLogistics = logistics;

  const map = document.getElementById('worldViewport');
  if (!map) return;

  const overlay = document.createElement('div');
  overlay.id = 'logisticsOverlay';
  overlay.innerHTML = `
    <div class="logistics-panel">
      <div class="logistics-title"><span>LOGISTICS</span><b id="logisticsStatus">Active</b></div>
      <div class="logistics-row"><span>Roads</span><strong id="roadCount">0</strong></div>
      <div class="logistics-row"><span>Trade routes</span><strong id="routeCount">0</strong></div>
      <div class="logistics-row"><span>Caravans</span><strong id="caravanCount">0</strong></div>
      <div class="logistics-row"><span>Counties</span><strong id="countyCount">0</strong></div>
      <div class="logistics-row"><span>Duchies</span><strong id="duchyCount">0</strong></div>
      <div class="logistics-row"><span>Tax revenue</span><strong id="taxRevenue">0g</strong></div>
    </div>`;
  map.appendChild(overlay);

  const style = document.createElement('style');
  style.textContent = `
    #logisticsOverlay{position:absolute;right:12px;top:12px;z-index:8;pointer-events:none}
    .logistics-panel{min-width:145px;padding:10px 11px;border:1px solid rgba(130,190,165,.23);background:rgba(4,14,12,.84);backdrop-filter:blur(6px);border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.24);font:10px Segoe UI,sans-serif}
    .logistics-title{display:flex;justify-content:space-between;margin-bottom:6px;color:#b8cec5;letter-spacing:1.2px;font-size:9px}.logistics-title b{color:#9ee8b6;letter-spacing:0}
    .logistics-row{display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid rgba(255,255,255,.045);color:#81988f}.logistics-row:last-child{border-bottom:0}.logistics-row strong{color:#e8f3ee}
  `;
  document.head.appendChild(style);

  const $ = id => document.getElementById(id);

  function getWorldEntities() {
    // Prefer the existing simulation's exposed state if present.
    const s = window.SIM_STATE || window.simState || window.gameState;
    return s || null;
  }

  function seedSettlements() {
    const s = getWorldEntities();
    if (s && Array.isArray(s.settlements) && s.settlements.length) return s.settlements;
    return [
      {id:'everglen',name:'Everglen',x:0,y:0,type:'city',population:70,food:80,wealth:500},
      {id:'northwatch',name:'Northwatch',x:360,y:-180,type:'village',population:28,food:55,wealth:160},
      {id:'ironhollow',name:'Ironhollow',x:-360,y:220,type:'village',population:24,food:48,wealth:190}
    ];
  }

  function roadBetween(a,b,kind='road') {
    return {id:`road-${logistics.roads.length+1}`,from:a.id,to:b.id,kind,length:dist(a,b),condition:90+Math.random()*10,capacity:20+Math.random()*20,traffic:0};
  }

  function ensureNetwork(settlements) {
    if (logistics.roads.length) return;
    const ordered = [...settlements].sort((a,b)=>a.x-b.x);
    for (let i=0;i<ordered.length-1;i++) logistics.roads.push(roadBetween(ordered[i],ordered[i+1]));
    if (ordered.length >= 3) logistics.roads.push(roadBetween(ordered[0],ordered[2],'trade-road'));
  }

  function createRoute(from,to,resource) {
    const road = logistics.roads.find(r => (r.from===from.id&&r.to===to.id)||(r.from===to.id&&r.to===from.id));
    if (!road) return null;
    return {id:`route-${logistics.routes.length+1}`,from:from.id,to:to.id,resource,roadIds:[road.id],volume:4+Math.random()*8,profit:0,active:true};
  }

  function createHierarchy(settlements) {
    if (logistics.counties.length) return;
    settlements.forEach((s,i)=>logistics.counties.push({id:`county-${i+1}`,name:`${s.name} County`,capital:s.id,population:s.population||20,taxRate:.08+.02*Math.random()}));
    if (settlements.length >= 2) logistics.duchies.push({id:'duchy-1',name:'Everglen Duchy',countyIds:logistics.counties.map(c=>c.id),duke:'—',stability:78,taxRate:.04});
    logistics.regions.push({id:'region-1',name:'Everglen Crownlands',duchyIds:logistics.duchies.map(d=>d.id)});
  }

  function spawnCaravan(route, settlements) {
    const from=settlements.find(s=>s.id===route.from), to=settlements.find(s=>s.id===route.to);
    if(!from||!to) return;
    logistics.caravans.push({id:`caravan-${++logistics.tick}`,routeId:route.id,x:from.x,y:from.y,from,to,progress:0,speed:.006+Math.random()*.003,cargo:Math.floor(route.volume),resource:route.resource,health:100});
  }

  function updateCaravans() {
    const settlements=seedSettlements();
    logistics.routes.forEach(route=>{
      if (route.active && logistics.caravans.filter(c=>c.routeId===route.id).length < 1 && Math.random()<.08) spawnCaravan(route,settlements);
    });
    logistics.caravans.forEach(c=>{
      c.progress+=c.speed;
      c.x=c.from.x+(c.to.x-c.from.x)*Math.min(c.progress,1);
      c.y=c.from.y+(c.to.y-c.from.y)*Math.min(c.progress,1);
      const route=logistics.routes.find(r=>r.id===c.routeId);
      if(c.progress>=1){
        if(route){route.profit += money(c.cargo*(route.resource==='gold'?2:1.5));route.volume=clamp(route.volume+(Math.random()-.4),1,30);}
        c.progress=0;c.x=c.from.x;c.y=c.from.y;
      }
    });
  }

  function collectTaxes() {
    let revenue=0;
    logistics.counties.forEach(c=>{revenue += money((c.population||0)*c.taxRate*.35);});
    logistics.duchies.forEach(d=>{revenue += money((d.countyIds.length||0)*3);});
    logistics.taxes.push(revenue);
    logistics.taxes=logistics.taxes.slice(-20);
    return logistics.taxes.reduce((a,b)=>a+b,0);
  }

  function step() {
    if(!logistics.enabled) return;
    logistics.tick++;
    const settlements=seedSettlements();
    ensureNetwork(settlements);
    if(logistics.routes.length===0 && settlements.length>=2){
      logistics.routes.push(createRoute(settlements[0],settlements[1],'food'));
      if(settlements.length>=3) logistics.routes.push(createRoute(settlements[2],settlements[0],'iron'));
    }
    createHierarchy(settlements);
    updateCaravans();
    if(logistics.tick%30===0) collectTaxes();
    renderStats();
  }

  function renderStats(){
    $('roadCount').textContent=logistics.roads.length;
    $('routeCount').textContent=logistics.routes.length;
    $('caravanCount').textContent=logistics.caravans.length;
    $('countyCount').textContent=logistics.counties.length;
    $('duchyCount').textContent=logistics.duchies.length;
    $('taxRevenue').textContent=`${money(logistics.taxes.reduce((a,b)=>a+b,0))}g`;
  }

  function init(){
    if(logistics.initialized)return;
    logistics.initialized=true;
    const settlements=seedSettlements();
    ensureNetwork(settlements);
    createHierarchy(settlements);
    renderStats();
  }

  init();
  setInterval(step,700);
})();
