(() => {
  const state = window.SIM_STATE;
  if (!state) {
    console.warn('Everglen trait combinations: simulation state unavailable.');
    return;
  }

  const COMBINATIONS = [
    {id:'greedy_ambitious',traits:['greedy','ambitious'],title:'Power-Hungry',action:'Chases wealth and political power.',effects:{wealth:1.8,influence:0.8,ambition:1},chance:.22},
    {id:'paranoid_powerful',traits:['paranoid'],requires:n=>((n.status||0)>=75||(n.influence||0)>=25||(n.wealth||0)>=180),title:'Authoritarian',action:'Strengthens control through surveillance and fear.',effects:{stability:-.8,influence:1.1,status:1.2},chance:.2},
    {id:'charismatic_ambitious',traits:['charismatic','ambitious'],title:'Political Climber',action:'Builds a political network and seeks office.',effects:{influence:1.2,reputation:.6,status:.8},chance:.22},
    {id:'brave_aggressive',traits:['brave','aggressive'],title:'Warrior',action:'Seeks dangerous fights and martial careers.',effects:{combat:1.4,status:.5},chance:.25},
    {id:'cowardly_intelligent',traits:['cowardly'],requires:n=>(n.education||0)>=55,title:'Calculated Survivor',action:'Avoids dangerous situations and chooses safer paths.',effects:{health:.4,fortune:.4},chance:.28},
    {id:'creative_intelligent',traits:['creative'],requires:n=>(n.education||0)>=60,title:'Inventor',action:'Spends time experimenting and developing inventions.',effects:{education:1.2,wealth:1.1,reputation:.5},chance:.18},
    {id:'lazy_wealthy',traits:['lazy'],requires:n=>(n.wealth||0)>=120,title:'Heir',action:'Lives comfortably from inherited or accumulated wealth.',effects:{mood:.8,wealth:.7,work:-.4},chance:.3},
    {id:'poor_ambitious',traits:['ambitious'],requires:n=>(n.wealth||0)<12,title:'Hungry Aspirant',action:'Seeks risky routes out of poverty.',effects:{wealth:1.1,crime:.7,influence:.4},chance:.25},
    {id:'jealous_romantic',traits:['jealous','romantic'],title:'Jealous Lover',action:'Becomes possessive and creates relationship drama.',effects:{mood:-.5,grievance:.7},chance:.22},
    {id:'loyal_brave',traits:['loyal','brave'],title:'Elite Soldier',action:'Protects comrades and earns military trust.',effects:{combat:1.2,army:1,reputation:.5},chance:.25},
    {id:'cruel_charismatic',traits:['cruel','charismatic'],title:'Dangerous Dictator',action:'Attracts followers while ruling through intimidation.',effects:{influence:1.4,status:1.1,stability:-1.2},chance:.18},
    {id:'curious_adventurous',traits:['curious','adventurous'],title:'Explorer',action:'Travels beyond familiar territory searching for discoveries.',effects:{explore:1.5,education:.7,wealth:.5},chance:.22},
    {id:'greedy_deceptive',traits:['greedy','deceptive'],title:'Scammer',action:'Uses deception to extract wealth from others.',effects:{wealth:1.3,crime:1.1,reputation:-.5},chance:.22},
    {id:'kind_charismatic',traits:['kind','charismatic'],title:'Community Leader',action:'Builds trust and becomes a local organizer.',effects:{reputation:1,influence:1,stability:.5},chance:.22},
    {id:'paranoid_deceptive',traits:['paranoid','deceptive'],title:'Conspiracy Broker',action:'Spreads suspicions, schemes, and hidden agendas.',effects:{grievance:.6,influence:.7,reputation:-.4},chance:.2}
  ];

  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const alive=()=>state.npcs.filter(n=>n.alive);
  const has=(n,t)=>Array.isArray(n.traits)?n.traits.includes(t):n.trait===t;
  const match=(n,c)=>c.traits.every(t=>has(n,t)) && (!c.requires || c.requires(n));
  const log=(text)=>{if(typeof window.SIM_LOG==='function')window.SIM_LOG(text)};

  function familyOf(n){return state.families?.find(f=>f.id===n.familyId)||null}
  function kingdomOf(n){return state.kingdoms?.find(k=>k.id===n.faction)||null}

  function applyCombo(n,c){
    n.comboHistory=n.comboHistory||[];
    n.comboCooldowns=n.comboCooldowns||{};
    const last=n.comboHistory.find(x=>x.id===c.id);
    if(last&&last.year===state.year&&last.day===state.day)return false;

    const e=c.effects||{};
    if(e.wealth)n.wealth=Math.max(0,(n.wealth||0)+e.wealth);
    if(e.influence)n.influence=Math.max(0,(n.influence||0)+e.influence);
    if(e.status)n.status=clamp((n.status||50)+e.status,0,100);
    if(e.reputation)n.reputation=clamp((n.reputation||50)+e.reputation,0,100);
    if(e.mood)n.mood=clamp((n.mood||50)+e.mood,0,100);
    if(e.health)n.health=clamp((n.health||100)+e.health,0,100);
    if(e.fortune)n.fortune=clamp((n.fortune||50)+e.fortune,0,100);
    if(e.grievance)n.grievance=clamp((n.grievance||0)+e.grievance,0,100);
    if(e.education)n.education=clamp((n.education||0)+e.education,0,100);
    if(e.combat)n.combatSkill=Math.max(0,(n.combatSkill||50)+e.combat);
    if(e.army)n.armySkill=Math.max(0,(n.armySkill||0)+e.army);
    if(e.explore)n.exploreSkill=Math.max(0,(n.exploreSkill||0)+e.explore);
    if(e.crime)n.crimeHeat=clamp((n.crimeHeat||0)+e.crime,0,100);
    if(e.work)n.workEthic=Math.max(0,(n.workEthic||50)+e.work);
    if(e.ambition)n.ambition=clamp((n.ambition||50)+e.ambition,0,100);

    const f=familyOf(n);
    if(f){
      if(e.reputation)f.reputation=clamp((f.reputation??50)+e.reputation*.5,0,100);
      if(e.influence)f.prestige=(f.prestige??10)+Math.max(0,e.influence*.15);
    }
    const k=kingdomOf(n);
    if(k&&e.stability)k.stability=clamp((k.stability??70)+e.stability,0,100);

    n.lastTraitCombo={id:c.id,title:c.title,action:c.action,year:state.year};
    n.lastAction=c.action;
    n.comboHistory.unshift({id:c.id,title:c.title,year:state.year,day:state.day});
    n.comboHistory=n.comboHistory.slice(0,12);
    return true;
  }

  function step(){
    for(const n of alive()){
      if(!n.traits && n.trait)n.traits=[n.trait];
      if(!n.traits)continue;
      n.comboCooldowns=n.comboCooldowns||{};
      for(const c of COMBINATIONS){
        if(!match(n,c))continue;
        const key=`${c.id}`;
        const until=n.comboCooldowns[key]||0;
        if(state.tick<until)continue;
        if(Math.random()>c.chance)continue;
        if(applyCombo(n,c)){
          n.comboCooldowns[key]=state.tick+Math.floor(45+Math.random()*140);
          if(Math.random()<.15)log(`${n.name} became known as a ${c.title}.`);
        }
        break;
      }
    }
  }

  window.SOCIAL_COMBINATIONS=COMBINATIONS;
  window.RUN_SOCIAL_COMBINATIONS=step;

  setInterval(()=>{
    if(!state.running)return;
    step();
  },900);
})();
