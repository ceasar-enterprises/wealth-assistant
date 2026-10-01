import { Vault, vaultCount, vaultGet, vaultSerialize } from './vault';
import { ChainedAuditEntry, auditRootHash, verifyAuditChain } from './audit-chain';
import { encodeRecoveryPhrase } from './recovery';

/**
 * Portable export bundle ("take your data and leave").
 *
 * The bundle contains ONLY ciphertext (serialized vault snapshot) plus the
 * hash-chained audit log and the recovery phrase for key restoration. No
 * plaintext asset data ever leaves the client. A consumer can verify the
 * audit chain integrity and later decrypt the vault with their own key.
 */

export interface ExportBundle {
  schema: 1;
  exportedAt: string;
  kind: 'wealth-command-export';
  auditChain: ChainedAuditEntry[];
  auditRoot: string;
  auditVerified: boolean;
  recoveryPhrase: string;
  vaultSnapshotJson: string;
  recordCount: number;
}

export function buildExportBundle(
  vault: Vault,
  audit: ChainedAuditEntry[],
  opts: { includeRecoveryPhrase?: boolean } = {},
): ExportBundle {
  const recoveryPhrase = opts.includeRecoveryPhrase === false ? '' : encodeRecoveryPhrase(vault.master);
  return {
    schema: 1,
    exportedAt: new Date().toISOString(),
    kind: 'wealth-command-export',
    auditChain: audit,
    auditRoot: auditRootHash(audit),
    auditVerified: verifyAuditChain(audit).valid,
    recoveryPhrase,
    vaultSnapshotJson: vaultSerialize(vault),
    recordCount: vaultCount(vault),
  };
}

/** Serialize the export bundle for writing to disk. */
export function bundleToJson(bundle: ExportBundle): string {
  return JSON.stringify(bundle, null, 2);
}

/** Parse + validate a bundle. Throws on structural problems. */
export function bundleFromJson(json: string): ExportBundle {
  const b = JSON.parse(json) as ExportBundle;
  if (b.kind !== 'wealth-command-export') throw new Error('Not a Wealth Command export bundle.');
  if (b.schema !== 1) throw new Error('Unsupported export schema version.');
  return b;
}

/** Consistency report for a loaded bundle: audit verification + record peek. */
export function inspectBundle(bundle: ExportBundle): {
  auditValid: boolean;
  recordCount: number;
  hasRecoveryPhrase: boolean;
} {
  const { valid } = verifyAuditChain(bundle.auditChain);
  return {
    auditValid: valid,
    recordCount: bundle.recordCount,
    hasRecoveryPhrase: bundle.recoveryPhrase.length > 0,
  };
}

export { vaultGet };