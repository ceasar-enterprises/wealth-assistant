# SECURITY.md — Multi-Layered Security for Wealth Command

> Security is a **product feature**, not fine print — the asset-stewardship market
> will not adopt a tool it cannot trust. This is the trust backbone, informed by
> lessons from our SecureVault audit (web UI = 37 vulns → deleted the surface) and
> the money-agent approval/audit principles.

## 1. Security posture

**"You hold the keys."** The platform is designed so that even a full server breach
does not expose a client's asset data to anyone without the client's key material.
We advertise this. It is the single strongest selling point to the wealthy.

## 2. Threat model (what we defend against)

| Threat | Layer(s) countering it |
|--------|------------------------|
| Server / cloud breach | Client-side encryption (below), zero-knowledge posture |
| Physical device theft | On-device vault, biometrics/biometric-unlock, emergency lock/wipe |
| Insider (dev/employee) | Least privilege, no plaintext keys, audit of data access |
| Intercepted transport | TLS 1.2+ everywhere, cert pinning on mobile |
| Credential theft / MITM | MFA/passkeys, no raw bank creds (Plaid only), short-lived tokens |
| Social engineering | Approval gates on high-value actions, kill switch |
| Data lock-in | Native export/portability at all times |
| Account takeover | MFA, suspicious-activity alerts, session revocation |

## 3. Multi-layered controls (the "layers")

### Layer 0 — Application & key management
- Client-side encryption key generated on the device, derived from the user's
  secret (scrypt/argon2-style KDF, high cost). Server stores **ciphertext only**.
- Master key never leaves the device; backup via encrypted recovery phrase.

### Layer 1 — Transit
- TLS 1.2+ (min) for all transport; HSTS; cert pinning on mobile clients.
- No plaintext secrets in config; secrets via environment/vault.

### Layer 2 — Storage at rest (server + local)
- All PII and asset data encrypted at rest (AES-256-GCM) with per-record keys.
- Bank access tokens encrypted (Plaid flow already does AES-256-GCM with
  `TOKEN_ENCRYPTION_KEY`; the app never sees the Plaid secret).
- Local database encrypted; mobile uses SecureStore/Keychain/Keystore.

### Layer 3 — Authentication & identity
- Email/password + **mandatory MFA / passkeys** for asset-handling roles.
- Role-based access: Principal vs Steward vs read-only (mirrors NEBULA roles).
- Short-lived sessions with automatic revocation on device change.

### Layer 4 — Authorization & approval gates
- **High-value/high-risk actions require explicit human approval** (money-agent
  principle): moving assets, large transfers, changing payees, adding/removing
  authority, deleting data.
- Escalation requires a second factor / co-approval for the Principal.
- Every action is gated, logged, and reversible where possible.

### Layer 5 — Audit & accountability
- **Complete immutable audit log**: who, what, when, from where, with what approval.
- Principals can view every interaction steward-level users performed.
- Data-access events logged; anomaly alerts (new device, new country, mass export).

### Layer 6 — Resilience & recovery
- Emergency lock / remote wipe from the Principal's device.
- Kill switch (pause all automation) — same pattern as the money agent.
- Recovery flow: restore from encrypted backup with the recovery phrase.
- No single point of loss: backups encrypted and exportable.

## 4. Privacy & portability guarantees (the trust story we sell)

1. **Local-first by default.** Data lives on-device; cloud copy is ciphertext.
2. **Client-side encryption.** We genuinely cannot read user asset data.
3. **Export anytime.** One-click full export, take your data and leave.
4. **Granular sharing.** Share only what an advisor/spouse/steward needs, revocable
   instantly, never all-or-nothing.
5. **No data selling, no ads.** Revenue is subscription/license, never data.
6. **Plain-language terms.** Real terms, not legalese; state what we store and can't see.
7. **Offline-first.** Works without cloud, shrinking the cloud exposure surface.
8. **Audit-visible.** The user can see every access to their data.

## 5. Rules inherited from lessons

- **Deleting surface beats hardening it.** Where a capability adds attack surface
  without value, remove it (SecureVault lesson).
- **Verify reality, never assume.** Prove what process/version is running before
  trusting it.
- **Never destroy un-checkpointed data.** Backups, WAL and ciphertext handled with
  checkpoint-before-delete discipline.
- **Gate irreversible/money actions behind approval.** Automation proposes; owner disposes.

## 6. Hard boundaries
- No plaintext credentials of users at rest.
- No raw bank credentials — Plaid/connectors only.
- No data monetization, ever.
- No auto-executing high-value actions without human approval.
