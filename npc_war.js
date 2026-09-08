// Dedicated war and battle layer.
// Resolves army readiness, supply, battles, sieges, commanders and war memory.
(() => {
  const state=window.SIM_STATE;if(!state)return;
  const personality=window.NPC_PERSONALITY;
  const memory=window.NPC_MEMORY;
  const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,v));
  const alive=()=>state.npcs.filter(n=>n.alive);
  const score=(n,k)=>personality?.score(n,k)??50;
  const log=t=>window.SIM_API?.log?.(t);

  function kingdom(id){return state.kingdoms.find(k=>k.id===id);}
  function commander(army){
    const k=kingdom(army.kingdomId);
    const people=alive().filter(n=>n.faction===army.kingdomId&&n.age>=18);
    return people.filter(n=>['marshal','general','captain','knight'].includes(n.roleId)).sort((a,b)=>{
      const ca=score(a,'courage')+score(a,'discipline')+score(a,'ambition');
      const cb=score(b,'courage')+score(b,'discipline')+score(b,'ambition');
      return cb-ca;
    })[0]||people.sort((a,b)=>score(b,'courage')-score(a,'courage'))[0]||null;
  }

  function ensureArmy(a){
    a.soldiers=Math.max(0,a.soldiers||0);a.supply=clamp(a.supply??100);a.morale=clamp(a.morale??80);a.exhaustion=clamp(a.exhaustion??0);a.experience=a.experience??0;a.battleCount=a.battleCount??0;a.victories=a.victories??0;a.defeats=a.defeats??0;a.commanderId=a.commanderId||null;a.navalStrength=a.navalStrength??0;
    if(!a.commanderId){const c=commander(a);if(c)a.commanderId=c.id;}
  }

  function equipmentPower(a){
    const cap=state.settlements.find(s=>s.id===kingdom(a.kingdomId)?.capitalId);
    const stock=cap?.resources||{};
    const arms=Math.min(a.soldiers,Math.max(0,stock.weapons||0)*1.5);
    const armor=Math.min(a.soldiers,Math.max(0,stock.armor||0)*1.25);
    a.equipment=Math.min(1.35,(.65+(arms/Math.max(1,a.soldiers))*.4+(armor/Math.max(1,a.soldiers))*.3));
    return a.equipment;
  }

  function readiness(a){
    ensureArmy(a);
    const c=a.commanderId?state.npcs.find(n=>n.id===a.commanderId):null;
    const command=c?(score(c,'courage')*.22+score(c,'discipline')*.2+score(c,'loyalty')*.12+score(c,'ambition')*.08):35;
    const supply=.5+(a.supply/200);const morale=.5+(a.morale/200);const exp=1+Math.min(.25,a.experience*.01);
    const equip=equipmentPower(a);
    return Math.max(.1,(command+25)*supply*morale*exp*equip/100);
  }

  function reinforce(a){
    const k=kingdom(a.kingdomId);if(!k)return;
    const cap=state.settlements.find(s=>s.id===k.capitalId);if(!cap)return;
    if(a.supply<55){
      const food=Math.min(8,cap.resources.food||0),weapons=Math.min(Math.max(1,Math.ceil(a.soldiers*.03)),cap.resources.weapons||0),armor=Math.min(Math.max(1,Math.ceil(a.soldiers*.02)),cap.resources.armor||0);
      cap.resources.food-=food;cap.resources.weapons-=weapons;cap.resources.armor-=armor;
      a.supply=clamp(a.supply+food*1.5);a.navalStrength+=Math.min(2,cap.resources.battle_boats||0)*.04;
    }
    a.supply=clamp(a.supply-.08*state.speed,0,100);
    a.exhaustion=clamp(a.exhaustion+(a.active?.01:0),0,100);
  }

  function resolveBattle(a,b){
    ensureArmy(a);ensureArmy(b);
    const pa=readiness(a),pb=readiness(b);
    const luckA=.85+Math.random()*.35,luckB=.85+Math.random()*.35;
    const powerA=Math.max(1,a.soldiers)*pa*luckA;
    const powerB=Math.max(1,b.soldiers)*pb*luckB;
    const total=Math.max(1,powerA+powerB);
    const lossA=Math.min(a.soldiers,Math.max(1,Math.round(b.soldiers*(powerB/total)*(.06+.05*Math.random()))));
    const lossB=Math.min(b.soldiers,Math.max(1,Math.round(a.soldiers*(powerA/total)*(.06+.05*Math.random()))));
    a.soldiers=Math.max(0,a.soldiers-lossA);b.soldiers=Math.max(0,b.soldiers-lossB);
    a.supply=clamp(a.supply-lossA*.7);b.supply=clamp(b.supply-lossB*.7);
    a.morale=clamp(a.morale-lossA*.55+lossB*.3);b.morale=clamp(b.morale-lossB*.55+lossA*.3);
    a.exhaustion=clamp(a.exhaustion+lossA*.3+8);b.exhaustion=clamp(b.exhaustion+lossB*.3+8);
    a.experience+=1;b.experience+=1;a.battleCount++;b.battleCount++;
    const winner=powerA>=powerB?a:b,loser=winner===a?b:a;
    winner.victories++;loser.defeats++;
    const wc=winner.commanderId?state.npcs.find(n=>n.id===winner.commanderId):null,lc=loser.commanderId?state.npcs.find(n=>n.id===loser.commanderId):null;
    if(wc){wc.reputation=clamp((wc.reputation||50)+2);wc.influence=clamp((wc.influence||0)+.6,0,50);memory?.experience(wc,`I won a battle against ${lc?.name||'the enemy'}.`,'war',4,winner.kingdomId,'pride',-4,true);}
    if(lc&&wc)memory?.experience(lc,`${wc.name} defeated my army.`,'war',4,wc.id,'fear',6,true);
    log(`${wc?.name||'An army'} defeated an enemy force. ${lossA+lossB} soldiers were lost.`);
    if(loser.morale<20||loser.soldiers<=2){loser.active=false;loser.morale=clamp(loser.morale-8);}
  }

  function siege(a,target){
    if(!target||!a.active||a.soldiers<3)return;
    const defenders=alive().filter(n=>n.settlementId===target.id&&['militia','soldier','archer','spearman','knight','captain','general','marshal'].includes(n.roleId)).length;
    const fort=Math.max(1,target.buildings*.08+target.stability*.03);
    const naval=(a.navalStrength>0&&((target.resources?.battle_boats||0)>0||Math.random()<.35))?1.15:1;
    const offense=a.soldiers*readiness(a)*naval;
    const defense=Math.max(4,defenders*3+fort*10);
    if(offense>defense*.85){
      const damage=clamp((offense/Math.max(1,defense))*3,1,10);target.stability=clamp(target.stability-damage,0,100);a.morale=clamp(a.morale-.8);a.supply=clamp(a.supply-1.2);
      if(target.stability<20){target.wealth=Math.max(0,target.wealth-4);log(`The siege of ${target.name} is breaking the settlement's defenses.`);}
    }else{
      const losses=Math.max(1,Math.round(defenders*.02+fort*.04));a.soldiers=Math.max(0,a.soldiers-losses);a.morale=clamp(a.morale-2);a.supply=clamp(a.supply-2.2);target.stability=clamp(target.stability+Math.random()*1.5);
    }
  }

  function moveWarriors(){
    const armies=(state.armies||[]).filter(a=>a.active&&a.soldiers>0);
    for(let i=0;i<armies.length;i++)for(let j=i+1;j<armies.length;j++){
      const a=armies[i],b=armies[j];if(a.kingdomId===b.kingdomId)continue;
      if(Math.hypot(a.x-b.x,a.y-b.y)<75)resolveBattle(a,b);
    }
    armies.forEach(a=>{
      ensureArmy(a);const enemies=state.settlements.filter(s=>s.kingdomId!==a.kingdomId);if(!enemies.length)return;
      const target=enemies.sort((x,y)=>Math.hypot(a.x-x.x,a.y-x.y)-Math.hypot(a.x-y.x,a.y-y.y))[0];
      if(target&&Math.hypot(a.x-target.x,a.y-target.y)<45)siege(a,target);
    });
  }

  function demobilize(){
    if(state.war)return;
    state.armies.forEach(a=>{if(a.active){a.active=false;a.morale=clamp(a.morale+4);a.exhaustion=clamp(a.exhaustion-8);}});
  }

  function step(){
    if(!state.running)return;
    if(state.war){
      state.armies.forEach(reinforce);
      if(state.tick%6===0)moveWarriors();
    }else demobilize();
  }

  window.NPC_WAR={step,resolveBattle,siege,readiness,ensureArmy};
  if(state.registerSystem)state.registerSystem({name:'war',step,priority:85});
})();
