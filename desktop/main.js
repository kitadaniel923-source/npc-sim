const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

const APP_ID = 'com.everglen.livingworld';
app.setAppUserModelId(APP_ID);

function createWindow() {
  const win = new BrowserWindow({
    width: 1600,
    height: 950,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#111714',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      spellcheck: false
    }
  });

  if (process.env.EVERGLEN_RUNTIME_AUDIT === '1') {
    win.webContents.on('console-message', (_event, level, message, line, sourceId) => {
      if (level >= 2) console.error(`EVERGLEN_RENDERER_CONSOLE level=${level} line=${line} source=${sourceId} message=${message}`);
    });
    win.webContents.on('render-process-gone', (_event, details) => {
      console.error('EVERGLEN_RENDERER_GONE=' + JSON.stringify(details));
    });
    win.webContents.on('unresponsive', () => {
      console.error('EVERGLEN_RENDERER_UNRESPONSIVE');
    });
  }

  win.once('ready-to-show', () => win.show());
  win.webContents.on('did-finish-load', () => {
    try {
      const polish = fs.readFileSync(path.join(__dirname, 'polish.js'), 'utf8');
      win.webContents.executeJavaScript(polish, true).catch(error => console.error('Everglen polish injection failed:', error));
    } catch (error) {
      console.error('Everglen polish load failed:', error);
    }

    if (process.env.EVERGLEN_RUNTIME_AUDIT === '1') {
      runRuntimeAudit(win);
    }
  });
  win.loadFile(path.join(__dirname, '..', 'index.html'));
}

function runRuntimeAudit(win) {
  const started = Date.now();
  const timeoutMs = 30000;
  const pollMs = 250;
  const targetTick = 20;
  let lastTick = null;
  let startedSimulation = false;

  const poll = async () => {
    if (Date.now() - started > timeoutMs) {
      console.error('EVERGLEN_RUNTIME_AUDIT_TIMEOUT tick=' + (lastTick ?? 'unknown'));
      app.exit(2);
      return;
    }

    try {
      const result = await win.webContents.executeJavaScript(`(() => {
        if (!window.EVERGLEN_DEEP_AUDIT) return {ready:false, reason:'audit-not-loaded'};
        const state = window.SIM_STATE;
        if (!state) return {ready:false, reason:'state-not-created'};
        state.running = true;
        const npcs = Array.isArray(state.npcs) ? state.npcs.filter(n => n && n.alive) : [];
        const count = key => npcs.filter(n => {
          if (key === 'learning') return (n.learning?.attempts && Object.keys(n.learning.attempts).length > 0);
          if (key === 'memory') return Array.isArray(n.memories) && n.memories.length > 0;
          if (key === 'actions') return Array.isArray(n.actionHistory) && n.actionHistory.length > 0;
          return n[key] != null;
        }).length;
        return {
          ready:true,
          running:!!state.running,
          tick:typeof state.tick === 'number' ? state.tick : null,
          npcCount:npcs.length,
          report:window.EVERGLEN_DEEP_AUDIT.test(),
          live:{
            goals:count('longTermGoal'),
            plans:count('currentPlan'),
            decisions:count('aiDecision'),
            actions:count('actions'),
            learning:count('learning'),
            memories:count('memory'),
            consequences:count('consequence')
          }
        };
      })()`, true);

      lastTick = result?.tick ?? lastTick;
      if (result?.running) startedSimulation = true;

      if (!result?.ready) {
        setTimeout(poll, pollMs);
        return;
      }

      if (result.tick == null || result.tick < targetTick) {
        setTimeout(poll, pollMs);
        return;
      }

      const live = result.live || {};
      const liveFailures = [];
      if (!startedSimulation) liveFailures.push('simulation never started');
      if (result.tick < targetTick) liveFailures.push(`tick did not reach ${targetTick}`);
      if (!result.running) liveFailures.push('simulation stopped before live audit');
      if (result.npcCount === 0) liveFailures.push('no alive NPCs available');
      if ((live.goals || 0) === 0) liveFailures.push('no NPC goals created');
      if ((live.plans || 0) === 0) liveFailures.push('no NPC plans created');
      if ((live.decisions || 0) === 0) liveFailures.push('no NPC decisions created');
      if ((live.actions || 0) === 0) liveFailures.push('no NPC actions executed');
      if ((live.learning || 0) === 0) liveFailures.push('no NPC learning records created');
      if ((live.memories || 0) === 0) liveFailures.push('no NPC memories recorded');
      if ((live.consequences || 0) === 0) liveFailures.push('no NPC consequences recorded');

      console.log('EVERGLEN_RUNTIME_AUDIT_REPORT=' + JSON.stringify(result.report));
      console.log('EVERGLEN_RUNTIME_AUDIT_LIVE=' + JSON.stringify({tick:result.tick,npcCount:result.npcCount,live,failures:liveFailures}));
      console.log('EVERGLEN_RUNTIME_AUDIT_STATE=' + JSON.stringify({running:result.running,tick:result.tick}));

      if (result.report?.ok && liveFailures.length === 0) {
        console.log('EVERGLEN_RUNTIME_AUDIT_PASS');
        app.exit(0);
      } else {
        console.error('EVERGLEN_RUNTIME_AUDIT_FAIL=' + JSON.stringify(liveFailures));
        app.exit(1);
      }
    } catch (error) {
      console.error('EVERGLEN_RUNTIME_AUDIT_ERROR=' + (error?.stack || error));
      app.exit(1);
    }
  };

  setTimeout(poll, pollMs);
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
