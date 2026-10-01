import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  createVault,
  openVault,
  openVaultWithKey,
  vaultPut,
  vaultGet,
  vaultDelete,
  vaultCount,
  vaultSerialize,
  vaultParse,
} from '../dist/core/security/vault.js';
import {
  buildExportBundle,
  bundleFromJson,
  bundleToJson,
  inspectBundle,
} from '../dist/core/security/export.js';
import { auditEntry, AUDIT_ACTIONS } from '../dist/core/audit.js';
import { appendToAuditChain, auditRootHash } from '../dist/core/security/audit-chain.js';
import { encodeRecoveryPhrase, decodeRecoveryPhrase } from '../dist/core/security/recovery.js';

describe('client-side vault', () => {
  const secret = 'ceasar-loves-security-2026';

  it('creates, puts, gets, counts, deletes records', () => {
    const vault = createVault(secret);
    const asset = { name: 'Lake Como estate', value: 2_900_000, currency: 'EUR' };
    vaultPut(vault, { id: 'asset-lake-como', kind: 'asset', data: asset });
    vaultPut(vault, { id: 'note-1', kind: 'note', data: 'call the lawyer' });

    assert.equal(vaultCount(vault), 2);
    const got = vaultGet(vault, 'asset-lake-como');
    assert.deepEqual(got, { kind: 'asset', data: asset });
    assert.equal(vaultGet(vault, 'missing'), null);
    assert.equal(vaultDelete(vault, 'note-1'), true);
    assert.equal(vaultCount(vault), 1);
  });

  it('serialized snapshot contains NO plaintext (ciphertext-only posture)', () => {
    const vault = createVault(secret);
    vaultPut(vault, { id: 'asset-x', kind: 'asset', data: { name: 'Secret Portfolio X', value: 123456.78 } });
    const json = vaultSerialize(vault);
    assert.equal(json.includes('Secret Portfolio X'), false);
    assert.equal(json.includes('123456.78'), false);
    assert.ok(json.includes('recordKey'));
    assert.ok(json.includes('payload'));
  });

  it('opens with correct secret, fails to read with wrong secret', () => {
    const vault = createVault(secret);
    vaultPut(vault, { id: 'a', kind: 'asset', data: { v: 1 } });
    const json = vaultSerialize(vault);
    const snap = vaultParse(json);

    const wrong = openVault(snap, 'wrong-secret');
    // openVault succeeds structurally but the wrapped record keys fail
    assert.equal(wrong.failedRecords, 1);

    const right = openVault(snap, secret);
    assert.equal(right.failedRecords, 0);
    const v2 = right.vault;
    assert.deepEqual(vaultGet(v2, 'a'), { kind: 'asset', data: { v: 1 } });
  });

  it('detects tampered stored payload', () => {
    const vault = createVault(secret);
    vaultPut(vault, { id: 'asset-t', kind: 'asset', data: { v: 7 } });
    // Tamper with the stored payload ciphertext
    const rec = vault.snapshot.records[0];
    const tamperedCt = Buffer.from(rec.payload.ct, 'base64');
    tamperedCt[2] ^= 1;
    rec.payload = { ...rec.payload, ct: tamperedCt.toString('base64') };
    assert.throws(() => vaultGet(vault, 'asset-t'), /Decrypt failed/);
  });

  it('recovery phrase restores the vault (bypass secret)', () => {
    const vault = createVault(secret);
    vaultPut(vault, { id: 'k', kind: 'asset', data: { secretData: 'only-in-vault' } });
    const phrase = encodeRecoveryPhrase(vault.master);
    const { key, checksumValid } = decodeRecoveryPhrase(phrase);
    assert.equal(checksumValid, true);

    const snap = vaultParse(vaultSerialize(vault));
    const restored = openVaultWithKey(snap, key);
    assert.equal(restored.failedRecords, 0);
    const got = vaultGet(restored.vault, 'k');
    assert.deepEqual(got, { kind: 'asset', data: { secretData: 'only-in-vault' } });
  });
});

describe('export bundle', () => {
  it('builds a portable ciphertext-only bundle with verified audit chain', () => {
    const vault = createVault('export-secret');
    vaultPut(vault, { id: 'asset-1', kind: 'asset', data: { name: 'NYC condos' } });

    let audit: ReturnType<typeof appendToAuditChain>[] = [];
    for (const e of [
      auditEntry({ trustId: 't1', actorUid: 'u1', action: AUDIT_ACTIONS.MONEY_MOVE_APPROVED, detail: { moveId: 'm1' } }),
      auditEntry({ trustId: 't1', actorUid: 'u2', action: AUDIT_ACTIONS.MEMBER_GRANTED, detail: {} }),
    ]) {
      audit = [...audit, appendToAuditChain(audit, e)];
    }

    const bundle = buildExportBundle(vault, audit, { includeRecoveryPhrase: true });
    assert.equal(bundle.recordCount, 1);
    assert.equal(bundle.auditVerified, true);
    assert.equal(bundle.auditRoot, auditRootHash(audit));
    assert.ok(bundle.recoveryPhrase.split(' ').length === 24);

    const json = bundleToJson(bundle);
    assert.equal(json.includes('NYC condos'), false); // no plaintext

    const parsed = bundleFromJson(json);
    const inspect = inspectBundle(parsed);
    assert.equal(inspect.auditValid, true);
    assert.equal(inspect.recordCount, 1);
    assert.equal(inspect.hasRecoveryPhrase, true);
  });
});