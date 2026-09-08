// Expanded resource registry and role production map.
// Keeps resources data-driven so economy, settlements and future crafting systems can consume the same catalog.
(() => {
  const state = window.SIM_STATE;
  if (!state) return;

  const RESOURCES = {
    food:{name:'Food',category:'basic',unit:'units',base:8,description:'Staple food consumed by households.'},
    fish:{name:'Fish',category:'food',unit:'units',base:9,description:'Fresh catch from rivers and coasts.'},
    grain:{name:'Grain',category:'food',unit:'units',base:6,description:'Stored cereal used for food and brewing.'},
    livestock:{name:'Livestock',category:'food',unit:'animals',base:24,description:'Herd animals raised for meat and materials.'},
    wood:{name:'Wood',category:'material',unit:'logs',base:5,description:'Basic construction and fuel material.'},
    stone:{name:'Stone',category:'material',unit:'blocks',base:7,description:'Construction material for durable buildings.'},
    clay:{name:'Clay',category:'material',unit:'loads',base:4,description:'Raw material for pottery and brickmaking.'},
    sand:{name:'Sand',category:'material',unit:'loads',base:3,description:'Used in glass and masonry production.'},
    iron:{name:'Iron',category:'metal',unit:'ingots',base:14,description:'Common metal for tools, weapons and armor.'},
    copper:{name:'Copper',category:'metal',unit:'ingots',base:12,description:'Metal used for tools, fittings and coinage.'},
    silver:{name:'Silver',category:'precious',unit:'ingots',base:32,description:'Precious metal used for wealth and trade.'},
    gold:{name:'Gold',category:'precious',unit:'coins',base:55,description:'Rare wealth used for trade, taxes and status.'},
    coal:{name:'Coal',category:'fuel',unit:'loads',base:10,description:'Fuel for smithing, heating and industry.'},
    salt:{name:'Salt',category:'luxury',unit:'loads',base:18,description:'Food preservative and valuable trade good.'},
    cloth:{name:'Cloth',category:'craft',unit:'bolts',base:11,description:'Woven material used for clothing and trade.'},
    leather:{name:'Leather',category:'craft',unit:'hides',base:13,description:'Animal hide used for clothing, armor and tools.'},
    wool:{name:'Wool',category:'craft',unit:'bundles',base:10,description:'Animal fiber used by weavers.'},
    medicine:{name:'Medicine',category:'health',unit:'doses',base:22,description:'Basic medical supplies.'},
    herbs:{name:'Herbs',category:'health',unit:'bundles',base:12,description:'Medicinal and culinary plants.'},
    reagents:{name:'Reagents',category:'arcane',unit:'bundles',base:28,description:'Rare ingredients for alchemy and magic.'},
    gems:{name:'Gems',category:'precious',unit:'stones',base:65,description:'Rare gemstones used for luxury, magic and prestige.'},
    glass:{name:'Glass',category:'craft',unit:'pieces',base:26,description:'Crafted from sand and fuel.'},
    paper:{name:'Paper',category:'knowledge',unit:'sheets',base:16,description:'Writing material used by scholars and administrators.'},
    books:{name:'Books',category:'knowledge',unit:'volumes',base:38,description:'Knowledge goods produced by scribes and printers.'},
    weapons:{name:'Weapons',category:'military',unit:'items',base:35,description:'Arms for militia and armies.'},
    armor:{name:'Armor',category:'military',unit:'items',base:42,description:'Protective equipment for soldiers.'},
    tools:{name:'Tools',category:'craft',unit:'items',base:18,description:'General tools used by workers.'},
    boats:{name:'Boats',category:'transport',unit:'vessels',base:70,description:'Small vessels for fishing and transport.'},
    horses:{name:'Horses',category:'transport',unit:'animals',base:50,description:'Mounts for travel, cavalry and messengers.'}
  };

  const OUTPUT = {
    farmer:{food:3.0,grain:1.0}, rancher:{livestock:.12,leather:.18,wool:.12}, fisher:{fish:2.2}, forager:{food:1.2,herbs:.35}, hunter:{food:1.4,leather:.35},
    miner:{iron:2,copper:.55,stone:1.2,coal:.25,silver:.08,gold:.02,gems:.015}, woodcutter:{wood:3.0}, mason:{stone:2.2}, builder:{tools:.08},
    blacksmith:{weapons:.55,tools:.7,iron:-2,coal:-.6}, armorer:{armor:.45,iron:-2.2,leather:-.25,coal:-.5}, carpenter:{tools:.45,boats:.04,wood:-2},
    weaver:{cloth:1.2,wool:-.65}, potter:{stone:.2,clay:1.5}, baker:{food:2.2,grain:-1.1}, cook:{food:1.6,grain:-.35,meat:-.15},
    brewer:{grain:-.5,food:.25}, herbalist:{herbs:1.1,medicine:.12}, healer:{medicine:.7,herbs:-.2}, doctor:{medicine:1.0,herbs:-.35},
    merchant:{gold:.5}, trader:{gold:.85}, peddler:{gold:.3}, shopkeeper:{gold:.35}, farrier:{horses:.03,tools:.15,iron:-.3},
    sailor:{fish:.45,boats:.01,gold:.25}, shipwright:{boats:.08,wood:-3.2,tools:-.3,iron:-.4}, scholar:{paper:.2,books:.08}, teacher:{education:.08,paper:-.08},
    scribe:{paper:-.2,books:.08}, librarian:{books:.05}, artist:{cloth:.05,gold:.15}, musician:{gold:.18}, courier:{horses:.02,paper:.03},
    engineer:{tools:-.25,stone:.3,wood:.25}, architect:{paper:-.08,stone:.12}, explorer:{paper:.05,gold:.08}, beastmaster:{livestock:.05,horses:.03},
    furniture_maker:{wood:-1.8,tools:-.2,gold:.25}, alchemist:{medicine:.45,reagents:-1.0,herbs:-.25}, enchanter:{armor:.08,gems:-.08,reagents:-1.1},
    mage:{reagents:-.35,gems:-.03}, wizard:{reagents:-.55,gems:-.06}, druid:{herbs:.65,medicine:.25,food:.35}, cleric:{medicine:.3,food:.1},
    sailor:{fish:.45,gold:.2}, leatherworker:{leather:-1,armor:.12,cloth:.12,gold:.1}, miner:{iron:2,copper:.55,stone:1.2,coal:.25,silver:.08,gold:.02,gems:.015},
    cavalry:{horses:-.02,food:-.3,armor:-.05,weapons:-.04}, soldier:{food:-.22,weapons:-.08,armor:-.05}, knight:{food:-.3,weapons:-.1,armor:-.08}, archer:{food:-.22,weapons:-.06}, spearman:{food:-.22,weapons:-.07}, militia:{food:-.15,weapons:-.04},
    blacksmith:{weapons:.55,tools:.7,iron:-2,coal:-.6},
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
      if(!RESOURCES[id] || typeof value!=='number')return;
      const amount=value*state.speed*outputScale;
      if(amount>=0)s.resources[id]=(s.resources[id]||0)+amount;
      else {
        const need=Math.abs(amount);
        const used=Math.min(s.resources[id]||0,need);
        s.resources[id]=Math.max(0,(s.resources[id]||0)-used);
      }
    });
  }

  function step(){
    if(!state.running)return;
    state.settlements?.forEach(ensureSettlement);
    state.npcs?.filter(n=>n.alive).forEach(ensureNpc);
  }

  window.NPC_RESOURCES={RESOURCES,OUTPUT,ensureNpc,ensureSettlement,catalog,price,applyProduction,step};
  if(state.registerSystem)state.registerSystem({name:'resource-registry',step,priority:20});
})();
