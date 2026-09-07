const NAMES = ['Ari','Bram','Cora','Dax','Elia','Faye','Gale','Hana','Ivo','Juno','Kian','Lena','Milo','Nia','Oren','Pia','Quill','Rhea','Sera','Tobin','Uma','Vale','Wren','Yara','Zane','Mara','Theo','Niko','Lumi','Cass'];
const TRAITS = ['brave','curious','ambitious','kind','greedy','loyal','stubborn','clever','reckless','calm'];
const JOBS = ['farmer','blacksmith','merchant','builder','fisher','scholar','guard','healer'];
const COLORS = ['#79c2ff','#ff9f7a','#a8e68a','#d7a7ff','#ffd66e','#ff8fc8'];

const state = {
  running:true, tick:0, year:1, day:1, hour:8, season:'Spring', weather:'Clear', speed:4,
  food:100, stability:82, war:false, plague:false, selected:null, godMode:false,
  showNames:true, showTrails:false, showGrid:false, feed:[], micro:[], factions:[], npcs:[], particles:[], trails:[], camera:{x:0,y:0,zoom:1}, dragging:false, dragStart:null
};

const canvas = document.getElementById('worldCanvas');
const ctx = canvas.getContext('2d');
const $ = id => document.getElementById(id);
const elements = {
  toggleSim:$('toggleSim'), speed:$('speed'), speedLabel:$('speedLabel'), year:$('year'), season:$('season'), population:$('population'),
  families:$('families'), settlements:$('settlements'), food:$('food'), stability:$('stability'), worldStatus:$('worldStatus'), worldStats:$('worldStats'),
  factionList:$('factionList'), eventFeed:$('eventFeed'), microLog:$('microLog'), inspectorContent:$('inspectorContent'), needsChart:$('needsChart'),
  selectedNeedMood:$('selectedNeedMood'), tickLabel:$('tickLabel'), selectionCard:$('selectionCard'), modeLabel:$('modeLabel')
};

const FACTION_NAMES = ['Sunreach','Ironvale','Moonmere','Oakshield','Raven Coast'];
const SETTLEMENTS = [
  {name:'Everglen',x:500,y:390,r:105,color:'#8fd694'},
  {name:'Ravenport',x:830,y:650,r:72,color:'#78b7df'},
  {name:'Ironhollow',x:250,y:720,r:66,color:'#d49b6b'}
];

function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function pick(a){return a[Math.floor(Math.random()*a.length)];}
function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}
function log(message){state.feed.unshift(`Year ${state.year}, Day ${state.day}: ${message}`);state.feed=state.feed.slice(0,12);elements.eventFeed.innerHTML=state.feed.map(x=>`<li>${x}</li>`).join('');}
function micro(message){state.micro.unshift(message);state.micro=state.micro.slice(0,6);elements.microLog.innerHTML=state.micro.map(x=>`<div>${x}</div>`).join('');}

function createFaction(name, color){return {id:crypto.randomUUID(),name,color,population:0,power:20+Math.random()*30,relations:{}};}
function createNpc(i, faction){
  const settlement=pick(SETTLEMENTS), trait=pick(TRAITS);
  const npc={id:i+1,name:NAMES[i%NAMES.length],age:18+Math.floor(Math.random()*38),sex:Math.random()>.5?'F':'M',trait,job:pick(JOBS),faction:faction.id,
    x:settlement.x+(Math.random()-.5)*settlement.r,y:settlement.y+(Math.random()-.5)*settlement.r,target:null,speed:.5+Math.random()*.8,
    mood:55+Math.random()*35,health:100,hunger:20+Math.random()*30,energy:70+Math.random()*30,wealth:20+Math.random()*100,
    goal:'Work',home:settlement.name,partner:null,friends:[],enemies:[],memories:[],children:0,alive:true,color:pick(COLORS),lastAction:'Wandering'};
  npc.target={x:settlement.x+(Math.random()-.5)*settlement.r,y:settlement.y+(Math.random()-.5)*settlement.r};
  return npc;
}

function reset(){
  state.tick=0;state.year=1;state.day=1;state.hour=8;state.season='Spring';state.weather='Clear';state.food=100;state.stability=82;state.war=false;state.plague=false;state.selected=null;
  state.factions=FACTION_NAMES.slice(0,3).map((n,i)=>createFaction(n,COLORS[i]));
  state.npcs=Array.from({length:48},(_,i)=>createNpc(i,state.factions[i%state.factions.length]));
  state.feed=[];state.micro=[];log('The first settlers awaken in Everglen.');log('Three factions emerge around the founding settlements.');renderAll();
}

function getFaction(id){return state.factions.find(f=>f.id===id);}
function nearestNpc(npc){let best=null,bd=Infinity;for(const other of state.npcs){if(other===npc||!other.alive)continue;const d=dist(npc,other);if(d<bd){bd=d;best=other;}}return best;}
function addMemory(npc,text){npc.memories.unshift({text,year:state.year});npc.memories=npc.memories.slice(0,8);}

function decide(npc){
  if(!npc.alive)return;
  if(state.plague && Math.random()<.01){npc.health-=4;npc.lastAction='Feverish';}
  if(npc.health<30){npc.goal='Seek healer';npc.target={x:500,y:390};return;}
  if(npc.hunger>75){npc.goal='Find food';npc.target={x:500+Math.random()*100-50,y:390+Math.random()*80-40};return;}
  if(state.war && Math.random()<.3){npc.goal='Defend faction';npc.target={x:500+Math.random()*400-200,y:520+Math.random()*300-150};return;}
  const hour=state.hour;
  if(hour<6||hour>=22){npc.goal='Sleep';npc.target={x:npc.x+(Math.random()-.5)*8,y:npc.y+(Math.random()-.5)*8};}
  else if(hour<9){npc.goal='Go to work';npc.target={x:500+Math.random()*500-250,y:500+Math.random()*250-125};}
  else if(hour<16){npc.goal=npc.job==='farmer'?'Farm':'Work';npc.target={x:500+Math.random()*500-250,y:500+Math.random()*250-125};}
  else if(hour<19){npc.goal=Math.random()<.45?'Socialize':'Shop';npc.target={x:500+Math.random()*160-80,y:390+Math.random()*120-60};}
  else {npc.goal='Visit friends';const other=nearestNpc(npc);npc.target=other?{x:other.x,y:other.y}:{x:npc.x,y:npc.y};}
}

function interact(npc){
  const other=nearestNpc(npc);if(!other||dist(npc,other)>35)return;
  if(npc.faction===other.faction && Math.random()<.08){
    if(!npc.friends.includes(other.id))npc.friends.push(other.id);
    if(!other.friends.includes(npc.id))other.friends.push(npc.id);
    npc.mood=clamp(npc.mood+3,0,100);addMemory(npc,`Talked with ${other.name}`);npc.lastAction=`Talked to ${other.name}`;
  } else if(npc.faction!==other.faction && state.war && Math.random()<.08){
    other.health-=8;npc.mood=clamp(npc.mood-2,0,100);addMemory(npc,`Fought ${other.name}`);addMemory(other,`Was attacked by ${npc.name}`);npc.lastAction=`Fought ${other.name}`;
    if(other.health<=0)killNpc(other,`${npc.name} in the border war`);
  }
}

function killNpc(npc,reason){if(!npc.alive)return;npc.alive=false;npc.health=0;log(`${npc.name} died at age ${npc.age} (${reason}).`);if(state.selected===npc.id)state.selected=null;}
function birth(parent){
  if(state.npcs.filter(n=>n.alive).length>140)return;
  const faction=getFaction(parent.faction), child=createNpc(state.npcs.length,faction);child.age=0;child.home=parent.home;child.x=parent.x;child.y=parent.y;child.job='none';child.goal='Grow up';child.mood=70;child.wealth=parent.wealth*.05;state.npcs.push(child);parent.children++;addMemory(parent,`A child named ${child.name} was born`);log(`${parent.name} welcomed a new child, ${child.name}.`);
}

function updateNpc(npc){
  if(!npc.alive)return;
  npc.age+=0.000015*state.speed;
  npc.hunger=clamp(npc.hunger+.04*state.speed,0,100);npc.energy=clamp(npc.energy-(state.hour>6&&state.hour<20?.035:.01)*state.speed,0,100);
  if(npc.goal==='Find food'){npc.hunger=clamp(npc.hunger-.8*state.speed,0,100);npc.wealth=Math.max(0,npc.wealth-.02*state.speed);}
  if(npc.goal==='Sleep')npc.energy=clamp(npc.energy+.5*state.speed,0,100);
  npc.mood=clamp(npc.mood+(npc.hunger<50?0.01:-.04)*state.speed,0,100);
  if(npc.target){const dx=npc.target.x-npc.x,dy=npc.target.y-npc.y,d=Math.hypot(dx,dy);if(d>5){npc.x+=dx/d*npc.speed*state.speed;npc.y+=dy/d*npc.speed*state.speed;}else decide(npc);}
  if(Math.random()<.008*state.speed)interact(npc);
  if(npc.age>85&&Math.random()<.0008*state.speed)killNpc(npc,'old age');
  if(npc.health<1)killNpc(npc,'illness');
}

function worldTick(){
  state.tick++;state.hour+=.12*state.speed;
  if(state.hour>=24){state.hour-=24;state.day++;if(state.day>30){state.day=1;state.year++;advanceSeason();yearEvent();}}
  state.food=clamp(state.food+(state.npcs.filter(n=>n.alive).length*.003)-.025*state.speed,0,100);
  if(state.food<20)state.stability=clamp(state.stability-.08*state.speed,0,100);else state.stability=clamp(state.stability+.015,0,100);
  if(state.plague&&Math.random()<.012*state.speed){const victims=state.npcs.filter(n=>n.alive&&Math.random()<.05);victims.forEach(n=>n.health-=10);}
  state.npcs.forEach(n=>{if(Math.random()<.025*state.speed)decide(n);updateNpc(n);});
  if(Math.random()<.003*state.speed){const adults=state.npcs.filter(n=>n.alive&&n.age>20&&n.age<42);if(adults.length)birth(pick(adults));}
  if(Math.random()<.006*state.speed)randomEvent();
  updateFactions();renderAll();
}
function advanceSeason(){state.season=state.year%4===1?'Spring':state.year%4===2?'Summer':state.year%4===3?'Autumn':'Winter';}
function yearEvent(){log(`Year ${state.year} begins. The world enters ${state.season}.`);if(state.year%5===0){state.factions.push(createFaction(pick(['Dawn Union','Freefolk','Ashen League']),pick(COLORS)));log('A new faction rises from the wilderness.');}}
function randomEvent(){const e=pick(['A merchant caravan arrives.','A strange friendship forms between rival factions.','A harvest festival brightens Everglen.','A young scholar discovers an old ruin.','A storm damages several homes.']);log(e);micro(e);}
function updateFactions(){state.factions.forEach(f=>f.population=state.npcs.filter(n=>n.alive&&n.faction===f.id).length);}

function triggerEvent(name){
  if(name==='reset'){reset();return;}
  if(name==='festival'){state.stability=clamp(state.stability+8,0,100);state.food=Math.max(0,state.food-6);log('Festival begins. Rivalries pause as the whole town gathers.');state.npcs.forEach(n=>n.mood=clamp(n.mood+12,0,100));}
  if(name==='storm'){state.weather='Storm';state.food=Math.max(0,state.food-10);state.stability=clamp(state.stability-4,0,100);log('A violent storm sweeps across Everglen.');}
  if(name==='plague'){state.plague=!state.plague;log(state.plague?'A mysterious plague begins spreading.':'Healers contain the plague.');}
  if(name==='war'){state.war=!state.war;state.stability=clamp(state.stability-(state.war?12:-0),0,100);log(state.war?'Two factions declare war over the northern border.':'The factions sign an uneasy peace.');}
  if(name==='meteor'){log('A meteor tears through the night sky and strikes the wilderness.');state.stability=clamp(state.stability-6,0,100);state.particles.push({x:850,y:180,life:1});}
  renderAll();
}

function resize(){const r=canvas.getBoundingClientRect(),d=devicePixelRatio||1;canvas.width=r.width*d;canvas.height=r.height*d;ctx.setTransform(d,0,0,d,0,0);}
function worldToScreen(x,y){return {x:(x-state.camera.x)*state.camera.zoom+canvas.clientWidth/2,y:(y-state.camera.y)*state.camera.zoom+canvas.clientHeight/2};}
function screenToWorld(x,y){return {x:(x-canvas.clientWidth/2)/state.camera.zoom+state.camera.x,y:(y-canvas.clientHeight/2)/state.camera.zoom+state.camera.y};}
function drawWorld(){
  const w=canvas.clientWidth,h=canvas.clientHeight;ctx.clearRect(0,0,w,h);ctx.fillStyle='#12261f';ctx.fillRect(0,0,w,h);
  const topLeft=screenToWorld(0,0),bottomRight=screenToWorld(w,h);
  ctx.save();ctx.scale(state.camera.zoom,state.camera.zoom);ctx.translate(w/(2*state.camera.zoom)-state.camera.x,h/(2*state.camera.zoom)-state.camera.y);
  if(state.showGrid){ctx.strokeStyle='rgba(255,255,255,.05)';ctx.lineWidth=1/state.camera.zoom;for(let x=Math.floor(topLeft.x/50)*50;x<bottomRight.x;x+=50){ctx.beginPath();ctx.moveTo(x,topLeft.y);ctx.lineTo(x,bottomRight.y);ctx.stroke();}for(let y=Math.floor(topLeft.y/50)*50;y<bottomRight.y;y+=50){ctx.beginPath();ctx.moveTo(topLeft.x,y);ctx.lineTo(bottomRight.x,y);ctx.stroke();}}
  // rivers and roads
  ctx.strokeStyle='#245e78';ctx.lineWidth=90;ctx.beginPath();ctx.moveTo(-200,160);ctx.bezierCurveTo(300,330,500,180,1150,450);ctx.stroke();
  ctx.strokeStyle='#765e49';ctx.lineWidth=16;ctx.beginPath();ctx.moveTo(0,430);ctx.lineTo(1100,430);ctx.moveTo(500,0);ctx.lineTo(500,950);ctx.stroke();
  SETTLEMENTS.forEach(s=>{ctx.fillStyle=s.color+'25';ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,Math.PI*2);ctx.fill();ctx.strokeStyle=s.color+'80';ctx.lineWidth=2;ctx.stroke();ctx.fillStyle='#dce8df';ctx.font='bold 16px Segoe UI';ctx.fillText(s.name,s.x-35,s.y-s.r-10);});
  state.npcs.filter(n=>n.alive).forEach(n=>{ctx.fillStyle=n.color;ctx.beginPath();ctx.arc(n.x,n.y,6,0,Math.PI*2);ctx.fill();if(n.id===state.selected){ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.beginPath();ctx.arc(n.x,n.y,11,0,Math.PI*2);ctx.stroke();}if(state.showNames){ctx.fillStyle='rgba(255,255,255,.78)';ctx.font='11px Segoe UI';ctx.fillText(n.name,n.x+9,n.y+3);}});
  ctx.restore();
}

function renderPanels(){
  const alive=state.npcs.filter(n=>n.alive),families=alive.filter(n=>n.partner).length/2;
  elements.year.textContent=state.year;elements.season.textContent=state.season;elements.population.textContent=alive.length;elements.families.textContent=Math.floor(families);elements.settlements.textContent=SETTLEMENTS.length;elements.food.textContent=Math.round(state.food)+'%';elements.stability.textContent=Math.round(state.stability)+'%';elements.tickLabel.textContent=`tick ${state.tick}`;
  elements.worldStatus.textContent=state.plague?'PLAGUE':state.war?'WAR':state.weather==='Storm'?'STORM':'Peaceful';
  elements.worldStats.innerHTML=`<div class="metric"><span>Weather</span><b>${state.weather}</b></div><div class="metric"><span>Time</span><b>${String(Math.floor(state.hour)).padStart(2,'0')}:${String(Math.floor(state.hour%1*60)).padStart(2,'0')}</b></div><div class="metric"><span>Dead</span><b>${state.npcs.filter(n=>!n.alive).length}</b></div><div class="metric"><span>Avg mood</span><b>${Math.round(alive.reduce((a,n)=>a+n.mood,0)/(alive.length||1))}%</b></div>`;
  elements.factionList.innerHTML=state.factions.map(f=>`<div class="faction"><i style="background:${f.color}"></i><span>${f.name}</span><b>${f.population}</b></div>`).join('');
  renderInspector();
}
function renderInspector(){
  const n=state.npcs.find(n=>n.id===state.selected&&n.alive);if(!n){elements.inspectorContent.innerHTML='<div class="empty-state">Select an NPC to inspect their life, memories, relationships, and current goal.</div>';elements.needsChart.innerHTML='';elements.selectedNeedMood.textContent='No selection';return;}
  const f=getFaction(n.faction);elements.inspectorContent.innerHTML=`<div class="person-head"><div class="portrait" style="background:${n.color}">${n.name[0]}</div><div><h3>${n.name}</h3><span>Age ${Math.floor(n.age)} · ${n.job} · ${f?.name||'Unknown'}</span></div></div><div class="goal">🎯 ${n.goal}</div><div class="bio-grid"><span>Trait<b>${n.trait}</b></span><span>Wealth<b>¤${Math.floor(n.wealth)}</b></span><span>Health<b>${Math.round(n.health)}%</b></span><span>Friends<b>${n.friends.length}</b></span><span>Children<b>${n.children}</b></span><span>Home<b>${n.home}</b></span></div><h4>Recent memories</h4><div class="memories">${n.memories.map(m=>`<div>Year ${m.year}: ${m.text}</div>`).join('')||'<div>No memories yet.</div>'}</div>`;
  elements.selectedNeedMood.textContent=`${n.name}: ${Math.round(n.mood)}% mood`;const needs=[['Hunger',100-n.hunger],['Energy',n.energy],['Health',n.health],['Mood',n.mood]];elements.needsChart.innerHTML=needs.map(([k,v])=>`<div class="need"><div><span>${k}</span><b>${Math.round(v)}%</b></div><div class="bar"><i style="width:${clamp(v,0,100)}%"></i></div></div>`).join('');
}
function renderAll(){drawWorld();renderPanels();}

function loop(){if(state.running){for(let i=0;i<state.speed;i++)worldTick();}else{drawWorld();renderPanels();}requestAnimationFrame(loop);}

$('toggleSim').onclick=()=>{state.running=!state.running;elements.toggleSim.textContent=state.running?'⏸ Pause':'▶ Resume';log(state.running?'Simulation resumed.':'Simulation paused.');};
$('speed').oninput=e=>{state.speed=+e.target.value;elements.speedLabel.textContent=`${state.speed}×`;};
$('godMode').onclick=()=>{state.godMode=!state.godMode;elements.modeLabel.textContent=state.godMode?'GOD MODE: click anywhere to cause an event':'Observer mode';};
$('toggleNames').onclick=()=>{state.showNames=!state.showNames;drawWorld();};
$('toggleTrails').onclick=()=>{state.showTrails=!state.showTrails;drawWorld();};
$('toggleGrid').onclick=()=>{state.showGrid=!state.showGrid;drawWorld();};
$('closeInspector').onclick=()=>{state.selected=null;renderPanels();};
$('foundFaction').onclick=()=>{const f=createFaction(pick(['Northwatch','Blue Banner','Free Cities','Ember Clan']),pick(COLORS));state.factions.push(f);log(`${f.name} declares independence and forms a new faction.`);renderPanels();};
document.querySelectorAll('[data-event]').forEach(b=>b.onclick=()=>triggerEvent(b.dataset.event));

canvas.addEventListener('click',e=>{if(state.dragging)return;const p=screenToWorld(e.offsetX,e.offsetY);let nearest=null,bd=20/state.camera.zoom;state.npcs.filter(n=>n.alive).forEach(n=>{const d=dist(n,p);if(d<bd){bd=d;nearest=n;}});if(nearest){state.selected=nearest.id;renderPanels();}else if(state.godMode){log('The gods intervene at the clicked location.');state.particles.push({x:p.x,y:p.y,life:1});state.stability=clamp(state.stability-2,0,100);}});
canvas.addEventListener('wheel',e=>{e.preventDefault();state.camera.zoom=clamp(state.camera.zoom*(e.deltaY<0?1.1:.9),.45,2.8);drawWorld();},{passive:false});
canvas.addEventListener('mousedown',e=>{state.dragging=false;state.dragStart={x:e.clientX,y:e.clientY,cx:state.camera.x,cy:state.camera.y};});
window.addEventListener('mousemove',e=>{if(!state.dragStart)return;const dx=e.clientX-state.dragStart.x,dy=e.clientY-state.dragStart.y;if(Math.hypot(dx,dy)>4)state.dragging=true;if(state.dragging){state.camera.x=state.dragStart.cx-dx/state.camera.zoom;state.camera.y=state.dragStart.cy-dy/state.camera.zoom;drawWorld();}});
window.addEventListener('mouseup',()=>state.dragStart=null);window.addEventListener('resize',()=>{resize();drawWorld();});

resize();reset();requestAnimationFrame(loop);
