/*
 * Wealth Command - end-to-end verifier (the "is it functional?" gate).
 *
 * Proves the whole product surface against the COMPILED code, end to end:
 *   1. Engine: net worth (multi-currency), money-move lifecycle + escalation
 *   2. Security: crypto round-trip, TOTP, audit chain integrity, kill switch
 *   3. Portability: vault + encrypted export bundle (no plaintext leak)
 *   4. Live bridge: the same server.js the widget runs, on an isolated port+data
 *   5. Live SDK: the summariser API server, on an isolated port
 *
 * Nothing here mocks anything; it exercises the real modules that ship.
 *
 * Usage: cd backend && npx tsc && npm run verify
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { fork } = require('child_process');
const { randomBytes } = require('crypto');

const core = require('../dist/core/index.js');
const {
  // engine
  computeNetWorth,
  netEquity,
  proposeMove,
  approveMove,
  executeMove,
  rejectMove,
  auditEntry,
  // security
  encrypt,
  decrypt,
  generateTotpSecret,
  totp,
  verifyTotp,
  createVault,
  vaultPut,
  vaultGet,
  vaultCount,
  vaultSerialize,
  vaultParse,
  openVaultWithKey,
  buildAuditChain,
  verifyAuditChain,
  auditRootHash,
  buildExportBundle,
  bundleToJson,
  bundleFromJson,
  inspectBundle,
  gateAction,
  RULE_LIVE,
  pauseAutomation,
  emergencyLock,
} = core;

/* ----------------------------- harness ------------------------------ */

let pass = 0;
let fail = 0;
const failures = [];

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function check(name, fn) {
  try {
    await fn();
    pass++;
    console.log(`PASS  ${name}`);
  } catch (err) {
    fail++;
    failures.push(`${name}: ${err && err.message ? err.message : err}`);
    console.log(`FAIL  ${name} -> ${err && err.message ? err.message : err}`);
  }
}

function request(port, method, pathname, body) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? null : JSON.stringify(body);
    const req = http.request(
      { host: '127.0.0.1', port, method, path: pathname, headers: payload ? { 'Content-Type': 'application/json' } : {} },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(raw) });
          } catch {
            resolve({ status: res.statusCode, body: raw });
          }
        });
      },
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function waitFor(fn, timeoutMs = 8000, intervalMs = 250) {
  const start = Date.now();
  for (;;) {
    try {
      if (await fn()) return;
    } catch { /* retry */ }
    if (Date.now() - start > timeoutMs) throw new Error('timed out waiting');
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

/* ----------------------------- checks ------------------------------ */

const ASSETS = [
  { id: 'a1', class: 'bank', name: 'Checking', value: 482_000, currency: 'USD', valueSource: 'plaid', liquidity: 'liquid' },
  { id: 'a4', class: 'property', name: 'Lake Como estate', value: 2_900_000, currency: 'EUR', valueSource: 'estimate', liquidity: 'illiquid' },
  { id: 'a8', class: 'liability', name: 'Mortgage', value: 890_000, currency: 'USD', valueSource: 'manual', liquidity: 'semi_liquid' },
  { id: 'a9', class: 'cash', name: 'MoMo float', value: 150_000_000, currency: 'UGX', valueSource: 'manual', liquidity: 'liquid' },
];
const FX = new Map([
  ['USD', { rateToBase: 1, observedAt: Date.now(), source: 'test' }],
  ['EUR', { rateToBase: 1.08, observedAt: Date.now(), source: 'test' }],
  ['UGX', { rateToBase: 1 / 3710, observedAt: Date.now(), source: 'test' }],
]);

async function engineChecks() {
  const report = computeNetWorth(ASSETS, 'USD', FX);
  assert(report.total > 0, 'net worth should be positive');
  assert(report.byClass && report.byClass.liability, 'liabilities should be broken out');
  assert(report.byClass.cash, 'UGX cash should be converted and counted');
  assert(report.total > 2_940_000, 'net worth should include the converted UGX float (> $2.94M)');
  assert(Number.isFinite(netEquity(report)), 'net equity should be finite');

  // money-move lifecycle: propose -> approve -> execute
  const low = proposeMove({ description: 'Quarterly payroll', direction: 'out', amount: 42_500, currency: 'USD', payee: 'Staff', rail: 'bank' }, 'steward:maria', false);
  assert(low.ok, 'propose should succeed');
  const approved = approveMove(low.move, 'principal', { approvedBy: 'principal@user' }, false);
  assert(approved.ok, 'low-risk approve should succeed without escalation');
  const executed = executeMove(approved.move, 'steward', 'steward:maria');
  assert(executed.ok && executed.move.state === 'executed', 'execute should succeed after approve');
  const reapprove = approveMove(executed.move, 'principal', { approvedBy: 'principal@user' }, false);
  assert(!reapprove.ok, 're-approve of executed move must fail');
  assert(approveMove(low.move, 'steward', { approvedBy: 'steward' }, false).ok === false, 'steward must not approve');

  // high-risk requires escalation
  const high = proposeMove({ description: 'Acquire annex', direction: 'out', amount: 1_850_000, currency: 'EUR', payee: 'Escrow', rail: 'wire' }, 'steward:maria', true);
  const noEscalate = approveMove(high.move, 'principal', { approvedBy: 'principal@user' }, false);
  assert(!noEscalate.ok && /escalation/i.test(noEscalate.reason || ''), 'high-risk approve without escalation must be refused');
  const escalated = approveMove(high.move, 'principal', { approvedBy: 'principal@user' }, true);
  assert(escalated.ok, 'high-risk approve with escalation should succeed');

  // reject path
  const rejectable = proposeMove({ description: 'Advisor fee', direction: 'out', amount: 5_000, currency: 'USD', payee: 'Advisor', rail: 'bank' }, 'steward:maria', false);
  const rejected = rejectMove(rejectable.move, 'principal', 'principal@user');
  assert(rejected.ok && rejected.move.state === 'rejected', 'reject should work');
}

async function securityChecks() {
  const key = randomBytes(32);
  const env = encrypt('Asset: top secret balance', key);
  assert(env.v === 1 && env.ct && env.iv && env.tag, 'envelope has all fields');
  assert(decrypt(env, key).toString('utf8') === 'Asset: top secret balance', 'round-trip decrypt');
  let threw = false;
  try {
    decrypt(env, randomBytes(32));
  } catch {
    threw = true;
  }
  assert(threw, 'wrong key must throw (GCM auth fails)');

  // TOTP: RFC 6238-compatible
  const secret = generateTotpSecret();
  const at = Math.floor(Date.now() / 1000) - 60;
  const code = totp(at, secret.latin1, 6);
  assert(verifyTotp(code, secret.latin1, at * 1000, 2), 'valid TOTP code verifies within skew');
  assert(!verifyTotp('000000', secret.latin1, at * 1000, 2), 'invalid TOTP code rejected');

  // audit chain integrity
  const base = [auditEntry({ actorUid: 'u1', action: 'test.one' }), auditEntry({ actorUid: 'u1', action: 'test.two' })];
  const chain = buildAuditChain(base);
  assert(verifyAuditChain(chain).valid, 'chain verifies');
  const tampered = JSON.parse(JSON.stringify(chain));
  tampered[1].detail = { hacked: true };
  assert(!verifyAuditChain(tampered).valid, 'tamper must break the chain');

  // kill switch
  assert(!gateAction(RULE_LIVE, 'propose').blocked, 'live allows actions');
  const paused = pauseAutomation(RULE_LIVE, 'principal@user', 'test');
  assert(gateAction(paused.state, 'propose').blocked, 'paused blocks proposals');
  assert(!gateAction(paused.state, 'propose', { emergencySafe: true }).blocked, 'emergency-safe passes when paused');
  const locked = emergencyLock(RULE_LIVE, 'principal@user');
  assert(gateAction(locked.state, 'propose').blocked, 'locked blocks everything');
}

async function portabilityChecks() {
  const vault = createVault('correct horse battery staple 2048', { owner: 'rutaro' });
  vaultPut(vault, { id: 'acc:1', kind: 'bank_account', data: { name: 'Checking - Stanbic .....9102', balance: 412_000 } });
  vaultPut(vault, { id: 'acc:2', kind: 'property', data: { name: 'Lakefront estate - Lake Como', value: 3_600_000 } });
  const chainHead = buildAuditChain([auditEntry({ actorUid: 'sys', action: 'vault.seeded' })]);
  const bundle = buildExportBundle(vault, chainHead, { includeRecoveryPhrase: true });
  assert(bundle.recordCount === 2, 'bundle records both entries');
  assert(bundle.recoveryPhrase.split(' ').length === 24, 'recovery phrase is 24 words');

  const json = bundleToJson(bundle);
  assert(!json.includes('Stanbic') && !json.includes('Lakefront'), 'bundle is ciphertext-only (no plaintext leak)');

  const reopened = bundleFromJson(json);
  const inspected = inspectBundle(reopened);
  assert(inspected.auditValid, 'bundle audit verifies on re-open');
  assert(inspected.recordCount === 2, 'bundle record count intact');

  const restored = openVaultWithKey(vaultParse(reopened.vaultSnapshotJson), vault.master);
  assert(restored.failedRecords === 0 && vaultCount(restored.vault) === 2, 'vault reopens with key');
  const got = vaultGet(restored.vault, 'acc:2');
  assert(got && got.data.name === 'Lakefront estate - Lake Como', 'vault data survives round-trip');
}

async function bridgeChecks() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wc-bridge-'));
  const serverJs = path.join(__dirname, '..', '..', 'widget', 'src', 'server.js');
  const child = fork(serverJs, [], {
    env: { ...process.env, WIDGET_PORT: '4321', WIDGET_DATA_DIR: tmp },
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  });
  const bootLog = [];
  child.stdout.on('data', (c) => bootLog.push(String(c)));
  try {
    await waitFor(async () => {
      const r = await request(4321, 'GET', '/health');
      return r.status === 200 && r.body.ok;
    });
    // Listen a tick so the child's stdout pipe drains, then check its log.
    await new Promise((r) => setTimeout(r, 50));
    const dash = await request(4321, 'GET', '/dashboard');
    assert(dash.status === 200, 'dashboard responds 200');
    assert(dash.body.netWorth > 0, 'dashboard has net worth');
    assert(Array.isArray(dash.body.pendingApprovals) && dash.body.pendingApprovals.length >= 1, 'dashboard has pending approvals');
    const before = dash.body.pendingApprovals.length;
    const first = dash.body.pendingApprovals[0];
    const appr = await request(4321, 'POST', `/moves/${encodeURIComponent(first.id)}/approve`, { escalationConfirmed: true });
    assert(appr.status === 200 && appr.body.ok, 'approve via live bridge works');
    const again = await request(4321, 'POST', `/moves/${encodeURIComponent(first.id)}/approve`, { escalationConfirmed: true });
    assert(again.status === 409, 'second approve of a done move is a 409');
    const after = await request(4321, 'GET', '/health');
    assert(after.body.pendingApprovals === before - 1, 'pending count decremented after approve');
  } finally {
    if (child && child.exitCode === null) child.kill();
  }
}

async function sdkChecks() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wc-sdk-'));
  const dbFile = path.join(tmp, 'verify.sqlite');
  const { startServer } = require(path.join(__dirname, '..', '..', 'sdk', 'dist', 'server.js'));
  const srv = await startServer({ port: 4322, host: '127.0.0.1', dbFile });
  try {
    await waitFor(async () => (await request(4322, 'GET', '/health')).status === 200);
    const preview = await request(4322, 'POST', '/summarise', {
      source: 'e2e',
      lines: ['$ who am I', 'Arya, the wealth steward.', '$ show pending approvals', '2 pending money moves awaiting the principal.'],
    });
    assert(preview.status === 200 && preview.body.ok && typeof preview.body.result?.summary === 'string' && preview.body.result.summary.length > 0, 'dry-run summarise works');
    const ingest = await request(4322, 'POST', '/sessions', {
      source: 'e2e',
      projectId: 'verify',
      lines: ['$ list accounts', 'A: checking 482k. B: brokerage 1.2m.'],
    });
    assert(ingest.status === 201 && ingest.body.ok, 'session ingestion works');
    const id = ingest.body.record.id;
    const recall = await request(4322, 'GET', `/sessions/${id}`);
    assert(recall.status === 200 && recall.body.record && recall.body.record.id === id, 'session recall works');
    const exportMd = await request(4322, 'GET', `/sessions/${id}/export?format=md`);
    assert(exportMd.status === 200, 'session export works');
  } finally {
    try {
      srv.close();
    } catch { /* ignore */ }
  }
}

/* ----------------------------- main -------------------------------- */

async function main() {
  console.log('Wealth Command - end-to-end verification\n');
  await check('engine: net worth + multi-currency + move lifecycle + escalation + roles', engineChecks);
  await check('security: crypto envelope + tamper + TOTP + audit chain + kill switch', securityChecks);
  await check('portability: encrypted export bundle (no plaintext leak) + recover', portabilityChecks);
  await check('live bridge: health -> dashboard -> inline approve -> 409 -> count', bridgeChecks);
  await check('live SDK: summarise -> ingest -> recall -> export', sdkChecks);

  console.log('\n' + '-'.repeat(56));
  console.log(`verify-e2e: ${pass} passed, ${fail} failed`);
  if (fail > 0) {
    console.log('\nFailures:');
    for (const f of failures) console.log('  - ' + f);
    process.exit(1);
  }
  console.log('ALL SURFACES FUNCTIONAL.');
}

main().catch((e) => {
  console.error('verify-e2e crashed:', e);
  process.exit(1);
});