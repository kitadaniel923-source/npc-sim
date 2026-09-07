// Role system: broad professions, civic titles, military ranks and fantasy classes.
const ROLE_LIBRARY = {
  professions: [
    ['farmer','Farmer','grows food',1],['rancher','Rancher','raises livestock',1],['fisher','Fisher','catches fish',1],['forager','Forager','gathers wild food',1],
    ['miner','Miner','extracts ore',2],['woodcutter','Woodcutter','harvests timber',1],['builder','Builder','constructs buildings',2],['mason','Mason','builds stone structures',2],
    ['blacksmith','Blacksmith','makes tools and weapons',3],['armorer','Armorer','makes armor',3],['carpenter','Carpenter','makes furniture and bows',2],['weaver','Weaver','makes cloth',2],
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

window.roleForNpc = function npcRoleFor(npc, index, total){
  // Keep everyone useful. Most start as common professions; specialist and political roles emerge later.
  if(npc.roleId) return window.ROLE_BY_ID[npc.roleId] || window.ROLE_BY_ID.citizen;
  if(npc.age < 13) return window.ROLE_BY_ID.child;
  if(npc.age < 18) return window.ROLE_BY_ID.student;
  const common = ROLE_LIBRARY.professions;
  const chosen = common[index % common.length];
  return window.ROLE_BY_ID[chosen[0]];
};

window.assignEmergentRoles = function assignEmergentRoles(npcs, settlements, state){
  const alive=npcs.filter(n=>n.alive);
  alive.forEach((n,i)=>{
    if(n.age<13){n.roleId='child';n.roleName='Child';n.roleType='civic';return;}
    if(n.age<18){n.roleId='student';n.roleName='Student';n.roleType='civic';return;}
    if(!n.roleId || ['citizen','unemployed'].includes(n.roleId)){
      const role=window.roleForNpc(n,i,alive.length);n.roleId=role.id;n.roleName=role.name;n.roleDescription=role.desc;
    }
  });

  // Political hierarchy emerges from population, ambition and faction power.
  const factionGroups=new Map();
  alive.forEach(n=>{if(!factionGroups.has(n.faction))factionGroups.set(n.faction,[]);factionGroups.get(n.faction).push(n);});
  factionGroups.forEach(group=>{
    const sorted=[...group].sort((a,b)=>(b.wealth||0)+(b.mood||0)+(b.age||0)*1.4-(a.wealth||0)-(a.mood||0)-(a.age||0)*1.4);
    const ambitious=[...group].sort((a,b)=>((b.trait==='ambitious'?50:0)+(b.wealth||0)))-0;
    if(group.length>=12 && sorted[0].age>=25){sorted[0].roleId=group.length>=55?'king':'mayor';sorted[0].roleName=group.length>=55?'King':'Mayor';}
    if(group.length>=25){sorted.slice(1,3).forEach(n=>{n.roleId=group.length>=55?'duke':'governor';n.roleName=group.length>=55?'Duke':'Governor';});}
    if(group.length>=14){sorted.slice(3,7).forEach(n=>{n.roleId='count';n.roleName='Count';});}
    // military titles are assigned to brave adults if enough people exist.
    const brave=group.filter(n=>['brave','reckless','loyal'].includes(n.trait)&&n.age>=18).sort((a,b)=>(b.health||0)-(a.health||0));
    const militaryCount=Math.max(1,Math.floor(group.length*.12));
    brave.slice(0,militaryCount).forEach((n,j)=>{if(!['king','queen','duke','count','governor','mayor'].includes(n.roleId)){n.roleId=j===0&&group.length>=25?'captain':'soldier';n.roleName=window.ROLE_BY_ID[n.roleId].name;}});
    // Clerics and magical specialists are rare.
    if(group.length>=10){const candidate=group.find(n=>n.age>=20 && n.trait==='calm');if(candidate&&!['king','duke','count','governor','mayor'].includes(candidate.roleId)){candidate.roleId='cleric';candidate.roleName='Cleric';}}
    if(group.length>=20){const mage=group.find(n=>n.age>=24&&n.trait==='curious');if(mage&&!['king','duke','count','governor','mayor'].includes(mage.roleId)){mage.roleId='wizard';mage.roleName='Wizard';}}
    // Criminal roles appear in populations with low stability or high greed.
    if((state.stability||80)<45||group.some(n=>n.trait==='greedy')){
      const rogue=group.find(n=>n.age>=18&&n.trait==='greedy');
      if(rogue&&!['king','duke','count','governor','mayor'].includes(rogue.roleId)){rogue.roleId=Math.random()<.5?'thief':'smuggler';rogue.roleName=window.ROLE_BY_ID[rogue.roleId].name;}
    }
  });
};

window.roleDescription = function(id){return window.ROLE_BY_ID[id] || window.ROLE_BY_ID.citizen;};
