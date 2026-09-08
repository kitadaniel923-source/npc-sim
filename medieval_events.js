// Emergent medieval events: harvests, feasts, tournaments, pilgrimages, famine and political crises.
(() => {
  const state=window.SIM_STATE;if(!state)return;
  const M=window.NPC_MEMORY;
  const P=window.NPC_PERSONALITY;
  const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,v));
  const alive=()=>state.npcs.filter(n=>n.alive);
  const residents=s=>alive().filter(n=>n.settlementId===s.id);
  const score=(n,k)=>P?.score(n,k)??50;
  const inv=s=>s.resources=s.resources||{};
  const log=t=>window.SIM_API?.log?.(t);
  const rand=a=>a[Math.floor(Math.random()*a.length)];

  const EVENT_POOL=[
    {id:'good_harvest',weight:18,run(s,p){const grain=(inv(s).grain||0)+Math.max(4,p.length*.12);inv(s).grain=grain;inv(s).food=(inv(s).food||0)+Math.max(5,p.length*.16);s.economy&&(s.economy.foodSecurity=clamp((s.economy.foodSecurity||50)+8));s.stability=clamp((s.stability||50)+4);return `${s.name} enjoys a plentiful harvest.`;}},
    {id:'poor_harvest',weight:10,run(s,p){inv(s).food=Math.max(0,(inv(s).food||0)-Math.min(inv(s).food||0,Math.max(3,p.length*.08)));inv(s).grain=Math.max(0,(inv(s).grain||0)-Math.min(inv(s).grain||0,Math.max(2,p.length*.05)));s.stability=clamp((s.stability||50)-3);s.economy&&(s.economy.foodSecurity=clamp((s.economy.foodSecurity||50)-7));return `${s.name} suffers a poor harvest.`;}},
    {id:'market_fair',weight:12,run(s,p){s.services=s.services||{};s.services.trade=clamp((s.services.trade||20)+7);s.wealth=(s.wealth||0)+Math.max(3,p.length*.04);p.filter(n=>['merchant','trader','artisan'].includes(n.socialClass)||['merchant','trader','blacksmith','weaver','carpenter'].includes(n.roleId)).slice(0,6).forEach(n=>M?.remember(n,`A great market fair was held in ${s.name}.`,'festival',2,s.id,'joy'));return `${s.name} holds a bustling market fair.`;}},
    {id:'festival',weight:10,run(s,p){s.stability=clamp((s.stability||50)+5);s.faith&&(s.faith.strength=clamp((s.faith.strength||0)+4));p.slice(0,8).forEach(n=>{n.mood=clamp((n.mood??60)+5);M?.remember(n,`I celebrated a festival in ${s.name}.`,'festival',2,s.id,'joy');});return `${s.name} celebrates a festival.`;}},
    {id:'tournament',weight:7,run(s,p){const fighters=p.filter(n=>['knight','soldier','captain','general','marshal','militia'].includes(n.roleId)||n.socialClass==='knight');const champion=fighters.sort((a,b)=>(score(b,'courage')+score(b,'discipline'))-(score(a,'courage')+score(a,'discipline')))[0];s.wealth=(s.wealth||0)+8;s.feudal&&(s.feudal.legitimacy=clamp((s.feudal.legitimacy||50)+3));if(champion){champion.influence=(champion.influence||0)+5;champion.reputation=(champion.reputation||50)+6;M?.remember(champion,`I won a tournament in ${s.name}.`,'tournament',4,s.id,'pride',true);}return champion?`${s.name} holds a tournament won by ${champion.name}.`:`${s.name} holds a tournament.`;}},
    {id:'pilgrimage',weight:6,run(s,p){s.faith=s.faith||{};s.faith.strength=clamp((s.faith.strength||20)+6);const pilgrims=p.filter(n=>(n.faithStrength||0)>45||['cleric','druid'].includes(n.roleId)).slice(0,6);pilgrims.forEach(n=>{n.mood=clamp((n.mood??60)+3);M?.remember(n,`I traveled on pilgrimage from ${s.name}.`,'faith',3,s.id,'joy');});return `${s.name} draws pilgrims to its holy places.`;}},
    {id:'famine',weight:5,run(s,p){const food=Math.max(0,inv(s).food||0),loss=Math.min(food,Math.max(5,p.length*.18));inv(s).food=food-loss;s.stability=clamp((s.stability||50)-10);s.economy&&(s.economy.foodSecurity=clamp((s.economy.foodSecurity||30)-14));p.filter(n=>(n.age||20)>=16).slice(0,8).forEach(n=>{n.grievance=clamp((n.grievance||0)+4);M?.remember(n,`Famine struck ${s.name}.`,'famine',4,s.id,'fear',true);});return `${s.name} is struck by famine.`;}},
    {id:'succession_crisis',weight:4,run(s,p){const lord=s.feudal?.lordId?(state.getNpc?state.getNpc(s.feudal.lordId):state.npcs.find(n=>n.id===s.feudal.lordId)):null;const claimants=p.filter(n=>['noble','lord','knight'].includes(n.socialClass)&&n.id!==lord?.id).sort((a,b)=>(b.influence||0)+(b.wealth||0)*.1-(a.influence||0)-(a.wealth||0)*.1).slice(0,3);if(lord&&claimants.length){s.feudal.legitimacy=clamp((s.feudal.legitimacy||50)-9);claimants.forEach(n=>{n.grievance=clamp((n.grievance||0)+6);M?.remember(n,`I saw a succession dispute in ${s.name}.`,'succession',4,lord.id,'anger',2);});return `A succession crisis divides the nobility of ${s.name}.`;}return null;}},
    {id:'guild_dispute',weight:6,run(s,p){const guilds=s.guilds||{};const active=Object.entries(guilds).filter(([,g])=>(g.members||0)>1).sort((a,b)=>(b[1].influence||0)-(a[1].influence||0));if(active.length>1){s.wealth=Math.max(0,(s.wealth||0)-4);s.law&&(s.law.order=clamp((s.law.order||50)-4));return `${s.name} sees a dispute between powerful guilds.`;}return null;}},
    {id:'bandit_raid',weight:7,run(s,p){const loss=Math.min(inv(s).food||0,Math.max(2,p.length*.04));inv(s).food=Math.max(0,(inv(s).food||0)-loss);s.wealth=Math.max(0,(s.wealth||0)-5);s.law&&(s.law.order=clamp((s.law.order||50)-5));p.filter(n=>score(n,'courage')>65).slice(0,5).forEach(n=>M?.remember(n,`Bandits raided ${s.name}.`,'crime',3,s.id,'fear'));return `Bandits raid the roads around ${s.name}.`;}}
  ];

  function choose(){const total=EVENT_POOL.reduce((a,e)=>a+e.weight,0);let r=Math.random()*total;for(const e of EVENT_POOL){r-=e.weight;if(r<=0)return e;}return EVENT_POOL[0];}
  function step(){
    if(!state.running||state.tick%120!==0)return;
    const ss=state.settlements||[];if(!ss.length)return;
    const s=ss[Math.floor(Math.random()*ss.length)];const p=residents(s);if(!p.length)return;
    const baseChance=.55+(s.populationPeak>0?Math.min(.35,s.populationPeak/1000):0);if(Math.random()>baseChance)return;
    const e=choose();const text=e.run(s,p);if(text){s.history=s.history||[];s.history.push(`Year ${state.year}: ${text}`);s.history=s.history.slice(-40);log(text);}}

  window.MEDIEVAL_EVENTS={EVENT_POOL,choose,step};
  if(state.registerSystem)state.registerSystem({name:'medieval-events',step,priority:88});
})();
