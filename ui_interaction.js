// Everglen UI interaction layer.
// Owns non-canvas panel visibility so every visible information panel can be dismissed.
(() => {
  const state = () => window.SIM_STATE;
  const render = () => window.SIM_RENDER?.();

  function hide(el) {
    if (!el) return;
    el.dataset.everglenHidden = '1';
    el.style.display = 'none';
  }

  function show(el) {
    if (!el) return;
    el.dataset.everglenHidden = '0';
    el.style.removeProperty('display');
  }

  function togglePanel(panel, button) {
    if (!panel) return;
    const hidden = panel.dataset.everglenHidden === '1';
    if (hidden) {
      show(panel);
      if (button) button.textContent = '×';
    } else {
      hide(panel);
      if (button) button.textContent = '+';
    }
  }

  function addPanelControls() {
    document.querySelectorAll('.side .panel').forEach((panel, index) => {
      if (panel.dataset.everglenUiReady === '1') return;
      panel.dataset.everglenUiReady = '1';
      const title = panel.querySelector('.panel-title');
      if (!title) return;

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'everglen-panel-toggle';
      button.textContent = '×';
      button.title = 'Hide panel';
      button.setAttribute('aria-label', 'Hide panel');
      button.style.cssText = 'margin-left:auto;min-width:22px;padding:2px 5px;font-size:10px;line-height:1;cursor:pointer;';
      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        togglePanel(panel, button);
      });
      title.appendChild(button);
    });
  }

  function installGlobalFixes() {
    // Inspector close must work even if another UI layer replaced its onclick handler.
    document.addEventListener('click', event => {
      const target = event.target?.closest?.('button');
      if (!target) return;

      if (target.id === 'closeInspector') {
        const s = state();
        if (s) s.selected = null;
        render();
        return;
      }

      if (target.id === 'godToolToggle') {
        const panel = document.getElementById('godToolPanel');
        if (panel) panel.classList.toggle('open');
        return;
      }

      if (target.id === 'chronicleClose') {
        const modal = document.getElementById('chronicleModal');
        if (modal) modal.style.display = 'none';
      }
    }, true);
  }

  const style = document.createElement('style');
  style.textContent = '.side .panel[data-everglen-hidden="1"]{display:none!important}.everglen-panel-toggle{opacity:.85}.everglen-panel-toggle:hover{opacity:1}';
  document.head.appendChild(style);

  const boot = () => {
    addPanelControls();
    installGlobalFixes();
    window.EVERGLEN_UI = { addPanelControls, hide, show, togglePanel };
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
