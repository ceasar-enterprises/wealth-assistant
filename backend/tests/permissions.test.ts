import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  canInScope,
  capabilitiesFor,
  grantMember,
  hasCapability,
  revokeMember,
  type TrustMember,
} from '../dist/core/index.js';

function member(role: TrustMember['role'], scopes: string[] = []): TrustMember {
  return {
    trustId: 't1',
    uid: 'u1',
    role,
    scopes,
    grantedAt: '',
    grantedBy: '',
  };
}

describe('capabilitiesFor', () => {
  it('principal has approve + manage + audit + export', () => {
    const caps = capabilitiesFor('principal');
    assert.equal(caps.has('approve_money_move'), true);
    assert.equal(caps.has('manage_members'), true);
    assert.equal(caps.has('view_audit'), true);
    assert.equal(caps.has('export'), true);
    assert.equal(caps.has('emergency_lock'), true);
  });

  it('steward proposes + views but never approves', () => {
    const caps = capabilitiesFor('steward');
    assert.equal(caps.has('propose_money_move'), true);
    assert.equal(caps.has('approve_money_move'), false);
    assert.equal(caps.has('manage_members'), false);
  });

  it('advisor is read-only', () => {
    const caps = capabilitiesFor('advisor');
    assert.equal(caps.has('view_assets'), true);
    assert.equal(caps.has('view_reports'), true);
    assert.equal(caps.has('propose_money_move'), false);
    assert.equal(caps.has('approve_money_move'), false);
    assert.equal(caps.has('manage_assets'), false);
  });
});

describe('canInScope', () => {
  it('principal bypasses scope limits', () => {
    assert.equal(canInScope(member('principal'), 'approve_money_move', 'money'), true);
  });
  it('steward needs the specific scope', () => {
    const stew = member('steward', ['assets']);
    assert.equal(canInScope(stew, 'view_assets', 'assets'), true);
    assert.equal(canInScope(stew, 'view_assets', 'money'), false);
    assert.equal(canInScope(stew, 'propose_money_move', 'money'), false);
  });
  it('advisor cannot act even with scope granted', () => {
    const adv = member('advisor', ['assets', 'reports']);
    assert.equal(canInScope(adv, 'view_assets', 'assets'), true);
    assert.equal(canInScope(adv, 'view_reports', 'reports'), true);
    assert.equal(canInScope(adv, 'propose_money_move', 'money'), false);
  });
});

describe('grantMember / revokeMember', () => {
  it('only a principal can grant', () => {
    assert.throws(() => grantMember('steward', member('advisor'), 'u1'));
  });
  it('principal grant succeeds and stamps grantor/time', () => {
    const out = grantMember('principal', member('steward', ['assets']), 'uOwner', '2026-09-07T00:00:00Z');
    assert.equal(out.grantedBy, 'uOwner');
    assert.equal(out.grantedAt, '2026-09-07T00:00:00Z');
  });
  it('non-principal revocation is refused', () => {
    const res = revokeMember('steward', member('advisor'));
    assert.equal(res.revoked, false);
    assert.match(res.reason ?? '', /principal/);
  });
  it('principal cannot revoke themselves', () => {
    const res = revokeMember('principal', member('principal'));
    assert.equal(res.revoked, false);
  });
  it('principal can revoke a steward', () => {
    const res = revokeMember('principal', member('steward'));
    assert.equal(res.revoked, true);
  });
  it('hasCapability is consistent', () => {
    assert.equal(hasCapability('advisor', 'view_assets'), true);
    assert.equal(hasCapability('advisor', 'emergency_lock'), false);
  });
});