// Single Meteor entry point for the player-facing toolbar.
(() => {
  const button = document.querySelector('[data-event="meteor"]');
  if (!button) return;
  button.title = 'Summon the same player-caused Meteor used by God Mode';
  button.onclick = () => {
    const state = window.SIM_STATE;
    const meteor = window.EVERGLEN_GOD_MODE?.meteorAt;
    if (!state || typeof meteor !== 'function') return;
    meteor({x:state.camera?.x||0,y:state.camera?.y||0});
  };
})();
