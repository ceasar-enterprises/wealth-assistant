# TRD — Technical Requirements / Architecture

> Design principles (from profile): SOLID, offline-first, local-first, service-law
> (single instance, status log, self-heal, resume-not-rebuild, minimal traffic).
> We **absorb FinApp** (Expo + Firebase + Plaid) as the bank-connect + mobile core.

## 1. Technology stack

| Layer | Chosen | Why |
|-------|--------|-----|
| Mobile / primary UI | **Expo (React Native, TypeScript)** — absorbed from FinApp | Existing working skeleton: auth, tabs, Plaid, encrypted tokens |
| Backend | **Firebase** (Firestore + Cloud Functions) — absorbed from FinApp | Serverless, existing rules |
| Bank connect | **Plaid** (already in FinApp) | Encrypted tokens at rest, app never sees secret |
| Crypto connect | OKX / MetaMask (our stack), read for net worth; write only with approval | Adds asset classes |
| **Desktop widget** | **.NET / WPF (C#)** — recommended | Real always-on native desktop tile, best "widget" feel on Windows |
| Developer SDK/API | REST + local agent (Python/TS) hook, extends tab-sync session summarisation | Turn internal memory tool into a feature |
| Data security | Client-side encryption + server ciphertext (see SECURITY.md) | Multi-layered trust backbone |
| Offline/local | Local encrypted DB + Edge accessory for widget data | Offline-first law |

## 2. High-level architecture

```
┌──────────────────────────────────────────────────────────────┐
│  CLIENTS                                                    │
│  [Mobile app (Expo)]   [Desktop Widget (.NET/WPF)]  [Web]   │
│  [Developer SDK hook (AI terminal session summariser)]      │
└───────────────┬──────────────────────────────────────────────┘
                │  TLS, auth (MFA), approval gates, audit
┌───────────────▼──────────────────────────────────────────────┐
│  ASSISTANT ENGINE (core domain)                              │
│  · Net-worth aggregator    · Asset catalog                   │
│  · People ops              · Automation + approval engine    │
│  · Session summariser (dev hook)                             │
└───────┬──────────────────────────────┬───────────────────────┘
        │ Client-side encryption        │ Connectors
┌───────▼──────────┐        ┌───────────▼──────────────────────┐
│ STORAGE          │        │ CONNECTORS                       │
│ Local encrypted  │        │ Plaid (banks) · OKX/MetaMask     │
│ DB + Firestore   │        │ (crypto) · MoMo/payrails (+approval)│
│ (ciphertext)     │        └──────────────────────────────────┘
└──────────────────┘
```

## 3. Domain model (core entities)

- **Principal** — the asset owner (the rich person).
- **Steward** — authorized handler (family office, trustee, advisor, manager); has
  scoped permissions within the Principal's trust.
- **Holding / Entity** — asset-holding company, SPV, trust, family company.
- **Asset** — bank account, crypto wallet/exchange, property, vehicle, business
  stake, liability. Each has a **value source**, **liquidity class**, **custodian**.
- **Trust / Permission** — what a Steward may view/act on; revocation anytime.
- **Money Move** — a proposed transfer/payment with **approval state** (draft →
  pending → approved → executed / rejected).
- **People & Commitments** — staff, dependents, school fees, bills, renewals.
- **Session** (developer hook) — a summarized AI/coding session (what was done,
  decisions, open threads, next steps).

## 4. Multi-currency & net worth
- Store amounts with `{amount, currency, fx_rate_at}`; compute net worth in a base
  currency using latest rates (open.er-api or similar, no key) — reuse the money
  agent's `market_pulse` approach.
- Cache valuations; refresh live when online.

## 5. Desktop widget (.NET/WPF) — interactive tile
- **Idle:** compact always-on-top tile showing headline metric(s) (net worth,
  pending approvals count). Glass/NEBULA style, low footprint.
- **Interact:** click/shortcut → **flip/expand** into a mini command panel cycling
  card summaries; **send back** to tile/minimize to tray; **summon forward** anytime
  (never lost). Inline actions: approve a pending Money Move, mark task done,
  snooze reminder.
- Deep-link through any card to the full app.
- **Service law:** single instance (PID lock + port probe), status snapshot
  (`widget/status.json`), log (`widget/service.log`), self-heal, resume from last
  checkpoint, minimal traffic.

## 6. Developer AI-terminal hook
- Local watcher (Python/TS) on AI/coding sessions; on session end, **auto-summarises**
  the session data and stores it; recallable later.
- Reuses/extends the **tab-sync + session-memory system** already built for opencode.
- Exposed as an **SDK/API** so external developers can plug their own AI terminals
  into the assistant and get persistence + summaries.

## 7. Security implementation
- Client-side encryption by default; KDF-derived on-device key; per-record keys.
- TLS everywhere, cert pinning, MFA/passkeys.
- Role-based access (Principal / Steward / read-only).
- Approval gates + escalation on high-risk actions; immutable audit log; kill
  switch; emergency lock/wipe; export-anytime.
- Full detail: `SECURITY.md`.

## 8. Absorbing FinApp
- Reuse `app/` (Expo app) as the mobile client — auth, tabs, Plaid link, encrypted
  token flow.
- Reuse `functions/` (Firebase Cloud Functions) for Plaid link/exchange/sync.
- Reuse `firestore.rules` as the security-rules baseline, then extend for the
  trust/permission model.
- Extend, don't fork: keep the working bank-connect engine intact.
