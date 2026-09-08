// Medieval society layer: feudal ranks, guilds, law, and faith.
(() => {
  const state=window.SIM_STATE;if(!state)return;
  const P=window.NPC_PERSONALITY,M=window.NPC_MEMORY;
  const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,v));
  const alive=()=>state.npcs.filter(n=>n.alive);
  const role=(n)=>n.roleId||'';
  const score=(n,k)=>P?.score(n,k)??50;
  const kingdom=n=>state.getKingdom?state.getKingdom(n.kingdomId):state.kingdoms?.find(k=>k.id===n.kingdomId);
  const settlement=n=>state.getSettlement?state.getSettlement(n.settlementId):state.settlements?.find(s=>s.id===n.settlementId);
  const log=t=>window.SIM_API?.log?.(t);

  const RANKS={
    peasant:{title:'Peasant',minWealth:0,political:.08,tax:.11,military:.35},
    artisan:{title:'Artisan',minWealth:8,political:.16,tax:.09,military:.28},
    merchant:{title:'Merchant',minWealth:25,political:.3,tax:.08,military:.18},
    knight:{title:'Knight',minWealth:45,political:.5,tax:.06,military:1},
    noble:{title:'Noble',minWealth:80,political:.82,tax:.04,military:.8},
    lord:{title:'Lord',minWealth:140,political:1,tax:.03,military:.9}
  };
  const GUILD_ROLES={farmers:['farmer','rancher','hunter','fisher','forager'],craftsmen:['blacksmith','carpenter','weaver','mason','builder','engineer','architect','farrier'],merchants:['merchant','trader','peddler','shopkeeper'],scholars:['scholar','teacher','scribe','librarian','artist'],healers:['healer','doctor','herbalist','alchemist'],sailors:['sailor','shipwright','courier','explorer'],mages:['mage','wizard','enchanter','druid','cleric']};
  const LAWS=[
    {id:'customary',name:'Customary Law',order:.35,tax:.7,freedom:1},
    {id:'royal',name:'Royal Law',order:.6,tax:1,freedom:.82},
    {id:'feudal',name:'Feudal Law',order:.82,tax:1.12,freedom:.62},
    {id:'mercantile',name:'Mercantile Law',order:.48,tax:.86,freedom:1.05}
  ];
  const FAITHS=['Ancestor Keepers','Oathbound','Seekers of Light','Fortune Covenant','Kindred Faith','Path of the Strong'];

  function rankFor(n){
    const w=Math.max(0,n.wealth||0),r=role(n),noble=n.noble||n.title==='Noble'||n.title==='Lord';
    if(n.title==='King'||n.title==='Queen'||n.title==='Emperor')return'lord';
    if(noble&&w>=140)return'lord';if(noble)return'noble';
    if(['knight','captain','general','marshal'].includes(r))return'knight';
    if(['merchant','trader','shopkeeper'].includes(r)||w>=25)return'merchant';
    if(['blacksmith','carpenter','weaver','mason','builder','engineer','architect'].includes(r)||w>=8)return'artisan';
    return'peasant';
  }
  function guildFor(n){for(const[id,roles]of Object.entries(GUILD_ROLES))if(roles.includes(role(n)))return id;return null;}
  function ensureNpc(n){
    n.socialClass=n.socialClass||rankFor(n);n.guildId=n.guildId||guildFor(n);n.title=n.title||(RANKS[n.socialClass]?.title||'Peasant');n.legalStatus=n.legalStatus||'free';n.faith=n.faith||null;n.faithStrength=n.faithStrength??0;
  }
  function ensureSettlement(s){
    s.feudal=s.feudal||{lordId:null,vassalIds:[],taxRate:.1,levyRate:.08,legitimacy:50};
    s.guilds=s.guilds||{};s.law=s.law||{id:'customary',crime:50,order:50};s.faith=s.faith||{name:null,strength:0,temples:0,clergy:0};s.land=s.land||{owned:0,arable:50};
  }
  function assignLord(s,p){
    if(s.feudal.lordId&&p.some(n=>n.id===s.feudal.lordId))return;
    const candidates=p.filter(n=>['noble','lord','knight'].includes(rankFor(n))).sort((a,b)=>((b.influence||0)+(b.wealth||0)*.15+score(b,'ambition'))-((a.influence||0)+(a.wealth||0)*.15+score(a,'ambition')));
    if(candidates[0]){s.feudal.lordId=candidates[0].id;candidates[0].socialClass='lord';candidates[0].title='Lord';candidates[0].influence=Math.max(candidates[0].influence||0,80);}
  }
  function feudalStep(s,p){
    ensureSettlement(s);assignLord(s,p);const lord=p.find(n=>n.id===s.feudal.lordId);if(!lord)return;
    s.feudal.taxRate=clamp(.06+(lord.greed||score(lord,'greed')-50)/500,.04,.18);s.feudal.levyRate=clamp(.05+(score(lord,'discipline')-50)/700,.03,.15);
    const levy=s.feudal.levyRate*p.filter(n=>['peasant','artisan'].includes(rankFor(n))&&n.age>=16&&n.age<=50).length;s.levy=levy;
    const tax=p.reduce((sum,n)=>sum+(n.wealth||0)*s.feudal.taxRate*.002,0);lord.wealth=(lord.wealth||0)+tax;s.wealth=Math.max(0,(s.wealth||0)+tax*.15);
    const grievance=clamp((s.feudal.taxRate-.1)*160+(s.foodSecurity<35?18:0)+(s.law.order<40?15:0)-(s.feudal.legitimacy||50)*.08,0,100);s.feudal.grievance=grievance;s.feudal.legitimacy=clamp((s.feudal.legitimacy||50)+(lord.socialClass==='lord'?0.02:-.03)-grievance*.001);
    if(grievance>65&&Math.random()<.012*state.speed){p.filter(n=>rankFor(n)==='peasant').slice(0,3).forEach(n=>{n.grievance=clamp((n.grievance||0)+1.2);M?.remember(n,`${s.name}'s taxes became unbearable.`,'feudal',3,s.id,'anger');});log(`${s.name} faces peasant unrest under Lord ${lord.name}.`);}
  }
  function guildStep(s,p){
    const counts={};p.forEach(n=>{ensureNpc(n);const g=n.guildId;if(g)counts[g]=(counts[g]||0)+1;});
    Object.entries(GUILD_ROLES).forEach(([id])=>{const c=counts[id]||0;s.guilds[id]=s.guilds[id]||{members:0,influence:0,prestige:20,masterId:null};s.guilds[id].members=c;s.guilds[id].influence=clamp(c*3+s.guilds[id].prestige*.35,0,100);const members=p.filter(n=>n.guildId===id).sort((a,b)=>(b.wealth||0)-(a.wealth||0));if(members[0])s.guilds[id].masterId=members[0].id;});
    if((s.law?.id)==='mercantile')s.guildBonus=Math.min(20,Object.values(s.guilds).reduce((a,g)=>a+g.influence,0)*.03);else s.guildBonus=0;
  }
  function faithStep(s,p){
    ensureSettlement(s);const candidates=FAITHS.map(name=>({name,score:p.reduce((v,n)=>v+(n.faith===name?n.faithStrength:0),0)+Math.random()*4})).sort((a,b)=>b.score-a.score)[0];
    if(candidates&&candidates.score>5){if(s.faith.name!==candidates.name){s.faith.name=candidates.name;s.faith.strength=clamp(candidates.score);s.faith.temples=(s.faith.temples||0)+(p.length>=25?1:0);log(`${s.name} now follows the ${candidates.name}.`);}else s.faith.strength=clamp(s.faith.strength*.99+candidates.score*.04);}
    p.forEach(n=>{ensureNpc(n);if(!n.faith){const openness=(score(n,'curiosity')+score(n,'sociability'))/2;const chance=.01+openness*.00012;if(Math.random()<chance){n.faith=s.faith.name||FAITHS[Math.floor(Math.random()*FAITHS.length)];n.faithStrength=25+Math.random()*35;M?.remember(n,`I embraced the ${n.faith}.`,'faith',2,s.id,'joy');}}else n.faithStrength=clamp(n.faithStrength+(n.faith===s.faith.name?.03:-.01));});
    s.faith.clergy=p.filter(n=>['cleric','mage','druid'].includes(role(n))).length;
  }
  function lawStep(s,p){
    ensureSettlement(s);s.law=s.law||{id:'customary',crime:50,order:50};const law=LAWS.find(l=>l.id===s.law.id)||LAWS[0];const crime=p.reduce((a,n)=>a+(n.criminalRecord?.length||0),0);s.law.crime=clamp(crime/Math.max(1,p.length)*30);s.law.order=clamp(52+law.order*30-s.law.crime*.45+(s.infrastructure?.defenses||0)*.15);
    if(s.law.id==='feudal'&&s.feudal) s.feudal.legitimacy=clamp((s.feudal.legitimacy||50)+.03);
    if(s.law.order<35&&Math.random()<.006*state.speed){const target=p.filter(n=>(n.grievance||0)>35).sort((a,b)=>(b.grievance||0)-(a.grievance||0))[0];if(target){target.wanted=target.wanted||false;M?.remember(target,`The law failed to protect my community.`,'law',3,s.id,'anger');}}
  }
  function step(){
    if(!state.running)return;
    const batch=window.SIM_BUDGET?.npcBatch?.()||alive();const touched=new Set(batch.map(n=>n.settlementId).filter(Boolean));
    state.settlements.forEach(s=>{if(!touched.has(s.id)&&state.tick%6!==0)return;const p=alive().filter(n=>n.settlementId===s.id);if(!p.length)return;p.forEach(ensureNpc);ensureSettlement(s);feudalStep(s,p);guildStep(s,p);lawStep(s,p);faithStep(s,p);});
  }
  window.MEDIEVAL_SOCIETY={RANKS,GUILD_ROLES,LAWS,FAITHS,ensureNpc,ensureSettlement,step,rankFor,guildFor};
  if(state.registerSystem)state.registerSystem({name:'medieval-society',step,priority:74});
})();
