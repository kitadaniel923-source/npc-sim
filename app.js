const NAMES = ['Ari','Bram','Cora','Dax','Elia','Faye','Gale','Hana','Ivo','Juno','Kian','Lena','Milo','Nia','Oren','Pia','Quill','Rhea','Sera','Tobin','Uma','Vale','Wren','Yara','Zane','Mara','Theo','Niko','Lumi','Cass'];
const TRAITS = ['brave','curious','ambitious','kind','greedy','loyal','stubborn','clever','reckless','calm'];
const JOBS = ['farmer','builder','merchant','blacksmith','fisher','scholar','guard','healer'];
const COLORS = ['#79c2ff','#ff9f7a','#a8e68a','#d7a7ff','#ffd66e','#ff8fc8'];

const state = {
  running: true, tick: 0, year: 1, day: 1, hour: 8, season: 'Spring', weather: 'Clear', speed: 4,
  food: 72, stability: 82, war: false, plague: false, godMode: false,
  showNames: true, showTrails: false, showGrid: false, selected: null,
  feed: [], micro: [], factions: [], npcs: [], settlements: [], particles: [],
  camera: { x: 0, y: 0, zoom: 1 }, dragging: false, dragStart: null
};

const canvas = document.getElementById('worldCanvas');
const ctx = canvas.getContext('2d');
const $ = id => document.getElementById(id);
const elements = {
  toggleSim: $('toggleSim'), speed: $('speed'), speedLabel: $('speedLabel'), year: $('year'), season: $('season'), population: $('population'),
  families: $('families'), settlements: $('settlements'), food: $('food'), stability: $('stability'), worldStatus: $('worldStatus'), worldStats: $('worldStats'),
  factionList: $('factionList'), eventFeed: $('eventFeed'), microLog: $('microLog'), inspectorContent: $('inspectorContent'), needsChart: $('needsChart'),
  selectedNeedMood: $('selectedNeedMood'), tickLabel: $('tickLabel'), modeLabel: $('modeLabel')
};

const settlementRules = {
  village: { minPopulation: 8, minAdults: 5, minFood: 35, minHomes: 5 },
  city: { minPopulation: 30, minAdults: 18, minFood: 60, minHomes: 15, minBuildings: 6, minAge: 4 },
  kingdom: { minPopulation: 120, minAdults: 70, minFood: 75, minHomes: 50, minBuildings: 20, minMilitary: 15, minStability: 65, minSettlements: 2 }
};

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function aliveNpcs() { return state.npcs.filter(n => n.alive); }
function factionOf(npc) { return state.factions.find(f => f.id === npc.faction); }
function settlementOf(name) { return state.settlements.find(s => s.name === name); }

function log(message) {
  state.feed.unshift(`Year ${state.year}, Day ${state.day}: ${message}`);
  state.feed = state.feed.slice(0, 14);
  elements.eventFeed.innerHTML = state.feed.map(x => `<li>${x}</li>`).join('');
}
function micro(message) {
  state.micro.unshift(message);
  state.micro = state.micro.slice(0, 7);
  elements.microLog.innerHTML = state.micro.map(x => `<div>${x}</div>`).join('');
}
function addMemory(npc, text) {
  npc.memories.unshift({ text, year: state.year });
  npc.memories = npc.memories.slice(0, 8);
}

function createFaction(name, color) {
  return { id: crypto.randomUUID(), name, color, population: 0, power: 30 + Math.random() * 30, relations: {}, leader: null };
}

function createNpc(i, factionId, home = null) {
  const spawn = home || { x: Math.random() * 1100 - 550, y: Math.random() * 800 - 400 };
  const npc = {
    id: i + 1,
    name: NAMES[i % NAMES.length] + (i >= NAMES.length ? ` ${Math.floor(i / NAMES.length) + 1}` : ''),
    age: 18 + Math.floor(Math.random() * 38), sex: Math.random() > .5 ? 'F' : 'M',
    trait: pick(TRAITS), job: pick(JOBS), faction: factionId,
    x: spawn.x + (Math.random() - .5) * 50, y: spawn.y + (Math.random() - .5) * 50,
    target: null, speed: .35 + Math.random() * .6,
    mood: 55 + Math.random() * 35, health: 100, hunger: 20 + Math.random() * 25, energy: 70 + Math.random() * 30,
    wealth: 20 + Math.random() * 100, goal: 'Explore', home: null, partner: null,
    friends: [], enemies: [], memories: [], children: 0, alive: true, color: pick(COLORS), lastAction: 'Wandering', founder: false
  };
  npc.target = { x: npc.x, y: npc.y };
  return npc;
}

function makeSettlement(foundingNpc) {
  const name = `${foundingNpc.name}'s Haven`;
  const settlement = {
    id: crypto.randomUUID(), name, type: 'village', level: 1,
    x: foundingNpc.x, y: foundingNpc.y, radius: 70, color: foundingNpc.color,
    founderId: foundingNpc.id, rulerId: foundingNpc.id, age: 0,
    homes: 2, buildings: 1, food: 55, wealth: 80, military: 0, stability: 74,
    culture: 'Founders', history: [`Year ${state.year}: founded by ${foundingNpc.name}.`]
  };
  state.settlements.push(settlement);
  foundingNpc.founder = true;
  foundingNpc.home = settlement.name;
  addMemory(foundingNpc, `Founded the village of ${settlement.name}`);
  log(`${foundingNpc.name} founded the village of ${settlement.name}.`);
  micro(`FOUNDING: ${settlement.name} created by ${foundingNpc.name}`);
  return settlement;
}

function placeInitialNomads() {
  state.factions = [createFaction('Freefolk', '#86d79d')];
  state.npcs = Array.from({ length: 48 }, (_, i) => createNpc(i, state.factions[0].id));
  const founder = state.npcs[0];
  founder.trait = 'ambitious'; founder.job = 'builder'; founder.goal = 'Find settlers'; founder.x = 0; founder.y = 0; founder.wealth = 120;
  addMemory(founder, 'Awoke beneath the open sky with a desire to build something permanent.');
}

function countSettlementPeople(s) { return aliveNpcs().filter(n => n.home === s.name); }
function countAdults(s) { return countSettlementPeople(s).filter(n => n.age >= 18); }
function countBuildings(s) { return s.buildings; }

function assignSettlementPeople() {
  state.npcs.filter(n => n.alive && !n.home).forEach(n => {
    const nearest = state.settlements.slice().sort((a, b) => dist(n, a) - dist(n, b))[0];
    if (nearest && dist(n, nearest) < nearest.radius * 1.4) n.home = nearest.name;
  });
}

function foundVillageIfReady() {
  if (state.settlements.length) return;
  const founder = state.npcs[0];
  if (!founder || !founder.alive) return;
  const nearby = aliveNpcs().filter(n => dist(n, founder) < 105);
  const adults = nearby.filter(n => n.age >= 18).length;
  const foodReady = state.food >= settlementRules.village.minFood;
  const ready = nearby.length >= settlementRules.village.minPopulation && adults >= settlementRules.village.minAdults && foodReady && (founder.trait === 'ambitious' || founder.trait === 'builder' || founder.wealth >= 80);
  if (ready) {
    const s = makeSettlement(founder);
    nearby.forEach(n => { n.home = s.name; n.goal = 'Build the village'; n.target = { x: s.x + (Math.random() - .5) * 80, y: s.y + (Math.random() - .5) * 80 }; });
  }
}

function villageProgress(s) {
  const people = countSettlementPeople(s), adults = people.filter(n => n.age >= 18);
  s.homes = Math.max(s.homes, Math.floor(people.length / 2));
  s.buildings = Math.max(s.buildings, 1 + Math.floor(s.homes / 2));
  s.food = clamp(s.food + people.filter(n => n.job === 'farmer').length * 0.01 - people.length * 0.002 * state.speed, 0, 100);
  s.wealth += people.filter(n => ['merchant', 'blacksmith'].includes(n.job)).length * 0.01 * state.speed;
  s.stability = clamp(s.stability + (s.food > 40 ? .01 : -.04), 0, 100);
  if (people.length >= 8) s.age += 0.002 * state.speed;
  return { population: people.length, adults: adults.length };
}

function tryUpgradeVillage(s) {
  if (s.type !== 'village') return;
  const p = villageProgress(s);
  const r = settlementRules.city;
  if (p.population >= r.minPopulation && p.adults >= r.minAdults && s.food >= r.minFood && s.homes >= r.minHomes && s.buildings >= r.minBuildings && s.age >= r.minAge) {
    s.type = 'city'; s.level = 2; s.radius = 125; s.history.push(`Year ${state.year}: ${s.name} became a city.`);
    log(`${s.name} grew from village into a CITY after meeting its population and infrastructure requirements.`);
    micro(`UPGRADE: ${s.name} → CITY`);
    const leader = state.npcs.find(n => n.id === s.rulerId);
    if (leader) { leader.goal = 'Govern the city'; addMemory(leader, `Watched ${s.name} become a city.`); }
  }
}

function tryCreateSecondSettlement(s) {
  if (s.type !== 'city') return;
  if (state.settlements.length >= 2) return;
  const people = countSettlementPeople(s);
  if (people.length < 55 || Math.random() > 0.01 * state.speed) return;
  const pioneer = people.find(n => n.id !== s.rulerId && n.trait === 'ambitious') || pick(people);
  if (!pioneer) return;
  const name = `${pioneer.name}'s Reach`;
  const newS = {
    id: crypto.randomUUID(), name, type: 'village', level: 1,
    x: s.x + 240, y: s.y + 150, radius: 65, color: pioneer.color,
    founderId: pioneer.id, rulerId: pioneer.id, age: 0, homes: 2, buildings: 1,
    food: 40, wealth: 50, military: 0, stability: 70, culture: s.culture, history: [`Year ${state.year}: founded by ${pioneer.name}, a citizen of ${s.name}.`]
  };
  state.settlements.push(newS); pioneer.home = newS.name; pioneer.x = newS.x; pioneer.y = newS.y; pioneer.founder = true;
  addMemory(pioneer, `Founded the settlement of ${newS.name} after leaving ${s.name}.`);
  log(`${pioneer.name} founded a new settlement, ${newS.name}, expanding the civilization.`);
}

function tryUpgradeToKingdom(s) {
  if (s.type !== 'city') return;
  const people = countSettlementPeople(s), adults = people.filter(n => n.age >= 18);
  const totalPeople = aliveNpcs().length;
  const totalSettlements = state.settlements.length;
  const r = settlementRules.kingdom;
  s.military = Math.floor(people.filter(n => n.job === 'guard').length * 3 + Math.max(0, people.length - 80) * .12);
  const leader = state.npcs.find(n => n.id === s.rulerId) || people[0];
  const leaderEligible = leader && ['ambitious', 'brave', 'clever'].includes(leader.trait);
  const ready = people.length >= r.minPopulation && adults.length >= r.minAdults && s.food >= r.minFood && s.homes >= r.minHomes && s.buildings >= r.minBuildings && s.military >= r.minMilitary && s.stability >= r.minStability && totalSettlements >= r.minSettlements && totalPeople >= r.minPopulation && leaderEligible;
  if (ready) {
    s.type = 'kingdom'; s.level = 3; s.radius = 190; s.color = '#f5d17b';
    s.history.push(`Year ${state.year}: ${s.name} became a kingdom under ${leader.name}.`);
    const faction = factionOf(leader);
    faction.name = `${s.name} Kingdom`; faction.leader = leader.id; faction.power += 40;
    people.forEach(n => n.faction = faction.id);
    leader.goal = 'Rule the kingdom'; leader.lastAction = 'Crowned ruler'; addMemory(leader, `Crowned ruler of the Kingdom of ${s.name}.`);
    log(`${s.name} has become a KINGDOM. ${leader.name} is recognized as its ruler.`);
    micro(`ASCENSION: ${s.name} → KINGDOM`);
  }
}

function birth(parent) {
  if (aliveNpcs().length >= 230) return;
  const mates = aliveNpcs().filter(n => n.home === parent.home && n.sex !== parent.sex && n.age >= 20 && n.age <= 42 && n.id !== parent.id);
  const mate = mates[0];
  if (!mate || Math.random() > .01 * state.speed) return;
  const faction = factionOf(parent);
  const child = createNpc(state.npcs.length, faction.id, settlementOf(parent.home));
  child.age = 0; child.home = parent.home; child.x = parent.x; child.y = parent.y; child.job = 'none'; child.goal = 'Grow up'; child.wealth = 5;
  child.trait = Math.random() < .5 ? parent.trait : mate.trait;
  state.npcs.push(child); parent.children++; mate.children++;
  addMemory(parent, `A child named ${child.name} was born.`); addMemory(mate, `A child named ${child.name} was born.`);
  if (Math.random() < .15) log(`${parent.name} and ${mate.name} welcomed ${child.name}.`);
}

function maybeDie(npc) {
  if (npc.age > 90 && Math.random() < .0015 * state.speed) return killNpc(npc, 'old age');
  if (npc.health < 1) return killNpc(npc, 'illness');
  if (state.plague && Math.random() < .0005 * state.speed && npc.health < 25) return killNpc(npc, 'the plague');
}

function killNpc(npc, reason) {
  if (!npc.alive) return;
  npc.alive = false;
  npc.health = 0;
  log(`${npc.name} died at age ${Math.floor(npc.age)} (${reason}).`);
  if (state.selected === npc.id) state.selected = null;
}

function decide(npc) {
  if (!npc.alive) return;
  const home = settlementOf(npc.home);
  if (npc.age < 6) { npc.goal = 'Grow up'; npc.target = home ? { x: home.x, y: home.y } : { x: npc.x, y: npc.y }; return; }
  if (npc.health < 30) { npc.goal = 'Seek healer'; npc.target = home ? { x: home.x, y: home.y } : { x: npc.x, y: npc.y }; return; }
  if (npc.hunger > 75) { npc.goal = 'Find food'; npc.target = home ? { x: home.x, y: home.y } : { x: npc.x, y: npc.y }; return; }
  if (npc.founder && !home) { npc.goal = 'Find a place to settle'; }
  if (home && home.type === 'kingdom' && npc.trait === 'ambitious' && Math.random() < .001 * state.speed) { npc.goal = 'Seek power'; }
  const hour = state.hour;
  if (hour < 6 || hour >= 22) { npc.goal = 'Sleep'; npc.target = { x: npc.x, y: npc.y }; }
  else if (hour < 9) { npc.goal = 'Go to work'; npc.target = home ? { x: home.x + Math.random() * 100 - 50, y: home.y + Math.random() * 100 - 50 } : npc.target; }
  else if (hour < 16) { npc.goal = npc.job === 'farmer' ? 'Farm' : 'Work'; npc.target = home ? { x: home.x + Math.random() * 120 - 60, y: home.y + Math.random() * 120 - 60 } : npc.target; }
  else if (hour < 19) { npc.goal = Math.random() < .5 ? 'Socialize' : 'Trade'; npc.target = home ? { x: home.x + Math.random() * 100 - 50, y: home.y + Math.random() * 100 - 50 } : npc.target; }
  else { npc.goal = 'Visit family'; npc.target = home ? { x: home.x, y: home.y } : npc.target; }
}

function updateNpc(npc) {
  if (!npc.alive) return;
  npc.age += 0.00001 * state.speed;
  npc.hunger = clamp(npc.hunger + .035 * state.speed, 0, 100);
  npc.energy = clamp(npc.energy - (state.hour > 7 && state.hour < 20 ? .03 : .006) * state.speed, 0, 100);
  if (npc.goal === 'Find food' || npc.goal === 'Farm') npc.hunger = clamp(npc.hunger - .5 * state.speed, 0, 100);
  if (npc.goal === 'Sleep') npc.energy = clamp(npc.energy + .55 * state.speed, 0, 100);
  if (npc.goal === 'Work') npc.wealth += .012 * state.speed;
  npc.mood = clamp(npc.mood + (npc.hunger < 60 ? .01 : -.05) * state.speed, 0, 100);
  if (npc.target) {
    const dx = npc.target.x - npc.x, dy = npc.target.y - npc.y, d = Math.hypot(dx, dy);
    if (d > 5) { npc.x += dx / d * npc.speed * state.speed; npc.y += dy / d * npc.speed * state.speed; }
    else if (Math.random() < .08) decide(npc);
  }
  if (Math.random() < .004 * state.speed) birth(npc);
  maybeDie(npc);
}

function worldTick() {
  state.tick++;
  state.hour += .18 * state.speed;
  if (state.hour >= 24) { state.hour -= 24; state.day++; }
  if (state.day > 30) { state.day = 1; state.year++; advanceSeason(); log(`Year ${state.year} begins. ${state.season} arrives.`); }

  if (state.plague) state.weather = 'Plague haze';
  else if (state.weather === 'Storm' && Math.random() < .03) state.weather = 'Clear';

  state.food = clamp(state.food + aliveNpcs().filter(n => n.job === 'farmer').length * .006 - aliveNpcs().length * .0015 * state.speed, 0, 100);
  state.stability = clamp(state.stability + (state.food > 35 ? .012 : -.07) * state.speed, 0, 100);

  foundVillageIfReady();
  assignSettlementPeople();
  state.settlements.forEach(s => { villageProgress(s); tryUpgradeVillage(s); tryCreateSecondSettlement(s); tryUpgradeToKingdom(s); });
  state.npcs.forEach(n => { if (Math.random() < .025 * state.speed) decide(n); updateNpc(n); });
  updateFactions();
  renderAll();
}

function advanceSeason() {
  state.season = ['Spring', 'Summer', 'Autumn', 'Winter'][(state.year - 1) % 4];
  if (state.season === 'Winter') state.food = clamp(state.food - 8, 0, 100);
}

function updateFactions() {
  state.factions.forEach(f => {
    f.population = aliveNpcs().filter(n => n.faction === f.id).length;
    f.power = clamp(20 + f.population * .45, 0, 100);
  });
}

function triggerEvent(name) {
  if (name === 'reset') { reset(); return; }
  if (name === 'festival') { state.stability = clamp(state.stability + 8, 0, 100); state.food = clamp(state.food - 5, 0, 100); aliveNpcs().forEach(n => n.mood = clamp(n.mood + 10, 0, 100)); log('A great festival draws the population together.'); }
  if (name === 'storm') { state.weather = 'Storm'; state.food = clamp(state.food - 12, 0, 100); state.stability = clamp(state.stability - 5, 0, 100); log('A major storm sweeps over the settlements.'); }
  if (name === 'plague') { state.plague = !state.plague; log(state.plague ? 'A dangerous plague begins spreading.' : 'The plague has been contained.'); }
  if (name === 'war') { state.war = !state.war; state.stability = clamp(state.stability + (state.war ? -15 : 8), 0, 100); log(state.war ? 'Factions declare war over a disputed frontier.' : 'The factions agree to an uneasy peace.'); }
  if (name === 'meteor') { state.food = clamp(state.food - 5, 0, 100); state.stability = clamp(state.stability - 6, 0, 100); state.particles.push({ x: 400, y: -300, life: 1 }); log('A meteor strikes the wilderness. The population watches in horror.'); }
  renderAll();
}

function renderAll() {
  renderPanels(); drawWorld(); renderInspector();
}

function renderPanels() {
  const alive = aliveNpcs();
  elements.year.textContent = state.year; elements.season.textContent = state.season;
  elements.population.textContent = alive.length; elements.families.textContent = alive.filter(n => n.children > 0).length;
  elements.settlements.textContent = state.settlements.length; elements.food.textContent = `${Math.round(state.food)}%`; elements.stability.textContent = `${Math.round(state.stability)}%`;
  elements.tickLabel.textContent = `tick ${state.tick}`; elements.speedLabel.textContent = `${state.speed}×`;
  elements.worldStatus.textContent = state.war ? 'War' : state.plague ? 'Crisis' : 'Peaceful';
  elements.worldStats.innerHTML = state.settlements.length ? state.settlements.map(s => {
    const people = countSettlementPeople(s); const req = s.type === 'village' ? settlementRules.city : settlementRules.kingdom;
    return `<div class="metric"><span>${s.type.toUpperCase()} · ${s.name}</span><b>${people.length} pop · ${s.homes} homes</b></div>`;
  }).join('') : '<div class="empty-state">The world has no settlements yet. The first founder must gather settlers and create one.</div>';
  elements.factionList.innerHTML = state.factions.map(f => `<div class="faction"><i style="background:${f.color}"></i><span>${f.name}</span><b>${f.population}</b></div>`).join('');
}

function renderInspector() {
  const npc = state.npcs.find(n => n.id === state.selected && n.alive);
  if (!npc) {
    elements.inspectorContent.innerHTML = '<div class="empty-state">Select an NPC to inspect their life, memories, relationships, and current goal.</div>';
    elements.selectedNeedMood.textContent = 'No selection';
    elements.needsChart.innerHTML = '';
    return;
  }
  const f = factionOf(npc); const s = settlementOf(npc.home);
  elements.inspectorContent.innerHTML = `<div class="person-head"><div class="portrait" style="background:${npc.color}">${npc.name[0]}</div><div><h3>${npc.name}</h3><span>${Math.floor(npc.age)} years · ${npc.job} · ${f ? f.name : 'Independent'}</span></div></div>
    <div class="goal"><strong>Current goal:</strong> ${npc.goal}</div>
    <div class="bio-grid"><span>Home<b>${s ? s.name : 'Nomad'}</b></span><span>Trait<b>${npc.trait}</b></span><span>Wealth<b>${Math.floor(npc.wealth)}</b></span><span>Children<b>${npc.children}</b></span></div>
    <h4>Memories</h4><div class="memories">${(npc.memories.length ? npc.memories : [{text:'No major memories yet.',year:state.year}]).map(m => `<div>Y${m.year} · ${m.text}</div>`).join('')}</div>`;
  elements.selectedNeedMood.textContent = `${Math.round(npc.mood)} mood`;
  const needs = [['Hunger', 100 - npc.hunger], ['Energy', npc.energy], ['Health', npc.health], ['Mood', npc.mood]];
  elements.needsChart.innerHTML = needs.map(([name, value]) => `<div class="need"><div><span>${name}</span><b>${Math.round(value)}%</b></div><div class="bar"><i style="width:${clamp(value,0,100)}%"></i></div></div>`).join('');
}

function resize() {
  const r = canvas.getBoundingClientRect(), d = window.devicePixelRatio || 1;
  canvas.width = Math.floor(r.width * d); canvas.height = Math.floor(r.height * d); ctx.setTransform(d, 0, 0, d, 0, 0);
}
function screenToWorld(x, y) { return { x: (x - canvas.clientWidth / 2) / state.camera.zoom + state.camera.x, y: (y - canvas.clientHeight / 2) / state.camera.zoom + state.camera.y }; }
function worldToScreen(x, y) { return { x: (x - state.camera.x) * state.camera.zoom + canvas.clientWidth / 2, y: (y - state.camera.y) * state.camera.zoom + canvas.clientHeight / 2 }; }

function drawWorld() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  ctx.clearRect(0, 0, w, h); ctx.fillStyle = '#10251d'; ctx.fillRect(0, 0, w, h);
  const grid = 60 * state.camera.zoom;
  if (state.showGrid) { ctx.strokeStyle = 'rgba(255,255,255,.055)'; ctx.lineWidth = 1; for (let x = (w / 2 - state.camera.x * state.camera.zoom) % grid; x < w; x += grid) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); } for (let y = (h / 2 - state.camera.y * state.camera.zoom) % grid; y < h; y += grid) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); } }
  state.settlements.forEach(s => {
    const p = worldToScreen(s.x, s.y), r = s.radius * state.camera.zoom;
    ctx.fillStyle = s.type === 'kingdom' ? 'rgba(245,209,123,.13)' : s.type === 'city' ? 'rgba(121,194,255,.13)' : 'rgba(143,214,148,.12)';
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = s.color + '88'; ctx.lineWidth = s.type === 'kingdom' ? 3 : 2; ctx.stroke();
    ctx.fillStyle = '#eef7f1'; ctx.font = `600 ${Math.max(10, 13 * state.camera.zoom)}px Segoe UI`; ctx.fillText(`${s.type.toUpperCase()} · ${s.name}`, p.x - r * .65, p.y - r - 10);
    if (s.type === 'city' || s.type === 'kingdom') { for (let i = 0; i < Math.min(18, s.buildings); i++) { const a = i * .77, rr = Math.min(r * .65, 90); const bx = p.x + Math.cos(a) * rr, by = p.y + Math.sin(a) * rr; ctx.fillStyle = s.type === 'kingdom' ? '#f5d17b' : '#8ab8d4'; ctx.fillRect(bx - 4, by - 4, 8, 8); } }
  });
  aliveNpcs().forEach(n => {
    const p = worldToScreen(n.x, n.y), size = n.id === state.selected ? 9 : 6;
    ctx.fillStyle = n.color; ctx.beginPath(); ctx.arc(p.x, p.y, size, 0, Math.PI * 2); ctx.fill();
    if (n.id === state.selected) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, 13, 0, Math.PI * 2); ctx.stroke(); }
    if (state.showNames && state.camera.zoom > .75) { ctx.fillStyle = 'rgba(255,255,255,.78)'; ctx.font = '10px Segoe UI'; ctx.fillText(n.name, p.x + 8, p.y + 3); }
  });
}

function reset() {
  state.tick = 0; state.year = 1; state.day = 1; state.hour = 8; state.season = 'Spring'; state.weather = 'Clear'; state.food = 72; state.stability = 82; state.war = false; state.plague = false; state.selected = null; state.settlements = []; state.feed = []; state.micro = []; state.particles = [];
  placeInitialNomads(); log('A new world begins. There are no cities, no kingdoms, and no borders.'); log('One ambitious NPC, Ari, will attempt to gather settlers and found the first village.'); renderAll();
}

function setupControls() {
  elements.toggleSim.addEventListener('click', () => { state.running = !state.running; elements.toggleSim.textContent = state.running ? '⏸ Pause' : '▶ Resume'; });
  elements.speed.addEventListener('input', e => { state.speed = Number(e.target.value); elements.speedLabel.textContent = `${state.speed}×`; });
  document.querySelectorAll('[data-event]').forEach(btn => btn.addEventListener('click', () => triggerEvent(btn.dataset.event)));
  $('toggleNames')?.addEventListener('click', () => { state.showNames = !state.showNames; renderAll(); });
  $('toggleTrails')?.addEventListener('click', () => { state.showTrails = !state.showTrails; renderAll(); });
  $('toggleGrid')?.addEventListener('click', () => { state.showGrid = !state.showGrid; renderAll(); });
  $('godMode')?.addEventListener('click', () => { state.godMode = !state.godMode; elements.modeLabel.textContent = state.godMode ? 'GOD MODE · experimental' : 'Observer mode'; });
  $('foundFaction')?.addEventListener('click', () => { const leader = aliveNpcs().find(n => n.trait === 'ambitious'); if (!leader) return; const f = createFaction(`${leader.name}'s Circle`, pick(COLORS)); f.leader = leader.id; state.factions.push(f); leader.faction = f.id; log(`${leader.name} gathered followers and founded a new faction.`); renderAll(); });
  $('closeInspector')?.addEventListener('click', () => { state.selected = null; renderAll(); });
  canvas.addEventListener('click', e => {
    if (state.dragging) return;
    const rect = canvas.getBoundingClientRect(), m = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
    let closest = null, best = 16 / state.camera.zoom;
    aliveNpcs().forEach(n => { const d = Math.hypot(n.x - m.x, n.y - m.y); if (d < best) { best = d; closest = n; } });
    state.selected = closest ? closest.id : null; renderAll();
  });
  canvas.addEventListener('wheel', e => { e.preventDefault(); state.camera.zoom = clamp(state.camera.zoom * (e.deltaY > 0 ? .9 : 1.1), .5, 2.5); renderAll(); }, { passive: false });
  canvas.addEventListener('mousedown', e => { state.dragging = false; state.dragStart = { x: e.clientX, y: e.clientY, cx: state.camera.x, cy: state.camera.y }; });
  window.addEventListener('mousemove', e => { if (!state.dragStart) return; const dx = e.clientX - state.dragStart.x, dy = e.clientY - state.dragStart.y; if (Math.abs(dx) + Math.abs(dy) > 5) state.dragging = true; state.camera.x = state.dragStart.cx - dx / state.camera.zoom; state.camera.y = state.dragStart.cy - dy / state.camera.zoom; if (state.dragging) renderAll(); });
  window.addEventListener('mouseup', () => { state.dragStart = null; });
  window.addEventListener('resize', () => { resize(); renderAll(); });
}

resize(); setupControls(); reset();
setInterval(() => { if (state.running) worldTick(); }, 140);
