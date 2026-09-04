'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('rice', {
  config: () => ipcRenderer.invoke('rice:config'),
  quit: () => ipcRenderer.send('rice:quit'),
  hide: () => ipcRenderer.send('rice:hide'),
  open: (url) => ipcRenderer.send('rice:open', url),

  // The window is sized by main, not by CSS: it has to grow the OS window and
  // the zoom factor together, or the pet gets clipped.
  setLogOpen: (open) => ipcRenderer.send('rice:log', open),
  scaleStep: (dir) => ipcRenderer.send('rice:scale-step', dir),
  setScale: (s) => ipcRenderer.send('rice:scale-set', s),
  onScaled: (fn) => ipcRenderer.on('rice:scaled', (_e, pct) => fn(pct)),

  // The OS moves the window through -webkit-app-region, so the renderer never
  // sees a mousemove. Main forwards window moves instead.
  onDrag: (fn) => ipcRenderer.on('rice:dragging', () => fn()),

  // Plugin mode has no port to subscribe to: ASSAY runs inside the harness and
  // appends to a file, main tails it, and each event arrives here instead.
  onEvent: (fn) => ipcRenderer.on('rice:event', (_e, evt) => fn(evt)),
});
