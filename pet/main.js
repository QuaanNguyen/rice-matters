'use strict';
/**
 * Rice — the window.
 *
 * A frameless, transparent, always-on-top companion that floats over whatever
 * you are working in. It has no idea what ASSAY is beyond one URL: it reads the
 * event stream and reacts. It cannot block, allow, or change anything.
 *
 *   npm start                 -- normal
 *   npm run start:solid       -- opaque background, if transparency misbehaves
 *   npm run start:demo        -- replay a canned event sequence, no ASSAY needed
 */
const { app, BrowserWindow, ipcMain, screen, shell } = require('electron');
const path = require('node:path');

const argv = process.argv.slice(1);
const SOLID = argv.includes('--solid');
const DEMO = argv.includes('--demo');
const eventsArg = argv.find((a) => a.startsWith('--events='));
const EVENTS_URL = eventsArg ? eventsArg.split('=')[1] : 'http://127.0.0.1:4599';

const W = 340;
const H = 380;

let win = null;

function create() {
  const display = screen.getPrimaryDisplay();
  const { width, height } = display.workAreaSize;

  win = new BrowserWindow({
    width: W,
    height: H,
    x: Math.max(0, width - W - 28),
    y: Math.max(0, height - H - 28),
    frame: false,
    transparent: !SOLID,
    backgroundColor: SOLID ? '#12161a' : '#00000000',
    hasShadow: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    focusable: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });

  // Float above normal windows without stealing the workspace.
  win.setAlwaysOnTop(true, 'floating');
  if (process.platform === 'darwin') {
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  }

  win.loadFile(path.join(__dirname, 'src', 'index.html'));
  win.once('ready-to-show', () => win.show());

  // Rice reacts to being dragged. The drag itself is handled by the OS via
  // -webkit-app-region, so the renderer gets no mouse events — forward moves.
  let moveTick = 0;
  win.on('move', () => {
    const now = Date.now();
    if (now - moveTick < 60) return;      // don't flood the renderer
    moveTick = now;
    if (!win.isDestroyed()) win.webContents.send('rice:dragging');
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

ipcMain.handle('rice:config', () => ({ eventsUrl: EVENTS_URL, demo: DEMO, solid: SOLID }));
ipcMain.on('rice:quit', () => app.quit());
ipcMain.on('rice:resize', (_e, h) => {
  if (!win) return;
  const clamped = Math.min(620, Math.max(200, Math.round(h)));
  const [w] = win.getSize();
  win.setSize(w, clamped);
});
ipcMain.on('rice:open', (_e, url) => { if (/^https?:/.test(url)) shell.openExternal(url); });

app.whenReady().then(() => {
  create();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) create(); });
});

app.on('window-all-closed', () => app.quit());
