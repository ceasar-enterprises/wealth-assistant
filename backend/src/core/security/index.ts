/**
 * Security layer (Phase 4)  multi-layered controls per SECURITY.md.
 * Pure Node crypto, no external deps.
 */
export * from './crypto';
export * from './vault';
export * from './recovery';
export * from './audit-chain';
export * from './kill-switch';
export * from './export';
export * from './totp';
export * from './wordlist';
export { BIP39_ENGLISH } from './wordlist';