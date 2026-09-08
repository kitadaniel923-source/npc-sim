// Medieval logistics: roads, caravans, ports, trade routes and feudal tax flow.
(function(){
  const state=window.SIM_STATE;if(!state)return;
  const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,v));
  const money=n=>Math.max(0,Math.floor(n));
  const alive=()=>state.npcs.filter(n=>n.alive);
  const logistics=window.EverglenLogistics=window.EverglenLogistics||{roads:[],routes:[],caravans:[],taxes:[],counties:[],duchies:[],regions:[],initialized:false,tick:0,enabled:true,overlay:true};
  const map=document.getElementById('worldViewport');
  if(!map)return;
  const getSettlements=()=>state.settlements||[];
  const getNpcSettlement=n=>state.getSettlement?state.getSettlement(n.settlementId):getSettlements().find(s=>s.id===n.settlementId);
  const pos=s=>({x:s.x??Math.random()*800,y:s.y??Math.random()*500});
  const dist=(a,b)=>Math.hypot((a.x??0)-(b.x??0),(a.y??0)-(b.y??0));
  const inventory=s=>{s.resources=s.resources||{};return s.resources;};

  function roadBetween(a,b,kind='road'){
    return{id:`road-${a.id}-${b.id}`,from:a.id,to:b.id,kind,length:dist(pos(a),pos(b)),condition:85,capacity:12,traffic:0};
  }
  function ensureNetwork(ss){
    if(ss.length<2)return;
    ss.forEach(s=>{const roads=ss.filter(x=>x.id!==s.id).sort((a,b)=>dist(pos(s),pos(a))-dist(pos(s),pos(b)));const nearest=roads[0];if(nearest&&!logistics.roads.some(r=>(r.from===s.id&&r.to===nearest.id)||(r.from===nearest.id&&r.to===s.id)))logistics.roads.push(roadBetween(s,nearest));});
    logistics.roads=logistics.roads.slice(-Math.max(20,ss.length*3));
  }
  function routeCanUse(a,b){return logistics.roads.some(r=>(r.from===a.id&&r.to===b.id)||(r.from===b.id&&r.to===a.id));}
  function routeFor(a,b){if(!routeCanUse(a,b))return null;return logistics.routes.find(r=>r.from===a.id&&r.to===b.id)||logistics.routes.find(r=>r.from===b.id&&r.to===a.id)||null;}
  function createRoute(a,b,resource){const existing=routeFor(a,b);if(existing)return existing;const id=`route-${logistics.routes.length+1}`;const r={id,from:a.id,to:b.id,resource,volume:2,profit:0,active:true,kind:(a.advanced?.projects?.ports||0)+(b.advanced?.projects?.ports||0)>0?'coastal':'caravan'};logistics.routes.push(r);return r;}
  function seedRoutes(ss){
    if(ss.length<2)return;
    const food=ss.slice().sort((a,b)=>(b.economy?.foodSecurity||b.foodSecurity||0)-(a.economy?.foodSecurity||a.foodSecurity||0));
    const rich=ss.slice().sort((a,b)=>((b.wealth||0)-(a.wealth||0)));
    if(food[0]&&rich[0]&&food[0].id!==rich[0].id)createRoute(food[0],rich[0],'food');
    const ores=ss.find(s=>(s.resources?.iron||0)>5)||rich[0], smith=ss.find(s=>(s.resources?.weapons||0)<4)||food[0];
    if(ores&&smith&&ores.id!==smith.id)createRoute(ores,smith,'iron');
    const scholar=ss.find(s=>(s.advanced?.projects?.archives||0)>0||(s.advanced?.projects?.printingHouse||0)>0);
    if(scholar&&rich[0]&&scholar.id!==rich[0].id)createRoute(scholar,rich[0],'books');
  }
  function transfer(route,from,to){
    const invFrom=inventory(from),invTo=inventory(to),amount=Math.min(route.volume,invFrom[route.resource]||0);if(amount<=0)return 0;
    invFrom[route.resource]-=amount;invTo[route.resource]=(invTo[route.resource]||0)+amount;route.profit+=money(amount*(route.resource==='books'?5:route.resource==='iron'?2:1));return amount;
  }
  function spawnCaravan(route,ss){
    const from=ss.find(s=>s.id===route.from),to=ss.find(s=>s.id===route.to);if(!from||!to)return;
    const a=pos(from),b=pos(to);logistics.caravans.push({id:`caravan-${++logistics.tick}`,routeId:route.id,from:from.id,to:to.id,x:a.x,y:a.y,progress:0,speed:.055+.02*Math.random(),cargo:Math.max(1,route.volume),health:100});
  }
  function updateCaravans(ss){
    logistics.routes.forEach(route=>{if(!route.active)return;const active=logistics.caravans.some(c=>c.routeId===route.id);if(!active&&Math.random()<.18)spawnCaravan(route,ss);});
    logistics.caravans=logistics.caravans.filter(c=>{const route=logistics.routes.find(r=>r.id===c.routeId),from=ss.find(s=>s.id===c.from),to=ss.find(s=>s.id===c.to);if(!route||!from||!to)return false;const a=pos(from),b=pos(to);c.progress=Math.min(1,c.progress+c.speed);c.x=a.x+(b.x-a.x)*c.progress;c.y=a.y+(b.y-a.y)*c.progress;if(c.progress>=1){transfer(route,from,to);route.volume=clamp(route.volume+(Math.random()-.35),1,24);route.active=true;return false;}return true;});
  }
  function collectTaxes(){
    let revenue=0;getSettlements().forEach(s=>{const tax=(s.feudal?.taxRate||.1);const people=alive().filter(n=>n.settlementId===s.id);const local=people.reduce((a,n)=>a+(n.wealth||0)*tax*.001,0);s.wealth=(s.wealth||0)+local;revenue+=money(local);});
    logistics.taxes.push(revenue);logistics.taxes=logistics.taxes.slice(-30);
  }
  function ensureHierarchy(ss){
    logistics.counties=ss.map((s,i)=>({id:`county-${s.id}`,name:`${s.name} County`,capital:s.id,population:alive().filter(n=>n.settlementId===s.id).length,taxRate:s.feudal?.taxRate||.1}));
    if(ss.length)logistics.duchies=[{id:'duchy-1',name:'Everglen Duchy',countyIds:logistics.counties.map(c=>c.id),stability:clamp(ss.reduce((a,s)=>a+(s.feudal?.legitimacy||50),0)/ss.length)}];
    logistics.regions=[{id:'region-1',name:'Everglen Crownlands',duchyIds:logistics.duchies.map(d=>d.id)}];
  }
  function overlay(){
    if(!map||document.getElementById('logisticsOverlay'))return;
    const el=document.createElement('div');el.id='logisticsOverlay';el.innerHTML='<div class="logistics-panel"><div class="logistics-title"><span>LOGISTICS</span><b>Active</b></div><div class="logistics-row"><span>Roads</span><strong id="roadCount">0</strong></div><div class="logistics-row"><span>Trade routes</span><strong id="routeCount">0</strong></div><div class="logistics-row"><span>Caravans</span><strong id="caravanCount">0</strong></div><div class="logistics-row"><span>Counties</span><strong id="countyCount">0</strong></div><div class="logistics-row"><span>Tax revenue</span><strong id="taxRevenue">0g</strong></div></div>';
    map.appendChild(el);const style=document.createElement('style');style.textContent='#logisticsOverlay{position:absolute;right:12px;top:12px;z-index:8;pointer-events:none}.logistics-panel{min-width:145px;padding:10px 11px;border:1px solid rgba(130,190,165,.23);background:rgba(4,14,12,.84);border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.24);font:10px Segoe UI,sans-serif}.logistics-title{display:flex;justify-content:space-between;margin-bottom:6px;color:#b8cec5;letter-spacing:1px}.logistics-title b{color:#9ee8b6}.logistics-row{display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid rgba(255,255,255,.05);color:#81988f}.logistics-row strong{color:#e8f3ee}';document.head.appendChild(style);
  }
  function render(){const q=id=>document.getElementById(id);if(q('roadCount'))q('roadCount').textContent=logistics.roads.length;if(q('routeCount'))q('routeCount').textContent=logistics.routes.length;if(q('caravanCount'))q('caravanCount').textContent=logistics.caravans.length;if(q('countyCount'))q('countyCount').textContent=logistics.counties.length;if(q('taxRevenue'))q('taxRevenue').textContent=`${money(logistics.taxes.reduce((a,b)=>a+b,0))}g`;}
  function step(){if(!state.running||!logistics.enabled)return;logistics.tick++;const ss=getSettlements();ensureNetwork(ss);seedRoutes(ss);if(logistics.tick%12===0)ensureHierarchy(ss);updateCaravans(ss);if(logistics.tick%30===0)collectTaxes();render();}
  overlay();
  if(state.registerSystem)state.registerSystem({name:'medieval-logistics',step,priority:48});
  window.EVERGLEN_LOGISTICS={...logistics,step,createRoute};
})();
