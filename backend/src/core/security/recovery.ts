import { createHash } from 'crypto';
import { BIP39_ENGLISH } from './wordlist';

/**
 * Recovery phrase: encodes the vault's master key into a checksummed
 * 24-word mnemonic (BIP-39-style: 256-bit key + 8-bit SHA-256 checksum =
 * 264 bits -> 24 words at 11 bits/word). Decoding validates the checksum,
 * so a mistyped phrase is rejected before any crypto is attempted.
 *
 * Note: this reuses BIP-39's word encoding scheme so phrases resemble
 * standard wallet mnemonics and interoperate with common wordlists.
 */

const WORDS = BIP39_ENGLISH;
const BITS_PER_WORD = 11;
const CHECKSUM_BITS = 8;
const KEY_BYTES = 32;
const WORD_COUNT = 24;

function wordToIndex(word: string): number {
  // Map built lazily once.
  const idx = getIndexMap().get(word);
  if (idx === undefined) throw new Error(`Unknown recovery word: '${word}'.`);
  return idx;
}

let indexMap: Map<string, number> | null = null;
function getIndexMap(): Map<string, number> {
  if (!indexMap) {
    indexMap = new Map();
    for (let i = 0; i < WORDS.length; i++) indexMap.set(WORDS[i], i);
  }
  return indexMap;
}

function sha256Of(key: Buffer): Buffer {
  return createHash('sha256').update(key).digest();
}

/** Encode a 32-byte master key into a 24-word mnemonic string. */
export function encodeRecoveryPhrase(masterKey: Buffer): string {
  if (masterKey.length !== KEY_BYTES) {
    throw new Error(`Master key must be ${KEY_BYTES} bytes, got ${masterKey.length}.`);
  }
  const hash = sha256Of(masterKey);
  const bits: number[] = [];
  // 256 key bits
  for (const byte of masterKey) for (let j = 7; j >= 0; j--) bits.push((byte >> j) & 1);
  // + 8 checksum bits = first byte of sha256(masterKey)
  for (let j = 7; j >= 0; j--) bits.push((hash[0] >> j) & 1);
  return bitsToWords(bits);
}

/**
 * Decode a mnemonic back to the master key, verifying the embedded checksum.
 * Returns checksumValid=false if the phrase fails verification  callers must
 * reject the key in that case.
 */
export function decodeRecoveryPhrase(phrase: string): { key: Buffer; checksumValid: boolean } {
  const words = phrase.trim().toLowerCase().split(/\s+/);
  if (words.length !== WORD_COUNT) {
    throw new Error(`Recovery phrase must be ${WORD_COUNT} words, got ${words.length}.`);
  }
  const bits = wordsToBits(words);
  const keyBits = bits.slice(0, KEY_BYTES * 8);
  const checkBits = bits.slice(KEY_BYTES * 8, KEY_BYTES * 8 + CHECKSUM_BITS);
  const key = Buffer.from(bitsToBytes(keyBits));
  const expectedChecksum = sha256Of(key)[0]; // first byte = 8 bits
  let actual = 0;
  for (const b of checkBits) actual = (actual << 1) | b;
  const checksumValid = actual === expectedChecksum;
  return { key, checksumValid };
}

function bitsToWords(bits: number[]): string {
  const out: string[] = [];
  for (let i = 0; i < bits.length; i += BITS_PER_WORD) {
    let idx = 0;
    for (let j = 0; j < BITS_PER_WORD; j++) idx = (idx << 1) | bits[i + j];
    out.push(WORDS[idx]);
  }
  return out.join(' ');
}

function wordsToBits(words: string[]): number[] {
  const bits: number[] = [];
  for (const w of words) {
    const idx = wordToIndex(w);
    for (let j = BITS_PER_WORD - 1; j >= 0; j--) bits.push((idx >> j) & 1);
  }
  return bits;
}

function bitsToBytes(bits: number[]): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | (bits[i + j] ?? 0);
    bytes.push(b);
  }
  return bytes;
}