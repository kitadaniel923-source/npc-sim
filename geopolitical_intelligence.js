// Phase 3C: canonical geopolitical intelligence.
// Reads existing territory, borders, settlements, resources and kingdoms. Never owns territory.
(() => {
  const state=window.SIM_STATE;if(!state)return;
  const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,v));
  const kingdoms=()=> (state.kingdoms||[]).filter(k=>!k.civilWarRebel);
  const settlementsOf=k=> (state.settlements||[]).filter(s=>String(s.kingdomId)===String(k.id));
  const ownerAt=(x,y)=>window.BORDER_RECOGNITION?.ownerAt?.(x,y)||null;
  const neighbors=k=> (kingdoms().filter(o=>o.id!==k.id&&settlementsOf(k).some(a=>settlementsOf(o).some(b=>Math.hypot(a.x-b.x,a.y-b.y)<180))));
  const resourceValue=s=>{const r=s.resources||{};return (r.gold||0)*2.5+(r.iron||0)*1.7+(r.weapons||0)*1.5+(r.armor||0)*1.5+(r.food||0)*.45+(r.stone||0)*.25+(r.wood||0)*.2;};
  function ensure(k){k.geopolitics=k.geopolitics||{neighbors:[],regions:[],chokepoints:[],threats:[],opportunities:[],powerBalance:50,lastYear:0};return k.geopolitics;}
  function analyze(k){
    const out=ensure(k),ss=settlementsOf(k),ns=neighbors(k),enemy=[];
    const totalValue=ss.reduce((n,s)=>n+resourceValue(s),0);
    out.regions=ss.map(s=>({id:s.id,name:s.name,value:Math.round(resourceValue(s)),capital:String(s.id)===String(k.capitalId),fertility:clamp((s.resources?.food||0)*.7+(s.wealth||0)*.08),fort:clamp((s.buildings||0)*2+(s.stability||0)*.4)})).sort((a,b)=>b.value-a.value).slice(0,20);
    out.neighbors=ns.map(o=>String(o.id));
    out.chokepoints=ss.filter(s=>ns.some(o=>settlementsOf(o).some(x=>Math.hypot(s.x-x.x,s.y-x.y)<115))).map(s=>s.id);
    out.exposed=ss.filter(s=>ns.some(o=>settlementsOf(o).some(x=>Math.hypot(s.x-x.x,s.y-x.y)<140))).map(s=>s.id);
    out.capitalDistance=ss.length&&k.capitalId?Math.max(...ss.map(s=>Math.hypot(s.x-(ss.find(x=>x.id===k.capitalId)?.x||0),s.y-(ss.find(x=>x.id===k.capitalId)?.y||0)))):0;
    out.resourceValue=Math.round(totalValue);
    const myPower=Math.max(1,(k.power||25)+ss.length*1.5+(aliveKingdomPopulation(k)*.08));
    out.threats=[];out.opportunities=[];
    ns.forEach(o=>{const os=settlementsOf(o),op=(o.power||25)+os.length*1.5+(aliveKingdomPopulation(o)*.08),dist=ss.length&&os.length?Math.min(...ss.flatMap(a=>os.map(b=>Math.hypot(a.x-b.x,a.y-b.y)))):9999,rel=window.SOCIETY_CIVILIZATION_EVOLUTION?.relationScore?.(k.id,o.id)??0;if(op>myPower*1.15||rel< -20)out.threats.push({kingdomId:o.id,score:clamp(50+(op/myPower-1)*80+(rel<0?Math.abs(rel)*.25:0)),reason:op>myPower?'stronger neighbor':'hostile relations'});if(dist<260&&(resourceValue(os[0]||{})>25||rel>30))out.opportunities.push({kingdomId:o.id,score:clamp((260-dist)*.22+Math.max(0,rel)*.15),reason:rel>30?'friendly access':'valuable frontier'});});
    out.threats.sort((a,b)=>b.score-a.score);out.opportunities.sort((a,b)=>b.score-a.score);out.regionalPower=Math.round(myPower);out.lastYear=state.year;
    return out;
  }
  function aliveKingdomPopulation(k){return state.npcs.filter(n=>n.alive&&String(n.faction||n.kingdomId)===String(k.id)).length}
  function step(){if(!state.running)return;if(state.tick%24!==0)return;kingdoms().forEach(analyze);}
  window.GEOPOLITICAL_INTELLIGENCE={step,analyze,ensure};state.registerSystem?.({name:'geopolitical-intelligence',step,priority:104});
})();
