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
  let lastTick = null;

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
        return {
          ready:true,
          running:!!state.running,
          tick:typeof state.tick === 'number' ? state.tick : null,
          report:window.EVERGLEN_DEEP_AUDIT.test()
        };
      })()`, true);

      lastTick = result?.tick ?? lastTick;

      if (!result?.ready) {
        setTimeout(poll, pollMs);
        return;
      }

      console.log('EVERGLEN_RUNTIME_AUDIT_REPORT=' + JSON.stringify(result.report));
      console.log('EVERGLEN_RUNTIME_AUDIT_STATE=' + JSON.stringify({running:result.running,tick:result.tick}));
      if (result.report?.ok) {
        console.log('EVERGLEN_RUNTIME_AUDIT_PASS');
        app.exit(0);
      } else {
        console.error('EVERGLEN_RUNTIME_AUDIT_FAIL');
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
