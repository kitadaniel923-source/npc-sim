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
  const settlementForArmy=a=>state.settlements.find(s=>s.id===a?.targetSettlementId)||null;

  function ensure(k){
    k.society=k.society||{};
    k.society.civilWar=k.society.civilWar||{active:false,id:null,rebelKingdomId:null,leaderId:null,loyalArmyId:null,rebelArmyId:null,startedYear:null,status:'dormant',fronts:[],history:[]};
    k.society.civilWar.fronts=k.society.civilWar.fronts||[];
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
    return {id:uid(),kingdomId:kid,x,y,targetSettlementId:null,route:[],routeIndex:0,routeDistance:0,soldiers:Math.max(3,Math.round(soldiers)),supply:72,morale:side==='rebel'?70:82,speed:.72,active:true,borderWarId:null,commanderId:commanderId||null,civilWar:true,civilWarId,side,targetKingdomId,experience:0,battleCount:0,victories:0,defeats:0,exhaustion:0};
  }
  function createCivilWar(k,leader){
    const crisis=ensure(k);if(crisis.active||!leader||!window.NPC_WAR)return false;
    const rebelKing=makeRebelKingdom(k,leader);
    const cap=state.settlements.find(s=>s.kingdomId===k.id&&s.id===k.capitalId)||state.settlements.find(s=>s.kingdomId===k.id);
    if(!cap)return false;
    const rebelSeat=state.settlements.find(s=>s.kingdomId===k.id&&s.rulerId===leader.id)||state.settlements.find(s=>s.kingdomId===k.id&&s.founderId===leader.id)||cap;
    const loyalPeople=people(k),base=Math.max(12,Math.round(loyalPeople.length*.32)),rebelCount=Math.max(5,Math.round(base*(.55+(leader.grievance||0)/200)));
    const loyal=armyFor(k.id,cap.x,cap.y,base,k.leaderId,'loyal',rebelKing.id,null),rebel=armyFor(rebelKing.id,rebelSeat.x??cap.x+45,rebelSeat.y??cap.y+45,rebelCount,leader.id,'rebel',k.id,null);
    const id=uid();loyal.civilWarId=id;rebel.civilWarId=id;crisis.active=true;crisis.id=id;crisis.rebelKingdomId=rebelKing.id;crisis.leaderId=leader.id;crisis.loyalArmyId=loyal.id;crisis.rebelArmyId=rebel.id;crisis.startedYear=state.year;crisis.status='active';crisis.fronts=[];crisis.history=[];state.armies.push(loyal,rebel);
    if(rebelSeat&&rebelSeat.kingdomId===k.id){
      rebelSeat.kingdomId=rebelKing.id;
      rebelSeat.rulerId=leader.id;
      rebelSeat.stability=clamp((rebelSeat.stability||60)-18);
      rebelSeat.history=rebelSeat.history||[];
      rebelSeat.history.push(`Year ${state.year}: ${rebelSeat.name} became the rebel seat during the civil war.`);
      rebelSeat.history=rebelSeat.history.slice(-20);
      rebelKing.capitalId=rebelSeat.id;
    }
    rebel.parentKingdomId=k.id;leader.goal='Lead civil war';leader.roleId='rebel';leader.roleName='Rebel';
    M()?.remember?.(leader,`I raised an army against the ruler of ${k.name}.`,'civil-war',6,k.id,'anger',10,true);
    log(`Civil war has erupted in ${k.name}. ${leader.name} leads the rebellion from ${rebelSeat.name}.`);
    window.EVERGLEN_NOTIFY?.({type:'war-declared',text:`Civil war erupts in ${k.name}.`,cause:'organic',x:leader.x,y:leader.y});
    window.SIM_API?.recomputeTerritory?.();
    return true;
  }
  function chooseTarget(army,kingId,avoidCapital=false){
    const targets=state.settlements.filter(s=>String(s.kingdomId)===String(kingId));
    if(!targets.length)return null;
    const king=findKing(kingId);
    return targets.slice().sort((a,b)=>{
      const sa=Math.hypot(army.x-a.x,army.y-a.y)-(avoidCapital&&king&&a.id===king.capitalId?90:0)-(a.level||1)*14;
      const sb=Math.hypot(army.x-b.x,army.y-b.y)-(avoidCapital&&king&&b.id===king.capitalId?90:0)-(b.level||1)*14;
      return sa-sb;
    })[0]||null;
  }
  function moveToward(a,target){if(!a||!target||a.soldiers<=0)return;const dx=target.x-a.x,dy=target.y-a.y,d=Math.hypot(dx,dy)||1,step=Math.min(a.speed*(state.speed||1)*3,d);a.x+=dx/d*step;a.y+=dy/d*step;a.supply=clamp((a.supply??70)-.025*(state.speed||1));a.exhaustion=clamp((a.exhaustion??0)+.018*(state.speed||1));}
  function captureSettlement(k,a,target){
    if(!target||!a||a.soldiers<3)return false;
    const u=target.stability??78;
    if(u>22)return false;
    const from=target.kingdomId;
    if(String(from)===String(k.id))return false;
    target.kingdomId=k.id;
    target.rulerId=a.commanderId||target.rulerId;
    target.stability=clamp(u+12);
    target.history=target.history||[];target.history.push(`Year ${state.year}: ${target.name} changed hands during civil war.`);target.history=target.history.slice(-20);
    if(target.id===k.capitalId)k.capitalId=target.id;
    log(`${target.name} has fallen to the ${k.civilWarRebel?'rebels':'royalists'}.`);
    window.EVERGLEN_NOTIFY?.({type:'war-declared',text:`${target.name} has changed hands in the civil war.`,cause:'organic',x:target.x,y:target.y});
    window.SIM_API?.recomputeTerritory?.();
    return true;
  }
  function cleanupRebelKingdom(k){
    const c=ensure(k),rid=c.rebelKingdomId;if(!rid)return;
    state.settlements.filter(s=>String(s.kingdomId)===String(rid)).forEach(s=>{s.kingdomId=k.id;if(s.rulerId===c.leaderId)s.rulerId=k.leaderId||s.rulerId;});
    state.npcs.forEach(n=>{if(String(n.faction)===String(rid))n.faction=k.id;});
    state.armies=(state.armies||[]).filter(a=>a.civilWarId!==c.id);
    state.kingdoms=state.kingdoms.filter(x=>String(x.id)!==String(rid));
    c.active=false;c.status='ended';c.endedYear=state.year;c.rebelKingdomId=null;c.loyalArmyId=null;c.rebelArmyId=null;c.id=null;c.fronts=[];
    window.SIM_API?.recomputeTerritory?.();
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
  function frontsStep(k){
    const c=ensure(k),loyal=state.armies.find(a=>a.id===c.loyalArmyId),rebel=state.armies.find(a=>a.id===c.rebelArmyId);if(!loyal||!rebel)return;
    const rebelKing=findKing(c.rebelKingdomId);if(!rebelKing)return;
    const loyalTarget=chooseTarget(loyal,rebelKing.id),rebelTarget=chooseTarget(rebel,k.id);
    if(!loyalTarget) {
      const defended=state.settlements.filter(s=>s.kingdomId===k.id);
      loyalTarget=defended.slice().sort((a,b)=>Math.hypot(loyal.x-a.x,loyal.y-a.y)-Math.hypot(loyal.x-b.x,loyal.y-b.y))[0]||null;
    }
    if(!rebelTarget){
      const fallback=state.settlements.filter(s=>s.kingdomId===k.id);
      rebelTarget=fallback.slice().sort((a,b)=>Math.hypot(rebel.x-a.x,rebel.y-a.y)-Math.hypot(rebel.x-b.x,rebel.y-b.y))[0]||null;
    }
    loyal.targetSettlementId=loyalTarget?.id||loyal.targetSettlementId;rebel.targetSettlementId=rebelTarget?.id||rebel.targetSettlementId;
    const lt=settlementForArmy(loyal),rt=settlementForArmy(rebel);
    if(lt)moveToward(loyal,lt);if(rt)moveToward(rebel,rt);
    const front={year:state.year,loyalTarget:loyal.targetSettlementId||null,rebelTarget:rebel.targetSettlementId||null,loyalists:loyal.soldiers,rebels:rebel.soldiers};
    if(state.tick%60===0){c.fronts=(c.fronts||[]).slice(-11);c.fronts.push(front);}
    if(lt&&Math.hypot(loyal.x-lt.x,loyal.y-lt.y)<42)window.NPC_WAR.siege(loyal,lt);
    if(rt&&Math.hypot(rebel.x-rt.x,rebel.y-rt.y)<42)window.NPC_WAR.siege(rebel,rt);
    if(lt&&lt.stability<20)captureSettlement(rebelKing,loyal,lt);
    if(rt&&rt.stability<20)captureSettlement(rebelKing,rebel,rt);
    state.settlements.filter(s=>s.kingdomId===rebelKing.id).forEach(s=>{s.stability=clamp((s.stability||60)-.01*(state.speed||1));});
  }
  function step(){
    if(!state.running||!window.SOCIETY_REGIME_CRISIS||!window.NPC_WAR)return;
    state.kingdoms?.filter(k=>!k.civilWarRebel).forEach(k=>{
      const c=ensure(k),crisis=k.society?.regimeCrisis,p=people(k);if(!p.length)return;
      if(!c.active&&crisis?.level==='civil-war-risk'&&crisis.attempt?.leaderId&&state.tick%120===0){const leader=state.npcs.find(n=>n.id===crisis.attempt.leaderId&&n.alive);if(leader)createCivilWar(k,leader);}
      if(!c.active)return;
      const loyal=state.armies.find(a=>a.id===c.loyalArmyId),rebel=state.armies.find(a=>a.id===c.rebelArmyId);
      if(!loyal||!rebel||loyal.soldiers<=2||rebel.soldiers<=2){endCivilWar(k,!rebel||rebel.soldiers<=2?'loyal':'rebel');return;}
      frontsStep(k);
      if(Math.hypot(loyal.x-rebel.x,loyal.y-rebel.y)<78){window.NPC_WAR.resolveBattle(loyal,rebel);}
      if(loyal.soldiers<=2||loyal.morale<15)endCivilWar(k,'rebel');else if(rebel.soldiers<=2||rebel.morale<15)endCivilWar(k,'loyal');
      if(c.active&&state.tick%240===0){k.stability=clamp((k.stability??70)-1);k.tension=clamp((k.tension??0)+1);}
    });
  }
  window.SOCIETY_CIVIL_WAR={ensure,createCivilWar,endCivilWar,frontsStep};
  state.registerSystem?.({name:'civil-war',step,priority:100});
})();
