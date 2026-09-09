// Everglen race + profession layer.
// Adds race identity and race-aware profession selection without replacing the existing NPC career/role systems.
(() => {
  const state = window.SIM_STATE;
  if (!state) return;

  const RACE_LIBRARY = {
    human: {
      id:'human', name:'Human', description:'Adaptable generalist with broad access to every profession.',
      bodyScale:1.00, modifiers:{courage:1, risk:0, aggression:0, sociability:2, ambition:2, discipline:1, curiosity:2, kindness:1, loyalty:1, cleverness:2},
      preferences:{}
    },
    dwarf: {
      id:'dwarf', name:'Dwarf', description:'Resilient craft and mining culture with strong industrial traditions.',
      bodyScale:.92, modifiers:{courage:5, risk:-2, aggression:2, sociability:-1, ambition:2, discipline:9, curiosity:3, kindness:1, loyalty:5, cleverness:6},
      preferences:{miner:20,blacksmith:20,mason:18,builder:12,engineer:14,carpenter:12,merchant:8,scholar:7,soldier:8}
    },
    elf: {
      id:'elf', name:'Elf', description:'Knowledge, nature and refined craft traditions.',
      bodyScale:1.03, modifiers:{courage:0, risk:-1, aggression:-2, sociability:3, ambition:1, discipline:3, curiosity:10, kindness:5, loyalty:2, cleverness:9},
      preferences:{herbalist:20,healer:18,doctor:15,hunter:15,ranger:18,scholar:20,teacher:14,mage:18,alchemist:18,enchanter:16,weaver:10,druid:20,artist:12}
    },
    orc: {
      id:'orc', name:'Orc', description:'Strong martial, frontier and heavy-labor traditions.',
      bodyScale:1.12, modifiers:{courage:10, risk:7, aggression:9, sociability:0, ambition:3, discipline:1, curiosity:1, kindness:-1, loyalty:5, cleverness:2},
      preferences:{hunter:16,woodcutter:16,blacksmith:17,miner:12,soldier:20,spearman:18,militia:16,ranger:10,builder:10,carpenter:10,farmer:8}
    },
    halfling: {
      id:'halfling', name:'Halfling', description:'Community-focused farmers, traders and skilled household craftspeople.',
      bodyScale:.78, modifiers:{courage:-2, risk:-3, aggression:-5, sociability:10, ambition:2, discipline:5, curiosity:4, kindness:8, loyalty:7, cleverness:4},
      preferences:{farmer:22,fisher:18,baker:20,cook:16,merchant:18,trader:18,innkeeper:20,peddler:18,shopkeeper:15,forager:14,weaver:12,farrier:12,beastmaster:14,brewer:18}
    }
  };

  // The supplied race/profession pack is treated as a visual profession catalog.
  // Each asset profession is mapped to the closest canonical role already used by main.
  const PROFESSION_CATALOG = {
    apothecary:{name:'Apothecary',roleId:'herbalist',group:'care'},
    baker:{name:'Baker',roleId:'baker',group:'food'},
    banker:{name:'Banker',roleId:'merchant',group:'wealth'},
    blacksmith:{name:'Blacksmith',roleId:'blacksmith',group:'industry'},
    candle_maker:{name:'Candle Maker',roleId:'artist',group:'craft'},
    carpenter:{name:'Carpenter',roleId:'carpenter',group:'industry'},
    farmer:{name:'Farmer',roleId:'farmer',group:'food'},
    fisherman:{name:'Fisherman',roleId:'fisher',group:'food'},
    innkeeper:{name:'Innkeeper',roleId:'innkeeper',group:'wealth'},
    quarry_worker:{name:'Quarry Worker',roleId:'miner',group:'industry'},
    stable_hand:{name:'Stable Hand',roleId:'beastmaster',group:'animals'},
    stonemason:{name:'Stonemason',roleId:'mason',group:'industry'},
    street_sweeper:{name:'Street Sweeper',roleId:'lawkeeper',group:'civic'},
    street_vendor:{name:'Street Vendor',roleId:'peddler',group:'wealth'},
    tailor:{name:'Tailor',roleId:'weaver',group:'craft'},
    town_clerk:{name:'Town Clerk',roleId:'scribe',group:'civic'},
    town_crier:{name:'Town Crier',roleId:'courier',group:'civic'},
    warehouse_porter:{name:'Warehouse Porter',roleId:'courier',group:'logistics'},
    well_keeper:{name:'Well Keeper',roleId:'farmer',group:'civic'},
    woodcutter:{name:'Woodcutter',roleId:'woodcutter',group:'industry'}
  };

  const RACE_IDS=Object.keys(RACE_LIBRARY);
  const PROF_IDS=Object.keys(PROFESSION_CATALOG);
  const hash=id=>{let h=2166136261;for(const c of String(id)){h=Math.imul(h^c.charCodeAt(0),16777619);}return h>>>0;};
  const alive=()=>state.npcs.filter(n=>n.alive);

  function inheritedRace(n){
    const parents=(n.parentIds||n.parents||[]).map(id=>state.npcs.find(p=>p.id===id)).filter(Boolean);
    const races=parents.map(p=>p.raceId).filter(Boolean);
    if (!races.length) return null;
    if (races.length===1) return races[0];
    return Math.random()<.5 ? races[0] : races[1];
  }

  function ensureRace(n,index=0){
    if (!RACE_LIBRARY[n.raceId]) n.raceId=inheritedRace(n)||RACE_IDS[(hash(`${n.id}:${index}`)%RACE_IDS.length)];
    const r=RACE_LIBRARY[n.raceId];
    n.raceName=r.name;
    n.raceDescription=r.description;
    n.heritage=n.heritage||[n.raceId];
    n.visual=n.visual||{};
    n.visual.raceId=n.raceId;
    if(!n.raceVisualApplied){ n.visual.bodyScale=(n.visual.bodyScale||1)*r.bodyScale; n.raceVisualApplied=true; }
    if(!n.raceProfileApplied){
      const p=window.NPC_PERSONALITY?.ensure?.(n);
      if(p){
        Object.entries(r.modifiers).forEach(([k,v])=>{p.base[k]=Math.max(0,Math.min(100,(p.base[k]??50)+v));});
        window.NPC_PERSONALITY.applyTraits(n);
      }
      n.raceProfileApplied=true;
    }
    return r;
  }

  function professionCandidates(n){
    const roles=window.ALL_ROLES||[];
    const available=roles.filter(r=>!['child','student','citizen','unemployed','prisoner','refugee'].includes(r.id));
    const race=RACE_LIBRARY[n.raceId]||RACE_LIBRARY.human;
    return available.map(r=>{
      let score=(race.preferences[r.id]||0);
      const p=window.NPC_PERSONALITY;
      if(p){
        const map={
          farmer:['discipline','kindness'],miner:['discipline','courage'],woodcutter:['discipline','courage'],
          blacksmith:['discipline','cleverness'],carpenter:['discipline','cleverness'],weaver:['discipline','cleverness'],
          baker:['discipline','kindness'],cook:['kindness','discipline'],healer:['kindness','discipline'],
          merchant:['sociability','ambition'],trader:['risk','sociability'],peddler:['sociability','risk'],
          innkeeper:['sociability','kindness'],scholar:['curiosity','cleverness'],teacher:['kindness','curiosity'],
          engineer:['cleverness','discipline'],architect:['cleverness','ambition'],hunter:['courage','risk'],
          ranger:['courage','curiosity'],militia:['loyalty','courage'],soldier:['courage','loyalty'],
          cleric:['kindness','discipline'],mage:['curiosity','cleverness'],alchemist:['curiosity','cleverness'],
          druid:['curiosity','kindness'],enchanter:['curiosity','cleverness'],beastmaster:['kindness','discipline'],
          farrier:['discipline','courage'],artist:['curiosity','sociability'],courier:['discipline','sociability'],
          scribe:['discipline','cleverness'],lawkeeper:['discipline','loyalty']
        };
        (map[r.id]||[]).forEach(k=>{score+=(p.score(n,k)||50)*.12;});
      }
      return {...r,score};
    }).sort((a,b)=>b.score-a.score);
  }

  function chooseProfession(n,index){
    if(!n.alive||n.age<18)return;
    if(['king','queen','emperor','empress','duke','archduke','count','governor','mayor','heir','prince','princess'].includes(n.roleId))return;
    const ranked=professionCandidates(n);
    if(!ranked.length)return;
    const preferred=ranked[0];
    const assetIds=PROF_IDS.filter(id=>PROFESSION_CATALOG[id].roleId===preferred.id);
    const professionId=assetIds.length ? assetIds[hash(`${n.id}:profession:${index}`)%assetIds.length] : null;
    if(!n.professionId||n.roleId==='citizen'||n.roleId==='unemployed'){
      n.roleId=preferred.id;
      n.roleName=preferred.name;
      n.roleDescription=preferred.desc||'';
      n.professionId=professionId||preferred.id;
      n.professionName=professionId?PROFESSION_CATALOG[professionId].name:preferred.name;
      n.professionGroup=professionId?PROFESSION_CATALOG[professionId].group:(window.NPC_CAREERS?.CAREERS.find(c=>c.id===preferred.id)?.group||'general');
      n.job=n.professionGroup;
      n.lastAction=`Works as a ${n.professionName}`;
    } else if(!n.professionId){
      n.professionId=preferred.id;
      n.professionName=preferred.name;
      n.professionGroup=window.NPC_CAREERS?.CAREERS.find(c=>c.id===preferred.id)?.group||'general';
    }
  }

  function step(){
    if(!state.npcs?.length)return;
    alive().forEach((n,i)=>ensureRace(n,i));
    if(state.tick%8===0) alive().forEach((n,i)=>chooseProfession(n,i));
  }

  window.EVERGLEN_RACES={
    RACE_LIBRARY,PROFESSION_CATALOG,RACE_IDS,PROF_IDS,
    ensureRace,professionCandidates,chooseProfession,
    careerModifier:(npc,career)=>{
      const r=RACE_LIBRARY[npc?.raceId]||RACE_LIBRARY.human;
      return r.preferences[career?.id]||0;
    }
  };
  state.registerSystem?.(step);
  alive().forEach((n,i)=>ensureRace(n,i));
})();
