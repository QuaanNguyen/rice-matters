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
 *   npm run start:dev         -- animation picker, isolated from production Rice
 */
const { app, BrowserWindow, ipcMain, screen, shell } = require('electron');
const path = require('node:path');
const os = require('node:os');
const { watchInbox, defaultInboxPath } = require('../assay/lib/events');
const { parseOwnerPid, createOwnerRegistry } = require('./lib/owners');

if (!app || typeof app.requestSingleInstanceLock !== 'function') {
  console.error('[rice] Electron app API missing. Unset ELECTRON_RUN_AS_NODE and relaunch via the Electron binary.');
  process.exit(1);
}

const argv = process.argv.slice(1);
const SOLID = argv.includes('--solid');
const DEMO = argv.includes('--demo');
const DEV = argv.includes('--dev');
const eventsArg = argv.find((a) => a.startsWith('--events='));
const EVENTS_FILE = eventsArg
  ? eventsArg.split('=')[1]
  : (process.env.RICE_EVENTS || defaultInboxPath());

const W = 340;
const H = DEV ? 460 : 380;

let win = null;
let ownerRegistry = null;

if (DEV) {
  app.setName('pet-rice-dev');
  app.setPath('userData', path.join(os.homedir(), '.rice', 'dev-userdata'));
}

const initialOwner = parseOwnerPid(process.env.RICE_OWNER_PID);
const gotLock = app.requestSingleInstanceLock({
  ownerPid: initialOwner,
  dev: DEV,
});

if (!gotLock) {
  app.exit(0);
} else {
  ownerRegistry = createOwnerRegistry({
    onBecameEmpty() { app.quit(); },
  });
  if (initialOwner != null) ownerRegistry.add(initialOwner);

  app.on('second-instance', (_event, _commandLine, _workingDirectory, additionalData) => {
    const data = additionalData && typeof additionalData === 'object' ? additionalData : {};
    if (DEV || data.dev) {
      if (win && !win.isDestroyed()) {
        if (win.isMinimized()) win.restore();
        win.show();
        win.focus();
      }
      return;
    }
    if (ownerRegistry) ownerRegistry.add(data.ownerPid);
  });

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
    if (!DEMO && !DEV) {
      win.webContents.once('did-finish-load', () => {
        const watcher = watchInbox(EVENTS_FILE, (e) => {
          if (win && !win.isDestroyed()) win.webContents.send('rice:event', e);
        });
        win.on('closed', () => watcher.close());
      });
    }

    // Rice reacts to being dragged. The drag itself is handled by the OS via
    // -webkit-app-region, so the renderer gets no mouse events — forward moves.
    let moveTick = 0;
    win.on('move', () => {
      const now = Date.now();
      if (now - moveTick < 60) return;
      moveTick = now;
      if (!win.isDestroyed()) win.webContents.send('rice:dragging');
    });

    win.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url);
      return { action: 'deny' };
    });
  }

  ipcMain.handle('rice:config', () => ({
    eventsFile: EVENTS_FILE,
    demo: DEMO,
    solid: SOLID,
    dev: DEV,
  }));
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
  app.on('will-quit', () => {
    if (ownerRegistry) ownerRegistry.stopPolling();
  });
}
