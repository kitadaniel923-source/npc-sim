(() => {
  const state = window.SIM_STATE;
  if (!state) return;

  const personality = window.NPC_PERSONALITY;
  const memory = window.NPC_MEMORY;
  const relationships = window.NPC_RELATIONSHIPS;
  const clamp = (v,a=0,b=100)=>Math.max(a,Math.min(b,v));
  const alive = () => (state.npcs||[]).filter(n=>n.alive);
  const score = (n,k) => personality?.score(n,k) ?? 50;
  const has = (n,t) => personality?.has(n,t) || n.trait===t;
  const log = text => { if(typeof window.SIM_LOG==='function') window.SIM_LOG(text); else state.feed?.unshift(`Year ${state.year}, Day ${state.day}: ${text}`); };

  const TYPES = {
    theft:{name:'theft',severity:1,base:.006,value:5},
    fraud:{name:'fraud',severity:1.5,base:.004,value:12},
    smuggling:{name:'smuggling',severity:2,base:.003,value:18},
    assault:{name:'assault',severity:2.5,base:.0025,value:0},
    robbery:{name:'robbery',severity:3,base:.002,value:25},
    murder:{name:'murder',severity:5,base:.00045,value:0}
  };

  function ensure(n){
    n.crimeHeat = n.crimeHeat ?? 0;
    n.crimes = n.crimes ?? 0;
    n.arrests = n.arrests ?? 0;
    n.term = n.term ?? 0;
    n.criminalRecord = Array.isArray(n.criminalRecord) ? n.criminalRecord : [];
    n.wanted = !!n.wanted;
  }

  function law(n){
    const k = state.kingdoms?.find(x=>x.id===n.faction);
    return k?.law || {crimePenalty:24,bribeBase:12};
  }

  function crimeChance(n,t){
    ensure(n);
    const c=TYPES[t];
    let chance=c.base;
    if(has(n,'criminal'))chance*=3;
    if(has(n,'deceptive'))chance*=2;
    if(has(n,'greedy'))chance*=1.7;
    if(has(n,'reckless'))chance*=1.6;
    if(has(n,'kind')||has(n,'honest'))chance*=.35;
    if(score(n,'risk')>70)chance*=1.8;
    if(score(n,'aggression')>70&&['assault','robbery','murder'].includes(t))chance*=1.7;
    if(score(n,'kindness')>75)chance*=.45;
    if((n.wealth||0)<10)chance*=1.8;
    if((n.grievance||0)>60)chance*=1.35;
    if((n.crimeHeat||0)>40)chance*=.75;
    return chance;
  }

  function chooseVictim(offender,type){
    const options=alive().filter(v=>v.id!==offender.id&&v.settlementId===offender.settlementId);
    if(!options.length)return null;
    return options
      .map(v=>({v,weight:Math.max(.1,(v.wealth||0)+((type==='assault'||type==='murder')?20:0))}))
      .sort((a,b)=>b.weight-a.weight).slice(0,8)
      .sort(()=>Math.random()-.5)[0]?.v || options[0];
  }

  function witnessFor(offender,victim){
    return alive().filter(n=>n.id!==offender.id&&n.id!==victim?.id&&n.settlementId===offender.settlementId&&Math.hypot(n.x-offender.x,n.y-offender.y)<140)
      .sort((a,b)=>score(b,'observant')-score(a,'observant'))[0] || null;
  }

  function commit(offender,type){
    ensure(offender);
    const cfg=TYPES[type];
    if(!cfg||!offender.alive)return null;
    const victim=chooseVictim(offender,type);
    if(!victim && type!=='smuggling')return null;
    const witness=witnessFor(offender,victim);
    const value=cfg.value?Math.min(victim?.wealth||0,cfg.value+Math.random()*cfg.value):0;
    if(value && victim){victim.wealth=Math.max(0,victim.wealth-value);offender.wealth=(offender.wealth||0)+value;}
    offender.crimes++;
    offender.crimeHeat=clamp(offender.crimeHeat+cfg.severity*8);
    offender.criminalRecord.unshift({year:state.year,type,victimId:victim?.id||null,witnessId:witness?.id||null,value});
    offender.criminalRecord=offender.criminalRecord.slice(0,20);
    if(['robbery','assault','murder','smuggling'].includes(type)) offender.wanted=true;

    const crime={id:`crime_${state.tick}_${offender.id}_${Math.random().toString(36).slice(2)}`,year:state.year,day:state.day,type,offenderId:offender.id,victimId:victim?.id||null,witnessIds:witness?[witness.id]:[],status:'reported',value,severity:cfg.severity,locationId:offender.settlementId};
    state.crimes=state.crimes||[];state.crimes.push(crime);state.crimes=state.crimes.slice(-250);

    if(victim){
      victim.grievance=clamp((victim.grievance||0)+cfg.severity*8);
      memory?.experience(victim,`${offender.name} committed ${type} against me.`,'crime',Math.min(5,cfg.severity),offender.id,'anger',cfg.severity*2,type==='murder');
      relationships?.interact(victim,offender,'insult',Math.min(2,cfg.severity));
    }
    if(witness) memory?.experience(witness,`I witnessed ${offender.name} commit ${type}.`,'witness',3,witness.id==='__none__'?null:offender.id,'fear',2);
    memory?.experience(offender,`I committed ${type}.`,'crime',cfg.severity, victim?.id||null,'pride',1);
    offender.lastAction=`Committed ${type}`;
    log(`${offender.name} committed ${type}${victim?` against ${victim.name}`:''}.`);
    return crime;
  }

  function investigate(crime){
    if(!crime||crime.status!=='reported')return;
    const offender=state.npcs.find(n=>n.id===crime.offenderId);
    const witnessIds=crime.witnessIds||[];
    let evidence=.25+(witnessIds.length*.18);
    if(offender){
      evidence += Math.min(.3,(offender.crimeHeat||0)/300);
      if(score(offender,'cleverness')>70)evidence-=.12;
      if(has(offender,'deceptive'))evidence-=.1;
    }
    if(Math.random()<clamp(evidence,0,0.92)) crime.status='charged';
    else crime.status='unsolved';
  }

  function trial(crime){
    if(!crime||crime.status!=='charged')return;
    const offender=state.npcs.find(n=>n.id===crime.offenderId&&n.alive);
    if(!offender){crime.status='closed';return;}
    const k=state.kingdoms?.find(x=>x.id===offender.faction);
    const lawPenalty=(k?.law?.crimePenalty||24);
    let guilt=.55+(crime.severity*.06)+(crime.witnessIds?.length||0)*.08;
    guilt -= has(offender,'honest')?.05:0;
    guilt += score(offender,'cleverness')>80?-.08:0;
    guilt=clamp(guilt,0,1);
    if(Math.random()>guilt){crime.status='acquitted';offender.lastAction='Was acquitted';return;}
    const fine=Math.min(offender.wealth*.35,lawPenalty*crime.severity*.7+crime.value*.5);
    offender.wealth=Math.max(0,offender.wealth-fine);
    offender.arrests++;
    offender.term=Math.max(offender.term,Math.ceil(crime.severity*1.5));
    offender.wanted=false;
    offender.reputation=clamp((offender.reputation||50)-crime.severity*5);
    offender.grievance=clamp((offender.grievance||0)+crime.severity);
    crime.status='convicted';
    crime.sentence={fine,term:offender.term,year:state.year};
    memory?.experience(offender,`I was convicted of ${crime.type}.`,'justice',3.5,null,'anger',2);
    log(`${offender.name} was convicted of ${crime.type} and sentenced to ${offender.term} years.`);
  }

  function justiceStep(){
    for(const c of state.crimes||[]){
      if(c.status==='reported'&&state.tick%12===0)investigate(c);
      if(c.status==='charged'&&state.tick%18===0)trial(c);
      if(c.status==='unsolved'&&state.tick%36===0){
        c.status='cold';
        const v=c.victimId?state.npcs.find(n=>n.id===c.victimId):null;
        if(v)memory?.experience(v,`The ${c.type} case went unsolved.`,'justice',2,c.offenderId,'anger',2);
      }
      if(c.status==='convicted'){
        const o=state.npcs.find(n=>n.id===c.offenderId);
        if(o&&o.term>0&&state.tick%30===0)o.term=Math.max(0,o.term-1);
        if(o&&o.term===0)o.lastAction='Returned from prison';
      }
    }
  }

  function revengeStep(){
    if(state.tick%24!==0)return;
    alive().filter(n=>(n.grievance||0)>68).forEach(v=>{
      const enemies=state.crimes?.filter(c=>c.victimId===v.id&&['reported','unsolved','cold'].includes(c.status))||[];
      const targetId=enemies[0]?.offenderId;
      const target=targetId?state.npcs.find(n=>n.id===targetId&&n.alive):null;
      if(!target)return;
      const revenge=score(v,'aggression')*.004+score(v,'risk')*.003+((v.crimes||0)>0?.002:0);
      if(Math.random()<revenge){
        if(score(v,'kindness')<35) commit(v,score(v,'aggression')>82?'assault':'robbery');
        v.lastAction=`Sought revenge against ${target.name}`;
        memory?.experience(v,`${target.name} is responsible for my suffering.`,'revenge',3.8,target.id,'anger',8,true);
      }
    });
  }

  function offenderStep(){
    if(state.tick%18!==0)return;
    alive().filter(n=>n.age>=16&&n.term===0).forEach(n=>{
      const choices=['theft','fraud','smuggling','assault','robbery'];
      if(score(n,'aggression')>82&&score(n,'risk')>70)choices.push('murder');
      const viable=choices.map(t=>({type:t,chance:crimeChance(n,t)})).sort((a,b)=>b.chance-a.chance);
      const pick=viable[0];
      if(pick&&Math.random()<pick.chance)commit(n,pick.type);
    });
  }

  function step(){
    if(!state.running)return;
    alive().forEach(ensure);
    offenderStep();
    justiceStep();
    revengeStep();
    alive().forEach(n=>{if(n.crimeHeat>0)n.crimeHeat=Math.max(0,n.crimeHeat-.08*state.speed);});
  }

  window.NPC_CRIME={TYPES,commit,investigate,trial,step};
  if(state.registerSystem)state.registerSystem({name:'crime',step,priority:80});
})();
