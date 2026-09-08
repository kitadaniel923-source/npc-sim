// Dynasty -> politics bridge. Keeps family power, legitimacy, wealth and rival claims visible to the political simulation.
(() => {
  const state=window.SIM_STATE;if(!state)return;
  const P=window.NPC_PERSONALITY,M=window.NPC_MEMORY,R=window.NPC_RELATIONSHIPS,F=window.NPC_FAMILIES;
  const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,v));
  const alive=()=>state.npcs.filter(n=>n.alive);
  const score=(n,k)=>P?.score(n,k)??50;
  const family=n=>n?.familyId?state.families.find(f=>f.id===n.familyId):null;
  const ruler=k=>state.npcs.find(n=>n.id===k.leaderId&&n.alive);

  function claimStrength(n,k){
    const r=ruler(k);if(!n||!r)return 0;
    let v=(n.legitimacy||50)*.35+(family(n)?.prestige||0)*.22+(family(n)?.reputation||50)*.08;
    if((n.parents||n.parentIds||[]).includes(r.id))v+=35;
    if(n.familyId&&r.familyId===n.familyId)v+=22;
    if(n.roleId==='heir')v+=18;
    if((n.grievance||0)>50)v+=(n.grievance||0)*.12;
    const trust=R?.trustValue?.(n,r.id)??50;
    if(trust<35)v+=10;
    return v;
  }

  function updateFamilies(k,people){
    const grouped=new Map();
    people.forEach(n=>{const f=family(n);if(!f)return;let g=grouped.get(f.id);if(!g)grouped.set(f.id,g={family:f,members:[]});g.members.push(n);});
    k.dynasties=[...grouped.values()].map(g=>{
      const f=g.family,m=g.members;
      f.members=m.map(n=>n.id);f.wealth=m.reduce((s,n)=>s+(n.wealth||0),0);f.reputation=m.length?m.reduce((s,n)=>s+(n.reputation||50),0)/m.length:f.reputation||50;
      f.influence=m.reduce((s,n)=>s+(n.influence||0)+(n.legitimacy||0)*.08,0);
      f.prestige=(f.prestige||10)*.998+m.reduce((s,n)=>s+(['king','emperor'].includes(n.roleId)?20:['duke','count','baron','mayor'].includes(n.roleId)?7:0),0)*.025;
      return {id:f.id,name:f.name,members:m.length,wealth:f.wealth,reputation:f.reputation,influence:f.influence,prestige:f.prestige,claimants:m.filter(n=>claimStrength(n,k)>45).map(n=>n.id)};
    }).sort((a,b)=>(b.influence+b.prestige)-(a.influence+a.prestige));
  }

  function successionPressure(k,people){
    const r=ruler(k);if(!r)return;
    const contenders=people.filter(n=>n.id!==r.id&&n.age>=18).map(n=>({n,s:claimStrength(n,k)})).filter(x=>x.s>48).sort((a,b)=>b.s-a.s).slice(0,6);
    k.succession=k.succession||{claimants:[],disputed:false,history:[],lastRulerId:r.id};
    k.succession.claimants=contenders.map(x=>x.n.id);
    const best=contenders[0];
    k.succession.disputed=!!best&&best.s>claimStrength(r,k)-8;
    const pressure=contenders.reduce((s,x)=>s+Math.max(0,x.s-45)*.12,0);
    k.tension=clamp((k.tension||0)*.99+pressure);
    if(best&&best.s>claimStrength(r,k)-8&&state.tick%36===0){
      best.n.courtClaim=r.id;best.n.grievance=clamp((best.n.grievance||0)+2);
      M?.experience?.(best.n,`${r.name}'s rule is contested by my family's claim.`,'dynastic_pressure',3.2,r.id,'anger',4,true);
      M?.experience?.(r,`${best.n.name} has a credible family claim against me.`,'dynastic_pressure',3.2,best.n.id,'fear',3,true);
    }
  }

  function powerTransfer(k,people){
    const top=(k.dynasties||[]).slice(0,5);const total=top.reduce((s,d)=>s+d.influence,0)||1;
    k.dynasticPowerShare=top.map(d=>({familyId:d.id,name:d.name,share:Number((d.influence/total*100).toFixed(1)),wealth:Math.round(d.wealth),prestige:Number(d.prestige.toFixed(1))}));
    const dominant=top[0];if(dominant){k.dominantDynastyId=dominant.id;k.dominantDynastyInfluence=dominant.influence;}
    const commons=k.politicalFactions?.find(f=>f.type==='commons'),nobles=k.politicalFactions?.find(f=>f.type==='nobles');
    if(commons)commons.cohesion=clamp((commons.cohesion||50)-Math.max(0,(dominant?.share||0)-55)*.04);
    if(nobles) nobles.cohesion=clamp((nobles.cohesion||50)+Math.min(8,(dominant?.prestige||0)*.03));
  }

  function step(){
    if(!state.running)return;
    const people=alive();
    state.kingdoms.forEach(k=>{updateFamilies(k,people.filter(n=>n.faction===k.id));successionPressure(k,people.filter(n=>n.faction===k.id));powerTransfer(k,people.filter(n=>n.faction===k.id));});
  }

  window.DYNASTY_POLITICS={claimStrength,step};
  state.registerSystem?.({name:'dynasty-politics-bridge',step,priority:92});
})();
