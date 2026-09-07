(() => {
  const state=window.SIM_STATE;if(!state)return;
  const personalityApi=window.NPC_PERSONALITY;
  const planner=window.NPC_PLANNING;
  const role=(n,r)=>n.roleId===r;
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
  function choose(n){
    if(!n.alive||n.age<13)return;
    if(planner){
      const plan=n.currentPlan||planner.plan(n);
      const step=planner.nextStep(n);
      if(plan&&step){
        n.aiDecision={action:step.action,score:plan.score,at:state.tick,planId:plan.id,targetId:step.targetId||null};
        n.goal=plan.goal;
        n.decisionReason=plan.reason;
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
    n.aiDecision={action:pick[0],score:Math.round(pick[2]),at:state.tick};n.goal=pick[1];n.decisionReason=`${pick[0]} has the highest current utility`;
  }
  window.NPC_DECISIONS={choose,personality};
})();
