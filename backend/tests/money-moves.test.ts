import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  approveMove,
  cancelMove,
  executeMove,
  isHighRisk,
  proposeMove,
  rejectMove,
} from '../dist/core/index.js';

function propose() {
  const res = proposeMove(
    { description: 'Pay school fees', direction: 'out', amount: 500, currency: 'USD', payee: 'School' },
    'uSteward',
  );
  assert.ok(res.ok);
  return res.move;
}

describe('proposeMove', () => {
  it('starts as pending', () => {
    const move = propose();
    assert.equal(move.state, 'pending');
    assert.equal(move.proposedBy, 'uSteward');
    assert.equal(move.highRisk, false);
  });
});

describe('approveMove', () => {
  it('only the principal can approve', () => {
    const res = approveMove(propose(), 'steward', { approvedBy: 'uSteward' });
    assert.equal(res.ok, false);
  });
  it('principal approval succeeds', () => {
    const res = approveMove(propose(), 'principal', { approvedBy: 'uOwner' });
    assert.ok(res.ok);
    if (res.ok) {
      assert.equal(res.move.state, 'approved');
      assert.equal(res.move.approvedBy, 'uOwner');
    }
  });
  it('high-risk move needs escalation confirmation', () => {
    const res = proposeMove(
      { description: 'Large transfer', direction: 'out', amount: 50000, currency: 'USD' },
      'uSteward',
      true,
    );
    assert.ok(res.ok);
    const noEsc = approveMove(res.move, 'principal', { approvedBy: 'uOwner' });
    assert.equal(noEsc.ok, false);
    const withEsc = approveMove(res.move, 'principal', { approvedBy: 'uOwner' }, true);
    assert.ok(withEsc.ok);
  });
  it('cannot approve a non-pending move', () => {
    const p = propose();
    approveMove(p, 'principal', { approvedBy: 'uOwner' });
    const again = approveMove({ ...p, state: 'approved' }, 'principal', { approvedBy: 'uOwner' });
    assert.equal(again.ok, false);
  });
});

describe('executeMove', () => {
  it('executes only approved moves', () => {
    const res = executeMove(propose(), 'principal', 'uOwner');
    assert.equal(res.ok, false); // still pending
  });
  it('principal can execute an approved move', () => {
    const res = approveMove(propose(), 'principal', { approvedBy: 'uOwner' });
    assert.ok(res.ok);
    const exec = executeMove(res.move, 'principal', 'uOwner');
    assert.ok(exec.ok);
    if (exec.ok) assert.equal(exec.move.state, 'executed');
  });
});

describe('rejectMove', () => {
  it('principal rejects a pending move', () => {
    const res = rejectMove(propose(), 'principal', 'uOwner');
    assert.ok(res.ok);
    if (res.ok) {
      assert.equal(res.move.state, 'rejected');
      assert.equal(res.move.rejectedBy, 'uOwner');
    }
  });
  it('steward cannot reject', () => {
    const res = rejectMove(propose(), 'steward', 'uSteward');
    assert.equal(res.ok, false);
  });
});

describe('cancelMove', () => {
  it('cancels pending move', () => {
    const res = cancelMove(propose(), 'uSteward');
    assert.ok(res.ok);
  });
  it('cannot cancel executed move', () => {
    const res = cancelMove({ ...propose(), state: 'executed' }, 'uOwner');
    assert.equal(res.ok, false);
  });
});

describe('isHighRisk', () => {
  it('flags large outgoing', () => {
    assert.equal(isHighRisk(50000, 20000, 'out'), true);
  });
  it('flags incoming never', () => {
    assert.equal(isHighRisk(50000, 20000, 'in'), false);
  });
  it('small outgoing is not high risk', () => {
    assert.equal(isHighRisk(100, 20000, 'out'), false);
  });
});