// Resource registry: compact raw materials, minerals, food, crafted goods and transport.
(() => {
  const state = window.SIM_STATE;
  if (!state) return;

  const RESOURCES = {
    food:{name:'Food',category:'food',unit:'units',base:8,description:'Staple food consumed by households.'},
    fish:{name:'Fish',category:'food',unit:'units',base:9,description:'Fresh catch from rivers and coasts.'},
    grain:{name:'Grain',category:'food',unit:'units',base:6,description:'Stored cereal used for food and brewing.'},
    livestock:{name:'Livestock',category:'food',unit:'animals',base:24,description:'Herd animals raised for meat and materials.'},

    wood:{name:'Wood',category:'raw material',unit:'logs',base:5,description:'Primary construction material and fuel.'},
    stone:{name:'Stone',category:'raw material',unit:'blocks',base:7,description:'Primary material for buildings, roads and fortifications.'},

    iron:{name:'Iron',category:'mineral',unit:'ingots',base:14,description:'Common metal for tools, weapons and armor.'},
    silver:{name:'Silver',category:'mineral',unit:'ingots',base:32,description:'Precious metal used for wealth, coinage and luxury goods.'},
    gold:{name:'Gold',category:'mineral',unit:'coins',base:55,description:'Rare precious metal used for wealth, trade and status.'},
    mithril:{name:'Mithril',category:'mineral',unit:'ingots',base:120,description:'Legendary lightweight metal prized for elite arms and armor.'},
    adamantine:{name:'Adamantine',category:'mineral',unit:'ingots',base:180,description:'Extremely rare ultra-hard metal used for exceptional weapons and fortifications.'},
    emberite:{name:'Emberite',category:'mineral',unit:'crystals',base:105,description:'Heat-rich fictional mineral found near volcanic or magical regions.'},
    moonstone:{name:'Moonstone',category:'mineral',unit:'stones',base:95,description:'Rare fictional mineral prized by mages and nobles.'},
    voidstone:{name:'Voidstone',category:'mineral',unit:'stones',base:160,description:'Rare fictional dark mineral with strange arcane properties.'},
    starsteel:{name:'Starsteel',category:'mineral',unit:'ingots',base:220,description:'Mythic fictional metal associated with fallen stars.'},

    cloth:{name:'Cloth',category:'crafted',unit:'bolts',base:11,description:'Woven material for clothing and trade.'},
    leather:{name:'Leather',category:'crafted',unit:'hides',base:13,description:'Animal hide used for equipment, clothing and armor.'},
    wool:{name:'Wool',category:'crafted',unit:'bundles',base:10,description:'Animal fiber used by textile workers.'},

    medicine:{name:'Medicine',category:'Medicine & magic',unit:'doses',base:22,description:'Prepared medical supplies.'},
    herbs:{name:'Herbs',category:'Medicine & magic',unit:'bundles',base:12,description:'Medicinal and culinary plants.'},
    reagents:{name:'Reagents',category:'Medicine & magic',unit:'bundles',base:28,description:'Rare ingredients used by alchemists and mages.'},

    glass:{name:'Glass',category:'crafted',unit:'pieces',base:26,description:'Crafted material used for trade and specialized goods.'},
    paper:{name:'Paper',category:'Knowledge',unit:'sheets',base:16,description:'Writing material for scholars and administrators.'},
    books:{name:'Books',category:'Knowledge',unit:'volumes',base:38,description:'Knowledge goods produced by scribes.'},

    weapons:{name:'Weapons',category:'Military',unit:'items',base:35,description:'Weapons for militia and armies.'},
    armor:{name:'Armor',category:'Military',unit:'items',base:42,description:'Protective equipment forged by blacksmiths.'},
    tools:{name:'Tools',category:'crafted',unit:'items',base:18,description:'General tools used by workers.'},

    boats:{name:'Boats',category:'transport',unit:'vessels',base:70,description:'Civilian vessels for fishing and transport.'},
    battle_boats:{name:'Battle Boats',category:'transport',unit:'warships',base:150,description:'Armed vessels used for naval combat, raids and coastal defense.'},
    horses:{name:'Horses',category:'transport',unit:'animals',base:50,description:'Mounts for travel, cavalry and messengers.'}
  };

  const OUTPUT = {
    farmer:{food:3.0,grain:1.0},
    rancher:{livestock:.12,leather:.18,wool:.12},
    fisher:{fish:2.2},
    forager:{food:1.2,herbs:.35},
    hunter:{food:1.4,leather:.35},
    miner:{iron:2,silver:.08,gold:.02,mithril:.004,adamantine:.001,emberite:.002,moonstone:.0015,voidstone:.0005,starsteel:.0001},
    woodcutter:{wood:3.0},
    mason:{stone:2.2},
    builder:{tools:.08},
    blacksmith:{weapons:.5,armor:.22,tools:.65,iron:-2,starsteel:-.002,adamantine:-.004,mithril:-.006,emberite:-.003},
    carpenter:{tools:.45,boats:.04,wood:-2},
    weaver:{cloth:1.2,wool:-.65},
    baker:{food:2.2,grain:-1.1},
    cook:{food:1.6,grain:-.35,livestock:-.015},
    brewer:{grain:-.5,food:.25},
    herbalist:{herbs:1.1,medicine:.12},
    healer:{medicine:.7,herbs:-.2},
    doctor:{medicine:1.0,herbs:-.35},
    merchant:{gold:.5},
    trader:{gold:.85},
    peddler:{gold:.3},
    shopkeeper:{gold:.35},
    farrier:{horses:.03,tools:.15,iron:-.3},
    sailor:{fish:.45,boats:.01,gold:.2},
    shipwright:{boats:.08,battle_boats:.025,wood:-3.2,tools:-.3,iron:-.4},
    scholar:{paper:.2,books:.08},
    teacher:{paper:-.08},
    scribe:{paper:-.2,books:.08},
    librarian:{books:.05},
    artist:{cloth:.05,gold:.15},
    musician:{gold:.18},
    courier:{horses:.02,paper:.03},
    engineer:{tools:-.25,stone:.3,wood:.25},
    architect:{paper:-.08,stone:.12},
    explorer:{paper:.05,gold:.08},
    beastmaster:{livestock:.05,horses:.03},
    furniture_maker:{wood:-1.8,tools:-.2,gold:.25},
    alchemist:{medicine:.45,reagents:-1.0,herbs:-.25,emberite:-.01,moonstone:-.006},
    enchanter:{armor:.08,reagents:-1.1,mithril:-.004,moonstone:-.01,voidstone:-.003},
    mage:{reagents:-.35,moonstone:-.006,voidstone:-.002},
    wizard:{reagents:-.55,moonstone:-.01,voidstone:-.004,starsteel:-.001},
    druid:{herbs:.65,medicine:.25,food:.35},
    cleric:{medicine:.3,food:.1},
    cavalry:{horses:-.02,food:-.3,armor:-.05,weapons:-.04},
    soldier:{food:-.22,weapons:-.08,armor:-.05},
    knight:{food:-.3,weapons:-.1,armor:-.08,mithril:-.001},
    archer:{food:-.22,weapons:-.06},
    spearman:{food:-.22,weapons:-.07},
    militia:{food:-.15,weapons:-.04},
    captain:{food:-.25,weapons:-.08,armor:-.05},
    general:{food:-.25,weapons:-.06,armor:-.04},
    marshal:{food:-.3,weapons:-.08,armor:-.05,battle_boats:-.001}
  };

  function ensureSettlement(s){
    s.resources=s.resources||{};
    Object.keys(RESOURCES).forEach(id=>{if(s.resources[id]==null)s.resources[id]=0;});
    return s;
  }

  function ensureNpc(n){
    n.inventory=n.inventory||{};
    Object.keys(RESOURCES).forEach(id=>{if(n.inventory[id]==null)n.inventory[id]=0;});
    return n;
  }

  function catalog(){return RESOURCES;}

  function price(s,id){
    const resource=RESOURCES[id];
    if(!resource)return 10;
    const stock=s?.resources?.[id]??0;
    const population=Math.max(1,(state.npcs||[]).filter(n=>n.alive&&n.settlementId===s?.id).length);
    const target=Math.max(8,population*.35);
    const scarcity=Math.max(-.45,Math.min(1.4,(target-stock)/target));
    return Math.max(1,resource.base*(1+scarcity));
  }

  function applyProduction(n,s,outputScale=.03){
    ensureNpc(n);ensureSettlement(s);
    const recipe=OUTPUT[n.roleId];
    if(!recipe)return;
    Object.entries(recipe).forEach(([id,value])=>{
      if(!RESOURCES[id]||typeof value!=='number')return;
      const amount=value*state.speed*outputScale;
      if(amount>=0)s.resources[id]=(s.resources[id]||0)+amount;
      else{
        const need=Math.abs(amount),used=Math.min(s.resources[id]||0,need);
        s.resources[id]=Math.max(0,(s.resources[id]||0)-used);
      }
    });
  }

  function step(){
    if(!state.running)return;
    state.settlements?.forEach(ensureSettlement);
    state.npcs?.filter(n=>n.alive).forEach(ensureNpc);
    state.npcs?.filter(n=>n.alive).forEach(n=>{
      const s=state.settlements?.find(x=>x.id===n.settlementId);
      if(s)applyProduction(n,s,.012);
    });
  }

  window.NPC_RESOURCES={RESOURCES,OUTPUT,ensureNpc,ensureSettlement,catalog,price,applyProduction,step};
  if(state.registerSystem)state.registerSystem({name:'resource-registry',step,priority:20});
})();
