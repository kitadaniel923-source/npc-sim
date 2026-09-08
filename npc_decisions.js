(() => {
  const state=window.SIM_STATE;if(!state)return;
  const personalityApi=window.NPC_PERSONALITY;
  const planner=window.NPC_PLANNING;
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
  function reasons(n, pick, q, p){
    const why=[];
    const add=(label,value,threshold=12)=>{if(Number(value)>threshold)why.push({label,value:Number(value)});};
    if(pick==='eat')add('hunger pressure',q.hunger*1.8,12);
    if(pick==='drink')add('thirst pressure',q.thirst*1.5,12);
    if(pick==='rest')add('fatigue',q.rest*1.2,12);
    if(pick==='socialize')add('sociability',p.sociability*.5,12);
    if(pick==='belong')add('belonging need',q.belonging+(n.familyId?12:0),12);
    if(pick==='work')add('purpose need',q.purpose,12);
    if(pick==='wealth')add('wealth need',q.wealth,12);add('ambition',p.ambition*.35,12);
    if(pick==='safety')add('safety pressure',q.safety+(state.war?25:0),12);add('risk aversion',(100-p.courage)*.05,2);
    if(pick==='explore')add('curiosity',p.curiosity*.45,12);add('risk appetite',p.risk*.15,5);
    if(pick==='govern')add('political role',role(n,'mayor')||role(n,'king')||role(n,'duke')||role(n,'count')?65+p.ambition:0,12);
    if(pick==='train')add('war pressure',state.war&&n.age>=16?55+p.aggression*.4:0,12);add('combat temperament',p.courage*.15,5);
    if(pick==='study')add('curiosity',p.curiosity*.5,12);
    why.sort((a,b)=>b.value-a.value);
    return why.slice(0,3);
  }
  function choose(n){
    if(!n.alive||n.age<13)return;
    if(planner){
      const plan=n.currentPlan||planner.plan(n);
      const step=planner.nextStep(n);
      if(plan&&step){
        n.aiDecision={action:step.action,score:plan.score,at:state.tick,planId:plan.id,targetId:step.targetId||null};
        n.goal=plan.goal;
        n.decisionReason=plan.reason;
        n.decisionSource='planning';
        n.decisionWeights={plan:Number(plan.score)||0,step:1};
        trace?.record?.(n,plan.reason||`Plan selected: ${plan.goal}`, 'planning', step.action, Math.max(1,Number(plan.score)||1));
        return;
      }
    }
    const p=personality(n),q=n.needPressure||{};
    const trait=(t)=>personalityApi?.has(n,t) || n.trait===t;
    const options=[
      ['eat','Find food',q.hunger*1.8+(n.roleId==='farmer'?8:0)],
      ['drink','Find water',q.thirst*1.5],
      ['rest','Rest and recover',q.rest*1.2],
      ['socialize','Spend time with others',q.social+(p.sociability*.5)],
      ['belong','Visit family',q.belonging+(n.familyId?12:0)],
      ['work','Work as '+(n.roleName||'Citizen'),q.purpose+(p.discipline*.35)],
      ['wealth','Earn wealth',q.wealth+p.ambition*.35],
      ['safety','Seek safety',q.safety+(state.war?25:0)+(100-p.courage)*.05],
      ['explore','Explore',18+(p.curiosity*.45)+(p.risk*.15)],
      ['govern','Govern',role(n,'mayor')||role(n,'king')||role(n,'duke')||role(n,'count')?65+p.ambition:0],
      ['train','Train for combat',state.war&&n.age>=16?55+p.aggression*.4:trait('brave')?18+p.courage*.15:0],
      ['study','Study',p.curiosity*.5+(n.education||0)*.1]
    ];
    const viable=options.filter(x=>x[2]>0);viable.forEach(x=>x[2]*=(.8+Math.random()*.4));viable.sort((a,b)=>b[2]-a[2]);
    const pick=viable[0];if(!pick)return;
    const why=reasons(n,pick[0],q,p);
    const reasonText=why.length?why.map(x=>`${x.label} ${Math.round(x.value)}`).join(', '):`${pick[0]} has the highest current utility`;
    n.aiDecision={action:pick[0],score:Math.round(pick[2]),at:state.tick,influences:why};
    n.goal=pick[1];
    n.decisionReason=reasonText;
    n.decisionSource='decision-engine';
    n.decisionWeights={utility:Math.round(pick[2]),influences:why};
    trace?.record?.(n,reasonText,'decision-engine',pick[0],pick[2]);
  }
  window.NPC_DECISIONS={choose,personality};
  if(state.registerSystem)state.registerSystem({name:'decision-engine',step:()=>{},priority:55});
})();
