(() => {
  const state = window.SIM_STATE;
  if (!state) return;

  const clamp = (v,a=0,b=100) => Math.max(a,Math.min(b,v));
  const personality = () => window.NPC_PERSONALITY;
  const memory = () => window.NPC_MEMORY;
  const relationships = () => window.NPC_RELATIONSHIPS;
  const goals = () => window.NPC_GOALS;

  function score(n,key){ return personality()?.score(n,key) ?? 50; }
  function trust(n,id){
    const rel = relationships()?.get(n,state.npcs.find(x=>x.id===id),false);
    return relationships()?.trustValue(n,id,rel) ?? memory()?.trust(n,id) ?? 50;
  }

  function localPeers(n){
    return (state.npcs||[]).filter(x=>x.alive&&x.id!==n.id&&x.settlementId===n.settlementId);
  }

  function bestFoodSource(n){
    const s = state.settlements?.find(x=>x.id===n.settlementId);
    if (s && (s.resources?.food||0)>0) return {type:'settlement',targetId:s.id,label:s.name};
    return null;
  }

  function bestSocialTarget(n){
    const peers = localPeers(n)
      .map(x=>({x,fit:(relationships()?.compatibility(n,x)??0)+(trust(n,x.id)-50)*.35}))
      .sort((a,b)=>b.fit-a.fit);
    return peers[0]?.x||null;
  }

  function bestEconomicTarget(n){
    const peers = localPeers(n).filter(x=>x.roleId==='merchant'||x.roleId==='trader')
      .sort((a,b)=>(b.reputation||50)-(a.reputation||50));
    return peers[0]||null;
  }

  function context(n){
    const p={
      courage:score(n,'courage'), aggression:score(n,'aggression'), sociability:score(n,'sociability'),
      risk:score(n,'risk'), ambition:score(n,'ambition'), discipline:score(n,'discipline'),
      curiosity:score(n,'curiosity'), kindness:score(n,'kindness'), loyalty:score(n,'loyalty')
    };
    return {
      p,
      hunger:n.needs?.hunger||n.hunger||0,
      thirst:n.needs?.thirst||20,
      fatigue:100-(n.needs?.energy??n.energy??80),
      danger:100-(n.needs?.safety??75),
      loneliness:n.needs?.social||45,
      belonging:n.needs?.belonging||50,
      wealthNeed:n.needs?.wealth||40,
      purpose:n.needs?.purpose||45,
      war:!!state.war,
      food:bestFoodSource(n)
    };
  }

  function candidatePlans(n){
    const c=context(n), p=c.p;
    const plans=[];

    plans.push({
      id:'survive_hunger',
      goal:'Secure food',
      utility:c.hunger*2.3 + (n.roleId==='farmer'?10:0) + p.discipline*.12,
      steps:[{action:'eat',label:'Find food'},{action:'work',label:'Produce or earn food'}]
    });
    plans.push({
      id:'recover',
      goal:'Recover energy',
      utility:c.fatigue*1.8 + 100-p.discipline*.15,
      steps:[{action:'rest',label:'Rest and recover'},{action:'work',label:'Return to work'}]
    });
    plans.push({
      id:'secure_safety',
      goal:'Get somewhere safe',
      utility:c.danger*1.9 + (c.war?20:0) + (100-p.courage)*.12,
      steps:[{action:'safety',label:'Seek safety'},{action:'socialize',label:'Stay near trusted people'}]
    });
    const socialTarget=bestSocialTarget(n);
    plans.push({
      id:'build_bonds',
      goal:'Strengthen relationships',
      utility:c.loneliness*1.25 + p.sociability*.75 + p.kindness*.18,
      steps:[{action:'socialize',label:socialTarget?`Talk with ${socialTarget.name}`:'Spend time with others',targetId:socialTarget?.id||null},{action:'belong',label:'Reinforce belonging'}]
    });
    const merchant=bestEconomicTarget(n);
    plans.push({
      id:'improve_wealth',
      goal:'Improve wealth',
      utility:c.wealthNeed*1.45 + p.ambition*.65 + p.risk*.12,
      steps:[{action:'wealth',label:'Earn income',targetId:merchant?.id||null},{action:'trade',label:merchant?`Trade with ${merchant.name}`:'Look for a profitable exchange',targetId:merchant?.id||null}]
    });
    plans.push({
      id:'advance_purpose',
      goal:'Develop skills and purpose',
      utility:c.purpose*1.15 + p.curiosity*.7 + p.ambition*.35 + p.discipline*.2,
      steps:[
        {action:p.curiosity>58?'study':'work',label:p.curiosity>58?'Learn something useful':`Work as ${n.roleName||'Citizen'}`},
        {action:p.curiosity>65?'explore':'train',label:p.curiosity>65?'Explore for opportunity':'Build useful skills'}
      ]
    });
    if(c.war){
      plans.push({
        id:'serve_realm',
        goal:'Support the realm',
        utility:30+p.loyalty*.75+p.courage*.55+p.aggression*.18,
        steps:[{action:p.courage>55?'train':'safety',label:p.courage>55?'Prepare for war':'Stay behind the lines'},{action:'socialize',label:'Coordinate with allies'}]
      });
    }

    const goalApi=goals();
    if(goalApi?.scoreAction){
      plans.forEach(x=>{
        const first=x.steps?.[0]?.action;
        const second=x.steps?.[1]?.action;
        x.utility += goalApi.scoreAction(n,first)*1.6 + goalApi.scoreAction(n,second)*.65;
      });
    }
    return plans;
  }

  function plan(n){
    if(!n?.alive||n.age<13) return null;
    const plans=candidatePlans(n).filter(x=>x.utility>0);
    plans.forEach(x=>{
      x.utility*=0.92+Math.random()*.16;
      if(n.currentPlan?.id===x.id) x.utility+=6;
    });
    plans.sort((a,b)=>b.utility-a.utility);
    const best=plans[0];
    if(!best) return null;
    const previous=n.currentPlan?.id;
    const longTerm=goals()?.refresh?.(n);
    const reason=`${best.goal} scored highest from current needs, personality, stakes and world conditions`;
    n.currentPlan={
      id:best.id,
      goal:best.goal,
      steps:best.steps.slice(),
      createdAt:state.tick,
      score:Math.round(best.utility),
      reason,
      previous,
      alignedGoalId:longTerm?.id||null
    };
    n.planHistory=n.planHistory||[];
    if(previous && previous!==best.id) n.planHistory.unshift({tick:state.tick,from:previous,to:best.id,reason});
    n.planHistory=n.planHistory.slice(0,12);
    return n.currentPlan;
  }

  function nextStep(n){
    if(!n.currentPlan?.steps?.length) return null;
    return n.currentPlan.steps[0];
  }

  function completeStep(n,action){
    if(!n.currentPlan?.steps?.length) return;
    if(n.currentPlan.steps[0].action===action) n.currentPlan.steps.shift();
    if(!n.currentPlan.steps.length){
      n.lastCompletedPlan={id:n.currentPlan.id,goal:n.currentPlan.goal,tick:state.tick};
      window.NPC_GOALS?.recordOutcome?.(n,true,`Completed short-term plan: ${n.currentPlan.goal}`);
      n.currentPlan=null;
    }
  }

  function fail(n,reason){
    if(!n.currentPlan)return;
    n.planFailure={tick:state.tick,reason};
    window.NPC_GOALS?.recordOutcome?.(n,false,reason);
    n.currentPlan=null;
    memory()?.remember(n,`My plan failed: ${reason}.`,'planning',2,null,'frustration');
  }

  function step(){
    if(!state.running) return;
    const alive=(state.npcs||[]).filter(n=>n.alive&&n.age>=13);
    alive.forEach(n=>{
      if(!n.currentPlan || state.tick-(n.currentPlan.createdAt||0)>18) plan(n);
      const s=nextStep(n);
      if(s){
        n.aiPlanAction=s.action;
        n.aiPlanTarget=s.targetId||null;
      }
      if(n.longTermGoal) n.goalStakes=n.longTermGoal.stakes||[];
    });
    if(state.tick%60===0){
      alive.forEach(n=>{ if(n.planHistory?.length>1) n.planHistory=n.planHistory.slice(0,8); });
    }
  }

  window.NPC_PLANNING={plan,nextStep,completeStep,fail,candidatePlans,step};
  if(state.registerSystem) state.registerSystem({name:'planning',step,priority:45});
})();
