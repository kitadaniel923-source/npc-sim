// Phase 2: emergent civil war system.
// Converts sustained regime crisis into an actual internal armed conflict while reusing NPC_WAR for battle resolution.
// Rebel forces use a temporary shadow kingdom so the existing war engine can resolve battles without changing the player's territorial ownership immediately.
(() => {
  const state=window.SIM_STATE;if(!state)return;
  const P=()=>window.NPC_PERSONALITY,M=()=>window.NPC_MEMORY;
  const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,v));
  const alive=()=>state.npcs.filter(n=>n.alive);
  const uid=()=>`cwr-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  const log=t=>window.SIM_LOG?.(t);
  const people=k=>alive().filter(n=>n.faction===k.id);

  function ensure(k){
    k.society=k.society||{};
    k.society.civilWar=k.society.civilWar||{active:false,id:null,rebelKingdomId:null,leaderId:null,loyalArmyId:null,rebelArmyId:null,startedYear:null,history:[]};
    return k.society.civilWar;
  }
  function findKing(id){return state.kingdoms?.find(k=>String(k.id)===String(id))||null;}
  function makeRebelKingdom(k,leader){
    const existing=state.kingdoms?.find(x=>x.civilWarRebel&&String(x.parentKingdomId)===String(k.id));
    if(existing)return existing;
    const rebel={id:uid(),name:`Rebels of ${k.name}`,color:'#c96b5b',capitalId:null,leaderId:leader?.id||null,treasury:Math.max(25,(k.treasury||0)*.15),power:Math.max(8,(k.power||25)*.35),stability:35,taxRate:k.taxRate||.08,law:{crimePenalty:12,bribeBase:8},politics:{nobles:5,merchants:5,commons:55,clergy:5,army:30},civilWarRebel:true,parentKingdomId:k.id};
    state.kingdoms.push(rebel);return rebel;
  }
  function armyFor(kid,x,y,soldiers,commanderId,side,targetKingdomId,civilWarId){
    return {id:uid(),kingdomId:kid,x,y,targetSettlementId:null,route:[],routeIndex:0,routeDistance:0,soldiers:Math.max(3,Math.round(soldiers)),supply:72,morale:side==='rebel'?70:82,speed:.72,active:true,borderWarId:null,commanderId:commanderId||null,civilWar:true,civilWarId,side,targetKingdomId,experience:0,battleCount:0,victories:0,defeats:0,exhaustion:0,navalStrength:0};
  }
  function createCivilWar(k,leader){
    const crisis=ensure(k);if(crisis.active||!leader||!window.NPC_WAR)return false;
    const rebelKing=makeRebelKingdom(k,leader),cap=state.settlements.find(s=>s.kingdomId===k.id&&s.id===k.capitalId)||state.settlements.find(s=>s.kingdomId===k.id);
    if(!cap)return false;
    const loyalPeople=people(k),base=Math.max(12,Math.round(loyalPeople.length*.32)),rebelCount=Math.max(5,Math.round(base*(.55+(leader.grievance||0)/200)));
    const loyal=armyFor(k.id,cap.x,cap.y,base,k.leaderId,'loyal',rebelKing.id,null),rebel=armyFor(rebelKing.id,leader.x||cap.x+45,leader.y||cap.y+45,rebelCount,leader.id,'rebel',k.id,null);
    const id=uid();loyal.civilWarId=id;rebel.civilWarId=id;crisis.active=true;crisis.id=id;crisis.rebelKingdomId=rebelKing.id;crisis.leaderId=leader.id;crisis.loyalArmyId=loyal.id;crisis.rebelArmyId=rebel.id;crisis.startedYear=state.year;crisis.status='active';crisis.history=[];state.armies.push(loyal,rebel);
    rebel.parentKingdomId=k.id;leader.goal='Lead civil war';leader.roleId='rebel';leader.roleName='Rebel';
    M()?.remember?.(leader,`I raised an army against the ruler of ${k.name}.`,'civil-war',6,k.id,'anger',10,true);
    log(`Civil war has erupted in ${k.name}. ${leader.name} leads the rebellion.`);
    window.EVERGLEN_NOTIFY?.({type:'war-declared',text:`Civil war erupts in ${k.name}.`,cause:'organic',x:leader.x,y:leader.y});
    return true;
  }
  function moveArmy(a,b){if(!a||!b||a.soldiers<=0)return;const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1,step=Math.min(a.speed*(state.speed||1)*3,d);a.x+=dx/d*step;a.y+=dy/d*step;a.supply=clamp((a.supply??70)-.03*(state.speed||1));a.exhaustion=clamp((a.exhaustion??0)+.02*(state.speed||1));}
  function cleanupRebelKingdom(k){
    const c=ensure(k),rid=c.rebelKingdomId;if(!rid)return;
    state.armies=(state.armies||[]).filter(a=>a.civilWarId!==c.id);
    state.kingdoms=state.kingdoms.filter(x=>String(x.id)!==String(rid));
    c.active=false;c.status='ended';c.endedYear=state.year;c.rebelKingdomId=null;c.loyalArmyId=null;c.rebelArmyId=null;c.id=null;
  }
  function endCivilWar(k,winner){
    const c=ensure(k),leader=c.leaderId&&state.npcs.find(n=>n.id===c.leaderId);
    if(winner==='rebel'&&leader&&leader.alive){
      k.leaderId=leader.id;leader.roleId='king';leader.roleName='King';leader.courtClaim=null;leader.goal='Govern';k.legitimacy=clamp((k.legitimacy??60)-12);k.stability=clamp((k.stability??70)-6);leader.grievance=Math.max(0,(leader.grievance||0)-20);
      M()?.remember?.(leader,`I won the civil war and became ruler of ${k.name}.`,'civil-war',7,k.id,'pride',-8,true);
      log(`${leader.name} defeated the royalist forces and took the throne of ${k.name}.`);
      window.EVERGLEN_NOTIFY?.({type:'war-ended',text:`The civil war in ${k.name} has ended.`,cause:'organic',x:leader.x,y:leader.y});
    } else {
      k.legitimacy=clamp((k.legitimacy??60)+4);k.stability=clamp((k.stability??70)+5);if(leader&&leader.alive){leader.roleId='exile';leader.roleName='Exile';leader.goal='Survive';M()?.remember?.(leader,`My rebellion failed in ${k.name}.`,'civil-war',6,k.id,'grief',8,true);}log(`Royalist forces defeated the rebellion in ${k.name}.`);window.EVERGLEN_NOTIFY?.({type:'war-ended',text:`The rebellion in ${k.name} has been defeated.`,cause:'organic'});
    }
    c.history=(c.history||[]).slice(-11);c.history.push({year:state.year,winner,status:'ended'});cleanupRebelKingdom(k);
  }
  function step(){
    if(!state.running||!window.SOCIETY_REGIME_CRISIS||!window.NPC_WAR)return;
    state.kingdoms?.filter(k=>!k.civilWarRebel).forEach(k=>{
      const c=ensure(k),crisis=k.society?.regimeCrisis,p=people(k);if(!p.length)return;
      if(!c.active&&crisis?.level==='civil-war-risk'&&crisis.attempt?.leaderId&&state.tick%120===0){
        const leader=state.npcs.find(n=>n.id===crisis.attempt.leaderId&&n.alive);if(leader)createCivilWar(k,leader);
      }
      if(!c.active)return;
      const loyal=state.armies.find(a=>a.id===c.loyalArmyId),rebel=state.armies.find(a=>a.id===c.rebelArmyId);
      if(!loyal||!rebel||loyal.soldiers<=2||rebel.soldiers<=2){endCivilWar(k,!rebel||rebel.soldiers<=2?'loyal':'rebel');return;}
      loyal.active=true;rebel.active=true;moveArmy(loyal,rebel);moveArmy(rebel,loyal);
      if(Math.hypot(loyal.x-rebel.x,loyal.y-rebel.y)<78){window.NPC_WAR.resolveBattle(loyal,rebel);c.history=(c.history||[]).slice(-11);if(state.tick%60===0)c.history.push({year:state.year,royalist:loyal.soldiers,rebels:rebel.soldiers});}
      if(loyal.soldiers<=2||loyal.morale<15)endCivilWar(k,'rebel');else if(rebel.soldiers<=2||rebel.morale<15)endCivilWar(k,'loyal');
      if(c.active&&state.tick%240===0){k.stability=clamp((k.stability??70)-1);k.tension=clamp((k.tension??0)+1);}
    });
  }
  window.SOCIETY_CIVIL_WAR={ensure,createCivilWar,endCivilWar};
  state.registerSystem?.({name:'civil-war',step,priority:100});
})();