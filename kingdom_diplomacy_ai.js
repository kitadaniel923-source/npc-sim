// Phase 3B: diplomatic decision engine.
// Chooses diplomatic actions from kingdom strategy; the civilization layer remains responsible for relation calculation.
// State-only. No DOM listeners or render loops.
(() => {
  const state=window.SIM_STATE;if(!state)return;
  const STRATEGY=()=>window.KINGDOM_STRATEGIC_AI;
  const M=()=>window.NPC_MEMORY;
  const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,v));
  const kingdoms=()=>state.kingdoms.filter(k=>!k.civilWarRebel);
  const relation=(a,b)=>window.SOCIETY_CIVILIZATION_EVOLUTION?.relationScore?.(a,b)??0;
  const hasTreaty=(type,a,b)=>(state.diplomacy?.treaties||[]).some(t=>t.status==='active'&&t.type===type&&((String(t.a)===String(a)&&String(t.b)===String(b))||(String(t.a)===String(b)&&String(t.b)===String(a))));
  const pending=(type,a,b)=>(state.diplomacy?.proposals||[]).find(p=>p.status==='pending'&&p.type===type&&((String(p.from)===String(a)&&String(p.to)===String(b))||(String(p.from)===String(b)&&String(p.to)===String(a))));
  const pair=(a,b)=>[String(a),String(b)].sort().join(':');
  const log=t=>window.SIM_LOG?.(t);

  function ensure(){
    state.diplomacy=state.diplomacy||{relations:{},treaties:[],history:[]};
    state.diplomacy.relations=state.diplomacy.relations||{};
    state.diplomacy.treaties=state.diplomacy.treaties||[];
    state.diplomacy.history=state.diplomacy.history||[];
    state.diplomacy.proposals=Array.isArray(state.diplomacy.proposals)?state.diplomacy.proposals:[];
    return state.diplomacy;
  }

  function leader(k){return state.npcs.find(n=>n.alive&&String(n.id)===String(k.leaderId))||state.npcs.find(n=>n.alive&&String(n.faction||n.kingdomId)===String(k.id)&&['king','queen','emperor','empress','duke'].includes(n.roleId));}

  function makeProposal(type,from,to,reason){
    if(pending(type,from.id,to.id)||hasTreaty(type,from.id,to.id))return null;
    const p={id:`dip-proposal-${state.year}-${state.tick}-${Math.random().toString(36).slice(2,8)}`,type,from:from.id,to:to.id,createdYear:state.year,status:'pending',reason};
    state.diplomacy.proposals.push(p);return p;
  }

  function acceptProposal(p,from,to){
    if(p.status!=='pending')return false;
    const fs=from.strategy||{},ts=to.strategy||{},r=relation(from.id,to.id);
    let score=50+r*.38;
    if(p.type==='alliance')score+=((ts.interests?.security||50)*.25)+(ts.posture==='coalition-building'?12:0)-(ts.warWillingness||30)*.08;
    if(p.type==='trade-pact')score+=((ts.interests?.trade||50)*.35)+((ts.interests?.gold||50)*.12);
    if(p.type==='truce')score+=((ts.peacePreference||55)*.28)+((ts.survival||50)*.12);
    if(p.type==='non-aggression')score+=((ts.peacePreference||55)*.3)+((ts.interests?.security||50)*.16);
    if(p.type==='alliance'&&((fs.posture==='wartime'&&relation(from.id,to.id)<20)||(ts.posture==='wartime'&&relation(from.id,to.id)<20)))score-=20;
    const accepted=clamp(score)>=54;
    p.status=accepted?'accepted':'rejected';p.resolvedYear=state.year;p.score=Math.round(score*10)/10;
    if(accepted){
      const end=state.year+(p.type==='alliance'?12:p.type==='trade-pact'?8:p.type==='truce'?4:6);
      state.diplomacy.treaties.push({id:`dip-${state.year}-${state.tick}-${Math.random().toString(36).slice(2,8)}`,type:p.type,a:from.id,b:to.id,startYear:state.year,endYear:end,status:'active'});
      state.diplomacy.history.push({year:state.year,type:p.type,a:from.id,b:to.id,action:'accepted',reason:p.reason});
      from.stability=clamp((from.stability||70)+1.5);to.stability=clamp((to.stability||70)+1.5);
      const fl=leader(from),tl=leader(to);M()?.remember?.(fl,`${from.name} secured a ${p.type} with ${to.name}.`,'diplomacy',3,from.id,'trust');M()?.remember?.(tl,`${to.name} accepted a ${p.type} with ${from.name}.`,'diplomacy',3,to.id,'trust');
      log(`${from.name} and ${to.name} agreed to a ${p.type}.`);
    } else state.diplomacy.history.push({year:state.year,type:p.type,a:from.id,b:to.id,action:'rejected',reason:p.reason});
    return accepted;
  }

  function bestCandidate(k,type){
    const s=k.strategy||{},others=kingdoms().filter(x=>x.id!==k.id&&!((state.borderWars||[]).some(w=>(String(w.a)===String(k.id)&&String(w.b)===String(x.id))||(String(w.a)===String(x.id)&&String(w.b)===String(k.id)))));
    const scored=others.map(o=>{
      const r=relation(k.id,o.id),t=(s.threats||[]).find(x=>String(x.kingdomId)===String(o.id)),op=(s.opportunities||[]).find(x=>String(x.kingdomId)===String(o.id));
      let v=r;
      if(type==='alliance')v+=((t?.threat||0)*.75)+((o.strategy?.type==='diplomatic')?8:0)-((op?.opportunity||0)*.25);
      if(type==='trade-pact')v+=(op?.opportunity||0)*.6+((o.society?.prosperity||50)*.12);
      if(type==='truce')v+=(t?.threat||0)*.55+(100-(o.stability||70))*.18;
      if(type==='non-aggression')v+=(t?.threat||0)*.45+(s.peacePreference||55)*.3;
      if(hasTreaty('alliance',k.id,o.id))v=-999;
      if(hasTreaty('trade-pact',k.id,o.id)&&type!=='alliance')v=-999;
      return {k:o,score:v};
    }).sort((a,b)=>b.score-a.score);
    return scored[0]?.k||null;
  }

  function chooseAction(k){
    STRATEGY()?.ensure?.(k);const s=k.strategy||{};const counts=(state.diplomacy.treaties||[]).filter(t=>t.status==='active'&&(String(t.a)===String(k.id)||String(t.b)===String(k.id)));
    const hasAlliance=counts.some(t=>t.type==='alliance');
    if(s.posture==='coalition-building'||((s.readiness||0)<45&&(s.interests?.security||0)>65)&&!hasAlliance)return 'alliance';
    if((s.interests?.trade||0)>62)return 'trade-pact';
    if(s.posture==='defensive'&&s.peacePreference>50)return 'non-aggression';
    if(s.posture==='watchful'&&s.peacePreference>45)return 'truce';
    if(s.peacePreference>70&&!hasAlliance)return 'alliance';
    return null;
  }

  function step(){
    if(!state.running||state.tick%120!==0)return;
    const d=ensure();
    d.proposals=d.proposals.filter(p=>p.status==='pending'?state.year-p.createdYear<3:true).slice(-80);
    const ks=kingdoms();
    ks.forEach(k=>STRATEGY()?.ensure?.(k));
    ks.forEach(from=>{
      const type=chooseAction(from);if(!type)return;
      const to=bestCandidate(from,type);if(!to)return;
      const reason=type==='alliance'?`Security cooperation is valuable against the kingdom's current threats.`:type==='trade-pact'?`Trade can improve prosperity and secure access to markets.`:type==='truce'?`A temporary peace creates time to recover and reorganize.`:`Avoiding conflict protects the kingdom while strategic conditions change.`;
      const p=makeProposal(type,from,to,reason);if(p)acceptProposal(p,from,to);
    });
    d.proposals=d.proposals.slice(-80);d.history=d.history.slice(-80);
  }

  window.KINGDOM_DIPLOMACY_AI={step,ensure,makeProposal,acceptProposal};
  state.registerSystem?.({name:'kingdom-diplomacy-ai',step,priority:106});
})();
