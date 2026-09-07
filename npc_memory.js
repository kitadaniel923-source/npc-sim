(() => {
  const state = window.SIM_STATE;
  if (!state) return;
  const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,v));
  const alive=()=>state.npcs.filter(n=>n.alive);
  function ensure(n){n.memories=Array.isArray(n.memories)?n.memories:[];n.memoryIndex=n.memoryIndex||{};n.grievance=n.grievance||0}
  function remember(n,text,type='event',importance=1,targetId=null){
    ensure(n); const key=`${state.year}:${type}:${text}`;
    if(n.memoryIndex[key]) return;
    const m={id:`m_${Date.now()}_${Math.random().toString(36).slice(2)}`,year:state.year,day:state.day,type,text,importance,targetId};
    n.memories.unshift(m); n.memories=n.memories.sort((a,b)=>(b.importance-a.importance)||(b.year-a.year)).slice(0,24); n.memoryIndex[key]=1;
  }
  function observe(n){
    ensure(n);
    if(n.partnerId){const p=state.npcs.find(x=>x.id===n.partnerId);if(p?.alive)remember(n,`${p.name} is my partner.`,'relationship',2,p.id)}
    if(n.familyId){const f=state.families.find(x=>x.id===n.familyId);if(f)remember(n,`I belong to ${f.name}.`,'family',1.5,f.id)}
    if(state.war) remember(n,'The realm is at war.','war',1.5);
    if(state.plague) remember(n,'A plague is spreading.','disaster',1.5);
    if(n.grievance>45) remember(n,'I carry an unresolved grievance.','grievance',2);
    if(n.crimes>0) remember(n,`I have committed ${n.crimes} crime${n.crimes>1?'s':''}.`,'crime',1.8);
    const enemies=(n.relations||[]).filter(r=>r.score<-50).slice(0,3);
    enemies.forEach(r=>{const x=state.npcs.find(p=>p.id===r.targetId);if(x)remember(n,`${x.name} is someone I distrust.`,'enemy',2,x.id)});
  }
  function consequence(n,delta,reason,target){
    ensure(n); n.grievance=clamp(n.grievance+(delta||0)); if(Math.abs(delta||0)>=5)remember(n,reason,'consequence',Math.min(3,Math.abs(delta)/4),target?.id||null);
  }
  window.NPC_MEMORY={ensure,remember,observe,consequence};
})();
