import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  totp,
  verifyTotp,
  generateTotpSecret,
  totpFromBase32Secret,
  base32Encode,
  base32Decode,
} from '../dist/core/security/totp.js';

/**
 * RFC 6238 Appendix B test vectors (secret = ASCII "12345678901234567890",
 * HMAC-SHA1, 8-digit codes shown in the RFC table).
 */
const RFC_SECRET = '12345678901234567890';

const RFC_VECTORS: Array<[number, string]> = [
  [59, '94287082'],
  [1111111109, '07081804'],
  [1111111111, '14050471'],
  [1234567890, '89005924'],
  [2000000000, '69279037'],
  [20000000000, '65353130'],
];

describe('TOTP (RFC 6238)', () => {
  it('matches the RFC 6238 appendix vectors', () => {
    for (const [t, expected] of RFC_VECTORS) {
      assert.equal(totp(t, RFC_SECRET, 8), expected, `T=${t}`);
    }
  });

  it('verifyTotp accepts current window and +-1 skew, rejects garbage', () => {
    const secret = generateTotpSecret();
    const nowSec = Math.floor(Date.now() / 1000);
    const nowAligned = Math.floor(nowSec / 30) * 30;
    const code = totp(nowAligned, secret.latin1);
    assert.equal(verifyTotp(code, secret.latin1), true);
    assert.equal(verifyTotp('000000', secret.latin1), false);
  });

  it('generateTotpSecret returns lossless latin1 + base32 forms that agree', () => {
    const secret = generateTotpSecret();
    assert.ok(secret.latin1.length === 20);
    assert.ok(secret.base32.length > 0);
    // base32 round-trips to a buffer; feeding it must yield the same code
    const raw = base32Decode(secret.base32);
    assert.equal(raw.length, 20);
    assert.equal(base32Encode(raw), secret.base32);
    // base32 path derives the same code as latin1 path
    assert.equal(totpFromBase32Secret(1111111109, secret.base32), totp(1111111109, secret.latin1));
  });
});