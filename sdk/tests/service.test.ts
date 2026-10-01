import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'fs';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { Service } from '../dist/index.js';

function tempDataDir(): { dir: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), 'wcsdk-svc-'));
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

test('Service: acquireLock writes pid, second acquire refuses while alive', () => {
  const { dir, cleanup } = tempDataDir();
  const a = new Service({ name: 'demo', dataDir: dir });
  assert.equal(a.acquireLock(), true);
  assert.equal(readFileSync(join(dir, 'demo.pid'), 'utf8').trim(), String(process.pid));

  // Second instance in same process: the lock file holds our own pid and we
  // are "alive", so it must refuse.
  const b = new Service({ name: 'demo', dataDir: dir });
  assert.equal(b.acquireLock(), false);

  a.releaseLock();
  assert.equal(existsSync(join(dir, 'demo.pid')), false);
  cleanup();
});

test('Service: stale lock from a dead pid is reclaimed', () => {
  const { dir, cleanup } = tempDataDir();
  // Write a lock file for a pid that (almost certainly) no longer exists.
  const s = new Service({ name: 'demo', dataDir: dir });
  const { writeFileSync } = require('fs');
  writeFileSync(join(dir, 'demo.pid'), '999999999');
  assert.equal(s.acquireLock(), true);
  assert.equal(readFileSync(join(dir, 'demo.pid'), 'utf8').trim(), String(process.pid));
  cleanup();
});

test('Service: log + writeStatus persist files', () => {
  const { dir, cleanup } = tempDataDir();
  const s = new Service({ name: 'demo', dataDir: dir });
  s.log('info', 'hello');
  s.writeStatus({ running: true });
  assert.match(readFileSync(join(dir, 'demo.log'), 'utf8'), /info: hello/);
  const status = JSON.parse(readFileSync(join(dir, 'demo-status.json'), 'utf8'));
  assert.equal(status.running, true);
  assert.equal(status.service, 'demo');
  cleanup();
});