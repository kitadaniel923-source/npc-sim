(() => {
  const state = window.SIM_STATE;
  if (!state) return;

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

  function ensureNpc(n){
    if(!n.culture){
      const a=ARCHETYPES[Math.floor(Math.random()*ARCHETYPES.length)];
      n.culture={id:a.id,name:a.name,strength:Math.round(45+Math.random()*20),values:{...a.values},traditions:[],belief:a.religion,beliefStrength:35+Math.random()*30,lastSpread:state.tick};
    }
    n.culture.history=n.culture.history||[];
  }

  function settlementCulture(s,people){
    s.culture=s.culture||{id:'tradition',name:'Tradition',strength:45,belief:'Ancestor Keepers',beliefStrength:40,traditions:[],influences:{},history:[]};
    if(!people.length)return;
    const tally=new Map();
    people.forEach(n=>{ensureNpc(n);const c=n.culture;tally.set(c.id,(tally.get(c.id)||0)+1)});
    const best=[...tally.entries()].sort((a,b)=>b[1]-a[1])[0];
    const archetype=ARCHETYPES.find(a=>a.id===best?.[0])||ARCHETYPES[0];
    const share=best?.[1]/people.length||0;
    s.culture.id=archetype.id;
    s.culture.name=archetype.name;
    s.culture.belief=archetype.religion;
    s.culture.strength=clamp(40+share*55+(s.stability||70)*.05);
    s.culture.beliefStrength=clamp(35+share*45+(s.resources?.medicine||0)*.5);
    s.culture.traditions=s.culture.traditions||[];
    if(people.length>=12 && s.culture.traditions.length<4 && Math.random()<.025){
      const traditions={
        tradition:['Founders Day','Elder Council','Family Oaths'],honor:['Warrior Oaths','Duel of Honor','Remembrance Feast'],
        curiosity:['Festival of Invention','Star Watch','Scholar Circles'],prosperity:['Market Week','Merchant Guild Day','Harvest Fair'],
        compassion:['Healers Day','Shared Table','Mercy Rite'],strength:['Trial of Strength','Shield Feast','Champion Games']
      };
      const pool=traditions[archetype.id]||[];
      const t=pool[Math.floor(Math.random()*pool.length)];
      if(t&&!s.culture.traditions.includes(t)){s.culture.traditions.push(t);s.culture.history.push(`Year ${state.year}: adopted ${t}.`)}
    }
  }

  function adopt(n,s){
    if(!s?.culture)return;
    ensureNpc(n);
    if(n.culture.id===s.culture.id)return;
    const openness=score(n,'curiosity')*.45+score(n,'sociability')*.2+((100-n.culture.strength)*.2);
    const pressure=s.culture.strength*.25;
    if(Math.random()*100<clamp(openness+pressure*.15,0,85)){
      const old=n.culture.id;
      const a=ARCHETYPES.find(x=>x.id===s.culture.id)||ARCHETYPES[0];
      n.culture={id:a.id,name:a.name,strength:clamp(Math.max(30,n.culture.strength-7)+s.culture.strength*.12),values:{...a.values},traditions:(s.culture.traditions||[]).slice(0,3),belief:a.religion,beliefStrength:clamp((n.culture.beliefStrength||40)+4),lastSpread:state.tick,history:n.culture.history||[]};
      memory()?.remember(n,`I adopted the ${a.name} tradition of ${s.name}.`,'culture',2.2,s.id,'joy');
      if(old!==a.id && Math.random()<.08) n.lastAction=`Adopted ${a.name} culture`;
    }
  }

  function spread(people,s){
    if(!s?.culture)return;
    const residents=people.filter(n=>n.settlementId===s.id);
    residents.forEach(n=>adopt(n,s));
    const visitors=alive().filter(n=>n.settlementId!==s.id&&Math.hypot(n.x-s.x,n.y-s.y)<120);
    visitors.slice(0,4).forEach(n=>adopt(n,s));
  }

  function culturalEffects(n,s){
    ensureNpc(n);
    const c=n.culture;
    const id=c?.id;
    if(id==='tradition'){n.loyalty=clamp((n.loyalty||50)+.015);n.grievance=clamp((n.grievance||0)-.01)}
    if(id==='honor'){n.honor=clamp((n.honor||50)+.02);if(state.war&&has(n,'brave'))n.mood=clamp((n.mood||50)+.015)}
    if(id==='curiosity'){n.education=clamp((n.education||0)+.018);n.goal=(score(n,'curiosity')>70?'Explore':n.goal)}
    if(id==='prosperity'){n.fortune=clamp((n.fortune||50)+.02);if(['merchant','trader'].includes(n.roleId))n.influence=clamp((n.influence||0)+.025,0,50)}
    if(id==='compassion'){n.mood=clamp((n.mood||50)+.018);if(n.grievance>20)n.grievance=clamp(n.grievance-.02)}
    if(id==='strength'){n.courageScore=clamp((n.courageScore||50)+.02)}
    if(s&&c.belief===s.culture?.belief)n.beliefStrength=clamp((n.beliefStrength||40)+.015);
  }

  function religionStep(k,people){
    const groups=new Map();
    people.forEach(n=>{ensureNpc(n);const b=n.culture.belief;groups.set(b,(groups.get(b)||[]).concat(n))});
    k.religions=[...groups.entries()].map(([belief,members])=>({id:belief.toLowerCase().replace(/\\s+/g,'_'),name:belief,members:members.map(n=>n.id),strength:clamp(members.length/Math.max(1,people.length)*100),leaderId:(members.find(n=>['cleric','druid','mage','wizard'].includes(n.roleId))||members[0])?.id||null}));
  }

  function step(){
    if(!state.running)return;
    const people=alive();
    people.forEach(n=>{ensureNpc(n);const s=state.settlements.find(x=>x.id===n.settlementId);if(s)culturalEffects(n,s)});
    state.settlements.forEach(s=>{const residents=people.filter(n=>n.settlementId===s.id);settlementCulture(s,residents);spread(people,s)});
    state.families.forEach(f=>{
      const members=people.filter(n=>n.familyId===f.id);
      if(!members.length)return;
      const lead=members.sort((a,b)=>(b.age||0)-(a.age||0))[0];
      f.culture=lead.culture?.id||f.culture||'tradition';
      f.belief=lead.culture?.belief||f.belief||'Ancestor Keepers';
      f.traditions=(lead.culture?.history||[]).slice(-4);
    });
    state.kingdoms.forEach(k=>religionStep(k,people.filter(n=>n.faction===k.id)));
  }

  window.NPC_CULTURE={step,ensure:ensureNpc,archetypes:ARCHETYPES,adopt};
  if(state.registerSystem)state.registerSystem({name:'culture',step,priority:72});
})();
