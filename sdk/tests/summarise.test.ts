import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarise, render, toMarkdown } from '../dist/index.js';

const transcript = [
  'Decided: widget will be Electron, not WPF (no .NET SDK on machine).',
  'Chose port 4170 for the bridge after checking open sockets.',
  'Built the net-worth engine with multi-currency FX via open.er-api.com.',
  'Open thread: tray icon art is still a placeholder dot.',
  'Blocked on nothing right now.',
  'Next step: write phase 3 developer SDK.',
  'Then integrate the webhook into the CLI.',
];

test('summarise: extracts decisions, open threads, next steps by prefix', () => {
  const s = summarise({ lines: transcript, source: 'test' });
  assert.ok(s.id.length > 0);
  assert.ok(s.decisions.some((d) => d.toLowerCase().includes('electr')));
  assert.ok(s.decisions.some((d) => d.toLowerCase().includes('port 4170')));
  assert.ok(s.openThreads.some((t) => t.toLowerCase().includes('tray icon')));
  assert.ok(s.nextSteps.some((n) => n.toLowerCase().includes('phase 3')));
  assert.ok(s.nextSteps.some((n) => n.toLowerCase().includes('webhook')));
});

test('summarise: empty transcript yields empty session note', () => {
  const s = summarise({ lines: [], source: 'test' });
  assert.equal(s.summary, 'Empty session.');
  assert.deepEqual(s.decisions, []);
});

test('render: markdown includes all four sections', () => {
  const s = summarise({ lines: transcript, source: 'test', projectId: 'wealth-assistant' });
  const md = toMarkdown(s);
  assert.match(md, /# Session summary - wealth-assistant/);
  assert.match(md, /## What was done/);
  assert.match(md, /## Decisions/);
  assert.match(md, /## Open threads/);
  assert.match(md, /## Next steps/);
});

test('render: json and text round-trip the summary fields', () => {
  const s = summarise({ lines: transcript, source: 'test' });
  const json = JSON.parse(render(s, 'json'));
  assert.equal(json.id, s.id);
  assert.deepEqual(json.decisions, s.decisions);
  const text = render(s, 'text');
  assert.match(text, /What was done:/);
  assert.match(text, /Next steps:/);
});

test('render: unknown format throws', () => {
  const s = summarise({ lines: transcript, source: 'test' });
  assert.throws(() => render(s, 'nope' as never));
});