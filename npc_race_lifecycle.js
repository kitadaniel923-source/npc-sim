// Everglen race-aware lifecycle layer.
// Extends the existing NPC/family/settlement simulation without replacing its source-of-truth systems.
(() => {
  const state = window.SIM_STATE;
  if (!state) return;

  const races = () => window.EVERGLEN_RACES?.RACE_LIBRARY || {};
  const alive = () => state.npcs.filter(n => n.alive);
  const getSettlement = n => state.settlements.find(s => s.id === n.settlementId) || null;
  const getFamily = n => state.families.find(f => f.id === n.familyId) || null;
  const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
  const hash = id => { let h=2166136261; for(const c of String(id)){h=Math.imul(h^c.charCodeAt(0),16777619);} return h>>>0; };

  function stage(n){
    if(n.age < 13) return 'child';
    if(n.age < 18) return 'teen';
    if(n.age < 40) return 'adult';
    if(n.age < 60) return 'mature';
    return 'elder';
  }

  function culturalProfile(s){
    if(!s) return null;
    const counts={};
    alive().filter(n=>n.settlementId===s.id).forEach(n=>{if(n.raceId) counts[n.raceId]=(counts[n.raceId]||0)+1;});
    const total=Object.values(counts).reduce((a,b)=>a+b,0);
    if(!total){s.racePopulation={};return null;}
    const sorted=Object.entries(counts).sort((a,b)=>b[1]-a[1]);
    const dominant=sorted[0][0];
    const diversity=Object.keys(counts).length;
    const blend=sorted.length>1 && sorted[1][1]/total >= .2;
    const modifiers={education:0,craft:0,trade:0,military:0,nature:0};
    sorted.forEach(([id,count])=>{
      const w=count/total, r=races()[id]||{};
      const p=r.preferences||{};
      modifiers.education += w*((p.scholar||0)+(p.teacher||0))*.15;
      modifiers.craft += w*((p.blacksmith||0)+(p.carpenter||0)+(p.mason||0))*.12;
      modifiers.trade += w*((p.merchant||0)+(p.trader||0)+(p.peddler||0))*.12;
      modifiers.military += w*((p.soldier||0)+(p.militia||0)+(p.ranger||0))*.12;
      modifiers.nature += w*((p.druid||0)+(p.herbalist||0)+(p.hunter||0))*.12;
    });
    s.racePopulation=counts;
    s.racePercentages=Object.fromEntries(Object.entries(counts).map(([id,c])=>[id,Math.round(c/total*100)]));
    s.dominantRace=dominant;
    s.culturalDiversity=diversity;
    s.cultureBlend=blend ? `${dominant}+${sorted[1][0]}` : dominant;
    s.cultureModifiers=Object.fromEntries(Object.entries(modifiers).map(([k,v])=>[k,Math.round(v*10)/10]));
    return s;
  }

  function inheritHeritage(child,parents){
    const heritage=[];
    parents.forEach(p=>{
      (p.heritage||[p.raceId]).forEach(r=>{if(r && !heritage.includes(r)) heritage.push(r);});
    });
    if(!heritage.length && child.raceId) heritage.push(child.raceId);
    child.heritage=heritage.slice(0,4);
    child.mixedHeritage=heritage.length>1;
  }

  function applyEducation(n,s){
    if(!s || n.age<6 || n.age>=18) return;
    const mod=s.cultureModifiers?.education||0;
    n.education=clamp((n.education||0)+0.015+(mod*.0008),0,100);
    n.educationTrack = n.education>=70 ? 'advanced' : n.education>=40 ? 'basic' : 'informal';
  }

  function applyAdultLife(n,s){
    if(!s || n.age<18) return;
    const r=races()[n.raceId]||{};
    n.raceLifeProfile=n.raceLifeProfile||{};
    n.raceLifeProfile.craft=(r.preferences?.blacksmith||0)+(r.preferences?.carpenter||0)+(r.preferences?.mason||0);
    n.raceLifeProfile.trade=(r.preferences?.merchant||0)+(r.preferences?.trader||0)+(r.preferences?.peddler||0);
    n.raceLifeProfile.military=(r.preferences?.soldier||0)+(r.preferences?.militia||0)+(r.preferences?.ranger||0);
    n.raceLifeProfile.nature=(r.preferences?.druid||0)+(r.preferences?.herbalist||0)+(r.preferences?.hunter||0);
    n.raceLifeProfile.learning=(r.preferences?.scholar||0)+(r.preferences?.teacher||0)+(r.preferences?.mage||0);
    if(n.age>=60 && n.roleId && !['king','queen','duke','count','mayor'].includes(n.roleId)){
      n.retirementEligible=true;
      if((hash(`${n.id}:${state.year}`)%100)<4 && n.roleId!=='elder'){
        n.previousProfession=n.professionName||n.roleName;
        n.roleId='elder'; n.roleName='Elder';
        n.lastAction='Retired into elder status';
      }
    }
  }

  function inheritance(n){
    const f=getFamily(n);
    if(!f || !n.alive) return;
    f.raceLegacy=f.raceLegacy||{};
    if(n.raceId) f.raceLegacy[n.raceId]=(f.raceLegacy[n.raceId]||0)+1;
    f.heritage=f.heritage||[];
    (n.heritage||[n.raceId]).forEach(r=>{if(r&&!f.heritage.includes(r))f.heritage.push(r);});
  }

  function migrationPressure(n,s){
    if(!s || n.age<18) return;
    const r=races()[n.raceId]||{};
    const fit={trade:r.preferences?.merchant||r.preferences?.trader||0,military:r.preferences?.soldier||r.preferences?.militia||0,nature:r.preferences?.druid||r.preferences?.hunter||0,craft:r.preferences?.miner||r.preferences?.blacksmith||0};
    const lacking = Object.entries(fit).sort((a,b)=>b[1]-a[1])[0];
    n.migrationProfile={preferredEnvironment:lacking?.[0]||'general',pressure:clamp((n.grievance||0)*.35+(50-(n.mood||50))*.15,0,100)};
    if(n.migrationProfile.pressure>75 && state.settlements.length>1) n.wantsMigration=true;
  }

  function step(){
    if(!state.npcs?.length) return;
    alive().forEach((n,i)=>{
      const s=getSettlement(n);
      const st=stage(n);
      n.lifeStage=st;
      if(window.EVERGLEN_RACES?.ensureRace) window.EVERGLEN_RACES.ensureRace(n,i);
      if(s){
        culturalProfile(s);
        applyEducation(n,s);
        applyAdultLife(n,s);
        migrationPressure(n,s);
      }
      inheritance(n);
      if(n.parentIds?.length){
        const parents=n.parentIds.map(id=>state.npcs.find(p=>p.id===id)).filter(Boolean);
        if(parents.length) inheritHeritage(n,parents);
      }
      n.culturalIdentity=n.mixedHeritage ? `${n.raceName||n.raceId} mixed heritage` : (n.raceName||n.raceId||'Unknown');
    });
    if(state.tick%40===0) state.settlements.forEach(culturalProfile);
  }

  window.EVERGLEN_RACE_LIFECYCLE={stage,culturalProfile,inheritHeritage,applyEducation,applyAdultLife,migrationPressure};
  state.registerSystem?.(step);
})();
