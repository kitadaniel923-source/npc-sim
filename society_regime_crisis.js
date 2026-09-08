// Phase 2: regime crisis layer.
// Converts sustained rebellion risk into political crisis, coups and civil-war pressure.
// It never creates armies or resolves wars itself. Existing politics/war systems remain authoritative.
(() => {
  const state=window.SIM_STATE;if(!state)return;
  const P=()=>window.NPC_PERSONALITY,M=()=>window.NPC_MEMORY;
  const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,v));
  const alive=()=>state.npcs.filter(n=>n.alive);
  const log=t=>window.SIM_LOG?.(t);

  function ensure(k){
    k.society=k.society||{};
    k.society.regimeCrisis=k.society.regimeCrisis||{pressure:0,level:'stable',factions:[],history:[],active:false};
  }
  function people(k){return alive().filter(n=>n.faction===k.id);}
  function settlementPressure(k){
    const ss=state.settlements.filter(s=>s.kingdomId===k.id);
    if(!ss.length)return 0;
    return ss.reduce((v,s)=>v+(s.society?.unrest?.pressure||0),0)/ss.length;
  }
  function factionPressure(k,p){
    const classes={nobility:0,merchant:0,commons:0,soldier:0,clergy:0};
    p.forEach(n=>{
      const c=n.society?.class;
      if(c==='nobility'||c==='royalty')classes.nobility+=(n.influence||0)+25;
      else if(c==='merchant')classes.merchant+=(n.influence||0)+18;
      else if(c==='peasant'||c==='artisan')classes.commons+=(n.influence||0)+8;
      else if(c==='soldier')classes.soldier+=(n.influence||0)+20;
      else if(c==='clergy')classes.clergy+=(n.influence||0)+16;
    });
    return classes;
  }
  function buildFactions(k,p){
    const pressure=factionPressure(k,p), total=Math.max(1,Object.values(pressure).reduce((a,b)=>a+b,0));
    k.society.regimeCrisis.factions=Object.entries(pressure).map(([type,power])=>({type,power:clamp(power/total*100),leaders:p.filter(n=>{const c=n.society?.class;return type==='nobility'?(c==='nobility'||c==='royalty'):type==='merchant'?c==='merchant':type==='commons'?(c==='peasant'||c==='artisan'):type==='soldier'?c==='soldier':c==='clergy'}).sort((a,b)=>(b.influence||0)-(a.influence||0)).slice(0,4).map(n=>n.id)}));
  }
  function crisisStep(k,p){
    ensure(k);const u=settlementPressure(k),leg=k.legitimacy??60,tension=k.tension??0,war=state.war?10:0;
    buildFactions(k,p);
    const strongest=Math.max(...k.society.regimeCrisis.factions.map(f=>f.power),0);
    const pressure=clamp(u*.55+(50-leg)*.45+tension*.35+war+(strongest>55?(strongest-55)*.4:0));
    const crisis=k.society.regimeCrisis;
    const old=crisis.level;crisis.pressure=pressure;
    crisis.level=pressure>82?'civil-war-risk':pressure>68?'regime-crisis':pressure>48?'political-crisis':'stable';
    crisis.active=crisis.level!=='stable';
    if(old!==crisis.level){
      crisis.history=(crisis.history||[]).slice(-11);crisis.history.push({year:state.year,from:old,to:crisis.level,pressure:Math.round(pressure)});
      if(crisis.active)log(`${k.name} has entered a ${crisis.level.replaceAll('-', ' ')}.`);
      window.EVERGLEN_NOTIFY?.({type:'war-declared',text:`${k.name} faces ${crisis.level.replaceAll('-', ' ')}.`,cause:'organic',x:state.settlements.find(s=>s.kingdomId===k.id)?.x,y:state.settlements.find(s=>s.kingdomId===k.id)?.y});
    }

    if(crisis.level==='regime-crisis'&&state.tick%240===0){
      const claimant=p.filter(n=>n.age>=22&&n.roleId!=='king').sort((a,b)=>(b.influence||0)+((b.grievance||0)*.5)-(a.influence||0)-((a.grievance||0)*.5))[0];
      if(claimant){claimant.courtClaim=k.leaderId;claimant.goal='Gain political power';claimant.grievance=clamp((claimant.grievance||0)+3);M()?.remember?.(claimant,`I believe ${k.name} needs a different ruler.`,'regime-crisis',3,k.id,'anger');}
    }
    if(crisis.level==='civil-war-risk'&&state.tick%360===0){
      const faction=crisis.factions.slice().sort((a,b)=>b.power-a.power)[1]||crisis.factions[0];
      const leader=faction?.leaders?.[0]&&state.npcs.find(n=>n.id===faction.leaders[0]);
      if(leader){crisis.attempt={year:state.year,leaderId:leader.id,faction:faction.type,status:'mobilizing'};leader.goal='Lead the faction';leader.roleId='rebel';leader.roleName='Rebel';M()?.remember?.(leader,`My faction is preparing to challenge the rule of ${k.name}.`,'civil-conflict',5,k.id,'anger',8,true);log(`${leader.name} is rallying the ${faction.type} against the rule of ${k.name}.`);}
    }
    if(crisis.level==='stable')crisis.attempt=null;
  }
  function feedback(k){
    const c=k.society?.regimeCrisis;if(!c)return;
    if(c.level==='civil-war-risk'){
      k.stability=clamp((k.stability??70)-.04);
      k.tension=clamp((k.tension??0)+.03);
    } else if(c.level==='regime-crisis'){
      k.stability=clamp((k.stability??70)-.015);
    }
    if(c.level==='stable')k.tension=Math.max(0,(k.tension??0)-.02);
  }
  function step(){
    if(!state.running||!window.SOCIETY_UNREST)return;
    state.kingdoms?.forEach(k=>{const p=people(k);if(!p.length)return;crisisStep(k,p);feedback(k);});
  }
  window.SOCIETY_REGIME_CRISIS={ensure,crisisStep,feedback};
  state.registerSystem?.({name:'society-regime-crisis',step,priority:99});
})();