import { createHash } from 'crypto';
import type { AuditEntry } from '../model';

/**
 * Hash-chained immutable audit log.
 *
 * Every appended entry carries `prevHash` (of the previous entry) and a `hash`
 * committing to its own payload + prevHash. To alter any historical entry an
 * attacker must recompute every subsequent hash  and would still need to get
 * the updated Merkle-style root past independent verification. Our canonical
 * product also holds the root hash signed/anchored (Phase 4 note: anchor to
 * Firestore or a public log for full immutability).
 */

export interface ChainedAuditEntry extends AuditEntry {
  prevHash: string;
  hash: string;
}

export const AUDIT_GENESIS = 'genesis';

export function hashEntry(entry: ChainedAuditEntry | Omit<ChainedAuditEntry, 'hash'>): string {
  const snapshot: Omit<ChainedAuditEntry, 'hash'> = {
    id: entry.id,
    trustId: entry.trustId,
    at: entry.at,
    actorUid: entry.actorUid,
    actorRole: entry.actorRole,
    action: entry.action,
    detail: entry.detail ?? {},
    prevHash: entry.prevHash,
  };
  return createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
}

/**
 * Append a raw audit entry to the chain. Pass `null` for the previous entry
 * to start a new chain (genesis).
 */
export function appendToAuditChain(
  chain: ChainedAuditEntry[],
  entry: AuditEntry,
): ChainedAuditEntry {
  const prevHash = chain.length > 0 ? chain[chain.length - 1].hash : AUDIT_GENESIS;
  const chained: Omit<ChainedAuditEntry, 'hash'> = { ...entry, prevHash };
  const hash = hashEntry(chained);
  const full: ChainedAuditEntry = { ...chained, hash };
  chain.push(full);
  return full;
}

/** Verify a chain from genesis: every hash matches its payload + prevHash. */
export function verifyAuditChain(chain: ChainedAuditEntry[]): { valid: boolean; brokenAt?: number } {
  let expectedPrev = AUDIT_GENESIS;
  for (let i = 0; i < chain.length; i++) {
    const entry = chain[i];
    if (entry.prevHash !== expectedPrev) return { valid: false, brokenAt: i };
    if (hashEntry(entry) !== entry.hash) return { valid: false, brokenAt: i };
    expectedPrev = entry.hash;
  }
  return { valid: true };
}

/** Root hash of the chain (useful to anchor externally). */
export function auditRootHash(chain: ChainedAuditEntry[]): string {
  if (chain.length === 0) return AUDIT_GENESIS;
  return chain[chain.length - 1].hash;
}

/** Build a chain from a batch of raw entries (idempotent utility for imports). */
export function buildAuditChain(entries: AuditEntry[]): ChainedAuditEntry[] {
  const chain: ChainedAuditEntry[] = [];
  for (const e of entries) appendToAuditChain(chain, e);
  return chain;
}