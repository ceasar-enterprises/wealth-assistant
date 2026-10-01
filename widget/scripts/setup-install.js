/*
 * Wealth Command - install / autostart setup.
 *
 * Makes the product "just work" on a user's machine:
 *   - Desktop shortcut
 *   - Start Menu shortcut
 *   - Windows Startup entry (launches on logon, tile goes to tray)
 *
 * Targets, in priority order:
 *   --release  -> widget/release/WealthCommand/Wealth Command.exe (portable build)
 *   --dev      -> widget/launchers/wc-tile.cmd (repo launcher)
 *   (default)  -> release if it exists, else dev
 *
 * Commands:
 *   install        (default) create shortcuts + startup entry
 *   remove         delete all three links
 *   run            just install; [--release|--dev] to pick target explicitly
 *
 * Shortcuts are real .lnk files created through WScript.Shell (the VBS helper),
 * which works on any stock Windows without extra tooling.
 *
 * Usage: node scripts/setup-install.js [install|remove] [--release|--dev]
 */

const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const VBS = path.join(__dirname, 'install-shortcut.vbs');
const NAME = 'Wealth Command';

const RELEASE_EXE = path.join(ROOT, 'release', 'WealthCommand', 'Wealth Command.exe');
const DEV_LAUNCHER = path.join(ROOT, 'launchers', 'wc-tile.cmd');

function targets() {
  const args = process.argv.slice(2);
  if (args.includes('--release')) {
    return { exe: RELEASE_EXE, wdir: path.dirname(RELEASE_EXE), kind: 'release' };
  }
  if (args.includes('--dev')) {
    return { exe: DEV_LAUNCHER, wdir: path.dirname(DEV_LAUNCHER), kind: 'dev' };
  }
  if (fs.existsSync(RELEASE_EXE)) {
    return { exe: RELEASE_EXE, wdir: path.dirname(RELEASE_EXE), kind: 'release' };
  }
  return { exe: DEV_LAUNCHER, wdir: path.dirname(DEV_LAUNCHER), kind: 'dev' };
}

function lnkPaths() {
  const home = os.homedir();
  const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
  return {
    desktop: path.join(home, 'Desktop', NAME + '.lnk'),
    startMenu: path.join(appData, 'Microsoft', 'Windows', 'Start Menu', 'Programs', NAME + '.lnk'),
    startup: path.join(appData, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup', NAME + '.lnk'),
  };
}

function makeShortcut(lnk, workDir, desc, windowStyle) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'cscript.exe',
      ['//nologo', VBS, targets().exe, lnk, workDir, desc || NAME, String(windowStyle ?? 1)],
      { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true },
    );
    let out = '';
    let err = '';
    child.stdout.on('data', (c) => (out += c));
    child.stderr.on('data', (c) => (err += c));
    child.on('close', (code) => {
      if (code === 0) console.log(out.trim());
      else {
        console.error(err.trim() || `shortcut helper failed (code ${code})`);
        reject(new Error('shortcut creation failed'));
      }
      resolve();
    });
    child.on('error', (e) => {
      console.error('cscript launch failed:', e.message);
      resolve();
    });
  });
}

function removeLnk(p) {
  try {
    if (fs.existsSync(p)) {
      fs.unlinkSync(p);
      console.log('Removed ' + p);
    }
  } catch (e) {
    console.error('Remove failed for ' + p + ': ' + e.message);
  }
}

async function install() {
  console.log('Installing ' + NAME + ' (' + targets().kind + ' build).');
  const lnks = lnkPaths();
  fs.mkdirSync(path.dirname(lnks.startMenu), { recursive: true });
  fs.mkdirSync(path.dirname(lnks.startup), { recursive: true });
  // Desktop + Start Menu: open normal. Startup: hidden (tile lives in tray).
  await makeShortcut(lnks.desktop, targets().wdir, NAME + ' - ' + targets().kind, 1);
  await makeShortcut(lnks.startMenu, targets().wdir, NAME + ' - ' + targets().kind, 1);
  await makeShortcut(lnks.startup, targets().wdir, NAME + ' - autostart on logon', 0);
  console.log('Done. Launch "' + NAME + '" from Desktop / Start Menu; it also starts on logon.');
}

async function remove() {
  const lnks = lnkPaths();
  removeLnk(lnks.desktop);
  removeLnk(lnks.startMenu);
  removeLnk(lnks.startup);
  console.log('Uninstalled shortcuts.');
}

const cmd = process.argv[2] === 'remove' || process.argv[2] === 'uninstall' ? 'remove' : 'install';
if (cmd === 'remove') remove();
else install();