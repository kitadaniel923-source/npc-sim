(() => {
  const state=window.SIM_STATE;if(!state)return;
  const planner=window.NPC_PLANNING, economy=window.NPC_ECONOMY, relationships=window.NPC_RELATIONSHIPS, memory=window.NPC_MEMORY, decisions=window.NPC_DECISIONS;
  const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,v));
  const alive=()=>state.npcs.filter(n=>n.alive);
  const trait=(n,t)=>Array.isArray(n.traits)&&n.traits.includes(t)||n.trait===t||window.NPC_PERSONALITY?.has?.(n,t);
  function nearestSocial(n){return alive().filter(x=>x.id!==n.id&&x.settlementId===n.settlementId).sort((a,b)=>Math.hypot(a.x-n.x,a.y-n.y)-Math.hypot(b.x-n.x,b.y-n.y))[0]||null;}
  function action(n){
    if(!n.alive||!n.aiDecision)return;
    const a=n.aiDecision.action;let completed=true,target=null;
    n.lastDecisionAt=state.tick;n.actionHistory=n.actionHistory||[];
    if(a==='eat'){n.hunger=clamp(n.hunger-9);n.needs.hunger=n.hunger;n.lastAction='Ate a meal';}
    else if(a==='drink'){n.needs.thirst=clamp(n.needs.thirst-12);n.lastAction='Found water';}
    else if(a==='rest'){n.energy=clamp(n.energy+8);n.needs.energy=n.energy;n.lastAction='Rested';}
    else if(a==='socialize'){target=nearestSocial(n);if(target){n.needs.social=clamp(n.needs.social-12);n.mood=clamp(n.mood+2);n.lastAction=`Talked with ${target.name}`;relationships?.interact?.(n,target,'neutral',.8);memory?.remember?.(n,`Spent time with ${target.name}.`,'relationship',1,target.id);if(trait(n,'kind')){target.mood=clamp((target.mood||50)+1);memory?.remember?.(target,`${n.name} checked in on me.`,'relationship',1,n.id);}}else n.needs.social=clamp(n.needs.social+2);}
    else if(a==='belong'){target=nearestSocial(n);n.needs.belonging=clamp(n.needs.belonging-15);n.mood=clamp(n.mood+3);n.lastAction='Visited family';if(target&&n.familyId===target.familyId){relationships?.interact?.(n,target,'help',1);}}
    else if(a==='work'){n.needs.purpose=clamp(n.needs.purpose-9);n.energy=clamp(n.energy-2);n.lastAction=`Worked as ${n.roleName||'Citizen'}`;economy?.earn?.(n);}
    else if(a==='wealth'){n.needs.wealth=clamp(n.needs.wealth-5);n.lastAction='Pursued income';economy?.earn?.(n);}
    else if(a==='trade'){n.needs.wealth=clamp(n.needs.wealth-7);n.lastAction='Completed a trade';economy?.tradeStep?.(n);}
    else if(a==='safety'){n.needs.safety=clamp(n.needs.safety-10);n.lastAction=state.war?'Moved toward a safer place':'Sought safety';if(state.war&&n.settlementId){n.migrationPressure=clamp((n.migrationPressure||0)+4);}}
    else if(a==='explore'){n.needs.purpose=clamp(n.needs.purpose-4);n.lastAction='Explored nearby land';n.explorationCount=(n.explorationCount||0)+1;}
    else if(a==='govern'){n.needs.purpose=clamp(n.needs.purpose-10);n.influence=clamp((n.influence||0)+.15,0,50);n.lastAction='Handled civic affairs';}
    else if(a==='train'){n.combatSkill=clamp((n.combatSkill||50)+.3);n.energy=clamp(n.energy-3);n.lastAction='Trained for combat';n.trainingCount=(n.trainingCount||0)+1;}
    else if(a==='study'){n.education=clamp((n.education||0)+.25);n.needs.purpose=clamp(n.needs.purpose-4);n.lastAction='Studied';n.studyCount=(n.studyCount||0)+1;}
    else if(a==='confront'){target= n.aiDecision.targetId?state.npcs.find(x=>x.id===n.aiDecision.targetId&&x.alive):null;if(target){n.lastAction=`Confronted ${target.name}`;n.grievance=clamp((n.grievance||0)-6);target.grievance=clamp((target.grievance||0)+4);relationships?.interact?.(n,target,'insult',1.6);memory?.experience?.(n,`I confronted ${target.name}.`,'conflict',3,target.id,'anger',3);if(trait(target,'aggressive')&&Math.random()<.2){n.health=clamp((n.health||100)-4);target.health=clamp((target.health||100)-2);}}else completed=false;}
    else completed=false;
    if(completed){n.actionHistory.unshift({tick:state.tick,action:a,targetId:target?.id||null,decisionPriority:n.decisionPriority||0});n.actionHistory=n.actionHistory.slice(0,20);planner?.completeStep?.(n,a);if(memory&&n.aiDecision?.decisionReason)memory.remember?.(n,`Decision: ${a}. ${n.aiDecision.decisionReason}`,'decision',1.2,target?.id||null);}
  }
  function routine(n){n.routine=n.routine||{};const h=state.hour;n.routine.phase=h<6?'sleep':h<9?'morning':h<17?'work':h<21?'social':'evening';n.routine.preference=trait(n,'hardworking')?'work':trait(n,'social')?'social':trait(n,'curious')?'study':'balanced';}
  let lastTick=-1;
  function step(){if(!state.running||state.tick===lastTick)return;lastTick=state.tick;alive().forEach(n=>{window.NPC_PERSONALITY?.ensure(n);window.NPC_NEEDS?.update(n);routine(n);if(state.tick%3===0)decisions?.choose?.(n);if(state.tick%2===0)action(n);if(state.tick%6===0)memory?.observe?.(n);});const s=alive().find(n=>n.id===state.selected);if(s){const chart=document.getElementById('needsChart'),mood=document.getElementById('selectedNeedMood');if(chart){const rows=[['Hunger',100-s.needs.hunger],['Thirst',100-s.needs.thirst],['Energy',s.needs.energy],['Safety',s.needs.safety],['Social',100-s.needs.social],['Belonging',100-s.needs.belonging],['Purpose',100-s.needs.purpose],['Health',s.needs.health]];chart.innerHTML=rows.map(([k,v])=>`<div class="need"><div><span>${k}</span><b>${Math.round(v)}%</b></div><div class="bar"><i style="width:${clamp(v)}%"></i></div></div>`).join('');}if(mood)mood.textContent=`${s.needState||'stable'} · Mood ${Math.round(s.mood)}`;}}
  window.NPC_BEHAVIOR={step,routine,action};
  if(state.registerSystem)state.registerSystem({name:'behavior',step,priority:80});
})();
