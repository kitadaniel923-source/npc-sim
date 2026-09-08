(() => {
  const state=window.SIM_STATE;
  const personality=window.NPC_PERSONALITY;
  const memory=window.NPC_MEMORY;
  if(!state)return;

  const clamp=(v,a=-100,b=100)=>Math.max(a,Math.min(b,v));
  const alive=()=> (state.npcs||[]).filter(n=>n.alive);
  const score=(n,k)=>personality?.score(n,k)??50;
  const has=(n,t)=>personality?.has(n,t)||n.trait===t;
  const relation=(n,id)=>(n?.relations||[]).find(r=>r.targetId===id);
  const budget=()=>window.SIM_BUDGET;
  const familyRelation=(a,b)=>{
    if(!a||!b)return 0;
    if(a.spouseId===b.id||a.partnerId===b.id)return 100;
    if((a.parentIds||[]).includes(b.id)||(b.parentIds||[]).includes(a.id))return 92;
    if((a.childrenIds||[]).includes(b.id)||(b.childrenIds||[]).includes(a.id))return 92;
    if(a.familyId&&a.familyId===b.familyId)return 68;
    return 0;
  };

  function get(a,b,create=true){
    if(!a||!b||a.id===b.id)return null;
    a.relations=a.relations||[];
    let r=a.relations.find(x=>x.targetId===b.id);
    if(!r&&create){r={targetId:b.id,type:'acquaintance',score:0,lastTick:state.tick,trust:50,respect:50,familiarity:0,interactions:0,positive:0,negative:0};a.relations.push(r)}
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
    const kin=familyRelation(a,b);
    return clamp(similarity*.45+chemistry-25+kin*.08,-100,100);
  }

  function trustValue(n,targetId,r){
    const memoryTrust=memory?.trust?.(n,targetId)??50;
    const fear=memory?.fear?.(n,targetId)??0;
    const grudge=memory?.grudge?.(n,targetId)??0;
    const familiarityBoost=Math.min(10,(r?.familiarity||0)*.08);
    return clamp(memoryTrust*.5+(r?.trust??50)*.5+familiarityBoost-fear*.25-grudge*.15,0,100);
  }

  function interact(a,b,context='neutral',intensity=1){
    if(!a||!b||!a.alive||!b.alive||a.id===b.id)return null;
    const r=get(a,b),q=get(b,a),base=compatibility(a,b),kin=familyRelation(a,b);
    const rememberedTrust=trustValue(a,b.id,r);
    let delta=base*.025*intensity;
    if(kin>=90)delta+=3*intensity;
    else if(kin>=60)delta+=1.2*intensity;
    if(context==='help')delta+=score(a,'kindness')*.05;
    if(context==='trade')delta+=(score(a,'cleverness')||50)*.025+score(a,'sociability')*.02;
    if(context==='military')delta+=score(a,'loyalty')*.04+score(a,'courage')*.02;
    if(context==='insult')delta-=score(b,'stubborn')*.05+score(b,'aggression')*.03;
    if(context==='betrayal')delta-=22+score(b,'loyalty')*.18;
    if(context==='shared_danger')delta+=score(a,'courage')*.06+score(b,'courage')*.04;
    delta*=0.55+rememberedTrust/200;
    r.score=clamp(r.score+delta);q.score=clamp(q.score+delta*.8);
    r.familiarity=clamp(r.familiarity+.6*intensity+kin*.008,0,100);q.familiarity=r.familiarity;
    r.trust=clamp(r.trust+delta*.55,0,100);q.trust=clamp(q.trust+delta*.45,0,100);
    r.respect=clamp(r.respect+(base>0?Math.abs(delta)*.35:-Math.abs(delta)*.18),0,100);
    q.respect=clamp(q.respect+(base>0?Math.abs(delta)*.28:-Math.abs(delta)*.14),0,100);
    r.interactions=(r.interactions||0)+1;q.interactions=(q.interactions||0)+1;
    if(delta>=0){r.positive=(r.positive||0)+1;q.positive=(q.positive||0)+1;} else {r.negative=(r.negative||0)+1;q.negative=(q.negative||0)+1;}
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
    if(a.spouseId===b.id||a.partnerId===b.id){r.type='spouse';return;}
    if((a.parentIds||[]).includes(b.id)||(a.childrenIds||[]).includes(b.id)){r.type=a.parentIds?.includes(b.id)?'child':'parent';return;}
    if(a.familyId&&a.familyId===b.familyId&&r.score>=35&&trust>=52){r.type='family';return;}
    if(r.score>=72&&trust>=68)r.type='best_friend'; else if(r.score>=42&&trust>=55)r.type='friend'; else if(r.score>=18)r.type='ally'; else if(r.score<=-72&&trust<32)r.type='sworn_enemy'; else if(r.score<=-42||trust<25)r.type='enemy'; else if(r.score<=-18)r.type='rival'; else r.type='acquaintance';
  }

  function chooseTarget(n){
    const cached=state.getNpc;
    const peers=alive().filter(x=>x.id!==n.id&&x.settlementId===n.settlementId&&Math.abs(x.age-n.age)<35);
    if(!peers.length)return null;
    return peers.sort((a,b)=>{
      const rb=relation(n,b.id),ra=relation(n,a.id),kinA=familyRelation(n,a),kinB=familyRelation(n,b);
      const affA=(ra?.score||0)+kinA*.5+(ra?.familiarity||0)*.12;
      const affB=(rb?.score||0)+kinB*.5+(rb?.familiarity||0)*.12;
      return affB-affA;
    })[Math.floor(Math.random()*Math.min(6,peers.length))]||peers[0];
  }

  function socialEvent(n){
    if(!n.alive||n.age<13)return;
    const target=chooseTarget(n);if(!target)return;
    const rel=get(n,target);const p={social:score(n,'sociability'),kind:score(n,'kindness'),loyal:score(n,'loyalty'),aggression:score(n,'aggression'),ambition:score(n,'ambition'),risk:score(n,'risk')};
    const kin=familyRelation(n,target);
    if(kin>=90&&Math.random()<.22){interact(n,target,'help',1.5);n.mood=clamp(n.mood+2,0,100);n.lastAction=`Spent time with ${target.name}`;return;}
    if(p.kind>70&&target.wealth<n.wealth*.45&&Math.random()<.18){interact(n,target,'help',1.4);n.wealth=Math.max(0,n.wealth-2);target.wealth+=2;n.mood=clamp(n.mood+3,0,100);target.mood=clamp(target.mood+4,0,100);n.lastAction=`Helped ${target.name}`;target.lastAction=`Received help from ${n.name}`;return;}
    if(p.aggression>72&&(rel?.score||0)<20&&kin<60&&Math.random()<.12){interact(n,target,'insult',1.3);n.grievance=clamp((n.grievance||0)+4,0,100);target.grievance=clamp((target.grievance||0)+5,0,100);n.lastAction=`Confronted ${target.name}`;target.lastAction=`Was confronted by ${n.name}`;return;}
    if(p.loyal>70&&state.war&&target.faction===n.faction&&Math.random()<.2){interact(n,target,'military',1.2);n.lastAction=`Coordinated with ${target.name}`;return;}
    if(p.ambition>70&&target.classTier==='noble'&&Math.random()<.16){interact(n,target,'trade',1.1);n.influence=(n.influence||0)+.2;n.lastAction=`Built a political connection with ${target.name}`;return;}
    interact(n,target,'neutral',1);if((rel?.score||0)>35)n.mood=clamp(n.mood+1,0,100);
  }

  function formFriendships(){
    const candidates=alive().filter(n=>n.age>=13&&n.age<75);
    const sample=budget()?.npcBatch?Math.min(12,Math.max(4,Math.ceil(budget().npcBatch/16))):8;
    for(let i=0;i<Math.min(sample,candidates.length);i++){
      const n=candidates[Math.floor(Math.random()*candidates.length)],t=chooseTarget(n);if(!t)continue;const r=get(n,t);
      if(compatibility(n,t)>45&&r.familiarity>8&&r.score>20&&trustValue(n,t.id,r)>48&&Math.random()<.18){interact(n,t,'neutral',2);if(r.score>42){n.lastAction=`Became closer to ${t.name}`;t.lastAction=`Became closer to ${n.name}`;}}
    }
  }

  function decay(){
    const list=budget()?.npcBatch?alive().slice(0,budget().npcBatch):alive();
    list.forEach(n=>(n.relations||[]).forEach(r=>{const age=state.tick-(r.lastTick||state.tick);const target=state.getNpc?r && state.getNpc(r.targetId):state.npcs.find(x=>x.id===r.targetId);const kin=(n.familyId&&target?.familyId===n.familyId)?1:0;if(age>40)r.score=clamp(r.score-.015*Math.min(age-40,200)+kin*.006);if(age>90)r.familiarity=clamp(r.familiarity-.03,0,100);if(age>150&&!kin)r.trust=clamp((r.trust||50)-.01,0,100);}));
  }

  function step(){
    if(!state.running)return;
    if(state.tick%6===0){
      const batch=budget()?.npcBatch?budget().npcBatch:alive().length;
      const people=alive();
      const start=(Math.floor(state.tick/6)*batch)%Math.max(1,people.length);
      people.slice(start,start+batch).forEach(n=>{n.relationshipProfile=n.relationshipProfile||{};n.relationshipProfile.sociability=score(n,'sociability');n.relationshipProfile.trust=score(n,'loyalty');n.relationshipProfile.aggression=score(n,'aggression');n.relationshipProfile.familyAttachment=n.familyId?68:0;socialEvent(n);});
    }
    if(state.tick%12===0)formFriendships();
    if(state.tick%24===0&&(!budget()?.shouldRun||budget().shouldRun('relationship',2)))decay();
  }

  window.NPC_RELATIONSHIPS={get,compatibility,interact,socialEvent,formFriendships,step,trustValue,familyRelation};
  if(state.registerSystem)state.registerSystem({name:'relationships',step,priority:60});
})();