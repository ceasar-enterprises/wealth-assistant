# Wealth Command - Personal Assistant for the Rich & Asset Stewards

> Working title. A multi-layered-secure asset-stewardship platform: one command
> center for net worth, assets, people, and automation - delivered via mobile,
> a **live interactive desktop widget**, and a **developer API hook** that
> summarises AI/coding session data.

**Status: v0.1 - Phases 1-5 built & verified.** Engine + security (59/59 tests),
Electron widget (live), developer SDK (17/17 tests), demo dataset, docs, and
portable packaging.

## Two markets, one product
1. **The rich & their asset handlers (PRIMARY)** - wealthy individuals,
   asset-holding companies, family offices, trustees, advisors, property managers.
2. **Developers** - via the AI-terminal session summariser + SDK.

## Repo layout
| Path | Purpose |
|------|---------|
| `docs/` | 6-doc system (PRD, TRD, MVP_SCOPE, USER_FLOW, UI_PLAN, DEV_PLAN) + SECURITY + POSITIONING + DEPLOYMENT |
| `backend/` | Assistant engine, net-worth core, trust/permission, approval state machine, audit, security layer (vault/recovery/audit-chain/kill-switch/export/TOTP) |
| `widget/` | Windows interactive desktop widget (**Electron**, live tile + local bridge server) |
| `sdk/` | `wealth-command-sdk` - developer AI-terminal session-hook SDK |

FinApp (Expo mobile + Firebase / Plaid bank connect) is a separate project and
is not part of this repository.

## Signature features
- **Interactive desktop widget (Electron)** - live tile showing net worth +
  approval badge; click to flip into a command panel; inline approve/reject of
  Money Moves (high-risk requires 2FA-style confirm); `Ctrl+Alt+W` summons;
  tray keeps it alive; fully service-law compliant.
- **Developer AI-terminal hook** - auto-summarises a session (what was done,
  decisions, open threads, next steps), stores with history, `wealth-sdk` CLI +
  REST on port 4171.

## Security (the trust backbone)
Client-side vault (AES-256-GCM, per-record keys wrapped under a scrypt-derived
master key, ciphertext-only snapshots), BIP-39-style 24-word recovery phrase,
SHA-256 hash-chained immutable audit log, kill switch (live/paused/locked +
armed wipe), TOTP (RFC 6238) for escalation, approval gates, export-anytime,
zero-knowledge posture. See `docs/SECURITY.md`.

## Quickstart
```cmd
cd backend && npx tsc && npm test          & rem 59/59
cd sdk && npm run build && npm test        & rem 17/17
cd widget && npm run server                & rem bridge on :4170
cd widget && npm run tile                  & rem Electron tile
cd backend && npm run demo                 & rem demo dataset + export bundle
cd backend && npm run verify               & rem live E2E gate (5/5 surfaces)
```
Portable packaging: `cd widget && node scripts\package.js` ->
`release\WealthCommand\` (with `--zip` for the distribution zip).
Install / autostart: `cd widget && npm run install` (Desktop + Start Menu +
Startup), `npm run uninstall` to remove.

## Verify
```cmd
cd backend && npm test                      & rem 59/59
cd sdk && npm test                          & rem 17/17
cd backend && npx tsc && npm run verify     & rem E2E: engine+security+portability+live bridge+live SDK
```

## Build order
See `docs/DEV_PLAN.md` (Phase 1 foundation / 2 widget / 3 dev hook / 4 security / 5 sale).
_Prices & brand are the open decisions - see `docs/POSITIONING.md`._

## Licence

MIT - see [LICENSE](LICENSE). Copyright 2026 Ceasar Enterprises.