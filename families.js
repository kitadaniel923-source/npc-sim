// Emergent family, clan and inheritance system.
// This module consumes personality, relationships and memory instead of maintaining a separate simulation loop.
(() => {
  const state = window.SIM_STATE;
  if (!state) return;

  const PERSONALITY = window.NPC_PERSONALITY;
  const RELATIONSHIPS = window.NPC_RELATIONSHIPS;
  const MEMORY = window.NPC_MEMORY;
  const ROLE_BY_ID = window.ROLE_BY_ID || {};

  const FAMILY_NAMES = ['Alder','Ashford','Blackwood','Bright','Cedar','Crowe','Dawn','Ember','Frost','Hawthorne','Ironheart','Kingsley','Moon','Oak','Raven','Rivera','Stone','Thorne','Vale','Wren'];
  const CLAN_NAMES = ['Alder Clan','Ashen Clan','Brightwood Clan','Cedar Clan','Crow Clan','Ember Clan','Frost Clan','Iron Clan','Moon Clan','Oak Clan','Raven Clan','Stone Clan','Thorn Clan','Vale Clan'];
  const ADULT_AGE = 18;

  const clamp = (v,a=0,b=100) => Math.max(a,Math.min(b,v));
  const alive = () => (state.npcs || []).filter(n => n.alive);
  const findNpc = id => state.npcs.find(n => n.id === id);
  const score = (n,key) => PERSONALITY?.score(n,key) ?? 50;

  function ensureNpc(n) {
    n.parents = Array.isArray(n.parents) ? n.parents : (Array.isArray(n.parentIds) ? n.parentIds.slice() : []);
    n.childrenIds = Array.isArray(n.childrenIds) ? n.childrenIds : [];
    n.spouseId = n.spouseId ?? n.partnerId ?? null;
    if (n.spouseId && !n.partnerId) n.partnerId = n.spouseId;
    n.estate = n.estate || {gold:Math.max(0,n.wealth||0),land:0,buildings:0,titles:[]};
    n.legitimacy = n.legitimacy ?? clamp(45 + score(n,'loyalty')*.25 + score(n,'ambition')*.15);
    return n;
  }

  function familyFor(n) {
    return n?.familyId ? state.families.find(f => f.id === n.familyId) : null;
  }

  function createFamily(n) {
    const name = FAMILY_NAMES[(state.families.length + Math.abs(Number(n.id)||0)) % FAMILY_NAMES.length];
    const f = {
      id:`family-${n.id}`,
      name,
      founderId:n.id,
      members:[n.id],
      wealth:n.wealth||0,
      influence:5,
      reputation:n.reputation||50,
      prestige:10,
      generation:1,
      seat:n.home||null,
      clanId:null,
      history:[]
    };
    state.families.push(f);
    n.familyId=f.id;
    n.familyName=f.name;
    return f;
  }

  function initialize() {
    const byId = new Map((state.families || []).map(f => [f.id,f]));
    alive().forEach((n,i) => {
      ensureNpc(n);
      let f = n.familyId ? byId.get(n.familyId) : null;
      if (!f) {
        f = createFamily(n);
        byId.set(f.id,f);
      } else {
        f.members = f.members || [];
        if (!f.members.includes(n.id)) f.members.push(n.id);
        n.familyName = n.familyName || f.name;
        f.name = f.name || FAMILY_NAMES[i % FAMILY_NAMES.length];
      }
    });
    rebuildClans();
    state._familiesReady = true;
  }

  function rebuildClans() {
    const byFamily = new Map((state.families || []).map(f => [f.id,f]));
    const clanMap = new Map();
    alive().forEach(n => {
      const family = byFamily.get(n.familyId);
      if (!family) return;
      const clanName = family.clanName || CLAN_NAMES[Math.abs(Number(n.id)||0) % CLAN_NAMES.length];
      family.clanName = clanName;
      if (!clanMap.has(clanName)) clanMap.set(clanName, {id:`clan-${clanName}`,name:clanName,families:[],members:0,influence:0,wealth:0,reputation:50});
      const clan = clanMap.get(clanName);
      if (!clan.families.includes(family.id)) clan.families.push(family.id);
      clan.members++;
      clan.wealth += n.wealth || 0;
      clan.influence += n.influence || 0;
      clan.reputation = (clan.reputation + (n.reputation || 50)) / 2;
    });
    state.clans = [...clanMap.values()];
    state.clans.forEach(c => c.families.forEach(fid => {
      const f = byFamily.get(fid); if (f) f.clanId = c.id;
    }));
  }

  function marriageScore(a,b) {
    if (!a || !b) return -Infinity;
    const compatibility = RELATIONSHIPS?.compatibility?.(a,b) ?? 0;
    const trustA = RELATIONSHIPS?.trustValue?.(a,b.id) ?? 50;
    const trustB = RELATIONSHIPS?.trustValue?.(b,a.id) ?? 50;
    const social = (score(a,'sociability') + score(b,'sociability')) * .08;
    const kindness = (score(a,'kindness') + score(b,'kindness')) * .06;
    const loyalty = (score(a,'loyalty') + score(b,'loyalty')) * .06;
    const ambitionGap = Math.abs(score(a,'ambition')-score(b,'ambition'));
    const ambitionPenalty = ambitionGap > 40 ? (ambitionGap-40)*.25 : 0;
    const factionBonus = a.faction && b.faction && a.faction === b.faction ? 9 : -3;
    const ageGap = Math.abs(a.age-b.age);
    const ageScore = ageGap <= 6 ? 8 : ageGap <= 12 ? 3 : -8;
    return compatibility*.7 + (trustA+trustB)*.24 + social + kindness + loyalty + factionBonus + ageScore - ambitionPenalty;
  }

  function marry(a,b) {
    ensureNpc(a); ensureNpc(b);
    if (!a || !b || a.id===b.id || !a.alive || !b.alive || a.spouseId || b.spouseId) return false;
    if (a.age < ADULT_AGE || b.age < ADULT_AGE || Math.abs(a.age-b.age)>22) return false;
    const scoreValue = marriageScore(a,b);
    if (scoreValue < 62) return false;

    a.spouseId=b.id; b.spouseId=a.id;
    a.partnerId=b.id; b.partnerId=a.id;
    a.estate.gold=(a.estate.gold||0)+(b.estate.gold||0)*.2;
    b.estate.gold=(b.estate.gold||0)+(a.estate.gold||0)*.1;
    a.mood=clamp((a.mood||65)+8); b.mood=clamp((b.mood||65)+8);
    a.lastAction=`Married ${b.name}`; b.lastAction=`Married ${a.name}`;

    RELATIONSHIPS?.interact?.(a,b,'help',1.8);
    MEMORY?.experience?.(a,`${b.name} became my spouse.`,'family',4,b.id,'joy',-10,true);
    MEMORY?.experience?.(b,`${a.name} became my spouse.`,'family',4,a.id,'joy',-10,true);
    return true;
  }

  function inherit(deceased) {
    if (!deceased || deceased._inheritanceSettled || deceased.alive) return;
    ensureNpc(deceased);
    deceased._inheritanceSettled = true;
    const children = (deceased.childrenIds||[]).map(findNpc).filter(n => n?.alive);
    const spouse = deceased.spouseId ? findNpc(deceased.spouseId) : null;
    const ranked = children.slice().sort((a,b) => {
      const rank = n => (n.roleId === 'heir' ? 1000 : 0) + (n.legitimacy||0) + (n.age>=ADULT_AGE?40:0) + score(n,'loyalty')*.2 + score(n,'ambition')*.1;
      return rank(b)-rank(a) || b.age-a.age;
    });
    const heir = ranked[0] || spouse;
    if (!heir) return;

    heir.estate = heir.estate || {gold:0,land:0,buildings:0,titles:[]};
    const estate = deceased.estate || {gold:deceased.wealth||0,land:0,buildings:0,titles:[]};
    const inheritedGold = estate.gold || deceased.wealth || 0;
    heir.wealth=(heir.wealth||0)+inheritedGold;
    heir.estate.gold=(heir.estate.gold||0)+inheritedGold;
    heir.estate.land=(heir.estate.land||0)+(estate.land||0);
    heir.estate.buildings=(heir.estate.buildings||0)+(estate.buildings||0);
    heir.estate.titles=[...new Set([...(heir.estate.titles||[]),...(estate.titles||[])])];
    heir.legitimacy=clamp((heir.legitimacy||50)+12);

    if (deceased.roleId && ['king','queen','duke','count','baron','prince','emperor','empress','governor','mayor','chancellor'].includes(deceased.roleId)) {
      heir.roleId = deceased.roleId;
      heir.roleName = ROLE_BY_ID[heir.roleId]?.name || heir.roleId;
      heir.lastAction=`Inherited ${deceased.roleName||deceased.roleId}`;
    }

    MEMORY?.experience?.(heir,`Inherited the estate of ${deceased.name}.`,'inheritance',4,deceased.id,'pride',-8,true);
    if (deceased.roleId) MEMORY?.experience?.(heir,`Inherited the title of ${deceased.roleName||deceased.roleId}.`,'succession',4,deceased.id,'pride',-10,true);
    const f=familyFor(deceased); if (f) f.history=(f.history||[]).concat(`Year ${state.year}: ${deceased.name} died; ${heir.name} inherited.`).slice(-12);
  }

  function onBirth(child,parents) {
    parents = (parents||[]).filter(Boolean);
    const [a,b] = parents;
    ensureNpc(child);
    const chosenFamily = familyFor(a) || familyFor(b);
    child.familyId = chosenFamily?.id || createFamily(a||b||child).id;
    child.familyName = chosenFamily?.name || a?.familyName || b?.familyName || 'Unknown';
    child.parents = parents.map(n=>n.id);
    child.parentIds = child.parents.slice();
    child.spouseId=null; child.partnerId=null; child.childrenIds=[];
    child.legitimacy=clamp(45+(score(a||child,'loyalty')+score(b||child,'loyalty'))*.1);
    child.estate={gold:0,land:0,buildings:0,titles:[]};
    child.roleId='child'; child.roleName='Child';
    parents.forEach(parent => {
      parent.childrenIds=parent.childrenIds||[];
      if (!parent.childrenIds.includes(child.id)) parent.childrenIds.push(child.id);
      MEMORY?.experience?.(parent,`${child.name} was born into my family.`,'family',4,child.id,'joy',-8,true);
    });
    if (chosenFamily) {
      chosenFamily.members=chosenFamily.members||[];
      if (!chosenFamily.members.includes(child.id)) chosenFamily.members.push(child.id);
      chosenFamily.generation=Math.max(chosenFamily.generation||1, ...parents.map(p => (familyFor(p)?.generation||1)+1));
    }
  }

  function maybeBirth(a,b) {
    if (!a || !b || !a.alive || !b.alive || a.spouseId!==b.id) return false;
    if (a.age<18 || b.age<18 || a.age>48 || b.age>55) return false;
    const existing = (a.childrenIds||[]).map(findNpc).filter(n=>n?.alive && n.age<18).length;
    if (existing >= 5) return false;
    const trust = ((RELATIONSHIPS?.trustValue?.(a,b.id)??50)+(RELATIONSHIPS?.trustValue?.(b,a.id)??50))/2;
    const stability = (a.needs?.safety??60)+(b.needs?.safety??60);
    const desire = 45 + trust*.25 + stability*.08 - existing*8 + ((score(a,'kindness')+score(b,'kindness'))*.08);
    if (Math.random() > clamp(desire/180,.02,.35)) return false;

    const nextId = state.npcs.reduce((m,n)=>Math.max(m,Number(n.id)||0),0)+1;
    const child = window.SIM_API?.createNpc?.(nextId-1, a.faction) || {
      id:nextId,name:`Child ${nextId}`,age:0,sex:Math.random()>.5?'F':'M',trait:'calm',alive:true,wealth:0,mood:70,health:100,hunger:10,energy:90,memories:[],relations:[],childrenIds:[],parentIds:[],familyId:null,faction:a.faction,x:(a.x+b.x)/2,y:(a.y+b.y)/2
    };
    child.age=0; child.sex=Math.random()>.5?'F':'M'; child.faction=a.faction; child.x=(a.x+b.x)/2; child.y=(a.y+b.y)/2; child.alive=true; child.lastAction='Born into a family'; child.hunger=10; child.energy=90; child.health=100;
    state.npcs.push(child);
    onBirth(child,[a,b]);
    MEMORY?.experience?.(a,`${child.name} was born.`,'birth',4,child.id,'joy',-12,true);
    MEMORY?.experience?.(b,`${child.name} was born.`,'birth',4,child.id,'joy',-12,true);
    window.SIM_API?.log?.(`${a.name} and ${b.name} welcomed ${child.name}.`);
    return true;
  }

  function marriageCandidates(n) {
    return alive().filter(x => x.id!==n.id && x.alive && !x.spouseId && x.sex!==n.sex && x.age>=ADULT_AGE && Math.abs(x.age-n.age)<=14 && x.faction===n.faction)
      .map(x => ({npc:x,score:marriageScore(n,x)}))
      .sort((a,b)=>b.score-a.score)
      .slice(0,6);
  }

  function tick() {
    if (!state._familiesReady) initialize();
    const adults=alive().filter(n=>{ensureNpc(n);return n.age>=ADULT_AGE;});

    if (state.tick % 18 === 0) {
      for (const n of adults) {
        if (n.spouseId || n.age>68) continue;
        const options=marriageCandidates(n);
        if (!options.length) continue;
        const best=options[0];
        const pressure = score(n,'sociability')*.15 + score(n,'kindness')*.1 + (n.needs?.belonging||0)*.2 + (score(n,'ambition')<45?6:0);
        if (best.score + pressure > 82 && Math.random() < .22) marry(n,best.npc);
      }
    }

    if (state.tick % 30 === 0) {
      adults.filter(n=>n.spouseId).forEach(a => {
        const b=findNpc(a.spouseId);
        if (b && a.id < b.id) maybeBirth(a,b);
      });
    }

    if (state.tick % 12 === 0) {
      state.npcs.filter(n=>!n.alive && !n._inheritanceSettled).forEach(inherit);
      state.families.forEach(f=>{
        const members=alive().filter(n=>n.familyId===f.id);
        f.members=members.map(n=>n.id);
        f.wealth=members.reduce((s,n)=>s+(n.wealth||0),0);
        f.influence=members.length*2 + members.reduce((s,n)=>s+(n.influence||0)+(n.legitimacy||0)*.1,0);
        f.reputation=members.length ? members.reduce((s,n)=>s+(n.reputation||50),0)/members.length : f.reputation||50;
      });
    }
    if (state.tick % 60 === 0) rebuildClans();
  }

  window.FAMILY_SYSTEM={
    familyNames:FAMILY_NAMES,
    clanNames:CLAN_NAMES,
    initialize,
    rebuildClans,
    marriageScore,
    marry,
    inherit,
    onBirth,
    maybeBirth,
    tick
  };
  window.addFamilyMemory=(npc,text)=>MEMORY?.remember?.(npc,text,'family',2,null,'pride');
  window.familyTick=tick;
  if (state.registerSystem) state.registerSystem({name:'families',step:tick,priority:50});
})();
