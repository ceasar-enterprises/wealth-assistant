# DEPLOYMENT — Running, distributing, and validating Wealth Command

> Covers: prerequisites, build order, running the live widget (bridge + tile),
> the developer SDK (CLI + REST), the demo dataset, portable packaging, and the
> service law every long-running component obeys.

## Prerequisites
- **Node.js v24+** (`node:sqlite` is used by the SDK; door for older is v22.5+).
- npm 10+.
- No native modules, no Docker, no global install required.

## Build order (fastest path to a running product)
```cmd
cd wealth-assistant\backend
npx tsc                    & rem compile engine + security layer
npm test                   & rem 59/59
cd ..\sdk
npm install                & rem file:../backend -> already built
npm run build
npm test                   & rem 17/17
cd ..\widget
npm install                & rem brings Electron ^33.4.11
```
FinApp surfaces: `cd app && npx tsc --noEmit` and `cd functions && npx tsc --noEmit`.

## Running the live desktop widget (the demo product)
Two processes, both service-law compliant (single instance, status.json,
service.log, self-heal):

1. **Bridge server** on `127.0.0.1:4170` (overridable via `WIDGET_PORT`):
   ```cmd
   cd wealth-assistant\widget
   node src\server.js
   ```
   - PID lock `data\widget-server.pid`; a second start refuses (`Refusing duplicate`).
   - Health: `curl http://127.0.0.1:4170/health`
   - Dashboard: `curl http://127.0.0.1:4170/dashboard`
   - Approve: `POST /moves/<id>/approve`  ·  Reject: `POST /moves/<id>/reject`
   - Demo trust (re)generated on first boot into `data\demo-state.json`.

2. **Electron tile** (the always-on-top widget window):
   ```cmd
   cd wealth-assistant\widget
   node_modules\.bin\electron.cmd src\main.js
   ```
   - Collapsed 320x96 tile -> click -> expanded 360x420 command panel.
   - `Ctrl+Alt+W` summons / sends back; tray keeps it alive (close hides).
   - Approve inline (high-risk moves require the 2FA-style confirm), reject.
   - Self-heal: renderer reload on crash; position + state persisted.

### Windows one-click launchers (recommended)
Ship these three `.cmd` files (they start hidden, log to `data\`):
- `launchers\wc-server.cmd`  -> starts the bridge
- `launchers\wc-tile.cmd`    -> starts the tile
- `launchers\wc-sdk-server.cmd` -> starts the SDK REST server (port 4171)

## Developer SDK
- **CLI** (after `cd sdk`): `node dist/cli.js --help` (summarize / list /
  recall / history / count / remove / export / serve / status).
- **REST** on `127.0.0.1:4171` (`WEALTH_SDK_PORT`): `/health`, `/summarise`,
  `/sessions`, `/sessions/:id/history`, `/sessions/:id/export`, `/count`.
- Storage: `sdk\wealth-sdk.sqlite` (node:sqlite, zero native deps).
- Session hook: `createSessionHook().onSessionEnd(session)` from
  `@wealth-command/sdk` — see `src/hook.ts`.

## Demo dataset (Phase 5)
```cmd
cd wealth-assistant\backend
npm run demo
```
Writes `data\demo-trust.json` (plaintext trust) + `data\demo-export.json`
(encrypted export bundle). Verifies: 6 money moves across all states, 13-entry
hash-chained audit (root hash), client-side vault with 17 ciphertext-only
records, NO plaintext leaks into the export, recovery phrase available, and the
bundle re-opens with audit valid.

## Portable packaging (ship-ready folder)
```cmd
cd wealth-assistant\widget
node scripts\package.js        & rem creates release\WealthCommand\
node scripts\package.js --zip  & rem + release\WealthCommand-v0.1.0.zip
```
Produces a **portable** distribution of the widget (Electron runtime + app +
compiled backend) with a `Wealth Command.cmd` launcher and a branded `$` icon.
No installer needed; copy the folder to another Windows machine and run the
launch script. `--zip` also emits a clean zip for sharing (runtime recreates
its data dir on first launch). The tile always bundles its bridge server: if
`:4170` is dark it self-spawns it; if a bridge already answers it never
duplicates it.

## Install / autostart (make it "just work")
```cmd
cd wealth-assistant\widget
npm run install        & rem Desktop + Start Menu + Startup (release build)
npm run install:dev    & rem same, pointing at the repo dev launcher
npm run uninstall      & rem remove all three shortcuts
```
The release build launches on Windows logon (hidden, lives in the tray). Icons
are regenerated at package time (no binary assets to keep in the repo).

## End-to-end verification (the functional gate)
```cmd
cd wealth-assistant\backend
npx tsc && npm run verify
```
Exercises the COMPILED product, no mocks: engine (net worth, multi-currency,
money-move lifecycle + high-risk escalation + roles), security (crypto
envelope, TOTP, audit-chain tamper detection, kill switch), portability
(encrypted export bundle with a no-plaintext-leak check + recovery), and a
LIVE bridge + LIVE SDK server on isolated ports. Exit 0 = all five surfaces
functional; the widget's live demo state is never touched (`WIDGET_DATA_DIR`
isolates the verifier).

## Service law (every long-running process)
1. One instance (PID lock; duplicates refuse + log).
2. Last status in `data\status.json` / `widget-status.json`.
3. Self-heal: log the failure, then restart/keep serving.
4. Resume, don't rebuild (checkpointed state + persisted demo data).
5. Minimal traffic (quiet periodic checks, no double-polls).

## Security notes (Phase 4 posture)
- Client-side vault: AES-256-GCM per-record keys wrapped under a scrypt-derived
  master key; snapshots are ciphertext-only.
- Recovery: BIP-39-style 24-word phrase encodes the master key (8-bit checksum
  validated on decode).
- Audit: SHA-256 hash-chained, tamper-evident, root hash anchorable externally.
- Kill switch: live/paused/locked + armed wipe; emergencies block automation.
- TOTP (RFC 6238) for MFA-style escalation on high-risk approvals.
- Roadmap: TLS cert pinning on the mobile/cloud side, Firestore anchoring of
  the audit root.

## Verification checklist (sale-ready gate)
| Check | Command | Expect |
|---|---|---|
| Engine + security | `backend: npx tsc && npm test` | 59/59 |
| SDK | `sdk: npm run build && npm test` | 17/17 |
| FinApp | `app: npx tsc --noEmit` / `functions: ...` | exit 0 |
| E2E (all surfaces) | `backend: npx tsc && npm run verify` | 5/5 passed |
| Widget health | `curl http://127.0.0.1:4170/health` | ok:true |
| SDK health | `curl http://127.0.0.1:4171/health` | ok:true |
| Demo | `backend: npm run demo` | audit VERIFIED, no plaintext leak |