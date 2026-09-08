// Adaptive runtime budget for large populations.
// Keeps Everglen responsive by staggering expensive work, caching lookups,
// and exposing relevance-aware NPC batches to simulation systems.
(() => {
  const state=window.SIM_STATE;if(!state)return;
  const budget={tick:0,npcCursor:0,npcBatch:96,expensiveStride:1,settlementStride:1,relationshipStride:1,memoryStride:1,cultureStride:1,economyStride:1,metrics:{npcProcessed:0,lastBatch:0,activeSystems:0,rotatingBatch:0}};
  const alive=()=>state.npcs.filter(n=>n.alive);
  const population=()=>state.npcs.length;
  const targetBatch=()=>{const p=population();if(p<=150)return 96;if(p<=400)return 140;if(p<=1000)return 220;if(p<=2500)return 320;return 420;};
  function cacheMaps(){state._cache={npc:new Map(state.npcs.map(n=>[n.id,n])),settlement:new Map((state.settlements||[]).map(s=>[s.id,s])),kingdom:new Map((state.kingdoms||[]).map(k=>[k.id,k])),family:new Map((state.families||[]).map(f=>[f.id,f])),tick:state.tick};}
  function tune(){const p=population();budget.npcBatch=targetBatch();budget.expensiveStride=p>1000?3:p>400?2:1;budget.settlementStride=p>1500?3:p>700?2:1;budget.relationshipStride=p>1200?3:p>500?2:1;budget.memoryStride=p>1800?4:p>800?3:p>300?2:1;budget.cultureStride=p>1400?4:p>800?3:p>350?2:1;budget.economyStride=p>1600?3:p>700?2:1;}
  function relevance(n){if(!n?.alive)return 0;if(n.id===state.selected)return 100;let score=20;const cam=state.camera||{x:0,y:0,zoom:1};const d=Math.hypot((n.x||0)-(cam.x||0),(n.y||0)-(cam.y||0));score+=Math.max(0,45-d/18);if(n.target||n.active||n.borderWarId)score+=20;if(state.war&&n.faction)score+=8;if((n.health||100)<35||n.hunger>85)score+=14;if(n.decisionInterrupt?.active)score+=18;return Math.max(0,Math.min(100,score));}
  function npcBatch(){const people=alive();if(!people.length)return [];const size=Math.min(budget.npcBatch,people.length),hot=people.filter(n=>relevance(n)>=70),out=[];for(const n of hot)if(out.length<size)out.push(n);for(let i=0;out.length<size&&i<people.length;i++){const n=people[(budget.npcCursor+i)%people.length];if(!out.includes(n))out.push(n);}budget.npcCursor=(budget.npcCursor+size)%people.length;budget.metrics.npcProcessed=size;budget.metrics.lastBatch=state.tick;budget.metrics.rotatingBatch=size-hot.filter(n=>out.includes(n)).length;return out;}
  function npcBatchFrom(cursor,size){const people=alive();if(!people.length)return {people:[],cursor:0};const count=Math.min(size||budget.npcBatch,people.length),out=[];const start=((cursor||0)%people.length+people.length)%people.length;for(let i=0;i<count;i++)out.push(people[(start+i)%people.length]);return {people:out,cursor:(start+count)%people.length};}
  function relevantBatch(size=budget.npcBatch){return npcBatch().slice(0,Math.min(size,budget.npcBatch));}
  function shouldRun(kind,stride=1){const s=budget[kind+'Stride']||stride;return state.tick%s===0;}
  function step(){if(!state.running)return;budget.tick=state.tick;tune();if(state.tick%6===0||state._cache?.tick!==state.tick)cacheMaps();budget.metrics.activeSystems=state.systems?.length||0;}
  state.getNpc=id=>state._cache?.tick===state.tick?state._cache.npc.get(id):state.npcs.find(n=>n.id===id);
  state.getSettlement=id=>state._cache?.tick===state.tick?state._cache.settlement.get(id):state.settlements.find(s=>s.id===id);
  state.getKingdom=id=>state._cache?.tick===state.tick?state._cache.kingdom.get(id):state.kingdoms.find(k=>k.id===id);
  state.getFamily=id=>state._cache?.tick===state.tick?state._cache.family.get(id):state.families?.find(f=>f.id===id);
  window.SIM_BUDGET={budget,alive,npcBatch,npcBatchFrom,relevantBatch,relevance,shouldRun,cacheMaps,tune};
  if(state.registerSystem)state.registerSystem({name:'simulation-budget',step,priority:5});
})();
