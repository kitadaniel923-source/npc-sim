const names = [
  'Ari', 'Bram', 'Cora', 'Dax', 'Elia', 'Faye', 'Gale', 'Hana', 'Ivo', 'Juno',
  'Kian', 'Lena', 'Milo', 'Nia', 'Oren', 'Pia', 'Quill', 'Rhea', 'Sera', 'Tobin'
];

const townZones = {
  homes: { x: 110, y: 130, label: 'Homes' },
  market: { x: 430, y: 120, label: 'Market' },
  townhall: { x: 770, y: 140, label: 'Town Hall' },
  park: { x: 260, y: 430, label: 'Park' },
  workshop: { x: 115, y: 470, label: 'Workshop' },
  school: { x: 500, y: 455, label: 'School' },
  docks: { x: 760, y: 465, label: 'Docks' },
  square: { x: 470, y: 280, label: 'Square' },
};

const state = {
  running: true,
  clock: 8 * 60,
  weather: 'Clear',
  mood: 'Busy',
  event: 'None',
  tick: 0,
  feed: [],
  npcs: []
};

const elements = {
  clock: document.getElementById('clock'),
  weather: document.getElementById('weather'),
  mood: document.getElementById('mood'),
  population: document.getElementById('population'),
  npcSummary: document.getElementById('npcSummary'),
  eventFeed: document.getElementById('eventFeed'),
  npcLayer: document.getElementById('npcLayer'),
  toggleSim: document.getElementById('toggleSim')
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function makeNpc(index) {
  const zoneKeys = Object.keys(townZones);
  const homeZone = zoneKeys[index % zoneKeys.length];
  const workZone = zoneKeys[(index + 2) % zoneKeys.length];
  const home = { ...townZones[homeZone] };
  const work = { ...townZones[workZone] };

  return {
    id: index + 1,
    name: names[index % names.length],
    x: home.x + (Math.random() * 30 - 15),
    y: home.y + (Math.random() * 30 - 15),
    home,
    work,
    target: { x: home.x, y: home.y },
    state: 'home',
    speed: 0.35 + Math.random() * 0.55,
    drift: Math.random() * 100,
    mood: 'calm'
  };
}

function setFeed(message) {
  state.feed.unshift(message);
  state.feed = state.feed.slice(0, 8);
  elements.eventFeed.innerHTML = state.feed
    .map((entry) => `<li>${entry}</li>`)
    .join('');
}

function formatClock(minutes) {
  const hour = Math.floor(minutes / 60) % 24;
  const min = minutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function getRandomTarget() {
  const keys = Object.keys(townZones);
  const randomKey = keys[Math.floor(Math.random() * keys.length)];
  return { ...townZones[randomKey] };
}

function applyBehavior(npc) {
  const hour = state.clock / 60;
  const isFestival = state.event === 'festival';
  const isRainy = state.weather === 'Rain';
  const isOutage = state.event === 'outage';

  if (isFestival && npc.y < 500) {
    npc.state = 'market';
    npc.target = { x: townZones.market.x + 10, y: townZones.market.y + 15 };
    return;
  }

  if (hour < 7) {
    npc.state = 'rest';
    npc.target = { ...npc.home };
    return;
  }

  if (hour >= 7 && hour < 9) {
    npc.state = 'work';
    npc.target = { ...npc.work };
    return;
  }

  if (hour >= 9 && hour < 12) {
    if (isOutage) {
      npc.state = 'rest';
      npc.target = { ...npc.home };
      return;
    }
    npc.state = Math.random() > 0.6 ? 'market' : 'work';
    npc.target = Math.random() > 0.5 ? { ...npc.work } : { ...townZones.market };
    return;
  }

  if (hour >= 12 && hour < 16) {
    if (isRainy) {
      npc.state = 'home';
      npc.target = { ...npc.home };
      return;
    }
    npc.state = 'park';
    npc.target = { ...townZones.park };
    return;
  }

  if (hour >= 16 && hour < 19) {
    npc.state = 'market';
    npc.target = { ...townZones.market };
    return;
  }

  if (hour >= 19) {
    npc.state = 'rest';
    npc.target = { ...npc.home };
  }
}

function updateNpc(npc) {
  const target = npc.target;
  const dx = target.x - npc.x;
  const dy = target.y - npc.y;
  const dist = Math.hypot(dx, dy);

  if (dist > 6) {
    const step = npc.speed * 8;
    npc.x += (dx / dist) * step;
    npc.y += (dy / dist) * step;
  } else {
    const randomTarget = getRandomTarget();
    if (state.event === 'festival') {
      npc.target = { x: townZones.square.x + Math.random() * 60, y: townZones.square.y + Math.random() * 40 };
    } else if (state.weather === 'Rain') {
      npc.target = { ...npc.home };
    } else if (Math.random() > 0.75) {
      npc.target = { x: randomTarget.x + Math.random() * 40 - 20, y: randomTarget.y + Math.random() * 40 - 20 };
    } else {
      applyBehavior(npc);
    }
  }
}

function updatePanels() {
  elements.clock.textContent = formatClock(state.clock);
  elements.weather.textContent = state.weather;
  elements.mood.textContent = state.mood;
  elements.population.textContent = String(state.npcs.length);

  const counts = { home: 0, work: 0, market: 0, park: 0, rest: 0, event: 0 };
  state.npcs.forEach((npc) => {
    counts[npc.state] = (counts[npc.state] || 0) + 1;
  });

  const rows = [
    ['At home', counts.home],
    ['Working', counts.work],
    ['Shopping', counts.market],
    ['In park', counts.park],
    ['Resting', counts.rest],
    ['Events', counts.event]
  ];

  elements.npcSummary.innerHTML = rows
    .map(([label, value]) => `<div class="mini-item"><span>${label}</span><strong>${value}</strong></div>`)
    .join('');
}

function renderNpcs() {
  elements.npcLayer.innerHTML = state.npcs
    .map((npc) => {
      const className = `npc ${npc.state}`;
      const left = clamp(npc.x, 12, 860);
      const top = clamp(npc.y, 12, 620);
      return `<div class="${className}" data-name="${npc.name}" style="left:${left}px; top:${top}px"></div>`;
    })
    .join('');
}

function updateWorld() {
  state.clock = (state.clock + 10) % (24 * 60);
  const hour = state.clock / 60;

  if (hour >= 6 && hour < 10) {
    state.mood = 'Dawn hustle';
    state.weather = 'Clear';
  } else if (hour >= 10 && hour < 16) {
    state.mood = 'Busy';
    state.weather = state.event === 'rain' ? 'Rain' : 'Clear';
  } else if (hour >= 16 && hour < 20) {
    state.mood = state.event === 'festival' ? 'Festival energy' : 'Evening flow';
    state.weather = state.event === 'rain' ? 'Rain' : 'Clear';
  } else {
    state.mood = 'Quiet';
    state.weather = state.event === 'rain' ? 'Rain' : 'Moonlit';
  }

  if (state.event === 'festival' && Math.random() > 0.35) {
    state.mood = 'Festival energy';
  }

  if (state.event === 'outage') {
    state.mood = 'Darkened streets';
  }

  state.npcs.forEach((npc) => {
    applyBehavior(npc);
    updateNpc(npc);
  });

  updatePanels();
  renderNpcs();
}

function resetSimulation() {
  state.clock = 8 * 60;
  state.weather = 'Clear';
  state.mood = 'Busy';
  state.event = 'None';
  state.npcs = Array.from({ length: 18 }, (_, index) => makeNpc(index));
  setFeed('Town life reset to a calm morning rhythm.');
  updatePanels();
  renderNpcs();
}

function triggerEvent(eventName) {
  state.event = eventName;
  if (eventName === 'festival') {
    state.weather = 'Warm sun';
    state.mood = 'Festival energy';
    setFeed('The Lantern Festival kicks off with music and lanterns across the square.');
  } else if (eventName === 'rain') {
    state.weather = 'Rain';
    state.mood = 'Gentle drizzle';
    setFeed('A cool rainfront rolls in and the town slows to a calm pace.');
  } else if (eventName === 'market') {
    state.weather = 'Clear';
    state.mood = 'Market Rush';
    setFeed('A morning market rush fills the square with fresh bargaining and chatter.');
  } else if (eventName === 'outage') {
    state.weather = 'Dim glow';
    state.mood = 'Darkened streets';
    setFeed('A power outage dims the avenue and sends townsfolk back home early.');
  } else if (eventName === 'reset') {
    resetSimulation();
    return;
  }

  updatePanels();
  renderNpcs();
}

function initControls() {
  document.getElementById('toggleSim').addEventListener('click', () => {
    state.running = !state.running;
    elements.toggleSim.textContent = state.running ? 'Pause Simulation' : 'Resume Simulation';
    setFeed(state.running ? 'Simulation resumed.' : 'Simulation paused.');
  });

  document.querySelectorAll('[data-event]').forEach((button) => {
    button.addEventListener('click', () => triggerEvent(button.dataset.event));
  });
}

function start() {
  initControls();
  resetSimulation();
  setInterval(() => {
    if (state.running) {
      updateWorld();
    }
  }, 700);
}

start();
