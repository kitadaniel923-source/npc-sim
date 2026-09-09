// Everglen shared world input dispatcher.
// Owns world viewport input, including camera pan/zoom, and routes gameplay actions.
(() => {
  const viewport = document.getElementById('worldViewport');
  const canvas = document.getElementById('worldCanvas');
  if (!viewport || !canvas) return;

  const handlers = [];
  const drag = { active:false, moved:false, startX:0, startY:0, cameraX:0, cameraY:0 };

  const state = () => window.SIM_STATE;
  const register = handler => {
    if (!handler || typeof handler.handle !== 'function') return () => {};
    const entry = {
      name: handler.name || `handler-${handlers.length+1}`,
      priority: Number.isFinite(handler.priority) ? handler.priority : 100,
      events: Array.isArray(handler.events) ? handler.events : ['click'],
      hitTest: typeof handler.hitTest === 'function' ? handler.hitTest : null,
      handle: handler.handle
    };
    handlers.push(entry);
    handlers.sort((a,b) => a.priority - b.priority);
    return () => { const i=handlers.indexOf(entry); if(i>=0)handlers.splice(i,1); };
  };

  // Rendering maps 320x180 screen pixels to world units at 8 world-units per pixel.
  // Input must use the exact same transform or clicks and camera movement drift.
  const worldPoint = (clientX, clientY) => {
    const s=state(),r=viewport.getBoundingClientRect();
    const sx=(clientX-r.left)*320/Math.max(1,r.width),sy=(clientY-r.top)*180/Math.max(1,r.height);
    const cam=s?.camera||{x:0,y:0,zoom:1};
    return {x:cam.x+(sx-160)*8/Math.max(.01,cam.zoom),y:cam.y+(sy-90)*8/Math.max(.01,cam.zoom)};
  };

  const dispatch = (type,event,pointOverride) => {
    const p=pointOverride||worldPoint(event.clientX,event.clientY);
    for(const h of handlers.slice()){
      if(!h.events.includes(type)&&!h.events.includes('*'))continue;
      if(h.hitTest&&h.hitTest(p,event,type)===false)continue;
      try{if(h.handle(p,event,type)===true)return true;}
      catch(error){console.error(`Everglen input handler '${h.name}' failed`,error);}
    }
    return false;
  };
  const intercept=(type,event)=>{if(dispatch(type,event)){event.preventDefault();event.stopImmediatePropagation();return true;}return false;};

  // world2dCanvas is intentionally pointer-transparent, so listen on its viewport.
  viewport.addEventListener('click',e=>intercept('click',e),true);
  viewport.addEventListener('wheel',e=>intercept('wheel',e),{capture:true,passive:false});
  viewport.addEventListener('mousedown',e=>intercept('mousedown',e),true);
  window.addEventListener('mousemove',e=>intercept('mousemove',e),true);
  window.addEventListener('mouseup',e=>intercept('mouseup',e),true);

  register({
    name:'camera-controls',priority:900,events:['wheel','mousedown','mousemove','mouseup'],
    handle:(p,event,type)=>{
      const s=state();if(!s)return false;
      if(type==='wheel'){
        const oldZoom=Math.max(.45,Math.min(3,Number(s.camera.zoom)||1));
        const newZoom=Math.max(.45,Math.min(3,oldZoom*(event.deltaY<0?1.1:.9)));
        const r=viewport.getBoundingClientRect();
        const sx=(event.clientX-r.left)*320/Math.max(1,r.width),sy=(event.clientY-r.top)*180/Math.max(1,r.height);
        const beforeX=s.camera.x+(sx-160)*8/oldZoom,beforeY=s.camera.y+(sy-90)*8/oldZoom;
        s.camera.zoom=newZoom;
        s.camera.x=beforeX-(sx-160)*8/newZoom;
        s.camera.y=beforeY-(sy-90)*8/newZoom;
        window.SIM_RENDER?.();return true;
      }
      if(type==='mousedown'){
        if(event.button!==0)return false;
        drag.active=true;drag.moved=false;drag.startX=event.clientX;drag.startY=event.clientY;
        drag.cameraX=Number(s.camera.x)||0;drag.cameraY=Number(s.camera.y)||0;
        viewport.classList.add('camera-dragging');return true;
      }
      if(type==='mousemove'){
        if(!drag.active)return false;
        const dx=event.clientX-drag.startX,dy=event.clientY-drag.startY;
        if(Math.abs(dx)+Math.abs(dy)>3)drag.moved=true;
        const z=Math.max(.01,Number(s.camera.zoom)||1);
        s.camera.x=drag.cameraX-dx*8/z;s.camera.y=drag.cameraY-dy*8/z;
        window.SIM_RENDER?.();return true;
      }
      if(type==='mouseup'){
        if(!drag.active)return false;drag.active=false;viewport.classList.remove('camera-dragging');return true;
      }
      return false;
    }
  });

  register({
    name:'npc-selection',priority:1000,events:['click'],
    hitTest:()=>!state()?.godMode&&!drag.moved,
    handle:p=>{
      const s=state();if(!s)return false;let hit=null,best=18/Math.max(.01,s.camera?.zoom||1);
      (s.npcs||[]).forEach(n=>{if(!n.alive)return;const d=Math.hypot((n.x||0)-p.x,(n.y||0)-p.y);if(d<best){hit=n;best=d;}});
      if(!hit)return false;s.selected=hit.id;window.SIM_RENDER?.();return true;
    }
  });

  register({name:'world-click-capture',priority:1100,events:['click'],handle:()=>true});

  window.EVERGLEN_INPUT={
    register,unregister:fn=>fn?.(),screenToWorld:(clientX,clientY)=>worldPoint(clientX,clientY),dispatch,handlers,
    get cameraDragging(){return drag.active;}
  };
})();
