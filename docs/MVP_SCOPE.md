# MVP_SCOPE — What's in v1 vs Out, Success Criteria

## 1. MVP goal
Prove the **Wealth Command center + interactive desktop widget + developer session
hook + multi-layered security** as a coherent, sellable product — with real data,
real asset visibility, and real control — while keeping a trusted, private foundation.

## 2. In scope for v1 (the "thin vertical slice")
We build what proves the whole story, not every feature:

1. **Wealth Command Center (core)**
   - Net-worth view from connected banks (Plaid, absorbed from FinApp) + manually
     added assets (property, vehicles, crypto, liabilities, business stakes).
   - Multi-currency aggregation into a base currency; live + stale-cache behavior.
   - Asset catalog CRUD with value source + liquidity class + custodian.
2. **Trust / Permissions model**
   - Principal + at least one Steward role with scoped, revocable permissions.
   - Read-only share for an advisor.
3. **Money Move + approval gate**
   - Propose a payment/transfer → pending → Principal approves (or rejects) →
     audit-logged. No auto-execution of high-value moves.
4. **Interactive desktop widget (Windows, .NET/WPF)**
   - Live tile (net worth + pending approvals), flip/expand to mini panel, inline
     approve a pending Money Move, send-back/summon-forward, deep-link.
   - Service-law compliant (single instance, status, self-heal).
5. **Developer AI-terminal hook**
   - Auto-summarise a session (data: what was done, decisions, open threads, next
     steps), store + recall. SDK/API for external devs.
6. **Multi-layered security baseline**
   - Client-side encryption by default, TLS, MFA/passkeys (at least TOTP), RBAC,
     approval escalation, immutable audit log, export-anytime, kill switch,
     emergency lock.
7. **Data trust / portability**
   - One-click export; plain-language terms; no data selling (positioning).

## 3. Out of scope for v1 (later)
- Live execution of mass payroll / real transfers to external rails (we record +
  approve; wiring actual rail calls = later after Ceasar grants a domain).
- Full robo-advisor / auto-trading.
- Comprehensive tax engine (we do a filing calendar, not full computation).
- Multi-family-office billing/invoicing portal.
- iOS/Android widget *and* desktop widget in same v1 (desktop widget first; mobile
  app is the existing Expo client).

## 4. Success criteria (must pass to call v1 done)
- A Principal can see a **live net worth** (banks + manual assets, multi-currency)
  that updates when online and serves a cached value offline.
- A Steward can be granted scoped access and **revoked**; a read-only advisor share
  works.
- A Money Move can be proposed and **approved/rejected with a full audit trail**,
  never auto-executed without approval.
- The **desktop widget** shows the headline metric, flips open, and lets the
  Principal **approve a pending move inline**; it is single-instance and self-heals.
- A tracked developer session is **auto-summarised** and recallable; the SDK works
  for an external harness.
- Security: asset data is client-side-encrypted by default; export works; audit log
  is complete; kill switch pauses automation.
- **Existing FinApp bank-connect engine still works** (no regression).

## 5. Phasing (for DEV_PLAN)
- **Phase 1:** Architecture + absorb FinApp + trust/permission + net-worth core.
- **Phase 2:** Desktop widget (tile, flip, approve-inline).
- **Phase 3:** Developer AI-terminal hook (session summariser + SDK).
- **Phase 4:** Security hardening + export + audit + kill switch.
- **Phase 5:** Packaging, demo dataset, docs, polishing for sale.
