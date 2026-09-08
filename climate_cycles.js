// Everglen Phase 4J: long-term medieval climate cycles and seasonal weather.
// Climate is simulation state, not presentation. It feeds ecology, food, migration,
// settlement stability, trade conditions and regional history.
(() => {
  const state = window.SIM_STATE;
  if (!state) return;

  const clamp = (v, a = -100, b = 100) => Math.max(a, Math.min(b, v));
  const alive = () => (state.npcs || []).filter(n => n.alive);
  const log = text => window.SIM_API?.log?.(text);

  const CYCLES = {
    stable: { name: 'Stable Climate', temp: 0, rain: 0, severity: 0 },
    warm: { name: 'Warm Period', temp: 12, rain: 4, severity: 4 },
    wet: { name: 'Wet Period', temp: 2, rain: 18, severity: 7 },
    cool: { name: 'Cool Period', temp: -12, rain: -3, severity: 5 },
    dry: { name: 'Dry Period', temp: 6, rain: -20, severity: 12 },
    harsh_winter: { name: 'Harsh Winters', temp: -24, rain: -4, severity: 18 },
    drought: { name: 'Great Drought', temp: 18, rain: -38, severity: 28 },
    stormy: { name: 'Storm Cycle', temp: 4, rain: 24, severity: 24 }
  };

  const SEASONS = [
    { id:'spring', name:'Spring', rain:14, temp:4 },
    { id:'summer', name:'Summer', rain:-4, temp:18 },
    { id:'autumn', name:'Autumn', rain:9, temp:5 },
    { id:'winter', name:'Winter', rain:1, temp:-15 }
  ];

  function ensure() {
    state.climate = state.climate || {};
    const c = state.climate;
    c.cycle = c.cycle || 'stable';
    c.cycleStrength = Number.isFinite(c.cycleStrength) ? c.cycleStrength : 20;
    c.temperature = Number.isFinite(c.temperature) ? c.temperature : 0;
    c.rainfall = Number.isFinite(c.rainfall) ? c.rainfall : 0;
    c.droughtRisk = Number.isFinite(c.droughtRisk) ? c.droughtRisk : 0;
    c.famineRisk = Number.isFinite(c.famineRisk) ? c.famineRisk : 0;
    c.stormRisk = Number.isFinite(c.stormRisk) ? c.stormRisk : 0;
    c.history = Array.isArray(c.history) ? c.history : [];
    c.regional = c.regional || {};
    c.lastTransitionYear = c.lastTransitionYear || state.year;
    return c;
  }

  function season() {
    const index = Math.floor((((state.day || 1) - 1) % 120) / 30);
    return SEASONS[index] || SEASONS[0];
  }

  function chooseCycle() {
    const roll = Math.random();
    if (roll < .06) return 'drought';
    if (roll < .12) return 'harsh_winter';
    if (roll < .20) return 'stormy';
    if (roll < .32) return 'dry';
    if (roll < .44) return 'wet';
    if (roll < .55) return 'cool';
    if (roll < .64) return 'warm';
    return 'stable';
  }

  function transition() {
    const c = ensure();
    if (state.year - c.lastTransitionYear < 4) return;
    if (Math.random() > .24) return;
    const next = chooseCycle();
    if (next === c.cycle && c.cycleStrength > 75) return;
    const old = c.cycle;
    c.cycle = next;
    c.cycleStrength = next === 'stable' ? 18 + Math.random() * 22 : 48 + Math.random() * 42;
    c.lastTransitionYear = state.year;
    const data = CYCLES[next];
    c.history.unshift({year:state.year, from:old, to:next, name:data.name});
    c.history = c.history.slice(0, 20);
    log(`The world enters a ${data.name.toLowerCase()}.`);
  }

  function applyClimate() {
    const c = ensure();
    const base = CYCLES[c.cycle] || CYCLES.stable;
    const s = season();
    const strength = clamp(c.cycleStrength / 100, 0, 1);
    c.temperature = clamp(base.temp * strength + s.temp, -60, 60);
    c.rainfall = clamp(base.rain * strength + s.rain, -70, 70);
    c.droughtRisk = clamp(Math.max(0, -c.rainfall + (c.temperature > 18 ? 8 : 0)), 0, 100);
    c.stormRisk = clamp(Math.max(0, c.rainfall - 18) + (c.cycle === 'stormy' ? 30 * strength : 0), 0, 100);
    c.famineRisk = clamp(c.droughtRisk * .52 + Math.max(0, c.temperature - 24) * 1.2 + (s.id === 'winter' ? 8 : 0), 0, 100);
    state.weather = c.cycle === 'drought' ? 'Drought' : c.cycle === 'harsh_winter' ? 'Harsh Winter' : c.cycle === 'stormy' ? 'Storm' : s.name;
  }

  function settlementClimate(s) {
    s.climate = s.climate || {};
    const c = ensure();
    const terrain = s.biome || s.terrain || 'temperate';
    const waterBonus = ['river','coast','wetland'].includes(terrain) ? 8 : 0;
    s.climate.temperature = c.temperature + (terrain === 'mountain' ? -5 : terrain === 'desert' ? 9 : 0);
    s.climate.rainfall = c.rainfall + waterBonus;
    s.climate.droughtRisk = clamp(c.droughtRisk - waterBonus * .8, 0, 100);
    s.climate.stormRisk = clamp(c.stormRisk + (['coast','river'].includes(terrain) ? 8 : 0), 0, 100);
    s.climate.season = season().id;
    s.climate.farmingModifier = clamp(1 + (s.climate.rainfall * .004) - Math.abs(s.climate.temperature - 10) * .01, .45, 1.55);
    s.climate.hazard = s.climate.droughtRisk > 65 ? 'drought' : s.climate.stormRisk > 65 ? 'storm' : s.climate.temperature < -25 ? 'freeze' : 'normal';
  }

  function applyEffects(s) {
    settlementClimate(s);
    const c = s.climate;
    const pop = alive().filter(n => n.settlementId === s.id);
    const r = s.resources || (s.resources = {});
    if (state.tick % 30 !== 0) return;
    const foodRate = (c.farmingModifier - 1) * Math.max(1, pop.length) * .18;
    r.food = Math.max(0, (r.food || 0) + foodRate);
    r.grain = Math.max(0, (r.grain || 0) + foodRate * .42);
    if (c.hazard === 'drought') {
      s.stability = clamp((s.stability || 50) - .08 * (c.droughtRisk / 10), 0, 100);
      s.growthPressure = clamp((s.growthPressure || 0) - .2 * (c.droughtRisk / 10), -100, 100);
    } else if (c.hazard === 'storm') {
      s.infrastructure = s.infrastructure || {};
      s.infrastructure.roads = Math.max(0, (s.infrastructure.roads || 0) - .012 * (c.stormRisk / 10));
      s.stability = clamp((s.stability || 50) - .05 * (c.stormRisk / 10), 0, 100);
    } else if (c.hazard === 'freeze') {
      s.infrastructure = s.infrastructure || {};
      s.infrastructure.water = Math.max(0, (s.infrastructure.water || 0) - .01);
      s.stability = clamp((s.stability || 50) - .04, 0, 100);
    } else {
      s.stability = clamp((s.stability || 50) + .018, 0, 100);
    }
    if (c.hazard !== 'normal' && Math.random() < .08) {
      const event = c.hazard === 'drought' ? 'drought' : c.hazard === 'storm' ? 'storm' : 'freeze';
      s.history = s.history || [];
      s.history.push(`Year ${state.year}: ${event} conditions strained ${s.name}.`);
      s.history = s.history.slice(-40);
    }
  }

  function npcEffects() {
    const c = ensure();
    const s = season();
    const hazard = c.cycle;
    alive().slice(0, 240).forEach(n => {
      n.climateExposure = n.climateExposure || 0;
      if (hazard === 'drought' || hazard === 'harsh_winter') n.climateExposure = clamp(n.climateExposure + .08, 0, 100);
      else n.climateExposure = Math.max(0, n.climateExposure - .025);
      n.needs = n.needs || {};
      if (c.famineRisk > 55) n.needs.hunger = clamp((n.needs.hunger || 0) + .04, 0, 100);
      if (s.id === 'winter' && n.age < 13) n.needs.energy = clamp((n.needs.energy || 50) - .02, 0, 100);
    });
  }

  function step() {
    if (!state.running) return;
    ensure();
    if (state.tick % 60 === 0) transition();
    applyClimate();
    (state.settlements || []).forEach(applyEffects);
    if (state.tick % 18 === 0) npcEffects();
  }

  window.EVERGLEN_CLIMATE = { CYCLES, SEASONS, ensure, season, transition, applyClimate, settlementClimate, step };
  if (state.registerSystem) state.registerSystem({name:'climate-cycles', step, priority:34});
})();
