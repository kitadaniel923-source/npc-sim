// Phase 4E: trade networks, merchant influence and medieval exploration.
(() => {
  const state=window.SIM_STATE;if(!state)return;
  const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,v));
  const alive=()=>state.npcs.filter(n=>n.alive);
  const settlements=()=>state.settlements||[];
  const kingdom=id=>state.kingdoms?.find(k=>String(k.id)===String(id))||null;
  const log=text=>window.SIM_API?.log?.(text);
  const memory=()=>window.NPC_MEMORY;
  const has=(n,t)=>window.NPC_PERSONALITY?.has?.(n,t)||n.trait===t||n.traits?.includes(t);
  const personalityScore=(n,k)=>window.NPC_PERSONALITY?.score?.(n,k)??50;
  const dist=(a,b)=>Math.hypot((a.x||0)-(b.x||0),(a.y||0)-(b.y||0));
  const key=(a,b)=>[String(a),String(b)].sort().join(':');

  const exploration={initialized:false,missions:[],discoveries:[],tradeHistory:[],tick:0};

  function ensureKingdom(k){
    if(!k)return;
    k.trade=k.trade||{partners:[],routes:[],wealth:0,dependence:{},history:[]};
    k.exploration=k.exploration||{discoveries:[],missions:[],frontiers:[],prestige:0};
  }
  function ensureSettlement(s){
    s.trade=s.trade||{volume:0,partners:[],exports:{},imports:{},hubScore:0,lastRouteYear:null};
    s.exploration=s.exploration||{discovered:false,frontier:false,visitors:0,discoveries:[]};
  }

  function resourcesValue(s){
    const r=s.resources||{};
    return (r.food||0)*.6+(r.grain||0)*.45+(r.wood||0)*.35+(r.stone||0)*.25+(r.iron||0)*1.2+(r.tools||0)*1+(r.weapons||0)*1.2+(r.armor||0)*1.3+(r.cloth||0)*.8+(r.medicine||0)*1.1+(r.books||0)*2;
  }

  function chooseTradePair(){
    const ss=settlements();if(ss.length<2)return null;
    let best=null,bestScore=-Infinity;
    for(const a of ss){
      ensureSettlement(a);
      for(const b of ss){
        if(a.id===b.id)continue;
        ensureSettlement(b);
        const d=dist(a,b);if(d>700)continue;
        const ak=kingdom(a.kingdomId),bk=kingdom(b.kingdomId);
        if(ak&&bk&&ak.id!==bk.id){
          const rel=state.diplomacy?.relations?.[key(ak.id,bk.id)]?.score??0;
          if(rel<-55)continue;
        }
        const ar=a.resources||{},br=b.resources||{};
        const source=Object.keys(ar).map(r=>({r,v:(ar[r]||0)-(b.resources?.[r]||0)})).sort((x,y)=>y.v-x.v)[0];
        if(!source||source.v<=6)continue;
        const score=source.v*1.6+((a.trade.hubScore||0)+(b.trade.hubScore||0))*.6-d*.018;
        if(score>bestScore)bestScore=score,best={a,b,resource:source.r,score};
      }
    }
    return best;
  }

  function establishRoute(a,b,resource){
    ensureSettlement(a);ensureSettlement(b);
    const logistics=window.EVERGLEN_LOGISTICS;
    if(logistics?.createRoute){
      const route=logistics.createRoute(a,b,resource);
      route.kind=route.kind||'caravan';
      route.origin='trade-exploration';
      route.safety=clamp((a.stability||60)*.45+(b.stability||60)*.45);
    }
    const ak=kingdom(a.kingdomId),bk=kingdom(b.kingdomId);
    a.trade.volume=(a.trade.volume||0)+2;b.trade.volume=(b.trade.volume||0)+2;
    if(!a.trade.partners.includes(b.id))a.trade.partners.push(b.id);
    if(!b.trade.partners.includes(a.id))b.trade.partners.push(a.id);
    if(ak)ensureKingdom(ak),ak.trade.routes.push({from:a.id,to:b.id,resource,year:state.year});
    if(bk)ensureKingdom(bk),bk.trade.routes.push({from:b.id,to:a.id,resource,year:state.year});
    a.trade.exports[resource]=(a.trade.exports[resource]||0)+1;
    b.trade.imports[resource]=(b.trade.imports[resource]||0)+1;
    a.trade.lastRouteYear=state.year;b.trade.lastRouteYear=state.year;
    exploration.tradeHistory.push({year:state.year,from:a.id,to:b.id,resource});
    exploration.tradeHistory=exploration.tradeHistory.slice(-100);
    return true;
  }

  function updateHub(s){
    ensureSettlement(s);
    const merchants=alive().filter(n=>n.settlementId===s.id&&['merchant','trader','shopkeeper','peddler'].includes(n.roleId)).length;
    s.trade.hubScore=clamp((s.trade.volume||0)*1.8+merchants*6+(s.infrastructure?.roads||0)*.45+(s.services?.trade||0)*.5+(resourcesValue(s)*.015));
    if(s.trade.hubScore>55){
      s.trade.status='major-hub';
      if(s.type==='city')s.trade.status='regional-market';
    } else if(s.trade.hubScore>25)s.trade.status='market-town';
    else s.trade.status='local-market';
  }

  function tradeInfluenceStep(){
    const ss=settlements();
    ss.forEach(updateHub);
    const merchants=alive().filter(n=>['merchant','trader','shopkeeper','peddler','sailor'].includes(n.roleId));
    merchants.slice(0,Math.min(merchants.length,80)).forEach(n=>{
      const s=ss.find(x=>x.id===n.settlementId);if(!s)return;
      const k=kingdom(s.kingdomId);if(k)ensureKingdom(k);
      n.tradeInfluence=clamp((n.tradeInfluence||0)+((s.trade.hubScore||0)>35?0.04:0.015));
      if(n.tradeInfluence>65&&personalityScore(n,'charisma')>55)n.influence=(n.influence||0)+.025;
      if(k){
        k.trade.wealth=(k.trade.wealth||0)+.015*(1+(n.tradeInfluence||0)/100);
        const partnerCount=s.trade.partners?.length||0;
        k.trade.dependence[s.id]=clamp((k.trade.dependence[s.id]||0)+partnerCount*.002);
      }
    });
  }

  function frontierSettlements(){
    const ss=settlements();
    return ss.filter(s=>{
      const neighbors=ss.filter(x=>x.id!==s.id&&dist(s,x)<250);
      return neighbors.length<=2 || s.specialization==='trade' || (s.type==='village'&&s.exploration?.frontier);
    });
  }

  function chooseExplorer(){
    return alive().filter(n=>n.age>=18&&n.age<=55&&n.settlementId&&(['sailor','merchant','trader','explorer','scout','hunter'].includes(n.roleId)||has(n,'curious')||has(n,'adventurous')||personalityScore(n,'curiosity')>72))
      .sort((a,b)=>(personalityScore(b,'curiosity')+personalityScore(b,'bravery')+personalityScore(b,'adaptability'))-(personalityScore(a,'curiosity')+personalityScore(a,'bravery')+personalityScore(a,'adaptability')))[0]||null;
  }

  function startMission(){
    if(state.year<8||exploration.missions.length>=8)return false;
    const explorer=chooseExplorer();if(!explorer)return false;
    const origin=settlements().find(s=>s.id===explorer.settlementId);if(!origin)return false;
    if(exploration.missions.some(m=>m.explorerId===explorer.id&&m.status==='active'))return false;
    const angle=Math.random()*Math.PI*2,range=350+Math.random()*600;
    const target={x:origin.x+Math.cos(angle)*range,y:origin.y+Math.sin(angle)*range};
    const mission={id:`exp-${exploration.missions.length+1}-${state.year}-${exploration.tick}`,explorerId:explorer.id,originId:origin.id,target,startedYear:state.year,progress:0,status:'active',risk:clamp(25+(range-350)*.045+(state.war?15:0)),cargo:[]};
    exploration.missions.push(mission);
    ensureSettlement(origin);origin.exploration.frontier=true;origin.exploration.visitors=(origin.exploration.visitors||0)+1;
    explorer.lastAction='Led an expedition';
    memory()?.experience(explorer,`I left ${origin.name} to explore the frontier.`,'exploration',3.2,origin.id,'excitement',-4,true);
    log(`${explorer.name} departed ${origin.name} on an expedition.`);
    return true;
  }

  function resolveMission(m){
    const explorer=alive().find(n=>n.id===m.explorerId),origin=settlements().find(s=>s.id===m.originId);
    const successScore=clamp(55+(explorer?(personalityScore(explorer,'curiosity')-50)*.25:0)+(explorer?(personalityScore(explorer,'bravery')-50)*.18:0)-m.risk*.35);
    const success=Math.random()*100<successScore;
    if(!success){
      m.status='lost';m.finishedYear=state.year;
      if(explorer){explorer.mood=clamp((explorer.mood||60)-12);explorer.grievance=(explorer.grievance||0)+4;memory()?.experience(explorer,'My expedition failed and the frontier resisted me.','exploration_failure',4,null,'fear',5,true);}
      log(`${explorer?.name||'An explorer'} returned from the frontier with no discovery.`);
      return;
    }
    m.status='complete';m.finishedYear=state.year;
    const discoveries=['New fertile valley','Rich iron deposits','Untapped timberland','Ancient ruins','Mountain pass','Coastal harbor','Salt flats','Rare medicinal herbs'];
    const discovery=discoveries[Math.floor(Math.random()*discoveries.length)];
    const d={id:`discovery-${exploration.discoveries.length+1}`,name:discovery,year:state.year,originId:m.originId,x:m.target.x,y:m.target.y,claimed:false};
    exploration.discoveries.push(d);
    if(origin){ensureSettlement(origin);origin.exploration.discoveries.push(d.id);origin.exploration.frontier=true;origin.resources=origin.resources||{};if(/iron/.test(discovery.toLowerCase()))origin.resources.iron=(origin.resources.iron||0)+12;if(/timber/.test(discovery.toLowerCase()))origin.resources.wood=(origin.resources.wood||0)+18;if(/salt/.test(discovery.toLowerCase()))origin.resources.cloth=(origin.resources.cloth||0)+6;if(/medicinal/.test(discovery.toLowerCase()))origin.resources.medicine=(origin.resources.medicine||0)+8;}
    if(explorer){explorer.explorationCount=(explorer.explorationCount||0)+1;explorer.reputation=clamp((explorer.reputation||50)+6);explorer.influence=(explorer.influence||0)+1.5;memory()?.experience(explorer,`I discovered ${discovery}.`,'discovery',4,d.id,'pride',-6,true);}
    exploration.missions=exploration.missions.filter(x=>x!==m);
    log(`${explorer?.name||'Explorers'} discovered ${discovery}.`);
    return d;
  }

  function missionStep(){
    exploration.missions.forEach(m=>{
      if(m.status!=='active')return;
      m.progress+=.16+Math.random()*.12;
      m.risk=clamp(m.risk+(state.war?.035:0));
      if(m.progress>=1)resolveMission(m);
    });
    exploration.missions=exploration.missions.filter(m=>m.status==='active'||state.year-m.startedYear<3);
    if(state.tick%90===0&&Math.random()<.45)startMission();
  }

  function diplomacyTradeFeedback(){
    state.kingdoms?.forEach(k=>{
      ensureKingdom(k);
      const tradeRoutes=k.trade.routes||[];
      const partners=new Set();
      tradeRoutes.forEach(r=>{const other=state.settlements.find(s=>s.id===r.to);if(other&&other.kingdomId!==k.id)partners.add(other.kingdomId)});
      k.trade.partners=[...partners].slice(0,20);
      const breadth=partners.size;
      k.trade.wealth=(k.trade.wealth||0)*(0.995)+breadth*.15;
      k.economy=k.economy||{};
      k.economy.tradePower=clamp((k.economy.tradePower||0)+breadth*.02+(k.trade.wealth||0)*.001,0,100);
      if(breadth>=2&&k.strategy)k.strategy.opportunities=k.strategy.opportunities||[],k.strategy.opportunities.push({type:'trade-network',value:breadth}).slice?.();
    });
  }

  function step(){
    if(!state.running)return;
    exploration.tick++;
    settlements().forEach(ensureSettlement);
    state.kingdoms?.forEach(ensureKingdom);
    if(state.tick%24===0){const pair=chooseTradePair();if(pair)establishRoute(pair.a,pair.b,pair.resource);}
    if(state.tick%18===0)tradeInfluenceStep();
    if(state.tick%30===0)diplomacyTradeFeedback();
    if(state.tick%6===0)missionStep();
  }

  window.EVERGLEN_TRADE_EXPLORATION={step,establishRoute,startMission,discoveries:exploration.discoveries,missions:exploration.missions};
  if(state.registerSystem)state.registerSystem({name:'trade-exploration',step,priority:86});
})();
