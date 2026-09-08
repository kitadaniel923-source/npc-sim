// Medieval technology-driven infrastructure: inventions become buildings, districts and logistics capacity.
(() => {
  const state=window.SIM_STATE;if(!state)return;
  const tech=()=>window.NPC_TECHNOLOGY;
  const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,v));
  const alive=()=>state.npcs.filter(n=>n.alive);
  const residents=s=>alive().filter(n=>n.settlementId===s.id);
  const log=t=>window.SIM_API?.log?.(t);

  const PROJECTS={
    agriculture:{tech:'agriculture',cost:{wood:10,stone:4,tools:2},field:'farms',cap:100,build:'farms',bonus:{food:1}},
    granary:{tech:'agriculture',cost:{wood:14,stone:10,tools:3},field:'granaries',cap:20,build:'granary',bonus:{foodStorage:1}},
    roads:{tech:'masonry',cost:{stone:16,tools:3},field:'roads',cap:100,build:'roads',bonus:{market:1}},
    aqueduct:{tech:'masonry',cost:{stone:24,tools:4},field:'aqueducts',cap:100,build:'water',bonus:{water:1}},
    forge:{tech:'metallurgy',cost:{stone:12,iron:8,tools:3},field:'forges',cap:50,build:'workshops',bonus:{weapons:1,armor:1}},
    clinic:{tech:'medicine',cost:{wood:12,stone:8,medicine:5},field:'clinics',cap:25,build:'health',bonus:{health:1}},
    archive:{tech:'writing',cost:{wood:8,paper:6,books:2},field:'archives',cap:20,build:'knowledge',bonus:{knowledge:1}},
    port:{tech:'navigation',cost:{wood:30,stone:8,tools:5,boats:2},field:'ports',cap:10,build:'trade',bonus:{trade:1}},
    workshop:{tech:'engineering',cost:{wood:14,iron:10,tools:5},field:'engineeringWorks',cap:30,build:'workshops',bonus:{production:1}},
    laboratory:{tech:'chemistry',cost:{stone:10,glass:5,reagents:4,tools:4},field:'laboratories',cap:12,build:'knowledge',bonus:{medicine:1}},
    printingHouse:{tech:'printing',cost:{wood:10,iron:4,paper:10,tools:4},field:'printingHouses',cap:8,build:'knowledge',bonus:{education:1}},
    armory:{tech:'gunpowder',cost:{stone:12,iron:14,wood:8,tools:5},field:'armories',cap:15,build:'defenses',bonus:{warSupply:1}},
    steelworks:{tech:'steel',cost:{stone:18,iron:20,tools:7},field:'steelworks',cap:12,build:'workshops',bonus:{weapons:1,armor:1,production:1}},
    observatory:{tech:'astronomy',cost:{stone:20,glass:8,tools:5},field:'observatories',cap:6,build:'knowledge',bonus:{navigation:1}},
    royalWorkshop:{tech:'mastercraft',cost:{wood:18,stone:16,iron:18,tools:8},field:'royalWorkshops',cap:6,build:'workshops',bonus:{production:2}}
  };

  function ensure(s){
    s.infrastructure=s.infrastructure||{roads:0,housing:0,water:0,workshops:0,defenses:0,knowledge:0};
    s.advanced=s.advanced||{};s.advanced.projects=s.advanced.projects||{};s.advanced.completed=s.advanced.completed||[];s.advanced.bonuses=s.advanced.bonuses||{};
  }
  function hasTech(s,id){return !!(s.technology?.unlocked||[]).includes(id);}
  function suitable(key,p){
    if(key==='agriculture'||key==='granary')return p.some(n=>['farmer','hunter','rancher','baker','cook'].includes(n.roleId));
    if(key==='roads'||key==='port')return p.length>=8;
    if(key==='aqueduct')return p.length>=20;
    if(['forge','steelworks','armory'].includes(key))return p.some(n=>['blacksmith','miner','engineer'].includes(n.roleId));
    if(['clinic','laboratory'].includes(key))return p.some(n=>['healer','doctor','alchemist'].includes(n.roleId));
    if(['archive','printingHouse','observatory'].includes(key))return p.some(n=>['scholar','teacher','scribe','librarian','mage'].includes(n.roleId));
    if(['workshop','royalWorkshop'].includes(key))return p.some(n=>['engineer','architect','builder','blacksmith'].includes(n.roleId));
    return true;
  }
  function canBuild(s,key,p){const pr=PROJECTS[key],count=s.advanced.projects[key]||0;return !!pr&&hasTech(s,pr.tech)&&count<pr.cap&&suitable(key,p)&&(s.advanced.completed||[]).length<120;}
  function pay(s,cost){const inv=s.resources=s.resources||{};for(const[id,v]of Object.entries(cost))if((inv[id]||0)<v)return false;for(const[id,v]of Object.entries(cost))inv[id]-=v;return true;}
  function complete(s,key){
    const pr=PROJECTS[key],count=(s.advanced.projects[key]||0)+1;s.advanced.projects[key]=count;s.advanced.completed.push({id:key,year:state.year});s.advanced.completed=s.advanced.completed.slice(-120);
    for(const bonus of Object.entries(pr.bonus||{})){const[id,value]=bonus;s.advanced.bonuses[id]=(s.advanced.bonuses[id]||0)+value;}
    if(pr.build==='farms')s.infrastructure.housing=clamp(s.infrastructure.housing+.5);if(pr.build==='roads')s.infrastructure.roads=clamp(s.infrastructure.roads+4);if(pr.build==='water')s.infrastructure.water=clamp(s.infrastructure.water+4);if(pr.build==='workshops')s.infrastructure.workshops=clamp(s.infrastructure.workshops+3);if(pr.build==='health'){s.services=s.services||{};s.services.health=clamp((s.services.health||10)+4);}if(pr.build==='knowledge')s.infrastructure.knowledge=clamp(s.infrastructure.knowledge+5);if(pr.build==='defenses')s.infrastructure.defenses=clamp(s.infrastructure.defenses+5);if(pr.build==='trade'){s.services=s.services||{};s.services.trade=clamp((s.services.trade||10)+4);}
    log(`${s.name} completed a ${key} project enabled by ${pr.tech}.`);const people=residents(s);people.filter(n=>['builder','engineer','architect','scholar','blacksmith','merchant'].includes(n.roleId)).slice(0,5).forEach(n=>window.NPC_MEMORY?.remember(n,`${s.name} built a ${key}.`,'infrastructure',3,s.id,'pride'));
  }
  function chooseProject(s,p){
    const available=Object.keys(PROJECTS).filter(k=>canBuild(s,k,p));
    available.sort((a,b)=>{
      const score=k=>{let v=0;const food=s.economy?.foodSecurity||0,health=s.services?.health||0,trade=s.services?.trade||0,knowledge=s.infrastructure?.knowledge||0,pros=s.economy?.prosperity||0;
        if(k==='agriculture')v+=(food<60?24:0);if(k==='granary')v+=(food<65?20:0);if(k==='roads')v+=(trade<55?18:0);if(k==='aqueduct')v+=(health<55?16:0);if(['forge','steelworks','armory'].includes(k))v+=12;if(['archive','printingHouse','observatory'].includes(k))v+=(knowledge<55?15:0);if(k==='clinic'||k==='laboratory')v+=(health<55?17:0);if(k==='port')v+=(trade<60?20:0);if(k==='royalWorkshop')v+=(pros>70?14:0);return v+Object.keys(PROJECTS[k].bonus||{}).length;};return score(b)-score(a);});
    return available[0]||null;
  }
  function step(){
    if(!state.running)return;const budget=window.SIM_BUDGET;if(budget?.shouldRun&&!budget.shouldRun('settlement',2))return;
    state.settlements.forEach(s=>{ensure(s);const p=residents(s);if(!p.length||!s.technology?.unlocked?.length)return;const key=chooseProject(s,p);if(!key)return;const pr=PROJECTS[key];if(pay(s,pr.cost))complete(s,key);});
  }
  window.NPC_ADVANCED_INFRA={PROJECTS,ensure,step,complete};if(state.registerSystem)state.registerSystem({name:'advanced-infrastructure',step,priority:66});
})();
