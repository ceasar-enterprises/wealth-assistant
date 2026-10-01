# USER_FLOW — How each persona interacts, step by step

## Persona 1 — The Principal (the rich person)

**Onboarding**
1. Sign up with email/password → set a **Master Secret** that derives the
   client-side encryption key (never sent to server).
2. Set base currency, add first assets (connect a bank via Plaid, or add
   property/vehicle/crypto manually).
3. Enroll MFA/passkey. Create a **recovery phrase** (encrypted backup) and store it.
4. Invite a Steward (family office / property manager) with scoped permission.

**Daily use**
5. See **net worth** on the mobile app / desktop widget.
6. Widget tile shows headline (net worth + pending approvals).
7. Click widget → flips open → cycle cards (net worth / approvals / activity).
8. Tap "Approve" on a pending Money Move → confirm with passkey/MFA → done, logged.
9. Send widget back to tile / summon forward anytime.

**Stewardship oversight**
10. View the Steward's actions in the audit log (who/what/when/from where).
11. Revoke a Steward's access instantly if needed.
12. Emergency-lock or wipe the device remotely if the phone is lost.

**Control**
13. Propose a Money Move yourself or approve one the Steward proposed.
14. Set the kill switch (pause all automation) anytime.

## Persona 2 — The Steward (asset handler)

1. Accept invite → sees a scoped view of only what the Principal granted.
2. View the part of the portfolio they manage (e.g., properties, staff payroll).
3. **Propose** a Money Move (e.g., pay staff wages) → lands "pending".
4. Cannot execute high-value moves alone — needs Principal approval (escalation).
5. Run tasks (dispatch staff, mark upkeep done), set reminders for renewals/fees.
6. Every action is recorded; the Principal can see it all.

## Persona 3 — The Developer (AI-terminal hook)

1. Run the assistant's watcher against their AI terminal / coding session.
2. On session end, the assistant **auto-summarises**: what was done, decisions,
   open threads, next steps.
3. Summaries are stored and can be **recalled** later ("what were we doing?").
4. Via the SDK/API, hook any AI terminal into the assistant for per-project
   persistent context and summaries.

## Shared: Approval + Audit mental model
- Automation and stewards **propose**; the **Principal disposes** (approves/rejects).
- Everything material is **audit-logged**.
- High-value actions require explicit approval + MFA; never silent auto-execution.
