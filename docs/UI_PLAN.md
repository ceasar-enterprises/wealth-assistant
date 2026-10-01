# UI_PLAN — Interface & output formats

## 1. Surfaces
- **Mobile app** (Expo, absorbed from FinApp): primary stewardship + control UI.
- **Desktop widget** (.NET/WPF, Windows): the interactive always-on tile.
- **Web** (optional, later): browser dashboard.
- **Developer SDK**: programmatic interface, not a visual UI.

## 2. Visual language
- Inherit **NEBULA glass** aesthetic (neon accents, glass cards) but tuned to a
  **premium/trustworthy** feel for the wealthy: restrained, dark, elegant,
  high-contrast numbers, minimal clutter. Gold/neutral accents (align with the
  Ceasar Enterprises brand).
- Typography: large clear numerals for money; generous whitespace.
- Consistent "security is visible" cues: a padlock/verified state on secure views,
  an "audit" indicator, a subtle "encrypted locally" watermark.

## 3. Mobile app screens (extend existing FinApp tabs)
- **Net Worth (home):** headline number, asset-class breakdown, trend, last-updated
  stamp, offline badge. Tap an asset class to drill in.
- **Assets:** catalog (bank / crypto / property / vehicles / business / liabilities),
  value source, liquidity class, custodian, add/edit.
- **Money & Approvals:** list of proposed Money Moves with status; approve/reject
  with MFA. Full history.
- **People & Trust:** stewards/advisor list, scoped permissions, revoke; audit log;
  kill switch.
- **Goals / Commitments:** family fees, renewals, staff, reminders (reuse FinApp
  goals structure).
- **Security:** encryption status, recovery phrase, export, sessions, MFA.

## 4. Desktop widget (Windows) — interactive tile
- **Idle tile:** small always-on-top chip: net worth + pending-approval badge.
- **Flip/expand:** click → expands to a **mini command panel** ~ small grid of cards
  (Net Worth, Approvals, Activity, People). Click a card → deep-link to the mobile/
  web app for full detail.
- **Inline action:** on an approval card, Approve/Reject buttons right in the panel;
  confirm with passkey/MFA.
- **Send back / summon forward:** a "minimize to tray" (send back) and a global
  hotkey / right-click (summon forward). Never lost.
- **Service-law chrome:** status dot; single-instance guard; quiet updates.

## 5. Output formats
- **Audit report:** printable/exportable log (PDF/CSV) of actions.
- **Net-worth report:** exportable snapshot (CSV/Word/PDF) — reuse our report writing
  capability for the Principals.
- **Developer summary:** JSON (machine-readable) + Markdown (human readable) for a
  session (what was done / decisions / open threads / next steps).

## 6. Trust/security UI
- First-open **security primer**: plain-language "we cannot read your data; you hold
  the keys; export anytime" — the trust message front and center.
- Clear share/revoke controls with instant effect.
- "Export my data" button always one tap away.
