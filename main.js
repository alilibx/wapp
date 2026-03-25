const { app, BrowserWindow, ipcMain, session, globalShortcut, Menu } = require('electron');
const path = require('path');

const WHATSAPP_URL = 'https://web.whatsapp.com';
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

let mainWindow;
let sidebarHidden = false;
let tabPosition = 'top';

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 600,
    minHeight: 400,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 12, y: 12 },
    backgroundColor: '#111b21',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webviewTag: true,
    },
  });

  mainWindow.loadFile('index.html');

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC handlers
ipcMain.handle('get-whatsapp-url', () => WHATSAPP_URL);
ipcMain.handle('get-user-agent', () => USER_AGENT);

ipcMain.handle('setup-session', (event, partition) => {
  const ses = session.fromPartition(partition);
  ses.setUserAgent(USER_AGENT);
});

ipcMain.handle('clear-session', (event, partition) => {
  session.fromPartition(partition).clearStorageData();
});

ipcMain.handle('toggle-sidebar', () => {
  sidebarHidden = !sidebarHidden;
  mainWindow.webContents.send('sidebar-toggled', sidebarHidden);
  return sidebarHidden;
});

ipcMain.handle('get-sidebar-hidden', () => sidebarHidden);

// Native context menu for account tabs
ipcMain.handle('show-account-menu', (event, accountId) => {
  return new Promise((resolve) => {
    const menu = Menu.buildFromTemplate([
      { label: 'Rename', click: () => resolve('rename') },
      { label: 'Reload', click: () => resolve('reload') },
      { type: 'separator' },
      { label: 'Remove Account', click: () => resolve('remove') },
    ]);
    menu.popup({ window: mainWindow });
    menu.on('menu-will-close', () => {
      setTimeout(() => resolve(null), 100);
    });
  });
});

// Native settings menu
ipcMain.handle('show-settings-menu', () => {
  return new Promise((resolve) => {
    const menu = Menu.buildFromTemplate([
      { label: 'Tab Position', enabled: false },
      {
        label: '  Top',
        type: 'radio',
        checked: tabPosition === 'top',
        click: () => {
          tabPosition = 'top';
          mainWindow.webContents.send('tab-position-changed', tabPosition);
          resolve('top');
        },
      },
      {
        label: '  Left',
        type: 'radio',
        checked: tabPosition === 'left',
        click: () => {
          tabPosition = 'left';
          mainWindow.webContents.send('tab-position-changed', tabPosition);
          resolve('left');
        },
      },
    ]);
    menu.popup({ window: mainWindow });
    menu.on('menu-will-close', () => {
      setTimeout(() => resolve(null), 100);
    });
  });
});

app.whenReady().then(() => {
  createWindow();

  globalShortcut.register('CommandOrControl+B', () => {
    sidebarHidden = !sidebarHidden;
    mainWindow.webContents.send('sidebar-toggled', sidebarHidden);
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
