import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { deriveKey, decrypt, encrypt, safeEqual, wrapKey, unwrapKey } from '../dist/core/security/crypto.js';
import { encodeRecoveryPhrase, decodeRecoveryPhrase } from '../dist/core/security/recovery.js';
import { BIP39_ENGLISH } from '../dist/core/security/wordlist.js';

describe('crypto envelope (AES-256-GCM)', () => {
  it('encrypts and decrypts roundtrip', () => {
    const key = deriveKey('correct horse battery staple', Buffer.from('0123456789abcdef', 'utf8'));
    const env = encrypt(JSON.stringify({ secret: 42 }), key);
    const out = JSON.parse(decrypt(env, key).toString('utf8'));
    assert.equal(out.secret, 42);
  });

  it('wrong key fails to decrypt', () => {
    const key = deriveKey('right', Buffer.from('0123456789abcdef', 'utf8'));
    const wrong = deriveKey('wrong', Buffer.from('0123456789abcdef', 'utf8'));
    const env = encrypt('payload', key);
    assert.throws(() => decrypt(env, wrong), /Decrypt failed/);
  });

  it('is tamper-evident: flipping a ciphertext byte breaks decryption', () => {
    const key = deriveKey('k', Buffer.from('0123456789abcdef', 'utf8'));
    const env = encrypt('sensitive', key);
    const tamperedCt = Buffer.from(env.ct, 'base64');
    tamperedCt[0] ^= 1;
    const tampered = { ...env, ct: tamperedCt.toString('base64') };
    assert.throws(() => decrypt(tampered, key));
  });

  it('key wrapping roundtrips', () => {
    const master = deriveKey('master-secret', Buffer.from('salt1234', 'utf8'));
    const recordKey = Buffer.from('x'.repeat(32));
    const wrapped = wrapKey(master, recordKey, 'asset-1');
    const unwrapped = unwrapKey(master, wrapped);
    assert.equal(unwrapped.toString('hex'), recordKey.toString('hex'));
  });

  it('safeEqual is constant-time-correct', () => {
    assert.equal(safeEqual('abc', 'abc'), true);
    assert.equal(safeEqual('abc', 'abd'), false);
    assert.equal(safeEqual('a', 'ab'), false);
  });
});

describe('recovery phrase (BIP-39 style)', () => {
  it('encodes/decode a 32-byte key to 24 words and back', () => {
    const key = Buffer.from('deadbeef'.repeat(11).slice(0, 64), 'hex'); // 32 bytes
    const phrase = encodeRecoveryPhrase(key);
    const words = phrase.split(' ');
    assert.equal(words.length, 24);
    assert.ok(words.every((w) => BIP39_ENGLISH.includes(w)));
    const { key: recovered, checksumValid } = decodeRecoveryPhrase(phrase);
    assert.equal(checksumValid, true);
    assert.equal(recovered.toString('hex'), key.toString('hex'));
  });

  it('rejects a tampered phrase via checksum', () => {
    const key = Buffer.from('a'.repeat(32));
    const phrase = encodeRecoveryPhrase(key);
    const words = phrase.split(' ');
    const replacement = words[0] === 'abandon' ? 'ability' : 'abandon';
    words[0] = replacement;
    const { checksumValid } = decodeRecoveryPhrase(words.join(' '));
    assert.equal(checksumValid, false);
  });

  it('throws on wrong word count or unknown word', () => {
    const key = Buffer.from('b'.repeat(32));
    const phrase = encodeRecoveryPhrase(key);
    assert.throws(() => decodeRecoveryPhrase(phrase.split(' ').slice(0, 20).join(' ')), /24 words/);
    const unknown = [...phrase.split(' ').slice(0, 23), 'zzzzy'];
    assert.throws(() => decodeRecoveryPhrase(unknown.join(' ')), /Unknown recovery word/);
  });

  it('different keys produce different phrases', () => {
    const a = encodeRecoveryPhrase(Buffer.from('c'.repeat(32)));
    const b = encodeRecoveryPhrase(Buffer.from('d'.repeat(32)));
    assert.notEqual(a, b);
  });
});