(() => {
  const state = window.SIM_STATE;
  if (!state) return;

  const clamp = (v,a=0,b=100) => Math.max(a,Math.min(b,v));
  const personality = n => window.NPC_PERSONALITY?.score ? {
    courage:window.NPC_PERSONALITY.score(n,'courage'),
    aggression:window.NPC_PERSONALITY.score(n,'aggression'),
    sociability:window.NPC_PERSONALITY.score(n,'sociability'),
    ambition:window.NPC_PERSONALITY.score(n,'ambition'),
    discipline:window.NPC_PERSONALITY.score(n,'discipline'),
    curiosity:window.NPC_PERSONALITY.score(n,'curiosity'),
    kindness:window.NPC_PERSONALITY.score(n,'kindness'),
    loyalty:window.NPC_PERSONALITY.score(n,'loyalty'),
    risk:window.NPC_PERSONALITY.score(n,'risk'),
    cleverness:window.NPC_PERSONALITY.score(n,'cleverness')
  } : {courage:50,aggression:50,sociability:50,ambition:50,discipline:50,curiosity:50,kindness:50,loyalty:50,risk:50,cleverness:50};

  const alive = () => (state.npcs||[]).filter(n=>n.alive);
  const kingdom = n => (state.kingdoms||[]).find(k=>k.id===n.faction) || null;
  const family = n => (state.families||[]).find(f=>f.id===n.familyId) || null;
  const settlement = n => (state.settlements||[]).find(s=>s.id===n.settlementId) || null;
  const kinCount = n => n.familyId ? alive().filter(x=>x.familyId===n.familyId&&x.id!==n.id).length : 0;

  function goalTemplates(n) {
    const p = personality(n);
    const k = kingdom(n);
    const f = family(n);
    const s = settlement(n);
    const goals = [];

    goals.push({id:'survive',label:'Survive and remain secure',weight:45 + (100-p.courage)*.18,category:'survival',actions:{safety:1.2,eat:1,rest:.8}});

    if (kinCount(n) > 0 || f) {
      goals.push({id:'family',label:'Protect and strengthen my family',weight:18 + kinCount(n)*2 + p.kindness*.25 + p.loyalty*.25,category:'family',actions:{belong:1.25,help:1,socialize:.65,wealth:.55}});
    }

    if (p.ambition > 58 || ['mayor','baron','count','duke','king','heir','rebel'].includes(n.roleId)) {
      goals.push({id:'status',label:'Rise in status and influence',weight:22 + p.ambition*.55,category:'status',actions:{govern:1.25,work:.45,wealth:.6,belong:.35,train:.2}});
    }

    if (n.roleId==='merchant' || n.roleId==='trader' || p.ambition>62 || p.cleverness>65) {
      goals.push({id:'prosperity',label:'Build wealth and economic security',weight:20 + p.cleverness*.32 + p.ambition*.18,category:'wealth',actions:{wealth:1.35,trade:1.15,work:.55,explore:.35}});
    }

    if (p.curiosity > 58 || ['scholar','teacher','mage','wizard','alchemist','enchanter'].includes(n.roleId)) {
      goals.push({id:'knowledge',label:'Gain knowledge and mastery',weight:18 + p.curiosity*.55,category:'knowledge',actions:{study:1.35,explore:.85,work:.45}});
    }

    if (p.sociability > 58 || p.kindness > 62) {
      goals.push({id:'belonging',label:'Build lasting relationships',weight:16 + p.sociability*.42 + p.kindness*.18,category:'social',actions:{socialize:1.25,belong:1.1,help:.9}});
    }

    if (p.courage > 58 || p.aggression > 58 || ['soldier','archer','spearman','knight','cavalry','captain','general','marshal'].includes(n.roleId)) {
      goals.push({id:'glory',label:'Earn honor through courage and service',weight:18 + p.courage*.32 + p.aggression*.24,category:'honor',actions:{train:1.3,confront:1.1,serve_realm:1.2,safety:.2}});
    }

    if (n.grievance>35 || p.aggression>72 || p.risk>72) {
      goals.push({id:'revenge',label:'Settle old grievances',weight:12 + (n.grievance||0)*.55 + p.aggression*.18,category:'conflict',actions:{confront:1.45,train:.55,wealth:.15}});
    }

    if (p.curiosity>68 && p.risk>45) {
      goals.push({id:'discovery',label:'Discover new lands and opportunities',weight:16 + p.curiosity*.32 + p.risk*.22,category:'exploration',actions:{explore:1.45,trade:.45,wealth:.25}});
    }

    if (p.loyalty>62 && k) {
      goals.push({id:'realm',label:`Protect ${k.name}`,weight:16 + p.loyalty*.42 + (state.war?18:0),category:'realm',actions:{serve_realm:1.35,train:.8,safety:.5,belong:.4}});
    }

    if (s?.stability < 45 || (k?.stability??70) < 45) {
      goals.push({id:'stability',label:'Restore local stability',weight:24 + (50-(s?.stability??50))*.65,category:'stability',actions:{help:1,govern:1.05,socialize:.5,train:.3}});
    }

    return goals;
  }

  function deriveStakes(n, goal) {
    const stakes = [];
    const f = family(n), s = settlement(n), k = kingdom(n);
    if (n.health < 45) stakes.push({id:'life',label:'Personal survival',value:Math.round((100-n.health)*1.1),kind:'danger'});
    if (n.hunger > 65 || n.energy < 35) stakes.push({id:'needs',label:'Basic needs',value:Math.round((n.hunger||0)*.45 + (100-(n.energy||80))*.35),kind:'danger'});
    if (n.wealth > 80) stakes.push({id:'wealth',label:'Personal wealth',value:Math.round((n.wealth-70)*.55),kind:'asset'});
    if (f) {
      const familyPower=(f.wealth||0)*.05+(f.influence||0)*1.2+(f.prestige||0)*.35;
      stakes.push({id:'family',label:`${f.name} legacy`,value:Math.round(10+familyPower*.35),kind:'relationship'});
    }
    if (n.partnerId) stakes.push({id:'partner',label:'Partner',value:18,kind:'relationship'});
    if ((n.childrenIds||[]).length) stakes.push({id:'children',label:'Children',value:20+(n.childrenIds.length*4),kind:'relationship'});
    if (s) stakes.push({id:'settlement',label:`${s.name} stability`,value:Math.round((s.stability??70)*.18),kind:'community'});
    if (k) stakes.push({id:'realm',label:`${k.name} fortunes`,value:Math.round((k.stability??70)*.12+(k.power??20)*.05),kind:'community'});
    if (goal?.category==='status') stakes.push({id:'reputation',label:'Status and reputation',value:Math.round((n.reputation||50)*.4),kind:'status'});
    const top=stakes.sort((a,b)=>b.value-a.value).slice(0,5);
    return top;
  }

  function refresh(n,force=false) {
    if (!n?.alive || n.age<13) return null;
    const templates=goalTemplates(n);
    if (!templates.length) return null;
    const previous=n.longTermGoal?.id;
    const scored=templates.map(g=>{
      let score=g.weight;
      const stakes=deriveStakes(n,g);
      if (g.id==='survive') score += stakes.filter(x=>x.kind==='danger').reduce((a,x)=>a+x.value*.3,0);
      if (g.category==='family') score += stakes.filter(x=>x.kind==='relationship').reduce((a,x)=>a+x.value*.45,0);
      if (g.category==='wealth') score += Math.max(0,(40-(n.wealth||0))*.18);
      if (g.category==='status') score += Math.max(0,(65-(n.reputation||50))*.18);
      if (g.category==='realm' && state.war) score += 18;
      if (g.category==='conflict') score += (n.grievance||0)*.35;
      score *= .94+Math.random()*.12;
      return {...g,score,stakes};
    }).sort((a,b)=>b.score-a.score);
    const best=scored[0];
    const shouldSwitch=force || !n.longTermGoal || state.tick-(n.longTermGoal.updatedAt||0)>90 || best.id===n.longTermGoal.id || best.score>(n.longTermGoal.score||0)*1.22;
    if (!shouldSwitch) return n.longTermGoal;
    n.longTermGoal={id:best.id,label:best.label,category:best.category,score:Math.round(best.score),updatedAt:state.tick,startedAt:n.longTermGoal?.startedAt||state.tick,stakes:best.stakes,history:n.longTermGoal?.history||[]};
    if (previous && previous!==best.id) n.longTermGoal.history.unshift({from:previous,to:best.id,tick:state.tick,reason:'World conditions, personality and stakes changed the priority'});
    n.longTermGoal.history=n.longTermGoal.history.slice(0,8);
    return n.longTermGoal;
  }

  function scoreAction(n, action) {
    const g=n.longTermGoal || refresh(n);
    if (!g) return 0;
    const template=goalTemplates(n).find(x=>x.id===g.id);
    const multiplier=template?.actions?.[action]||0;
    const stakes=(g.stakes||[]).reduce((sum,s)=>sum+s.value,0);
    return multiplier*(g.score||0)*.035 + stakes*.04;
  }

  function recordOutcome(n, success=true, reason='') {
    if (!n?.longTermGoal) return;
    n.goalOutcomes=n.goalOutcomes||[];
    n.goalOutcomes.unshift({goalId:n.longTermGoal.id,success,tick:state.tick,reason});
    n.goalOutcomes=n.goalOutcomes.slice(0,10);
    n.longTermGoal.lastOutcome={success,tick:state.tick,reason};
  }

  function kingdomGoal(k) {
    if (!k) return null;
    const war=!!state.war || (state.borderWars||[]).some(w=>w.active&&(w.a===k.id||w.b===k.id));
    const lowTreasury=(k.treasury||0)<70;
    const lowStability=(k.stability||70)<50;
    if (war) return {id:'defend-realm',label:'Survive and win the war',priority:88};
    if (lowStability) return {id:'restore-order',label:'Restore internal stability',priority:78};
    if (lowTreasury) return {id:'restore-treasury',label:'Rebuild the treasury',priority:64};
    if ((k.power||0)<45) return {id:'expand-influence',label:'Strengthen the realm',priority:52};
    return {id:'prosper',label:'Maintain prosperity',priority:40};
  }

  function step() {
    if (!state.running) return;
    const people=alive().filter(n=>n.age>=13);
    people.forEach(n=>{
      if (!n.longTermGoal || state.tick%30===0) refresh(n);
      n.goalStakes=n.longTermGoal?.stakes||[];
    });
    (state.kingdoms||[]).forEach(k=>{ k.currentGoal=kingdomGoal(k); });
  }

  window.NPC_GOALS={refresh,scoreAction,recordOutcome,goalTemplates,deriveStakes,kingdomGoal};
  if (state.registerSystem) state.registerSystem({name:'goals-stakes',step,priority:43});
})();
