import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { WealthSdk, createSessionHook } from '../dist/index.js';

const transcript = [
  'Decided: use built-in node:sqlite for zero native deps.',
  'Next step: expose the REST API on port 4171.',
];

function tempDb(): { file: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), 'wcsdk-sdk-'));
  const file = join(dir, 'sdk.sqlite');
  return { file, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

test('WealthSdk: ingest (auto-id), recall, render, count', () => {
  const { file, cleanup } = tempDb();
  const sdk = new WealthSdk(file);
  const rec = sdk.ingest({ lines: transcript, source: 'cli', projectId: 'proj-a' });
  assert.ok(rec.id.length > 0);
  assert.equal(sdk.count('proj-a'), 1);
  const recalled = sdk.recall(rec.id);
  assert.ok(recalled);
  assert.equal(recalled.id, rec.id);
  const md = sdk.render(rec, 'md');
  assert.match(md, /## Decisions/);
  sdk.close();
  cleanup();
});

test('WealthSdk: ingest with explicit id is idempotent (rev bumps, no dupes)', () => {
  const { file, cleanup } = tempDb();
  const sdk = new WealthSdk(file);
  const input = { id: 'fixed-id', lines: transcript, source: 'cli' };
  sdk.ingest(input);
  sdk.ingest(input);
  assert.equal(sdk.count(), 1);
  assert.equal(sdk.history('fixed-id').length, 2);
  sdk.close();
  cleanup();
});

test('WealthSdk: preview (dry run) does not store', () => {
  const { file, cleanup } = tempDb();
  const sdk = new WealthSdk(file);
  const summary = sdk.preview({ lines: transcript, source: 'cli' });
  assert.ok(summary.id.length > 0);
  assert.equal(sdk.count(), 0);
  sdk.close();
  cleanup();
});

test('WealthSdk: remove returns boolean', () => {
  const { file, cleanup } = tempDb();
  const sdk = new WealthSdk(file);
  const rec = sdk.ingest({ lines: transcript, source: 'cli' });
  assert.equal(sdk.remove(rec.id), true);
  assert.equal(sdk.remove(rec.id), false);
  sdk.close();
  cleanup();
});

test('createSessionHook: onSessionEnd stores and recalls', () => {
  const { file, cleanup } = tempDb();
  const hook = createSessionHook({ dbFile: file });
  const rec = hook.onSessionEnd({ lines: transcript, source: 'opencode', projectId: 'hook-proj' });
  assert.equal(hook.count('hook-proj'), 1);
  assert.ok(hook.recall(rec.id));
  assert.equal(hook.list({ projectId: 'hook-proj' }).length, 1);
  hook.close();
  cleanup();
});