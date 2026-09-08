// Persistent regional history: turns local events into eras, legacies and long-running regional identities.
(() => {
  const state=window.SIM_STATE;if(!state)return;
  const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,v));
  const alive=()=>state.npcs.filter(n=>n.alive);
  const log=t=>window.SIM_API?.log?.(t);
  const memory=()=>window.NPC_MEMORY;
  const REGION_LIMIT=24;
  const ERA_TYPES={
    peace:{label:'Age of Peace',pressure:{stability:1,trade:.35,fertility:.2}},
    prosperity:{label:'Age of Prosperity',pressure:{wealth:1,trade:.8,knowledge:.3}},
    war:{label:'Age of War',pressure:{military:1,grievance:.7,unity:.25}},
    famine:{label:'Age of Hunger',pressure:{grievance:1,migration:.8,health:.5}},
    plague:{label:'Age of Plague',pressure:{health:1,migration:.9,fear:.6}},
    discovery:{label:'Age of Discovery',pressure:{knowledge:1,trade:.6,exploration:.8}},
    unrest:{label:'Age of Unrest',pressure:{grievance:1,politics:.7,division:.6}},
    faith:{label:'Age of Pilgrimage',pressure:{faith:1,culture:.7,travel:.4}}
  };

  function ensure(s){
    s.history=s.history||[];
    s.regionHistory=s.regionHistory||{events:[],eras:[],legacies:[],identity:{},score:{war:0,famine:0,plague:0,discovery:0,prosperity:0,faith:0,unrest:0,peace:0}};
    s.regionHistory.events=s.regionHistory.events||[];s.regionHistory.eras=s.regionHistory.eras||[];s.regionHistory.legacies=s.regionHistory.legacies||[];s.regionHistory.identity=s.regionHistory.identity||{};s.regionHistory.score=s.regionHistory.score||{};
  }

  function residents(s){return alive().filter(n=>n.settlementId===s.id)}
  function classify(text){
    const t=String(text||'').toLowerCase();
    if(/war|battle|siege|raid|invasion|uprising|rebellion|civil war/.test(t))return'war';
    if(/famine|hunger|harvest failed|food shortage/.test(t))return'famine';
    if(/plague|disease|epidemic/.test(t))return'plague';
    if(/discover|explor|ruin|pass|harbor|deposit|found new/.test(t))return'discovery';
    if(/prosper|market|trade|merchant|wealth|fair/.test(t))return'prosperity';
    if(/pilgrim|holy|faith|religious|temple|shrine/.test(t))return'faith';
    if(/unrest|protest|revolt|crisis|dispute|grievance/.test(t))return'unrest';
    if(/peace|treaty|truce|festival|celebrate/.test(t))return'peace';
    return'peace';
  }

  function record(s,text,type,source='simulation',weight=1,details={}){
    ensure(s);const kind=type||classify(text),e={year:state.year,tick:state.tick,type:kind,text,source,weight,details};
    const events=s.regionHistory.events;
    const last=events[0];
    if(last&&last.text===text&&last.year===state.year)return last;
    events.unshift(e);s.regionHistory.score[kind]=(s.regionHistory.score[kind]||0)+weight;
    s.history=s.history||[];s.history.push(`Year ${state.year}: ${text}`);s.history=s.history.slice(-60);events.splice(REGION_LIMIT);return e;
  }

  function infer(s){
    ensure(s);
    for(const h of (s.history||[]).slice(-8)) record(s,h,classify(h),'history',.35);
    const p=residents(s),food=s.resources?.food||0,stability=s.stability||50,pros=s.economy?.prosperity||0;
    if(stability>78&&pros>68)record(s,`${s.name} enters a period of stability and prosperity.`,'prosperity','emergent',.8);
    if(food<Math.max(8,p.length*.35))record(s,`${s.name} faces dangerous food pressure.`,'famine','emergent',.9);
    if(state.plague)record(s,`${s.name} is threatened by plague.`,'plague','emergent',.8);
    if(state.war&&p.some(n=>['soldier','knight','captain','general','marshal'].includes(n.roleId)))record(s,`${s.name} is living through wartime mobilization.`,'war','emergent',.7);
  }

  function intensity(s,type,windowYears=40){
    ensure(s);const cutoff=state.year-windowYears;return s.regionHistory.events.filter(e=>e.year>=cutoff&&e.type===type).reduce((a,e)=>a+(e.weight||1),0);
  }

  function chooseEra(s){
    const types=['war','famine','plague','discovery','prosperity','faith','unrest','peace'];
    const scores=types.map(t=>({t,v:intensity(s,t,30)})).sort((a,b)=>b.v-a.v);const top=scores[0];
    if(!top||top.v<1.8)return'peace';
    return top.t;
  }

  function advanceEra(s){
    ensure(s);const type=chooseEra(s),name=ERA_TYPES[type].label;const eras=s.regionHistory.eras,last=eras[0];
    if(last?.type===type){last.endYear=state.year;last.duration=Math.max(1,(last.endYear||state.year)-last.startYear);return;}
    const era={id:`era-${s.id}-${state.year}-${type}`,type,name,startYear:state.year,endYear:state.year,causes:s.regionHistory.events.slice(0,6).filter(e=>e.type===type).map(e=>e.text),effects:{...ERA_TYPES[type].pressure}};
    eras.unshift(era);eras.splice(8);
    if(last){last.endYear=Math.max(last.startYear,state.year-1);last.duration=last.endYear-last.startYear+1;}
    if(state.year>1)log(`${s.name} has entered ${name}.`);
  }

  function updateIdentity(s){
    ensure(s);const sc=s.regionHistory.score;const identity=[];
    const tests=[['warrior',sc.war,'war'],['resilient',sc.famine+sc.plague,'crisis'],['merchant',sc.prosperity,'prosperity'],['explorer',sc.discovery,'discovery'],['devout',sc.faith,'faith'],['restless',sc.unrest,'unrest'],['peaceful',sc.peace,'peace']];
    tests.sort((a,b)=>b[1]-a[1]).slice(0,3).forEach(x=>{if(x[1]>=2)identity.push(x[0]);});
    s.regionHistory.identity={traits:identity,dominantEra:s.regionHistory.eras[0]?.type||'peace',confidence:clamp(35+identity.length*18+(s.regionHistory.events.length*.8),0,100)};
  }

  function createLegacy(s){
    ensure(s);const ev=s.regionHistory.events[0];if(!ev||ev.year===state.year)return;
    const thresholds={war:5,famine:4,plague:3,discovery:3,prosperity:5,faith:4,unrest:4,peace:6};
    const score=intensity(s,ev.type,80);if(score<(thresholds[ev.type]||4))return;
    const label={war:'Battlefield Memory',famine:'Hunger Memory',plague:'Survivor Memory',discovery:'Discovery Legacy',prosperity:'Golden Age Memory',faith:'Sacred Tradition',unrest:'Rebellion Memory',peace:'Peaceful Tradition'}[ev.type]||'Regional Memory';
    if(s.regionHistory.legacies.some(x=>x.type===ev.type&&x.seedYear===ev.year))return;
    const legacy={id:`legacy-${s.id}-${ev.type}-${ev.year}`,type:ev.type,name:label,seedYear:ev.year,strength:clamp(35+score*3),text:`People of ${s.name} remember ${ev.text}`};
    s.regionHistory.legacies.unshift(legacy);s.regionHistory.legacies=s.regionHistory.legacies.slice(0,10);
    const p=residents(s).slice(0,8);p.forEach(n=>memory()?.remember(n,`My people remember ${ev.text}`,'regional_history',3.4,s.id,ev.type==='war'?'anger':'pride',4,true));
  }

  function feedConsequences(s){
    ensure(s);const id=s.regionHistory.identity||{},traits=id.traits||[];
    if(traits.includes('warrior')){s.infrastructure&&(s.infrastructure.defenses=Math.min(100,(s.infrastructure.defenses||0)+.01));}
    if(traits.includes('merchant')){s.infrastructure&&(s.infrastructure.roads=Math.min(100,(s.infrastructure.roads||0)+.01));s.economy&&(s.economy.marketAccess=clamp((s.economy.marketAccess||0)+.008));}
    if(traits.includes('explorer'))s.services&&(s.services.trade=clamp((s.services.trade||0)+.01));
    if(traits.includes('devout'))s.culture&&(s.culture.beliefStrength=clamp((s.culture.beliefStrength||40)+.01));
    if(traits.includes('resilient'))s.stability=clamp((s.stability||50)+.006);
    if(traits.includes('restless'))s.stability=clamp((s.stability||50)-.004);
  }

  function regionalGroups(){
    const ss=state.settlements||[];const groups=[];const seen=new Set();
    for(const s of ss){if(seen.has(s.id))continue;const cluster=ss.filter(x=>Math.hypot((x.x||0)-(s.x||0),(x.y||0)-(s.y||0))<260);cluster.forEach(x=>seen.add(x.id));groups.push(cluster);}
    return groups;
  }

  function buildCrossSettlementHistory(){
    regionalGroups().forEach(group=>{
      if(group.length<2)return;
      const anchor=group.slice().sort((a,b)=>(b.population||0)-(a.population||0))[0];ensure(anchor);
      const kinds={war:0,famine:0,plague:0,discovery:0,prosperity:0,faith:0,unrest:0,peace:0};
      group.forEach(s=>{ensure(s);s.regionHistory.events.slice(0,8).forEach(e=>{kinds[e.type]=(kinds[e.type]||0)+(e.weight||1)});});
      const dominant=Object.entries(kinds).sort((a,b)=>b[1]-a[1])[0];
      anchor.regionHistory.regionalCluster={settlementIds:group.map(x=>x.id),dominantEvent:dominant?.[0]||'peace',strength:clamp(dominant?.[1]||0)};
    });
  }

  function step(){
    if(!state.running)return;
    const ss=state.settlements||[];ss.forEach(s=>{
      ensure(s);infer(s);
      if(state.tick%60===0)advanceEra(s);
      if(state.tick%90===0)createLegacy(s);
      updateIdentity(s);feedConsequences(s);
    });
    if(state.tick%120===0)buildCrossSettlementHistory();
  }

  window.EVERGLEN_REGIONAL_HISTORY={ensure,record,infer,intensity,advanceEra,updateIdentity,createLegacy};
  if(state.registerSystem)state.registerSystem({name:'regional-history',step,priority:91});
})();
