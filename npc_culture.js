(() => {
  const state=window.SIM_STATE;if(!state)return;
  const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,v));
  const alive=()=>state.npcs.filter(n=>n.alive);
  const score=(n,key)=>window.NPC_PERSONALITY?.score(n,key)??50;
  const has=(n,t)=>window.NPC_PERSONALITY?.has(n,t)||n.trait===t||n.traits?.includes(t);
  const memory=()=>window.NPC_MEMORY;

  const ARCHETYPES=[
    {id:'tradition',name:'Tradition',religion:'Ancestor Keepers',traits:['loyal','calm'],values:{family:1,order:1,change:-.6}},
    {id:'honor',name:'Honor',religion:'Oathbound',traits:['brave','loyal'],values:{honor:1,war:.5,order:.7}},
    {id:'curiosity',name:'Discovery',religion:'Seekers of Light',traits:['curious','clever'],values:{learning:1,change:.9}},
    {id:'prosperity',name:'Prosperity',religion:'Fortune Covenant',traits:['greedy','ambitious'],values:{wealth:1,trade:.9,change:.4}},
    {id:'compassion',name:'Compassion',religion:'Kindred Faith',traits:['kind','calm'],values:{care:1,peace:.9,family:.6}},
    {id:'strength',name:'Strength',religion:'Path of the Strong',traits:['brave','reckless','ambitious'],values:{war:.9,power:1,order:.4}}
  ];

  const TRADITIONS={
    tradition:['Founders Day','Elder Council','Family Oaths','Ancestor Feast'],
    honor:['Warrior Oaths','Duel of Honor','Remembrance Feast','Shield Vigil'],
    curiosity:['Festival of Invention','Star Watch','Scholar Circles','Discovery Week'],
    prosperity:['Market Week','Merchant Guild Day','Harvest Fair','Coin Festival'],
    compassion:['Healers Day','Shared Table','Mercy Rite','Caregiver Feast'],
    strength:['Trial of Strength','Shield Feast','Champion Games','War Muster']
  };

  function ensureNpc(n){
    if(!n.culture){
      const a=ARCHETYPES[Math.floor(Math.random()*ARCHETYPES.length)];
      n.culture={id:a.id,name:a.name,strength:Math.round(45+Math.random()*20),values:{...a.values},traditions:[],belief:a.religion,beliefStrength:35+Math.random()*30,lastSpread:state.tick,originSettlementId:n.settlementId||null,adoptions:0};
    }
    n.culture.history=n.culture.history||[];
    n.culture.traditions=n.culture.traditions||[];
    n.culture.adoptions=n.culture.adoptions||0;
  }

  function weightedArchetype(people){
    const scores=ARCHETYPES.map(a=>{
      let total=.1;
      for(const n of people){
        ensureNpc(n);
        total += score(n,a.traits[0])*0.45 + score(n,a.traits[1]||a.traits[0])*0.25;
        if(n.roleId==='merchant'||n.roleId==='trader') total += a.id==='prosperity'?10:0;
        if(['soldier','knight','captain','general','marshal'].includes(n.roleId)) total += ['honor','strength'].includes(a.id)?8:0;
        if(['scholar','teacher','scribe','librarian','mage','wizard'].includes(n.roleId)) total += a.id==='curiosity'?9:0;
      }
      return {a,total};
    }).sort((x,y)=>y.total-x.total);
    return scores[0]?.a||ARCHETYPES[0];
  }

  function localHistoryPressure(s){
    const h=(s.history||[]).join(' ').toLowerCase();
    let pressure={tradition:0,honor:0,curiosity:0,prosperity:0,compassion:0,strength:0};
    if(/war|battle|siege|defen[cs]e/.test(h)){pressure.honor+=18;pressure.strength+=16;}
    if(/market|trade|merchant|wealth|prosper/.test(h)){pressure.prosperity+=16;}
    if(/academy|school|scholar|knowledge|discover/.test(h)){pressure.curiosity+=16;}
    if(/famine|hunger|plague|healer|hospital/.test(h)){pressure.compassion+=14;pressure.tradition+=5;}
    if(/found|ancestor|family|elder|tradition/.test(h)){pressure.tradition+=15;}
    return pressure;
  }

  function settlementCulture(s,people){
    s.culture=s.culture||{id:'tradition',name:'Tradition',strength:45,belief:'Ancestor Keepers',beliefStrength:40,traditions:[],influences:{},history:[]};
    if(!people.length)return;
    const tally=new Map();
    people.forEach(n=>{ensureNpc(n);tally.set(n.culture.id,(tally.get(n.culture.id)||0)+1)});
    const history=localHistoryPressure(s);
    const contenders=ARCHETYPES.map(a=>{
      const pop=tally.get(a.id)||0;
      const weighted=weightedArchetype(people).id===a.id?7:0;
      return {a,score:pop*4+history[a.id]+weighted+s.economy?.prosperity*.12+(s.services?.education||0)*(a.id==='curiosity'?.08:0)};
    }).sort((x,y)=>y.score-x.score);
    const best=contenders[0];
    const share=(tally.get(best.a.id)||0)/Math.max(1,people.length);
    const previous=s.culture.id;
    s.culture.id=best.a.id;s.culture.name=best.a.name;s.culture.belief=best.a.religion;
    s.culture.strength=clamp(42+share*45+(s.stability||70)*.06+Math.max(0,history[best.a.id]||0)*.12);
    s.culture.beliefStrength=clamp(32+share*40+(s.resources?.medicine||0)*.45+(s.services?.health||0)*.08);
    s.culture.traditions=s.culture.traditions||[];
    s.culture.influences=s.culture.influences||{};
    s.culture.influences[best.a.id]=(s.culture.influences[best.a.id]||0)+.05*state.speed;
    if(previous!==best.a.id&&s.culture.strength>60){
      s.culture.history.push(`Year ${state.year}: local culture shifted from ${previous} to ${best.a.id}.`);
      s.culture.history=s.culture.history.slice(-16);
    }
    if(people.length>=10&&s.culture.traditions.length<5&&Math.random()<.03*state.speed){
      const pool=TRADITIONS[best.a.id]||[];
      const t=pool[Math.floor(Math.random()*pool.length)];
      if(t&&!s.culture.traditions.includes(t)){s.culture.traditions.push(t);s.culture.history.push(`Year ${state.year}: adopted ${t}.`);}
    }
    if(s.infrastructure?.knowledge>20&&best.a.id==='curiosity'&&s.culture.traditions.length<5&&!s.culture.traditions.includes('Public Lectures'))s.culture.traditions.push('Public Lectures');
    if(s.infrastructure?.defenses>25&&['honor','strength'].includes(best.a.id)&&!s.culture.traditions.includes('War Memorial'))s.culture.traditions.push('War Memorial');
  }

  function adopt(n,s){
    if(!s?.culture)return;
    ensureNpc(n);
    if(n.culture.id===s.culture.id){
      n.culture.strength=clamp(n.culture.strength+.01);
      return;
    }
    const openness=score(n,'curiosity')*.38+score(n,'sociability')*.22+(100-n.culture.strength)*.18+((n.age<25)?8:0);
    const pressure=s.culture.strength*.3+(s.economy?.prosperity||0)*.08;
    if(Math.random()*100<clamp(openness+pressure*.18,0,88)){
      const old=n.culture.id;
      const a=ARCHETYPES.find(x=>x.id===s.culture.id)||ARCHETYPES[0];
      n.culture={id:a.id,name:a.name,strength:clamp(Math.max(30,n.culture.strength-5)+s.culture.strength*.14),values:{...a.values},traditions:(s.culture.traditions||[]).slice(0,4),belief:a.religion,beliefStrength:clamp((n.culture.beliefStrength||40)+5),lastSpread:state.tick,originSettlementId:n.culture.originSettlementId||n.settlementId||null,adoptions:(n.culture.adoptions||0)+1,history:n.culture.history||[]};
      n.culture.history.push(`Year ${state.year}: adopted ${a.name} culture from ${s.name}.`);
      n.culture.history=n.culture.history.slice(-10);
      memory()?.remember(n,`I adopted the ${a.name} tradition of ${s.name}.`,'culture',2.4,s.id,'joy');
      if(old!==a.id&&Math.random()<.12)n.lastAction=`Adopted ${a.name} culture`;
    }
  }

  function spread(people,s){
    if(!s?.culture)return;
    people.filter(n=>n.settlementId===s.id).forEach(n=>adopt(n,s));
    const visitors=alive().filter(n=>n.settlementId!==s.id&&Math.hypot(n.x-s.x,n.y-s.y)<120);
    visitors.slice(0,6).forEach(n=>adopt(n,s));
  }

  function culturalEffects(n,s){
    ensureNpc(n);
    const c=n.culture,id=c?.id,strength=clamp(c?.strength||45,0,100)/100;
    if(id==='tradition'){
      n.loyalty=clamp((n.loyalty||50)+.018*strength);n.grievance=clamp((n.grievance||0)-.012*strength);
      if(n.familyId)n.needs&&(n.needs.belonging=clamp((n.needs.belonging||50)-.035*strength));
    } else if(id==='honor'){
      n.honor=clamp((n.honor||50)+.024*strength);n.combatSkill=clamp((n.combatSkill||50)+.018*strength);
      if(state.war&&has(n,'brave'))n.mood=clamp((n.mood||50)+.025*strength);
    } else if(id==='curiosity'){
      n.education=clamp((n.education||0)+.022*strength);if(score(n,'curiosity')>70)n.goal='Explore';
      n.needs&&(n.needs.purpose=clamp((n.needs.purpose||50)-.025*strength));
    } else if(id==='prosperity'){
      n.fortune=clamp((n.fortune||50)+.024*strength);if(['merchant','trader'].includes(n.roleId))n.influence=clamp((n.influence||0)+.03*strength,0,50);
    } else if(id==='compassion'){
      n.mood=clamp((n.mood||50)+.02*strength);if(n.grievance>20)n.grievance=clamp(n.grievance-.024*strength);
    } else if(id==='strength'){
      n.courageScore=clamp((n.courageScore||50)+.024*strength);n.needs&&(n.needs.safety=clamp((n.needs.safety||50)+.018*strength));
    }
    if(s&&c.belief===s.culture?.belief)n.beliefStrength=clamp((n.beliefStrength||40)+.02*strength);
    n.culture.lastInfluence=state.tick;
  }

  function religionStep(k,people){
    const groups=new Map();
    people.forEach(n=>{ensureNpc(n);const b=n.culture.belief||'Ancestor Keepers';if(!groups.has(b))groups.set(b,[]);groups.get(b).push(n)});
    k.religions=[...groups.entries()].map(([belief,members])=>{
      const clergy=members.filter(n=>['cleric','druid','mage','wizard'].includes(n.roleId));
      const leader=clergy.sort((a,b)=>(b.influence||0)-(a.influence||0))[0]||members[0];
      return {id:belief.toLowerCase().replace(/\s+/g,'_'),name:belief,members:members.map(n=>n.id),strength:clamp(members.length/Math.max(1,people.length)*100),leaderId:leader?.id||null,doctrine:ARCHETYPES.find(a=>a.religion===belief)?.values||{}};
    });
  }

  function familyCultureStep(){
    state.families.forEach(f=>{
      const members=alive().filter(n=>n.familyId===f.id);if(!members.length)return;
      const counts=new Map();members.forEach(n=>{ensureNpc(n);counts.set(n.culture.id,(counts.get(n.culture.id)||0)+1)});
      const best=[...counts.entries()].sort((a,b)=>b[1]-a[1])[0];
      const lead=members.slice().sort((a,b)=>(b.influence||0)-(a.influence||0)||(a.age-b.age))[0];
      f.culture=best?.[0]||lead?.culture?.id||f.culture||'tradition';f.belief=lead?.culture?.belief||f.belief||'Ancestor Keepers';f.traditions=(members.flatMap(n=>n.culture?.traditions||[])).filter((x,i,a)=>a.indexOf(x)===i).slice(0,8);
      f.culturalMemory=(f.culturalMemory||[]).concat(members.filter(n=>n.culture?.lastSpread===state.tick).map(n=>`${n.name} adopted ${n.culture.name}`)).slice(-8);
    });
  }

  function step(){
    if(!state.running)return;
    const people=alive();
    people.forEach(n=>{ensureNpc(n);const s=state.settlements.find(x=>x.id===n.settlementId);if(s)culturalEffects(n,s)});
    state.settlements.forEach(s=>{const residents=people.filter(n=>n.settlementId===s.id);settlementCulture(s,residents);spread(people,s)});
    familyCultureStep();
    state.kingdoms.forEach(k=>religionStep(k,people.filter(n=>n.faction===k.id)));
  }

  window.NPC_CULTURE={step,ensure:ensureNpc,archetypes:ARCHETYPES,adopt};
  if(state.registerSystem)state.registerSystem({name:'culture',step,priority:72});
})();
