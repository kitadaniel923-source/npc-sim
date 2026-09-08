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
  });
  win.loadFile(path.join(__dirname, '..', 'index.html'));
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
