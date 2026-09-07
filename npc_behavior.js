(() => {
  const state=window.SIM_STATE;if(!state)return;
  const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,v));
  const alive=()=>state.npcs.filter(n=>n.alive);
  const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const trait=(n,t)=>Array.isArray(n.traits)&&n.traits.includes(t)||n.trait===t;
  function action(n){
    if(!n.alive||!n.aiDecision)return;
    const a=n.aiDecision.action;
    if(a==='eat'){n.hunger=clamp(n.hunger-9);n.needs.hunger=n.hunger;n.lastAction='Ate a meal';}
    else if(a==='drink'){n.needs.thirst=clamp(n.needs.thirst-12);n.lastAction='Found water';}
    else if(a==='rest'){n.energy=clamp(n.energy+8);n.needs.energy=n.energy;n.lastAction='Rested';}
    else if(a==='socialize'){const peers=alive().filter(x=>x.id!==n.id&&x.settlementId===n.settlementId);if(peers.length){const t=peers[Math.floor(Math.random()*peers.length)];n.needs.social=clamp(n.needs.social-12);n.mood=clamp(n.mood+2);n.lastAction=`Talked with ${t.name}`;window.NPC_MEMORY?.remember(n,`Spent time with ${t.name}.`,'relationship',1,t.id);}}
    else if(a==='belong'){n.needs.belonging=clamp(n.needs.belonging-15);n.mood=clamp(n.mood+3);n.lastAction='Visited family';}
    else if(a==='work'){n.needs.purpose=clamp(n.needs.purpose-9);n.energy=clamp(n.energy-2);n.lastAction=`Worked as ${n.roleName||'Citizen'}`;}
    else if(a==='wealth'){n.wealth+=.35+(n.roleId==='merchant'||n.roleId==='trader'?.5:0);n.needs.wealth=clamp(n.needs.wealth-5);n.lastAction='Pursued income';}
    else if(a==='safety'){n.needs.safety=clamp(n.needs.safety-10);n.lastAction='Sought safety';}
    else if(a==='explore'){n.needs.purpose=clamp(n.needs.purpose-4);n.lastAction='Explored nearby land';}
    else if(a==='govern'){n.needs.purpose=clamp(n.needs.purpose-10);n.influence=clamp((n.influence||0)+.15,0,50);n.lastAction='Handled civic affairs';}
    else if(a==='train'){n.combatSkill=clamp((n.combatSkill||50)+.3);n.energy=clamp(n.energy-3);n.lastAction='Trained for combat';}
    else if(a==='study'){n.education=clamp((n.education||0)+.25);n.needs.purpose=clamp(n.needs.purpose-4);n.lastAction='Studied';}
  }
  function routine(n){
    n.routine=n.routine||{};
    const h=state.hour;
    n.routine.phase=h<6?'sleep':h<9?'morning':h<17?'work':h<21?'social':'evening';
    n.routine.preference=trait(n,'hardworking')?'work':trait(n,'social')?'social':trait(n,'curious')?'study':'balanced';
  }
  let lastTick=-1;
  function step(){
    if(!state.running||state.tick===lastTick)return;lastTick=state.tick;
    alive().forEach(n=>{window.NPC_NEEDS?.update(n);routine(n);if(state.tick%3===0)window.NPC_DECISIONS?.choose(n);if(state.tick%2===0)action(n);if(state.tick%6===0)window.NPC_MEMORY?.observe(n);});
    const s=alive().find(n=>n.id===state.selected);
    if(s){const chart=document.getElementById('needsChart');const mood=document.getElementById('selectedNeedMood');if(chart){const rows=[['Hunger',100-s.needs.hunger],['Thirst',100-s.needs.thirst],['Energy',s.needs.energy],['Safety',s.needs.safety],['Social',100-s.needs.social],['Belonging',100-s.needs.belonging],['Purpose',100-s.needs.purpose],['Health',s.needs.health]];chart.innerHTML=rows.map(([k,v])=>`<div class="need"><div><span>${k}</span><b>${Math.round(v)}%</b></div><div class="bar"><i style="width:${clamp(v)}%"></i></div></div>`).join('');}if(mood)mood.textContent=`${s.needState||'stable'} · Mood ${Math.round(s.mood)}`;}
  }
  window.NPC_BEHAVIOR={step,routine,action};setInterval(step,350);
})();
