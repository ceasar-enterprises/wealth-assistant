import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { auditEntry, buildSessionSummary, netEquity } from '../dist/core/index.js';

import { auditToLine, AUDIT_ACTIONS } from '../dist/core/audit.js';

describe('auditEntry', () => {
  it('builds an entry and formats a line', () => {
    const entry = auditEntry({
      trustId: 't1',
      actorUid: 'u1',
      actorRole: 'principal',
      action: AUDIT_ACTIONS.MONEY_MOVE_APPROVED,
      detail: { moveId: 'm1' },
    });
    assert.equal(entry.trustId, 't1');
    assert.match(entry.id, /^[0-9a-f-]{36}$/);
    const line = auditToLine(entry);
    assert.ok(line.includes('principal:u1'));
    assert.ok(line.includes('money_move.approved'));
    assert.ok(line.includes('"moveId":"m1"'));
  });
});

describe('buildSessionSummary', () => {
  const lines = [
    'Analyzed cohort data.',
    'Decision: use median not mean for outliers.',
    'Next step: fix the parser.',
    'Open: RSI backtest still pending.',
    'Built the report generator.',
  ];
  it('builds structured summary from raw session lines', () => {
    const s = buildSessionSummary({
      lines,
      source: 'opencode:session-123',
      projectId: 'nebulav1',
    });
    assert.ok(s.summary.length > 0);
    assert.ok(s.decisions.some((d) => d.startsWith('Decision')));
    assert.ok(s.nextSteps.some((n) => n.startsWith('Next')));
    assert.ok(s.openThreads.some((o) => o.startsWith('Open')));
    assert.equal(s.projectId, 'nebulav1');
    assert.equal(s.source, 'opencode:session-123');
  });
});

describe('barrel re-exports', () => {
  it('core index exposes everything', () => {
    assert.equal(typeof auditEntry, 'function');
    assert.equal(typeof buildSessionSummary, 'function');
    assert.equal(typeof netEquity, 'function');
  });
});