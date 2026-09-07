(() => {
  const state = window.SIM_STATE;
  if (!state) return;

  const clean = name => name.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
  const categories = {
    intelligence:['Genius','Smart','Average','Slow','Forgetful','Creative','Logical','Curious','Observant','Strategic','Adaptable','Impulsive','Cautious','Focused','Distractible'],
    personality:['Brave','Cowardly','Confident','Insecure','Kind','Cruel','Generous','Greedy','Honest','Deceptive','Loyal','Unfaithful','Patient','Short-tempered','Calm','Paranoid','Ambitious','Lazy','Hardworking','Charismatic','Shy','Arrogant','Humble','Competitive','Cooperative'],
    combat:['Strong','Weak','Tough','Fragile','Fast','Agile','Fearless','Berserker','Tactical Fighter','Marksman','Duelist','Defensive','Aggressive','Pacifist','Battle-Hardened','Veteran','Inexperienced'],
    economy:['Wealthy','Poor','Entrepreneur','Trader','Investor','Hoarder','Frugal','Wasteful','Risk-Taker','Gambler','Thief','Hard Worker','Opportunist'],
    social:['Friendly','Antisocial','Extrovert','Introvert','Romantic','Flirtatious','Jealous','Protective','Empathetic','Manipulative','Persuasive','Popular','Lonely','Trusting','Suspicious','Gossiper','Leader','Follower'],
    leadership:['Natural Leader','Dictator','Democratic','Diplomat','Peacemaker','Warmonger','Politician','Reformer','Traditionalist','Rebel','Tyrant','Bureaucrat','Visionary','Corrupt','Just','Authoritarian'],
    survival:['Resourceful','Self-Sufficient','Hunter','Farmer','Builder','Explorer','Adventurous','Survivalist','Risk-Averse','Disease Resistant','Hardy','Sensitive','Weather Resistant'],
    nobility:['Noble Born','Royal Blood','Common Born','Noble House','Ancient Bloodline','Highborn','Lowborn Noble','Bastard Blood','Legitimate Heir','Illegitimate','Courtly','Diplomatic','Court Intriguer','Political Insider','Reformist','Power Broker','Kingmaker','Court Loyalist','Ambitious Noble','Scheming Noble','Noble Rival','Factional','Influential','Honorable Noble','Chivalrous','Proud','Aristocratic','Entitled','Humble Noble','Decadent','Duty-Bound','Prestigious','Scandalous','Firstborn','Spare Heir','Disinherited','Favored Heir','Dynastic Founder','Dynastic Loyalist','Succession Claimant','Strong Claim','Weak Claim','Usurper'],
    rare:['Immortal','Regeneration','Giant','Dwarf','Night Vision','Superhuman','Mutant','Psychic','Prophet','Lucky','Unlucky','Cursed','Blessed','Genius Bloodline','Chosen One','Natural Born Ruler','Prodigy','Legendary Warrior']
  };

  const profiles = {};
  const defaults = () => ({reputation:0,status:0,leadership:0,wealth:0,trade:0,investment:0,combat:0,work:0,education:0,explore:0,crime:0,help:0,friendship:0,marriage:0,politics:0,risk:0,law:0,loyalty:0,rebel:0,mercy:0,feud:0,scheme:0,evasion:0,stability:0,prestige:0,faith:0,research:0,survival:0,health:0,fortune:0,intimidation:0,suspicion:0,spy:0,conflict:0});
  const add = (name, category) => {
    const t=clean(name);
    const p=defaults();
    if(category==='intelligence'){p.education=12;p.research=10;p.politics=3}
    if(category==='personality'){p.friendship=5;p.help=2}
    if(category==='combat'){p.combat=12;p.risk=5}
    if(category==='economy'){p.wealth=10;p.trade=8}
    if(category==='social'){p.friendship=10;p.marriage=5}
    if(category==='leadership'){p.leadership=12;p.politics=9;p.status=4}
    if(category==='survival'){p.survival=12;p.health=4}
    if(category==='nobility'){p.status=12;p.prestige=14;p.politics=8}
    if(category==='rare'){p.status=8;p.reputation=5}
    profiles[t]=p;
  };
  Object.entries(categories).forEach(([cat,list])=>list.forEach(x=>add(x,cat)));

  const override={
    genius:{education:38,research:42,politics:14},smart:{education:24,research:18,scheme:8},average:{},slow:{education:-12},forgetful:{education:-14},creative:{education:18,research:30,wealth:8,explore:8},logical:{education:22,research:18,law:10},curious:{education:22,explore:22,research:10},observant:{education:12,law:14,scheme:10,suspicion:8},strategic:{education:14,politics:24,combat:12,scheme:12},adaptable:{education:10,survival:15,explore:8},impulsive:{risk:20,crime:7,combat:6},cautious:{risk:-18,survival:12,evasion:8},focused:{education:10,work:18,research:12},distractible:{work:-14,education:-4},
    brave:{risk:18,combat:22,leadership:10,help:2},cowardly:{risk:-22,evasion:18,combat:-12},confident:{leadership:12,reputation:8,friendship:8},insecure:{reputation:-8,friendship:-4,suspicion:8},kind:{help:25,friendship:18,crime:-18,mercy:18},cruel:{crime:24,intimidation:28,mercy:-24,feud:18,politics:-4},generous:{help:34,friendship:22,prestige:16,wealth:-8},greedy:{wealth:24,trade:18,crime:18,help:-8},honest:{crime:-30,law:24,reputation:20},deceptive:{scheme:25,crime:16,evasion:22,reputation:-12},loyal:{loyalty:28,leadership:8,crime:-12,rebel:-22,help:8},unfaithful:{loyalty:-20,marriage:12,friendship:-8},patient:{wealth:18,trade:12,investment:28,risk:-18},short_tempered:{conflict:20,feud:18,risk:8,friendship:-8},calm:{reputation:4,peace:28,mediation:30,crime:-12,feud:-22},paranoid:{suspicion:30,spy:24,friendship:-14,conflict:12},ambitious:{leadership:22,status:18,politics:20,risk:6,crime:4},lazy:{work:-28,wealth:4,crime:4},hardworking:{work:30,wealth:10,reputation:5},charismatic:{friendship:30,marriage:28,leadership:24,politics:16},shy:{friendship:-8,marriage:-3,leadership:-7},arrogant:{status:8,friendship:-10,conflict:8},humble:{friendship:12,reputation:10,prestige:5},competitive:{risk:8,leadership:10,combat:8,friendship:-3},cooperative:{help:14,friendship:16,stability:8},
    strong:{combat:28},weak:{combat:-24},tough:{combat:18,health:15},fragile:{combat:-15,health:-18},fast:{combat:15,risk:6},agile:{combat:18,evasion:14},fearless:{risk:26,combat:24},berserker:{combat:32,risk:35,mercy:-10},tactical_fighter:{combat:25,education:8},marksman:{combat:24,evasion:8},duelist:{combat:26,friendship:-2},defensive:{combat:15,risk:-8},aggressive:{combat:20,risk:20,crime:8,conflict:12},pacifist:{combat:-22,peace:25,help:8},battle_hardened:{combat:24,risk:12,health:8},veteran:{combat:28,status:8,leadership:10},inexperienced:{combat:-22},
    wealthy:{wealth:25,status:8,prestige:6},poor:{wealth:-25,status:-5},entrepreneur:{wealth:20,trade:22,risk:12},trader:{trade:28,wealth:15},investor:{investment:32,wealth:18,risk:-6},hoarder:{wealth:24,help:-12},frugal:{wealth:14,investment:10},wasteful:{wealth:-18,help:-4},risk_taker:{risk:25,wealth:10},gambler:{risk:30,wealth:7,fortune:5},thief:{crime:28,scheme:14,evasion:18},hard_worker:{work:25,wealth:10},opportunist:{wealth:16,scheme:18,risk:10},
    friendly:{friendship:24,help:8},antisocial:{friendship:-24,conflict:8},extrovert:{friendship:18,leadership:8},introvert:{friendship:-4,education:8},romantic:{marriage:26,friendship:12},flirtatious:{marriage:18,friendship:20,loyalty:-8},jealous:{suspicion:16,conflict:12,marriage:8},protective:{help:18,combat:10,loyalty:20},empathetic:{help:24,friendship:22,mercy:15},manipulative:{scheme:28,friendship:-10,politics:12},persuasive:{friendship:20,leadership:18,politics:20},popular:{friendship:22,reputation:20,leadership:14},lonely:{friendship:-20,help:-2},trusting:{friendship:18,suspicion:-18},suspicious:{suspicion:22,friendship:-8},gossiper:{friendship:4,reputation:-6,scheme:10},leader:{leadership:22,politics:12},follower:{leadership:-10,loyalty:14},
    natural_leader:{leadership:34,politics:20,status:8},dictator:{leadership:24,intimidation:30,stability:-12},democratic:{leadership:14,stability:18,friendship:12},diplomat:{politics:28,friendship:18,stability:18},peacemaker:{mediation:34,peace:34,stability:24},warmonger:{combat:16,politics:18,conflict:28,stability:-18},politician:{politics:30,leadership:18,scheme:12},reformer:{politics:22,stability:10,reputation:8},traditionalist:{stability:12,politics:8,resist:8},rebel:{rebel:34,conflict:20,politics:18,stability:-12},tyrant:{leadership:20,intimidation:34,stability:-20},bureaucrat:{law:18,politics:22,stability:16},visionary:{leadership:22,research:24,politics:18},corrupt:{crime:24,politics:12,stability:-12},just:{law:30,reputation:18,stability:20},authoritarian:{leadership:28,intimidation:20,stability:-8},
    resourceful:{survival:28,wealth:12,explore:10},self_sufficient:{survival:30,work:18},hunter:{survival:24,combat:12,explore:10},farmer:{survival:18,work:22,wealth:8},builder:{work:24,wealth:10},explorer:{explore:32,survival:18},adventurous:{explore:28,risk:18},survivalist:{survival:38,health:12,risk:-4},risk_averse:{risk:-28,survival:18},disease_resistant:{health:25,survival:18},hardy:{health:24,combat:10,survival:20},sensitive:{health:-10,friendship:8},weather_resistant:{health:18,survival:24},
    noble_born:{status:30,prestige:24,politics:14},royal_blood:{status:45,prestige:38,leadership:18,politics:26},common_born:{status:-4},noble_house:{status:24,prestige:30,politics:18},ancient_bloodline:{prestige:42,status:22,politics:16},highborn:{status:28,prestige:22},lowborn_noble:{status:14,prestige:12},bastard_blood:{status:-6,politics:8,reputation:-4},legitimate_heir:{status:42,prestige:28,politics:24},illegitimate:{status:-8,politics:10},courtly:{friendship:18,politics:22,prestige:16},court_intriguer:{scheme:32,politics:28,prestige:8},political_insider:{politics:32,leadership:14},power_broker:{politics:34,wealth:16,influence:24},kingmaker:{politics:38,influence:30,leadership:14},court_loyalist:{loyalty:28,politics:16,stability:12},ambitious_noble:{leadership:28,politics:32,status:22},scheming_noble:{scheme:34,politics:28},noble_rival:{feud:26,politics:22},factional:{politics:26,friendship:-4},influential:{influence:34,leadership:18},honorable_noble:{law:20,reputation:24,prestige:22},chivalrous:{combat:18,help:14,prestige:24,loyalty:18},proud:{status:16,prestige:10,friendship:-8},aristocratic:{status:24,prestige:18},entitled:{status:18,help:-10,friendship:-8},humble_noble:{prestige:12,friendship:16,help:10},decadent:{wealth:-4,help:-8,mood:8},duty_bound:{loyalty:24,work:18,stability:10},prestigious:{prestige:32,status:14},scandalous:{reputation:-24,status:8,crime:10},firstborn:{status:22,prestige:18},spare_heir:{status:18,politics:12},disinherited:{status:-22,grievance:18,rebel:16},favored_heir:{status:36,prestige:24,politics:16},dynastic_founder:{prestige:44,leadership:28,status:24},dynastic_loyalist:{loyalty:30,politics:14,stability:12},succession_claimant:{politics:30,status:30,feud:12},strong_claim:{status:34,politics:28},weak_claim:{status:8,politics:10},usurper:{politics:34,rebel:20,crime:12},
    immortal:{health:100,prestige:35,status:25},regeneration:{health:45,survival:30},giant:{health:20,combat:25,status:8},dwarf:{health:8,combat:12,work:12},night_vision:{survival:12,combat:8,explore:12},superhuman:{health:30,combat:35,survival:22,status:18},mutant:{health:-8,combat:18,survival:10},psychic:{education:24,research:26,suspicion:12},prophet:{faith:35,reputation:18,leadership:18},lucky:{fortune:35,wealth:10,health:5},unlucky:{fortune:-35,wealth:-5,health:-4},cursed:{fortune:-30,health:-12,reputation:-8},blessed:{fortune:28,health:18,faith:25},genius_bloodline:{education:30,research:28,prestige:20},chosen_one:{status:40,prestige:40,leadership:28,fortune:20},natural_born_ruler:{leadership:38,politics:28,status:26},prodigy:{education:36,research:26,combat:12},legendary_warrior:{combat:42,status:26,prestige:34,leadership:18}
  };
  Object.entries(override).forEach(([t,p])=>profiles[t]={...(profiles[t]||defaults()),...p});

  window.EVERGLEN_TRAIT_PROFILES=profiles;
  window.EVERGLEN_TRAIT_CATEGORIES=categories;
  window.EVERGLEN_TRAIT_CONFLICTS={
    brave:['cowardly'],cowardly:['brave'],confident:['insecure'],insecure:['confident'],kind:['cruel'],cruel:['kind'],generous:['greedy'],greedy:['generous'],honest:['deceptive'],deceptive:['honest'],loyal:['unfaithful'],unfaithful:['loyal'],patient:['short_tempered'],short_tempered:['patient'],calm:['short_tempered'],strong:['weak'],weak:['strong'],tough:['fragile'],fragile:['tough'],aggressive:['pacifist'],pacifist:['aggressive'],wealthy:['poor'],poor:['wealthy'],introvert:['extrovert'],extrovert:['introvert'],trusting:['suspicious'],suspicious:['trusting']
  };

  const all=Object.keys(profiles), dynamic=new Set(['wealthy','poor']), seedable=all.filter(t=>!dynamic.has(t));
  const pick=a=>a[Math.floor(Math.random()*a.length)];
  const conflicts=window.EVERGLEN_TRAIT_CONFLICTS;
  const compatible=(n,t)=>!n.traits?.includes(t)&&!(conflicts[t]||[]).some(x=>n.traits?.includes(x));
  function addTrait(n,t){n.traits=n.traits||[];if(compatible(n,t))n.traits.push(t)}
  function syncDynamic(n){
    n.traits=n.traits||[];
    n.traits=n.traits.filter(t=>t!=='wealthy'&&t!=='poor');
    if((n.wealth||0)>=120)addTrait(n,'wealthy'); else if((n.wealth||0)<12)addTrait(n,'poor');
  }
  function seed(n){
    if(!n||n._traitExpanded)return;
    n.traits=Array.isArray(n.traits)&&n.traits.length?n.traits.slice():[n.trait||pick(seedable)];
    for(let i=0;i<2;i++){
      if(Math.random() < (i===0?.45:.22)){
        let pool=seedable.filter(x=>x!==n.trait&&compatible(n,x));
        if(pool.length)addTrait(n,pick(pool));
      }
    }
    n.trait=n.traits[0];n._traitExpanded=true;syncDynamic(n);
  }
  function syncNobility(n){
    n.traits=n.traits||[];
    const nobleRoles=['mayor','baron','count','duke','king','heir','emperor'];
    const noble=nobleRoles.includes(n.roleId)||n.classTier==='noble'||n.classTier==='royal'||(n.status||0)>=72;
    if(noble)addTrait(n,'noble_born');
    if(['king','emperor','heir'].includes(n.roleId))addTrait(n,'royal_blood');
    if(n.roleId==='heir')addTrait(n,'legitimate_heir');
    if((n.status||0)>=88)addTrait(n,'influential');
    if((n.status||0)>=78&&(n.reputation||50)>72)addTrait(n,'prestigious');
    if((n.status||0)<50&&!noble)addTrait(n,'common_born');
  }
  function tick(){
    for(const n of state.npcs||[]){if(!n.alive)continue;seed(n);syncDynamic(n);syncNobility(n)}
  }
  window.EVERGLEN_TRAIT_EXPANSION={profiles,categories,seed,tick};
  tick();
  setInterval(()=>{if(window.SIM_STATE?.running!==false)tick()},350);
})();
