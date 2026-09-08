// Phase 3A: kingdom strategic AI foundation.
// Turns civilization/society state into persistent strategic interests, goals, threat assessment and posture.
// State-only. No DOM listeners, canvas listeners, render loops, or parallel diplomacy/war authority.
(() => {
  const state=window.SIM_STATE;if(!state)return;
  const P=()=>window.NPC_PERSONALITY;
  const M=()=>window.NPC_MEMORY;
  const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,v));
  const alive=()=>state.npcs.filter(n=>n.alive);
  const peopleOf=k=>alive().filter(n=>String(n.faction||n.kingdomId)===String(k.id));
  const settlementsOf=k=>state.settlements.filter(s=>String(s.kingdomId)===String(k.id));
  const relation=(a,b)=>window.SOCIETY_CIVILIZATION_EVOLUTION?.relationScore?.(a,b)??state.diplomacy?.relations?.[[String(a),String(b)].sort().join(':')]?.score??0;
  const atWar=(a,b)=>state.war||((state.borderWars||[]).some(w=>(String(w.a)===String(a)&&String(w.b)===String(b))||(String(w.a)===String(b)&&String(w.b)===String(a))));
  const hasTreaty=(type,a,b)=>(state.diplomacy?.treaties||[]).some(t=>t.status==='active'&&t.type===type&&((String(t.a)===String(a)&&String(t.b)===String(b))||(String(t.a)===String(b)&&String(t.b)===String(a))));
  const distance=(a,b)=>Math.hypot((a.x||0)-(b.x||0),(a.y||0)-(b.y||0));
  const log=t=>window.SIM_LOG?.(t);

  const STRATEGIES=['cautious','expansionist','mercantile','militarist','isolationist','diplomatic'];
  const INTERESTS=['survival','land','gold','trade','prestige','security','faith','culture','succession'];
  const GOALS=['Defend homeland','Secure trade routes','Expand territory','Contain a rival','Build prosperity','Protect the dynasty','Increase prestige','Strengthen alliances','Prepare for war','Preserve peace'];

  function ensure(k){
    k.strategy=k.strategy||{};
    if(!k.strategy.type)k.strategy.type=deriveStrategy(k);
    k.strategy.interests=k.strategy.interests||{};
    INTERESTS.forEach(i=>{if(typeof k.strategy.interests[i]!=='number')k.strategy.interests[i]=20;});
    k.strategy.goals=Array.isArray(k.strategy.goals)?k.strategy.goals:[];
    k.strategy.threats=Array.isArray(k.strategy.threats)?k.strategy.threats:[];
    k.strategy.opportunities=Array.isArray(k.strategy.opportunities)?k.strategy.opportunities:[];
    k.strategy.posture=k.strategy.posture||'neutral';
    k.strategy.readiness=clamp(k.strategy.readiness??35);
    k.strategy.warWillingness=clamp(k.strategy.warWillingness??30);
    k.strategy.peacePreference=clamp(k.strategy.peacePreference??55);
    k.strategy.lastDecisionYear=k.strategy.lastDecisionYear??0;
    k.strategy.history=Array.isArray(k.strategy.history)?k.strategy.history:[];
    k.strategy.version=2;
    return k.strategy;
  }

  function deriveStrategy(k){
    const society=k.society?.identity||{},p=k.power||25,pros=k.society?.prosperity||50,leg=k.legitimacy||60;
    const candidates={
      cautious:((100-p)*.22+(100-(k.stability||70))*.2+(100-pros)*.12),
      expansionist:(p*.34+(k.society?.classPower?.nobility||20)*.18+(k.society?.internationalPower||p)*.08),
      mercantile:(pros*.25+(society.knowledge||0)*.18+(k.society?.classPower?.merchant||20)*.2),
      militarist:(p*.25+(k.society?.institutionPower?.military||0)*.2+(k.society?.classPower?.soldier||15)*.22),
      isolationist:((100-(society.tolerance||50))*.18+(100-(k.society?.diplomaticTrust||35))*.18+(100-leg)*.1),
      diplomatic:((society.tolerance||50)*.22+(k.society?.diplomaticTrust||35)*.25+(k.society?.institutionPower?.council||0)*.12)
    };
    return Object.entries(candidates).sort((a,b)=>b[1]-a[1])[0]?.[0]||'cautious';
  }

  function interestProfile(k,ss,people){
    const s=ensure(k),soc=k.society||{},identity=soc.identity||{},classes=soc.classPower||{};
    const food=ss.reduce((v,x)=>v+(x.resources?.food||0),0),gold=ss.reduce((v,x)=>v+(x.resources?.gold||0),0)+((k.treasury||0)*.2);
    const borders=borderCount(k),pop=people.length,war=state.war;
    const values={
      survival:clamp(55+(100-(k.stability||70))*.65+(food<pop*1.2?18:0)+(war?8:0)),
      land:clamp(30+(s.type==='expansionist'?28:0)+borderCount(k)*1.5+(k.power||25)*.18+(classes.nobility||0)*.12),
      gold:clamp(25+Math.min(50,gold/4)+(soc.prosperity||50)*.18),
      trade:clamp(25+(classes.merchant||0)*.4+(soc.prosperity||50)*.28+(identity.knowledge||0)*.06),
      prestige:clamp(20+(k.power||25)*.32+(soc.internationalPower||25)*.18+(identity.era==='High Medieval Flourishing'?12:0)),
      security:clamp(40+borderCount(k)*2+(100-(k.stability||70))*.5+(war?15:0)),
      faith:clamp(18+(classes.clergy||0)*.55+(identity.belief?12:0)+(identity.tolerance<35?10:0)),
      culture:clamp(20+(identity.literacy||8)*.45+(identity.tolerance||50)*.22+(identity.era!=='Early Kingdom'?8:0)),
      succession:clamp(18+(k.leaderId?8:0)+(k.dynasty?.legitimacy||k.legitimacy||60)*.42+(k.dynasty?.rivalClaims?.length||0)*8)
    };
    if(s.type==='mercantile'){values.trade+=12;values.gold+=10;values.land-=4;}
    if(s.type==='militarist'){values.security+=10;values.prestige+=8;values.land+=8;}
    if(s.type==='diplomatic'){values.trade+=7;values.culture+=6;values.security+=4;}
    if(s.type==='cautious'){values.survival+=8;values.security+=9;values.land-=5;}
    if(s.type==='isolationist'){values.security+=8;values.culture+=6;}
    Object.keys(values).forEach(i=>s.interests[i]=clamp(values[i]));
    return values;
  }

  function borderCount(k){
    const own=settlementsOf(k),others=state.settlements.filter(s=>String(s.kingdomId)!==String(k.id));
    let count=0;own.forEach(a=>others.forEach(b=>{if(distance(a,b)<150)count++;}));
    return Math.min(30,count);
  }

  function treatyCounts(k){
    const ts=(state.diplomacy?.treaties||[]).filter(t=>t.status==='active'&&(String(t.a)===String(k.id)||String(t.b)===String(k.id)));
    return {alliances:ts.filter(t=>t.type==='alliance').length,tradePacts:ts.filter(t=>t.type==='trade-pact').length,truce:ts.filter(t=>t.type==='truce').length};
  }

  function assessRelations(k,kingdoms){
    const ss=settlementsOf(k),out=[];
    kingdoms.filter(x=>x.id!==k.id).forEach(other=>{
      const otherSett=settlementsOf(other),r=relation(k.id,other.id),near=ss.some(a=>otherSett.some(b=>distance(a,b)<210));
      const power=Math.max(1,other.power||25)+(other.society?.internationalPower||0)*.35;
      const ownPower=Math.max(1,k.power||25)+(k.society?.internationalPower||0)*.35;
      let threat=Math.max(0,(power-ownPower)*.65);
      if(near)threat+=18;
      if(r<0)threat+=Math.abs(r)*.18;
      if(atWar(k.id,other.id))threat+=55;
      if(hasTreaty('alliance',k.id,other.id))threat-=32;
      if(hasTreaty('trade-pact',k.id,other.id))threat-=8;
      const opportunity=Math.max(0,(ownPower-power)*.5)+(r>30?12:0)+(near?8:0)+((other.society?.prosperity||50)>65?8:0);
      out.push({kingdomId:other.id,name:other.name,relation:Math.round(r*10)/10,threat:Math.round(clamp(threat)*10)/10,opportunity:Math.round(clamp(opportunity)*10)/10,near,atWar:atWar(k.id,other.id)});
    });
    out.sort((a,b)=>b.threat-a.threat);
    return {threats:out.slice(0,5),opportunities:out.slice().sort((a,b)=>b.opportunity-a.opportunity).slice(0,5)};
  }

  function pickGoals(k,assessment){
    const s=ensure(k),i=s.interests,t=s.threats[0],o=s.opportunities[0],counts=treatyCounts(k);
    const scored=[
      ['Defend homeland',i.security*.75+i.survival*.6+(t?.threat||0)*.8],
      ['Secure trade routes',i.trade*.9+i.gold*.45+(counts.tradePacts?8:0)],
      ['Expand territory',i.land*.9+i.prestige*.25+(o?.opportunity||0)*.25],
      ['Contain a rival',i.security*.65+(t?.threat||0)*.9+(t?.relation<0?12:0)],
      ['Build prosperity',i.gold*.7+i.trade*.8+(k.society?.prosperity||50)*.2],
      ['Protect the dynasty',i.succession*.85+(k.dynasty?.rivalClaims?.length||0)*14],
      ['Increase prestige',i.prestige*.85+(k.power||25)*.18],
      ['Strengthen alliances',i.security*.35+i.trade*.45+i.culture*.2+(counts.alliances===0?16:0)],
      ['Prepare for war',i.security*.55+i.prestige*.3+(t?.threat||0)*.85],
      ['Preserve peace',s.peacePreference*.8+(t?.relation||0)*.3+(counts.truce?10:0)]
    ];
    const chosen=scored.sort((a,b)=>b[1]-a[1]).slice(0,3).map(([name,score],idx)=>{
      const existing=s.goals.find(g=>g.name===name);
      return existing||{id:`kg-${k.id}-${name.toLowerCase().replace(/[^a-z0-9]+/g,'-')}`,name,priority:clamp(score),progress:0,status:'active',createdYear:state.year,lastReviewedYear:state.year,reason:reasonFor(name,k,t,o)};
    });
    const merged=chosen.map(g=>{g.priority=clamp(g.priority);g.lastReviewedYear=state.year;return g;});
    s.goals=merged;
    return merged;
  }

  function reasonFor(name,k,t,o){
    if(name==='Defend homeland'&&t)return `${t.name} represents the greatest current strategic threat.`;
    if(name==='Contain a rival'&&t)return `${t.name} is powerful, nearby, hostile, or otherwise strategically dangerous.`;
    if(name==='Expand territory'&&o)return `${o.name} presents a favorable strategic opportunity.`;
    if(name==='Strengthen alliances')return 'Diplomatic support improves security and strategic flexibility.';
    if(name==='Preserve peace')return 'Peace protects stability, prosperity, and long-term development.';
    return 'The kingdom\'s internal interests make this a high-value strategic objective.';
  }

  function posture(k,assessment){
    const s=ensure(k),t=assessment.threats[0],allies=treatyCounts(k),i=s.interests;
    const hostile=t?.relation<0, activeWar=state.war||(t?.atWar===true);
    let posture='neutral';
    if(activeWar)posture='wartime';
    else if((t?.threat||0)>65&&i.security>65)posture='defensive';
    else if((i.land>72||s.type==='expansionist')&&(t?.opportunity||0)>25)posture='expansionist';
    else if(i.trade>70||s.type==='mercantile')posture='commercial';
    else if(allies.alliances>0&&i.security<65)posture='coalition-building';
    else if(hostile&&i.security>55)posture='watchful';
    s.posture=posture;
    s.warWillingness=clamp(18+i.prestige*.22+i.security*.2+(s.type==='militarist'?18:0)+(s.type==='expansionist'?10:0)-(k.stability<45?20:0));
    s.peacePreference=clamp(78-i.prestige*.2-i.land*.15+(s.type==='diplomatic'?12:0)+(s.type==='isolationist'?5:0));
    s.readiness=clamp(28+i.security*.28+i.prestige*.13+(s.type==='militarist'?18:0)+(activeWar?25:0));
    return posture;
  }

  function progressGoals(k,assessment){
    const s=ensure(k),goals=s.goals||{};const counts=treatyCounts(k);
    s.goals.forEach(g=>{
      let gain=.08;
      if(g.name==='Defend homeland')gain+=Math.max(0,(100-(assessment.threats[0]?.threat||0)))*.003;
      if(g.name==='Secure trade routes')gain+=counts.tradePacts*.02+(k.society?.prosperity||50)*.0005;
      if(g.name==='Build prosperity')gain+=(k.society?.prosperity||50)>60?.05:0;
      if(g.name==='Strengthen alliances')gain+=counts.alliances*.025;
      if(g.name==='Preserve peace')gain+=(state.war?-.08:.03);
      if(g.name==='Prepare for war')gain+=s.readiness*.002;
      g.progress=clamp(g.progress+gain,0,100);
      g.status=g.progress>=90?'achieved':'active';
    });
    s.goals=s.goals.filter(g=>g.status==='active'||g.lastReviewedYear>=state.year-2).slice(0,5);
  }

  function strategicHistory(k,assessment){
    const s=ensure(k);const signature=[s.type,s.posture,s.goals.map(g=>g.name).join('|'),assessment.threats[0]?.kingdomId||'none'].join('::');
    const last=s.history.at(-1);
    if(!last||last.signature!==signature||state.year-last.year>=10){
      s.history.push({year:state.year,signature,strategy:s.type,posture:s.posture,goals:s.goals.map(g=>g.name),topThreat:assessment.threats[0]?.name||null,topThreatScore:assessment.threats[0]?.threat||0});
      s.history=s.history.slice(-40);
      s.lastDecisionYear=state.year;
      const leader=alive().find(n=>String(n.id)===String(k.leaderId));
      if(leader&&state.year%10===0)M()?.remember?.(leader,`${k.name} adopted a ${s.posture} strategic posture.`,'politics',3,k.id,'strategy');
      log(`${k.name} is pursuing a ${s.posture} strategy under a ${s.type} kingdom doctrine.`);
    }
  }

  function step(){
    if(!state.running||state.tick%60!==0)return;
    const kingdoms=(state.kingdoms||[]).filter(k=>!k.civilWarRebel);
    kingdoms.forEach(k=>{
      const s=ensure(k),people=peopleOf(k),ss=settlementsOf(k);
      if(!people.length)return;
      if(state.year%12===0||!s.type)s.type=deriveStrategy(k);
      interestProfile(k,ss,people);
      const assessment=assessRelations(k,kingdoms);s.threats=assessment.threats;s.opportunities=assessment.opportunities;
      pickGoals(k,assessment);posture(k,assessment);progressGoals(k,assessment);strategicHistory(k,assessment);
    });
  }

  window.KINGDOM_STRATEGIC_AI={step,ensure,deriveStrategy,interestProfile,assessRelations,pickGoals,posture};
  state.registerSystem?.({name:'kingdom-strategic-ai',step,priority:104});
})();
