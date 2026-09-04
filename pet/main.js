"use strict";
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
 *   npm run start:dev         -- animation picker; hot-reloads pet/src on change
 *
 * Shortcuts (global — they work whatever window has focus):
 *   Mac:     Control+Option+R  show/hide · Control+Option+= / -  size · Control+Option+0  reset
 *   Windows: Ctrl+Alt+R        show/hide · Ctrl+Alt+= / -        size · Ctrl+Alt+0        reset
 *
 * Size and position are remembered between runs.
 */
const {
  app,
  BrowserWindow,
  ipcMain,
  screen,
  shell,
  globalShortcut,
} = require("electron");
const path = require("node:path");
const os = require("node:os");
const fs = require("node:fs");
const { watchInbox, defaultInboxPath } = require("../assay/lib/events");
const { parseOwnerPid, createOwnerRegistry } = require("./lib/owners");
const G = require("./geometry");
const { BASE_W, BASE_H, DEFAULT_SCALE, clampScale } = G;

if (!app || typeof app.requestSingleInstanceLock !== "function") {
  console.error(
    "[rice] Electron app API missing. Unset ELECTRON_RUN_AS_NODE and relaunch via the Electron binary.",
  );
  process.exit(1);
}

const argv = process.argv.slice(1);
const SOLID = argv.includes("--solid");
const DEMO = argv.includes("--demo");
const DEV = argv.includes("--dev");
const arg = (name, fallback) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=").slice(1).join("=") : fallback;
};
const EVENTS_FILE = arg(
  "events",
  process.env.RICE_EVENTS || defaultInboxPath(),
);
const MOD = "Control+Alt";
const TOGGLE_KEY = arg("shortcut", `${MOD}+R`);
const DEV_H = 460;

function prettyShortcut(accel, platform = process.platform) {
  return platform === "darwin"
    ? accel.replace(/Alt/g, "Option")
    : accel.replace(/Control/g, "Ctrl");
}

let win = null;
let ownerRegistry = null;
let logOpen = false;
let settings = { scale: DEFAULT_SCALE, x: null, y: null };

if (DEV) {
  app.setName("pet-rice-dev");
  app.setPath("userData", path.join(os.homedir(), ".rice", "dev-userdata"));
}

const settingsPath = () =>
  path.join(app.getPath("userData"), "rice-settings.json");

function loadSettings() {
  try {
    const raw = JSON.parse(fs.readFileSync(settingsPath(), "utf8"));
    if (typeof raw.scale === "number") settings.scale = clampScale(raw.scale);
    if (Number.isInteger(raw.x)) settings.x = raw.x;
    if (Number.isInteger(raw.y)) settings.y = raw.y;
  } catch {
    /* first run, or unreadable — defaults are fine */
  }
}

let saveTimer = null;
function saveSettings() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      fs.mkdirSync(path.dirname(settingsPath()), { recursive: true });
      fs.writeFileSync(settingsPath(), JSON.stringify(settings, null, 2));
    } catch {
      /* not worth crashing over */
    }
  }, 400);
}

function baseHeight() {
  if (logOpen) return G.BASE_H_LOG;
  if (DEV) return DEV_H;
  return BASE_H;
}

function applyLayout() {
  if (!win || win.isDestroyed()) return;
  const prev = win.getBounds();
  const width = Math.round(BASE_W * settings.scale);
  const height = Math.round(baseHeight() * settings.scale);
  const next = {
    width,
    height,
    x: Math.round(prev.x + prev.width - width),
    y: Math.round(prev.y + prev.height - height),
  };
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
  const area =
    win && !win.isDestroyed()
      ? screen.getDisplayMatching(win.getBounds()).workArea
      : screen.getPrimaryDisplay().workArea;
  const fits = (s) =>
    BASE_W * s <= area.width && baseHeight() * s <= area.height;
  let fitted = wanted;
  if (!fits(wanted)) {
    for (let i = G.SCALES.length - 1; i >= 0; i--) {
      if (G.SCALES[i] <= wanted && fits(G.SCALES[i])) {
        fitted = G.SCALES[i];
        break;
      }
    }
    if (!fits(fitted)) fitted = G.SCALES[0];
  }
  setScale(fitted);
}

function setScale(next) {
  const s = clampScale(next);
  if (s === settings.scale) return;
  settings.scale = s;
  applyLayout();
  if (win && !win.isDestroyed()) {
    win.webContents.send("rice:scaled", Math.round(s * 100));
  }
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
    onBecameEmpty() {
      app.quit();
    },
  });
  if (initialOwner != null) ownerRegistry.add(initialOwner);

  app.on(
    "second-instance",
    (_event, _commandLine, _workingDirectory, additionalData) => {
      const data =
        additionalData && typeof additionalData === "object"
          ? additionalData
          : {};
      if (DEV || data.dev) {
        if (win && !win.isDestroyed()) {
          if (win.isMinimized()) win.restore();
          win.show();
          win.focus();
        }
        return;
      }
      if (ownerRegistry) ownerRegistry.add(data.ownerPid);
    },
  );

  function create() {
    const display = screen.getPrimaryDisplay();
    const area = display.workAreaSize;
    const w = Math.round(BASE_W * settings.scale);
    const h = Math.round(baseHeight() * settings.scale);
    const start = G.keepOnScreen(
      {
        width: w,
        height: h,
        x: settings.x ?? Math.max(0, area.width - w - 28),
        y: settings.y ?? Math.max(0, area.height - h - 28),
      },
      display.workArea,
    );

    win = new BrowserWindow({
      ...start,
      frame: false,
      transparent: !SOLID,
      backgroundColor: SOLID ? "#12161a" : "#00000000",
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
        preload: path.join(__dirname, "preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
        backgroundThrottling: false,
        zoomFactor: settings.scale,
      },
    });

    win.setAlwaysOnTop(true, "floating");
    if (process.platform === "darwin") {
      win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    }

    win.loadFile(path.join(__dirname, "src", "index.html"));
    win.once("ready-to-show", () => {
      win.webContents.setZoomFactor(settings.scale);
      win.show();
    });
    if (!DEMO && !DEV) {
      win.webContents.once("did-finish-load", () => {
        const watcher = watchInbox(EVENTS_FILE, (e) => {
          if (win && !win.isDestroyed()) win.webContents.send("rice:event", e);
        });
        win.on("closed", () => watcher.close());
      });
    }

    let moveTick = 0;
    win.on("move", () => {
      const now = Date.now();
      if (now - moveTick > 60) {
        moveTick = now;
        if (!win.isDestroyed()) win.webContents.send("rice:dragging");
      }
      const b = win.getBounds();
      settings.x = b.x;
      settings.y = b.y;
      saveSettings();
    });

    win.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url);
      return { action: "deny" };
    });
  }

  function watchDevSources() {
    if (!DEV) return;
    const srcDir = path.join(__dirname, "src");
    let timer = null;
    const reload = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (win && !win.isDestroyed()) win.webContents.reloadIgnoringCache();
      }, 100);
    };
    try {
      fs.watch(srcDir, { recursive: true }, reload);
      console.log(
        "  hot reload: editing files under pet/src will refresh the window.",
      );
    } catch {
      for (const name of fs.readdirSync(srcDir)) {
        fs.watch(path.join(srcDir, name), reload);
      }
      console.log(
        "  hot reload: editing files under pet/src will refresh the window.",
      );
    }
  }

  function toggleVisible() {
    if (!win || win.isDestroyed()) return create();
    if (win.isVisible()) {
      win.hide();
    } else {
      win.show();
      win.setAlwaysOnTop(true, "floating");
    }
  }

  function showVisible() {
    if (!win || win.isDestroyed()) return create();
    if (!win.isVisible()) win.show();
    win.setAlwaysOnTop(true, "floating");
  }

  function scaleAndShow(fn) {
    showVisible();
    fn();
  }

  function registerShortcuts() {
    const wanted = [
      [TOGGLE_KEY, toggleVisible],
      [`${MOD}+=`, () => scaleAndShow(() => stepScale(+1))],
      [`${MOD}+Plus`, () => scaleAndShow(() => stepScale(+1))],
      [`${MOD}+-`, () => scaleAndShow(() => stepScale(-1))],
      [`${MOD}+0`, () => scaleAndShow(() => setScale(DEFAULT_SCALE))],
    ];

    const failed = [];
    for (const [accel, fn] of wanted) {
      try {
        if (!globalShortcut.register(accel, fn)) failed.push(accel);
      } catch {
        failed.push(accel);
      }
    }

    console.log("");
    console.log("  Rice is watching.");
    console.log(
      `    Mac:     ${prettyShortcut(TOGGLE_KEY, "darwin")}    show / hide`,
    );
    console.log(
      `             ${prettyShortcut(`${MOD}+=`, "darwin")} / ${prettyShortcut(`${MOD}+-`, "darwin")}   bigger / smaller     ${prettyShortcut(`${MOD}+0`, "darwin")}  reset`,
    );
    console.log(
      `    Windows: ${prettyShortcut(TOGGLE_KEY, "win32")}        show / hide`,
    );
    console.log(
      `             ${prettyShortcut(`${MOD}+=`, "win32")} / ${prettyShortcut(`${MOD}+-`, "win32")}         bigger / smaller     ${prettyShortcut(`${MOD}+0`, "win32")}        reset`,
    );
    console.log("    Ctrl+wheel over Rice also resizes.");
    if (failed.length) {
      console.log("");
      console.log(
        `  Note: ${failed.map((a) => prettyShortcut(a)).join(", ")} could not be registered — another app owns`,
      );
      console.log(
        `  it. Pass --shortcut="${prettyShortcut(`${MOD}+K`)}" (or similar) to pick a different one.`,
      );
    }
    console.log("");
  }

  ipcMain.handle("rice:config", () => ({
    eventsFile: EVENTS_FILE,
    demo: DEMO,
    solid: SOLID,
    dev: DEV,
    scale: settings.scale,
    toggleKey: prettyShortcut(TOGGLE_KEY),
    resetKey: prettyShortcut(`${MOD}+0`),
  }));
  ipcMain.on("rice:quit", () => app.quit());
  ipcMain.on("rice:hide", () => {
    if (DEV) {
      app.quit();
      return;
    }
    if (win && !win.isDestroyed()) win.hide();
  });
  ipcMain.on("rice:open", (_e, url) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
  });
  ipcMain.on("rice:log", (_e, open) => {
    logOpen = !!open;
    applyLayout();
  });
  ipcMain.on("rice:scale-step", (_e, dir) => stepScale(dir > 0 ? 1 : -1));
  ipcMain.on("rice:scale-set", (_e, s) => setScale(s));

  app.whenReady().then(() => {
    loadSettings();
    create();
    watchDevSources();
    registerShortcuts();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) create();
    });
  });

  app.on("window-all-closed", () => app.quit());
  app.on("will-quit", () => {
    globalShortcut.unregisterAll();
    if (ownerRegistry) ownerRegistry.stopPolling();
  });
}
