# PRD — "Wealth Command" — Personal Assistant for the Rich & Asset Stewards

**Version:** 0.1 (draft)
**Owner:** Ceasar / Arya
**Status:** Scoping

---

## 1. Problem

Rich individuals and the professionals who steward their assets (asset-holding
companies, family offices, trustees, advisors, property managers) operate complex,
fragmented financial worlds: many banks, crypto, property, vehicles, business
stakes, liabilities, and staff. Today they stitch this together across spreadsheets,
emails, and separate apps. There is no single command center that:

- Shows a live, trustworthy **net worth** from every asset class at once.
- Lets an asset handler act on it (pay, move, approve) **with control**.
- Keeps the data **private by design** — the single biggest reason the wealthy
  refuse to digitize their finances.

Generic "wealth management" tools ignore local realities (multi-currency, mobile
money, staff payroll, raw land/property in holding companies, family commitments)
and the AI assistants on the market are consumer-grade with weak security.

## 2. Product vision

**Wealth Command** — a multi-layered-secure asset-stewardship platform that acts
as the **personal assistant for the wealthy and the people who handle their assets**.
One command center for net worth, assets, people, and automation — delivered through
a mobile/web app, a **live interactive desktop widget**, and a **developer API hook**
that summarises AI/coding session data.

## 3. Two target markets

### Market A — The rich & their asset handlers (PRIMARY)
- High-net-worth individuals.
- **Asset-holding companies** (SPVs, investment vehicles, family companies).
- **People who handle assets for the rich**: multi-family offices, trustees,
  advisors, accountants, property/estate managers.
- Jobs-to-be-done: see everything at a glance, act with approvals, prove stewardship,
  keep it private.

### Market B — Developers (via the AI-terminal hook)
- Developers and teams who work in AI terminals / coding agents.
- Jobs-to-be-done: automatically **summarise a session's data** (what was done,
  decisions, open threads, next steps) so no context is ever lost.
- This turns our internal tab-sync/session-memory system into a sellable feature.

> Both markets share the same product core; the widget and the developer hook are
> two surface integrations on top of the "assistant" engine.

## 4. Value pillars

1. **Total stewardship** — every asset, connected and net-worth-ready.
2. **Control, not just visibility** — automation proposes, the owner approves
   (approval gates, audit trail).
3. **Privacy by design** — multi-layered security is the product, not the fine print.
4. **Always present** — a live interactive desktop widget that is never lost,
   plus mobile/web.
5. **Locally-aware + offline-first** — works on unreliable internet, multi-currency,
   mobile money, real-world asset realities.
6. **For the developers** — AI-terminal session summarisation as a first-class hook.

## 5. Personas

- **Persona 1 — "The Principal" (the rich person).** Owns assets; wants visibility,
  control, and to never worry; wants a private, dignified tool. Low tolerance for
  complexity; high concern about security.
- **Persona 2 — "The Steward" (asset handler).** Runs the Principal's affairs —
  properties, staff payroll, investments, bills. Needs to *act* on assets with
  defined authority and full audit, and report back to the Principal.
- **Persona 3 — "The Developer."** Uses AI terminals; wants sessions auto-summarised
  and recalled so project context persists.

## 6. High-level scope (pillars)

1. **Wealth Command Center** (net worth, multi-currency, all asset classes).
2. **Assets & holdings** (bank/FinApp connect, crypto, property, vehicles, business
   stakes, liabilities).
3. **People ops** (staff payroll with approval gates, tasks, family commitments).
4. **Automation engine** (rules + human approval + full audit log).
5. **Interactive desktop widget** (live tile, flip/expand, inline approve, summon).
6. **Developer AI-terminal hook** (session summarisation + recall, SDK/API).
7. **Multi-layered security** (see SECURITY.md) — the trust backbone.
8. **Data trust & portability** (local-first, export-anytime, no data selling).

## 7. Non-goals (v1)

- Not a robo-advisor / auto-trading of live money without approval.
- Not a payroll *processing* gateway (we flag/approve/record; payment rails are
  connectors).
- Not a general social/consumer finance app.
- No ad-supported model ever.

## 8. Success metrics
- Net-worth number loads in < 1s from stale cache, refreshed live when online.
- Widget: approve a payment in < 3 interactions without opening the app.
- Security: all PII/asset data encrypted at rest + client-side by default; export
  available anytime; no plaintext secrets.
- Developer hook: auto-summary generated for every tracked session without manual
  prompting.

## 9. Open decisions (for Ceasar)
- Product name & brand (working title "Wealth Command").
- Pricing tiers & packaging (subscription vs hybrid license).
- Widget tech (Windows desktop via .NET/WPF recommended) — confirm.
- Data residency / zero-knowledge posture to advertise.
- Which payment rails to connect for mobile-money/staff payroll (MTN MoMo, etc.).
