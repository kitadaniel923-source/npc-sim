// Initializes optional state shapes before higher-level civilization systems consume them.
(() => {
  const state=window.SIM_STATE;if(!state)return;
  const culture=()=>({id:'tradition',name:'Tradition',tradition:'local',dominant:'common',values:{},traditions:[],customs:[],identity:'local',belief:'Ancestor Keepers',beliefStrength:40,history:[]});
  const economy=wealth=>({prosperity:50,production:0,trade:0,wealth:Number(wealth)||0,prices:{},markets:0,tradeVolume:0});
  const diplomacy=()=>({treaties:[],relations:{},wars:[]});
  const identity=()=>({culture:'local',belief:'common',law:'customary',diversity:0,tolerance:52,history:[]});
  const society=()=>({culture:culture(),economy:economy(0),identity:identity(),education:{schools:0,teachers:0,literacy:8,knowledge:0,prestige:10,history:[]},institutions:{},movements:[],classPower:{},governance:{councilIds:[],legitimacy:50,cohesion:50},conflicts:{},rivalries:[],unrest:{pressure:0,level:'calm',rebelSupport:0,exodusPressure:0,lastEscalationYear:0,history:[]}});
  function mergeShape(obj,key,factory){if(!obj[key]||typeof obj[key]!=='object'||Array.isArray(obj[key]))obj[key]=factory();return obj[key]}
  function ensure(){
    mergeShape(state,'diplomacy',diplomacy);mergeShape(state,'culture',culture);mergeShape(state,'economy',()=>economy(state.food));state.history ||= {rumors:[]};state.rumors ||= [];state.treaties ||= [];
    const ss=mergeShape(state,'society',society);mergeShape(ss,'culture',culture);mergeShape(ss,'economy',()=>economy(state.food));mergeShape(ss,'identity',identity);
    for(const s of state.settlements||[]){mergeShape(s,'culture',culture);mergeShape(s,'economy',()=>economy(s.wealth));mergeShape(s,'diplomacy',diplomacy);s.history ||= [];s.rumors ||= [];const x=mergeShape(s,'society',society);mergeShape(x,'culture',culture);mergeShape(x,'economy',()=>economy(s.wealth));mergeShape(x,'identity',identity);x.conflicts ||= {};x.institutions ||= {};x.movements ||= [];x.classPower ||= {};x.rivalries ||= []}
    for(const k of state.kingdoms||[]){mergeShape(k,'culture',culture);mergeShape(k,'economy',()=>economy(k.treasury));mergeShape(k,'diplomacy',diplomacy);k.treaties ||= [];k.rumors ||= [];const x=mergeShape(k,'society',society);mergeShape(x,'culture',culture);mergeShape(x,'economy',()=>economy(k.treasury));mergeShape(x,'identity',identity)}
    for(const f of state.families||[]){if(typeof f.culture!=='object'||!f.culture)f.culture=culture();mergeShape(f,'economy',()=>economy(f.wealth));mergeShape(f,'diplomacy',diplomacy);f.rumors ||= [];f.cultureId ||= f.culture.id||'tradition';f.culture.id ||= f.cultureId;f.culture.name ||= f.cultureId;f.culture.tradition ||= f.cultureId;f.culture.dominant ||= f.cultureId}
    for(const c of state.clans||[]){mergeShape(c,'culture',culture);mergeShape(c,'economy',()=>economy(c.wealth));mergeShape(c,'diplomacy',diplomacy);c.rumors ||= []}
    for(const c of state.counties||[]){mergeShape(c,'culture',culture);mergeShape(c,'economy',()=>economy(c.wealth));mergeShape(c,'diplomacy',diplomacy)}
    for(const d of state.duchies||[]){mergeShape(d,'culture',culture);mergeShape(d,'economy',()=>economy(d.wealth));mergeShape(d,'diplomacy',diplomacy)}
    for(const n of state.npcs||[]){n.culture ||= culture();n.rumors ||= [];n.rumorTrust ||= {};n.memoryIndex ||= {};n.learning ||= n.learning||{}}
  }
  ensure();state.registerSystem?.({name:'state-shape-safety',step:ensure,priority:1});
})();
