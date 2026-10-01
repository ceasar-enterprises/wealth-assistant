import { createHmac, randomBytes } from 'crypto';

/**
 * Time-based One-Time Password (RFC 6238 / TOTP) for MFA.
 * HMAC-SHA1, 30s step, 6 digits. Enables the "escalation requires a second
 * factor" layer (Layer 4 in SECURITY.md) with a zero-dependency watchable
 * implementation. Verified against the RFC 6238 appendix test vectors.
 */

export const TOTP_STEP = 30;
export const TOTP_DIGITS = 6;

export interface TotpSecret {
  /** Lossless byte-string (latin-1) of the raw 20-byte key. */
  latin1: string;
  /** RFC 4648 base32 of the same key (what authenticator apps scan). */
  base32: string;
}

export function base32Encode(buf: Buffer): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += alphabet[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const cleaned = input.toUpperCase().replace(/=+$/g, '').replace(/\s/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const ch of cleaned) {
    const idx = alphabet.indexOf(ch);
    if (idx === -1) throw new Error(`Invalid base32 character: '${ch}'`);
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** Generate a fresh TOTP secret (20 random bytes, RFC default). */
export function generateTotpSecret(): TotpSecret {
  const raw = randomBytes(20);
  return { latin1: raw.toString('latin1'), base32: base32Encode(raw) };
}

function keyBytes(key: string | Buffer): Buffer {
  return Buffer.isBuffer(key) ? key : Buffer.from(key, 'latin1');
}

/** Compute the TOTP code for a time window counter. */
export function totp(at: number, key: string | Buffer, digits = TOTP_DIGITS): string {
  const counter = Math.floor(at / TOTP_STEP);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac('sha1', keyBytes(key)).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) | ((hmac[offset + 1] & 0xff) << 16) | ((hmac[offset + 2] & 0xff) << 8) | (hmac[offset + 3] & 0xff);
  const code = binary % 10 ** digits;
  return code.toString().padStart(digits, '0');
}

/** Verify a user-supplied code within the current window (+-1 window skew). */
export function verifyTotp(code: string, key: string | Buffer, now = Date.now(), skewWindows = 1): boolean {
  const at = Math.floor(now / 1000);
  for (let w = -skewWindows; w <= skewWindows; w++) {
    if (totp(at + w * TOTP_STEP, key) === code) return true;
  }
  return false;
}

/** Convenience: manual/base32-only path for seeds stored base32. */
export function totpFromBase32Secret(at: number, base32: string): string {
  return totp(at, base32Decode(base32));
}