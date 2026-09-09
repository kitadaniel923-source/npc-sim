// Everglen family evolution layer.
// Turns existing relationships and lifecycle data into autonomous marriages, households and inheritance.
(() => {
  const state=window.SIM_STATE;
  if(!state)return;
  const alive=()=>state.npcs.filter(n=>n.alive);
  const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,v));
  const family=n=>state.families.find(f=>f.id===n.familyId)||null;
  const relation=(a,b)=>window.NPC_RELATIONSHIPS?.get(a,b,false);
  const trust=(a,b,r)=>window.NPC_RELATIONSHIPS?.trustValue(a,b.id,r)??50;

  function eligible(n){
    return n.alive&&n.age>=18&&n.age<=50&&!n.spouseId&&!n.partnerId&&
      !['child','student','prisoner','refugee','king','queen','emperor','empress'].includes(n.roleId);
  }

  function marriageScore(a,b){
    if(!eligible(a)||!eligible(b)||a.id===b.id)return -Infinity;
    if(a.settlementId!==b.settlementId)return -Infinity;
    if(a.faction!==b.faction)return -15;
    if(Math.abs(a.age-b.age)>20)return -25;
    const r=relation(a,b);
    const comp=window.NPC_RELATIONSHIPS?.compatibility(a,b)??0;
    const t=trust(a,b,r);
    const sameFamily=a.familyId&&a.familyId===b.familyId;
    if(sameFamily)return -80;
    let score=comp*.65+t*.25;
    score+=Math.min(12,(a.reputation||50)/12+(b.reputation||50)/12);
    if(a.wealth>0&&b.wealth>0)score+=Math.min(8,Math.log10(a.wealth*b.wealth+1));
    if(a.age>=22&&a.age<=38&&b.age>=22&&b.age<=38)score+=5;
    return score;
  }

  function joinFamilies(a,b){
    const fa=family(a),fb=family(b);
    if(!fa&&!fb)return null;
    if(!fa){a.familyId=fb.id;return fb;}
    if(!fb){b.familyId=fa.id;return fa;}
    if(fa.id===fb.id)return fa;
    const keep=(fa.prestige||0)+(fa.wealth||0)>=(fb.prestige||0)+(fb.wealth||0)?fa:fb;
    const merge=keep===fa?fb:fa;
    merge.members=(merge.members||[]).filter(id=>id!==a.id&&id!==b.id);
    (merge.members||[]).forEach(id=>{const n=state.npcs.find(x=>x.id===id);if(n)n.familyId=keep.id;});
    keep.members=Array.from(new Set([...(keep.members||[]),...(merge.members||[]),a.id,b.id]));
    keep.wealth=(keep.wealth||0)+(merge.wealth||0)*.65;
    keep.legacy=(keep.legacy||0)+(merge.legacy||0);
    keep.prestige=Math.max(keep.prestige||0,merge.prestige||0);
    keep.heritage=Array.from(new Set([...(keep.heritage||[]),...(merge.heritage||[])]));
    merge.mergedInto=keep.id;
    return keep;
  }

  function marry(a,b){
    if(marriageScore(a,b)<48)return false;
    a.spouseId=b.id;a.partnerId=b.id;b.spouseId=a.id;b.partnerId=a.id;
    a.marriedYear=state.year;b.marriedYear=state.year;
    a.maritalStatus=b.maritalStatus='married';
    const f=joinFamilies(a,b);
    a.householdId=null;b.householdId=null;
    a.householdFamilyId=f?.id||a.familyId||null;b.householdFamilyId=a.householdFamilyId;
    a.mood=clamp((a.mood||65)+7);b.mood=clamp((b.mood||65)+7);
    a.lastAction=`Married ${b.name}`;b.lastAction=`Married ${a.name}`;
    window.NPC_RELATIONSHIPS?.interact(a,b,'help',2);
    if(window.NPC_MEMORY){
      window.NPC_MEMORY.experience(a,`I married ${b.name}.`,'family',4,b.id,'joy',-2,true);
      window.NPC_MEMORY.experience(b,`I married ${a.name}.`,'family',4,a.id,'joy',-2,true);
    }
    if(typeof window.SIM_LOG==='function')window.SIM_LOG(`${a.name} and ${b.name} married.`);
    return true;
  }

  function inheritChild(child,parents){
    const [a,b]=parents.filter(Boolean);
    if(!a&&!b)return;
    const source=a||b;
    child.faction=a?.faction||b?.faction||child.faction;
    child.settlementId=a?.settlementId||b?.settlementId||child.settlementId;
    child.home=a?.home||b?.home||child.home;
    child.familyId=a?.familyId||b?.familyId||child.familyId;
    child.householdFamilyId=child.familyId;
    if(child._familyInheritanceApplied)return;
    child.wealth=0;
    child.inheritedWealth=0;
    if(a&&b){
      const blended=(a.wealth||0)+(b.wealth||0);
      child.inheritedWealth=Math.round(blended*.05);
      child.reputation=clamp(((a.reputation||50)+(b.reputation||50))/2);
      child.honor=clamp(((a.honor||50)+(b.honor||50))/2);
      child.ambition=clamp(((a.ambition||50)+(b.ambition||50))/2);
      child.loyalty=clamp(((a.loyalty||50)+(b.loyalty||50))/2);
      if(window.NPC_PERSONALITY?.ensure){
        const p=window.NPC_PERSONALITY.ensure(child);
        p.base.ambition=child.ambition;p.base.loyalty=child.loyalty;
        window.NPC_PERSONALITY.applyTraits(child);
      }
    }
    const r1=a?.raceId,r2=b?.raceId;
    child.raceId=r1&&r2?(r1===r2?r1:(Math.random()<.5?r1:r2)):(r1||r2||child.raceId);
    child.heritage=Array.from(new Set([...(a?.heritage||[r1]).filter(Boolean),...(b?.heritage||[r2]).filter(Boolean)])).slice(0,4);
    child.mixedHeritage=child.heritage.length>1;
    child.inheritanceReady=true;
    child._familyInheritanceApplied=true;
  }

  function maintainFamilies(){
    const groups=new Map();
    alive().forEach(n=>{if(n.familyId){if(!groups.has(n.familyId))groups.set(n.familyId,[]);groups.get(n.familyId).push(n);}});
    groups.forEach((members,id)=>{
      const f=state.families.find(x=>x.id===id);if(!f)return;
      f.members=members.map(n=>n.id);
      f.wealth=Math.round(members.reduce((sum,n)=>sum+(n.wealth||0),0));
      f.population=members.length;
      f.adults=members.filter(n=>n.age>=18).length;
      f.children=members.filter(n=>n.age<18).length;
      f.married=members.filter(n=>n.spouseId).length;
      f.raceComposition={};
      members.forEach(n=>{if(n.raceId)f.raceComposition[n.raceId]=(f.raceComposition[n.raceId]||0)+1;});
      f.lastUpdatedYear=state.year;
    });
  }

  function step(){
    if(!state.running)return;
    if(state.tick%24===0){
      const candidates=alive().filter(eligible);
      const attempts=Math.min(8,Math.ceil(candidates.length/12));
      for(let i=0;i<attempts;i++){
        const a=candidates[Math.floor(Math.random()*candidates.length)];
        if(!a||!eligible(a))continue;
        const matches=candidates.filter(b=>b.id!==a.id&&eligible(b)).map(b=>({b,s:marriageScore(a,b)})).filter(x=>x.s>45).sort((x,y)=>y.s-x.s);
        if(matches.length&&Math.random()<.22)marry(a,matches[0].b);
      }
    }
    if(state.tick%48===0)maintainFamilies();
    if(state.tick%12===0)alive().filter(n=>n.parentIds?.length).forEach(n=>{
      const ps=n.parentIds.map(id=>state.npcs.find(p=>p.id===id)).filter(Boolean);
      if(ps.length)inheritChild(n,ps);
    });
  }

  window.EVERGLEN_FAMILY_EVOLUTION={step,eligible,marriageScore,marry,inheritChild,maintainFamilies};
  state.registerSystem?.({name:'family_evolution',step,priority:45});
  step();
})();
