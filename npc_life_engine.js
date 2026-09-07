(() => {
  const state = window.SIM_STATE;
  if (!state) return;

  const TRAITS = window.EVERGLEN_TRAIT_PROFILES || {};
  const clamp = (v,a=0,b=100) => Math.max(a,Math.min(b,v));
  const rand = (a,b) => a + Math.random()*(b-a);
  const alive = () => (state.npcs||[]).filter(n=>n.alive);
  const has = (n,t) => Array.isArray(n.traits) && n.traits.includes(t);
  const add = (n,t) => { n.traits=n.traits||[]; if(TRAITS[t] && !n.traits.includes(t)) n.traits.push(t); };
  const remove = (n,t) => { if(n.traits) n.traits=n.traits.filter(x=>x!==t); };
  const log = text => { if(typeof window.SIM_LOG==='function') window.SIM_LOG(text); };
  const family = n => state.families?.find(f=>f.id===n.familyId)||null;
  const kingdom = n => state.kingdoms?.find(k=>k.id===n.faction)||null;
  const other = (n,filter=()=>true) => alive().filter(x=>x.id!==n.id&&filter(x));
  const weightedPick = arr => {
    if(!arr.length) return null;
    const total=arr.reduce((s,x)=>s+Math.max(.01,x.weight||1),0);
    let r=Math.random()*total;
    for(const x of arr){r-=Math.max(.01,x.weight||1);if(r<=0)return x.item}
    return arr[arr.length-1].item;
  };

  const LEARNABLE = new Set([
    'smart','logical','creative','observant','strategic','adaptable','focused',
    'confident','kind','honest','loyal','patient','calm','hardworking','charismatic',
    'tactical_fighter','marksman','duelist','defensive','aggressive','battle_hardened','veteran',
    'entrepreneur','trader','investor','frugal','resourceful','self_sufficient','hunter','farmer','builder',
    'explorer','survivalist','diplomat','peacemaker','politician','reformer','traditionalist','bureaucrat',
    'friendly','empathetic','persuasive','popular','protector','scholarly'
  ]);
  const GENETIC = new Set([
    'genius','dwarf','giant','hardy','disease_resistant','weather_resistant','regeneration','night_vision',
    'superhuman','mutant','psychic','lucky','unlucky','blessed','cursed','genius_bloodline','royal_blood',
    'natural_born_ruler','prodigy'
  ]);
  const INHERIT = {
    genius_bloodline:['genius','smart','scholarly'],
    royal_blood:['noble_born','highborn','legitimate_heir'],
    natural_born_ruler:['natural_leader','charismatic','confident'],
    prodigy:['genius','smart','creative'],
    dwarf:['strong','hardy'],
    giant:['strong','tough'],
    hardy:['tough','disease_resistant'],
    blessed:['lucky'],
    cursed:['unlucky'],
    genius:['smart','logical','scholarly'],
    veteran:['disciplined','battle_hardened'],
  };

  const EXPERIENCE = [
    {when:n=>n.age>=13&&has(n,'curious'),chance:.028,traits:['scholarly'],text:'became fascinated by study.'},
    {when:n=>n.age>=16&&has(n,'hardworking'),chance:.018,traits:['disciplined'],text:'developed a stronger work ethic.'},
    {when:n=>n.age>=18&&has(n,'shy')&&n.reputation>70,chance:.012,traits:['confident'],text:'grew more confident in social life.'},
    {when:n=>n.age>=18&&n.education>55,chance:.02,traits:['smart'],text:'became known for practical intelligence.'},
    {when:n=>n.age>=18&&n.combatSkill>68,chance:.016,traits:['battle_hardened'],text:'became battle-hardened through combat.'},
    {when:n=>n.age>=25&&n.combatSkill>78,chance:.012,traits:['veteran'],text:'earned a veteran reputation.'},
    {when:n=>n.age>=18&&n.wealth>100&&has(n,'patient'),chance:.02,traits:['investor'],text:'began investing accumulated wealth.'},
    {when:n=>n.age>=18&&n.wealth<10&&has(n,'ambitious'),chance:.018,traits:['resourceful'],text:'learned to survive through scarce resources.'},
    {when:n=>n.crimes>=2,chance:.012,traits:['suspicious'],text:'became increasingly suspicious of authority.'},
    {when:n=>(n.grievance||0)>55,chance:.01,traits:['vengeful'],text:'became consumed by a grievance.'},
    {when:n=>has(n,'pacifist')&&n.conflictCount>2,chance:.01,traits:['calm'],text:'became more committed to avoiding conflict.'},
    {when:n=>has(n,'wealthy')&&has(n,'lazy'),chance:.025,traits:[],text:'settled into a life of inherited comfort.'}
  ];

  function ensureBase(n){
    n.traits=Array.isArray(n.traits)?n.traits:[];
    n.traitHistory=n.traitHistory||[];
    n.combatSkill=n.combatSkill??50;
    n.workEthic=n.workEthic??50;
    n.relationshipTrust=n.relationshipTrust??50;
    n.conflictCount=n.conflictCount??0;
    n.relationships=n.relationships||[];
    n.successionClaim=n.successionClaim??0;
  }

  function inheritTraits(child,mother,father){
    ensureBase(child); if(child._traitsInherited)return;
    const parents=[mother,father].filter(Boolean);
    if(!parents.length){child._traitsInherited=true;return;}
    const candidates=[];
    for(const p of parents){
      ensureBase(p);
      for(const t of p.traits||[]){
        const weight=GENETIC.has(t)||INHERIT[t] ? .62 : .20;
        candidates.push({item:t,weight});
        for(const linked of (INHERIT[t]||[])) candidates.push({item:linked,weight:.12});
      }
      const fam=family(p);
      if(fam?.bloodlineTraits) for(const t of fam.bloodlineTraits)candidates.push({item:t,weight:.22});
    }
    const picks=[];
    for(let i=0;i<Math.min(4,candidates.length);i++){
      const t=weightedPick(candidates.filter(x=>!picks.includes(x.item)));
      if(!t)break;
      const p=candidates.find(x=>x.item===t);
      if(Math.random() < Math.min(.9,(p?.weight||.15))){ picks.push(t); }
    }
    for(const t of picks)add(child,t);
    child.traits=child.traits.filter(t=>TRAITS[t]);
    if(!child.traits.length) add(child,Math.random()<.5?'average':'curious');
    child.trait=child.traits[0];
    const f=family(child);
    if(f){
      f.bloodlineTraits=[...new Set([...(f.bloodlineTraits||[]),...child.traits.filter(t=>GENETIC.has(t))])].slice(0,12);
    }
    child._traitsInherited=true;
  }

  function locateParents(n){
    const ids=n.parentIds||[];
    return ids.map(id=>state.npcs.find(x=>x.id===id)).filter(Boolean);
  }

  function birthSync(){
    for(const child of alive()){
      if(!child.parentIds?.length || child._traitsInherited) continue;
      const p=locateParents(child);
      inheritTraits(child,p[0],p[1]);
    }
  }

  function eventTraitDevelopment(n){
    ensureBase(n);
    for(const e of EXPERIENCE){
      if(!e.when(n)||Math.random()>e.chance)continue;
      for(const t of e.traits) if(TRAITS[t]) add(n,t);
      n.traitHistory.unshift({year:state.year,type:'development',text:e.text,traits:e.traits});
      n.traitHistory=n.traitHistory.slice(0,16);
      n.lastAction=e.text;
      if(e.traits.length) log(`${n.name} ${e.text}`);
    }
    if(has(n,'brave')&&has(n,'cowardly')&&Math.random()<.015){
      n.innerConflict='Courage versus fear';
    }
  }

  function needsDevelopment(n){
    const dangerous = state.war || state.weather==='Storm' || n.health<45;
    if(dangerous && has(n,'resourceful')===false && (n.wealth<15||n.hunger>65) && Math.random()<.02)add(n,'resourceful');
    if(state.war && n.age>=16 && n.combatSkill>58 && Math.random()<.015)add(n,'battle_hardened');
    if(!state.war && has(n,'battle_hardened') && Math.random()<.003 && n.age>60)remove(n,'battle_hardened');
    if((n.reputation||50)>82 && (n.influence||0)>12 && Math.random()<.01)add(n,'popular');
    if((n.reputation||50)<25 && Math.random()<.008)add(n,'lonely');
  }

  function relationshipStep(n){
    const candidates=other(n,x=>x.alive&&x.settlementId===n.settlementId).slice(0,18);
    if(!candidates.length)return;
    const target=candidates[Math.floor(Math.random()*candidates.length)];
    n.relationships=n.relationships||[];
    target.relationships=target.relationships||[];
    let a=n.relationships.find(x=>x.id===target.id),b=target.relationships.find(x=>x.id===n.id);
    if(!a){a={id:target.id,score:50};n.relationships.push(a)}
    if(!b){b={id:n.id,score:50};target.relationships.push(b)}
    let delta=0;
    if(has(n,'friendly')||has(n,'kind')||has(n,'empathetic'))delta+=2;
    if(has(n,'charismatic')||has(n,'persuasive'))delta+=1.5;
    if(has(n,'deceptive')||has(n,'paranoid')||has(n,'antisocial'))delta-=1.2;
    if(has(target,'honest')&&has(n,'deceptive'))delta-=2;
    if(has(target,'cruel')&&has(n,'kind'))delta-=2;
    if(has(n,'jealous')&&target.partnerId&&target.partnerId!==n.id)delta-=3;
    if(has(n,'cooperative')&&has(target,'cooperative'))delta+=2;
    a.score=clamp(a.score+delta);b.score=clamp(b.score+delta*.8);
    a.type=a.score>=80?'friend':a.score<=18?'enemy':a.score>=60?'ally':'acquaintance';
    b.type=b.score>=80?'friend':b.score<=18?'enemy':b.score>=60?'ally':'acquaintance';
  }

  function socialCompatibility(n,target){
    let score=50;
    const pairs=[
      ['friendly','friendly',12],['kind','empathetic',12],['honest','honest',10],['loyal','loyal',12],
      ['charismatic','shy',5],['romantic','romantic',15],['protective','loyal',8],['calm','calm',12],
      ['deceptive','honest',-18],['cruel','kind',-20],['paranoid','trusting',-18],['antisocial','extrovert',-12],
      ['jealous','romantic',-2],['ambitious','ambitious',-4]
    ];
    for(const [a,b,v] of pairs)if((has(n,a)&&has(target,b))||(has(n,b)&&has(target,a)))score+=v;
    return score;
  }

  function marriageCompatibility(n,target){
    return socialCompatibility(n,target) + (n.wealth>100?7:0) + (target.wealth>100?7:0) + ((n.status||0)>60?8:0) + ((target.status||0)>60?8:0);
  }

  function nobilityStep(n){
    const role=n.roleId;
    const nobleRoles=['baron','count','duke','king','heir','emperor'];
    const noble=nobleRoles.includes(role)||n.classTier==='noble'||n.classTier==='royal'||has(n,'noble_born')||has(n,'royal_blood');
    if(noble)add(n,'noble_born');
    if(role==='king'||role==='emperor')add(n,'royal_blood');
    if(role==='heir'){
      add(n,'legitimate_heir');
    }
    if((n.status||0)>78)add(n,'prestigious');
    if((n.status||0)>88)add(n,'influential');
    if(n.roleId==='duke'||n.roleId==='count'){
      if(has(n,'ambitious'))add(n,'ambitious_noble');
      if(has(n,'deceptive')||has(n,'manipulative'))add(n,'scheming_noble');
      if(has(n,'honest')||has(n,'loyal'))add(n,'honorable_noble');
    }
    const k=kingdom(n);
    if(!k)return;
    n.successionClaim=clamp(n.successionClaim + (has(n,'royal_blood')?1.5:0) + (has(n,'strong_claim')?1:0) - (has(n,'weak_claim')?.2:0),0,100);
    if(n.successionClaim>72&&has(n,'ambitious'))add(n,'succession_claimant');
    if(n.successionClaim>85&&(has(n,'rebellious')||has(n,'rebel')))add(n,'strong_claim');
  }

  function inheritOnDeath(dead){
    const f=family(dead); if(!f)return;
    const heirs=alive().filter(x=>x.familyId===dead.familyId && x.id!==dead.id).sort((a,b)=>{
      const ca=(dead.childrenIds||[]).includes(a.id)?4:0;
      const cb=(dead.childrenIds||[]).includes(b.id)?4:0;
      const ga=(a.parentIds||[]).includes(dead.id)?3:0;
      const gb=(b.parentIds||[]).includes(dead.id)?3:0;
      return (cb+gb)-(ca+ga) || (b.status||0)-(a.status||0) || b.age-a.age;
    });
    const heir=heirs[0];
    if(heir){
      heir.wealth+=(dead.wealth||0)*.75;
      heir.status=clamp((heir.status||0)+Math.max(2,(dead.status||0)*.05));
      heir.successionClaim=clamp((heir.successionClaim||0)+8);
      add(heir,'favored_heir');
    }
  }

  function economyStep(n){
    if(n.age<16)return;
    const rich=n.wealth>=120;
    if(rich)add(n,'wealthy');else remove(n,'wealthy');
    if(n.wealth<12)add(n,'poor');else remove(n,'poor');
    if(has(n,'lazy')&&rich){n.workEthic=Math.max(5,n.workEthic-1);n.lastAction='Enjoyed inherited wealth';}
    if(has(n,'entrepreneur')&&n.wealth>25&&Math.random()<.02){
      n.businessCount=(n.businessCount||0)+1;n.wealth+=rand(2,8);n.reputation=clamp((n.reputation||50)+.4);
    }
    if(has(n,'investor')&&n.wealth>30&&Math.random()<.025)n.wealth+=rand(.5,4.5);
    if(has(n,'gambler')&&Math.random()<.015){n.wealth=Math.max(0,n.wealth+rand(-20,28));}
    if(has(n,'frugal'))n.wealth+=.25;
    if(has(n,'wasteful'))n.wealth=Math.max(0,n.wealth-.35);
  }

  function combatStep(n){
    if(n.age<14)return;
    if(has(n,'fearless'))n.combatSkill+=.08;
    if(has(n,'veteran'))n.combatSkill+=.07;
    if(has(n,'battle_hardened'))n.combatSkill+=.05;
    if(has(n,'tactical_fighter'))n.combatSkill+=.06;
    if(has(n,'inexperienced')&&Math.random()<.01)n.combatSkill=Math.max(0,n.combatSkill-.1);
    if(state.war && has(n,'cowardly')){n.goal='Avoid the front';n.mood=clamp((n.mood||50)-.2);}
    if(state.war && (has(n,'aggressive')||has(n,'brave'))){n.goal='Seek battle';n.combatSkill+=.06;}
  }

  function intelligenceStep(n){
    if(has(n,'genius'))n.education=clamp((n.education||0)+.05,0,100);
    if(has(n,'smart')||has(n,'logical'))n.education=clamp((n.education||0)+.035,0,100);
    if(has(n,'slow')||has(n,'forgetful'))n.education=clamp((n.education||0)-.012,0,100);
    if(has(n,'focused'))n.education=clamp((n.education||0)+.02,0,100);
    if(has(n,'distractible'))n.education=clamp((n.education||0)-.018,0,100);
    if(has(n,'observant'))n.suspicion=clamp((n.suspicion||0)+.02,0,100);
  }

  function civilizationStep(){
    for(const k of state.kingdoms||[]){
      const people=alive().filter(n=>n.faction===k.id);
      if(!people.length)continue;
      let productivity=0,peace=0,war=0,learning=0,crime=0;
      for(const n of people){
        productivity += (has(n,'hardworking')?2:0)+(has(n,'disciplined')?1.5:0)+(has(n,'builder')?1:0);
        peace += (has(n,'calm')?1.5:0)+(has(n,'peacemaker')?2:0)+(has(n,'cooperative')?1:0);
        war += (has(n,'veteran')?1.5:0)+(has(n,'strategic')?1:0)+(has(n,'aggressive')?1:0);
        learning += (has(n,'genius')?2:0)+(has(n,'scholarly')?1.5:0)+(has(n,'creative')?1:0);
        crime += (has(n,'criminal')?2:0)+(has(n,'deceptive')?1:0)+(has(n,'cruel')?1:0);
      }
      const size=Math.max(1,people.length);
      k.stability=clamp((k.stability||70)+((peace-crime)/size)*.08+(state.war?-0.02:0));
      k.power=Math.max(0,(k.power||20)+(productivity/size)*.025+(war/size)*.02+(learning/size)*.018);
      k.treasury=Math.max(0,(k.treasury||0)+(productivity/size)*.12-(crime/size)*.04);
      k.politics=k.politics||{nobles:20,merchants:20,commons:50,clergy:10,army:0};
      k.politics.nobles=clamp(20+(people.filter(n=>has(n,'noble_born')).length/size)*60,0,100);
    }
  }

  function dynastyHistory(){
    if(!state._lifeHistory)state._lifeHistory=[];
    const events=state._lifeHistory;
    for(const n of alive()){
      const combo=n.lastTraitCombo;
      if(combo && (!n._loggedCombo || n._loggedCombo!==combo.id)){
        events.unshift({year:state.year,npc:n.name,type:'trait',text:`${n.name} became known as ${combo.title}.`});
        n._loggedCombo=combo.id;
      }
      if(n.roleId==='king' && n._lastLoggedRole!=='king'){
        events.unshift({year:state.year,npc:n.name,type:'ruler',text:`${n.name} became ruler of ${kingdom(n)?.name||'the realm'}.`});
        n._lastLoggedRole='king';
      }
    }
    state._lifeHistory=events.slice(0,120);
  }

  function step(){
    if(!state.running)return;
    birthSync();
    for(const n of alive()){
      ensureBase(n);
      eventTraitDevelopment(n);
      needsDevelopment(n);
      relationshipStep(n);
      economyStep(n);
      combatStep(n);
      intelligenceStep(n);
      nobilityStep(n);
    }
    civilizationStep();
    dynastyHistory();
  }

  window.EVERGLEN_LIFE_ENGINE={step,inheritTraits,socialCompatibility,marriageCompatibility,inheritOnDeath};
  window.EVERGLEN_HISTORY=state._lifeHistory||[];

  setInterval(()=>{ if(state.running) step(); },1200);
  step();
})();
