const { app, BrowserWindow, ipcMain, session, globalShortcut, Menu } = require('electron');
const path = require('path');

const WHATSAPP_URL = 'https://web.whatsapp.com';
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

let mainWindow;
let tabPosition = 'top';
const activeSessions = new Set();

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
      preload: path.join(__dirname, '..', 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  // Disable ⌘R / Ctrl+R refresh on the main window
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if ((input.meta || input.control) && input.key.toLowerCase() === 'r') {
      event.preventDefault();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ── Session Setup ───────────────────────────────────────────

function setupSessionForPartition(partition) {
  if (activeSessions.has(partition)) return;
  activeSessions.add(partition);

  const ses = session.fromPartition(partition);
  ses.setUserAgent(USER_AGENT);

  // Strip CORP/COEP headers that block WhatsApp sub-resources in webviews
  ses.webRequest.onHeadersReceived((details, callback) => {
    const headers = { ...details.responseHeaders };
    delete headers['cross-origin-opener-policy'];
    delete headers['cross-origin-embedder-policy'];
    delete headers['Cross-Origin-Opener-Policy'];
    delete headers['Cross-Origin-Embedder-Policy'];
    callback({ responseHeaders: headers });
  });

  // Convert session cookies to persistent cookies so WhatsApp auth survives restarts.
  // WhatsApp sets critical auth cookies without an expiration date (session cookies),
  // which Chromium deletes on quit. We intercept and re-set them with a 1-year expiry.
  const persistingCookies = new Set();

  ses.cookies.on('changed', async (_event, cookie, cause, removed) => {
    if (removed || !cookie.session) return;
    if (!cookie.domain.includes('whatsapp')) return;

    // Guard against infinite loop: our own set() triggers 'changed' again
    const cookieKey = `${cookie.domain}:${cookie.name}:${cookie.path}`;
    if (persistingCookies.has(cookieKey)) return;
    persistingCookies.add(cookieKey);

    const url = `http${cookie.secure ? 's' : ''}://${cookie.domain.replace(/^\./, '')}${cookie.path}`;
    try {
      await ses.cookies.set({
        url,
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain,
        path: cookie.path,
        secure: cookie.secure,
        httpOnly: cookie.httpOnly,
        sameSite: cookie.sameSite || 'unspecified',
        expirationDate: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60,
      });
    } catch {
      // Ignore cookie set errors
    } finally {
      persistingCookies.delete(cookieKey);
    }
  });
}

// ── IPC Handlers ────────────────────────────────────────────

ipcMain.handle('get-config', () => ({
  whatsappUrl: WHATSAPP_URL,
  userAgent: USER_AGENT,
}));

ipcMain.handle('setup-session', (_event, partition) => {
  setupSessionForPartition(partition);
});

ipcMain.handle('clear-session', (_event, partition) => {
  activeSessions.delete(partition);
  session.fromPartition(partition).clearStorageData();
});

// ── Dialogs ─────────────────────────────────────────────────

ipcMain.handle('show-input-dialog', (_event, { title, label, defaultValue }) => {
  // Use a small child BrowserWindow as an input dialog
  return new Promise((resolve) => {
    const dialogWin = new BrowserWindow({
      parent: mainWindow,
      modal: true,
      width: 380,
      height: 160,
      resizable: false,
      minimizable: false,
      maximizable: false,
      show: false,
      backgroundColor: '#1f2c33',
      titleBarStyle: 'hidden',
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      },
    });

    const escaped = (defaultValue || '').replace(/'/g, "\\'");
    const escapedTitle = (title || 'Input').replace(/'/g, "\\'");
    const escapedLabel = (label || '').replace(/'/g, "\\'");

    dialogWin.loadURL(`data:text/html;charset=utf-8,
      <html>
      <head><style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, sans-serif;
          background: %231f2c33; color: %23e9edef;
          padding: 20px; display: flex; flex-direction: column; gap: 12px;
          -webkit-app-region: drag;
        }
        h3 { font-size: 14px; font-weight: 600; color: %23e9edef; }
        label { font-size: 12px; color: %238696a0; }
        input {
          width: 100%25; padding: 8px 12px; border-radius: 8px;
          border: 1px solid %232a3942; background: %23111b21; color: %23e9edef;
          font-size: 14px; outline: none; -webkit-app-region: no-drag;
        }
        input:focus { border-color: %2300a884; }
        .btns {
          display: flex; justify-content: flex-end; gap: 8px;
          -webkit-app-region: no-drag;
        }
        button {
          padding: 6px 16px; border-radius: 6px; border: none;
          font-size: 13px; cursor: pointer;
        }
        .btn-cancel { background: %232a3942; color: %238696a0; }
        .btn-ok { background: %2300a884; color: white; font-weight: 600; }
      </style></head>
      <body>
        <h3>${escapedTitle}</h3>
        <input id="input" value="${escaped}" placeholder="${escapedLabel}" autofocus />
        <div class="btns">
          <button class="btn-cancel" onclick="require('electron').ipcRenderer.send('dialog-result', null); window.close()">Cancel</button>
          <button class="btn-ok" onclick="submit()">OK</button>
        </div>
        <script>
          const inp = document.getElementById('input');
          inp.select();
          inp.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') submit();
            if (e.key === 'Escape') { require('electron').ipcRenderer.send('dialog-result', null); window.close(); }
          });
          function submit() {
            require('electron').ipcRenderer.send('dialog-result', inp.value);
            window.close();
          }
        </script>
      </body></html>
    `);

    const { ipcMain: ipc } = require('electron');
    const handler = (_e, value) => {
      resolve(value);
      ipc.removeListener('dialog-result', handler);
    };
    ipc.on('dialog-result', handler);

    dialogWin.on('closed', () => {
      ipc.removeListener('dialog-result', handler);
      resolve(null);
    });

    dialogWin.once('ready-to-show', () => dialogWin.show());
  });
});

// ── Native Menus ────────────────────────────────────────────

ipcMain.handle('show-account-menu', () => {
  return new Promise((resolve) => {
    const menu = Menu.buildFromTemplate([
      { label: 'Rename', click: () => resolve('rename') },
      { label: 'Reload', click: () => resolve('reload') },
      { type: 'separator' },
      { label: 'Remove Account', click: () => resolve('remove') },
    ]);
    menu.popup({ window: mainWindow });
    menu.on('menu-will-close', () => setTimeout(() => resolve(null), 100));
  });
});

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
    menu.on('menu-will-close', () => setTimeout(() => resolve(null), 100));
  });
});

// ── App Lifecycle ───────────────────────────────────────────

app.whenReady().then(() => {
  createWindow();

  // ⌘B just tells the renderer to toggle — renderer owns sidebar state
  globalShortcut.register('CommandOrControl+B', () => {
    if (mainWindow) {
      mainWindow.webContents.send('toggle-sidebar');
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Flush all session data to disk before quitting
app.on('before-quit', async (event) => {
  event.preventDefault();
  const flushPromises = [...activeSessions].map((partition) =>
    session.fromPartition(partition).flushStorageData()
  );
  await Promise.all(flushPromises);
  app.exit(0);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
