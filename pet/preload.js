'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('rice', {
  config: () => ipcRenderer.invoke('rice:config'),
  quit: () => ipcRenderer.send('rice:quit'),
  resize: (h) => ipcRenderer.send('rice:resize', h),
  open: (url) => ipcRenderer.send('rice:open', url),
});
