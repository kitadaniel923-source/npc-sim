// Living ecology and renewable resource layer for Everglen.
// Phase 4I: tracks environmental stocks, depletion, regeneration and ecological pressure.
(() => {
  const state = window.SIM_STATE;
  if (!state) return;

  const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,v));
  const resources=()=>window.NPC_RESOURCES;
  const alive=()=>state.npcs.filter(n=>n.alive);
  const log=t=>window.SIM_API?.log?.(t);

  const PROFILES={
    food:{label:'Foodlands',regen:1.8,max:160,pressure:.018},
    grain:{label:'Farmland',regen:1.3,max:140,pressure:.014},
    fish:{label:'Fisheries',regen:1.5,max:130,pressure:.018},
    livestock:{label:'Pasture',regen:.8,max:100,pressure:.012},
    wood:{label:'Forests',regen:1.25,max:150,pressure:.016},
    herbs:{label:'Herblands',regen:1.1,max:115,pressure:.012},
    iron:{label:'Iron deposits',regen:.015,max:120,pressure:.006},
    silver:{label:'Silver deposits',regen:.009,max:100,pressure:.005},
    gold:{label:'Gold deposits',regen:.006,max:90,pressure:.004},
    mithril:{label:'Mithril deposits',regen:.002,max:65,pressure:.003},
    adamantine:{label:'Adamantine deposits',regen:.001,max:45,pressure:.002},
    emberite:{label:'Emberite deposits',regen:.0015,max:55,pressure:.003},
    moonstone:{label:'Moonstone deposits',regen:.0012,max:60,pressure:.003},
    voidstone:{label:'Voidstone deposits',regen:.0008,max:45,pressure:.002},
    starsteel:{label:'Starsteel deposits',regen:.0004,max:30,pressure:.001}
  };

  function ensure(s){
    s.ecology=s.ecology||{health:70,biome:null,stocks:{},renewable:{},depletion:{},events:[],history:[]};
    s.ecology.stocks=s.ecology.stocks||{};
    s.ecology.renewable=s.ecology.renewable||{};
    s.ecology.depletion=s.ecology.depletion||{};
    s.ecology.events=s.ecology.events||[];
    s.ecology.history=s.ecology.history||[];
    const pop=Math.max(1,alive().filter(n=>n.settlementId===s.id).length);
    if(!s.ecology.biome){
      const roll=(Number(s.x)||0)+(Number(s.y)||0);
      s.ecology.biome=Math.abs(Math.floor(roll))%5===0?'forest':Math.abs(Math.floor(roll))%5===1?'plains':Math.abs(Math.floor(roll))%5===2?'hills':Math.abs(Math.floor(roll))%5===3?'riverlands':'mixed';
    }
    Object.keys(PROFILES).forEach(id=>{
      const p=PROFILES[id];
      if(s.ecology.stocks[id]==null){
        const base=p.max*(s.ecology.biome==='forest'&&id==='wood'?1.25:s.ecology.biome==='plains'&&['grain','food'].includes(id)?1.2:s.ecology.biome==='riverlands'&&id==='fish'?1.25:0.72);
        s.ecology.stocks[id]=clamp(base,0,p.max*1.5);
      }
      if(s.ecology.renewable[id]==null)s.ecology.renewable[id]=p.regen;
      if(s.ecology.depletion[id]==null)s.ecology.depletion[id]=0;
    });
    s.ecology.populationPressure=pop;
    return s;
  }

  function extractionDemand(s,id,pop){
    const roleUse={wood:['woodcutter','carpenter','builder','mason','engineer','shipwright'],fish:['fisher','sailor'],grain:['farmer','baker','brewer'],food:['farmer','hunter','forager','baker','cook'],livestock:['rancher','cook'],herbs:['forager','herbalist','alchemist','druid'],iron:['miner','blacksmith','shipwright'],silver:['miner'],gold:['miner'],mithril:['miner','knight','blacksmith','enchanter'],adamantine:['miner','blacksmith'],emberite:['miner','alchemist','blacksmith'],moonstone:['miner','alchemist','mage','wizard','enchanter'],voidstone:['miner','mage','wizard','enchanter'],starsteel:['miner','blacksmith','wizard','enchanter']};
    const count=p=>alive().filter(n=>n.settlementId===s.id&&p.includes(n.roleId)).length;
    return Math.max(0,(count(roleUse[id]||[])*.028 + pop*(PROFILES[id].pressure||.01)*.35) * state.speed);
  }

  function biomeMultiplier(s,id){
    const b=s.ecology.biome;
    if(b==='forest'&&id==='wood')return 1.7;
    if(b==='plains'&&['grain','food','livestock'].includes(id))return 1.45;
    if(b==='riverlands'&&id==='fish')return 1.75;
    if(b==='hills'&&['stone','iron','silver','gold'].includes(id))return 1.25;
    return 1;
  }

  function regenerate(s){
    ensure(s);
    Object.keys(PROFILES).forEach(id=>{
      const p=PROFILES[id],stock=s.ecology.stocks[id],max=p.max;
      const depleted=clamp(s.ecology.depletion[id]||0,0,100);
      const recovery=(p.regen*biomeMultiplier(s,id))*(1-depleted/125);
      const amount=Math.max(0,recovery*(s.stability>50?1:.78));
      s.ecology.stocks[id]=Math.min(max*1.5,stock+amount);
      s.ecology.depletion[id]=Math.max(0,depleted-(amount/max)*34);
    });
  }

  function extract(s){
    const pop=s.ecology.populationPressure||1;
    Object.keys(PROFILES).forEach(id=>{
      const amount=extractionDemand(s,id,pop);
      if(amount<=0)return;
      const before=s.ecology.stocks[id]||0;
      const after=Math.max(0,before-amount);
      s.ecology.stocks[id]=after;
      const p=PROFILES[id];
      s.ecology.depletion[id]=clamp((s.ecology.depletion[id]||0)+(amount/p.max)*115,0,100);
      if(before>p.max*.32&&after<=p.max*.32){
        const msg=`${s.name} is experiencing ${p.label.toLowerCase()} pressure.`;
        s.ecology.events.unshift({year:state.year,type:'resource-pressure',resource:id,text:msg});
        s.ecology.history.unshift(`Year ${state.year}: ${msg}`);
        s.ecology.events=s.ecology.events.slice(0,12);s.ecology.history=s.ecology.history.slice(0,24);
        log(msg);
      }
    });
  }

  function ecologicalHealth(s){
    const ids=Object.keys(PROFILES);
    const scores=ids.map(id=>clamp((s.ecology.stocks[id]||0)/(PROFILES[id].max*.65)*100));
    const depleted=ids.reduce((n,id)=>n+(s.ecology.depletion[id]>65?1:0),0);
    s.ecology.health=clamp(scores.reduce((a,b)=>a+b,0)/scores.length-depleted*3);
    const people=Math.max(1,s.ecology.populationPressure||1);
    s.ecology.carrierCapacity=Math.round(18+s.ecology.health*.65+s.infrastructure?.water*.1+Math.log10(people+1)*18);
    if(s.ecology.health<30){s.stability=clamp((s.stability||50)-.025*state.speed);s.economy&&(s.economy.foodSecurity=clamp((s.economy.foodSecurity||50)-.04*state.speed));}
    else if(s.ecology.health>78){s.stability=clamp((s.stability||50)+.012*state.speed);}
  }

  function seasonalEvent(s){
    if(state.tick%240!==0)return;
    const r=Math.random();
    if(r<.08&&s.ecology.health>72){
      const gain=4+s.ecology.health*.03;s.ecology.stabilityBonus=clamp((s.ecology.stabilityBonus||0)+gain,-20,20);
      s.ecology.events.unshift({year:state.year,type:'ecological-recovery',text:`The lands around ${s.name} recover after careful stewardship.`});
    } else if(r>.94&&s.ecology.health<42){
      s.ecology.events.unshift({year:state.year,type:'ecological-crisis',text:`The lands around ${s.name} suffer an ecological crisis.`});
      s.history=s.history||[];s.history.push(`Year ${state.year}: ecological crisis reduced the land's productivity.`);s.history=s.history.slice(-40);
      s.stability=clamp((s.stability||50)-5);
      log(`${s.name} suffers an ecological crisis.`);
    }
    s.ecology.events=s.ecology.events.slice(0,16);
  }

  function step(){
    if(!state.running)return;
    const ss=state.settlements||[];
    ss.forEach(s=>{ensure(s);extract(s);regenerate(s);ecologicalHealth(s);seasonalEvent(s);});
  }

  window.EVERGLEN_ECOLOGY={PROFILES,ensure,extract,regenerate,ecologicalHealth,step};
  if(state.registerSystem)state.registerSystem({name:'world-ecology',step,priority:58});
})();
