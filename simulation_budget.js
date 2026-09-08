// Adaptive runtime budget for large populations.
// Keeps the simulation responsive by staggering expensive NPC work and caching lookups.
(() => {
  const state=window.SIM_STATE;if(!state)return;
  const budget={
    tick:0,
    npcCursor:0,
    npcBatch:96,
    expensiveStride:1,
    settlementStride:1,
    relationshipStride:1,
    memoryStride:1,
    metrics:{npcProcessed:0,lastBatch:0,activeSystems:0}
  };

  const alive=()=>state.npcs.filter(n=>n.alive);
  const population=()=>state.npcs.length;
  const targetBatch=()=>{
    const p=population();
    if(p<=150)return 96;
    if(p<=400)return 140;
    if(p<=1000)return 220;
    if(p<=2500)return 320;
    return 420;
  };

  function cacheMaps(){
    const npcMap=new Map(state.npcs.map(n=>[n.id,n]));
    const settlementMap=new Map((state.settlements||[]).map(s=>[s.id,s]));
    const kingdomMap=new Map((state.kingdoms||[]).map(k=>[k.id,k]));
    state._cache={npc:npcMap,settlement:settlementMap,kingdom:kingdomMap,tick:state.tick};
  }

  function tune(){
    const p=population();
    budget.npcBatch=targetBatch();
    budget.expensiveStride=p>1000?3:p>400?2:1;
    budget.settlementStride=p>1500?3:p>700?2:1;
    budget.relationshipStride=p>1200?3:p>500?2:1;
    budget.memoryStride=p>1800?4:p>800?3:p>300?2:1;
  }

  function npcBatch(){
    const people=alive();if(!people.length)return [];
    const size=Math.min(budget.npcBatch,people.length);
    const out=[];
    for(let i=0;i<size;i++)out.push(people[(budget.npcCursor+i)%people.length]);
    budget.npcCursor=(budget.npcCursor+size)%people.length;
    budget.metrics.npcProcessed=size;
    budget.metrics.lastBatch=state.tick;
    return out;
  }

  function shouldRun(kind,stride=1){
    const s=budget[kind+'Stride']||stride;
    return state.tick%s===0;
  }

  function step(){
    if(!state.running)return;
    budget.tick=state.tick;
    tune();
    if(state.tick%6===0||state._cache?.tick!==state.tick)cacheMaps();
  }

  state.getNpc=(id)=>state._cache?.tick===state.tick?state._cache.npc.get(id):state.npcs.find(n=>n.id===id);
  state.getSettlement=(id)=>state._cache?.tick===state.tick?state._cache.settlement.get(id):state.settlements.find(s=>s.id===id);
  state.getKingdom=(id)=>state._cache?.tick===state.tick?state._cache.kingdom.get(id):state.kingdoms.find(k=>k.id===id);
  window.SIM_BUDGET={budget,alive,npcBatch,shouldRun,cacheMaps,tune};
  if(state.registerSystem)state.registerSystem({name:'simulation-budget',step,priority:5});
})();
