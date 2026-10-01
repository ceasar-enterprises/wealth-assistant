/*
 * Wealth Command - Electron main (the interactive desktop tile).
 *
 * Service law:
 *  - Always one instance (single-instance lock).
 *  - Log last status (data/widget-status.json + data/widget.log).
 *  - Self-heal (if the tile renderer dies, reload it; if the bridge is down,
 *    the renderer retries).
 *  - Resume, don't rebuild (persist last snapshot in data/widget-state.json).
 *  - Minimal traffic (poll the bridge on a quiet schedule, only when visible).
 */

const { app, BrowserWindow, Tray, Menu, globalShortcut, nativeImage, ipcMain } = require('electron');
const { fork } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const STATUS_FILE = path.join(DATA_DIR, 'widget-status.json');
const LOG_FILE = path.join(DATA_DIR, 'widget.log');
const STATE_FILE = path.join(DATA_DIR, 'widget-state.json');

const BRIDGE = `http://127.0.0.1:${process.env.WIDGET_PORT || 4170}`;

function ensureDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
function log(level, msg) {
  ensureDir();
  try {
    fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${level}: ${msg}\n`);
  } catch { /* best-effort */ }
}
function writeStatus(snapshot) {
  ensureDir();
  const status = {
    service: 'wealth-widget',
    pid: process.pid,
    startedAt: new Date().toISOString(),
    lastSnapshot: snapshot || null,
  };
  const tmp = STATUS_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(status, null, 2));
  fs.renameSync(tmp, STATUS_FILE);
}

function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return { lastDashboard: null, collapsed: true };
  }
}
function saveState(s) {
  ensureDir();
  fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2));
}

/* ------------------------------------------------------------------ */
/* Single-instance                                                     */
/* ------------------------------------------------------------------ */

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  log('warn', 'Another widget instance is running. Refusing duplicate.');
  app.quit();
} else {
  app.on('second-instance', () => {
    showTile();
  });
}

/* ------------------------------------------------------------------ */
/* The tile window                                                     */
/* ------------------------------------------------------------------ */

let win = null;
let tray = null;
let collapsed = true;
let pendingSummon = false;
app.isQuitting = false;

function createTile() {
  win = new BrowserWindow({
    width: 320,
    height: 96,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    show: false,
    icon: APP_ICON,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.setIcon(nativeImage.createFromPath(APP_ICON));
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  const [w, h] = collapsed ? [320, 96] : [360, 420];
  win.setSize(w, h);
  // Dock top-right by default; remember position in state.
  const st = readState();
  if (st.x && st.y) {
    win.setPosition(st.x, st.y);
  } else {
    const { workArea } = require('electron').screen.getPrimaryDisplay();
    win.setPosition(workArea.x + workArea.width - w - 16, workArea.y + 16);
  }

  win.on('close', (e) => {
    // "Send back": keep running in tray instead of quitting.
    if (!app.isQuitting) {
      e.preventDefault();
      hideTile();
    }
  });

  win.on('move', () => {
    try {
      const st = readState();
      st.x = win.getPosition()[0];
      st.y = win.getPosition()[1];
      saveState(st);
    } catch { /* ignore */ }
  });

  win.webContents.on('render-process-gone', (_e, details) => {
    log('error', `Tile renderer gone (${details.reason}) - self-healing (reload).`);
    setTimeout(() => {
      if (win && !win.isDestroyed()) win.reload();
    }, 1000);
  });

  win.once('ready-to-show', () => {
    if (pendingSummon || process.env.WIDGET_SHOW_ON_START === '1') {
      showTile();
    }
  });
}

function showTile() {
  if (!win || win.isDestroyed()) return;
  win.show();
  win.setPosition(readState().x || undefined, readState().y || undefined);
  pendingSummon = false;
  log('info', 'Tile shown (summoned).');
}
function hideTile() {
  if (win && !win.isDestroyed()) win.hide();
  log('info', 'Tile hidden (sent back to tray).');
}
function toggleTile() {
  if (!win) return;
  if (win.isVisible()) hideTile();
  else {
    pendingSummon = true;
    showTile();
  }
}

/* ------------------------------------------------------------------ */
/* Tray (send-back home + summon)                                      */
/* ------------------------------------------------------------------ */

// Brand icons (generated by scripts/gen-icons.js).
const TRAY_ICON = path.join(__dirname, 'assets', 'icon-32.png');
const APP_ICON = path.join(__dirname, 'assets', 'icon-256.png');

function createTray() {
  const icon = nativeImage.createFromPath(TRAY_ICON);
  if (icon.isEmpty()) log('warn', 'Tray icon missing - using empty image.');
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
  tray.setToolTip('Wealth Command');
  updateTrayMenu();
  tray.on('double-click', toggleTile);
}

function updateTrayMenu() {
  const collapsedLabel = win && win.isVisible() ? 'Send back to tray' : 'Summon widget';
  const menu = Menu.buildFromTemplate([
    { label: 'Wealth Command', enabled: false },
    { type: 'separator' },
    { label: collapsedLabel, click: toggleTile },
    { label: 'Refresh', click: () => { if (win) win.webContents.send('manual-refresh'); } },
    { type: 'separator' },
    { label: 'Open data folder', click: () => require('electron').shell.openPath(DATA_DIR) },
    { label: 'Quit', click: () => { app.isQuitting = true; app.quit(); } },
  ]);
  if (tray) tray.setContextMenu(menu);
}

/* ------------------------------------------------------------------ */
/* Bridge client (quiet polling)                                       */
/* ------------------------------------------------------------------ */

function bridgeGet(pathname, timeout = 4000) {
  return new Promise((resolve) => {
    const req = http.get(`${BRIDGE}${pathname}`, { timeout }, (res) => {
      let raw = '';
      res.on('data', (c) => (raw += c));
      res.on('end', () => {
        try {
          resolve({ ok: res.statusCode === 200, data: JSON.parse(raw) });
        } catch {
          resolve({ ok: false, data: { error: 'bad json' } });
        }
      });
    });
    req.on('error', () => resolve({ ok: false, data: { error: 'bridge down' } }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, data: { error: 'timeout' } });
    });
  });
}

function bridgePost(pathname, body = {}) {
  return new Promise((resolve) => {
    const payload = JSON.stringify(body);
    const req = http.request(
      `${BRIDGE}${pathname}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' } },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          try {
            resolve({ ok: res.statusCode === 200, data: JSON.parse(raw) });
          } catch {
            resolve({ ok: false, data: { error: 'bad json' } });
          }
        });
      },
    );
    req.on('error', () => resolve({ ok: false, data: { error: 'bridge down' } }));
    req.write(payload);
    req.end();
  });
}

/* ------------------------------------------------------------------ */
/* IPC (preload bridge)                                                */
/* ------------------------------------------------------------------ */

ipcMain.handle('dashboard', async () => {
  const res = await bridgeGet('/dashboard');
  saveState({ ...readState(), lastDashboard: res.ok ? res.data : null });
  writeStatus(res.ok ? res.data : { error: 'bridge-down' });
  return res;
});

ipcMain.handle('approve', async (_e, { moveId, escalationConfirmed }) => {
  const res = await bridgePost(`/moves/${encodeURIComponent(moveId)}/approve`, { escalationConfirmed });
  if (res.ok) log('info', `Approved move ${moveId}`);
  return res;
});

ipcMain.handle('reject', async (_e, moveId) => {
  const res = await bridgePost(`/moves/${encodeURIComponent(moveId)}/reject`);
  if (res.ok) log('info', `Rejected move ${moveId}`);
  return res;
});

ipcMain.handle('set-collapsed', (_e, value) => {
  collapsed = Boolean(value);
  if (win && !win.isDestroyed()) {
    const [w, h] = collapsed ? [320, 96] : [360, 420];
    win.setMinimumSize(w, h);
    win.setSize(w, h);
    // Anchor inside the work area: keep the widget fully visible when it grows.
    const { workArea } = require('electron').screen.getPrimaryDisplay();
    const [x, y] = win.getPosition();
    let nx = x;
    if (nx + w > workArea.x + workArea.width - 8) nx = workArea.x + workArea.width - w - 8;
    if (nx < workArea.x + 8) nx = workArea.x + 8;
    win.setPosition(nx, y);
  }
});

/* ------------------------------------------------------------------ */
/* Bridge server (self-contained: tile brings its own data layer)       */
/* ------------------------------------------------------------------ */

function ensureBridge() {
  // Local bridge on :4170 serves the tile its dashboard/approvals. If nothing
  // answers, the tile spawns its own bridge (fork as pure node via
  // ELECTRON_RUN_AS_NODE so a single exe runs the whole product).
  bridgeGet('/health', 1500).then((res) => {
    if (res.ok) {
      log('info', 'Bridge already running - not spawning a duplicate.');
      return;
    }
    log('info', 'Bridge not responding - spawning local bridge server.');
    const child = fork(path.join(__dirname, 'server.js'), [], {
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
      stdio: 'ignore',
    });
    child.on('exit', (code) => log('info', `Bridge child exited (code ${code}).`));
  });
}

/* ------------------------------------------------------------------ */
/* Lifecycle                                                            */
/* ------------------------------------------------------------------ */

app.whenReady().then(() => {
  ensureDir();
  log('info', 'Wealth Command tile starting.');
  writeStatus();

  ensureBridge();
  createTile();
  createTray();

  // Global summon hotkey (send back / bring forward).
  const registered = globalShortcut.register('CommandOrControl+Alt+W', () => {
    toggleTile();
    updateTrayMenu();
  });
  log('info', registered ? 'Global hotkey registered (Cmd/Ctrl+Alt+W).' : 'Hotkey registration failed.');

  // Quiet poll: refresh the visible tile only (minimal traffic).
  setInterval(() => {
    if (win && win.isVisible()) {
      win.webContents.send('manual-refresh');
    }
  }, 30_000);

  // Keep tray menu labels fresh.
  setInterval(updateTrayMenu, 60_000);
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

// Quit cleanly (respects the close -> hide-to-tray behavior except on real quit).
let retained;
app.on('window-all-closed', () => {
  // Keep running in tray.
});