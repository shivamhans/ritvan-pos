const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('ritvanNetwork', { getInfo: () => ipcRenderer.invoke('ritvan-network:get-info') });
contextBridge.exposeInMainWorld('ritvanUpdater', {
  getState: () => ipcRenderer.invoke('ritvan-updater:get-state'),
  checkForUpdates: () => ipcRenderer.invoke('ritvan-updater:check'),
  installUpdate: () => ipcRenderer.invoke('ritvan-updater:install'),
  setAutoInstallWhenIdle: enabled => ipcRenderer.invoke('ritvan-updater:set-auto-install', Boolean(enabled)),
  reportActivity: payload => ipcRenderer.invoke('ritvan-updater:report-activity', payload),
  onState: callback => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('ritvan-updater:state', listener);
    return () => ipcRenderer.removeListener('ritvan-updater:state', listener);
  },
});
