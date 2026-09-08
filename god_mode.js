// Everglen God Mode: direct player interaction with the simulated world.
(() => {
  const state = window.SIM_STATE;
  if (!state) return;

  const canvas = document.getElementById('worldCanvas');
  if (!canvas) return;

  const TOOLS = [
    ['select','🖐 Select'],
    ['move','✥ Move'],
    ['bless','✨ Bless'],
    ['smite','☠ Smite'],
    ['human','👤 Human'],
    ['dwarf','⛏ Dwarf'],
    ['elf','🧝 Elf'],
    ['orc','👹 Orc'],
    ['soldier','⚔ Soldier'],
    ['king','👑 King'],
    ['gold','💰 Gold'],
    ['iron','⛏ Iron'],
    ['food','🌾 Food'],
    ['wood','🌲 Wood'],
    ['settlement','🏠 Settlement'],
    ['meteor','☄ Meteor']
  ];

  let active = false;
  let tool = 'select';
  let moveTarget = null;
  let busy = false;

  const note = text => {
    state.feed = state.feed || [];
    state.feed.unshift(`Year ${state.year || 1}, Day ${state.day || 1}: ${text}`);
    state.feed = state.feed.slice(0, 15);
    const feed = document.getElementById('eventFeed');
    if (feed) feed.innerHTML = state.feed.map(x => `<li>${x}</li>`).join('');
  };
  const render = () => { try { window.SIM_RENDER?.(); } catch (_) {} try { window.EVERGLEN_2D_ART?.draw?.(); } catch (_) {} };
  const worldPoint = e => {
    const r = canvas.getBoundingClientRect();
    const sx = (e.clientX - r.left) * canvas.width / Math.max(1, r.width);
    const sy = (e.clientY - r.top) * canvas.height / Math.max(1, r.height);
    const camera = state.camera || { x:0, y:0, zoom:1 };
    return {
      x: camera.x + (sx - canvas.width / 2) / Math.max(.01, camera.zoom),
      y: camera.y + (sy - canvas.height / 2) / Math.max(.01, camera.zoom)
    };
  };
  const nearbyNpc = p => (state.npcs || []).filter(n => n.alive).reduce((best,n) => {
    const d = Math.hypot((n.x||0)-p.x,(n.y||0)-p.y);
    return !best || d < best.d ? { n, d } : best;
  }, null);

  function setActive(value) {
    active = !!value;
    state.godMode = active;
    updateUI();
    if (active) note('God Mode awakened. The world now responds directly to the player.');
  }

  function choose(next) {
    tool = next;
    moveTarget = null;
    updateUI();
  }

  function updateUI() {
    const button = document.getElementById('godMode');
    if (button) {
      button.textContent = active ? '⚡ God Mode: ON' : '☄ God Mode';
      button.classList.toggle('primary', active);
    }
    document.querySelectorAll('#godToolMenu button[data-tool]').forEach(b => b.classList.toggle('primary', b.dataset.tool === tool && active));
    const label = document.getElementById('godToolLabel');
    if (label) label.textContent = active ? `Tool: ${TOOLS.find(x=>x[0]===tool)?.[1] || tool}` : 'God Mode off';
  }

  function summon(kind, p) {
    const before = new Set((state.npcs || []).map(n => n.id));
    const btn = document.querySelector(`#spawnMenu [data-spawn="${kind}"]`);
    if (!btn) return false;
    busy = true;
    btn.click();
    const created = (state.npcs || []).filter(n => !before.has(n.id));
    created.forEach(n => { n.x = p.x + (Math.random()-.5)*10; n.y = p.y + (Math.random()-.5)*10; n.target = {x:n.x,y:n.y}; });
    busy = false;
    note(`${kind} summoned at the chosen location.`);
    render();
    return true;
  }

  function resource(type,p) {
    state.worldGen = state.worldGen || { resources:[], biomes:[], landmarks:[] };
    state.worldGen.resources = state.worldGen.resources || [];
    state.worldGen.resources.push({ id:`god-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`, type, x:p.x, y:p.y, amount:100, depleted:false, playerPlaced:true });
    note(`A ${type} resource was created at the chosen location.`);
    render();
  }

  function settlement(p) {
    state.settlements = state.settlements || [];
    const kingdom = (state.kingdoms || [])[0] || null;
    const s = {
      id:`god-settlement-${Date.now().toString(36)}`,
      name:`${['Haven','Crossing','Hold','Watch','Village'][Math.floor(Math.random()*5)]}`,
      type:'village', level:1, x:p.x, y:p.y, kingdomId:kingdom?.id||null,
      founderId:null, rulerId:null, age:0, homes:6, buildings:3, stability:85, wealth:180, influence:3,
      resources:{food:80,wood:70,stone:45,iron:12,gold:15,cloth:8,medicine:4,reagents:3,weapons:2,armor:2,tools:8},
      history:[`Year ${state.year||1}: founded directly by the player.`], playerFounded:true
    };
    state.settlements.push(s);
    note(`${s.name} was founded by divine intervention.`);
    render();
  }

  function meteor(p) {
    state.meteorImpacts = state.meteorImpacts || [];
    state.meteorImpacts.push({x:p.x,y:p.y,life:80,playerCaused:true});
    (state.npcs || []).filter(n=>n.alive).forEach(n=>{
      const d=Math.hypot((n.x||0)-p.x,(n.y||0)-p.y);
      if(d<110) n.health=Math.max(0,(n.health||100)-Math.max(15,80-d*.45));
      if(n.health<=0) n.alive=false;
    });
    (state.settlements || []).forEach(s=>{
      const d=Math.hypot((s.x||0)-p.x,(s.y||0)-p.y);
      if(d<150){s.stability=Math.max(0,(s.stability||0)-25);s.wealth=Math.max(0,(s.wealth||0)-30);s.history=s.history||[];s.history.push(`Year ${state.year||1}: struck by a player-summoned meteor.`);}
    });
    state.stability=Math.max(0,(state.stability||50)-5);
    note('A meteor was summoned onto the world.');
    render();
  }

  function bless(p) {
    const hit=nearbyNpc(p);
    if(!hit || hit.d>26/Math.max(.5,state.camera?.zoom||1)) return false;
    const n=hit.n;
    n.health=100; n.mood=Math.min(100,(n.mood||50)+25); n.fortune=Math.min(100,(n.fortune||50)+20);
    n.grievance=Math.max(0,(n.grievance||0)-20); n.needState='stable';
    if(n.needs){n.needs.health=100;n.needs.safety=Math.min(100,(n.needs.safety||50)+20);n.needs.purpose=Math.min(100,(n.needs.purpose||50)+10);}
    if(window.NPC_MEMORY?.remember) window.NPC_MEMORY.remember(n,{type:'divine',text:'A mysterious divine blessing restored and strengthened me.',importance:90,permanent:true,emotion:'joy'});
    note(`${n.name} was blessed by the player.`);
    render(); return true;
  }

  function smite(p) {
    const hit=nearbyNpc(p);
    if(!hit || hit.d>26/Math.max(.5,state.camera?.zoom||1)) return false;
    const n=hit.n; n.health=0; n.alive=false;
    if(window.NPC_MEMORY?.remember) window.NPC_MEMORY.remember(n,{type:'divine',text:'I was struck down by a divine power.',importance:100,permanent:true,emotion:'fear'});
    note(`${n.name} was smitten.`);
    if(state.selected===n.id) state.selected=null;
    render(); return true;
  }

  function move(p) {
    const hit=nearbyNpc(p);
    if(!moveTarget){
      if(!hit || hit.d>26/Math.max(.5,state.camera?.zoom||1)) return false;
      moveTarget=hit.n; state.selected=hit.n.id; note(`Selected ${hit.n.name} for divine relocation.`); render(); return true;
    }
    moveTarget.x=p.x; moveTarget.y=p.y; moveTarget.target={x:p.x,y:p.y};
    note(`${moveTarget.name} was moved to a new location.`); moveTarget=null; render(); return true;
  }

  function handle(e) {
    if(!active || busy) return;
    if(e.button!==0) return;
    const p=worldPoint(e);
    let handled=false;
    if(tool==='select') return;
    if(tool==='move') handled=move(p);
    else if(tool==='bless') handled=bless(p);
    else if(tool==='smite') handled=smite(p);
    else if(['human','dwarf','elf','orc','soldier','king'].includes(tool)) handled=summon(tool,p);
    else if(['gold','iron','food','wood'].includes(tool)) {resource(tool,p);handled=true;}
    else if(tool==='settlement') {settlement(p);handled=true;}
    else if(tool==='meteor') {meteor(p);handled=true;}
    if(handled){e.preventDefault();e.stopImmediatePropagation();}
  }

  function buildMenu(){
    if(document.getElementById('godToolDock')) return;
    const style=document.createElement('style');
    style.textContent=`#godToolDock{position:absolute;z-index:45;right:12px;bottom:86px;font-family:monospace;pointer-events:auto}#godToolPanel{display:none;width:250px;background:rgba(31,42,38,.98);border:2px solid #18231f;box-shadow:4px 4px #18231f;padding:8px}#godToolPanel.open{display:block}.god-title{font-size:10px;color:#e6c35d;margin-bottom:5px}.god-label{font-size:7px;color:#9eaaa0;margin-bottom:6px}.god-grid{display:grid;grid-template-columns:1fr 1fr;gap:4px}.god-grid button{font-size:8px;padding:6px 4px}.god-grid button.primary{outline:2px solid #e6c35d;background:#4b5a50}.god-help{font-size:7px;color:#9eaaa0;line-height:1.3;margin-top:7px}.god-toggle{font:inherit;font-weight:700;color:#f2f0dc;background:#3a4a43;border:2px solid #18231f;padding:8px 12px;box-shadow:3px 3px #18231f;cursor:pointer}`;
    document.head.appendChild(style);
    const dock=document.createElement('div');dock.id='godToolDock';
    dock.innerHTML=`<button class="god-toggle" id="godToolToggle">⚡ TOOLS</button><div id="godToolPanel"><div class="god-title">DIVINE TOOLBELT</div><div class="god-label" id="godToolLabel">God Mode off</div><div class="god-grid">${TOOLS.map(([id,label])=>`<button data-tool="${id}">${label}</button>`).join('')}</div><div class="god-help">Move: click an NPC, then click a destination. Other tools act directly on the clicked location.</div></div>`;
    document.body.appendChild(dock);
    document.getElementById('godToolToggle').addEventListener('click',()=>document.getElementById('godToolPanel').classList.toggle('open'));
    dock.querySelectorAll('[data-tool]').forEach(b=>b.addEventListener('click',()=>{setActive(true);choose(b.dataset.tool);}));
  }

  const godButton=document.getElementById('godMode');
  if(godButton){
    godButton.addEventListener('click',e=>{e.stopImmediatePropagation();setActive(!active);},true);
  }
  canvas.addEventListener('click',handle,true);
  buildMenu();
  window.EVERGLEN_GOD_MODE={activate:()=>setActive(true),deactivate:()=>setActive(false),choose,tools:TOOLS,get active(){return active},get tool(){return tool}};
  updateUI();
})();
