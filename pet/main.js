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
 *
 * Shortcuts (global — they work whatever window has focus):
 *   Ctrl+Alt+R    show / hide Rice
 *   Ctrl+Alt+=    bigger
 *   Ctrl+Alt+-    smaller
 *   Ctrl+Alt+0    back to normal size
 *
 * Size and position are remembered between runs.
 */
const { app, BrowserWindow, ipcMain, screen, shell, globalShortcut } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const argv = process.argv.slice(1);
const SOLID = argv.includes('--solid');
const DEMO = argv.includes('--demo');
const arg = (name, fallback) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : fallback;
};
const EVENTS_URL = arg('events', 'http://127.0.0.1:4599');
// Plugin mode: ASSAY is inside OpenCode, so there is no server to subscribe
// to — it names a file instead and we follow that. The SSE URL stays the
// default, so nothing changes for the proxy demo.
const EVENTS_FILE = process.env.RICE_EVENTS || (/^https?:/i.test(EVENTS_URL) ? null : EVENTS_URL);
const TOGGLE_KEY = arg('shortcut', 'CommandOrControl+Alt+R');

// The sizing maths lives in its own file with no Electron in it, so the test
// suite can check it. See test/run-tests.js.
const G = require('./geometry');

// One Rice, ever. The OpenCode plugin calls launchPet() on every session, so
// without this you get a second window sitting exactly on top of the first at
// the same saved position — which looks like Rice duplicating the moment you
// drag one off the other. Worse, globalShortcut.register only succeeds for the
// first process, so the second window ignores Ctrl+Alt+R and the resize keys.
const isPrimary = app.requestSingleInstanceLock();
if (!isPrimary) app.quit();
const { watchInbox } = require('../assay/lib/events');
const { BASE_W, BASE_H, DEFAULT_SCALE, clampScale } = G;

let win = null;
let logOpen = false;
let settings = { scale: DEFAULT_SCALE, x: null, y: null };

/* ---------------- settings ---------------- */

const settingsPath = () => path.join(app.getPath('userData'), 'rice-settings.json');

function loadSettings() {
  try {
    const raw = JSON.parse(fs.readFileSync(settingsPath(), 'utf8'));
    if (typeof raw.scale === 'number') settings.scale = clampScale(raw.scale);
    if (Number.isInteger(raw.x)) settings.x = raw.x;
    if (Number.isInteger(raw.y)) settings.y = raw.y;
  } catch { /* first run, or unreadable — defaults are fine */ }
}

let saveTimer = null;
function saveSettings() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      fs.mkdirSync(path.dirname(settingsPath()), { recursive: true });
      fs.writeFileSync(settingsPath(), JSON.stringify(settings, null, 2));
    } catch { /* not worth crashing over */ }
  }, 400);
}

/* ---------------- geometry ---------------- */

/**
 * Resize and rescale together, keeping the bottom-right corner where it is —
 * Rice lives in a corner, so growing upward and leftward is what you expect.
 */
function applyLayout() {
  if (!win || win.isDestroyed()) return;
  const next = G.boundsFor(win.getBounds(), settings.scale, logOpen);
  const area = screen.getDisplayMatching(next).workArea;
  const clamped = G.keepOnScreen(next, area);

  win.setBounds(clamped);
  win.webContents.setZoomFactor(settings.scale);

  settings.x = clamped.x;
  settings.y = clamped.y;
  saveSettings();
}

function stepScale(dir) {
  const wanted = G.stepScale(settings.scale, dir);
  // Growing stops at the edge of the screen, not at an arbitrary number.
  const area = win && !win.isDestroyed()
    ? screen.getDisplayMatching(win.getBounds()).workArea
    : screen.getPrimaryDisplay().workArea;
  setScale(G.fitScale(wanted, area, logOpen));
}

function setScale(next) {
  const s = clampScale(next);
  if (s === settings.scale) return;
  settings.scale = s;
  applyLayout();
  if (win && !win.isDestroyed()) {
    win.webContents.send('rice:scaled', Math.round(s * 100));
  }
}

/* ---------------- window ---------------- */

function create() {
  const area = screen.getPrimaryDisplay().workAreaSize;
  const w = Math.round(BASE_W * settings.scale);
  const h = Math.round(BASE_H * settings.scale);

  const display = screen.getPrimaryDisplay();
  const start = G.keepOnScreen({
    width: w,
    height: h,
    x: settings.x ?? Math.max(0, area.width - w - 28),
    y: settings.y ?? Math.max(0, area.height - h - 28),
  }, display.workArea);

  win = new BrowserWindow({
    ...start,
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
      zoomFactor: settings.scale,
    },
  });

  win.setAlwaysOnTop(true, 'floating');
  if (process.platform === 'darwin') {
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  }

  win.loadFile(path.join(__dirname, 'src', 'index.html'));
  win.once('ready-to-show', () => {
    win.webContents.setZoomFactor(settings.scale);
    win.show();
  });

  // Rice reacts to being dragged. The drag itself is handled by the OS via
  // -webkit-app-region, so the renderer gets no mouse events — forward moves,
  // and remember where it was left.
  let moveTick = 0;
  win.on('move', () => {
    const now = Date.now();
    if (now - moveTick > 60) {
      moveTick = now;
      if (!win.isDestroyed()) win.webContents.send('rice:dragging');
    }
    const b = win.getBounds();
    settings.x = b.x;
    settings.y = b.y;
    saveSettings();
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

function toggleVisible() {
  if (!win || win.isDestroyed()) return create();
  if (win.isVisible()) {
    win.hide();
  } else {
    win.show();
    win.setAlwaysOnTop(true, 'floating');
  }
}

/* ---------------- shortcuts ---------------- */

function registerShortcuts() {
  const wanted = [
    [TOGGLE_KEY, toggleVisible],
    ['CommandOrControl+Alt+=', () => stepScale(+1)],
    ['CommandOrControl+Alt+Plus', () => stepScale(+1)],
    ['CommandOrControl+Alt+-', () => stepScale(-1)],
    ['CommandOrControl+Alt+0', () => setScale(DEFAULT_SCALE)],
  ];

  const failed = [];
  for (const [accel, fn] of wanted) {
    try {
      if (!globalShortcut.register(accel, fn)) failed.push(accel);
    } catch { failed.push(accel); }
  }

  console.log('');
  console.log('  Rice is watching.');
  console.log(`    ${TOGGLE_KEY.replace('CommandOrControl', 'Ctrl')}    show / hide`);
  console.log('    Ctrl+Alt+= / -   bigger / smaller     Ctrl+Alt+0  reset');
  console.log('    Ctrl+wheel over Rice also resizes.');
  if (failed.length) {
    console.log('');
    console.log(`  Note: ${failed.join(', ')} could not be registered — another app owns`);
    console.log('  it. Pass --shortcut="Ctrl+Alt+K" (or similar) to pick a different one.');
  }
  console.log('');
}

/* ---------------- ipc ---------------- */

ipcMain.handle('rice:config', () => ({
  eventsUrl: EVENTS_URL, eventsFile: EVENTS_FILE, demo: DEMO, solid: SOLID,
  scale: settings.scale, toggleKey: TOGGLE_KEY.replace('CommandOrControl', 'Ctrl'),
}));
ipcMain.on('rice:quit', () => app.quit());
ipcMain.on('rice:hide', () => { if (win && !win.isDestroyed()) win.hide(); });
ipcMain.on('rice:open', (_e, url) => { if (/^https?:/.test(url)) shell.openExternal(url); });
ipcMain.on('rice:log', (_e, open) => { logOpen = !!open; applyLayout(); });
ipcMain.on('rice:scale-step', (_e, dir) => stepScale(dir > 0 ? 1 : -1));
ipcMain.on('rice:scale-set', (_e, s) => setScale(s));

/* ---------------- plugin-mode transport ---------------- */

// There is no server in plugin mode: ASSAY runs inside OpenCode and appends
// to a file. Follow it here and push each event at the renderer, which uses
// the same handle() it uses for SSE.
let inboxWatcher = null;
function startInboxWatch() {
  if (!EVENTS_FILE || inboxWatcher) return;
  inboxWatcher = watchInbox(EVENTS_FILE, (e) => {
    if (win && !win.isDestroyed()) win.webContents.send('rice:event', e);
  });
  console.log(`  following ${EVENTS_FILE}`);
}

/* ---------------- lifecycle ---------------- */

// Someone started Rice again (a new OpenCode session): show the one we have.
app.on('second-instance', () => {
  if (!win || win.isDestroyed()) return;
  settings.hidden = false;
  win.showInactive();
});

if (isPrimary) app.whenReady().then(() => {
  loadSettings();
  create();
  registerShortcuts();
  startInboxWatch();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) create(); });
});

app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => app.quit());
