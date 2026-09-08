// Medieval information network: rumors, eyewitness news and court gossip.
(() => {
  const state=window.SIM_STATE;if(!state)return;
  const P=window.NPC_PERSONALITY,M=window.NPC_MEMORY;
  const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,v));
  const alive=()=>state.npcs.filter(n=>n.alive);
  const score=(n,k)=>P?.score(n,k)??50;
  const log=t=>window.SIM_API?.log?.(t);
  const budget=()=>window.SIM_BUDGET;
  const distance=(a,b)=>Math.abs((a?.x||0)-(b?.x||0))+Math.abs((a?.y||0)-(b?.y||0));
  const sourceMemory=n=>(n.memories||[]).filter(m=>m.permanent||m.importance>=3.2).sort((a,b)=>(b.importance||0)-(a.importance||0))[0];

  function ensure(n){
    n.rumors=n.rumors||[];
    n.rumorTrust=n.rumorTrust||{};
  }

  function sourceLabel(m){
    if(!m)return'news';
    if(m.type==='war'||m.type==='enemy'||m.type==='betrayal')return'war news';
    if(m.type==='crime')return'crime news';
    if(m.type==='succession')return'court gossip';
    if(m.type==='faith'||m.type==='festival')return'faith news';
    if(m.type==='famine'||m.type==='disaster')return'bad news';
    if(m.type==='technology'||m.type==='infrastructure')return'new knowledge';
    return'news';
  }

  function hear(listener,source,memory){
    if(!listener||!source||!memory||listener.id===source.id)return;
    ensure(listener);
    const key=`${source.id}:${memory.key||memory.text}`;
    if(listener.rumorTrust[key])return;
    const intelligence=(score(listener,'cleverness')+score(listener,'curiosity'))/2;
    const sociability=score(listener,'sociability');
    const trust=(score(listener,'loyalty')+score(listener,'kindness'))/2;
    const clarity=clamp(45+intelligence*.45+sociability*.2+trust*.15+(score(source,'cleverness')-50)*.25);
    const distortion=Math.random()>.65?Math.max(0,12-intelligence*.08):0;
    const confidence=clamp(clarity-distortion+Math.random()*10-5);
    const text=confidence>68?memory.text:`I heard that ${String(memory.text||'something happened').replace(/^I /,'')}`;
    listener.rumors.unshift({key,sourceId:source.id,text,year:state.year,confidence,type:sourceLabel(memory),knownBy:false});
    listener.rumors=listener.rumors.slice(0,18);
    listener.rumorTrust[key]=confidence;
    if(M&&confidence>=58)M.remember(listener,`I heard news: ${text}`,'rumor',confidence>=78?2.6:1.7,source.id,confidence<50?'fear':'curious');
  }

  function spreadFrom(source){
    const m=sourceMemory(source);if(!m)return;
    const sameSettlement=alive().filter(n=>n.id!==source.id&&n.settlementId===source.settlementId);
    sameSettlement.sort(()=>Math.random()-.5).slice(0,Math.min(4,8)).forEach(n=>hear(n,source,m));
    if(source.settlementId){
      const s=state.getSettlement?state.getSettlement(source.settlementId):state.settlements.find(x=>x.id===source.settlementId);
      const nearby=state.settlements.filter(x=>x.id!==source.settlementId).sort((a,b)=>distance(s,a)-distance(s,b)).slice(0,2);
      nearby.forEach(dst=>alive().filter(n=>n.settlementId===dst.id&&(['merchant','trader','courier','explorer','sailor'].includes(n.roleId)||score(n,'sociability')>76)).sort(()=>Math.random()-.5).slice(0,2).forEach(n=>hear(n,source,m)));
    }
  }

  function react(n){
    ensure(n);
    const rumor=n.rumors[0];if(!rumor)return;
    const trust=clamp((n.rumorTrust[rumor.key]||50));
    if(trust<35&&Math.random()<.18){rumor.text=`Some say ${rumor.text.replace(/^I heard that /,'')}`;}
    if(trust>72&&rumor.type==='war news'&&score(n,'courage')>65)n.lastAction='Acted on alarming war news';
    if(trust>72&&rumor.type==='crime news'&&score(n,'kindness')>65)n.lastAction='Warned others about danger';
    if(trust>75&&rumor.type==='court gossip'&&score(n,'ambition')>70)n.lastAction='Followed court gossip';
    if(trust>75&&rumor.type==='bad news')n.grievance=clamp((n.grievance||0)+.08);
  }

  function step(){
    if(!state.running)return;
    const B=budget();
    const people=B?.npcBatch?B.npcBatch():alive();
    if(state.tick%12===0)people.forEach(n=>{if(Math.random()<.45)spreadFrom(n);react(n);});
  }

  window.NPC_RUMORS={ensure,hear,spreadFrom,step};
  if(state.registerSystem)state.registerSystem({name:'npc-rumors',step,priority:78});
})();
