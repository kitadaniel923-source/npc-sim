// Phase 5I: economic cycles, crises, contagion and recovery.
(() => {
  const state=window.SIM_STATE;if(!state)return;
  const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,v));
  const ss=()=>state.settlements||[];
  const ks=()=>state.kingdoms||[];
  const alive=()=> (state.npcs||[]).filter(n=>n.alive);
  const memory=window.NPC_MEMORY;
  const log=t=>window.SIM_API?.log?.(t);
  const TYPES={boom:0,recession:1,inflation:2,famine:3,credit_crisis:4,financial_crisis:5,recovery:6};
  function ensureSettlement(s){
    s.economyCycle=s.economyCycle||{};const e=s.economyCycle;
    e.phase=e.phase||'stable';e.confidence=e.confidence??55;e.demandShock=e.demandShock??0;e.supplyShock=e.supplyShock??0;e.unemployment=e.unemployment??0;e.inflation=e.inflation??0;e.bankStress=e.bankStress??0;e.foodStress=e.foodStress??0;e.businessFailures=e.businessFailures??0;e.creditTightness=e.creditTightness??0;e.history=e.history||[];e.lastShockYear=e.lastShockYear??0;e.duration=e.duration??0;
    return e;
  }
  function ensureKingdom(k){
    k.economicCycle=k.economicCycle||{};const e=k.economicCycle;
    e.phase=e.phase||'stable';e.confidence=e.confidence??55;e.growth=e.growth??0;e.inflation=e.inflation??0;e.unemployment=e.unemployment??0;e.debtStress=e.debtStress??0;e.bankStress=e.bankStress??0;e.tradeStress=e.tradeStress??0;e.history=e.history||[];e.lastShockYear=e.lastShockYear??0;e.duration=e.duration??0;e.crisisCount=e.crisisCount??0;
    return e;
  }
  function snap(v){return Number((v||0).toFixed(3));}
  function notify(type,text){
    if(type==='recovery'||type==='boom'||type==='financial-crisis'||type==='recession'||type==='famine'||type==='inflation-shock')window.EVERGLEN_NOTIFY?.({type:type==='financial-crisis'?'war-declared':type,message:text});
  }
  function event(e,kind,severity,detail){
    e.history.push({year:state.year,type:kind,severity:snap(severity),detail});e.history=e.history.slice(-40);e.lastShockYear=state.year;e.duration=0;
  }
  function triggerNpcEffects(s,e){
    const locals=alive().filter(n=>n.settlementId===s.id);if(!locals.length)return;
    const recession=e.phase==='recession'||e.phase==='financial-crisis';
    const famine=e.phase==='famine';
    const inflation=e.phase==='inflation';
    locals.forEach(n=>{
      if(recession)n.grievance=clamp((n.grievance||0)+.06*state.speed);
      if(famine)n.grievance=clamp((n.grievance||0)+.1*state.speed);
      if(inflation&&n.wealth>20)n.wealth=Math.max(0,n.wealth-.012*n.wealth*state.speed);
      if(recession&&Math.random()<.018*state.speed&&memory?.experience)memory.experience(n,'The economy collapsed and work became scarce.','economic-crisis',3,s.id,'fear',4,false);
      if(famine&&Math.random()<.015*state.speed&&memory?.experience)memory.experience(n,'Food became scarce during an economic crisis.','famine',4,s.id,'fear',6,false);
      if(n.business&&recession)n.business.capital=Math.max(0,(n.business.capital||0)-.02*state.speed);
      if(recession&&n.age>=16&&Math.random()<.02*state.speed)n.lastAction='Searching for work during recession';
    });
  }
  function settlementSignals(s){
    const e=ensureSettlement(s),m=s.market||{},f=s.finance||{},p=Math.max(1,alive().filter(n=>n.settlementId===s.id).length);
    const priceIndex=m.priceIndex||1,food=(s.resources?.food||0)/Math.max(1,p*.8),credit=f.bankHealth||50,pros=s.prosperity||50,stability=s.stability||60;
    const unemployment=(s.labor?.unemployed||0)/Math.max(1,s.labor?.workers||p);
    const supplyAccess=s.supplyChain?.access??s.logistics?.access??60;
    e.unemployment=clamp(unemployment*100);e.inflation=clamp((priceIndex-1)*100,-25,80);e.foodStress=clamp((1-food)*100);e.bankStress=clamp(100-credit);e.creditTightness=clamp(f.creditRate?((f.creditRate-.06)/.1*100):45);e.demandShock=clamp(55-pros);
    e.supplyShock=clamp((60-supplyAccess)+e.foodStress*.35);
    const growth=pros-50-e.unemployment*.45-e.inflation*.22-e.foodStress*.22-e.bankStress*.15;
    return {e,p,priceIndex,food,credit,pros,stability,growth};
  }
  function choosePhase(s){
    const a=settlementSignals(s),e=a.e;
    let phase='stable';
    if(e.foodStress>68&&a.food<.4)phase='famine';
    else if(e.bankStress>58&&e.creditTightness>50)phase='financial-crisis';
    else if(e.inflation>28&&e.demandShock>18)phase='inflation';
    else if(e.unemployment>30&&a.growth<-8)phase='recession';
    else if(a.growth>14&&e.unemployment<12&&e.inflation<18)phase='boom';
    else if(['recession','financial-crisis','famine','inflation'].includes(e.phase)&&a.growth>2&&e.foodStress<45&&e.bankStress<45)phase='recovery';
    return {a,phase};
  }
  function transition(s){
    const e=ensureSettlement(s),c=choosePhase(s),next=c.phase,old=e.phase;
    e.duration++;
    if(next!==old){
      e.phase=next;e.confidence=clamp(e.confidence+(next==='boom'?8:next==='recovery'?6:next==='stable'?3:-12));
      event(e,next, next==='boom'?15:next==='recovery'?8:35,`${s.name}: ${old} -> ${next}`);
      if(next==='recession')notify('recession',`${s.name} entered a recession.`);
      if(next==='famine')notify('famine',`${s.name} entered an economic famine.`);
      if(next==='inflation')notify('inflation-shock',`${s.name} is experiencing an inflation shock.`);
      if(next==='financial-crisis')notify('financial-crisis',`${s.name} entered a financial crisis.`);
      if(next==='boom')notify('boom',`${s.name} entered an economic boom.`);
      if(next==='recovery')notify('recovery',`${s.name} is recovering economically.`);
      if(memory&&alive().some(n=>n.settlementId===s.id)&&['recession','famine','financial-crisis'].includes(next)){
        const n=alive().find(n=>n.settlementId===s.id);if(n)memory.remember?.(n,`I lived through a ${next}.`,'economic-crisis',3,s.id,'fear');
      }
    }
    applySettlementConsequences(s,c.a);
  }
  function applySettlementConsequences(s,a){
    const e=ensureSettlement(s),m=s.market||{};let prosperity=s.prosperity||50,stability=s.stability||60;
    if(e.phase==='boom'){prosperity+=.16;stability+=.04;e.confidence+=.18;}
    if(e.phase==='recovery'){prosperity+=.1;stability+=.025;e.confidence+=.1;}
    if(e.phase==='recession'){prosperity-=.14;stability-=.055;e.confidence-=.22;s.tradeVolume=Math.max(0,(s.tradeVolume||0)-.5);}
    if(e.phase==='famine'){prosperity-=.3;stability-=.12;s.foodSecurity=clamp((s.foodSecurity||45)-.16);}
    if(e.phase==='inflation'){prosperity-=.12;stability-=.05;s.marketInflation=clamp((s.marketInflation||0)+.004);}
    if(e.phase==='financial-crisis'){prosperity-=.22;stability-=.08;e.confidence-=.3;}
    s.prosperity=clamp(prosperity,0,100);s.stability=clamp(stability,0,100);e.confidence=clamp(e.confidence);
    triggerNpcEffects(s,e);
    if(e.phase==='recession'&&state.tick%36===0&&Math.random()<.2){e.businessFailures++;m.businessFailures=(m.businessFailures||0)+1;}
    if(e.phase==='financial-crisis'&&s.finance){s.finance.trust=clamp((s.finance.trust||50)-.5);s.finance.bankHealth=clamp((s.finance.bankHealth||45)-.35);}
  }
  function kingdomSignals(k){
    const e=ensureKingdom(k),locals=ss().filter(s=>s.kingdomId===k.id),n=locals.length||1;
    const avg=locals.reduce((x,s)=>x+(ensureSettlement(s).phase==='boom'?2:ensureSettlement(s).phase==='recession'?-1:ensureSettlement(s).phase==='famine'?-2:ensureSettlement(s).phase==='financial-crisis'?-2.5:ensureSettlement(s).phase==='inflation'?-1.5:1),0)/n;
    const f=k.finance||{},market=locals.reduce((x,s)=>x+(s.market?.priceIndex||1),0)/n||1;
    e.growth=snap(avg*3+(k.power||30)*.03-(f.deficit||0)*.05);e.inflation=clamp((market-1)*100);e.unemployment=clamp(locals.reduce((x,s)=>x+(s.economyCycle?.unemployment||0),0)/n);e.debtStress=clamp(((f.debt||0)/Math.max(20,f.treasury||50))*55);e.bankStress=clamp(100-(locals.reduce((x,s)=>x+(s.finance?.bankHealth||55),0)/n));e.tradeStress=clamp(50-(k.strategy?.opportunities?.trade||0));
    return e;
  }
  function kingdomPhase(k){
    const e=kingdomSignals(k),old=e.phase;let next='stable';
    if(e.bankStress>63||e.debtStress>72)next='financial-crisis';
    else if(e.inflation>30&&e.tradeStress>30)next='inflation';
    else if(e.unemployment>34&&e.growth<-5)next='recession';
    else if(e.growth>5&&e.unemployment<16&&e.inflation<18)next='boom';
    else if(['recession','financial-crisis','inflation'].includes(old)&&e.growth>-1&&e.bankStress<55)next='recovery';
    e.duration++;
    if(next!==old){e.phase=next;e.confidence=clamp(e.confidence+(next==='boom'?10:next==='recovery'?7:next==='stable'?2:-14));e.crisisCount+=['recession','financial-crisis','inflation'].includes(next)?1:0;e.history.push({year:state.year,type:next,growth:e.growth,inflation:e.inflation,unemployment:e.unemployment});e.history=e.history.slice(-50);if(k.strategy)k.strategy.history=k.strategy.history||[],k.strategy.history.push({year:state.year,economicPhase:next});if(['recession','financial-crisis','inflation','famine'].includes(next))log(`${k.name} entered ${next}.`);}
    applyKingdomConsequences(k,e);
  }
  function applyKingdomConsequences(k,e){
    if(e.phase==='boom'){k.wealth=(k.wealth||0)+.35;k.legitimacy=clamp((k.legitimacy||55)+.025);k.power=Math.min(100,(k.power||25)+.03);}
    if(e.phase==='recovery'){k.wealth=(k.wealth||0)+.18;k.legitimacy=clamp((k.legitimacy||55)+.015);}
    if(e.phase==='recession'){k.wealth=Math.max(0,(k.wealth||0)-.28);k.legitimacy=clamp((k.legitimacy||55)-.045);k.power=Math.max(0,(k.power||25)-.03);k.tension=clamp((k.tension||0)+.08);}
    if(e.phase==='famine'){k.wealth=Math.max(0,(k.wealth||0)-.45);k.legitimacy=clamp((k.legitimacy||55)-.1);k.tension=clamp((k.tension||0)+.16);}
    if(e.phase==='inflation'){k.wealth=Math.max(0,(k.wealth||0)-.18);k.legitimacy=clamp((k.legitimacy||55)-.06);k.tension=clamp((k.tension||0)+.08);}
    if(e.phase==='financial-crisis'){k.wealth=Math.max(0,(k.wealth||0)-.55);k.legitimacy=clamp((k.legitimacy||55)-.14);k.tension=clamp((k.tension||0)+.22);if(k.finance){k.finance.credit=clamp((k.finance.credit||50)-.5);k.finance.debt=(k.finance.debt||0)+.12;}}
    if(e.phase==='recovery'){k.tension=clamp((k.tension||0)-.06);}
  }
  function contagion(){
    const all=ss();all.forEach(s=>{const e=ensureSettlement(s);if(!['recession','financial-crisis','famine','inflation'].includes(e.phase))return;const k=ks().find(k=>k.id===s.kingdomId);const neighbors=all.filter(t=>t.id!==s.id&&Math.hypot((t.x||0)-(s.x||0),(t.y||0)-(s.y||0))<520);neighbors.forEach(t=>{const te=ensureSettlement(t);const chance=e.phase==='financial-crisis'?.025:e.phase==='famine'?.018:.012;if(Math.random()<chance*state.speed){te.confidence=clamp(te.confidence-2);if(e.phase==='famine')te.foodStress=clamp(te.foodStress+5);if(e.phase==='financial-crisis')te.bankStress=clamp(te.bankStress+4);if(e.phase==='inflation')te.inflation=clamp(te.inflation+4);}});if(k&&e.phase==='recession'&&k.strategy)k.strategy.opportunities=k.strategy.opportunities||{};});
  }
  function counterCyclicPolicy(k){
    const e=ensureKingdom(k),f=k.finance;if(!f)return;
    if(e.phase==='recession'||e.phase==='famine'){f.spending=f.spending||{};f.spending.relief=Math.max(f.spending.relief||0,.2);f.spending.infrastructure=Math.max(f.spending.infrastructure||0,.2);}
    if(e.phase==='boom'){f.spending=f.spending||{};f.spending.reserves=Math.max(f.spending.reserves||0,.16);}
    if(e.phase==='financial-crisis'){f.spending=f.spending||{};f.spending.relief=Math.max(f.spending.relief||0,.22);e.confidence=clamp(e.confidence-.1);}
    if(e.phase==='recovery'&&f.credit<55)f.credit=clamp(f.credit+.15);
  }
  function step(){
    if(!state.running)return;
    if(state.tick%24===0)ss().forEach(transition);
    if(state.tick%36===0)ks().forEach(kingdomPhase);
    if(state.tick%48===0)contagion();
    if(state.tick%30===0)ks().forEach(counterCyclicPolicy);
    ss().forEach(s=>{const e=ensureSettlement(s);s.economicPhase=e.phase;s.economicConfidence=e.confidence;s.economicInflation=e.inflation;s.economicUnemployment=e.unemployment;});
    ks().forEach(k=>{const e=ensureKingdom(k);k.economicPhase=e.phase;k.economicConfidence=e.confidence;});
  }
  window.EVERGLEN_ECONOMIC_CYCLES={step,ensureSettlement,ensureKingdom,settlementSignals,kingdomSignals};
  if(state.registerSystem)state.registerSystem({name:'economic-cycles',step,priority:76});
})();
