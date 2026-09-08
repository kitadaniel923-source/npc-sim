(() => {
  const state=window.SIM_STATE;if(!state)return;
  const personalityApi=window.NPC_PERSONALITY;
  const planner=window.NPC_PLANNING;
  const memory=window.NPC_MEMORY;
  const trace=window.NPC_DECISION_TRACE;
  const role=(n,r)=>n.roleId===r;
  const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,v));
  function personality(n){
    if(personalityApi) personalityApi.ensure(n);
    return {
      courage: personalityApi?.score(n,'courage') ?? 50,
      aggression: personalityApi?.score(n,'aggression') ?? 50,
      sociability: personalityApi?.score(n,'sociability') ?? 50,
      risk: personalityApi?.score(n,'risk') ?? 50,
      ambition: personalityApi?.score(n,'ambition') ?? (n.ambition||50),
      discipline: personalityApi?.score(n,'discipline') ?? 50,
      curiosity: personalityApi?.score(n,'curiosity') ?? 50,
      kindness: personalityApi?.score(n,'kindness') ?? 50,
      loyalty: personalityApi?.score(n,'loyalty') ?? (n.loyalty||50)
    };
  }
  function memoryState(n){
    if(memory?.ensure) memory.ensure(n);
    const ids=new Set([...(n.relations||[]).map(r=>r.targetId),...Object.keys(n.grudgeMap||{}),...Object.keys(n.fearMap||{})]);
    let trust=0,fear=0,grudge=0,count=0,bestGrudgeId=null,bestGrudge=-1;
    ids.forEach(id=>{const t=Number(n.trustMap?.[id]||0),f=Number(n.fearMap?.[id]||0),g=Number(n.grudgeMap?.[id]||0);trust+=t;fear+=f;grudge+=g;count++;if(g>bestGrudge){bestGrudge=g;bestGrudgeId=id;}});
    return{avgTrust:count?trust/count:0,avgFear:count?fear/count:0,avgGrudge:count?grudge/count:0,bestGrudgeId,bestGrudge};
  }
  function urgentDecision(n,p,q){
    const danger=state.war&&n.settlementId&&n.safety<35;
    if(n.roleId==='prisoner'&&n.term>0)return{action:'safety',goal:'Survive imprisonment',priority:100,reason:'Prison sentence requires survival'};
    if((n.health??100)<25)return{action:'safety',goal:'Protect health',priority:100,reason:'Health is critically low'};
    if(q.hunger>=88)return{action:'eat',goal:'Find food now',priority:99,reason:`Hunger emergency (${Math.round(q.hunger)})`};
    if(q.thirst>=88)return{action:'drink',goal:'Find water now',priority:99,reason:`Thirst emergency (${Math.round(q.thirst)})`};
    if(q.energy>=90)return{action:'rest',goal:'Recover energy',priority:96,reason:`Severe fatigue (${Math.round(q.energy)})`};
    if(danger)return{action:'safety',goal:'Escape danger',priority:94,reason:'War has made the current area unsafe'};
    if(q.safety>=82)return{action:'safety',goal:'Seek safety',priority:92,reason:`Safety pressure (${Math.round(q.safety)})`};
    return null;
  }
  function reasons(n,pick,q,p,m){
    const why=[];
    const add=(label,value,threshold=12)=>{if(Number(value)>threshold)why.push({label,value:Number(value)});};
    if(pick==='eat')add('hunger pressure',q.hunger*1.8,12);
    if(pick==='drink')add('thirst pressure',q.thirst*1.5,12);
    if(pick==='rest')add('fatigue',q.rest*1.2,12);
    if(pick==='socialize'){add('sociability',p.sociability*.5,12);add('trusted relationships',m.avgTrust*.25,4);}
    if(pick==='belong')add('belonging need',q.belonging+(n.familyId?12:0),12);
    if(pick==='work')add('purpose need',q.purpose,12);
    if(pick==='wealth')add('wealth need',q.wealth,12);add('ambition',p.ambition*.35,12);
    if(pick==='safety'){add('safety pressure',q.safety+(state.war?25:0),12);add('remembered danger',m.avgFear*.55,6);add('risk aversion',(100-p.courage)*.05,2);}
    if(pick==='explore'){add('curiosity',p.curiosity*.45,12);add('risk appetite',p.risk*.15,5);if(m.avgFear<10)add('low remembered fear',8,5);}
    if(pick==='govern')add('political role',role(n,'mayor')||role(n,'king')||role(n,'duke')||role(n,'count')?65+p.ambition:0,12);
    if(pick==='train'){add('war pressure',state.war&&n.age>=16?55+p.aggression*.4:0,12);add('combat temperament',p.courage*.15,5);if(m.avgGrudge>25)add('old grudges',m.avgGrudge*.35,8);}
    if(pick==='study')add('curiosity',p.curiosity*.5,12);
    if(pick==='confront'){add('remembered grievance',m.bestGrudge,20);add('aggression',p.aggression*.3,8);add('courage',p.courage*.22,5);}
    why.sort((a,b)=>b.value-a.value);
    return why.slice(0,3);
  }
  function writeDecision(n,d,source='interrupt'){
    n.aiDecision={action:d.action,score:d.priority,at:state.tick,priority:d.priority,reason:d.reason,targetId:d.targetId||null,interrupted:true};
    n.goal=d.goal;
    n.decisionReason=d.reason;
    n.decisionSource=source;
    n.decisionPriority=d.priority;
    n.decisionWeights={priority:d.priority,reason:d.reason};
    n.decisionInterrupt={active:true,reason:d.reason,startedAt:state.tick,until:state.tick+2};
    trace?.record?.(n,d.reason,source,d.action,d.priority);
  }
  function choose(n){
    if(!n.alive||n.age<13)return;
    const p=personality(n),q=n.needPressure||{},m=memoryState(n);
    const emergency=urgentDecision(n,p,q);
    if(emergency){writeDecision(n,emergency);return;}
    if(n.decisionInterrupt?.active){
      if(state.tick<=n.decisionInterrupt.until)return;
      n.decisionInterrupt.active=false;
    }
    if(planner){
      const plan=n.currentPlan||planner.plan(n);
      const step=planner.nextStep(n);
      if(plan&&step){
        const planPriority=Math.max(20,Number(plan.score)||20);
        if(m.bestGrudge>=65&&p.aggression>45&&p.courage>35){
          writeDecision(n,{action:'confront',goal:'Confront an enemy',priority:planPriority+15,targetId:m.bestGrudgeId,reason:'A strong remembered grudge overrides the current plan'},'memory-interrupt');
          return;
        }
        n.aiDecision={action:step.action,score:plan.score,at:state.tick,planId:plan.id,targetId:step.targetId||null,priority:planPriority,interrupted:false};
        n.goal=plan.goal;
        n.decisionReason=plan.reason;
        n.decisionSource='planning';
        n.decisionPriority=planPriority;
        n.decisionWeights={plan:Number(plan.score)||0,step:1,priority:planPriority,memory:m};
        trace?.record?.(n,plan.reason||`Plan selected: ${plan.goal}`,'planning',step.action,Math.max(1,Number(plan.score)||1));
        return;
      }
    }
    const trait=(t)=>personalityApi?.has(n,t) || n.trait===t;
    const options=[
      ['eat','Find food',q.hunger*1.8+(n.roleId==='farmer'?8:0)],
      ['drink','Find water',q.thirst*1.5],
      ['rest','Rest and recover',q.rest*1.2],
      ['socialize','Spend time with others',q.social+(p.sociability*.5)+m.avgTrust*.25-m.avgGrudge*.18],
      ['belong','Visit family',q.belonging+(n.familyId?12:0)],
      ['work','Work as '+(n.roleName||'Citizen'),q.purpose+(p.discipline*.35)],
      ['wealth','Earn wealth',q.wealth+p.ambition*.35],
      ['safety','Seek safety',q.safety+(state.war?25:0)+(100-p.courage)*.05+m.avgFear*.55],
      ['explore','Explore',18+(p.curiosity*.45)+(p.risk*.15)-m.avgFear*.35],
      ['govern','Govern',role(n,'mayor')||role(n,'king')||role(n,'duke')||role(n,'count')?65+p.ambition:0],
      ['train','Train for combat',state.war&&n.age>=16?55+p.aggression*.4+m.avgGrudge*.25:trait('brave')?18+p.courage*.15+m.avgGrudge*.15:0],
      ['study','Study',p.curiosity*.5+(n.education||0)*.1],
      ['confront','Confront an enemy',m.bestGrudge>=45?p.aggression*.45+p.courage*.3+m.bestGrudge*.85:0]
    ];
    const viable=options.filter(x=>x[2]>0);viable.forEach(x=>x[2]*=(.8+Math.random()*.4));viable.sort((a,b)=>b[2]-a[2]);
    const pick=viable[0];if(!pick)return;
    const why=reasons(n,pick[0],q,p,m);
    const reasonText=why.length?why.map(x=>`${x.label} ${Math.round(x.value)}`).join(', '):`${pick[0]} has the highest current utility`;
    const targetId=pick[0]==='confront'?m.bestGrudgeId:null;
    const priority=Math.max(20,Math.round(pick[2]));
    n.aiDecision={action:pick[0],score:priority,at:state.tick,priority,influences:why,targetId,interrupted:false};
    n.goal=pick[1];
    n.decisionReason=reasonText;
    n.decisionSource=pick[0]==='confront'?'memory':'decision-engine';
    n.decisionPriority=priority;
    n.decisionWeights={utility:priority,influences:why,priority,memory:m};
    trace?.record?.(n,reasonText,n.decisionSource,pick[0],pick[2]);
  }
  window.NPC_DECISIONS={choose,personality,urgentDecision,memoryState};
  if(state.registerSystem)state.registerSystem({name:'decision-engine',step:()=>{},priority:55});
})();
