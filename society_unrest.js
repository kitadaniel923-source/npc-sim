// Phase 2: civilization unrest layer.
// Converts sustained class conflict into settlement-level instability and political pressure.
// The layer does not start wars or own roles; it publishes pressure for existing systems to consume.
(() => {
  const state=window.SIM_STATE;if(!state)return;
  const P=()=>window.NPC_PERSONALITY,M=()=>window.NPC_MEMORY;
  const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,v));
  const alive=()=>state.npcs.filter(n=>n.alive);
  const classOf=n=>n.society?.class||window.SOCIETY_CIVILIZATION?.classFor?.(n)||'peasant';
  const score=(n,k)=>P()?.score?.(n,k)??50;
  const log=t=>window.SIM_LOG?.(t);

  function ensure(s){
    s.society=s.society||{};
    s.society.unrest=s.society.unrest||{pressure:0,level:'calm',rebelSupport:0,exodusPressure:0,lastEscalationYear:0,history:[]};
    s.society.unrest.intents=s.society.unrest.intents||[];
  }

  function calculate(s,p){
    ensure(s);
    const conflicts=s.society.conflicts||[];
    const open=conflicts.filter(c=>c.status==='open-conflict');
    const organized=conflicts.filter(c=>c.status==='organized-pressure');
    const grievances=Object.values(s.society.classGrievances||{});
    const peak=grievances.length?Math.max(...grievances):0;
    const legitimacy=s.society.governance?.legitimacy??50;
    const strikes=(s.society.strikes||[]).filter(x=>x.active).length;
    const pressure=clamp(open.reduce((v,c)=>v+(c.pressure||0)*.23,0)+organized.reduce((v,c)=>v+(c.pressure||0)*.08,0)+peak*.22+strikes*8+(50-legitimacy)*.3);
    const old=s.society.unrest.level;
    s.society.unrest.pressure=pressure;
    s.society.unrest.level=pressure>78?'rebellion-risk':pressure>58?'severe':pressure>36?'unrest':'calm';
    if(old!==s.society.unrest.level){
      s.society.unrest.history=(s.society.unrest.history||[]).slice(-11);
      s.society.unrest.history.push({year:state.year,from:old,to:s.society.unrest.level,pressure:Math.round(pressure)});
      if(s.society.unrest.level==='severe'||s.society.unrest.level==='rebellion-risk'){
        log(`${s.name} has entered ${s.society.unrest.level.replace('-', ' ')}.`);
        window.EVERGLEN_NOTIFY?.({type:'player-intervention',text:`${s.name} is suffering ${s.society.unrest.level.replace('-', ' ')}.`,cause:'organic',x:s.x,y:s.y});
      }
    }

    const angry=p.filter(n=>(n.grievance||0)>58).sort((a,b)=>((b.grievance||0)+score(b,'stubborn'))-((a.grievance||0)+score(a,'stubborn')));
    s.society.unrest.rebelSupport=clamp((angry.length/Math.max(1,p.length))*100);
    s.society.unrest.exodusPressure=clamp((50-(s.stability??70))*.8+Math.max(0,pressure-55)*.6);

    if(pressure>65&&state.tick%180===0){
      const leader=angry.find(n=>n.age>=18&&score(n,'ambition')>55);
      const existing=s.society.unrest.intents.find(i=>i.active);
      if(!existing){
        const intent={id:`unrest-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,active:true,type:pressure>82?'uprising':'protest',leaderId:leader?.id||null,year:state.year,support:Math.round(angry.length),pressure:Math.round(pressure),history:[]};
        s.society.unrest.intents.push(intent);
        if(leader)M()?.remember?.(leader,`I became a leader of ${intent.type} in ${s.name}.`,'unrest',3,s.id,'anger');
      }
    }

    s.society.unrest.intents.forEach(i=>{
      i.history=(i.history||[]).slice(-7);
      if(state.tick%180===0)i.history.push({year:state.year,pressure:Math.round(pressure),support:Math.round(angry.length)});
      if(pressure<42&&i.active){i.active=false;i.endedYear=state.year;}
    });
    s.society.unrest.intents=s.society.unrest.intents.slice(-8);
  }

  function consequences(s,p){
    ensure(s);const u=s.society.unrest;
    if(u.level==='calm')return;
    const severity=u.level==='rebellion-risk'?1.4:u.level==='severe'?1:.5;
    s.stability=clamp((s.stability??70)-severity*.025);
    if(s.law)s.law.order=clamp((s.law.order??60)-severity*.018);
    if(s.wealth) s.wealth=Math.max(0,s.wealth-severity*.004*Math.max(1,p.length));
    if(u.level==='rebellion-risk'&&state.tick%240===0){
      p.filter(n=>(n.grievance||0)>65).slice(0,6).forEach(n=>{n.goal='Resist authority';n.reputation=Math.max(0,(n.reputation||50)-.3);});
    }
    if(u.exodusPressure>35&&state.tick%240===0){
      p.filter(n=>(n.grievance||0)>55).slice(0,4).forEach(n=>{n.migrationPressure=Math.min(100,(n.migrationPressure||0)+2);});
    }
  }

  function resolve(s,p){
    ensure(s);const u=s.society.unrest,gov=s.society.governance||{};
    const concessions=s.society.concessions||[];
    if(concessions.length&&concessions.at(-1).year===state.year){u.pressure=Math.max(0,u.pressure-10);p.forEach(n=>{n.grievance=Math.max(0,(n.grievance||0)-2);});}
    if((s.stability??70)>78&&gov.legitimacy>65){u.pressure=Math.max(0,u.pressure-.08);}
  }

  function step(){
    if(!state.running||!window.SOCIETY_ECONOMY)return;
    state.settlements?.forEach(s=>{const p=alive().filter(n=>n.settlementId===s.id);if(!p.length)return;calculate(s,p);consequences(s,p);resolve(s,p);});
    state.kingdoms?.forEach(k=>{const settlements=state.settlements.filter(s=>s.kingdomId===k.id);k.society=k.society||{};k.society.unrest=settlements.length?settlements.reduce((v,s)=>v+(s.society?.unrest?.pressure||0),0)/settlements.length:0;k.society.rebellionRisk=settlements.filter(s=>s.society?.unrest?.level==='rebellion-risk').length;});
  }

  window.SOCIETY_UNREST={ensure,calculate,consequences,resolve};
  state.registerSystem?.({name:'society-unrest',step,priority:98});
})();
