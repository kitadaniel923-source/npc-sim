// Phase 4D: long-term regional culture and religion evolution.
// Builds on npc_culture.js without replacing its canonical culture assignment.
(() => {
  const state=window.SIM_STATE;
  if(!state)return;
  const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,v));
  const alive=()=>state.npcs.filter(n=>n.alive);
  const culture=()=>window.NPC_CULTURE;
  const memory=()=>window.NPC_MEMORY;
  const log=t=>window.SIM_API?.log?.(t);
  const key=(a,b)=>[String(a),String(b)].sort().join(':');
  const ensureSettlement=s=>{
    s.culture=s.culture||{};
    s.culture.identityStrength=s.culture.identityStrength??45;
    s.culture.pressure=s.culture.pressure||{};
    s.culture.traditions=s.culture.traditions||[];
    s.culture.history=s.culture.history||[];
    s.culture.acceptedBeliefs=s.culture.acceptedBeliefs||[];
    s.religion=s.religion||{dominant:null,tolerance:55,pluralism:0,sites:[],history:[]};
    s.religion.tolerance=s.religion.tolerance??55;
    s.religion.pluralism=s.religion.pluralism??0;
    s.religion.sites=s.religion.sites||[];
    s.religion.history=s.religion.history||[];
  };
  const beliefId=name=>String(name||'faith').toLowerCase().replace(/[^a-z0-9]+/g,'_');

  function regionalSignature(s,people){
    const dominant=s.culture?.id||'tradition';
    const war=(s.history||[]).join(' ').match(/war|battle|siege/gi)?.length||0;
    const trade=(s.history||[]).join(' ').match(/trade|merchant|market/gi)?.length||0;
    const learning=(s.infrastructure?.knowledge||0)+(s.services?.education||0);
    const hardship=(100-(s.economy?.foodSecurity||55))+(100-(s.stability||65));
    return {
      dominant,
      mobility:clamp((people.length>25?25:0)+(s.economy?.marketAccess||0)*.35),
      militarism:clamp(war*2.8+(s.infrastructure?.defenses||0)*.5+(dominant==='honor'||dominant==='strength'?15:0)),
      commerce:clamp(trade*2.5+(s.economy?.marketAccess||0)*.8+(dominant==='prosperity'?15:0)),
      scholarship:clamp(learning*.7+(dominant==='curiosity'?18:0)),
      hardship:clamp(hardship),
      isolation:clamp(75-(s.economy?.marketAccess||0)*.8+(people.length<10?18:0))
    };
  }

  function evolveIdentity(s,people){
    ensureSettlement(s);if(!people.length)return;
    const sig=regionalSignature(s,people);
    const pressure=s.culture.pressure;
    Object.entries(sig).forEach(([id,v])=>pressure[id]=clamp((pressure[id]||0)*.94+v*.06));
    const old=s.culture.id;
    let next=old;
    if(pressure.militarism>62)next=pressure.hardship>62?'strength':'honor';
    else if(pressure.scholarship>65)next='curiosity';
    else if(pressure.commerce>68)next='prosperity';
    else if(pressure.hardship>72)next='compassion';
    else if(pressure.isolation>72)next='tradition';
    if(next!==old&&Math.random()<.035*state.speed){
      s.culture.id=next;
      const map=culture()?.archetypes||[];const a=map.find(x=>x.id===next);
      if(a){s.culture.name=a.name;s.culture.belief=a.religion;}
      s.culture.identityStrength=clamp((s.culture.identityStrength||45)+9);
      s.culture.history.push(`Year ${state.year}: regional identity shifted from ${old} to ${next}.`);
      s.culture.history=s.culture.history.slice(-20);
      log(`${s.name} developed a stronger ${next} identity.`);
    } else {
      s.culture.identityStrength=clamp((s.culture.identityStrength||45)*.995+(people.length>18?0.15:0));
    }
    const a=(culture()?.archetypes||[]).find(x=>x.id===s.culture.id);
    if(a){
      s.culture.belief=a.religion;
      const values=a.values||{};
      if(values.change>0.6&&s.services?.education>55&&!s.culture.traditions.includes('Open Debate'))s.culture.traditions.push('Open Debate');
      if(values.order>0.6&&s.culture.traditions.length<8&&!s.culture.traditions.includes('Council of Elders'))s.culture.traditions.push('Council of Elders');
    }
  }

  function cultureDrift(){
    state.settlements.forEach(s=>{
      ensureSettlement(s);
      const neighbors=state.settlements.filter(x=>x.id!==s.id&&Math.hypot((x.x||0)-(s.x||0),(x.y||0)-(s.y||0))<230);
      neighbors.forEach(n=>{
        ensureSettlement(n);
        if(s.culture.id===n.culture.id)return;
        const contact=clamp((s.economy?.marketAccess||0)*.35+(n.economy?.marketAccess||0)*.25+(s.services?.trade||0)*.25+(n.services?.trade||0)*.15);
        if(Math.random()*100>contact*.025)return;
        const stronger=(s.culture.identityStrength||45)>=(n.culture.identityStrength||45)?s:n;
        const weaker=stronger===s?n:s;
        weaker.culture.influences=weaker.culture.influences||{};
        weaker.culture.influences[stronger.culture.id]=clamp((weaker.culture.influences[stronger.culture.id]||0)+.8,0,100);
        if((weaker.culture.influences[stronger.culture.id]||0)>45&&Math.random()<.015){
          const old=weaker.culture.id;weaker.culture.id=stronger.culture.id;weaker.culture.name=stronger.culture.name;weaker.culture.belief=stronger.culture.belief;
          weaker.culture.traditions=[...new Set([...(weaker.culture.traditions||[]),...(stronger.culture.traditions||[]).slice(0,2)])].slice(0,8);
          weaker.culture.history.push(`Year ${state.year}: absorbed cultural influence from ${stronger.name}.`);
          weaker.culture.history=weaker.culture.history.slice(-20);
        }
      });
    });
  }

  function updateReligion(s,people){
    ensureSettlement(s);if(!people.length)return;
    const beliefs=new Map();
    people.forEach(n=>{const b=n.culture?.belief||'Ancestor Keepers';if(!beliefs.has(b))beliefs.set(b,[]);beliefs.get(b).push(n)});
    const ranked=[...beliefs.entries()].sort((a,b)=>b[1].length-a[1].length);
    const dominant=ranked[0]?.[0]||s.culture.belief||'Ancestor Keepers';
    const share=(beliefs.get(dominant)?.length||0)/Math.max(1,people.length);
    s.religion.dominant=beliefId(dominant);
    s.religion.pluralism=clamp((ranked.length-1)*14+(share<.7?25:0));
    s.religion.tolerance=clamp(70-s.culture.identityStrength*.18+s.religion.pluralism*.28+(s.services?.education||0)*.12);
    if(s.economy?.foodSecurity<35)s.religion.tolerance=clamp(s.religion.tolerance-10);
    if(share>.72&&s.religion.pluralism<25&&Math.random()<.01){
      const siteId=`holy-${s.id}`;
      if(!s.religion.sites.some(x=>x.id===siteId)){
        s.religion.sites.push({id:siteId,name:`${dominant} shrine`,belief:dominant,prestige:20,year:state.year});
        s.religion.history.push(`Year ${state.year}: established a holy site dedicated to ${dominant}.`);
      }
    }
    if(ranked.length>=2&&share<.62&&Math.random()<.012){
      const minority=ranked[1];
      s.religion.history.push(`Year ${state.year}: religious division emerged between ${dominant} and ${minority[0]}.`);
      s.religion.history=s.religion.history.slice(-18);
      s.religion.schismRisk=clamp((s.religion.schismRisk||0)+8);
    } else s.religion.schismRisk=clamp((s.religion.schismRisk||0)*.98);
  }

  function religiousPressure(n,s){
    const belief=n.culture?.belief||s.culture?.belief||'Ancestor Keepers';
    if(belief===s.culture?.belief)return;
    const tolerance=s.religion?.tolerance||50;
    const openness=(n.culture?.strength||45)*.15+(n.education||0)*.08+(n.age<30?9:0);
    if(tolerance<30&&Math.random()<.018){
      n.grievance=clamp((n.grievance||0)+4);
      memory()?.remember(n,`My faith is unwelcome in ${s.name}.`,'religion',2.8,s.id,'anger');
      if(Math.random()<.25)n.religiousConflict=(n.religiousConflict||0)+1;
    }
    if(tolerance>60&&Math.random()*100<openness*.08){
      n.culture.belief=s.culture.belief||belief;
      n.beliefStrength=clamp((n.beliefStrength||40)+2);
    }
  }

  function beliefReform(k){
    if(!k)return;
    k.religiousHistory=k.religiousHistory||[];
    const people=alive().filter(n=>n.faction===k.id);
    if(people.length<8)return;
    const beliefs=new Map();people.forEach(n=>{const b=n.culture?.belief||'Ancestor Keepers';beliefs.set(b,(beliefs.get(b)||0)+1)});
    for(const [belief,count] of beliefs){
      if(count<Math.max(5,people.length*.35))continue;
      if(Math.random()<.008){
        const reform=`Reformed ${belief}`;
        k.religiousHistory.push(`Year ${state.year}: ${reform} movement emerged.`);
        k.religiousHistory=k.religiousHistory.slice(-20);
        const targets=people.filter(n=>n.culture?.belief===belief).slice(0,12);
        targets.forEach(n=>{n.culture.belief=reform;n.beliefStrength=clamp((n.beliefStrength||40)+8);memory()?.remember(n,`${reform} changed our religious tradition.`,'religious_reform',3.6,k.id,'hope');});
        break;
      }
    }
  }

  function step(){
    if(!state.running)return;
    state.settlements.forEach(s=>{const people=alive().filter(n=>n.settlementId===s.id);evolveIdentity(s,people);updateReligion(s,people);people.forEach(n=>religiousPressure(n,s));});
    if(state.tick%45===0)cultureDrift();
    if(state.tick%90===0)state.kingdoms.forEach(beliefReform);
  }

  window.EVERGLEN_CULTURE_RELIGION={step,evolveIdentity,updateReligion};
  if(state.registerSystem)state.registerSystem({name:'culture-religion-evolution',step,priority:73});
})();
