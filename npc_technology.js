// Medieval technology and knowledge progression.
(() => {
  const state=window.SIM_STATE;if(!state)return;
  const P=window.NPC_PERSONALITY,M=window.NPC_MEMORY;
  const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,v));
  const alive=()=>state.npcs.filter(n=>n.alive);
  const score=(n,k)=>P?.score(n,k)??50;
  const has=(n,t)=>P?.has(n,t)||n.trait===t||n.traits?.includes(t);

  const TECHS={
    agriculture:{name:'Advanced Agriculture',era:1,cost:45,skills:['farmer'],effects:{food:.18,prosperity:3}},
    masonry:{name:'Masonry',era:1,cost:55,skills:['builder','architect','engineer'],effects:{construction:.18,defense:.08}},
    metallurgy:{name:'Metallurgy',era:1,cost:65,skills:['miner','blacksmith'],effects:{weapons:.12,armor:.12,tools:.1}},
    medicine:{name:'Medicine',era:1,cost:60,skills:['healer','cleric','druid','alchemist'],effects:{health:.16,foodSecurity:.03}},
    writing:{name:'Writing & Recordkeeping',era:1,cost:50,skills:['scholar','teacher','scribe','librarian'],effects:{knowledge:.2,administration:.1}},
    navigation:{name:'Navigation',era:2,cost:85,skills:['trader','merchant','explorer','shipwright','sailor'],effects:{trade:.18,migration:.12}},
    engineering:{name:'Medieval Engineering',era:2,cost:105,skills:['engineer','architect','builder','blacksmith'],requires:['masonry','metallurgy'],effects:{construction:.22,production:.12}},
    chemistry:{name:'Alchemy & Chemistry',era:2,cost:110,skills:['alchemist','scholar','mage'],requires:['medicine','writing'],effects:{medicine:.18,reagents:.15}},
    printing:{name:'Printing Press',era:3,cost:145,skills:['scholar','teacher','scribe','librarian'],requires:['writing'],effects:{knowledge:.25,education:.2}},
    gunpowder:{name:'Gunpowder Craft',era:3,cost:160,skills:['blacksmith','alchemist','engineer'],requires:['metallurgy','chemistry'],effects:{combat:.22,warSupply:.12}},
    steel:{name:'Advanced Steelworking',era:3,cost:175,skills:['blacksmith','miner','engineer'],requires:['metallurgy','engineering'],effects:{weapons:.25,armor:.25,tools:.18}},
    astronomy:{name:'Astronomy',era:3,cost:150,skills:['scholar','mage','explorer'],requires:['writing','navigation'],effects:{navigation:.25,knowledge:.3}},
    mastercraft:{name:'Mastercraft Engineering',era:4,cost:230,skills:['engineer','architect','blacksmith','builder'],requires:['engineering','steel','printing'],effects:{production:.3,construction:.25,defense:.08}}
  };

  function ensureSettlement(s){
    s.technology=s.technology||{points:0,level:1,unlocked:[],progress:{},discoveries:[],lastBreakthrough:0};
    s.technology.unlocked=s.technology.unlocked||[];s.technology.progress=s.technology.progress||{};s.technology.discoveries=s.technology.discoveries||[];
    s.technology.bonuses=s.technology.bonuses||{};s.infrastructure=s.infrastructure||{};
  }
  function ensureNpc(n){n.knowledge=n.knowledge||0;n.education=n.education||0;n.specialization=n.specialization||{};}
  function contribution(n){
    const role=n.roleId||'';let v=.035+score(n,'cleverness')*.0009+score(n,'curiosity')*.0012+score(n,'discipline')*.0006;
    if(['scholar','teacher','scribe','librarian'].includes(role))v*=3.2;else if(['engineer','architect','alchemist','blacksmith','healer','explorer'].includes(role))v*=2.1;else if(['merchant','trader'].includes(role))v*=1.3;
    if(has(n,'clever'))v*=1.12;if(has(n,'curious'))v*=1.1;if(n.age<16||n.age>75)v*=.35;if(n.culture?.id==='curiosity')v*=1.25;return v;
  }
  function canResearch(s,id){const t=TECHS[id],u=s.technology.unlocked;return !!t&&!u.includes(id)&&(t.requires||[]).every(x=>u.includes(x));}
  function unlock(s,id){
    const t=TECHS[id];if(!t||s.technology.unlocked.includes(id))return false;s.technology.unlocked.push(id);s.technology.discoveries.unshift({id,name:t.name,year:state.year});s.technology.discoveries=s.technology.discoveries.slice(0,24);s.technology.progress[id]=t.cost;s.technology.lastBreakthrough=state.tick;s.technology.level=clamp(1+Math.floor(s.technology.unlocked.length/2),1,10);
    state.technology=state.technology||{globalDiscoveries:[]};state.technology.globalDiscoveries=state.technology.globalDiscoveries||[];state.technology.globalDiscoveries.unshift({id,technology:t.name,settlementId:s.id,year:state.year});state.technology.globalDiscoveries=state.technology.globalDiscoveries.slice(0,40);
    if(M){const scholars=alive().filter(n=>n.settlementId===s.id).filter(n=>['scholar','teacher','scribe','librarian','engineer','alchemist'].includes(n.roleId)).slice(0,8);scholars.forEach(n=>M.remember(n,`Our settlement discovered ${t.name}.`,'technology',4,s.id,'pride',true));}return true;
  }
  function apply(s,people){
    const u=s.technology.unlocked,b=s.technology.bonuses={food:0,prosperity:0,construction:0,defense:0,health:0,knowledge:0,administration:0,trade:0,migration:0,medicine:0,reagents:0,education:0,combat:0,warSupply:0,production:0};
    u.forEach(id=>Object.entries(TECHS[id].effects||{}).forEach(([k,v])=>b[k]=(b[k]||0)+v));
    people.forEach(n=>{ensureNpc(n);n.knowledge=clamp(n.knowledge+(b.knowledge||0)*.005);if((b.education||0)>0)n.education=clamp(n.education+(b.education||0)*.004);if(n.roleId==='farmer')n.productionMultiplier=1+(b.food||0);if(['builder','architect','engineer'].includes(n.roleId))n.constructionMultiplier=1+(b.construction||0);if(['blacksmith','soldier','captain','general','marshal'].includes(n.roleId))n.combatMultiplier=1+(b.combat||0);if(['healer','cleric','druid','alchemist'].includes(n.roleId))n.medicineMultiplier=1+(b.health||0)+(b.medicine||0);});
  }
  function research(s,people){
    if(!s||!people.length)return;ensureSettlement(s);const active=people.filter(n=>n.age>=16&&n.age<=75&&contribution(n)>0);let points=0;active.forEach(n=>points+=contribution(n));points*=1+(s.services?.education||0)*.008;if(s.culture?.id==='curiosity')points*=1.18;s.technology.points+=points;
    const choices=Object.keys(TECHS).filter(id=>canResearch(s,id));choices.sort((a,b)=>{const f=id=>active.reduce((x,n)=>x+((TECHS[id].skills||[]).includes(n.roleId)?2:0),0);return(f(b)-f(a))||(TECHS[a].era-TECHS[b].era)||a.localeCompare(b);});
    for(const id of choices.slice(0,2)){const t=TECHS[id];s.technology.progress[id]=(s.technology.progress[id]||0)+points*.7;if(s.technology.progress[id]>=t.cost&&unlock(s,id)){if(M&&active[0])M.experience(active[0],`I contributed to discovering ${t.name}.`,'discovery',3,s.id,'pride',-4,true);break;}}s.technology.points*=.992;
  }
  function step(){
    if(!state.running)return;const batch=window.SIM_BUDGET?.npcBatch?.()||alive();const by=new Map();batch.forEach(n=>{if(n.settlementId){if(!by.has(n.settlementId))by.set(n.settlementId,[]);by.get(n.settlementId).push(n);}});
    state.settlements.forEach(s=>{const people=state.tick%6===0?alive().filter(n=>n.settlementId===s.id):(by.get(s.id)||[]);if(!people.length)return;ensureSettlement(s);research(s,people);apply(s,people);if(s.technology.unlocked.includes('printing'))s.infrastructure.knowledge=Math.max(s.infrastructure.knowledge||0,45);if(s.technology.unlocked.includes('masonry'))s.infrastructure.workshops=Math.max(s.infrastructure.workshops||0,25);});
    if(state.tick%6===0)state.npcs.forEach(ensureNpc);else batch.forEach(ensureNpc);state.technology=state.technology||{globalDiscoveries:[]};
  }
  window.NPC_TECHNOLOGY={TECHS,ensureSettlement,unlock,research,step,settlementTech:s=>s?.technology||null};if(state.registerSystem)state.registerSystem({name:'technology',step,priority:68});
})();
