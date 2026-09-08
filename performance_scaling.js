// Population scaling layer: system LOD, spatial indexing, event hooks and runtime telemetry.
(() => {
  const state=window.SIM_STATE;if(!state)return;
  const perf={tick:0,lastMs:0,avgMs:0,maxMs:0,systems:{},spatial:{cellSize:180,cells:0,indexed:0},events:0};
  const listeners=new Map();
  const expensive=/relationship|social|memory|culture|economy|rumor|bount|technology|logistics|migration|planning|goal/i;
  const critical=/budget|needs|behavior|life|war|settlement|decision|personality|player/i;
  const strideFor=name=>{const p=state.npcs?.length||0;if(p<300||critical.test(name))return 1;if(!expensive.test(name))return p>1500?2:1;if(p>2500)return 5;if(p>1400)return 4;if(p>800)return 3;if(p>400)return 2;return 1;};
  const cellKey=(x,y)=>`${Math.floor((x||0)/perf.spatial.cellSize)},${Math.floor((y||0)/perf.spatial.cellSize)}`;
  function rebuildSpatial(){const cells=new Map(),people=(state.npcs||[]).filter(n=>n.alive);for(const n of people){const key=cellKey(n.x,n.y);let c=cells.get(key);if(!c){c=[];cells.set(key,c)}c.push(n)}state._spatial={cells,tick:state.tick,cellSize:perf.spatial.cellSize};perf.spatial.cells=cells.size;perf.spatial.indexed=people.length;}
  function ensureSpatial(){if(!state._spatial||state._spatial.tick!==state.tick||state.tick%3===0)rebuildSpatial();return state._spatial;}
  function nearby(x,y,r=200){const s=ensureSpatial(),cs=s.cellSize,out=[],cx=Math.floor((x||0)/cs),cy=Math.floor((y||0)/cs),range=Math.ceil(r/cs);for(let yy=cy-range;yy<=cy+range;yy++)for(let xx=cx-range;xx<=cx+range;xx++){const cell=s.cells.get(`${xx},${yy}`);if(cell)for(const n of cell)if(Math.hypot((n.x||0)-x,(n.y||0)-y)<=r)out.push(n)}return out;}
  function on(type,fn){if(typeof fn!=='function')return()=>{};let set=listeners.get(type);if(!set){set=new Set();listeners.set(type,set)}set.add(fn);return()=>set.delete(fn);}
  function emit(type,payload={}){perf.events++;(listeners.get(type)||[]).forEach(fn=>{try{fn(payload)}catch(err){console.warn('Everglen performance event error',err)}});}
  function tier(n){if(!n?.alive)return'background';if(n.id===state.selected)return'hero';const r=window.SIM_BUDGET?.relevance?.(n)||0;if(r>=70)return'near';if(r>=40)return'local';return'background';}
  function runNPC(list,fn){const byTier={hero:[],near:[],local:[],background:[]};for(const n of list||[])byTier[tier(n)].push(n);for(const n of byTier.hero)fn(n,'hero');for(const n of byTier.near)fn(n,'near');for(const n of byTier.local)fn(n,'local');if((state.tick%4===0))for(const n of byTier.background)fn(n,'background');}
  function step(){if(!state.running)return;const now=performance.now();perf.tick=state.tick;perf.avgMs=perf.avgMs?perf.avgMs*.9+perf.lastMs*.1:perf.lastMs;if(state.tick%3===0)rebuildSpatial();state.performanceMetrics={tick:perf.tick,lastMs:Math.round(perf.lastMs*100)/100,avgMs:Math.round(perf.avgMs*100)/100,maxMs:Math.round(perf.maxMs*100)/100,systems:perf.systems,population:state.npcs?.length||0,spatial:{cells:perf.spatial.cells,indexed:perf.spatial.indexed},events:perf.events};if(now){} }
  if(state.registerSystem)state.registerSystem({name:'performance-scaling',step,priority:2});
  const originalRegister=state.registerSystem;
  if(originalRegister){state.registerSystem=function(spec){if(!spec||typeof spec.step!=='function')return originalRegister.call(state,spec);const name=spec.name||'anonymous',originalStep=spec.step,wrapped=function(){if(!state.running)return;const stride=strideFor(name),started=performance.now();if(state.tick%stride!==0){perf.systems[name]=perf.systems[name]||{runs:0,skips:0,lastMs:0};perf.systems[name].skips++;return;}originalStep();const ms=performance.now()-started;const m=perf.systems[name]||(perf.systems[name]={runs:0,skips:0,lastMs:0});m.runs++;m.lastMs=Math.round(ms*100)/100;perf.lastMs=ms;perf.maxMs=Math.max(perf.maxMs,ms);};return originalRegister.call(state,{...spec,step:wrapped});};}
  window.EVERGLEN_PERF={perf,tier,nearby,rebuildSpatial,ensureSpatial,runNPC,on,emit,strideFor};
})();
