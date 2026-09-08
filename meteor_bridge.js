// Single Meteor entry point for the player-facing toolbar.
(() => {
  const button = document.querySelector('[data-event="meteor"]');
  if (!button) return;
  button.title = 'Summon the same player-caused Meteor used by God Mode';
  button.onclick = () => {
    const state = window.SIM_STATE;
    const meteor = window.EVERGLEN_GOD_MODE?.meteorAt;
    if (!state || typeof meteor !== 'function') return;
    const result = meteor({x:state.camera?.x||0,y:state.camera?.y||0});
    if (result) {
      state.feed = state.feed || [];
      state.feed.unshift(`Year ${state.year || 1}, Day ${state.day || 1}: A meteor was summoned onto the world.`);
      state.feed = state.feed.slice(0,15);
      const feed=document.getElementById('eventFeed');
      if(feed) feed.innerHTML=state.feed.map(x=>`<li>${x}</li>`).join('');
    }
  };
})();
