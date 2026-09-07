(() => {
  const state = window.SIM_STATE;
  if (!state) return;
  const clamp = (v,a=0,b=100) => Math.max(a,Math.min(b,v));
  const alive = () => (state.npcs||[]).filter(n=>n.alive);

  function ensure(n){
    n.needs = n.needs || {hunger:n.hunger??20, thirst:20, energy:n.energy??80, safety:75, social:45, belonging:50, wealth:40, purpose:45, health:n.health??100};
    n.needs.hunger = clamp(n.hunger ?? n.needs.hunger);
    n.needs.energy = clamp(n.energy ?? n.needs.energy);
    n.needs.health = clamp(n.health ?? n.needs.health);
    n.hunger = n.needs.hunger; n.energy = n.needs.energy; n.health = n.needs.health;
  }

  function update(n){
    ensure(n);
    const danger = state.war ? 45 : 75;
    n.needs.hunger = clamp(n.needs.hunger + .035 * state.speed);
    n.needs.thirst = clamp(n.needs.thirst + .045 * state.speed);
    n.needs.energy = clamp(n.needs.energy - .025 * state.speed + (n.roleId==='child'?-.01:0));
    n.needs.social = clamp(n.needs.social + .018 * state.speed);
    n.needs.belonging = clamp(n.needs.belonging + (n.familyId ? .006 : .018) * state.speed);
    n.needs.purpose = clamp(n.needs.purpose + (n.goal && n.goal!=='Explore' ? .003 : .012) * state.speed);
    n.needs.wealth = clamp(n.needs.wealth + (n.wealth < 15 ? .03 : -.004) * state.speed);
    n.needs.safety = clamp(n.needs.safety + (state.war ? .025 : -.008) * state.speed);
    if(state.plague) n.needs.health = clamp(n.needs.health - .01 * state.speed);
    if(n.needs.hunger > 90) n.needs.health = clamp(n.needs.health - .035 * state.speed);
    if(n.needs.energy < 8) n.needs.health = clamp(n.needs.health - .02 * state.speed);
    n.hunger=n.needs.hunger; n.energy=n.needs.energy; n.health=n.needs.health;
    n.needPressure = {
      hunger:n.needs.hunger,
      thirst:n.needs.thirst,
      rest:100-n.needs.energy,
      safety:100-n.needs.safety,
      social:n.needs.social,
      belonging:n.needs.belonging,
      wealth:n.needs.wealth,
      purpose:n.needs.purpose
    };
    n.needUrgency = Object.values(n.needPressure).reduce((a,v)=>a+v,0)/8;
    n.needState = n.needUrgency>70?'critical':n.needUrgency>48?'strained':'stable';
  }

  window.NPC_NEEDS = {ensure, update};
})();
