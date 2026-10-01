import { randomBytes } from 'crypto';
import { decrypt, deriveKey, encrypt, freshKey, wrapKey, SecureEnvelope } from './crypto';

/**
 * Client-side vault ("You hold the keys").
 *
 * The user's secret derives a master key (scrypt). Each record gets its own
 * random record-key; the record is encrypted with that key and the record-key
 * itself is encrypted ("wrapped") under the master key. Server/cloud sees only
 * ciphertext envelopes. Losing the master key makes the vault unreadable 
 * restore via the recovery phrase (see recovery.ts).
 */

export const SCHEMA_VERSION = 1;
const SALT_BYTES = 16;

export interface WrappedRecord {
  id: string;
  kind: string; // 'asset' | 'audit' | 'note' | ...
  created: string;
  recordKey: SecureEnvelope; // wrapped under the master key
  payload: SecureEnvelope; // encrypted under the record key
}

export interface VaultSnapshot {
  schema: number;
  masterSalt: string; // base64 salt for the master key
  records: WrappedRecord[];
  meta?: Record<string, string>;
}

export interface Vault {
  /** persistable snapshot (safe to store anywhere  ciphertext only) */
  snapshot: VaultSnapshot;
  /** master key material (never persisted) */
  master: Buffer;
}

export interface VaultOpenResult {
  vault: Vault;
  failedRecords: number;
}

export function masterFromSecret(secret: string, salt: Buffer): Buffer {
  return deriveKey(secret, salt);
}

/**
 * Create a new vault from the user's passphrase/secret.
 */
export function createVault(secret: string, meta?: Record<string, string>): Vault {
  if (typeof secret !== 'string' || secret.length === 0) {
    throw new Error('Secret must be a non-empty string.');
  }
  const salt = randomBytes(SALT_BYTES);
  const master = masterFromSecret(secret, salt);
  return {
    snapshot: { schema: SCHEMA_VERSION, masterSalt: salt.toString('base64'), records: [], meta },
    master,
  };
}

/**
 * Open an existing snapshot with the correct secret. Any record whose wrapped
 * record-key fails to decrypt (wrong secret / tampered) is counted.
 */
export function openVault(snapshot: VaultSnapshot, secret: string): VaultOpenResult {
  const salt = Buffer.from(snapshot.masterSalt, 'base64');
  const master = masterFromSecret(secret, salt);
  return openVaultWithKey(snapshot, master);
}

/**
 * Open a snapshot with an already-derived master key (e.g. recovered from a
 * recovery phrase). Intentional: recovery bypasses the passphrase but the key
 * must still match what encrypted the wrapped record-keys.
 */
export function openVaultWithKey(snapshot: VaultSnapshot, master: Buffer): VaultOpenResult {
  const vault: Vault = { snapshot, master };
  let failed = 0;
  for (const rec of snapshot.records) {
    try {
      decrypt(rec.recordKey, master);
    } catch {
      failed += 1;
    }
  }
  return { vault, failedRecords: failed };
}

/**
 * Add a record: derive a fresh record key, encrypt payload under it, wrap the
 * record key under the master key. Returns the wrapped record and adds it.
 */
export function vaultPut(vault: Vault, input: { id: string; kind: string; data: unknown }): WrappedRecord {
  const { id, kind, data } = input;
  const recordKey = freshKey();
  const payloadEnc = encrypt(JSON.stringify(data), recordKey);
  const recordKeyWrapped = wrapKey(vault.master, recordKey, id);
  const rec: WrappedRecord = {
    id,
    kind,
    created: new Date().toISOString(),
    recordKey: recordKeyWrapped,
    payload: payloadEnc,
  };
  vaultDelete(vault, id); // idempotent  replace existing by id
  vault.snapshot.records.push(rec);
  return rec;
}

/** Read a record back; throws if the master key is wrong or payload tampered. */
export function vaultGet(vault: Vault, id: string): { kind: string; data: unknown } | null {
  const rec = vault.snapshot.records.find((r) => r.id === id);
  if (!rec) return null;
  const recordKey = decrypt(rec.recordKey, vault.master);
  const raw = decrypt(rec.payload, recordKey).toString('utf8');
  return { kind: rec.kind, data: JSON.parse(raw) };
}

/** Remove a record by id. Returns true if something was removed. */
export function vaultDelete(vault: Vault, id: string): boolean {
  const before = vault.snapshot.records.length;
  vault.snapshot.records = vault.snapshot.records.filter((r) => r.id !== id);
  return vault.snapshot.records.length < before;
}

/** Metadata-only count  no plaintext leaks. */
export function vaultCount(vault: Vault): number {
  return vault.snapshot.records.length;
}

/** Serialize the snapshot for storage/upload (ciphertext only). */
export function vaultSerialize(vault: Vault): string {
  return JSON.stringify(vault.snapshot);
}

/** Parse a snapshot back off disk (no decryption yet). */
export function vaultParse(json: string): VaultSnapshot {
  return JSON.parse(json) as VaultSnapshot;
}