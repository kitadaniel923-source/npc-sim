// Everglen living NPC movement layer.
// Gives simulated people real spatial routines while preserving existing AI decisions.
(() => {
  'use strict';
  const state = window.SIM_STATE;
  if (!state) return;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, Number(v) || 0));
  const dist = (a,b) => Math.hypot((a?.x||0)-(b?.x||0),(a?.y||0)-(b?.y||0));
  const alive = () => (state.npcs || []).filter(n => n?.alive);
  const settlements = () => state.settlements || [];
  const role = n => String(n.roleId || n.professionId || 'citizen').toLowerCase();
  const action = n => String(n.aiDecision?.action || '').toLowerCase();
  const roleGroup = n => {
    const r=role(n);
    if(['farmer','rancher','baker','cook','fisher','hunter','forager','woodcutter'].includes(r))return'work';
    if(['miner','blacksmith','armorer','carpenter','weaver','mason','builder','engineer','architect','shipwright'].includes(r))return'craft';
    if(['merchant','trader','shopkeeper','peddler','smuggler'].includes(r))return'market';
    if(['soldier','militia','archer','spearman','cavalry','knight','paladin','ranger','captain','general','marshal'].includes(r))return'military';
    if(['scholar','teacher','scribe','librarian','cleric','druid','mage','wizard','alchemist','enchanter'].includes(r))return'knowledge';
    return'civic';
  };
  function settlementFor(n){
    return settlements().find(s=>String(s.id)===String(n.settlementId)) || settlements().slice().sort((a,b)=>dist(n,a)-dist(n,b))[0] || null;
  }
  function pointFor(n,s){
    const infra=s?.infrastructure||{};
    const roads=Array.isArray(infra.roads)?infra.roads:[];
    const group=roleGroup(n), a=action(n);
    if(a==='socialize'||a==='belong'||a==='eat'||a==='drink'||a==='rest')return {x:(s?.x||0)+Math.sin(n.id*1.7)*18,y:(s?.y||0)+Math.cos(n.id*1.3)*14,kind:'civic'};
    if(a==='trade'||group==='market')return {x:(s?.x||0)+10,y:(s?.y||0)+10,kind:'market'};
    if(a==='train'||a==='safety'||group==='military')return {x:(s?.x||0)-18,y:(s?.y||0)-8,kind:'military'};
    if(a==='study'||a==='govern'||group==='knowledge')return {x:(s?.x||0)-8,y:(s?.y||0)+15,kind:'knowledge'};
    if(group==='work'){
      const farms=Math.max(1,Number(s?.resources?.food||0));
      return {x:(s?.x||0)+(farms%2?32:-32),y:(s?.y||0)+24,kind:'work'};
    }
    if(group==='craft')return {x:(s?.x||0)-24,y:(s?.y||0)+5,kind:'craft'};
    if(roads.length)return roads[Math.abs(Number(n.id)||0)%roads.length]?.path?.[0]||{x:s.x,y:s.y,kind:'road'};
    return {x:(s?.x||0)+Math.sin((Number(n.id)||0)*2.1)*22,y:(s?.y||0)+Math.cos((Number(n.id)||0)*1.9)*18,kind:'civic'};
  }
  function ensureTarget(n){
    const targetNpc=n.aiDecision?.targetId ? state.npcs?.find(x=>x.id===n.aiDecision.targetId&&x.alive) : null;
    if(targetNpc){n.movementTarget={x:targetNpc.x,y:targetNpc.y,kind:'person',targetId:targetNpc.id};return n.movementTarget;}
    const s=settlementFor(n);if(!s)return null;
    const now=state.tick||0;
    if(!n.movementTarget || n.movementTargetTick < now-8 || dist(n,n.movementTarget)<7){
      n.movementTarget=pointFor(n,s);
      n.movementTargetTick=now;
    }
    return n.movementTarget;
  }
  function walk(n){
    const t=ensureTarget(n);if(!t)return;
    const dx=(t.x||0)-(n.x||0),dy=(t.y||0)-(n.y||0),d=Math.hypot(dx,dy);
    if(d<1){n.movementState='arrived';return;}
    const base=.24+clamp(n.speed,.2,1.4)*.55;
    const actionSpeed=['rest','eat','drink','socialize'].includes(action(n))?.65:1;
    const step=Math.min(d,base*actionSpeed*(state.speed||1));
    n.x += dx/d*step;
    n.y += dy/d*step;
    n.movementState='walking';
    n.movementFacing=Math.atan2(dy,dx);
    n.visual=n.visual||{};
    n.visual.walking=true;
    n.visual.activity=t.kind||'civic';
    n.visual.movePhase=(n.visual.movePhase||0)+step*.35;
  }
  let lastTick=-1;
  function step(){
    if(!state.running || state.tick===lastTick)return;
    lastTick=state.tick;
    const people=alive();
    const budget=Math.min(people.length, Math.max(40, Math.floor((window.SIM_BUDGET?.relevantBatch?.(people.length)?.length||people.length))));
    for(let i=0;i<budget;i++)walk(people[i]);
  }
  window.EVERGLEN_NPC_MOVEMENT={step,ensureTarget,pointFor};
  state.registerSystem?.({name:'everglen-npc-movement',step,priority:90});
})();
