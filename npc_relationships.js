(() => {
  const state=window.SIM_STATE;
  const personality=window.NPC_PERSONALITY;
  const memory=window.NPC_MEMORY;
  if(!state)return;

  const clamp=(v,a=-100,b=100)=>Math.max(a,Math.min(b,v));
  const alive=()=> (state.npcs||[]).filter(n=>n.alive);
  const score=(n,k)=>personality?.score(n,k)??50;
  const has=(n,t)=>personality?.has(n,t)||n.trait===t;

  function get(a,b,create=true){
    if(!a||!b||a.id===b.id)return null;
    a.relations=a.relations||[];
    let r=a.relations.find(x=>x.targetId===b.id);
    if(!r&&create){r={targetId:b.id,type:'acquaintance',score:0,lastTick:state.tick,trust:50,respect:50,familiarity:0};a.relations.push(r)}
    return r;
  }

  function compatibility(a,b){
    if(!a||!b)return 0;
    const dims=['sociability','kindness','loyalty','curiosity','ambition','discipline','risk','aggression'];
    let similarity=0; dims.forEach(k=>similarity+=100-Math.abs(score(a,k)-score(b,k))); similarity/=dims.length;
    let chemistry=(score(a,'sociability')+score(b,'sociability'))*.12;
    if(has(a,'kind')&&has(b,'kind'))chemistry+=10;
    if(has(a,'loyal')&&has(b,'loyal'))chemistry+=9;
    if(has(a,'greedy')&&has(b,'greedy'))chemistry+=4;
    if(has(a,'ambitious')&&has(b,'ambitious'))chemistry-=4;
    if(has(a,'stubborn')&&has(b,'stubborn'))chemistry-=10;
    if(has(a,'reckless')&&has(b,'calm'))chemistry-=5;
    return clamp(similarity*.45+chemistry-25,-100,100);
  }

  function trustValue(n,targetId,r){
    const memoryTrust=memory?.trust?.(n,targetId)??50;
    const fear=memory?.fear?.(n,targetId)??0;
    const grudge=memory?.grudge?.(n,targetId)??0;
    return clamp(memoryTrust*.5+(r?.trust??50)*.5-fear*.25-grudge*.15,0,100);
  }

  function interact(a,b,context='neutral',intensity=1){
    if(!a||!b||!a.alive||!b.alive||a.id===b.id)return null;
    const r=get(a,b),q=get(b,a),base=compatibility(a,b);
    const rememberedTrust=trustValue(a,b.id,r),targetTrust=trustValue(b,a.id,q);
    let delta=base*.025*intensity;
    if(context==='help')delta+=score(a,'kindness')*.05;
    if(context==='trade')delta+=(score(a,'cleverness')||50)*.025+score(a,'sociability')*.02;
    if(context==='military')delta+=score(a,'loyalty')*.04+score(a,'courage')*.02;
    if(context==='insult')delta-=score(b,'stubborn')*.05+score(b,'aggression')*.03;
    if(context==='betrayal')delta-=22+score(b,'loyalty')*.18;
    if(context==='shared_danger')delta+=score(a,'courage')*.06+score(b,'courage')*.04;
    delta*=0.55+rememberedTrust/200;
    r.score=clamp(r.score+delta); q.score=clamp(q.score+delta*.8);
    r.familiarity=clamp(r.familiarity+.6*intensity,0,100);q.familiarity=r.familiarity;
    r.trust=clamp(r.trust+delta*.55,0,100);q.trust=clamp(q.trust+delta*.45,0,100);
    r.respect=clamp(r.respect+(base>0?Math.abs(delta)*.35:-Math.abs(delta)*.18),0,100);
    q.respect=clamp(q.respect+(base>0?Math.abs(delta)*.28:-Math.abs(delta)*.14),0,100);
    r.lastTick=q.lastTick=state.tick;
    classify(a,b,r);classify(b,a,q);

    if(memory){
      if(context==='help')memory.experience(a,`I helped ${b.name}.`,'relationship',2.5,b.id,'joy',-4);
      else if(context==='military')memory.experience(a,`${b.name} stood with me in danger.`,'relationship',2.8,b.id,'trust',-5);
      else if(context==='shared_danger')memory.experience(a,`${b.name} survived danger with me.`,'relationship',3,b.id,'trust',-6);
      else if(context==='insult')memory.experience(a,`${b.name} challenged or insulted me.`,'conflict',2.5,b.id,'anger',7);
      else if(context==='betrayal')memory.experience(a,`${b.name} betrayed me.`,'betrayal',4.5,b.id,'anger',12,true);
      else if(delta>2.5&&r.familiarity>10)memory.remember(a,`${b.name} has been good to me.`,'relationship',1.5,b.id,'trust');
    }
    return r;
  }

  function classify(a,b,r){
    const trust=trustValue(a,b.id,r);
    if(r.score>=72&&trust>=68)r.type='best_friend';
    else if(r.score>=42&&trust>=55)r.type='friend';
    else if(r.score>=18)r.type='ally';
    else if(r.score<=-72&&trust<32)r.type='sworn_enemy';
    else if(r.score<=-42||trust<25)r.type='enemy';
    else if(r.score<=-18)r.type='rival';
    else r.type='acquaintance';
    if(a.partnerId===b.id||a.spouseId===b.id)r.type='spouse';
  }

  function chooseTarget(n){
    const peers=alive().filter(x=>x.id!==n.id&&x.settlementId===n.settlementId&&Math.abs(x.age-n.age)<35);
    if(!peers.length)return null;
    return peers.sort((a,b)=>Math.abs(compatibility(n,b))-Math.abs(compatibility(n,a)))[Math.floor(Math.random()*Math.min(5,peers.length))]||peers[0];
  }

  function socialEvent(n){
    if(!n.alive||n.age<13)return;
    const target=chooseTarget(n); if(!target)return;
    const rel=get(n,target); const p={social:score(n,'sociability'),kind:score(n,'kindness'),loyal:score(n,'loyalty'),aggression:score(n,'aggression'),ambition:score(n,'ambition'),risk:score(n,'risk')};
    if(p.kind>70&&target.wealth<n.wealth*.45&&Math.random()<.18){
      interact(n,target,'help',1.4);n.wealth=Math.max(0,n.wealth-2);target.wealth+=2;n.mood=clamp(n.mood+3,0,100);target.mood=clamp(target.mood+4,0,100);n.lastAction=`Helped ${target.name}`;target.lastAction=`Received help from ${n.name}`;return;
    }
    if(p.aggression>72&&(rel?.score||0)<20&&Math.random()<.12){
      interact(n,target,'insult',1.3);n.grievance=clamp((n.grievance||0)+4,0,100);target.grievance=clamp((target.grievance||0)+5,0,100);n.lastAction=`Confronted ${target.name}`;target.lastAction=`Was confronted by ${n.name}`;return;
    }
    if(p.loyal>70&&state.war&&target.faction===n.faction&&Math.random()<.2){interact(n,target,'military',1.2);n.lastAction=`Coordinated with ${target.name}`;return;}
    if(p.ambition>70&&target.classTier==='noble'&&Math.random()<.16){interact(n,target,'trade',1.1);n.influence=(n.influence||0)+.2;n.lastAction=`Built a political connection with ${target.name}`;return;}
    interact(n,target,'neutral',1);if((rel?.score||0)>35)n.mood=clamp(n.mood+1,0,100);
  }

  function formFriendships(){
    const candidates=alive().filter(n=>n.age>=13&&n.age<75);
    for(let i=0;i<Math.min(8,candidates.length);i++){
      const n=candidates[Math.floor(Math.random()*candidates.length)],t=chooseTarget(n);if(!t)continue;const r=get(n,t);
      if(compatibility(n,t)>45&&r.familiarity>8&&r.score>20&&trustValue(n,t.id,r)>48&&Math.random()<.18){interact(n,t,'neutral',2);if(r.score>42){n.lastAction=`Became closer to ${t.name}`;t.lastAction=`Became closer to ${n.name}`;}}
    }
  }

  function decay(){
    alive().forEach(n=>(n.relations||[]).forEach(r=>{const age=state.tick-(r.lastTick||state.tick);if(age>40)r.score=clamp(r.score-.015*Math.min(age-40,200));if(age>90)r.familiarity=clamp(r.familiarity-.03,0,100);}));
  }

  function step(){
    if(!state.running)return;
    alive().forEach(n=>{n.relationshipProfile=n.relationshipProfile||{};n.relationshipProfile.sociability=score(n,'sociability');n.relationshipProfile.trust=score(n,'loyalty');n.relationshipProfile.aggression=score(n,'aggression');});
    if(state.tick%4===0)alive().forEach(socialEvent);
    if(state.tick%12===0)formFriendships();
    if(state.tick%24===0)decay();
  }

  window.NPC_RELATIONSHIPS={get,compatibility,interact,socialEvent,formFriendships,step,trustValue};
  if(state.registerSystem)state.registerSystem({name:'relationships',step,priority:60});
})();
