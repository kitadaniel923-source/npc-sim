// Initializes optional state shapes before and between higher-level civilization systems.
(() => {
  const state=window.SIM_STATE;if(!state)return;
  const culture=()=>({id:'tradition',name:'Tradition',tradition:'local',dominant:'common',values:{},traditions:[],customs:[],identity:'local',belief:'Ancestor Keepers',beliefStrength:40,history:[]});
  const economy=wealth=>({prosperity:50,production:0,trade:0,wealth:Number(wealth)||0,prices:{},markets:0,tradeVolume:0});
  const diplomacy=()=>({treaties:[],relations:{},wars:[]});
  const identity=()=>({culture:'local',belief:'common',law:'customary',diversity:0,tolerance:52,history:[]});
  const society=()=>({culture:culture(),economy:economy(0),identity:identity(),education:{schools:0,teachers:0,literacy:8,knowledge:0,prestige:10,history:[]},institutions:{},movements:[],classPower:{},governance:{councilIds:[],legitimacy:50,cohesion:50},conflicts:{},rivalries:[],unrest:{pressure:0,level:'calm',rebelSupport:0,exodusPressure:0,lastEscalationYear:0,history:[]}});
  const ensureObject=(obj,key,factory)=>{if(!obj[key]||typeof obj[key]!=='object'||Array.isArray(obj[key]))obj[key]=factory();return obj[key]};
  function ensure(){
    ensureObject(state,'diplomacy',diplomacy);ensureObject(state,'culture',culture);ensureObject(state,'economy',()=>economy(state.food));state.history ||= {rumors:[]};state.rumors ||= [];state.treaties ||= [];
    const ss=ensureObject(state,'society',society);ensureObject(ss,'culture',culture);ensureObject(ss,'economy',()=>economy(state.food));ensureObject(ss,'identity',identity);
    for(const s of state.settlements||[]){ensureObject(s,'culture',culture);ensureObject(s,'economy',()=>economy(s.wealth));ensureObject(s,'diplomacy',diplomacy);s.history ||= [];s.rumors ||= [];const x=ensureObject(s,'society',society);ensureObject(x,'culture',culture);ensureObject(x,'economy',()=>economy(s.wealth));ensureObject(x,'identity',identity);x.conflicts ||= {};x.institutions ||= {};x.movements ||= [];x.classPower ||= {};x.rivalries ||= []}
    for(const k of state.kingdoms||[]){ensureObject(k,'culture',culture);ensureObject(k,'economy',()=>economy(k.treasury));ensureObject(k,'diplomacy',diplomacy);k.treaties ||= [];k.rumors ||= [];const x=ensureObject(k,'society',society);ensureObject(x,'culture',culture);ensureObject(x,'economy',()=>economy(k.treasury));ensureObject(x,'identity',identity)}
    for(const f of state.families||[]){if(typeof f.culture!=='object'||!f.culture)f.culture=culture();ensureObject(f,'economy',()=>economy(f.wealth));ensureObject(f,'diplomacy',diplomacy);f.rumors ||= [];f.cultureId ||= f.culture.id||'tradition';f.culture.id ||= f.cultureId;f.culture.name ||= f.cultureId;f.culture.tradition ||= f.cultureId;f.culture.dominant ||= f.cultureId}
    for(const c of state.clans||[]){ensureObject(c,'culture',culture);ensureObject(c,'economy',()=>economy(c.wealth));ensureObject(c,'diplomacy',diplomacy);c.rumors ||= []}
    for(const c of state.counties||[]){ensureObject(c,'culture',culture);ensureObject(c,'economy',()=>economy(c.wealth));ensureObject(c,'diplomacy',diplomacy)}
    for(const d of state.duchies||[]){ensureObject(d,'culture',culture);ensureObject(d,'economy',()=>economy(d.wealth));ensureObject(d,'diplomacy',diplomacy)}
    for(const n of state.npcs||[]){n.culture ||= culture();n.rumors ||= [];n.rumorTrust ||= {};n.memoryIndex ||= {};n.learning ||= n.learning||{}}
  }
  ensure();
  state.registerSystem?.({name:'state-shape-safety',step:ensure,priority:1});
  // A mid-pipeline repair catches systems that legitimately replace a culture/economy
  // record during their own update, before downstream civilization systems consume it.
  state.registerSystem?.({name:'state-shape-finalizer',step:ensure,priority:74});
})();
