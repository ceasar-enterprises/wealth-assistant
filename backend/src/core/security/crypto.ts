import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'crypto';

/**
 * Low-level crypto primitives for the Wealth Command security layer.
 * Uses only Node built-in crypto (no external deps).
 *
 * - Master key material derived from the user's secret via scrypt (KDF).
 * - Records encrypted with AES-256-GCM (authenticated encryption;
 *   tamper-evident via the GCM auth tag).
 * - Envelope carries salt, iv, tag + ciphertext; nothing is recoverable
 *   without the correct key.
 */

export const KDF_N = 16384; // scrypt cost (N). Deliberately modest for JS; raise in prod.
export const KDF_R = 8;
export const KDF_P = 1;
export const KEY_LEN = 32; // bytes -> AES-256
export const IV_LEN = 12; // GCM standard 96-bit nonce
export const SALT_LEN = 16;
export const TAG_LEN = 16;

export interface SecureEnvelope {
  v: 1; // format version
  kdf: 'scrypt';
  /** Present when the key was derived from a secret via KDF. */
  salt?: string; // base64
  iv: string; // base64
  tag: string; // base64 (auth tag)
  ct: string; // base64 (ciphertext)
}

/** Derive a key from a secret + salt using scrypt. */
export function deriveKey(secret: string, salt: Buffer, n = KDF_N, r = KDF_R, p = KDF_P): Buffer {
  return scryptSync(secret, salt, KEY_LEN, { N: n, r, p });
}

/** Derive a fresh per-record key (not from a secret)  for wrapping. */
export function freshKey(): Buffer {
  return randomBytes(KEY_LEN);
}

/** Encrypt a buffer with AES-256-GCM, returns a self-contained envelope. */
export function encrypt(plaintext: Buffer | string, key: Buffer): SecureEnvelope {
  const iv = randomBytes(IV_LEN);
  const data = typeof plaintext === 'string' ? Buffer.from(plaintext, 'utf8') : plaintext;
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(data), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    v: 1,
    kdf: 'scrypt',
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ct: ct.toString('base64'),
  };
}

/** Decrypt an envelope; throws on wrong key or tampering (GCM tag check). */
export function decrypt(envelope: SecureEnvelope, key: Buffer): Buffer {
  const iv = Buffer.from(envelope.iv, 'base64');
  const tag = Buffer.from(envelope.tag, 'base64');
  const ct = Buffer.from(envelope.ct, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  try {
    return Buffer.concat([decipher.update(ct), decipher.final()]);
  } catch (err) {
    throw new Error(`Decrypt failed (wrong key or tampered): ${String(err)}`);
  }
}

/** Keyed HMAC-SHA256 of a payload  for integrity checks over plaintext shapes. */
export function hmac256(key: Buffer, payload: string | Buffer): string {
  return createHmac('sha256', key).update(payload).digest('base64');
}

/** Constant-time equality for base64 or buffer comparisons. */
export function safeEqual(a: string | Buffer, b: string | Buffer): boolean {
  const ba = typeof a === 'string' ? Buffer.from(a) : a;
  const bb = typeof b === 'string' ? Buffer.from(b) : b;
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/** Wrap a key: encrypt it under a master key (AES-256-GCM). */
export function wrapKey(master: Buffer, keyToWrap: Buffer, _label: string): SecureEnvelope {
  return encrypt(keyToWrap, master);
}

/** Unwrap a wrapped key (inverse of wrapKey). */
export function unwrapKey(master: Buffer, wrapped: SecureEnvelope): Buffer {
  return decrypt(wrapped, master);
}

/** Constant-size HMAC to reduce length-timing leakage between valid/invalid. */
export function hmacConstant(key: Buffer, payload: string | Buffer): Buffer {
  return createHmac('sha256', key).update(payload).digest();
}