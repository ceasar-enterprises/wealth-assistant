# POSITIONING — Positioning + pricing tiers (proposal for Ceasar)

> Working title: **Wealth Command**. This doc proposes the go-to-market
> narrative, target segments, and pricing tiers. Numbers and names are
> **proposals** — Ceasar decides final brand, pricing, and payment rails.

## Positioning statement

**Wealth Command is the command center for people who own significant assets
and the professionals who handle them.**

For wealthy individuals, asset-holding companies, family offices, and property
managers, Wealth Command is a multi-layered-secure stewardship platform that
aggregates net worth across currencies, lets the Principal approve every money
move with one click, keeps a tamper-evident audit trail, and never lets the
owner's data exist in plaintext outside their control. Unlike a typical
dashboard, Wealth Command treats the Principal as the disposer of money and
the software as the proposal engine — "automation proposes, the Principal
disposes."

For developers, wealth-command-sdk turns any AI/coding session into a
structured report (done / decisions / open threads / next steps) with recall,
history, and export — the session-memory system on top of a plain API.

## Segments

| Segment | Who | Pain we remove | Where we win |
|---|---|---|---|
| Private Wealth | Individuals with diverse holdings (bank, crypto, property, business) | Fragmented accounts, stale net-worth picture | One command center; approve moves from a desktop tile |
| Family Office / Stewards | Trustees, asset managers, property managers | Approval chaos + liability ("who approved that?") | RBAC + escalation + immutable audit log |
| Holding Companies | UHNW operating companies | Multi-entity, multi-currency confusion | Trust container per entity; cross-currency net worth |
| Developers | AI-terminal / automation builders | No structured session memory | SDK + REST + CLI, auto-summary, export |

## Pricing tiers (proposal)

All tiers share the security backbone (client-side encryption, vault +
recovery phrase, audit chain, kill switch, export-anytime). Tiers differ in
**people, entities, and volume**, not in safety.

### 1. Private — for one Principal
- One trust (individual estate), own assets, unlimited read views.
- Full net-worth aggregation + money-move approvals + audit.
- Desktop widget included.
- **Proposed:** $19/mo billed yearly ($228/yr) or $29/mo month-to-month.

### 2. Family Office — for a Principal + team
- Everything in Private, plus:
  - Up to **5 stewards** (scoped, revocable) + up to **10 advisors** (read-only).
  - Approval escalation (high-risk moves need MFA/co-approval).
  - Multi-entity up to **3 trusts** (holding co, estate, family office).
- **Proposed:** $79/mo yearly ($948/yr) or $99/mo month-to-month.

### 3. Enterprise / White-label — for asset-holding companies & property managers
- Everything in Family Office, plus:
  - Unlimited trusts/entities, SSO, custom roles, priority support.
  - On-prem/private-cloud option for zero-knowledge deployments.
  - White-label dashboard (Steward's own brand).
- **Proposed:** custom quote (annual, per entity tier); typical floor $400/mo.

### 4. Developer (wealth-command-sdk)
- Session summariser hook + REST API + CLI + SDK.
- Private usage (own sessions): **free tier** — up to N sessions/mo.
- Teams / embedded product: per-seat developer license + hosted queue.
- **Proposed:** free ≤ 200 sessions/mo; $15/seat/mo unlimited; enterprise based
  on volume.

## Payment rails (open question)
- Staff/mobile money: MTN MoMo / Airtel Money — **record + approve first,
  execution later** (this is exactly the Money-Move flow).
- International: Stripe/PayPal for USD/EUR subscribers, crypto (OKX/MetaMask)
  for enterprise — pending Ceasar's rails decision.

## Go-to-market angles retained
1. **Wealth Commander** — the control narrative (approve everything, audit
   everything, nothing moves without the Principal).
2. **White-Glove Concierge** — the convenience narrative (the widget surfaces
   what matters, the Assistant summarises every session).

## Open items (to be decided by Ceasar)
- Final product name & brand.
- Pricing numbers above (benchmark: e.g. Monarch/Empower/Pilot style family
  subscriptions run $10-40/mo individual, $100-400/mo family-office software).
- Billing rails (MoMo/Stripe/crypto).
- Free-tier scope for the SDK.