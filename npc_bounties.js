// Medieval bounties: lawful contracts for fugitives, raiders and dangerous criminals.
(() => {
  const state=window.SIM_STATE;if(!state)return;
  const M=window.NPC_MEMORY,P=window.NPC_PERSONALITY;
  const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,v));
  const alive=()=>state.npcs.filter(n=>n.alive);
  const score=(n,k)=>P?.score(n,k)??50;
  const getNpc=id=>state.getNpc?state.getNpc(id):state.npcs.find(n=>n.id===id);
  const getSettlement=id=>state.getSettlement?state.getSettlement(id):state.settlements?.find(s=>s.id===id);
  const log=t=>window.SIM_API?.log?.(t);
  const api=window.EVERGLEN_BOUNTIES=window.EVERGLEN_BOUNTIES||{contracts:[],claims:[],history:[],initialized:false};

  const hunterRoles=new Set(['hunter','ranger','soldier','knight','militia','captain','marshal','merchant','trader','explorer','bounty_hunter']);

  function ensure(){
    api.contracts=Array.isArray(api.contracts)?api.contracts:[];
    api.claims=Array.isArray(api.claims)?api.claims:[];
    api.history=Array.isArray(api.history)?api.history:[];
    state.bounties=api;
  }
  function bountyFor(target){
    const crimes=target?.criminalRecord?.length||target?.crimes||0;
    const heat=target?.crimeHeat||0;
    const severity=(target?.wanted?1:0)+Math.min(4,crimes*.35)+heat/35;
    return Math.max(8,Math.round(8+severity*12+(target?.influence||0)*.08));
  }
  function create(target,settlement,reason='Wanted criminal'){
    ensure();if(!target?.alive)return null;
    if(api.contracts.some(b=>b.active&&b.targetId===target.id))return null;
    const reward=bountyFor(target),issuer=settlement?.feudal?.lordId||null;
    const b={id:`bounty_${state.tick}_${target.id}`,targetId:target.id,issuerId:issuer,settlementId:settlement?.id||target.settlementId,reason,reward,createdYear:state.year,createdTick:state.tick,age:0,active:true,priority:clamp(20+reward,20,100),claims:0};
    api.contracts.unshift(b);api.contracts=api.contracts.slice(0,120);target.bounty=reward;target.wanted=true;target.lastBountyId=b.id;
    M?.remember(target,`A bounty of ${reward} gold has been placed on me.`,'bounty',4,b.settlementId,'fear',true);
    log(`A bounty of ${reward} gold is posted for ${target.name}.`);
    return b;
  }
  function issueWantedBounties(){
    state.settlements?.forEach(s=>{
      const p=alive().filter(n=>n.settlementId===s.id).filter(n=>(n.wanted||n.crimeHeat>65||((n.criminalRecord?.length||0)>2)));
      p.sort((a,b)=>bountyFor(b)-bountyFor(a)).slice(0,2).forEach(n=>{if(Math.random()<.08*state.speed)create(n,s,n.crimeHeat>65?'High crime heat':'Criminal wanted by the law');});
    });
  }
  function eligibleHunters(){
    return alive().filter(n=>n.age>=18&&n.age<=65&&(hunterRoles.has(n.roleId)||n.socialClass==='knight'||n.socialClass==='merchant')&&!n.prisoner&&!n.wanted);
  }
  function hunt(){
    ensure();const active=api.contracts.filter(b=>b.active);if(!active.length)return;
    const hunters=eligibleHunters();
    active.forEach(b=>{
      const target=getNpc(b.targetId);if(!target||!target.alive){b.active=false;return;}
      const candidates=hunters.filter(h=>h.faction===target.faction||h.settlementId===b.settlementId||score(h,'courage')>65);
      if(!candidates.length)return;
      const hunter=candidates[Math.floor(Math.random()*Math.min(candidates.length,8))];
      const tracking=(score(hunter,'cleverness')*.45+score(hunter,'courage')*.3+score(hunter,'risk')*.2+score(hunter,'discipline')*.15);
      const evasion=(score(target,'risk')*.35+score(target,'cleverness')*.3+score(target,'courage')*.15+score(target,'curiosity')*.1);
      const chance=clamp(.025+(tracking-evasion)/420+(target.crimeHeat||0)/1200,.015,.28);
      if(Math.random()<chance){
        const reward=b.reward;hunter.wealth=(hunter.wealth||0)+reward;hunter.influence=(hunter.influence||0)+Math.min(5,reward*.06);hunter.reputation=clamp((hunter.reputation||50)+Math.min(8,reward*.08));
        hunter.bountyClaims=(hunter.bountyClaims||0)+1;b.claims=(b.claims||0)+1;b.active=false;b.completedYear=state.year;
        target.wanted=false;target.bounty=0;target.arrested=true;target.legalStatus='arrested';target.crimeHeat=clamp((target.crimeHeat||0)-35);
        api.claims.unshift({bountyId:b.id,hunterId:hunter.id,targetId:target.id,reward,year:state.year});api.claims=api.claims.slice(0,100);api.history.unshift(`Year ${state.year}: ${hunter.name} captured ${target.name} for ${reward} gold.`);api.history=api.history.slice(0,80);
        M?.experience(hunter,`I captured ${target.name} and claimed a bounty.`,'bounty',4,target.id,'pride',-5,true);
        M?.experience(target,`${hunter.name} captured me for a bounty.`,'bounty',4,hunter.id,'anger',8,true);
        log(`${hunter.name} captured ${target.name} and claimed a ${reward} gold bounty.`);
      } else if(Math.random()<.09){
        M?.remember(hunter,`I heard that ${target.name} is wanted.`,'bounty',2,target.id,'curiosity');
      }
    });
  }
  function decay(){api.contracts.forEach(b=>{if(!b.active)return;b.age=(b.age||0)+1;const target=getNpc(b.targetId);if(!target||!target.alive){b.active=false;return;}if(b.age>720&&b.reward<15)b.active=false;if(b.age%120===0){b.reward=Math.min(100,b.reward+2);target.bounty=b.reward;}});api.contracts=api.contracts.filter(b=>b.active||b.completedYear>=state.year-6).slice(0,120);}
  function step(){
    if(!state.running)return;
    ensure();
    if(state.tick%60===0)issueWantedBounties();
    if(state.tick%12===0)hunt();
    if(state.tick%30===0)decay();
  }
  window.NPC_BOUNTIES={create,bountyFor,hunt,issueWantedBounties,step,contracts:api.contracts};
  if(state.registerSystem)state.registerSystem({name:'bounties',step,priority:86});
})();
