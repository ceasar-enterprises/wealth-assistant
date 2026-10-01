# DEV_PLAN — Build order, estimates, testing

> Follows the 6-doc system. SOLID + service-law + lessons (verify reality, isolate
> subprocesses, idempotency, no destructive un-checkpointed ops, cp1252-safe output).

## Conventions
- **Reality over assumption:** before testing, prove what process/build/version runs.
- **Verify against ground truth:** validate crypto/net-worth calc with known numbers.
- **Idempotent side effects:** dedup on unique keys (per Money Move, per session).
- **Never destroy checkpointed data:** backups/wal/ciphertext handled with discipline.
- **cp1252-safe output:** ASCII-safe separators in console/scripts.

## Phase 1 — Foundation + absorb FinApp + trust/permission + net-worth core
**Goal:** a working shell with real (stale-cache) net worth and the trust model.
- [ ] Set up repo structure (`backend/`, `widget/`, `sdk/`, `docs/`, mobile absorbed).
- [ ] Bring FinApp `app/` + `functions/` into the product (extend, don't fork);
      confirm Plaid connect still works.
- [ ] Data model: Principal/Steward/Entity/Asset/MoneyMove/Trust/Session.
- [ ] Net-worth aggregator: banks (Plaid) + manual assets + crypto; multi-currency
      with rate fetch + stale cache.
- [ ] RBAC trust/permissions: grant/revoke Steward + read-only share.
- [ ] Project verification: `cd app && npx tsc --noEmit` + `cd functions && npx tsc --noEmit` pass.

## Phase 2 — Interactive desktop widget (Windows, .NET/WPF)
**Goal:** the live tile that flips, approves inline, summons.
- [ ] Scafold WPF widget: always-on-top tile (net worth + approvals badge).
- [ ] Flip/expand to mini command panel; card cycling; deep-link.
- [ ] Inline Approve/Reject with MFA confirm on pending Money Moves.
- [ ] Send-back (tray) / summon-forward (hotkey).
- [ ] Service-law: PID lock, `status.json`, `service.log`, self-heal, single instance.

## Phase 3 — Developer AI-terminal hook
**Goal:** auto-session-summarise + recall + SDK.
- [ ] Session summariser: watch AI/coding session → what done/decisions/threads/next.
- [ ] Store + recall; markdown + JSON outputs.
- [ ] Reuse/extend the existing tab-sync/session-memory system.
- [ ] SDK/API for external dev hooks.

## Phase 4 — Security hardening + trust/portability
**Goal:** multi-layered security is demonstrable and sellable.
- [ ] Client-side encryption by default; per-record keys; KDF; recovery phrase.
- [ ] TLS everywhere, cert pinning, MFA/passkeys (TOTP at least).
- [ ] Approval escalation + kill switch + emergency lock/wipe.
- [ ] Immutable audit log; one-click export; plain-language terms.
- [ ] Security review pass against SECURITY.md threat model.

## Phase 5 — Packaging & sale-readiness
**Goal:** shippable, demoable.
- [ ] Demo dataset (a realistic Principal + Steward + assets + Money Moves).
- [ ] Installer/launch for widget; docs (README, deployment).
- [ ] Pricing tiers + positioning doc (subscription/hybrid).
- [ ] Polish UI to premium standard; performance pass.

## Testing strategy
- **Typecheck:** `cd app && npx tsc --noEmit`; `cd functions && npx tsc --noEmit`.
- **Unit:** net-worth math (multi-currency), approval state machine, permission
  logic, session summariser — pytest/ts-test.
- **Widget:** launch, single-instance, flip, approve, summon; self-heal on kill.
- **Security:** encryption roundtrip vs known vectors; no plaintext in DB; export
  works; audit complete; kill switch halts automation.
- **Regression:** FinApp bank connect still functional.

## Sign-off
Phase gates require the above tests passing and the Success Criteria in
`MVP_SCOPE.md` met before moving on.
