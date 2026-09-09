// Initializes optional state shapes before higher-level civilization systems consume them.
(() => {
  const state=window.SIM_STATE;if(!state)return;
  function ensure(){
    state.diplomacy ||= {treaties:[],relations:{},wars:[]};
    state.culture ||= {traditions:{},dominant:'common'};
    state.history ||= {rumors:[]};
    state.rumors ||= [];
    (state.settlements||[]).forEach(s=>{
      s.culture ||= {tradition:'local',dominant:'common',values:{},identity:'local'};
      s.economy ||= {prosperity:50,production:0,trade:0,wealth:s.wealth||0};
      s.diplomacy ||= {treaties:[],relations:{},wars:[]};
      s.history ||= [];
      s.rumors ||= [];
    });
    (state.kingdoms||[]).forEach(k=>{
      k.culture ||= {tradition:'local',dominant:'common',values:{}};
      k.economy ||= {prosperity:50,production:0,trade:0,wealth:k.treasury||0};
      k.diplomacy ||= {treaties:[],relations:{},wars:[]};
      k.treaties ||= [];
      k.rumors ||= [];
    });
    (state.npcs||[]).forEach(n=>{n.rumors ||= [];n.culture ||= {tradition:'local',dominant:'common',values:{}};});
  }
  ensure();
  state.registerSystem?.({name:'state-shape-safety',step:ensure,priority:1});
})();
