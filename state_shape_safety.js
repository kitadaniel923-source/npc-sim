// Initializes optional state shapes before higher-level civilization systems consume them.
(() => {
  const state=window.SIM_STATE;if(!state)return;
  const culture=()=>({tradition:'local',dominant:'common',values:{},traditions:{},customs:[],identity:'local'});
  const economy=wealth=>({prosperity:50,production:0,trade:0,wealth:Number(wealth)||0});
  const diplomacy=()=>({treaties:[],relations:{},wars:[]});
  function ensure(){
    state.diplomacy ||= diplomacy(); state.culture ||= culture(); state.economy ||= economy(state.food); state.history ||= {rumors:[]}; state.rumors ||= []; state.treaties ||= [];
    state.society ||= {culture:culture(),economy:economy(state.food),diplomacy:diplomacy()};
    for(const s of state.settlements||[]){s.culture ||= culture();s.economy ||= economy(s.wealth);s.diplomacy ||= diplomacy();s.history ||= [];s.rumors ||= []}
    for(const k of state.kingdoms||[]){k.culture ||= culture();k.economy ||= economy(k.treasury);k.diplomacy ||= diplomacy();k.treaties ||= [];k.rumors ||= []}
    for(const f of state.families||[]){f.culture ||= culture();f.economy ||= economy(f.wealth);f.diplomacy ||= diplomacy();f.rumors ||= []}
    for(const c of state.clans||[]){c.culture ||= culture();c.economy ||= economy(c.wealth);c.diplomacy ||= diplomacy();c.rumors ||= []}
    for(const c of state.counties||[]){c.culture ||= culture();c.economy ||= economy(c.wealth);c.diplomacy ||= diplomacy()}
    for(const d of state.duchies||[]){d.culture ||= culture();d.economy ||= economy(d.wealth);d.diplomacy ||= diplomacy()}
    for(const n of state.npcs||[]){n.culture ||= culture();n.rumors ||= [];n.rumorTrust ||= {};n.memoryIndex ||= {};n.learning ||= n.learning||{}}
  }
  ensure(); state.registerSystem?.({name:'state-shape-safety',step:ensure,priority:1});
})();
