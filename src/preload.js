const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('wapp', {
  getConfig: () => ipcRenderer.invoke('get-config'),
  setupSession: (partition) => ipcRenderer.invoke('setup-session', partition),
  clearSession: (partition) => ipcRenderer.invoke('clear-session', partition),
  showAccountMenu: () => ipcRenderer.invoke('show-account-menu'),
  showSettingsMenu: () => ipcRenderer.invoke('show-settings-menu'),

  onToggleSidebar: (cb) => ipcRenderer.on('toggle-sidebar', cb),
  onTabPositionChanged: (cb) => ipcRenderer.on('tab-position-changed', (_e, pos) => cb(pos)),
});
