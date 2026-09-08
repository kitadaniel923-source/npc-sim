// Phase 2: long-term civilization evolution.
// Connects existing culture, faith, law, education, technology and society systems into persistent civilization identity and inter-kingdom diplomacy.
// State-only: no DOM listeners and no independent render loop.
(() => {
  const state=window.SIM_STATE;if(!state)return;
  const P=()=>window.NPC_PERSONALITY,M=()=>window.NPC_MEMORY;
  const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,v));
  const alive=()=>state.npcs.filter(n=>n.alive);
  const score=(n,k)=>P()?.score?.(n,k)??50;
  const peopleOf=k=>alive().filter(n=>String(n.faction||n.kingdomId)===String(k.id));
  const residents=s=>alive().filter(n=>String(n.settlementId)===String(s.id));
  const pairKey=(a,b)=>[String(a),String(b)].sort().join(':');
  const log=t=>window.SIM_LOG?.(t);

  const CULTURE_NAMES=['Tradition','Honor','Curiosity','Prosperity','Compassion','Strength'];
  const LAWS=['customary','royal','feudal','mercantile'];
  const ERA=[['Early Kingdom',0],['Established Realm',28],['Scholarly Age',58],['High Medieval Flourishing',78]];

  function ensureKingdom(k){
    k.society=k.society||{};
    const i=k.society.identity||(k.society.identity={culture:null,belief:null,law:null,literacy:8,education:12,knowledge:0,tolerance:52,cohesion:50,prosperity:50,era:'Early Kingdom',history:[],lastEvolutionYear:0});
    i.history=i.history||[];
    k.diplomacy=k.diplomacy||{relations:{},treaties:[],history:[]};
    k.diplomacy.relations=k.diplomacy.relations||{};k.diplomacy.treaties=k.diplomacy.treaties||[];k.diplomacy.history=k.diplomacy.history||[];
    return k;
  }
  function ensureSettlement(s){
    s.society=s.society||{};
    s.society.education=s.society.education||{schools:0,teachers:0,literacy:8,knowledge:0,prestige:10,history:[]};
    s.society.identity=s.society.identity||{culture:null,belief:null,law:null,diversity:0,tolerance:52,history:[]};
    s.society.education.history=s.society.education.history||[];s.society.identity.history=s.society.identity.history||[];
  }
  function cultureCounts(p){
    const out={};p.forEach(n=>{const id=n.culture?.id||n.cultureId||n.culture; if(id)out[id]=(out[id]||0)+1;});return out;
  }
  function beliefCounts(p){
    const out={};p.forEach(n=>{const id=n.faith||n.belief||n.culture?.belief;if(id)out[id]=(out[id]||0)+(n.faithStrength||35);});return out;
  }
  function leaderOf(k,p){return p.find(n=>String(n.id)===String(k.leaderId)&&n.alive)||p.find(n=>n.roleId==='king'||n.roleId==='queen'||n.roleId==='emperor'||n.roleId==='empress')||null;}

  function educationStep(s,p){
    ensureSettlement(s);
    const inst=s.society.institutions||{};
    const academy=inst.academy||{};
    const scholars=p.filter(n=>['scholar','teacher','scribe','librarian','student'].includes(n.roleId));
    const teachers=p.filter(n=>['teacher','scholar','scribe','librarian'].includes(n.roleId));
    const tech=s.technology||{};
    const writing=tech.writing?.level||tech.writing||0,printing=tech.printing?.level||tech.printing||0;
    const academyPower=academy.power||0;
    const schoolPotential=(s.level||1)*2+Math.min(12,teachers.length*.8)+Math.min(16,academyPower*.22);
    s.society.education.schools=clamp(schoolPotential,0,40);
    s.society.education.teachers=teachers.length;
    const gain=.018+s.society.education.schools*.0014+writing*.004+printing*.008+scholars.length*.0008;
    s.society.education.literacy=clamp((s.society.education.literacy||8)+gain*(state.speed||1));
    s.society.education.knowledge=clamp((s.society.education.knowledge||0)+(.03+academyPower*.0015+writing*.008+printing*.014)*(state.speed||1));
    s.society.education.prestige=clamp(10+s.society.education.schools*.8+teachers.length*1.2+(academyPower*.15));
    p.filter(n=>n.age>=6&&n.age<18).slice(0,Math.max(2,Math.floor(p.length*.2))).forEach(n=>{n.education=clamp((n.education||0)+(.01+s.society.education.literacy*.0006)*(state.speed||1));});
    if(state.tick%240===0){s.society.education.history.push({year:state.year,literacy:Math.round(s.society.education.literacy),knowledge:Math.round(s.society.education.knowledge)});s.society.education.history=s.society.education.history.slice(-16);}
  }

  function identityStep(s,p){
    ensureSettlement(s);
    const cultures=cultureCounts(p),beliefs=beliefCounts(p),ordered=Object.entries(cultures).sort((a,b)=>b[1]-a[1]);
    const dominantCulture=ordered[0]?.[0]||s.society.identity.culture||null;
    const total=Math.max(1,p.length),diversity=1-(ordered[0]?.[1]||0)/total;
    const beliefOrdered=Object.entries(beliefs).sort((a,b)=>b[1]-a[1]);
    const dominantBelief=beliefOrdered[0]?.[0]||s.faith?.name||s.society.identity.belief||null;
    const compassion=p.reduce((v,n)=>v+score(n,'kindness'),0)/total;
    const curiosity=p.reduce((v,n)=>v+score(n,'curiosity'),0)/total;
    const discipline=p.reduce((v,n)=>v+score(n,'discipline'),0)/total;
    const strength=p.reduce((v,n)=>v+score(n,'courage'),0)/total;
    const tolerance=clamp(42+compassion*.22+curiosity*.18-diversity*18+(s.law?.id==='customary'?8:0)+(s.law?.id==='mercantile'?6:0));
    const old=s.society.identity;
    old.diversity=diversity;old.tolerance=clamp(old.tolerance*.95+tolerance*.05);old.culture=dominantCulture;old.belief=dominantBelief;old.law=s.law?.id||old.law||'customary';
    if(dominantCulture&&!old.history.some(h=>h.culture===dominantCulture&&h.settlement===s.id))old.history.push({year:state.year,culture:dominantCulture,belief:dominantBelief,law:old.law});
    old.history=old.history.slice(-20);
    if(diversity>.42&&old.tolerance<38){
      s.society.religiousTension=clamp((s.society.religiousTension||0)+.03*(state.speed||1));
      p.filter(n=>(n.faithStrength||0)>55).slice(0,5).forEach(n=>{n.grievance=clamp((n.grievance||0)+.01*(state.speed||1));});
    }else s.society.religiousTension=Math.max(0,(s.society.religiousTension||0)-.02*(state.speed||1));
    s.society.culturalValues={tradition:clamp(50+(discipline-50)*.22),honor:clamp(50+(strength-50)*.25),curiosity:clamp(50+(curiosity-50)*.35),compassion:clamp(compassion),strength:clamp(strength)};
  }

  function lawStep(s,p){
    ensureSettlement(s);
    const econ=s.society.economy||{},gov=s.society.governance||{},cp=s.society.classPower||{},conf=(s.society.conflicts||[]).filter(c=>c.status==='open-conflict').length;
    const candidates=[
      ['mercantile',(cp.merchant||0)*.42+(econ.markets||0)*.16],
      ['feudal',(cp.nobility||0)*.48+(s.feudal?.legitimacy<45?12:0)],
      ['royal',(gov.legitimacy||50)*.35+(s.society.institutions?.court?.power||0)*.2],
      ['customary',(cp.peasant||0)*.18+(s.society.identity.tolerance||50)*.16+conf*3]
    ].sort((a,b)=>b[1]-a[1]);
    const best=candidates[0]?.[0]||'customary';
    const current=s.law?.id||'customary';
    if(best!==current&&state.tick%480===0){
      s.law=s.law||{};s.law.id=best;
      const meta=window.MEDIEVAL_SOCIETY?.LAWS?.find(x=>x.id===best);if(meta)s.law.name=meta.name;
      s.society.identity.history.push({year:state.year,lawChange:best});
      log(`${s.name} adopted ${s.law.name||best} as its dominant law.`);
    }
    s.society.identity.law=s.law?.id||best;
  }

  function kingdomIdentityStep(k,p,settlements){
    ensureKingdom(k);
    const weights={};const belief={};let total=0,literacy=0,education=0,knowledge=0,tolerance=0,prosperity=0;
    settlements.forEach(s=>{
      ensureSettlement(s);const pop=Math.max(1,residents(s).length);total+=pop;
      const id=s.society.identity.culture;if(id)weights[id]=(weights[id]||0)+pop;
      const b=s.society.identity.belief;if(b)belief[b]=(belief[b]||0)+pop;
      literacy+=s.society.education.literacy*pop;education+=s.society.education.prestige*pop;knowledge+=s.society.education.knowledge*pop;tolerance+=s.society.identity.tolerance*pop;prosperity+=(s.society.economy?.prosperity||50)*pop;
    });
    const culture=Object.entries(weights).sort((a,b)=>b[1]-a[1])[0]?.[0]||k.society.identity.culture||null;
    const b=Object.entries(belief).sort((a,b)=>b[1]-a[1])[0]?.[0]||k.society.identity.belief||null;
    const i=k.society.identity;i.culture=culture;i.belief=b;i.literacy=total?literacy/total:i.literacy;i.education=total?education/total:i.education;i.knowledge=total?knowledge/total:i.knowledge;i.tolerance=total?tolerance/total:i.tolerance;i.prosperity=total?prosperity/total:i.prosperity;
    const societyScore=clamp(i.knowledge*.42+i.prosperity*.34+i.literacy*.16+i.education*.08);
    i.era=ERA.reduce((name,[label,min])=>societyScore>=min?label:name,'Early Kingdom');
    const last=i.history.at(-1);
    if(!last||last.year!==state.year&&(last.culture!==i.culture||last.belief!==i.belief||last.law!==i.law||last.era!==i.era))i.history.push({year:state.year,culture:i.culture,belief:i.belief,law:i.law||settlements[0]?.law?.id||'customary',era:i.era});
    i.history=i.history.slice(-24);
    if(state.year!==i.lastEvolutionYear&&state.year>0){i.lastEvolutionYear=state.year;if(state.year%10===0)M()?.remember?.(leaderOf(k,p),`${k.name} entered the ${i.era}.`,'civilization',4,k.id,'pride');}
  }

  function atWar(a,b){
    if(state.war)return true;
    const wars=state.borderWars||[];return wars.some(w=>(String(w.a)===String(a)&&String(w.b)===String(b))||(String(w.a)===String(b)&&String(w.b)===String(a)));
  }
  function hasTreaty(type,a,b){return state.diplomacy.treaties.find(t=>t.status==='active'&&t.type===type&&((String(t.a)===String(a)&&String(t.b)===String(b))||(String(t.a)===String(b)&&String(t.b)===String(a))));}
  function endTreaty(t,reason){t.status='ended';t.endedYear=state.year;t.reason=reason;}
  function diplomacyStep(){
    state.diplomacy=state.diplomacy||{relations:{},treaties:[],history:[]};state.diplomacy.relations=state.diplomacy.relations||{};state.diplomacy.treaties=state.diplomacy.treaties||[];state.diplomacy.history=state.diplomacy.history||[];
    const kingdoms=(state.kingdoms||[]).filter(k=>!k.civilWarRebel);
    for(let i=0;i<kingdoms.length;i++)for(let j=i+1;j<kingdoms.length;j++){
      const a=kingdoms[i],b=kingdoms[j],ka=ensureKingdom(a),kb=ensureKingdom(b),key=pairKey(a.id,b.id),ra=a.diplomacy.relations[String(b.id)]||state.diplomacy.relations[key]||{score:0,trade:0,trust:35,hostility:0,lastYear:state.year};
      const pa=peopleOf(a),pb=peopleOf(b),sa=state.settlements.filter(s=>String(s.kingdomId)===String(a.id)),sb=state.settlements.filter(s=>String(s.kingdomId)===String(b.id));
      const ia=ka.society.identity,ib=kb.society.identity;
      let delta=0;
      if(ia.culture&&ib.culture&&ia.culture===ib.culture)delta+=2.2; else delta-=.7;
      if(ia.belief&&ib.belief&&ia.belief===ib.belief)delta+=1.8;
      delta+=(Math.min(90,ka.society.prosperity||50)+Math.min(90,kb.society.prosperity||50)-100)*.008;
      const merchants=(pa.filter(n=>n.society?.class==='merchant').length+pb.filter(n=>n.society?.class==='merchant').length);
      delta+=Math.min(3,merchants*.015);
      const border=sa.some(x=>sb.some(y=>Math.hypot((x.x||0)-(y.x||0),(x.y||0)-(y.y||0))<150));
      if(border)delta-=.35;
      if(atWar(a.id,b.id))delta-=4.5;else delta+=.45;
      if(hasTreaty('alliance',a.id,b.id))delta+=1.8;if(hasTreaty('trade-pact',a.id,b.id))delta+=1.1;
      ra.score=clamp((ra.score??0)*.96+delta*.65,-100,100);ra.trade=clamp((ra.trade??0)+((econTrade(a)+econTrade(b))*.008),0,100);ra.trust=clamp((ra.trust??35)+ra.score*.006-(ra.hostility||0)*.01);
      ra.hostility=clamp((ra.hostility||0)+(atWar(a.id,b.id)?1.8:-.5));ra.lastYear=state.year;
      a.diplomacy.relations[String(b.id)]=ra;b.diplomacy.relations[String(a.id)]={...ra};state.diplomacy.relations[key]={a:String(a.id),b:String(b.id),...ra};
      treatyStep(a,b,ra);
    }
    state.diplomacy.treaties.forEach(t=>{if(t.status!=='active')return;if(t.endYear&&state.year>=t.endYear)endTreaty(t,'expired');if(atWar(t.a,t.b)&&t.type!=='alliance')endTreaty(t,'war');if(t.type==='alliance'&&relationScore(t.a,t.b)<25)endTreaty(t,'relations-collapsed');});
    state.diplomacy.treaties=state.diplomacy.treaties.slice(-60);state.diplomacy.history=state.diplomacy.history.slice(-40);
  }
  function econTrade(k){return (k.society?.prosperity||50)*.25+(peopleOf(k).filter(n=>n.society?.class==='merchant').length*.5);}
  function relationScore(a,b){const x=state.diplomacy.relations[pairKey(a,b)];return x?.score??0;}
  function treatyStep(a,b,r){
    if(atWar(a.id,b.id))return;
    const existing=state.diplomacy.treaties.filter(t=>t.status==='active'&&((String(t.a)===String(a.id)&&String(t.b)===String(b.id))||(String(t.a)===String(b.id)&&String(t.b)===String(a.id))));
    const leader=leaderOf(a,peopleOf(a));const counterpart=leaderOf(b,peopleOf(b));
    if(r.score>72&&!hasTreaty('alliance',a.id,b.id)&&state.tick%600===0&&Math.random()<.08){
      const t={id:`dip-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,type:'alliance',a:a.id,b:b.id,startYear:state.year,endYear:state.year+12,status:'active'};state.diplomacy.treaties.push(t);state.diplomacy.history.push({year:state.year,type:'alliance',a:a.id,b:b.id});a.stability=clamp((a.stability||70)+2);b.stability=clamp((b.stability||70)+2);M()?.remember?.(leader,`Our kingdom formed an alliance with ${b.name}.`,'diplomacy',3,a.id,'pride');M()?.remember?.(counterpart,`Our kingdom formed an alliance with ${a.name}.`,'diplomacy',3,b.id,'pride');log(`${a.name} and ${b.name} formed an alliance.`);
    } else if(r.score>48&&!hasTreaty('trade-pact',a.id,b.id)&&!existing.some(t=>t.type==='alliance')&&state.tick%420===0&&Math.random()<.1){
      state.diplomacy.treaties.push({id:`dip-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,type:'trade-pact',a:a.id,b:b.id,startYear:state.year,endYear:state.year+7,status:'active'});state.diplomacy.history.push({year:state.year,type:'trade-pact',a:a.id,b:b.id});log(`${a.name} and ${b.name} signed a trade pact.`);
    } else if(r.score<10&&!hasTreaty('truce',a.id,b.id)&&state.tick%360===0&&Math.random()<.045&&r.hostility>12){
      state.diplomacy.treaties.push({id:`dip-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,type:'truce',a:a.id,b:b.id,startYear:state.year,endYear:state.year+4,status:'active'});state.diplomacy.history.push({year:state.year,type:'truce',a:a.id,b:b.id});log(`${a.name} and ${b.name} agreed to a truce.`);
    }
    const relation=relationScore(a.id,b.id);
    if(existing.some(t=>t.type==='alliance')&&relation<28)existing.filter(t=>t.type==='alliance').forEach(t=>endTreaty(t,'relations-collapsed'));
  }

  function kingdomFeedback(k){
    ensureKingdom(k);const i=k.society.identity||{},treaties=state.diplomacy.treaties.filter(t=>t.status==='active'&&((String(t.a)===String(k.id))||(String(t.b)===String(k.id))));
    const alliances=treaties.filter(t=>t.type==='alliance').length,pacts=treaties.filter(t=>t.type==='trade-pact').length;
    k.society.diplomaticTrust=clamp(35+(i.tolerance||50)*.35+alliances*9+pacts*4);
    k.society.internationalPower=clamp((k.power||25)+alliances*8+pacts*3+(i.knowledge||0)*.08);
    if(alliances)k.stability=clamp((k.stability||70)+.006*alliances);
    if(pacts)k.society.prosperity=clamp((k.society.prosperity||50)+.008*pacts);
  }

  function step(){
    if(!state.running)return;
    const settlements=state.settlements||[], kingdoms=(state.kingdoms||[]).filter(k=>!k.civilWarRebel);
    settlements.forEach(s=>{const p=residents(s);if(!p.length)return;educationStep(s,p);identityStep(s,p);lawStep(s,p);});
    kingdoms.forEach(k=>{const p=peopleOf(k),ss=settlements.filter(s=>String(s.kingdomId)===String(k.id));if(!p.length)return;kingdomIdentityStep(k,p,ss);kingdomFeedback(k);});
    if(state.tick%12===0)diplomacyStep();
  }

  window.SOCIETY_CIVILIZATION_EVOLUTION={step,ensureKingdom,ensureSettlement,diplomacyStep,relationScore};
  state.registerSystem?.({name:'civilization-evolution',step,priority:102});
})();
