// Phase 2: Society & Civilization integration layer.
// Builds civilization-scale institutions from the existing NPC, family, culture and politics systems.
// No DOM listeners or independent render loops. All state is persistent simulation state.
(() => {
  const state = window.SIM_STATE;
  if (!state) return;
  const P = () => window.NPC_PERSONALITY;
  const M = () => window.NPC_MEMORY;
  const clamp = (v,a=0,b=100) => Math.max(a,Math.min(b,v));
  const alive = () => (state.npcs||[]).filter(n=>n.alive);
  const score = (n,k) => P()?.score?.(n,k) ?? 50;
  const has = (n,t) => P()?.has?.(n,t) || n.trait===t || n.traits?.includes(t);
  const peopleAt = s => alive().filter(n=>n.settlementId===s.id);
  const kingdom = kId => state.getKingdom ? state.getKingdom(kId) : state.kingdoms?.find(k=>k.id===kId);
  const family = n => state.getFamily ? state.getFamily(n.familyId) : state.families?.find(f=>f.id===n.familyId);

  const CLASSES = {
    peasant:{power:.10,wealth:.15,roles:['farmer','forager','hunter','woodcutter','miner']},
    artisan:{power:.22,wealth:.28,roles:['blacksmith','carpenter','weaver','builder','mason']},
    merchant:{power:.40,wealth:.55,roles:['merchant','trader','smuggler']},
    scholar:{power:.30,wealth:.28,roles:['scholar','teacher','engineer','architect','alchemist','mage','wizard']},
    clergy:{power:.36,wealth:.25,roles:['cleric','druid']},
    soldier:{power:.46,wealth:.24,roles:['militia','soldier','archer','spearman','ranger','cavalry','knight','captain','general','marshal']},
    nobility:{power:.78,wealth:.70,roles:['baron','count','duke','heir']},
    royalty:{power:1,wealth:.95,roles:['king','queen','emperor','empress','prince','princess']}
  };

  const INSTITUTIONS = {
    guild:{title:'Guild',roles:['farmer','forager','hunter','woodcutter','miner','blacksmith','carpenter','weaver','builder','mason','merchant','trader','peddler','shopkeeper','scholar','teacher','scribe','librarian','healer','doctor','herbalist','alchemist','sailor','shipwright','courier','explorer']},
    council:{title:'Town Council',roles:['mayor','baron','count','duke','merchant','trader','scholar','teacher']},
    court:{title:'Royal Court',roles:['king','queen','emperor','empress','prince','princess','heir','duke','count','baron','mayor','captain','general','marshal','scholar','cleric']},
    military:{title:'Military Order',roles:['militia','soldier','archer','spearman','ranger','cavalry','knight','captain','general','marshal','paladin']},
    academy:{title:'Academy',roles:['scholar','teacher','engineer','architect','alchemist','mage','wizard']},
    faith:{title:'Faith',roles:['cleric','druid','mage','wizard']}
  };

  function classFor(n){
    const r=n.roleId||'';
    if(CLASSES.royalty.roles.includes(r)) return 'royalty';
    if(CLASSES.nobility.roles.includes(r) || n.classTier==='royal' || n.noble) return 'nobility';
    if(CLASSES.soldier.roles.includes(r)) return 'soldier';
    if(CLASSES.clergy.roles.includes(r) || n.faith) return 'clergy';
    if(CLASSES.scholar.roles.includes(r) || (n.education||0)>60) return 'scholar';
    if(CLASSES.merchant.roles.includes(r) || (n.wealth||0)>85) return 'merchant';
    if(CLASSES.artisan.roles.includes(r) || (n.wealth||0)>25) return 'artisan';
    return 'peasant';
  }

  function ensureNpc(n){
    n.society=n.society||{};
    n.society.class=classFor(n);
    n.society.classHistory=n.society.classHistory||[];
    n.society.institutions=n.society.institutions||[];
    n.society.socialInfluence=Number(n.society.socialInfluence||0);
    n.society.ambitionPressure=Number(n.society.ambitionPressure||0);
    return n.society;
  }

  function ensureSettlement(s){
    s.society=s.society||{};
    s.society.institutions=s.society.institutions||{};
    s.society.movements=s.society.movements||[];
    s.society.classPower=s.society.classPower||{};
    s.society.governance=s.society.governance||{councilIds:[],legitimacy:50,cohesion:50};
    return s.society;
  }

  function ensureInstitution(s,id){
    ensureSettlement(s);
    const existing=s.society.institutions[id];
    if(existing) return existing;
    const meta=INSTITUTIONS[id];
    s.society.institutions[id]={id,name:meta?.title||id,members:[],leaderId:null,influence:0,prestige:20,cohesion:50,treasury:0,history:[]};
    return s.society.institutions[id];
  }

  function institutionFit(n,id){
    const r=n.roleId||'', meta=INSTITUTIONS[id];
    if(!meta || (meta.roles.length && !meta.roles.includes(r) && id!=='council')) return -1;
    let v=10;
    if(id==='guild') v+=score(n,'discipline')*.25+score(n,'sociability')*.18;
    if(id==='council') v+=score(n,'ambition')*.28+score(n,'cleverness')*.18+(n.reputation||50)*.15+(n.influence||0)*1.2;
    if(id==='court') v+=score(n,'ambition')*.25+score(n,'loyalty')*.18+(n.status||0)*.2;
    if(id==='military') v+=score(n,'courage')*.3+score(n,'discipline')*.25+score(n,'loyalty')*.18;
    if(id==='academy') v+=score(n,'curiosity')*.35+score(n,'cleverness')*.25+(n.education||0)*.2;
    if(id==='faith') v+=score(n,'kindness')*.22+score(n,'loyalty')*.18+score(n,'sociability')*.18+(n.faithStrength||0)*.2;
    if(has(n,'charismatic')) v+=8;
    if(has(n,'honest')) v+=5;
    if(has(n,'ambitious')&&['council','court'].includes(id)) v+=10;
    return v;
  }

  function membershipStep(s,p){
    ensureSettlement(s);
    const classPower={peasant:0,artisan:0,merchant:0,scholar:0,clergy:0,soldier:0,nobility:0,royalty:0};
    p.forEach(n=>{
      ensureNpc(n);
      const c=n.society.class;
      classPower[c]=(classPower[c]||0)+CLASSES[c].power+(n.influence||0)*.02;
      for(const id of Object.keys(INSTITUTIONS)){
        const fit=institutionFit(n,id);
        const existing=s.society.institutions[id];
        const member=existing?.members?.includes(n.id);
        const threshold=id==='council'?46:id==='court'?42:28;
        if(fit>=threshold && !member && n.age>=16 && Math.random()<.06){
          const inst=ensureInstitution(s,id);inst.members.push(n.id);n.society.institutions.push({settlementId:s.id,institutionId:id});
          M()?.remember?.(n,`I joined the ${inst.name} in ${s.name}.`,'institution',1.8,inst.id,'pride');
        }
      }
    });
    s.society.classPower=classPower;

    for(const [id,inst] of Object.entries(s.society.institutions)){
      inst.members=inst.members.filter(id=>p.some(n=>n.id===id&&n.alive));
      const candidates=p.filter(n=>inst.members.includes(n.id)).sort((a,b)=>institutionFit(b,id)-institutionFit(a,id));
      const leader=candidates[0];
      if(leader){
        inst.leaderId=leader.id;
        inst.influence=clamp(candidates.reduce((v,n)=>v+(n.influence||0)+institutionFit(n,id)*.12,0));
        inst.cohesion=clamp(45+Math.min(30,candidates.length*1.5)+score(leader,'loyalty')*.18-score(leader,'stubborn')*.08);
      }
      inst.treasury=Math.max(0,(inst.treasury||0)+Math.min(2,inst.members.length*.02));
    }
  }

  function governanceStep(s,p){
    const gov=s.society.governance;const council=ensureInstitution(s,'council');
    const eligible=p.filter(n=>n.age>=22 && (n.society.class!=='peasant'||(n.reputation||50)>72));
    eligible.sort((a,b)=>institutionFit(b,'council')-institutionFit(a,'council'));
    gov.councilIds=eligible.slice(0,Math.max(2,Math.min(8,Math.ceil(p.length*.08)))).map(n=>n.id);
    council.members=Array.from(new Set([...council.members,...gov.councilIds]));
    const councilPower=gov.councilIds.reduce((v,id)=>{const n=p.find(x=>x.id===id);return v+(n?(n.influence||0)+institutionFit(n,'council')*.15:0)},0);
    const legitimacy=(s.stability??70)*.45+(s.feudal?.legitimacy??50)*.3+Math.min(25,councilPower*.12);
    gov.legitimacy=clamp(legitimacy);
    gov.cohesion=clamp(45+(council.members.length*2)-(s.society.movements.length*3));
    s.society.governanceLabel=gov.legitimacy>75?'legitimate':gov.legitimacy>50?'contested':'fragile';
  }

  function movementStep(s,p){
    const classPower=s.society.classPower||{};
    const feudalGrievance=s.feudal?.grievance||0;
    const lawOrder=s.law?.order??60;
    const candidates=[];
    if(feudalGrievance>52||lawOrder<38) candidates.push({type:'commons-reform',label:'Commons Reform Movement',cause:'taxes and weak local order',base:feudalGrievance*.8+(50-lawOrder)*.7});
    if((classPower.merchant||0)>22&&(s.law?.id==='mercantile'||(s.wealth||0)>220)) candidates.push({type:'merchant-league',label:'Merchant League',cause:'trade and commercial influence',base:(classPower.merchant||0)*.45});
    if((classPower.nobility||0)>18&&s.feudal?.legitimacy<48) candidates.push({type:'noble-council',label:'Noble Council',cause:'elite competition for authority',base:(classPower.nobility||0)*.5+(50-(s.feudal.legitimacy||50))); 
    if((classPower.soldier||0)>20&&state.war) candidates.push({type:'military-caucus',label:'Military Caucus',cause:'war mobilization and army interests',base:(classPower.soldier||0)*.5});
    if((classPower.scholar||0)>16&&s.infrastructure?.knowledge>30) candidates.push({type:'scholars-circle',label:'Scholars Circle',cause:'knowledge and institutional learning',base:(classPower.scholar||0)*.55});

    for(const cand of candidates){
      let m=s.society.movements.find(x=>x.type===cand.type);
      const pressure=clamp(cand.base + (s.society.governance.legitimacy<45?18:0));
      if(!m && pressure>35){
        const leader=p.filter(n=>n.age>=18).sort((a,b)=>(score(b,'ambition')+score(b,'sociability'))-(score(a,'ambition')+score(a,'sociability')))[0];
        m={id:`movement-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,type:cand.type,label:cand.label,cause:cand.cause,founderId:leader?.id||null,supporters:[],strength:10,stage:'forming',history:[]};
        s.society.movements.push(m);
        if(leader) M()?.remember?.(leader,`I helped form the ${cand.label} in ${s.name}.`,'movement',3,s.id,'pride',false);
      }
      if(!m) continue;
      const eligible=p.filter(n=>n.age>=16);
      eligible.slice(0,Math.min(20,eligible.length)).forEach(n=>{
        const affinity=cand.type==='merchant-league'?score(n,'cleverness')+score(n,'ambition'):cand.type==='military-caucus'?score(n,'loyalty')+score(n,'courage'):cand.type==='scholars-circle'?score(n,'curiosity')+score(n,'cleverness'):score(n,'kindness')+score(n,'stubborn')+((n.grievance||0)*.6);
        if(affinity>75 && !m.supporters.includes(n.id) && Math.random()<.05) {
          m.supporters.push(n.id);
          M()?.remember?.(n,`I joined the ${m.label}.`,'movement',2,m.id,'pride');
        }
      });
      m.strength=clamp(m.strength*.97+m.supporters.length*.18+pressure*.08);
      m.stage=m.strength>70?'mass':m.strength>42?'organized':'forming';
      if(m.stage==='mass'&&s.society.governance.legitimacy<35)m.stage='revolt-risk';
      m.history=(m.history||[]).slice(-12);m.history.push(`Year ${state.year}: strength ${Math.round(m.strength)}.`);
    }
    s.society.movements=s.society.movements.filter(m=>m.strength>4).slice(-12);
  }

  function socialMobility(n){
    ensureNpc(n);
    const old=n.society.class;
    let next=old;
    if((n.roleId==='merchant'||n.roleId==='trader')&&(n.wealth||0)>90)next='merchant';
    if(CLASSES.artisan.roles.includes(n.roleId)&&(n.wealth||0)>30)next='artisan';
    if(CLASSES.scholar.roles.includes(n.roleId)&&(n.education||0)>55)next='scholar';
    if(CLASSES.soldier.roles.includes(n.roleId)&&score(n,'discipline')>62)next='soldier';
    if((n.status||0)>75&&['baron','count','duke','heir'].includes(n.roleId))next='nobility';
    if(['king','queen','emperor','empress','prince','princess'].includes(n.roleId))next='royalty';
    if(old!==next){n.society.classHistory.unshift({from:old,to:next,year:state.year,reason:'wealth, education, office or career changed social standing'});n.society.classHistory=n.society.classHistory.slice(0,8);n.society.class=next;M()?.remember?.(n,`My social standing changed from ${old} to ${next}.`,'social-mobility',2.5,null,'pride',true);}
  }

  function step(){
    if(!state.running)return;
    const B=window.SIM_BUDGET;
    const batch=B?.npcBatch?.()||alive();
    batch.forEach(socialMobility);
    state.settlements?.forEach(s=>{
      const p=peopleAt(s);if(!p.length)return;
      ensureSettlement(s);membershipStep(s,p);governanceStep(s,p);movementStep(s,p);
    });
    state.kingdoms?.forEach(k=>{
      k.society=k.society||{};
      const members=alive().filter(n=>n.faction===k.id);
      const counts={};members.forEach(n=>{const c=classFor(n);counts[c]=(counts[c]||0)+1});
      k.society.classDistribution=counts;
      k.society.institutionCount=state.settlements.filter(s=>s.kingdomId===k.id).reduce((v,s)=>v+Object.keys(s.society?.institutions||{}).length,0);
      k.society.movementCount=state.settlements.filter(s=>s.kingdomId===k.id).reduce((v,s)=>v+(s.society?.movements?.length||0),0);
    });
  }

  window.SOCIETY_CIVILIZATION={CLASSES,INSTITUTIONS,ensureNpc,ensureSettlement,classFor,institutionFit,step};
  state.registerSystem?.({name:'society-civilization',step,priority:94});
})();
