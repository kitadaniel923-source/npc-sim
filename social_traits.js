(() => {
  const TRAIT_PROFILES = {
    brave:{risk:18,combat:22,crime:-2,leadership:10,help:2},
    curious:{education:22,explore:18,magic:10,crime:-2},
    ambitious:{leadership:22,status:18,politics:20,risk:6,crime:4},
    kind:{help:25,friendship:18,crime:-18,mercy:18},
    greedy:{wealth:24,trade:18,crime:18,bribe:10,help:-8},
    loyal:{loyalty:28,leadership:8,crime:-12,rebel:-22,help:8},
    stubborn:{resist:24,feud:20,rebel:10,politics:8},
    clever:{wealth:12,trade:22,scheme:24,evasion:22,education:8},
    reckless:{risk:30,combat:16,crime:16,feud:10},
    calm:{peace:28,mediation:30,crime:-12,feud:-22},
    honest:{crime:-30,law:24,reputation:20,bribe:-22},
    generous:{help:34,friendship:22,prestige:16,wealth:-8},
    charismatic:{friendship:30,marriage:28,leadership:24,politics:16},
    disciplined:{work:22,combat:14,crime:-16,army:20},
    cruel:{crime:24,intimidation:28,mercy:-24,feud:18,politics:-4},
    paranoid:{suspicion:30,spy:24,friendship:-14,conflict:12},
    vengeful:{revenge:34,feud:30,forgive:-28,crime:14},
    patient:{wealth:18,trade:12,investment:28,risk:-18},
    pious:{faith:30,help:12,crime:-12,stability:8},
    scholarly:{education:32,politics:10,research:30,crime:-8}
  };

  const SECONDARIES = {
    brave:['loyal','disciplined','reckless'],
    curious:['scholarly','patient','clever'],
    ambitious:['charismatic','clever','stubborn'],
    kind:['generous','calm','honest'],
    greedy:['clever','ambitious','reckless'],
    loyal:['honest','disciplined','kind'],
    stubborn:['vengeful','ambitious','paranoid'],
    clever:['patient','curious','charismatic'],
    reckless:['brave','cruel','vengeful'],
    calm:['patient','pious','honest'],
    honest:['disciplined','kind','calm']
  };

  const state = window.SIM_STATE;
  if (!state) {
    console.warn('Everglen social traits module: simulation state unavailable.');
    return;
  }

  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const alive=()=>state.npcs.filter(n=>n.alive);
  const pick=a=>a[Math.floor(Math.random()*a.length)];
  const family=n=>state.families.find(f=>f.id===n.familyId)||null;
  const clanOf=n=>{const f=family(n);return f?state.clans.find(c=>c.id===f.clanId)||null:null};
  const kingdom=n=>state.kingdoms.find(k=>k.id===n.faction)||null;
  const settlement=n=>state.settlements.find(s=>s.id===n.settlementId)||null;
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const rand=(a,b)=>a+Math.random()*(b-a);

  function ensureTraits(n){
    if(!n.traits||!Array.isArray(n.traits)){
      const primary=n.trait||pick(Object.keys(TRAIT_PROFILES));
      const pool=SECONDARIES[primary]||Object.keys(TRAIT_PROFILES).filter(t=>t!==primary);
      n.traits=[primary];
      if(Math.random()<.74&&pool.length)n.traits.push(pool[0]);
      if(Math.random()<.28&&pool.length>1)n.traits.push(pool[1]);
    }
    n.traits=[...new Set(n.traits.filter(t=>TRAIT_PROFILES[t]))];
    if(!n.traits.length)n.traits=[n.trait||'calm'];
    n.trait=n.traits[0];
    n.traitPower=n.traits.reduce((sum,t)=>sum+(TRAIT_PROFILES[t]?.leadership||0)+(TRAIT_PROFILES[t]?.work||0),0);
    return n.traits;
  }

  function has(n,t){ensureTraits(n);return n.traits.includes(t)}
  function score(n,key){ensureTraits(n);return n.traits.reduce((sum,t)=>sum+(TRAIT_PROFILES[t]?.[key]||0),0)}
  function remember(n,text){n.memories=n.memories||[];n.memories.unshift({year:state.year,text});n.memories=n.memories.slice(0,10)}
  function relation(n,other,delta){
    if(!n||!other||n.id===other.id)return;
    n.relations=n.relations||[];
    let r=n.relations.find(x=>x.id===other.id);
    if(!r){r={id:other.id,score:50,type:'acquaintance'};n.relations.push(r)}
    r.score=clamp(r.score+delta,0,100);
    r.type=r.score>=78?'friend':r.score>=58?'ally':r.score<=20?'enemy':'acquaintance';
  }
  function addFamilyEffect(n,rep=0,prestige=0,rivalry=0,wealth=0){
    const f=family(n);if(!f)return;
    f.reputation=clamp((f.reputation??50)+rep,0,100);
    f.prestige=Math.max(0,(f.prestige??10)+prestige);
    f.rivalry=Math.max(0,(f.rivalry??0)+rivalry);
    f.wealth=Math.max(0,(f.wealth??0)+wealth);
    const c=clanOf(n);
    if(c){c.reputation=clamp((c.reputation??50)+rep*.55,0,100);c.honor=clamp((c.honor??50)+prestige+rep*.25,0,100);c.influence=Math.max(0,(c.influence??10)+prestige*.35+rep*.08);}
  }
  function addKingdomEffect(n,stability=0,power=0,treasury=0){
    const k=kingdom(n);if(!k)return;
    k.stability=clamp((k.stability??70)+stability,0,100);
    k.power=Math.max(0,(k.power??20)+power);
    k.treasury=Math.max(0,(k.treasury??0)+treasury);
  }

  function wealthAction(n){
    const s=settlement(n);if(!s)return;
    const clever=score(n,'trade'), patient=score(n,'investment'), greedy=score(n,'wealth');
    const gain=Math.max(.5,rand(.5,2.2)+(clever+patient+greedy)*.025);
    const risk=Math.max(0,rand(0,1.8)-patient*.02+score(n,'risk')*.018);
    n.wealth=Math.max(0,n.wealth+gain-risk);
    n.fortune=clamp((n.fortune??50)+(gain>risk?rand(.2,1.2):rand(-.8,.2)),0,100);
    if(gain>1.7){n.reputation=clamp(n.reputation+0.25,0,100);addFamilyEffect(n,.2,.08,gain>2?0:.01,gain*.02)}
    n.lastAction=has(n,'greedy')?'Pursued profit':'Built personal wealth';
  }

  function helpAction(n){
    const s=settlement(n);if(!s)return;
    const target=alive().filter(x=>x.id!==n.id&&x.settlementId===n.settlementId&&x.health<80).sort((a,b)=>a.health-b.health)[0];
    if(!target)return;
    const gift=Math.min(n.wealth*0.08+1.5,8);
    n.wealth=Math.max(0,n.wealth-gift);
    target.wealth+=gift;
    target.health=clamp(target.health+score(n,'help')*.08,0,100);
    n.reputation=clamp(n.reputation+score(n,'help')*.04,0,100);
    target.mood=clamp(target.mood+4,0,100);
    relation(n,target,8);relation(target,n,10);
    addFamilyEffect(n,1,.35,-.1,-gift*.03);
    addKingdomEffect(n,.08,.02,0);
    remember(n,`Helped ${target.name} during hardship.`);
    n.lastAction=`Helped ${target.name}`;
  }

  function mentorAction(n){
    if(score(n,'education')<8)return;
    const student=alive().filter(x=>x.id!==n.id&&x.settlementId===n.settlementId&&x.age>=10&&x.age<=24).sort((a,b)=>a.education-b.education)[0];
    if(!student)return;
    student.education=clamp((student.education||0)+rand(.6,2.4),0,100);
    student.mood=clamp(student.mood+2,0,100);
    n.reputation=clamp(n.reputation+0.5,0,100);
    addFamilyEffect(n,.6,.25,0,.02);
    relation(n,student,5);relation(student,n,6);
    remember(n,`Mentored ${student.name}.`);
    n.lastAction=`Mentored ${student.name}`;
  }

  function marriageAction(n){
    if(n.age<18||n.partnerId)return;
    const candidates=alive().filter(x=>x.id!==n.id&&!x.partnerId&&x.sex!==n.sex&&x.age>=18&&x.age<=50&&x.settlementId===n.settlementId);
    if(!candidates.length)return;
    const target=candidates.sort((a,b)=>{
      const av=score(n,'marriage')+(a.reputation||50)*.12+(a.wealth||0)*.03;
      const bv=score(n,'marriage')+(b.reputation||50)*.12+(b.wealth||0)*.03;
      return bv-av;
    })[0];
    const chance=0.12+score(n,'marriage')*.006+score(target,'marriage')*.004;
    if(Math.random()>chance)return;
    n.partnerId=target.id;target.partnerId=n.id;
    relation(n,target,24);relation(target,n,24);
    n.mood=clamp(n.mood+8,0,100);target.mood=clamp(target.mood+8,0,100);
    addFamilyEffect(n,4,3,0,2);addFamilyEffect(target,4,3,0,2);
    if(n.familyId!==target.familyId){
      const f=family(n),g=family(target);if(f&&g){f.prestige+=1.5;g.prestige+=1.5;f.legacy+=1;g.legacy+=1;}
    }
    remember(n,`Married ${target.name}.`);remember(target,`Married ${n.name}.`);
    n.lastAction=`Married ${target.name}`;target.lastAction=`Married ${n.name}`;
  }

  function politicalAction(n){
    const k=kingdom(n);if(!k||score(n,'politics')<8||n.age<22)return;
    if(n.roleId==='citizen'&&n.reputation>65&&n.wealth>45&&n.influence>7&&Math.random()<.18){
      n.roleId=n.status>72?'baron':'mayor';n.roleName=n.roleId==='baron'?'Baron':'Mayor';n.status+=8;n.influence+=4;
      addFamilyEffect(n,3,3,0,1);addKingdomEffect(n,.4,.5,0);
      remember(n,`Rose into public office as ${n.roleName}.`);n.lastAction=`Entered politics as ${n.roleName}`;
    }
    if(has(n,'ambitious')&&n.grievance>25&&Math.random()<.08){
      k.politics.commons=clamp((k.politics.commons??50)+3,0,100);
      k.stability=clamp(k.stability-2.5,0,100);
      n.status+=2;n.influence+=2;n.grievance=Math.max(0,n.grievance-4);
      if(n.roleId==='citizen'){n.roleId='rebel';n.roleName='Rebel'}
      remember(n,'Rallied supporters against the ruling order.');
      if(typeof window.SIM_LOG==='function')window.SIM_LOG(`${n.name} began a political movement in ${k.name}.`);
    }
  }

  function createCrime(offender,type,severity,victim){
    if(!state.crimes)return null;
    const existing=state.crimes.find(c=>c.offenderId===offender.id&&!c.resolved);
    if(existing)return existing;
    const crime={id:`crime-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,year:state.year,day:state.day,offenderId:offender.id,victimId:victim?.id||null,type,severity:clamp(severity,1,100),resolved:false,witnessIds:[],evidence:0};
    const witnesses=alive().filter(x=>x.id!==offender.id&&x.id!==victim?.id&&x.settlementId===offender.settlementId).slice(0,4);
    crime.witnessIds=witnesses.filter(w=>Math.random()<.68).map(w=>w.id);
    crime.evidence=crime.witnessIds.length*12+Math.max(0,offender.crimeHeat||0)*.15;
    state.crimes.push(crime);
    offender.crimes=(offender.crimes||0)+1;offender.crimeHeat=clamp((offender.crimeHeat||0)+severity*.55,0,100);
    if(victim){victim.grievance=clamp((victim.grievance||0)+severity*.35,0,100);relation(victim,offender,-18);addFamilyEffect(victim,1,-.1,severity*.03,0)}
    addFamilyEffect(offender,-severity*.06,-severity*.04,severity*.1,0);
    return crime;
  }

  function crimeAction(n){
    const risk=score(n,'crime'),clever=score(n,'scheme'),honest=score(n,'crime');
    const crimeChance=.0018+Math.max(0,risk)*.00055+(n.grievance||0)*.00005;
    if(Math.random()>crimeChance)return;
    const target=alive().filter(x=>x.id!==n.id&&x.settlementId===n.settlementId).sort((a,b)=>b.wealth-a.wealth)[0];
    if(!target)return;
    const kind=has(n,'cruel')&&Math.random()<.15?'assault':has(n,'clever')&&Math.random()<.25?'smuggling':target.wealth>70?'theft':'petty_theft';
    const severity=kind==='assault'?75:kind==='smuggling'?50:kind==='theft'?32:18;
    if(kind==='theft'||kind==='petty_theft'){
      const stolen=Math.min(target.wealth,Math.max(2,rand(2,Math.min(18,target.wealth*.25))));
      target.wealth-=stolen;n.wealth+=stolen*.92;n.reputation=clamp(n.reputation-1.2,0,100);
    } else if(kind==='smuggling'){
      const gain=rand(4,14);n.wealth+=gain;n.reputation=clamp(n.reputation-1,0,100);
    } else if(kind==='assault'){
      target.health=clamp(target.health-rand(8,24),0,100);target.mood=clamp(target.mood-10,0,100);n.reputation=clamp(n.reputation-4,0,100);
    }
    const c=createCrime(n,kind,severity,target);
    if(c){remember(n,`Committed ${kind}.`);n.lastAction=`Committed ${kind}`;}
  }

  function punishmentFor(trial,offender){
    const s=trial.severity;
    const repeat=(offender.crimes||0)>=3||(offender.crimeHeat||0)>70;
    const treason=trial.type==='treason';
    const r=Math.random();
    if(treason||repeat&&s>35){if(r<.72)return'death';if(r<.98)return'exile';return'fine';}
    if(s<30){if(r<.72)return'fine';if(r<.94)return'exile';return'death';}
    if(s<60){if(r<.36)return'fine';if(r<.77)return'exile';return'death';}
    if(r<.06)return'fine';if(r<.43)return'exile';return'death';
  }

  function inheritAfterDeath(dead){
    const f=family(dead);if(!f)return;
    f.deadMembers=(f.deadMembers||0)+1;
    const heirs=alive().filter(x=>x.familyId===dead.familyId&&x.id!==dead.id).sort((a,b)=>(dead.childrenIds?.includes(b.id)?1:0)-(dead.childrenIds?.includes(a.id)?1:0)||b.age-a.age);
    const heir=heirs[0];
    if(heir){heir.wealth+=(dead.wealth||0)*.8;f.wealth=(f.wealth||0)+(dead.wealth||0)*.2;heir.status+=(dead.status||0)*.08;remember(heir,`Inherited the fortune of ${dead.name}.`)}
  }

  function execute(offender,trial){
    if(!offender.alive)return;
    inheritAfterDeath(offender);
    offender.alive=false;offender.executed=true;offender.wanted=false;offender.imprisoned=false;
    const f=family(offender),c=clanOf(offender);
    if(f){f.reputation=clamp((f.reputation??50)-8,0,100);f.prestige=Math.max(0,(f.prestige??10)-3);f.rivalry=(f.rivalry??0)+trial.severity*.08;}
    if(c){c.honor=clamp((c.honor??50)-5,0,100);c.influence=Math.max(0,(c.influence??10)-1.5)}
    addKingdomEffect(offender,-trial.severity*.025,-trial.severity*.01,0);
    if(typeof window.SIM_LOG==='function')window.SIM_LOG(`${offender.name} was executed for ${trial.type}.`);
  }

  function exile(offender,trial){
    offender.exiled=true;offender.imprisoned=false;offender.wanted=false;offender.term=0;offender.goal='Exiled';offender.lastAction='Exiled from the realm';
    offender.settlementId=null;offender.home=null;offender.faction=null;
    offender.x=rand(-650,650);offender.y=rand(-450,450);offender.reputation=clamp(offender.reputation-8,0,100);offender.status=Math.max(0,offender.status-10);offender.grievance=clamp((offender.grievance||0)+12,0,100);
    addFamilyEffect(offender,-4,-2,trial.severity*.1,0);addKingdomEffect(offender,-trial.severity*.035,-.2,0);
    remember(offender,`Was exiled for ${trial.type}.`);
    if(typeof window.SIM_LOG==='function')window.SIM_LOG(`${offender.name} was exiled for ${trial.type}.`);
  }

  function fine(offender,trial){
    const base=Math.max(6,trial.severity*.9+offender.wealth*.16);
    const fine=Math.min(Math.max(4,offender.wealth*.65),base);
    offender.wealth=Math.max(0,offender.wealth-fine);
    offender.reputation=clamp(offender.reputation-(trial.severity<30?2:5),0,100);
    offender.status=Math.max(0,offender.status-(trial.severity>55?4:1.5));
    const k=kingdom(offender);if(k)k.treasury=(k.treasury||0)+fine;
    addFamilyEffect(offender,-1.5,-.6,trial.severity*.04,-fine*.04);addKingdomEffect(offender,.18,.05,fine);
    remember(offender,`Paid a ${Math.floor(fine)} gold fine for ${trial.type}.`);offender.lastAction=`Paid ${Math.floor(fine)}g fine`;
    if(typeof window.SIM_LOG==='function')window.SIM_LOG(`${offender.name} paid a ${Math.floor(fine)}g fine for ${trial.type}.`);
  }

  function resolveTrials(){
    if(!state.crimes)return;
    state.crimes.filter(c=>!c.resolved).slice(0,8).forEach(crime=>{
      const offender=state.npcs.find(n=>n.id===crime.offenderId);if(!offender||!offender.alive){crime.resolved=true;return;}
      if(state.tick%4!==0)return;
      const witnesses=crime.witnessIds.map(id=>state.npcs.find(n=>n.id===id)).filter(Boolean);
      const honesty=witnesses.reduce((a,w)=>a+Math.max(0,score(w,'law')),.0);
      const evidence=crime.evidence+honesty*.22+((offender.crimeHeat||0)*.1);
      const defense=score(offender,'evasion')*.25+score(offender,'clever')*.12;
      const convicted=Math.random()<clamp(.38+(evidence-defense)*.008,0.22,.98);
      crime.resolved=true;crime.convicted=convicted;
      state.trials=state.trials||[];
      const trial={id:`trial-${crime.id}`,crimeId:crime.id,offenderId:offender.id,type:crime.type,severity:crime.severity,convicted,witnessIds:crime.witnessIds,punishment:null,year:state.year};
      if(convicted){trial.punishment=punishmentFor(trial,offender);if(trial.punishment==='death')execute(offender,trial);else if(trial.punishment==='exile')exile(offender,trial);else fine(offender,trial);}else{offender.reputation=clamp(offender.reputation+0.5,0,100);offender.crimeHeat=Math.max(0,offender.crimeHeat-8);remember(offender,`Survived a trial for ${crime.type}.`);if(typeof window.SIM_LOG==='function')window.SIM_LOG(`${offender.name} was acquitted of ${crime.type}.`)}
      state.trials.push(trial);state.trials=state.trials.slice(-80);
    });
  }

  function propagateSocial(n){
    const f=family(n);if(f){
      const live=f.members.map(id=>state.npcs.find(x=>x.id===id)).filter(x=>x&&x.alive);
      if(live.length){const avg=live.reduce((a,x)=>a+(x.reputation||50),0)/live.length;f.reputation=clamp(f.reputation??avg,0,100);f.prestige=Math.max(0,(f.prestige??10)+((avg-50)*.001));}
    }
    const s=settlement(n);if(s){s.stability=clamp(s.stability+((n.reputation||50)-50)*.00012,0,100);s.wealth=Math.max(0,s.wealth+(n.wealth||0)*.00001)}
    n.fortune=clamp((n.fortune??50)+((n.reputation||50)-50)*.00008+((n.health||100)-70)*.00002,0,100);
    n.crimeHeat=Math.max(0,(n.crimeHeat||0)-.015);
  }

  function chooseAction(n){
    if(n.exiled||n.age<13)return;
    if((n.hunger||0)>82){n.lastAction='Sought food';return;}
    if(score(n,'help')>30&&Math.random()<.12)return helpAction(n);
    if(score(n,'education')>18&&Math.random()<.1)return mentorAction(n);
    if((n.age>=18&&!n.partnerId)&&score(n,'marriage')>10&&Math.random()<.09)return marriageAction(n);
    if(score(n,'politics')>10&&Math.random()<.08)return politicalAction(n);
    if(score(n,'crime')>7)crimeAction(n);
    if(Math.random()<.45)wealthAction(n);
  }

  function enhanceInspector(){
    const box=document.getElementById('inspectorContent');if(!box)return;
    const id=state.selected;const n=state.npcs.find(x=>x.id===id);if(!n)return;
    if(box.dataset.socialNpc===String(id))return;
    ensureTraits(n);box.dataset.socialNpc=String(id);
    const f=family(n),c=clanOf(n);
    const div=document.createElement('div');div.className='social-trait-card';
    div.innerHTML=`<h4>Traits &amp; Social Fate</h4><div style="display:flex;flex-wrap:wrap;gap:5px;margin:.35rem 0 .6rem">${n.traits.map(t=>`<span style="padding:3px 7px;border-radius:999px;background:rgba(255,255,255,.08);font-size:10px">${t}</span>`).join('')}</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;font-size:11px"><span>Reputation <b>${Math.round(n.reputation||50)}</b></span><span>Honor <b>${Math.round(n.honor||50)}</b></span><span>Status <b>${Math.round(n.status||0)}</b></span><span>Class <b>${n.classTier||'peasant'}</b></span><span>Education <b>${Math.round(n.education||0)}</b></span><span>Fortune <b>${Math.round(n.fortune||50)}</b></span><span>Family Rep <b>${Math.round(f?.reputation||50)}</b></span><span>Clan Honor <b>${Math.round(c?.honor||50)}</b></span></div>`;
    box.appendChild(div);
  }

  function syncRolesAndClasses(){
    alive().forEach(n=>{
      ensureTraits(n);
      n.status=clamp((n.status||0)+((n.reputation||50)-50)*.004+score(n,'leadership')*.001,0,100);
      if(score(n,'education')>30)n.education=clamp(n.education+.02,0,100);
      if((n.reputation||50)>80&&score(n,'leadership')>18)n.influence+=.025;
      if(has(n,'pious')&&Math.random()<.01)n.reputation=clamp(n.reputation+.5,0,100);
      if(has(n,'paranoid')&&Math.random()<.004){n.grievance=clamp((n.grievance||0)+1.5,0,100);n.lastAction='Suspected betrayal';}
      if(has(n,'vengeful')&&n.grievance>35&&Math.random()<.006)crimeAction(n);
      if(has(n,'honest')&&Math.random()<.004&&n.crimeHeat>8)n.crimeHeat=Math.max(0,n.crimeHeat-2);
      n.classTier=(n.roleId==='king'||n.roleId==='emperor'||n.status>85)?'royal':(['duke','count','baron','mayor'].includes(n.roleId)||n.status>65)?'noble':(['merchant','trader'].includes(n.roleId)||n.wealth>110)?'merchant':(['blacksmith','carpenter','weaver'].includes(n.roleId))?'artisan':n.roleId==='soldier'?'military':'peasant';
    });
  }

  function step(){
    if(!state.running)return;
    alive().forEach(ensureTraits);
    if(state.tick%6===0){syncRolesAndClasses();alive().forEach(chooseAction);resolveTrials();alive().forEach(propagateSocial);}
    if(state.tick%20===0)enhanceInspector();
  }

  window.EverglenSocial={traits:TRAIT_PROFILES,ensureTraits,step,resolveTrials};
  window.SIM_LOG=window.SIM_LOG||((m)=>{state.feed.unshift(`Year ${state.year}, Day ${state.day}: ${m}`);state.feed=state.feed.slice(0,15)});
  setInterval(step,700);
  setInterval(enhanceInspector,500);
  alive().forEach(ensureTraits);
})();
