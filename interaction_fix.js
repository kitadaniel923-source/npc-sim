(() => {
  const state = window.SIM_STATE;
  if (!state) return;

  const $ = id => document.getElementById(id);
  const art = () => window.EVERGLEN_2D_ART?.draw?.();
  const render = () => { try { window.SIM_RENDER?.(); } catch(e) {} try { art(); } catch(e) {} };
  const note = text => {
    state.feed = state.feed || [];
    state.feed.unshift(`Year ${state.year || 1}, Day ${state.day || 1}: ${text}`);
    state.feed = state.feed.slice(0, 15);
    const feed = $('eventFeed');
    if (feed) feed.innerHTML = state.feed.map(x => `<li>${x}</li>`).join('');
  };

  const bind = (id, fn) => {
    const el = $(id);
    if (!el || el.dataset.interactionBound) return;
    el.dataset.interactionBound = '1';
    el.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); fn(); render(); });
  };

  bind('toggleSim', () => {
    state.running = !state.running;
    const b = $('toggleSim');
    if (b) b.textContent = state.running ? '⏸ Pause' : '▶ Play';
  });

  const speed = $('speed');
  if (speed && !speed.dataset.interactionBound) {
    speed.dataset.interactionBound = '1';
    speed.addEventListener('input', () => {
      state.speed = Number(speed.value) || 1;
      const label = $('speedLabel');
      if (label) label.textContent = `${state.speed}×`;
    });
  }

  bind('godMode', () => {
    state.godMode = !state.godMode;
    const b = $('godMode');
    if (b) b.textContent = state.godMode ? '☄ God Mode ON' : '☄ God Mode';
    note(state.godMode ? 'God Mode enabled.' : 'God Mode disabled.');
  });

  document.querySelectorAll('[data-event]').forEach(button => {
    if (button.dataset.interactionBound) return;
    button.dataset.interactionBound = '1';
    button.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      const event = button.dataset.event;
      if (event === 'reset') {
        location.reload();
        return;
      }
      if (event === 'festival') {
        state.food = Math.min(100, (state.food || 0) + 12);
        state.stability = Math.min(100, (state.stability || 0) + 8);
        state.npcs.forEach(n => { if (n.alive) n.mood = Math.min(100, (n.mood || 50) + 15); });
        note('A great festival fills the settlements with food and celebration.');
      } else if (event === 'storm') {
        state.weather = 'Storm';
        state.stability = Math.max(0, (state.stability || 0) - 5);
        state.food = Math.max(0, (state.food || 0) - 6);
        note('A violent storm crosses the realm.');
      } else if (event === 'plague') {
        state.plague = !state.plague;
        state.stability = Math.max(0, (state.stability || 0) - 8);
        note(state.plague ? 'A plague has broken out.' : 'The plague has subsided.');
      } else if (event === 'war') {
        state.war = !state.war;
        state.stability = Math.max(0, (state.stability || 0) - (state.war ? 10 : 0));
        note(state.war ? 'Border war has erupted.' : 'The border war has ended.');
      } else if (event === 'meteor') {
        const victims = state.npcs.filter(n => n.alive).slice(0, Math.min(3, state.npcs.length));
        victims.forEach(n => { n.health = Math.max(0, (n.health || 100) - 65); if (n.health <= 0) n.alive = false; });
        state.stability = Math.max(0, (state.stability || 0) - 12);
        note('A meteor strikes the world.');
      }
      render();
    });
  });

  bind('toggleNames', () => {
    state.showNames = state.showNames === false;
    const b = $('toggleNames');
    if (b) b.textContent = state.showNames ? '👁 Names' : '👁 Names OFF';
  });

  bind('toggleGrid', () => {
    state.showGrid = !state.showGrid;
    const b = $('toggleGrid');
    if (b) b.textContent = state.showGrid ? '▦ Grid ON' : '▦ Grid';
  });

  bind('toggleTrails', () => {
    state.showTrails = !state.showTrails;
    const b = $('toggleTrails');
    if (b) b.textContent = state.showTrails ? '〰 Trails ON' : '〰 Trails';
  });

  bind('closeInspector', () => {
    state.selected = null;
    const box = $('inspectorContent');
    if (box) box.innerHTML = '<div class="empty-state">Select an NPC to inspect their life, family, clan, role and inheritance.</div>';
  });

  bind('foundFaction', () => {
    const index = (state.kingdoms || []).length + 1;
    const names = ['Northreach','Ironvale','Greenwatch','Stormhold','Dawnmere','Frostmarch','Sunspire','Ravencrest'];
    const k = {
      id: `manual-${Date.now()}`,
      name: names[(index - 1) % names.length],
      color: ['#79c2ff','#ff9f7a','#a8e68a','#d7a7ff','#ffd66e','#ff8fc8'][index % 6],
      capitalId: null, leaderId: null, treasury: 100, power: 25, stability: 82,
      taxRate: .08, law: {crimePenalty:24, bribeBase:12},
      politics: {nobles:20, merchants:20, commons:50, clergy:10, army:0}
    };
    state.kingdoms = state.kingdoms || [];
    state.kingdoms.push(k);
    note(`${k.name} is founded as a new faction.`);
  });

  // Keep the visible 2D renderer in sync with the controls.
  setInterval(() => {
    if (window.EVERGLEN_2D_ART?.draw) window.EVERGLEN_2D_ART.draw();
  }, 100);
})();
