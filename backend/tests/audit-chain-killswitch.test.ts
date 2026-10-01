import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  appendToAuditChain,
  verifyAuditChain,
  auditRootHash,
  AUDIT_GENESIS,
  ChainedAuditEntry,
} from '../dist/core/security/audit-chain.js';
import {
  gateAction,
  pauseAutomation,
  resumeAutomation,
  emergencyLock,
  emergencyUnlock,
  armWipe,
  RULE_LIVE,
} from '../dist/core/security/kill-switch.js';
import { auditEntry, AUDIT_ACTIONS } from '../dist/core/audit.js';

function makeChain(): ChainedAuditEntry[] {
  const chain: ChainedAuditEntry[] = [];
  appendToAuditChain(chain, auditEntry({ trustId: 't1', actorUid: 'u1', action: 'test.start' }));
  appendToAuditChain(chain, auditEntry({ trustId: 't1', actorUid: 'u2', action: AUDIT_ACTIONS.MONEY_MOVE_PROPOSED }));
  appendToAuditChain(chain, auditEntry({ trustId: 't1', actorUid: 'u1', action: AUDIT_ACTIONS.MONEY_MOVE_APPROVED }));
  return chain;
}

describe('hash-chained audit log', () => {
  it('every entry links to the previous hash and ends on genesis', () => {
    const chain = makeChain();
    assert.equal(chain[0].prevHash, AUDIT_GENESIS);
    for (let i = 1; i < chain.length; i++) {
      assert.equal(chain[i].prevHash, chain[i - 1].hash);
    }
    assert.equal(verifyAuditChain(chain).valid, true);
    assert.equal(auditRootHash(chain), chain[chain.length - 1].hash);
  });

  it('detects tampering in the middle of the chain', () => {
    const chain = makeChain();
    // Tamper with an entry's detail
    chain[1] = { ...chain[1], detail: { moveId: 'FORGED' } };
    const result = verifyAuditChain(chain);
    assert.equal(result.valid, false);
    assert.equal(result.brokenAt, 1);
  });

  it('detects a broken link (prevHash mismatch)', () => {
    const chain = makeChain();
    chain[2] = { ...chain[2], prevHash: 'forged-hash' };
    assert.equal(verifyAuditChain(chain).valid, false);
  });
});

describe('kill switch / emergency controls', () => {
  it('gateAction allows actions when live', () => {
    const g = gateAction(RULE_LIVE, 'money_move.approved');
    assert.deepEqual(g, { blocked: false });
  });

  it('pause blocks actions, resume unblocks, both audited', () => {
    const chain: ChainedAuditEntry[] = [];
    let ks = RULE_LIVE;

    ks = pauseAutomation(ks, 'principal', 'vacation', chain).state;
    assert.equal(ks.state, 'paused');
    assert.equal(gateAction(ks, 'money_move.executed').blocked, true);
    assert.equal(verifyAuditChain(chain).valid, true);
    assert.equal(chain.length, 1);

    ks = resumeAutomation(ks, 'principal', chain).state;
    assert.equal(ks.state, 'live');
    assert.equal(gateAction(ks, 'money_move.executed').blocked, false);
    assert.equal(verifyAuditChain(chain).valid, true);
    assert.equal(chain.length, 2);
  });

  it('emergency lock blocks everything except emergency-safe actions', () => {
    let ks = RULE_LIVE;
    ks = emergencyLock(ks, 'principal').state;
    assert.equal(ks.state, 'locked');
    assert.equal(gateAction(ks, 'money_move.approved').blocked, true);
    assert.equal(gateAction(ks, 'security.unlock', { emergencySafe: true }).blocked, false);
  });

  it('armWipe + emergencyUnlock preserves the wipe flag', () => {
    let ks = RULE_LIVE;
    ks = armWipe(ks, 'principal').state;
    assert.equal(ks.wipe, 'armed');
    ks = emergencyUnlock(ks, 'principal').state;
    assert.equal(ks.state, 'live');
    assert.equal(ks.wipe, 'armed'); // wipe intent survives unlock
  });
});