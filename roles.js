// Role system: broad professions, civic titles, military ranks and fantasy classes.
const ROLE_LIBRARY = {
  professions: [
    ['farmer','Farmer','grows food',1],['rancher','Rancher','raises livestock',1],['fisher','Fisher','catches fish',1],['forager','Forager','gathers wild food',1],
    ['miner','Miner','extracts ore',2],['woodcutter','Woodcutter','harvests timber',1],['builder','Builder','constructs buildings',2],['mason','Mason','builds stone structures',2],
    ['blacksmith','Blacksmith','makes tools, weapons and armor',3],['carpenter','Carpenter','makes furniture and bows',2],['weaver','Weaver','makes cloth',2],
    ['potter','Potter','makes pottery',1],['brewer','Brewer','makes drinks',1],['baker','Baker','makes bread',1],['cook','Cook','prepares food',1],['herbalist','Herbalist','gathers medicinal plants',2],
    ['healer','Healer','treats the sick',3],['doctor','Doctor','provides advanced medicine',4],['merchant','Merchant','trades goods',3],['trader','Trader','travels trade routes',3],['peddler','Peddler','sells small goods',1],
    ['innkeeper','Innkeeper','runs an inn',2],['shopkeeper','Shopkeeper','runs a shop',2],['farrier','Farrier','shoes horses',2],['sailor','Sailor','works ships',2],['shipwright','Shipwright','builds ships',4],
    ['scholar','Scholar','studies knowledge',3],['teacher','Teacher','educates children',2],['scribe','Scribe','records history',2],['librarian','Librarian','guards books',2],['artist','Artist','creates art',1],['musician','Musician','entertains crowds',1],
    ['courier','Courier','carries messages',2],['judge','Judge','settles disputes',4],['lawkeeper','Lawkeeper','enforces laws',3],['tax_collector','Tax Collector','collects state taxes',3],['engineer','Engineer','designs infrastructure',4],
    ['architect','Architect','plans cities',4],['explorer','Explorer','maps unknown lands',3],['hunter','Hunter','hunts wildlife',2],['beastmaster','Beastmaster','handles animals',2],['furniture_maker','Furniture Maker','crafts furniture',2]
  ],
  rogue: [
    ['thief','Thief','steals valuables',2],['pickpocket','Pickpocket','steals from crowds',1],['burglar','Burglar','breaks into homes',2],['bandit','Bandit','robs travelers',3],['assassin','Assassin','performs covert killings',5],['smuggler','Smuggler','moves contraband',4],['spy','Spy','gathers secrets',4],['informant','Informant','sells information',2]
  ],
  military: [
    ['militia','Militiaman','defends the settlement',2],['soldier','Soldier','serves in the army',3],['archer','Archer','fights at range',3],['spearman','Spearman','holds the line',3],['cavalry','Cavalry','fights mounted',4],['knight','Knight','elite mounted warrior',5],['paladin','Paladin','holy elite warrior',6],['berserker','Berserker','fearsome frontline fighter',5],['ranger','Ranger','scouts and hunts',4],['captain','Captain','commands soldiers',6],['general','General','commands armies',8],['marshal','Marshal','commands multiple armies',9],['bodyguard','Bodyguard','protects important people',5]
  ],
  faith_magic: [
    ['acolyte','Acolyte','studies a faith',2],['cleric','Cleric','serves a temple',4],['priest','Priest','leads worship',5],['high_priest','High Priest','leads a religious hierarchy',7],['monk','Monk','lives a disciplined life',3],['oracle','Oracle','interprets visions',6],['mage','Mage','studies arcane magic',6],['wizard','Wizard','master of powerful magic',8],['sorcerer','Sorcerer','wields innate magic',7],['warlock','Warlock','channels forbidden magic',7],['druid','Druid','guards nature',5],['alchemist','Alchemist','brews magical substances',5],['enchanter','Enchanter','enchants items',7],['necromancer','Necromancer','studies death magic',8]
  ],
  nobility: [
    ['mayor','Mayor','governs a town',5],['governor','Governor','governs a region',7],['baron','Baron','rules a barony',8],['count','Count','rules a county',9],['duke','Duke','rules a duchy',11],['archduke','Archduke','rules a major duchy',12],['prince','Prince','member of the royal family',13],['princess','Princess','member of the royal family',13],['king','King','rules a kingdom',15],['queen','Queen','rules a kingdom',15],['emperor','Emperor','rules an empire',18],['empress','Empress','rules an empire',18],['heir','Heir','successor to a throne',12],['royal_advisor','Royal Advisor','advises the ruler',9],['chancellor','Chancellor','runs state administration',10]
  ],
  civic: [
    ['citizen','Citizen','lives and works normally',1],['unemployed','Unemployed','looks for work',0],['student','Student','learns a profession',1],['child','Child','grows and learns',0],['elder','Elder','retired elder',1],['refugee','Refugee','searches for safety',1],['prisoner','Prisoner','held by the law',0],['rebel','Rebel','opposes the government',3],['revolutionary','Revolutionary','organizes an uprising',5]
  ]
};

window.ROLE_LIBRARY = ROLE_LIBRARY;
window.ALL_ROLES = Object.values(ROLE_LIBRARY).flat().map(([id,name,desc,power])=>({id,name,desc,power}));
window.ROLE_BY_ID = Object.fromEntries(window.ALL_ROLES.map(r=>[r.id,r]));

window.roleForNpc = function npcRoleFor(npc, index){
  if(npc.roleId) return window.ROLE_BY_ID[npc.roleId] || window.ROLE_BY_ID.citizen;
  if(npc.age < 13) return window.ROLE_BY_ID.child;
  if(npc.age < 18) return window.ROLE_BY_ID.student;
  const chosen = ROLE_LIBRARY.professions[index % ROLE_LIBRARY.professions.length];
  return window.ROLE_BY_ID[chosen[0]];
};

window.assignEmergentRoles = function assignEmergentRoles(npcs, settlements, sim){
  const alive=npcs.filter(n=>n.alive);
  alive.forEach((n,i)=>{
    if(n.age<13){n.roleId='child';n.roleName='Child';n.roleDescription='grows and learns';return;}
    if(n.age<18){n.roleId='student';n.roleName='Student';n.roleDescription='learns a profession';return;}
    if(!n.roleId || ['citizen','unemployed'].includes(n.roleId)){
      const r=window.roleForNpc(n,i); n.roleId=r.id;n.roleName=r.name;n.roleDescription=r.desc;
    }
  });

  const factionGroups=new Map();
  alive.forEach(n=>{if(!factionGroups.has(n.faction))factionGroups.set(n.faction,[]);factionGroups.get(n.faction).push(n);});
  factionGroups.forEach(group=>{
    const score=n=>((n.trait==='ambitious'?50:0)+(n.trait==='clever'?20:0)+(n.wealth||0)+(n.age||0)*1.5+(n.mood||0));
    const sorted=[...group].sort((a,b)=>score(b)-score(a));
    const titleBlock=['king','queen','emperor','empress','prince','princess','duke','archduke','count','governor','mayor'];
    if(group.length>=12 && sorted[0].age>=25){const id=group.length>=55?(sorted[0].sex==='F'?'queen':'king'):'mayor';sorted[0].roleId=id;sorted[0].roleName=window.ROLE_BY_ID[id].name;sorted[0].roleDescription=window.ROLE_BY_ID[id].desc;}
    if(group.length>=25)sorted.slice(1,3).forEach(n=>{const id=group.length>=55?'duke':'governor';if(!titleBlock.includes(n.roleId)||n===sorted[0]){n.roleId=id;n.roleName=window.ROLE_BY_ID[id].name;n.roleDescription=window.ROLE_BY_ID[id].desc;}});
    if(group.length>=14)sorted.slice(3,7).forEach(n=>{if(!titleBlock.includes(n.roleId)){n.roleId='count';n.roleName='Count';n.roleDescription='rules a county';}});

    const brave=group.filter(n=>n.age>=18&&['brave','reckless','loyal'].includes(n.trait)).sort((a,b)=>(b.health||0)-(a.health||0));
    brave.slice(0,Math.max(1,Math.floor(group.length*.12))).forEach((n,i)=>{
      if(!titleBlock.includes(n.roleId)){const id=group.length>=25&&i===0?'captain':(Math.random()<.25?'knight':'soldier');n.roleId=id;n.roleName=window.ROLE_BY_ID[id].name;n.roleDescription=window.ROLE_BY_ID[id].desc;}
    });

    if(group.length>=10){const cleric=group.find(n=>n.age>=20&&n.trait==='calm'&&!titleBlock.includes(n.roleId));if(cleric){cleric.roleId='cleric';cleric.roleName='Cleric';cleric.roleDescription='serves a temple';}}
    if(group.length>=20){const mage=group.find(n=>n.age>=24&&n.trait==='curious'&&!titleBlock.includes(n.roleId));if(mage){mage.roleId=Math.random()<.55?'wizard':'mage';mage.roleName=window.ROLE_BY_ID[mage.roleId].name;mage.roleDescription=window.ROLE_BY_ID[mage.roleId].desc;}}
    if((sim.stability||80)<55){const rogue=group.find(n=>n.age>=18&&n.trait==='greedy'&&!titleBlock.includes(n.roleId));if(rogue){rogue.roleId=Math.random()<.5?'thief':'smuggler';rogue.roleName=window.ROLE_BY_ID[rogue.roleId].name;rogue.roleDescription=window.ROLE_BY_ID[rogue.roleId].desc;}}
    if(group.length>=35){const adviser=sorted.find(n=>!titleBlock.includes(n.roleId)&&n.trait==='clever');if(adviser){adviser.roleId='royal_advisor';adviser.roleName='Royal Advisor';adviser.roleDescription='advises the ruler';}}
  });
};

window.roleDescription = id => window.ROLE_BY_ID[id] || window.ROLE_BY_ID.citizen;

(function connectRoleSystem(){
  function step(){
    if(!window.SIM_STATE?.running)return;
    const state=window.SIM_STATE;
    if(!state.npcs?.length)return;
    if(state.tick%4===0)window.assignEmergentRoles(state.npcs,state.settlements||[],state);
    state.npcs.filter(n=>n.alive).forEach(n=>{
      const r=window.roleDescription(n.roleId);
      if(!r)return;
      if(['farmer','rancher','forager'].includes(r.id))n.job='farmer';
      else if(['blacksmith','carpenter','mason','builder','engineer','shipwright'].includes(r.id))n.job='builder';
      else if(['merchant','trader','peddler','shopkeeper','innkeeper'].includes(r.id))n.job='merchant';
      else if(['healer','doctor','herbalist'].includes(r.id))n.job='healer';
      else if(['soldier','archer','spearman','cavalry','knight','paladin','ranger','captain','general','marshal','bodyguard'].includes(r.id))n.job='guard';
      else if(['cleric','priest','high_priest','monk','oracle','mage','wizard','sorcerer','warlock','druid','alchemist','enchanter','necromancer'].includes(r.id))n.job='scholar';
      else if(['thief','pickpocket','burglar','bandit','assassin','smuggler','spy','informant'].includes(r.id))n.job='merchant';
      if(['king','queen','duke','archduke','count','governor','mayor','emperor','empress','prince','princess'].includes(r.id)) n.goal='Govern';
      if(['thief','pickpocket','burglar','bandit','assassin','smuggler'].includes(r.id)&&Math.random()<.08)n.goal='Steal';
      if(['cleric','priest','high_priest','monk','oracle'].includes(r.id)&&Math.random()<.08)n.goal='Pray';
      if(['wizard','mage','sorcerer','warlock','druid','alchemist','enchanter','necromancer'].includes(r.id)&&Math.random()<.08)n.goal='Study magic';
      if(['knight','paladin','captain','general','marshal'].includes(r.id)&&state.war)n.goal='Command army';
    });
  }
  window.ROLE_SYSTEM_STEP=step;
  if(window.SIM_API?.registerSystem)window.SIM_API.registerSystem({name:'roles',step,priority:50});
})();