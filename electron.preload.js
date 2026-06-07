const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  onShortcut: (callback) => ipcRenderer.on('shortcut', (_event, value) => callback(value)),
  removeShortcutListener: () => ipcRenderer.removeAllListeners('shortcut'),
  platform: process.platform,
})
