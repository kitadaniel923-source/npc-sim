// Phase 3H: espionage and covert politics.
// Covert actions are state-only and reuse NPC skills, memory and crime semantics.
(() => {
  const state=window.SIM_STATE;if(!state)return;
  const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,v));
  const alive=()=>state.npcs.filter(n=>n.alive);
  const kingdoms=()=>state.kingdoms.filter(k=>!k.civilWarRebel);
  const rel=(a,b)=>window.SOCIETY_CIVILIZATION_EVOLUTION?.relationScore?.(a,b)??0;
  const score=(n,k)=>window.NPC_PERSONALITY?.score?.(n,k)??50;
  const log=t=>window.SIM_LOG?.(t);
  function ensure(k){k.espionage=k.espionage||{agents:[],operations:[],counterIntel:20,intelligence:{},history:[]};return k.espionage;}
  function candidates(k){return alive().filter(n=>String(n.faction||n.kingdomId)===String(k.id)&&n.age>=18).map(n=>({n,p:score(n,'clever')+score(n,'curiosity')+score(n,'ambition')+score(n,'calm')})).sort((a,b)=>b.p-a.p).slice(0,5)}
  function run(k,target){
    const e=ensure(k),c=candidates(k)[0];if(!c)return;const subject=alive().find(n=>String(n.faction||n.kingdomId)===String(target.id)&&n.age>=18),skill=c.p/4,def=target.espionage?.counterIntel||20,chance=clamp(45+skill*.35-def*.45+rel(k.id,target.id)*.12);
    const roll=Math.random()*100,success=roll<chance,type=chance>75?'sabotage':chance>55?'intelligence':'influence';
    e.agents.push({npcId:c.n.id,targetKingdomId:target.id,year:state.year,status:'active'});e.agents=e.agents.slice(-16);
    e.operations.push({year:state.year,type,agentId:c.n.id,targetKingdomId:target.id,success});e.operations=e.operations.slice(-40);
    if(success){e.intelligence[target.id]={year:state.year,military:target.power||25,stability:target.stability||70,capital:target.capitalId};if(type==='sabotage')target.stability=clamp((target.stability||70)-4);if(type==='influence')target.tension=clamp((target.tension||0)+3);window.NPC_MEMORY?.experience(c.n,`I successfully completed a covert operation against ${target.name}.`,'espionage',4,target.id,'pride',-3,true);log(`${k.name} gained intelligence on ${target.name} through a covert operation.`);}else{c.n.crimeHeat=clamp((c.n.crimeHeat||0)+8);window.NPC_MEMORY?.experience(c.n,`My covert operation against ${target.name} failed.`,'espionage',3,target.id,'fear',4,true);log(`A covert operation by ${k.name} failed in ${target.name}.`);target.espionage=target.espionage||{counterIntel:20};target.espionage.counterIntel=clamp((target.espionage.counterIntel||20)+2);}
  }
  function step(){if(!state.running)return;if(state.tick%420!==0)return;kingdoms().forEach(k=>{const e=ensure(k);e.counterIntel=clamp((e.counterIntel||20)+((k.strategy?.interests?.security||20)-20)*.03);const target=(k.geopolitics?.threats||[])[0]?.kingdomId;const t=state.kingdoms.find(x=>String(x.id)===String(target)&&!x.civilWarRebel);if(t&&rel(k.id,t.id)<35&&Math.random()<.35)run(k,t);});}
  window.ESPIONAGE_SYSTEM={step,ensure,run};state.registerSystem?.({name:'espionage',step,priority:110});
})();
