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
  const timeoutMs = 20000;
  const pollMs = 250;

  const poll = async () => {
    if (Date.now() - started > timeoutMs) {
      console.error('EVERGLEN_RUNTIME_AUDIT_TIMEOUT');
      app.exit(2);
      return;
    }

    try {
      const report = await win.webContents.executeJavaScript(`(() => {
        if (!window.EVERGLEN_DEEP_AUDIT) return {ready:false};
        const state = window.SIM_STATE;
        if (!state || typeof state.tick !== 'number') return {ready:false};
        if (state.tick < 12) return {ready:false, tick:state.tick};
        return {ready:true, report:window.EVERGLEN_DEEP_AUDIT.test()};
      })()`, true);

      if (!report?.ready) {
        setTimeout(poll, pollMs);
        return;
      }

      console.log('EVERGLEN_RUNTIME_AUDIT_REPORT=' + JSON.stringify(report.report));
      if (report.report?.ok) {
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
