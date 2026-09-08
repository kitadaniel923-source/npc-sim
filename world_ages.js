// Fictional historical ages: world-scale eras that emerge from history, weather, war, culture and prosperity.
(() => {
  const state=window.SIM_STATE;if(!state)return;
  const M=window.NPC_MEMORY;
  const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,v));
  const alive=()=>state.npcs.filter(n=>n.alive);

  const AGES=[
    {id:'hope',name:'Age of Hope',tone:'renewal',conditions:s=>s.averageStability>72&&s.averageProsperity>62&&s.wars===0,weights:{growth:1.18,peace:1.18,trade:1.08}},
    {id:'rain',name:'Age of Rain',tone:'verdant',conditions:s=>s.rain>=.58&&s.foodSecurity>58,weights:{agriculture:1.2,health:1.06,migration:.94}},
    {id:'harvest',name:'Age of Harvest',tone:'abundance',conditions:s=>s.foodSecurity>76&&s.averageProsperity>60,weights:{food:1.25,trade:1.08,population:1.12}},
    {id:'iron',name:'Age of Iron',tone:'industry',conditions:s=>s.metal>58&&s.military>45,weights:{military:1.15,craft:1.18,war:1.08}},
    {id:'crowns',name:'Age of Crowns',tone:'dynasty',conditions:s=>s.nobility>55&&s.legitimacy>62,weights:{politics:1.2,dynasty:1.18,diplomacy:1.08}},
    {id:'shadows',name:'Age of Shadows',tone:'dread',conditions:s=>s.averageStability<35||s.crime>62,weights:{crime:1.2,fear:1.18,migration:1.12}},
    {id:'war',name:'Age of War',tone:'conflict',conditions:s=>s.wars>0&&s.military>52,weights:{war:1.3,military:1.18,economy:.86}},
    {id:'ash',name:'Age of Ash',tone:'ruin',conditions:s=>s.averageStability<24&&s.foodSecurity<32,weights:{survival:1.3,migration:1.3,rebuilding:1.22}},
    {id:'stars',name:'Age of Stars',tone:'discovery',conditions:s=>s.knowledge>68&&s.curiosity>58,weights:{knowledge:1.25,technology:1.18,exploration:1.2}},
    {id:'oaths',name:'Age of Oaths',tone:'honor',conditions:s=>s.honor>66&&s.legitimacy>55,weights:{loyalty:1.18,military:1.08,law:1.1}}
  ];

  function ensure(){
    state.worldAge=state.worldAge||{id:'hope',name:'Age of Hope',startedYear:state.year,history:[],strength:50,modifiers:{},lastChange:state.tick};
    state.worldAge.history=state.worldAge.history||[];
    state.worldAge.modifiers=state.worldAge.modifiers||{};
  }

  function gather(){
    const ss=state.settlements||[],ks=state.kingdoms||[],p=alive();
    const avg=(key,def=0)=>ss.length?ss.reduce((a,s)=>a+(Number(s[key])||def),0)/ss.length:def;
    const food=avg('foodSecurity',50), prosperity=avg('prosperity',45), stability=avg('stability',50);
    const military=p.length?clamp(p.filter(n=>['soldier','knight','captain','general','marshal','militia'].includes(n.roleId)).length/p.length*100):0;
    const nobility=p.length?clamp(p.filter(n=>['noble','lord'].includes(n.socialClass)||['baron','count','duke','king','heir'].includes(n.roleId)).length/p.length*100):0;
    const honor=p.length?clamp(p.reduce((a,n)=>a+(n.honor||50),0)/p.length):50;
    const curiosity=p.length?clamp(p.reduce((a,n)=>a+(window.NPC_PERSONALITY?.score?.(n,'curiosity')??50),0)/p.length):50;
    const knowledge=ss.length?clamp(ss.reduce((a,s)=>a+(s.infrastructure?.knowledge||0),0)/ss.length):0;
    const metal=ss.length?clamp(ss.reduce((a,s)=>a+(s.resources?.iron||0)+(s.resources?.steel||0)*2,0)/Math.max(1,ss.length*4)):0;
    const crime=p.length?clamp(p.reduce((a,n)=>a+(n.crimeHeat||0),0)/p.length):0;
    const legitimacy=ks.length?clamp(ks.reduce((a,k)=>a+(k.politics?.legitimacy||k.stability||50),0)/ks.length):50;
    const wars=ks.reduce((a,k)=>a+(k.atWar?1:0),0)+(state.war?1:0);
    const rain=state.weather==='Rain'||state.weather==='Storm'||state.weather==='Drizzle'?1:0;
    return {foodSecurity:food,averageProsperity:prosperity,averageStability:stability,military,nobility,honor,curiosity,knowledge,metal,crime,legitimacy,wars,rain};
  }

  function scoreAge(age,s){
    if(age.conditions(s))return 100;
    let score=0;
    if(age.tone==='renewal')score=s.averageStability*.45+s.averageProsperity*.35+(100-Math.min(100,s.wars*35))*.2;
    if(age.tone==='verdant')score=s.rain*100*.55+s.foodSecurity*.35+s.averageStability*.1;
    if(age.tone==='abundance')score=s.foodSecurity*.55+s.averageProsperity*.35+s.averageStability*.1;
    if(age.tone==='industry')score=s.metal*.5+s.military*.25+s.averageProsperity*.25;
    if(age.tone==='dynasty')score=s.nobility*.45+s.legitimacy*.4+s.averageStability*.15;
    if(age.tone==='dread')score=(100-s.averageStability)*.55+s.crime*.45;
    if(age.tone==='conflict')score=s.military*.35+(s.wars?60:0)+(100-s.averageStability)*.25;
    if(age.tone==='ruin')score=(100-s.averageStability)*.5+(100-s.foodSecurity)*.5;
    if(age.tone==='discovery')score=s.knowledge*.55+s.curiosity*.45;
    if(age.tone==='honor')score=s.honor*.5+s.legitimacy*.3+s.military*.2;
    return score;
  }

  function choose(s){
    const ranked=AGES.map(a=>({a,score:scoreAge(a,s)})).sort((x,y)=>y.score-x.score);
    const current=state.worldAge?.id;
    if(current){const c=ranked.find(x=>x.a.id===current);if(c&&c.score>=55&&ranked[0].score<c.score+12)return c.a;}
    return ranked[0]?.a||AGES[0];
  }

  function apply(age){
    ensure();state.worldAge.id=age.id;state.worldAge.name=age.name;state.worldAge.modifiers={...(age.weights||{})};
    state.worldAge.strength=clamp(55+Math.max(0,scoreAge(age,gather())-55)*.5);
  }

  function announce(age,previous){
    const phrase=previous?`The ${previous.name} gives way to the ${age.name}.`:`The world enters the ${age.name}.`;
    state.worldAge.startedYear=state.year;state.worldAge.lastChange=state.tick;
    state.worldAge.history.unshift({year:state.year,from:previous?.name||null,to:age.name,text:phrase});
    state.worldAge.history=state.worldAge.history.slice(0,20);
    state.feed?.unshift(`Year ${state.year}, Day ${state.day}: ${phrase}`);
    if(typeof window.SIM_LOG==='function')window.SIM_LOG(phrase);
    alive().slice(0,12).forEach(n=>M?.remember(n,phrase,'history',4,null,'pride',true));
  }

  function step(){
    if(!state.running)return;
    ensure();
    if(state.tick%120!==0)return;
    const snapshot=gather(),candidate=choose(snapshot),current=AGES.find(a=>a.id===state.worldAge.id)||AGES[0];
    if(candidate.id!==current.id){announce(candidate,current);}
    apply(candidate);
  }

  window.WORLD_AGES={AGES,ensure,gather,choose,step,current:()=>state.worldAge};
  if(state.registerSystem)state.registerSystem({name:'world-ages',step,priority:82});
})();
