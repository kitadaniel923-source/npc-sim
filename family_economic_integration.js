// Integrates the existing family, NPC economy and Phase 5 property systems.
(() => {
  const state=window.SIM_STATE;if(!state)return;
  const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,v));
  const alive=()=>state.npcs.filter(n=>n.alive);
  const fam=n=>state.families.find(f=>f.id===n.familyId)||null;
  const members=f=>alive().filter(n=>n.familyId===f.id);
  const property=()=>window.EVERGLEN_PROPERTY;
  const score=(n,k)=>window.NPC_PERSONALITY?.score?.(n,k)??50;

  function ensureFamily(f){
    f.wealth=f.wealth||0;f.legacy=f.legacy||0;f.land=f.land||0;f.businesses=f.businesses||0;
    f.households=f.households||0;f.income=f.income||0;f.expenses=f.expenses||0;f.economicPower=f.economicPower||0;
    f.assets=f.assets||{propertyValue:0,land:0,buildings:0};f.heirs=f.heirs||[];
  }
  function ensureNpc(n){
    n.householdId=n.householdId||null;n.householdRole=n.householdRole||null;
    n.familyContribution=n.familyContribution||0;n.familySupport=n.familySupport||0;
  }
  function chooseHouseholdHead(ms){
    return ms.filter(n=>n.age>=18).sort((a,b)=>{
      const va=(a.spouseId?12:0)+(a.roleId==='heir'?18:0)+(a.influence||0)*2+(a.wealth||0)*.08+score(a,'responsibility')*.35;
      const vb=(b.spouseId?12:0)+(b.roleId==='heir'?18:0)+(b.influence||0)*2+(b.wealth||0)*.08+score(b,'responsibility')*.35;
      return vb-va;
    })[0]||ms[0]||null;
  }
  function householdKey(n){return n.spouseId&&n.id<n.spouseId?`household-${n.id}-${n.spouseId}`:n.spouseId?`household-${n.spouseId}-${n.id}`:`family-${n.familyId}-member-${n.id}`;}
  function rebuildHouseholds(f,ms){
    const heads=new Map();
    ms.forEach(n=>{ensureNpc(n);let head=n.spouseId?ms.find(x=>x.id===n.spouseId)||n:n;head=chooseHouseholdHead([head,n])||n;const key=n.spouseId&&ms.some(x=>x.id===n.spouseId)?householdKey(n):`family-${f.id}-member-${n.id}`;if(!heads.has(key))heads.set(key,head.id);n.householdId=key;n.householdRole=n.id===head.id?'head':(n.age<18?'child':n.spouseId?'spouse':'member');});
    f.households=heads.size;f.householdIds=[...heads.keys()];
  }
  function propertySnapshot(f,ms){
    const api=property();let value=0,land=0,buildings=0,businesses=0;
    ms.forEach(n=>{
      const assets=n.property?.assets||[];
      if(!assets.length)return;
      const s=state.settlements.find(x=>x.id===n.settlementId);const parcels=s?.property?.parcels||[];
      assets.forEach(id=>{const a=parcels.find(x=>x.id===id);if(!a)return;value+=a.value||0;land+=['farm','estate','nobleEstate','mine'].includes(a.type)?1:0;buildings+=1;});
      businesses+=n.business?1:0;
    });
    f.assets={propertyValue:Number(value.toFixed(2)),land,buildings};f.land=land;f.businesses=businesses;f.propertyValue=f.assets.propertyValue;return f.assets;
  }
  function familyLedger(f,ms){
    let income=0,expenses=0;
    ms.forEach(n=>{income+=(n.wage||0)*.08+(n.lastOutputValue||0)*.012+(n.business?.revenue||0)*.03;expenses+=(n.needFoodCost||0)*.08+(n.debt||0)*.004;});
    f.income=income;f.expenses=expenses;f.familyCashflow=income-expenses;
    const cash=ms.reduce((s,n)=>s+(n.wealth||0),0),assets=f.assets?.propertyValue||0;
    f.wealth=Number(cash.toFixed(2));f.netWorth=Number((cash+assets-(ms.reduce((s,n)=>s+(n.debt||0),0))).toFixed(2));
    f.economicPower=clamp(f.netWorth*.055+f.businesses*5+f.land*2.5+f.prestige*.35,0,100);
    f.legacy=Number(((f.legacy||0)*.992+f.netWorth*.004+f.prestige*.05).toFixed(2));
  }
  function familySupport(f,ms){
    if(!ms.length)return;
    const adults=ms.filter(n=>n.age>=18),children=ms.filter(n=>n.age<18),poor=adults.filter(n=>(n.wealth||0)<8);
    const pool=Math.min(adults.reduce((s,n)=>s+Math.max(0,(n.wealth||0)-18)*.012,0),poor.length*2.5);
    if(pool>0&&poor.length){poor.forEach(n=>{const grant=Math.min(2.5,pool/poor.length);n.wealth+=grant;n.familySupport=(n.familySupport||0)+grant;});}
    f.dependents=children.length;f.adults=adults.length;f.poorMembers=poor.length;
    f.familyBurden=adults.length?clamp((children.length*7+poor.length*5)/adults.length):0;
  }
  function professionLegacy(f,ms){
    const counts={};ms.forEach(n=>{if(n.age>=18&&n.roleId&&n.roleId!=='citizen')counts[n.roleId]=(counts[n.roleId]||0)+1;});
    f.professions=Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([id,count])=>({id,count}));
    const dominant=f.professions[0];f.traditionProfession=dominant?.id||null;
    ms.forEach(n=>{if(n.age<18&&dominant&&Math.random()<.02){n.familyProfessionInfluence=dominant.id;}});
  }
  function syncEstate(f,ms){
    const estate=f.estate=f.estate||{gold:0,land:0,buildings:0,titles:[]};
    estate.gold=Number(ms.reduce((s,n)=>s+(n.estate?.gold||0),0).toFixed(2));
    estate.land=f.assets?.land||0;estate.buildings=f.assets?.buildings||0;
    estate.familyNetWorth=f.netWorth||0;estate.economicPower=f.economicPower||0;
  }
  function successionPreview(f,ms){
    const adults=ms.filter(n=>n.age>=18).sort((a,b)=>{
      const va=(a.roleId==='heir'?100:0)+(a.legitimacy||50)+score(a,'loyalty')*.25+score(a,'ambition')*.12+(a.influence||0)*2;
      const vb=(b.roleId==='heir'?100:0)+(b.legitimacy||50)+score(b,'loyalty')*.25+score(b,'ambition')*.12+(b.influence||0)*2;
      return vb-va;
    });
    f.heirs=adults.slice(0,3).map((n,i)=>({id:n.id,name:n.name,rank:i+1,share:i===0?.6:i===1?.25:.15}));
    f.primaryHeirId=f.heirs[0]?.id||null;
  }
  function deathBridge(){
    if(!property()?.inheritance)return;
    state.npcs.filter(n=>!n.alive&&!n._propertyInheritanceSettled).forEach(n=>{
      const s=state.settlements.find(x=>x.id===n.settlementId);if(!s)return;
      property().inheritance(n,s);n._propertyInheritanceSettled=true;
    });
  }
  function step(){
    if(!state.running)return;
    if(state.tick%24===0){
      state.families.forEach(f=>{
        ensureFamily(f);const ms=members(f);if(!ms.length)return;
        rebuildHouseholds(f,ms);propertySnapshot(f,ms);familyLedger(f,ms);familySupport(f,ms);professionLegacy(f,ms);syncEstate(f,ms);successionPreview(f,ms);
        f.reputation=clamp((f.reputation||50)*.998+(f.economicPower||0)*.002);
        ms.forEach(n=>{ensureNpc(n);n.familyContribution=clamp(((n.wage||0)*.08+(n.lastOutputValue||0)*.012+(n.business?.revenue||0)*.03),0,100);});
      });
    }
    if(state.tick%60===0)deathBridge();
  }
  window.EVERGLEN_FAMILY_ECONOMY={step,propertySnapshot,familyLedger,rebuildHouseholds,successionPreview};
  if(state.registerSystem)state.registerSystem({name:'family-economy-integration',step,priority:76});
})();
