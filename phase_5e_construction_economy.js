// Phase 5E: construction economy, public works, maintenance and infrastructure capacity.
(() => {
  const state=window.SIM_STATE;if(!state)return;
  const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,v));
  const settlements=()=>state.settlements||[];
  const npcs=()=>state.npcs||[];
  const log=t=>window.SIM_API?.log?.(t);
  const memory=window.NPC_MEMORY;

  const PROJECTS={
    road:{label:'Road',days:18,cost:{stone:10,tools:2},labor:7,build:'roads',yield:{marketAccess:4},maintenance:.018},
    bridge:{label:'Bridge',days:28,cost:{stone:18,wood:12,tools:3},labor:11,build:'roads',yield:{marketAccess:7},maintenance:.025},
    farm:{label:'Expanded Farmland',days:22,cost:{wood:8,tools:3},labor:10,build:'farms',yield:{food:7},maintenance:.012},
    granary:{label:'Granary',days:24,cost:{stone:16,wood:12,tools:3},labor:9,build:'granaries',yield:{foodStorage:8},maintenance:.018},
    mine:{label:'Mine',days:40,cost:{wood:18,stone:10,tools:6},labor:15,build:'mines',yield:{iron:5},maintenance:.03},
    workshop:{label:'Workshop',days:30,cost:{wood:16,stone:12,iron:5,tools:4},labor:13,build:'workshops',yield:{production:6},maintenance:.022},
    market:{label:'Market Hall',days:26,cost:{wood:14,stone:14,tools:3},labor:10,build:'markets',yield:{trade:7},maintenance:.02},
    clinic:{label:'Clinic',days:34,cost:{wood:16,stone:14,medicine:4,tools:3},labor:10,build:'clinics',yield:{health:7},maintenance:.022},
    school:{label:'School',days:38,cost:{wood:14,stone:14,paper:6,tools:2},labor:9,build:'schools',yield:{education:8},maintenance:.02},
    wall:{label:'Defensive Wall',days:52,cost:{stone:34,iron:6,tools:7},labor:22,build:'defenses',yield:{security:10},maintenance:.04},
    port:{label:'Port',days:60,cost:{wood:34,stone:18,iron:6,tools:6,boats:1},labor:24,build:'ports',yield:{trade:12},maintenance:.035},
    waterworks:{label:'Waterworks',days:46,cost:{stone:28,wood:10,tools:5},labor:18,build:'water',yield:{water:12,health:5},maintenance:.028},
    castle:{label:'Castle',days:95,cost:{stone:70,wood:20,iron:16,tools:12},labor:40,build:'fortifications',yield:{security:18,legitimacy:4},maintenance:.06}
  };

  function ensure(s){
    s.construction=s.construction||{};
    s.construction.queue=s.construction.queue||[];
    s.construction.completed=s.construction.completed||[];
    s.construction.history=s.construction.history||[];
    s.construction.spent=s.construction.spent||0;
    s.construction.maintenance=s.construction.maintenance||0;
    s.construction.quality=s.construction.quality??50;
    s.construction.capacity=s.construction.capacity??Math.max(1,Math.floor((s.infrastructure?.roads||0)/12)+1);
    s.construction.funding=s.construction.funding||0;
  }

  function residents(s){return npcs().filter(n=>n.alive&&n.settlementId===s.id);}
  function builders(s){return residents(s).filter(n=>n.age>=16&&n.age<=70&&['builder','engineer','architect','carpenter','mason','blacksmith'].includes(n.roleId));}
  function affordable(s,cost){const r=s.resources=s.resources||{};return Object.entries(cost).every(([id,v])=>(r[id]||0)>=v);}
  function pay(s,cost){const r=s.resources=s.resources||{};for(const[id,v]of Object.entries(cost))r[id]-=v;}
  function projectAllowed(s,id,p){
    const pr=PROJECTS[id];if(!pr)return false;
    if(s.construction.completed.length>160)return false;
    if(s.type==='village'&&['castle','port','school'].includes(id)&&p.length<10)return false;
    if(id==='castle'&&s.infrastructure?.defenses<10)return false;
    if(id==='port'&&s.infrastructure?.roads<8)return false;
    if(id==='mine'&&(s.resources?.stone||0)<6&&s.resources?.iron<3)return false;
    return true;
  }
  function priority(s,id,p){
    const e=s.economy||{},svc=s.services||{},i=s.infrastructure||{};let v=Math.random()*2;
    if(id==='farm')v+=(e.foodSecurity<60?26:0);
    if(id==='granary')v+=(e.foodSecurity<68?20:0);
    if(id==='road')v+=(e.marketAccess<60?16:0);
    if(id==='bridge')v+=(e.marketAccess<48?14:0);
    if(id==='market')v+=(svc.trade<55?16:0);
    if(id==='workshop'||id==='mine')v+=(e.employment>45?12:0);
    if(id==='clinic')v+=(svc.health<55?18:0);
    if(id==='school')v+=(svc.education<45?15:0);
    if(id==='waterworks')v+=(svc.health<50?17:0);
    if(id==='wall')v+=((s.infrastructure?.defenses||0)<35?12:0)+(state.war?14:0);
    if(id==='port')v+=(svc.trade<45?18:0);
    if(id==='castle')v+=(s.type!=='village'&&(s.infrastructure?.defenses||0)>18?11:0);
    v+=(p.length>40?4:0);
    return v;
  }
  function choose(s){
    ensure(s);const p=residents(s);if(!p.length||builders(s).length<1)return null;
    const active=s.construction.queue.length;if(active>=s.construction.capacity+1)return null;
    const options=Object.keys(PROJECTS).filter(id=>projectAllowed(s,id,p)&&affordable(s,PROJECTS[id].cost)&&!s.construction.queue.some(q=>q.type===id));
    options.sort((a,b)=>priority(s,b,p)-priority(s,a,p));return options[0]||null;
  }
  function start(s,id){
    ensure(s);const pr=PROJECTS[id],p=residents(s);if(!pr||!projectAllowed(s,id,p)||!affordable(s,pr.cost))return false;
    pay(s,pr.cost);const q={id:`build-${s.id}-${state.year}-${state.tick}-${Math.floor(Math.random()*1e6)}`,type:id,progress:0,startedYear:state.year,remaining:pr.days,workers:0};s.construction.queue.push(q);s.construction.spent+=Object.values(pr.cost).reduce((a,v)=>a+v,0);s.construction.history.push({year:state.year,action:'started',type:id});log(`${s.name} began construction of a ${pr.label}.`);return true;
  }
  function finish(s,q){
    const pr=PROJECTS[q.type];q.progress=1;q.finishedYear=state.year;s.construction.queue=s.construction.queue.filter(x=>x!==q);s.construction.completed.push({id:q.id,type:q.type,year:state.year,quality:s.construction.quality});s.construction.completed=s.construction.completed.slice(-160);
    s.infrastructure=s.infrastructure||{};const amount=Math.max(1,pr.labor*.18);const build=pr.build;s.infrastructure[build]=clamp((s.infrastructure[build]||0)+amount,0,100);
    for(const[id,v]of Object.entries(pr.yield||{})){if(id==='health'||id==='education'||id==='security'||id==='trade')continue;s.construction[id]=(s.construction[id]||0)+v;}
    s.services=s.services||{};if(pr.yield.health)s.services.health=clamp((s.services.health||0)+pr.yield.health);if(pr.yield.education)s.services.education=clamp((s.services.education||0)+pr.yield.education);if(pr.yield.security)s.services.security=clamp((s.services.security||0)+pr.yield.security);if(pr.yield.trade)s.services.trade=clamp((s.services.trade||0)+pr.yield.trade);
    if(pr.yield.marketAccess)s.economy=s.economy||{},s.economy.marketAccess=clamp((s.economy.marketAccess||0)+pr.yield.marketAccess);
    if(pr.yield.legitimacy&&s.kingdomId){const k=state.kingdoms?.find(k=>String(k.id)===String(s.kingdomId));if(k)k.legitimacy=clamp((k.legitimacy||50)+pr.yield.legitimacy);}
    s.construction.history.push({year:state.year,action:'completed',type:q.type});if(memory){builders(s).slice(0,5).forEach(n=>memory.remember(n,`${s.name} completed a ${pr.label}.`,'construction',2,s.id,'pride'));}log(`${s.name} completed a ${pr.label}.`);
  }
  function work(s,q){
    const b=builders(s);if(!b.length)return;
    const treasury=s.construction.funding||0;const base=Math.min(b.length*.035,state.speed*.22);const funded=treasury>0?1.15:0.78;const materialsFactor=affordableProgress(s,q.type);const progress=Math.min(1,base*funded*materialsFactor);q.progress=Math.min(1,q.progress+progress);q.workers=Math.min(b.length,Math.ceil(q.progress*PROJECTS[q.type].labor));q.remaining=Math.max(0,PROJECTS[q.type].days*(1-q.progress));s.construction.funding=Math.max(0,(s.construction.funding||0)-base*.4);if(q.progress>=1)finish(s,q);
  }
  function affordableProgress(s,type){const pr=PROJECTS[type],r=s.resources||{};let ratio=1;for(const[id,v]of Object.entries(pr.cost)){ratio=Math.min(ratio,((r[id]||0)+1)/Math.max(1,v*.18));}return clamp(ratio,.35,1.1);}
  function fundingStep(s){
    ensure(s);const k=state.kingdoms?.find(k=>String(k.id)===String(s.kingdomId));const publicFunds=k?.finance?.spending?.infrastructure?Math.max(0,k.finance.spending.infrastructure*.015):0;const local=window.EVERGLEN_BANKING&&s.finance?.bankingPower?Math.max(0,s.finance.bankingPower*.01):0;s.construction.funding=Math.min(40,(s.construction.funding||0)+publicFunds+local);
  }
  function maintenanceStep(s){
    ensure(s);const completed=s.construction.completed;if(!completed.length)return;let pressure=0;completed.slice(-30).forEach(item=>pressure+=PROJECTS[item.type]?.maintenance||0);const upkeep=Math.min((s.resources?.tools||0)*.04+((s.wealth||0)*.0006),pressure*.5*state.speed);if(s.resources) s.resources.tools=Math.max(0,(s.resources.tools||0)-upkeep*.12);s.construction.maintenance=pressure;s.construction.quality=clamp((s.construction.quality||50)-pressure*.015*state.speed+(upkeep>pressure*.15?.02:0));if(s.construction.quality<35){s.infrastructure.roads=clamp((s.infrastructure.roads||0)-.015*state.speed);s.infrastructure.defenses=clamp((s.infrastructure.defenses||0)-.008*state.speed);s.services.trade=clamp((s.services.trade||0)-.01*state.speed);}}
  function step(){
    if(!state.running)return;
    settlements().forEach(s=>{ensure(s);fundingStep(s);if(state.tick%18===0&&!s.construction.queue.length) {const id=choose(s);if(id)start(s,id);}s.construction.queue.slice().forEach(q=>work(s,q));if(state.tick%36===0)maintenanceStep(s);s.construction.capacity=Math.max(1,Math.floor(1+(s.infrastructure?.roads||0)/18+(residents(s).length>50?1:0)));});
  }
  window.EVERGLEN_CONSTRUCTION={PROJECTS,step,start,choose,finish};
  if(state.registerSystem)state.registerSystem({name:'construction-economy',step,priority:67});
})();
