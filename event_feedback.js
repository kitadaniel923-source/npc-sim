// Everglen event feedback: additive visual response for a fixed list of major events.
(() => {
  const state = window.SIM_STATE;
  if (!state) return;

  const MAJOR_TYPES = new Set([
    'war-declared','war-ended','plague-outbreak','plague-contained',
    'meteor-impact','settlement-tier-up','ruler-death','player-intervention'
  ]);
  const prefersReduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const feedbackEnabled = () => state.feedbackEnabled !== false;
  let active = null;
  let lastTick = Number(state.tick) || 0;
  let lastWar = !!state.war;
  let lastPlague = !!state.plague;
  let lastMeteorCount = Array.isArray(state.meteorImpacts) ? state.meteorImpacts.length : 0;
  let lastSettlementState = new Map((state.settlements || []).map(s => [String(s.id), s.type]));
  let lastRulers = new Map((state.kingdoms || []).map(k => [String(k.id), k.leaderId || null]));

  state.feedbackEnabled = state.feedbackEnabled !== false;
  state.feedbackQueue = Array.isArray(state.feedbackQueue) ? state.feedbackQueue : [];

  function notify(event = {}) {
    const type = String(event.type || '');
    if (!MAJOR_TYPES.has(type)) return false;
    const item = {
      severity:'major', type,
      text:String(event.text || 'A major event has occurred.'),
      cause:event.cause === 'player' ? 'player' : 'organic',
      x:Number.isFinite(Number(event.x)) ? Number(event.x) : null,
      y:Number.isFinite(Number(event.y)) ? Number(event.y) : null,
      year:Number(state.year) || 1,
      tick:Number(state.tick) || 0,
      createdAt:Date.now(),
      cameraStartX:Number(state.camera?.x) || 0,
      cameraStartY:Number(state.camera?.y) || 0
    };
    state.feedbackQueue.unshift(item);
    state.feedbackQueue=state.feedbackQueue.slice(0,12);
    active=item;
    if(feedbackEnabled() && !prefersReduced()) nudgeCamera(item);
    window.SIM_RENDER?.();
    return true;
  }

  function nudgeCamera(item){
    if(item.x==null||item.y==null||!state.camera)return;
    const dx=item.x-item.cameraStartX,dy=item.y-item.cameraStartY,length=Math.hypot(dx,dy)||1,amount=Math.min(70,length*.08);
    state.camera.feedbackNudge={x:dx/length*amount,y:dy/length*amount,until:item.createdAt+900,originX:item.cameraStartX,originY:item.cameraStartY};
  }

  function resetBaselines(){
    lastTick=Number(state.tick)||0;lastWar=!!state.war;lastPlague=!!state.plague;
    lastMeteorCount=Array.isArray(state.meteorImpacts)?state.meteorImpacts.length:0;
    lastSettlementState=new Map((state.settlements||[]).map(s=>[String(s.id),s.type]));
    lastRulers=new Map((state.kingdoms||[]).map(k=>[String(k.id),k.leaderId||null]));
  }

  function rulerStillAlive(k){
    return !!k?.leaderId && (state.npcs||[]).some(n=>String(n.id)===String(k.leaderId)&&n.alive);
  }

  function watchMajorState(){
    const tick=Number(state.tick)||0;
    if(tick<lastTick){resetBaselines();return;}

    if(!!state.war!==lastWar){
      notify({type:state.war?'war-declared':'war-ended',text:state.war?'War has been declared across the realm.':'The global war has ended.',cause:'player'});
      lastWar=!!state.war;
    }
    if(!!state.plague!==lastPlague){
      notify({type:state.plague?'plague-outbreak':'plague-contained',text:state.plague?'A plague has broken out.':'The plague has been contained.',cause:'player'});
      lastPlague=!!state.plague;
    }

    const impacts=state.meteorImpacts||[];
    if(impacts.length>lastMeteorCount){
      const impact=impacts[impacts.length-1];
      if(!impact?.playerCaused)notify({type:'meteor-impact',text:'A meteor has struck the world.',cause:'organic',x:impact?.x,y:impact?.y});
    }
    lastMeteorCount=impacts.length;

    (state.settlements||[]).forEach(s=>{
      const key=String(s.id),previous=lastSettlementState.get(key);
      if(previous&&previous!==s.type&&((previous==='village'&&s.type==='city')||(previous==='city'&&s.type==='kingdom'))){
        notify({type:'settlement-tier-up',text:`${s.name} has grown from ${previous} to ${s.type}.`,cause:s.playerFounded?'player':'organic',x:s.x,y:s.y});
      }
      lastSettlementState.set(key,s.type);
    });

    (state.kingdoms||[]).forEach(k=>{
      const key=String(k.id),previousLeader=lastRulers.get(key);
      if(previousLeader&&(state.npcs||[]).some(n=>String(n.id)===String(previousLeader)&&n.alive===false)&&!(state.npcs||[]).some(n=>String(n.id)===String(previousLeader)&&n.alive)){
        const dead=state.npcs.find(n=>String(n.id)===String(previousLeader));
        notify({type:'ruler-death',text:`${dead?.name||'The ruler'} of ${k.name} has died.`,cause:dead?.playerCaused?'player':'organic',x:dead?.x,y:dead?.y});
      }
      lastRulers.set(key,k.leaderId||null);
    });

    if(state.camera?.feedbackNudge?.until&&Date.now()>state.camera.feedbackNudge.until){state.camera.feedbackNudge=null;}
    lastTick=tick;
  }

  function draw(){
    const viewport=document.getElementById('worldViewport');if(!viewport||!feedbackEnabled()||!active)return;
    const now=Date.now(),age=now-active.createdAt;if(age>2300){active=null;return;}
    if(state.camera?.feedbackNudge&&active.x!=null&&active.y!=null){
      if(now<=state.camera.feedbackNudge.until){const progress=age<250?age/250:Math.max(0,1-(age-250)/650);state.camera.x=active.cameraStartX+state.camera.feedbackNudge.x*progress;state.camera.y=active.cameraStartY+state.camera.feedbackNudge.y*progress;}
      else{state.camera.x=state.camera.feedbackNudge.originX??active.cameraStartX;state.camera.y=state.camera.feedbackNudge.originY??active.cameraStartY;state.camera.feedbackNudge=null;}
    }
    let toast=document.getElementById('eventFeedbackToast');
    if(!toast){toast=document.createElement('div');toast.id='eventFeedbackToast';toast.style.cssText='position:absolute;left:50%;top:18px;transform:translateX(-50%);z-index:55;min-width:280px;max-width:520px;padding:10px 14px;text-align:center;border:2px solid #26312c;box-shadow:4px 4px #17211d;font:700 13px Segoe UI,sans-serif;pointer-events:none;transition:opacity .15s ease;';viewport.appendChild(toast)}
    toast.style.background=active.cause==='player'?'rgba(90,69,24,.96)':'rgba(45,48,44,.96)';toast.style.color=active.cause==='player'?'#ffe59a':'#f2f0dc';toast.textContent=active.text;toast.style.opacity=String(Math.max(0,Math.min(1,1-age/2300)));
    const canvas=document.getElementById('worldCanvas');
    if(canvas&&canvas.width){const ctx=canvas.getContext('2d'),pulse=Math.sin(age/120*Math.PI)*.5+.5,alpha=(1-age/2300)*(.16+pulse*.12),w=canvas.clientWidth||canvas.width,h=canvas.clientHeight||canvas.height;ctx.save();ctx.fillStyle=active.cause==='player'?`rgba(242,198,95,${alpha})`:`rgba(235,235,220,${alpha})`;ctx.fillRect(0,0,w,6);ctx.fillRect(0,h-6,w,6);ctx.fillRect(0,0,6,h);ctx.fillRect(w-6,0,6,h);ctx.restore()}
  }

  function setEnabled(value){
    state.feedbackEnabled=!!value;
    if(!state.feedbackEnabled){active=null;if(state.camera?.feedbackNudge){state.camera.x=state.camera.feedbackNudge.originX??state.camera.x;state.camera.y=state.camera.feedbackNudge.originY??state.camera.y;state.camera.feedbackNudge=null;}const toast=document.getElementById('eventFeedbackToast');if(toast)toast.remove();}
    window.SIM_RENDER?.();
  }

  function injectToggle(){const controls=document.querySelector('.world-toolbar .toolbar-actions');if(!controls||document.getElementById('toggleFeedback'))return;const button=document.createElement('button');button.id='toggleFeedback';button.title='Toggle major-event screen feedback';const sync=()=>button.textContent=feedbackEnabled()?'✦ Feedback':'✦ Feedback Off';sync();button.addEventListener('click',()=>{setEnabled(!feedbackEnabled());sync()});controls.appendChild(button)}

  window.EVERGLEN_EVENT_FEEDBACK={notify,setEnabled,isEnabled:feedbackEnabled,majorTypes:[...MAJOR_TYPES]};
  window.EVERGLEN_NOTIFY=notify;
  if(state.registerSystem)state.registerSystem({name:'event-feedback-watch',step:watchMajorState,priority:990});
  window.EVERGLEN_RENDER?.register?.({name:'event-feedback',priority:1000,draw});
  injectToggle();setTimeout(injectToggle,0);
})();