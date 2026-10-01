import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { SessionStore } from '../dist/index.js';

function tempDb(): { file: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), 'wcsdk-test-'));
  const file = join(dir, 'store.sqlite');
  return { file, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

const base = {
  id: 'sess-1',
  projectId: 'proj-a',
  source: 'test',
  startedAt: '2026-09-07T10:00:00.000Z',
  endedAt: '2026-09-07T11:00:00.000Z',
  summary: 'Shipped the widget.',
  decisions: ['electron over wpf'],
  openThreads: ['tray icon art'],
  nextSteps: ['paint tray icon'],
};

test('store: upsert + get roundtrip', () => {
  const { file, cleanup } = tempDb();
  const store = new SessionStore(file);
  store.upsert(base);
  const rec = store.get('sess-1');
  assert.ok(rec);
  assert.equal(rec.rev, 1);
  assert.deepEqual(rec.decisions, ['electron over wpf']);
  assert.equal(rec.savedAt.length > 0, true);
  store.close();
  cleanup();
});

test('store: re-upsert bumps rev and keeps full ledger history', () => {
  const { file, cleanup } = tempDb();
  const store = new SessionStore(file);
  store.upsert(base);
  store.upsert({ ...base, summary: 'Shipped widget + SDK.' });
  const rec = store.get('sess-1');
  assert.ok(rec, 'should exist');
  if (!rec) return;
  assert.equal(rec.rev, 2);
  assert.equal(rec.summary, 'Shipped widget + SDK.');
  const history = store.history('sess-1');
  assert.equal(history.length, 2);
  assert.equal(history[0].rev, 1);
  assert.equal(history[1].rev, 2);
  store.close();
  cleanup();
});

test('store: list and count by project, and delete', () => {
  const { file, cleanup } = tempDb();
  const store = new SessionStore(file);
  store.upsert(base);
  store.upsert({ ...base, id: 'sess-2', projectId: 'proj-b' });
  store.upsert({ ...base, id: 'sess-3', projectId: 'proj-b' });

  assert.equal(store.count(), 3);
  assert.equal(store.count('proj-b'), 2);

  const all = store.list({ limit: 10 });
  assert.equal(all.length, 3);
  const onlyB = store.list({ projectId: 'proj-b', limit: 10 });
  assert.equal(onlyB.length, 2);
  assert.ok(onlyB.every((r) => r.projectId === 'proj-b'));

  assert.equal(store.delete('sess-2'), true);
  assert.equal(store.count(), 2);
  store.close();
  cleanup();
});

test('store: missing id returns null', () => {
  const { file, cleanup } = tempDb();
  const store = new SessionStore(file);
  assert.equal(store.get('nope'), null);
  store.close();
  cleanup();
});