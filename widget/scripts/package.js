/*
 * Wealth Command - portable packaging script (Phase 5).
 *
 * Assembles a ship-ready, self-contained folder from the local Electron
 * runtime + app + compiled backend engine:
 *
 *   release/WealthCommand/
 *     Wealth Command.exe            (electron runtime, one process = whole product)
 *     resources/app/                (tile + bridge + backend engine)
 *     Wealth Command.cmd            (one-click launcher)
 *
 * The tile's main process self-starts the local bridge server when nothing
 * answers on :4170 (ELECTRON_RUN_AS_NODE fork), so one exe runs the tile AND
 * its data layer. Copy the folder to any 64-bit Windows machine and run
 * "Wealth Command.cmd". No installer, no node/npm needed on the target.
 *
 * Usage: node scripts/package.js   (backend must be built: cd ..\backend && npx tsc)
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const ELEC_DIST = path.join(ROOT, 'node_modules', 'electron', 'dist');
const BACKEND_DIST = path.join(ROOT, '..', 'backend', 'dist');

const RELEASE = path.join(ROOT, 'release', 'WealthCommand');
const APP_DIR = path.join(RELEASE, 'resources', 'app');
const APP_EXE = path.join(RELEASE, 'Wealth Command.exe');
const ZIP_PATH = path.join(ROOT, 'release', 'WealthCommand-v0.1.0.zip');

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

function rmrf(p) {
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
}

function sizeMb(p) {
  let total = 0;
  function walk(d) {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else total += fs.statSync(full).size;
    }
  }
  walk(p);
  return (total / 1024 / 1024).toFixed(1);
}

function main() {
  if (!fs.existsSync(path.join(ELEC_DIST, 'electron.exe'))) {
    console.error('Electron runtime not found. Run npm install in widget/ first.');
    process.exit(1);
  }
  if (!fs.existsSync(path.join(BACKEND_DIST, 'core', 'index.js'))) {
    console.error('Backend engine not built. Run: cd ..\\backend && npx tsc');
    process.exit(1);
  }

  // 0. Regenerate brand icons so the build is self-contained.
  console.log('  [0/4] icons...');
  const icons = spawnSync(process.execPath, [path.join(__dirname, 'gen-icons.js')], { encoding: 'utf8' });
  if (icons.status !== 0) {
    console.error(icons.stderr || 'icon generation failed');
    process.exit(icons.status || 1);
  }

  console.log('Packaging Wealth Command -> ' + RELEASE);
  rmrf(RELEASE);

  // 1. Electron runtime (self-contained).
  console.log('  [1/4] electron runtime...');
  copyDir(ELEC_DIST, RELEASE);
  if (fs.existsSync(path.join(RELEASE, 'electron.exe'))) {
    fs.renameSync(path.join(RELEASE, 'electron.exe'), APP_EXE);
  }

  // 2. App: tile + bridge + preload + renderer. Layout mirrored from the repo
  //    (widget/src + backend/dist) so the runtime requires still resolve.
  //    Electron loads resources/app/package.json and resolves `main` relative
  //    to resources/app/ - so the entry points INTO the widget/ subfolder.
  console.log('  [2/4] app bundle...');
  const appJson = {
    name: 'wealth-command',
    productName: 'Wealth Command',
    version: '0.1.0',
    main: 'widget/src/main.js',
    private: true,
  };
  fs.mkdirSync(APP_DIR, { recursive: true });
  fs.writeFileSync(path.join(APP_DIR, 'package.json'), JSON.stringify(appJson, null, 2));
  copyDir(path.join(ROOT, 'src'), path.join(APP_DIR, 'widget', 'src'));

  // 3. Compiled backend engine (server.js requires ../../backend/dist at runtime).
  console.log('  [3/4] backend engine...');
  copyDir(BACKEND_DIST, path.join(APP_DIR, 'backend', 'dist'));

  // 4. Launcher + README.
  console.log('  [4/4] launcher + README...');
  fs.writeFileSync(
    path.join(RELEASE, 'Wealth Command.cmd'),
    '@echo off\r\nstart "" "%~dp0Wealth Command.exe"\r\n',
  );
  fs.writeFileSync(
    path.join(RELEASE, 'README.txt'),
    [
      'Wealth Command (v0.1) - portable build',
      '',
      'Run "Wealth Command.cmd" or "Wealth Command.exe".',
      'The tile appears top-right; Ctrl+Alt+W summons/sends back;',
      'tray keeps it alive. Approve/reject Money Moves inline.',
      '',
      'Data lives in resources\\app\\widget\\data (status, logs, audit, demo state).',
      'The local bridge serves 127.0.0.1:4170 and is started by the app itself.',
      '',
    ].join('\r\n') + '\r\n',
  );

  console.log('Done. Release size: ' + sizeMb(RELEASE) + ' MB at ' + RELEASE);
  console.log('One-click launcher: "' + path.join(RELEASE, 'Wealth Command.cmd') + '"');

  // Optional: assemble a clean zip distribution (runtime recreates its data dir).
  if (process.argv.includes('--zip')) {
    rmrf(path.join(RELEASE, 'resources', 'app', 'widget', 'data'));
    fs.rmSync(ZIP_PATH, { force: true });
    console.log('Zipping distribution...');
    const cmd = `Compress-Archive -Path '${RELEASE}\\*' -DestinationPath '${ZIP_PATH}' -CompressionLevel Optimal -Force`;
    const zip = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', cmd], { encoding: 'utf8' });
    if (zip.status !== 0) {
      console.error(zip.stderr || zip.stdout || 'zip failed');
      process.exit(zip.status || 1);
    }
    console.log('Zip distribution: ' + ZIP_PATH);
  }
}

main();