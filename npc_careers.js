(() => {
  const state = window.SIM_STATE;
  const personality = window.NPC_PERSONALITY;
  const roles = window.ROLE_BY_ID || {};
  if (!state) return;

  const clamp = (v,a=0,b=100) => Math.max(a,Math.min(b,v));
  const alive = () => state.npcs.filter(n => n.alive);
  const score = (n,key) => personality?.score(n,key) ?? 50;
  const has = (n,t) => personality?.has(n,t) || n.trait === t;

  const CAREERS = [
    {id:'farmer', group:'food', fit:p=>p.discipline*.45+p.kindness*.15+(100-p.risk)*.08},
    {id:'hunter', group:'food', fit:p=>p.courage*.25+p.risk*.25+p.curiosity*.15+p.discipline*.15},
    {id:'miner', group:'industry', fit:p=>p.discipline*.45+p.risk*.12+p.courage*.08},
    {id:'woodcutter', group:'industry', fit:p=>p.discipline*.4+p.courage*.1+(100-p.sociability)*.1},
    {id:'builder', group:'industry', fit:p=>p.discipline*.3+p.cleverness*.35+p.ambition*.12},
    {id:'blacksmith', group:'industry', fit:p=>p.discipline*.3+p.courage*.15+p.cleverness*.3},
    {id:'engineer', group:'knowledge', fit:p=>p.cleverness*.35+p.curiosity*.35+p.discipline*.2},
    {id:'architect', group:'knowledge', fit:p=>p.cleverness*.3+p.curiosity*.25+p.ambition*.25},
    {id:'merchant', group:'wealth', fit:p=>p.ambition*.25+p.risk*.3+p.sociability*.25+p.cleverness*.12},
    {id:'trader', group:'wealth', fit:p=>p.risk*.35+p.sociability*.25+p.curiosity*.2+p.ambition*.15},
    {id:'healer', group:'care', fit:p=>p.kindness*.4+p.discipline*.2+p.sociability*.15},
    {id:'teacher', group:'knowledge', fit:p=>p.kindness*.2+p.sociability*.25+p.curiosity*.3+p.discipline*.15},
    {id:'scholar', group:'knowledge', fit:p=>p.curiosity*.45+p.cleverness*.25+p.discipline*.15},
    {id:'explorer', group:'adventure', fit:p=>p.curiosity*.35+p.risk*.3+p.courage*.2},
    {id:'militia', group:'military', fit:p=>p.loyalty*.3+p.courage*.25+p.discipline*.2},
    {id:'soldier', group:'military', fit:p=>p.courage*.3+p.loyalty*.3+p.aggression*.18+p.discipline*.12},
    {id:'ranger', group:'military', fit:p=>p.courage*.2+p.curiosity*.25+p.risk*.25+p.discipline*.15},
    {id:'captain', group:'military', fit:p=>p.courage*.15+p.aggression*.18+p.ambition*.3+p.discipline*.2+p.loyalty*.1},
    {id:'cleric', group:'faith', fit:p=>p.kindness*.28+p.discipline*.28+p.sociability*.18+p.loyalty*.15},
    {id:'mage', group:'magic', fit:p=>p.curiosity*.5+p.cleverness*.3+p.risk*.1},
    {id:'alchemist', group:'magic', fit:p=>p.curiosity*.4+p.cleverness*.35+p.discipline*.15},
    {id:'thief', group:'rogue', fit:p=>p.risk*.3+p.cleverness*.3+p.sociability*.1+(100-p.kindness)*.2},
    {id:'smuggler', group:'rogue', fit:p=>p.risk*.4+p.ambition*.2+p.cleverness*.2+(100-p.discipline)*.1}
  ];

  const ensurePersonality = n => personality?.ensure(n);

  function careerPool(n) {
    const p = {
      courage:score(n,'courage'), aggression:score(n,'aggression'), sociability:score(n,'sociability'),
      risk:score(n,'risk'), ambition:score(n,'ambition'), discipline:score(n,'discipline'),
      curiosity:score(n,'curiosity'), kindness:score(n,'kindness'), loyalty:score(n,'loyalty'),
      cleverness:(score(n,'curiosity')+score(n,'discipline'))*.5
    };
    return CAREERS.map(c => {
      let s = c.fit(p);
      if (window.EVERGLEN_RACES?.careerModifier) s += window.EVERGLEN_RACES.careerModifier(n,c);
      if (has(n,'greedy')) s += c.group==='wealth' ? 22 : c.group==='rogue' ? 10 : 0;
      if (has(n,'kind')) s += c.group==='care' ? 20 : c.group==='rogue' ? -18 : 0;
      if (has(n,'brave')) s += c.group==='military' ? 18 : c.group==='adventure' ? 10 : 0;
      if (has(n,'curious')) s += ['knowledge','magic','adventure'].includes(c.group) ? 18 : 0;
      if (has(n,'ambitious')) s += ['military','wealth','knowledge'].includes(c.group) ? 14 : 0;
      if (has(n,'loyal')) s += ['military','faith'].includes(c.group) ? 12 : 0;
      if (has(n,'calm')) s += ['care','knowledge','faith'].includes(c.group) ? 10 : ['military','rogue'].includes(c.group) ? -5 : 0;
      if (state.war && c.group==='military') s += 22;
      if (state.plague && c.group==='care') s += 18;
      if ((n.needs?.wealth||0)>70 && c.group==='wealth') s += 12;
      if ((n.needs?.purpose||0)>65 && ['knowledge','military','adventure'].includes(c.group)) s += 8;
      if ((n.education||0)<25 && ['knowledge','magic'].includes(c.group)) s -= 18;
      return {...c,score:s};
    }).sort((a,b)=>b.score-a.score);
  }

  function chooseCareer(n) {
    if (!n.alive || n.age < 18) return;
    if (['king','queen','emperor','empress','duke','count','baron','governor','mayor','heir','prince','princess','prisoner','refugee','rebel'].includes(n.roleId)) return;
    ensurePersonality(n);
    const ranked = careerPool(n);
    const best = ranked[0];
    if (!best) return;
    const currentGroup = CAREERS.find(c=>c.id===n.roleId)?.group;
    if (n.roleId && n.roleId !== 'citizen' && n.roleId !== 'unemployed' && currentGroup && best.score < (CAREERS.find(c=>c.id===n.roleId)?.fit || 0) + 18) return;
    n.career = n.career || {};
    const old = n.roleName;
    n.career.roleId = best.id;
    n.career.group = best.group;
    n.career.score = Math.round(best.score);
    n.career.specialization = best.id === 'blacksmith' ? 'smithing + armoring' : null;
    n.career.lastReview = state.year;
    n.career.history = n.career.history || [];
    if (n.roleId !== best.id) {
      n.roleId = best.id;
      n.roleName = roles[best.id]?.name || best.id;
      n.roleDescription = roles[best.id]?.desc || '';
      n.job = best.group;
      if (old && old !== n.roleName) n.career.history.unshift({year:state.year,from:old,to:n.roleName});
      if (n.career.history.length > 6) n.career.history.length = 6;
      n.lastAction = `Chose a life as ${n.roleName}`;
    }
  }

  function updateCareerDrift(n) {
    if (!n.alive || n.age < 18) return;
    n.careerPressure = {
      wealth: n.needs?.wealth || 0,
      purpose: n.needs?.purpose || 0,
      safety: n.needs?.safety || 0,
      social: n.needs?.social || 0
    };
    if (n.careerPressure.wealth > 82 && (score(n,'ambition') > 65 || has(n,'greedy'))) n.goal = 'Earn wealth';
    if (n.careerPressure.safety > 82 && score(n,'courage') < 45) n.goal = 'Seek safety';
    if (n.careerPressure.purpose > 78 && score(n,'curiosity') > 65) n.goal = 'Learn something new';
    if (state.war && score(n,'loyalty') > 65 && score(n,'courage') > 55) n.goal = 'Defend the realm';
  }

  function step() {
    if (!state.running || !state.npcs?.length) return;
    alive().forEach(n => { ensurePersonality(n); updateCareerDrift(n); });
    if (state.tick % 6 === 0) alive().forEach(chooseCareer);
  }

  window.NPC_CAREERS = { CAREERS, careerPool, chooseCareer, step };
  if (state.registerSystem) state.registerSystem(step);
})();
