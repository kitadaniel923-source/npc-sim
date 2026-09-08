(() => {
  const state = window.SIM_STATE;
  if (!state) return;

  const names = ['Ari','Bram','Cora','Dax','Elia','Faye','Gale','Hana','Ivo','Juno','Kian','Lena','Milo','Nia','Oren','Pia','Quill','Rhea','Sera','Tobin','Uma','Vale','Wren','Yara','Zane','Mara','Theo','Niko','Lumi','Cass','Dara','Soren','Vera','Kato','Mira','Rowan','Orin','Lyra','Finn','Nora'];
  const traits = ['brave','curious','ambitious','kind','greedy','loyal','clever','calm','hardworking','honest'];
  const rand = a => a[Math.floor(Math.random() * a.length)];
  const uid = p => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`;
  const note = text => {
    state.feed = state.feed || [];
    state.feed.unshift(`Year ${state.year || 1}, Day ${state.day || 1}: ${text}`);
    state.feed = state.feed.slice(0, 15);
    const feed = document.getElementById('eventFeed');
    if (feed) feed.innerHTML = state.feed.map(x => `<li>${x}</li>`).join('');
  };
  const render = () => { try { window.SIM_RENDER?.(); } catch(e) {} try { window.EVERGLEN_2D_ART?.draw?.(); } catch(e) {} };
  const spawnPoint = () => ({
    x: (state.camera?.x || 0) + (Math.random() - .5) * 80,
    y: (state.camera?.y || 0) + (Math.random() - .5) * 60
  });
  const nearestSettlement = (x,y) => (state.settlements || []).slice().sort((a,b) => Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y))[0] || null;
  const ensureKingdom = () => {
    if (state.kingdoms?.length) return state.kingdoms[0];
    const k = {id:uid('kingdom'),name:'Freefolk',color:'#79c2ff',capitalId:null,leaderId:null,treasury:100,power:25,stability:82,taxRate:.08,law:{crimePenalty:24,bribeBase:12},politics:{nobles:20,merchants:20,commons:50,clergy:10,army:0}};
    state.kingdoms = state.kingdoms || [];
    state.kingdoms.push(k);
    return k;
  };
  const makeNpc = species => {
    const k = ensureKingdom(), p = spawnPoint(), s = nearestSettlement(p.x,p.y);
    const role = species === 'soldier' ? 'soldier' : species === 'king' ? 'king' : 'citizen';
    const age = species === 'king' ? 30 + Math.floor(Math.random()*25) : 18 + Math.floor(Math.random()*35);
    const n = {
      id: uid('npc'), name: `${rand(names)} ${Math.floor(Math.random()*90)+10}`, age, sex:Math.random()>.5?'F':'M', species,
      trait:rand(traits), traits:[rand(traits)], roleId:role, roleName:role[0].toUpperCase()+role.slice(1), faction:k.id,
      settlementId:s?.id||null, x:p.x, y:p.y, target:null, speed:.45+Math.random()*.45, mood:70, health:100,
      hunger:10, energy:90, wealth:species==='king'?300:20+Math.random()*80, goal:'Live and work', home:s?.name||null,
      parentIds:[],childrenIds:[],partnerId:null,relations:[],memories:[],alive:true,color:k.color,inventory:{food:2,wood:0,stone:0,iron:0,gold:species==='king'?50:0,cloth:0,medicine:0,reagents:0,weapons:species==='soldier'?1:0,armor:species==='soldier'?1:0,tools:0},
      reputation:50,honor:species==='king'?85:50,influence:species==='king'?50:5,status:species==='king'?90:1,classTier:species==='king'?'royal':'peasant',education:species==='king'?70:0,ambition:50,loyalty:60,crimeHeat:0,arrests:0,crimes:0,term:0,lastAction:'Spawned by the player',socialCooldown:0,grievance:0,fortune:50,
      visual:{species,bodyScale:species==='dwarf'?.72:species==='giant'?1.35:.88,skin:rand(['#6b4226','#8c5a36','#b97950','#d49b72','#f0c39d']),hair:rand(['#251a16','#3a261b','#5a3524','#241f22','#7a5436']),hairStyle:rand(['short','long','braided','cropped'])}
    };
    state.npcs.push(n);
    if (s) { s.homes = (s.homes || 0) + 1; s.wealth = (s.wealth || 0) + 2; }
    if (species === 'king') { k.leaderId=n.id; k.capitalId=s?.id||k.capitalId; }
    return n;
  };
  const spawnNpc = (species,count) => {
    const made=[];
    for(let i=0;i<count;i++) made.push(makeNpc(species));
    note(`${count} ${species}${count===1?'':'s'} spawned into the world.`);
    render();
  };
  const spawnResource = type => {
    state.worldGen = state.worldGen || {resources:[],biomes:[],landmarks:[]};
    const p=spawnPoint();
    state.worldGen.resources.push({id:uid('node'),type,x:p.x,y:p.y,amount:100,depleted:false,playerPlaced:true});
    note(`A ${type} resource node was created.`);
    render();
  };
  const spawnSettlement = () => {
    const p=spawnPoint(), k=ensureKingdom();
    const s={id:uid('settlement'),name:`New ${['Haven','Crossing','Hold','Village','Town'][Math.floor(Math.random()*5)]}`,type:'village',level:1,x:p.x,y:p.y,kingdomId:k.id,founderId:null,rulerId:null,age:0,homes:5,buildings:2,stability:78,wealth:150,influence:1,resources:{food:55,wood:50,stone:30,iron:8,gold:10,cloth:7,medicine:2,reagents:2,weapons:0,armor:0,tools:5},history:[`Year ${state.year||1}: player founded it.`]};
    state.settlements.push(s); note(`${s.name} was founded.`); render();
  };
  const spawnMeteor = () => {
    const p=spawnPoint();
    state.meteorImpacts=state.meteorImpacts||[];
    state.meteorImpacts.push({x:p.x,y:p.y,life:80});
    const victims=state.npcs.filter(n=>n.alive).sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y)).slice(0,4);
    victims.forEach(n=>{if(Math.hypot(n.x-p.x,n.y-p.y)<120)n.health=Math.max(0,(n.health||100)-80);if(n.health<=0)n.alive=false;});
    state.stability=Math.max(0,(state.stability||0)-8); note('A meteor was summoned onto the map.'); render();
  };

  const style=document.createElement('style');
  style.textContent=`#spawnDock{position:absolute;z-index:40;left:12px;bottom:86px;pointer-events:auto;font-family:monospace}#spawnToggle{font:inherit;font-weight:700;color:#f2f0dc;background:#3a4a43;border:2px solid #18231f;padding:8px 12px;box-shadow:3px 3px #18231f;cursor:pointer}#spawnMenu{display:none;margin-top:5px;width:230px;background:rgba(31,42,38,.98);border:2px solid #18231f;box-shadow:4px 4px #18231f;padding:7px}#spawnMenu.open{display:block}.spawn-title{font-size:10px;color:#e6c35d;margin-bottom:6px}.spawn-group{border-top:1px solid #4b5b53;padding-top:5px;margin-top:5px}.spawn-label{font-size:7px;color:#9eaaa0;margin-bottom:4px}.spawn-grid{display:grid;grid-template-columns:1fr 1fr;gap:4px}.spawn-grid button{font-size:8px;padding:6px 4px}.spawn-count{display:flex;gap:4px;margin-top:6px}.spawn-count button{flex:1;font-size:8px}.spawn-help{font-size:7px;color:#9eaaa0;margin-top:6px;line-height:1.3}@media(max-width:650px){#spawnDock{bottom:64px;left:8px}#spawnMenu{width:205px}}`;
  document.head.appendChild(style);

  const dock=document.createElement('div');dock.id='spawnDock';
  dock.innerHTML=`<button id="spawnToggle">🌍 SPAWN</button><div id="spawnMenu"><div class="spawn-title">GOD TOOLS • SPAWN</div><div class="spawn-group"><div class="spawn-label">PEOPLE</div><div class="spawn-grid"><button data-spawn="human">👤 Human</button><button data-spawn="dwarf">⛏ Dwarf</button><button data-spawn="elf">🧝 Elf</button><button data-spawn="orc">👹 Orc</button><button data-spawn="soldier">⚔ Soldier</button><button data-spawn="king">👑 King</button></div><div class="spawn-count"><button data-count="1">×1</button><button data-count="5">×5</button><button data-count="10">×10</button><button data-count="25">×25</button></div></div><div class="spawn-group"><div class="spawn-label">WORLD</div><div class="spawn-grid"><button data-resource="gold">💰 Gold</button><button data-resource="iron">⛏ Iron</button><button data-resource="food">🌾 Food</button><button data-resource="wood">🌲 Wood</button><button id="spawnSettlement">🏠 Settlement</button><button id="spawnMeteor">☄ Meteor</button></div></div><div class="spawn-help">Choose a person, then choose ×1/×5/×10/×25. Spawns appear around the current camera position.</div></div>`;
  document.body.appendChild(dock);

  let count=1;
  document.getElementById('spawnToggle').addEventListener('click',()=>document.getElementById('spawnMenu').classList.toggle('open'));
  dock.querySelectorAll('[data-count]').forEach(b=>b.addEventListener('click',()=>{count=Number(b.dataset.count);dock.querySelectorAll('[data-count]').forEach(x=>x.classList.toggle('primary',x===b));}));
  dock.querySelectorAll('[data-spawn]').forEach(b=>b.addEventListener('click',()=>spawnNpc(b.dataset.spawn,count)));
  dock.querySelectorAll('[data-resource]').forEach(b=>b.addEventListener('click',()=>spawnResource(b.dataset.resource)));
  document.getElementById('spawnSettlement').addEventListener('click',spawnSettlement);
  document.getElementById('spawnMeteor').addEventListener('click',spawnMeteor);
})();
