(() => {
  const state = window.SIM_STATE;
  if (!state) return;

  const personality = window.NPC_PERSONALITY;
  const memory = window.NPC_MEMORY;
  const relationships = window.NPC_RELATIONSHIPS;
  const clamp = (v,a=0,b=100)=>Math.max(a,Math.min(b,v));
  const alive = ()=>state.npcs.filter(n=>n.alive);
  const score = (n,k)=>personality?.score(n,k) ?? 50;
  const has = (n,t)=>personality?.has(n,t) || n.trait===t || n.traits?.includes(t);
  const log = text => {
    if (typeof window.SIM_LOG === 'function') window.SIM_LOG(text);
    else if (state.feed) state.feed.unshift(`Year ${state.year}, Day ${state.day}: ${text}`);
  };

  function ensureKingdom(k){
    k.politics = k.politics || {nobles:20,merchants:20,commons:50,clergy:10,army:0};
    k.politicalFactions = k.politicalFactions || [];
    k.election = k.election || null;
    k.legitimacy = k.legitimacy ?? 60;
    k.tension = k.tension ?? 0;
    k.succession = k.succession || {claimants:[],disputed:false,history:[],lastRulerId:null};
  }

  function politicalPower(n,k){
    const wealth = Math.min(35,(n.wealth||0)/8);
    const status = (n.status||0)*.35;
    const influence = (n.influence||0)*1.1;
    const rep = (n.reputation||50)*.15;
    const office = ['king','duke','count','baron','mayor','heir','captain','general','marshal'].includes(n.roleId) ? 20 : 0;
    const loyalty = score(n,'loyalty')*.08;
    return clamp(wealth+status+influence+rep+office+loyalty,0,100);
  }

  function factionAffinity(n,type){
    if(type==='nobles') return (has(n,'ambitious')?18:0)+(has(n,'loyal')?6:0)+(n.classTier==='noble'||n.classTier==='royal'?35:0);
    if(type==='merchants') return (['merchant','trader'].includes(n.roleId)?30:0)+(has(n,'greedy')?20:0)+(has(n,'entrepreneur')?12:0)+score(n,'sociability')*.18;
    if(type==='commons') return (['peasant','commoner','artisan'].includes(n.classTier)?25:0)+(has(n,'kind')?12:0)+(has(n,'reformer')?15:0);
    if(type==='army') return (['militia','soldier','archer','spearman','knight','ranger','captain','general','marshal'].includes(n.roleId)?35:0)+score(n,'courage')*.18+score(n,'loyalty')*.12;
    if(type==='clergy') return (['cleric','druid','mage','wizard'].includes(n.roleId)?30:0)+score(n,'discipline')*.15+score(n,'kindness')*.14;
    return 0;
  }

  function buildFactions(k,people){
    const names=['nobles','merchants','commons','army','clergy'];
    k.politicalFactions=names.map(type=>{
      const members=people.filter(n=>factionAffinity(n,type)>18).sort((a,b)=>politicalPower(b,k)-politicalPower(a,k)).slice(0,18);
      const power=members.reduce((s,n)=>s+politicalPower(n,k)*.25,0);
      const leader=members[0]||null;
      return {id:`${k.id}:${type}`,type,members:members.map(n=>n.id),leaderId:leader?.id||null,power:clamp(power,0,100),cohesion:clamp(45+members.length*1.5)};
    });
  }

  function familyClaim(n,k){
    if(!n)return 0;
    const previous=n.parentIds?.map(id=>state.npcs.find(x=>x.id===id)).filter(Boolean)||[];
    const previousLeaderId=k.succession?.lastRulerId;
    if(previousLeaderId && previous.some(p=>p.id===previousLeaderId))return 32;
    if(k.capitalId && n.familyId && state.npcs.find(x=>x.id===k.leaderId)?.familyId===n.familyId)return 22;
    if((n.roleId==='heir')||n.legitimacy>75)return 16;
    return 0;
  }

  function candidateScore(n,k){
    let s=politicalPower(n,k)+score(n,'ambition')*.25+score(n,'sociability')*.15+score(n,'kindness')*.08;
    s += familyClaim(n,k);
    if(has(n,'charismatic'))s+=12;
    if(has(n,'natural_leader'))s+=15;
    if(has(n,'deceptive'))s-=4;
    if((n.crimes||0)>2)s-=Math.min(20,n.crimes*2);
    const rememberedFear=(relationships?.get(n,k.leaderId,false)?.trust||50);
    s += rememberedFear>.75?0:0;
    return s;
  }

  function updateLeadership(k,people){
    const leader=people.find(n=>n.id===k.leaderId&&n.alive);
    if(leader){
      k.legitimacy=clamp((k.legitimacy||60)+((leader.reputation||50)-50)*.003-(k.tension||0)*.002);
      return;
    }
    const previousLeaderId=k.succession?.lastRulerId||k.leaderId;
    const previousLeader=previousLeaderId?state.npcs.find(n=>n.id===previousLeaderId):null;
    const ranked=people.filter(n=>n.age>=18).sort((a,b)=>candidateScore(b,k)-candidateScore(a,k));
    if(!ranked.length)return;
    const dynastic=previousLeader?ranked.filter(n=>(n.parentIds||[]).includes(previousLeader.id)||n.familyId===previousLeader.familyId):[];
    const pool=dynastic.length?dynastic.slice(0,4).concat(ranked.filter(n=>!dynastic.includes(n)).slice(0,4)):ranked.slice(0,8);
    const heir=pool.sort((a,b)=>candidateScore(b,k)-candidateScore(a,k))[0];
    if(!heir)return;
    const second=pool[1];
    const disputed=!!second&&candidateScore(second,k)>candidateScore(heir,k)-8;
    const oldRole=previousLeader?.roleId;
    k.succession.claimants=pool.slice(0,5).map(n=>n.id);
    k.succession.disputed=disputed;
    k.succession.lastRulerId=heir.id;
    k.succession.history=(k.succession.history||[]).concat({year:state.year,rulerId:heir.id,previousRulerId:previousLeader?.id||null,disputed}).slice(-20);
    k.leaderId=heir.id;
    heir.roleId='king'; heir.roleName='King';
    heir.legitimacy=clamp((heir.legitimacy||50)+(dynastic.includes(heir)?18:8));
    k.legitimacy=clamp(disputed?42+(heir.legitimacy||50)*.18:66+(heir.legitimacy||50)*.12);
    if(disputed&&second){
      second.roleId=second.roleId==='king'?'duke':'heir';
      second.roleName=second.roleId==='duke'?'Duke':'Heir';
      second.courtClaim=heir.id;
      second.grievance=clamp((second.grievance||0)+12);
      memory?.experience(second,`My claim to ${k.name}'s throne was challenged.`,'succession',4,heir.id,'anger',7,true);
      memory?.experience(heir,`${second.name} disputes my right to rule ${k.name}.`,'succession',4,second.id,'fear',4,true);
    }
    memory?.experience(heir,`I became ruler of ${k.name}.`,'politics',4,null,'pride',0,true);
    if(oldRole||previousLeader)memory?.experience(heir,`I succeeded ${previousLeader?.name||'the previous ruler'}.`,'succession',4,previousLeader?.id||null,'pride',-2,true);
    log(`${heir.name} became ruler of ${k.name}${disputed?' amid a disputed succession':''}.`);
  }

  function electionStep(k,people){
    if(people.length<10)return;
    if(k.election && k.election.year===state.year)return;
    if(state.year%4!==0 || state.tick%120!==0)return;
    const candidates=people.filter(n=>(n.age>=25&&['mayor','merchant','trader','baron','count','duke','heir','king','citizen'].includes(n.roleId)) || politicalPower(n,k)>35)
      .sort((a,b)=>candidateScore(b,k)-candidateScore(a,k)).slice(0,8);
    if(candidates.length<2)return;
    const votes=new Map(candidates.map(c=>[c.id,0]));
    for(const voter of people){
      const ranked=candidates.map(c=>{
        let v=relationships?.trustValue(voter,c.id,relationships?.get(voter,c.id,false))||50;
        v += (relationships?.compatibility(voter,c)||0)*.18;
        v += politicalPower(c,k)*.12;
        v += factionAffinity(c,'commons')*.05;
        v += has(voter,'loyal')&&c.id===k.leaderId?8:0;
        v += c.familyId&&voter.familyId===c.familyId?7:0;
        if(k.election?.winnerId===c.id)v+=3;
        return {c,v};
      }).sort((a,b)=>b.v-a.v);
      if(ranked[0])votes.set(ranked[0].c.id,(votes.get(ranked[0].c.id)||0)+1);
    }
    const winner=candidates.sort((a,b)=>(votes.get(b.id)||0)-(votes.get(a.id)||0))[0];
    if(!winner)return;
    k.election={year:state.year,winnerId:winner.id,votes:Object.fromEntries(votes),turnout:people.length};
    winner.roleId=winner.roleId==='king'?'king':'mayor';
    winner.roleName=winner.roleId==='king'?'King':'Mayor';
    winner.influence=clamp((winner.influence||0)+3,0,50);
    k.legitimacy=clamp((k.legitimacy||60)+6);
    memory?.remember(winner,`I won an election in ${k.name}.`,'politics',3.5,k.id,'pride',true);
    log(`${winner.name} won the ${k.name} election with ${(votes.get(winner.id)||0)} votes.`);
  }

  function courtAction(k,people){
    const ruler=people.find(n=>n.id===k.leaderId&&n.alive);
    if(!ruler)return;
    const ambitious=people.filter(n=>n.id!==ruler.id&&n.age>=18&&score(n,'ambition')>72)
      .sort((a,b)=>score(b,'ambition')-score(a,'ambition')).slice(0,6);
    for(const n of ambitious){
      if(Math.random()>0.006)return;
      const trust=relationships?.trustValue(n,ruler.id,relationships?.get(n,ruler.id,false))||50;
      if(trust<35 || (has(n,'deceptive')&&trust<50)){
        n.plottingAgainst=ruler.id;
        n.coupPressure=clamp((n.coupPressure||0)+2);
        memory?.experience(n,`${ruler.name} stands between me and power.`,'politics',3,ruler.id,'anger',5,true);
        k.tension=clamp((k.tension||0)+3);
        log(`${n.name} is quietly plotting against ${ruler.name}.`);
      } else if(trust>68){
        n.influence=clamp((n.influence||0)+.25,0,50);
        memory?.remember(n,`${ruler.name} trusts me at court.`,'politics',1.8,ruler.id,'trust');
      }
    }
  }

  function coupStep(k,people){
    const ruler=people.find(n=>n.id===k.leaderId&&n.alive);
    if(!ruler)return;
    const plotters=people.filter(n=>n.plottingAgainst===ruler.id&&n.coupPressure>0);
    for(const p of plotters){
      let chance=0.0015*score(p,'ambition')/50+0.0015*score(p,'risk')/50;
      const faction=politicalPower(p,k)>45?1.4:1;
      const support=relationships?relationships.get(p,ruler.id,false):null;
      chance*=faction;
      if(support)chance*=((100-(support.trust||50))+.1)/100+.5;
      chance*=1+(k.tension||0)/120;
      if(Math.random()<chance){
        const others=people.filter(n=>n.id!==p.id&&n.age>=18).sort((a,b)=>politicalPower(b,k)-politicalPower(a,k)).slice(0,5);
        const supporters=others.filter(n=>(relationships?.trustValue(n,p.id,relationships?.get(n,p.id,false))||50)>62).length;
        const success=supporters>=2 && (score(p,'ambition')+score(p,'sociability'))>120;
        if(success){
          ruler.roleId='heir'; ruler.roleName='Heir'; p.roleId='king'; p.roleName='King'; k.leaderId=p.id; k.succession.lastRulerId=p.id; k.legitimacy=clamp(38+supporters*7); k.tension=clamp((k.tension||0)+15);
          memory?.experience(p,`${ruler.name} was overthrown by my faction.`,'coup',5,ruler.id,'pride',-5,true);
          memory?.experience(ruler,`${p.name} overthrew me.`,'coup',5,p.id,'anger',12,true);
          log(`${p.name} seized power from ${ruler.name} in ${k.name}.`);
          p.plottingAgainst=null;p.coupPressure=0;
        } else {
          p.coupPressure=clamp(p.coupPressure+2);p.grievance=clamp((p.grievance||0)+3);
          memory?.experience(p,`My attempt to seize power failed.`,'politics',3,ruler.id,'anger',5);
        }
      }
    }
  }

  function rebellionStep(k,people){
    const unhappy=people.filter(n=>(n.grievance||0)>68&&score(n,'ambition')>62);
    if(unhappy.length<2)return;
    if((k.tension||0)<35)return;
    if(Math.random()>0.003)return;
    const rebel=unhappy.sort((a,b)=>politicalPower(b,k)-politicalPower(a,k))[0];
    const supporters=people.filter(n=>n.id!==rebel.id&&n.age>=18&&score(n,'loyalty')<55&&(n.grievance||0)>35).slice(0,12);
    const strength=politicalPower(rebel,k)+supporters.reduce((s,n)=>s+politicalPower(n,k)*.4,0);
    if(strength<45)return;
    const factionId=`rebel-${rebel.id}-${state.year}`;
    k.rebellions=k.rebellions||[];
    k.rebellions.push({id:factionId,leaderId:rebel.id,supporters:supporters.map(n=>n.id),year:state.year,strength});
    rebel.roleId='rebel';rebel.roleName='Rebel';k.tension=clamp((k.tension||0)+20);
    people.filter(n=>supporters.some(s=>s.id===n.id)).forEach(n=>{n.roleId='rebel';n.roleName='Rebel';});
    memory?.experience(rebel,`I led a rebellion against ${k.name}.`,'rebellion',4.5,k.id,'anger',8,true);
    log(`${rebel.name} leads a rebellion against ${k.name}.`);
  }

  function stabilize(k,people){
    const law=(k.law?.crimePenalty||24);
    const crimeRate=people.reduce((s,n)=>s+(n.crimes||0),0)/Math.max(1,people.length);
    const prosperity=people.reduce((s,n)=>s+(n.wealth||0),0)/Math.max(1,people.length);
    const social=(people.reduce((s,n)=>s+(n.reputation||50),0)/Math.max(1,people.length)-50)*.08;
    k.tension=clamp((k.tension||0)-.15-(prosperity>55?.08:0)-social*.02+crimeRate*0.08);
    k.legitimacy=clamp((k.legitimacy||60)+((people.reduce((s,n)=>s+(n.reputation||50),0)/Math.max(1,people.length))-50)*.006-(k.tension||0)*.002);
    if(law>30)k.legitimacy=clamp(k.legitimacy+.01);
  }

  function step(){
    if(!state.running)return;
    for(const k of state.kingdoms||[]){
      ensureKingdom(k);
      const people=alive().filter(n=>n.faction===k.id);
      if(!people.length)continue;
      buildFactions(k,people);
      if(state.tick%24===0)updateLeadership(k,people);
      electionStep(k,people);
      if(state.tick%12===0)courtAction(k,people);
      if(state.tick%18===0)coupStep(k,people);
      if(state.tick%30===0)rebellionStep(k,people);
      stabilize(k,people);
      k.politics.nobles=k.politicalFactions.find(f=>f.type==='nobles')?.power||0;
      k.politics.merchants=k.politicalFactions.find(f=>f.type==='merchants')?.power||0;
      k.politics.commons=k.politicalFactions.find(f=>f.type==='commons')?.power||0;
      k.politics.army=k.politicalFactions.find(f=>f.type==='army')?.power||0;
      k.politics.clergy=k.politicalFactions.find(f=>f.type==='clergy')?.power||0;
    }
  }

  window.NPC_POLITICS={step,politicalPower,candidateScore,rebelStep:rebellionStep};
  if(state.registerSystem)state.registerSystem({name:'politics',step,priority:90});
})();
