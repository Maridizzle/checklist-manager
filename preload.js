const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openFile: () => ipcRenderer.invoke('dialog-open'),
  saveAs: (data) => ipcRenderer.invoke('dialog-save-as', data),
  saveFile: (data) => ipcRenderer.invoke('file-save', data),
  readFile: (data) => ipcRenderer.invoke('file-read', data),

  onFileOpened: (callback) => ipcRenderer.on('file-opened', (event, data) => callback(data)),
  onMenuNew: (callback) => ipcRenderer.on('menu-new', () => callback()),
  onMenuSave: (callback) => ipcRenderer.on('menu-save', () => callback()),
  onMenuSaveAs: (callback) => ipcRenderer.on('menu-save-as', () => callback()),
  onMenuToggleWrap: (callback) => ipcRenderer.on('menu-toggle-wrap', () => callback()),
  onMenuZoomIn: (callback) => ipcRenderer.on('menu-zoom-in', () => callback()),
  onMenuZoomOut: (callback) => ipcRenderer.on('menu-zoom-out', () => callback()),
  onMenuZoomReset: (callback) => ipcRenderer.on('menu-zoom-reset', () => callback()),
});
