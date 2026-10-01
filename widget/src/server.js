/*
 * Wealth Command - local bridge server.
 *
 * Serves the desktop tile its data over a localhost API. In this MVP it runs a
 * realistic demo trust through the REAL backend engine (net worth + money moves)
 * so the tile is fully demoable. Later, this same API shape proxies the Firebase
 * cloud functions.
 *
 * Service law: single instance (PID lock), status snapshot, service log,
 * self-heal, minimal traffic. Deliberately dependency-free (Node stdlib) so the
 * widget starts fast and ships without install hassle.
 */

const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  computeNetWorth,
  proposeMove,
  approveMove,
  auditEntry,
  auditToLine,
} = require('../../backend/dist/core/index.js');

const PORT = process.env.WIDGET_PORT || 4170;
const HOST = '127.0.0.1';
const ROOT = path.join(__dirname, '..');
// WIDGET_DATA_DIR lets supervisors/verifiers run an isolated instance
// (e.g. tests) without touching the live demo state.
const DATA_DIR = process.env.WIDGET_DATA_DIR
  ? path.resolve(process.env.WIDGET_DATA_DIR)
  : path.join(ROOT, 'data');
const LOCK_FILE = path.join(DATA_DIR, 'widget-server.pid');
const STATUS_FILE = path.join(DATA_DIR, 'status.json');
const LOG_FILE = path.join(DATA_DIR, 'service.log');
const AUDIT_FILE = path.join(DATA_DIR, 'audit.jsonl');
const STATE_FILE = path.join(DATA_DIR, 'demo-state.json');

function ensureDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
function log(level, msg) {
  const line = `[${new Date().toISOString()}] ${level}: ${msg}\n`;
  fs.appendFileSync(LOG_FILE, line);
  // Subtle status: always log the last state.
  writeStatus({ lastLog: line.trim() });
}
function writeStatus(extra) {
  const status = {
    service: 'wealth-widget-server',
    pid: process.pid,
    startedAt: STATUS.startedAt,
    restartCount: STATUS.restartCount,
    port: PORT,
    host: HOST,
    uptimeSec: Math.round((Date.now() - STATUS.startedAtMs) / 1000),
    lastSnapshot: new Date().toISOString(),
    ...extra,
  };
  const tmp = STATUS_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(status, null, 2));
  fs.renameSync(tmp, STATUS_FILE);
}

/* ------------------------------------------------------------------ */
/* Single-instance guard (PID lock)                                    */
/* ------------------------------------------------------------------ */

function acquireLock() {
  ensureDir();
  if (fs.existsSync(LOCK_FILE)) {
    const oldPid = Number(fs.readFileSync(LOCK_FILE, 'utf8').trim());
    if (oldPid && isProcessAlive(oldPid)) {
      log('warn', `Refusing to start: another server (pid ${oldPid}) holds the lock.`);
      console.error(`Wealth widget server already running (pid ${oldPid}). Refusing duplicate.`);
      process.exit(1);
    }
    // Stale lock from a dead process -> recover.
    log('info', `Stale lock (pid ${oldPid}) reclaimed.`);
  }
  fs.writeFileSync(LOCK_FILE, String(process.pid));
  log('info', `Lock acquired (pid ${process.pid}).`);
}

let didCleanup = false;
function releaseLock() {
  if (didCleanup) return;
  didCleanup = true;
  try {
    if (fs.existsSync(LOCK_FILE) && Number(fs.readFileSync(LOCK_FILE, 'utf8')) === process.pid) {
      fs.unlinkSync(LOCK_FILE);
    }
  } catch {
    /* best-effort */
  }
}
process.on('exit', releaseLock);
process.on('SIGINT', () => {
  releaseLock();
  process.exit(0);
});
process.on('SIGTERM', () => {
  releaseLock();
  process.exit(0);
});

function isProcessAlive(pid) {
  if (!pid || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e && e.code === 'EPERM';
  }
}

/* ------------------------------------------------------------------ */
/* Demo trust state (drives the engine)                                */
/* ------------------------------------------------------------------ */

const USD = { rateToBase: 1, observedAt: Date.now(), source: 'reference' };
const FX = new Map([
  ['USD', USD],
  ['EUR', { currency: 'EUR', rateToBase: 1.08, observedAt: Date.now() - 1000 * 60 * 5, source: 'demo' }],
  ['UGX', { currency: 'UGX', rateToBase: 1 / 3710, observedAt: Date.now() - 1000 * 60 * 9, source: 'demo' }],
]);

function demoState() {
  if (fs.existsSync(STATE_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    } catch {
      /* regenerate */
    }
  }
  const state = {
    baseCurrency: 'USD',
    assets: [
      { id: 'a1', class: 'bank', value: 482_000, currency: 'USD', valueSource: 'plaid', liquidity: 'liquid', name: 'Checking - Chase .....4821' },
      { id: 'a2', class: 'bank', value: 1_215_000, currency: 'USD', valueSource: 'plaid', liquidity: 'liquid', name: 'Brokerage - Fidelity' },
      { id: 'a3', class: 'crypto', value: 128_400, currency: 'USD', valueSource: 'exchange', liquidity: 'liquid', name: 'BTC / ETH (OKX + MetaMask)' },
      { id: 'a4', class: 'property', value: 2_900_000, currency: 'EUR', valueSource: 'estimate', liquidity: 'illiquid', name: 'Lakefront estate - Lake Como' },
      { id: 'a5', class: 'property', value: 1_450_000, currency: 'USD', valueSource: 'manual', liquidity: 'semi_liquid', name: 'Condo portfolio - NYC' },
      { id: 'a6', class: 'vehicle', value: 215_000, currency: 'USD', valueSource: 'estimate', liquidity: 'illiquid', name: 'Private fleet' },
      { id: 'a7', class: 'business', value: 3_200_000, currency: 'USD', valueSource: 'estimate', liquidity: 'illiquid', name: 'Holding Co - operating stake' },
      { id: 'a8', class: 'liability', value: 890_000, currency: 'USD', valueSource: 'manual', liquidity: 'semi_liquid', name: 'Mortgage - NYC condos' },
      { id: 'a9', class: 'cash', value: 60_000_000, currency: 'UGX', valueSource: 'manual', liquidity: 'liquid', name: 'Mobile money float - UGX' },
    ],
    moves: [],
  };
  // Seed two pending money moves through the REAL engine.
  const m1 = proposeMove(
    { description: 'Pay estate staff payroll (quarter)', direction: 'out', amount: 42_500, currency: 'USD', payee: 'Estate payroll acc', rail: 'wire' },
    'steward:maria@family-office',
    false,
  );
  const m2 = proposeMove(
    { description: 'Property acquisition - Lake Como annex', direction: 'out', amount: 1_850_000, currency: 'EUR', payee: 'Notary escrow - Como', rail: 'wire' },
    'steward:maria@family-office',
    true,
  );
  if (m1.ok && m2.ok) state.moves = [m1.move, m2.move];
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  return state;
}

function persist(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  writeStatus({ pendingApprovals: state.moves.filter((m) => m.state === 'pending').length });
}

function totalReport(state) {
  const report = computeNetWorth(state.assets, state.baseCurrency, FX);
  return report;
}

function approvals(state) {
  return state.moves.filter((m) => m.state === 'pending').map((m) => ({
    id: m.id,
    description: m.description,
    direction: m.direction,
    amount: m.amount,
    currency: m.currency,
    payee: m.payee,
    rail: m.rail,
    highRisk: m.highRisk,
    proposedBy: m.proposedBy,
    proposedAt: m.proposedAt,
    state: m.state,
  }));
}

/* ------------------------------------------------------------------ */
/* Self-heal: if the tile vanishes, keep serving; log it.              */
/* ------------------------------------------------------------------ */

let lastClientSeen = null;
setInterval(() => {
  if (!lastClientSeen) return;
  const idleMs = Date.now() - lastClientSeen;
  if (idleMs > 10 * 60 * 1000) {
    log('info', `No widget client for ${Math.round(idleMs / 60000)}m - staying alive quietly.`);
  }
}, 60_000); // minimal traffic: a status check per minute, only logging on long idle

/* ------------------------------------------------------------------ */
/* HTTP handlers                                                       */
/* ------------------------------------------------------------------ */

function sendJson(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
  });
}

async function handler(req, res) {
  lastClientSeen = Date.now();
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const parts = url.pathname.split('/').filter(Boolean);
  const method = req.method;

  try {
    // Health - used by the tile and external watchers.
    if (method === 'GET' && parts[0] === 'health') {
      const state = demoState();
      return sendJson(res, 200, {
        ok: true,
        pendingApprovals: state.moves.filter((m) => m.state === 'pending').length,
      });
    }

    // Dashboard snapshot the tile renders.
    if (method === 'GET' && parts[0] === 'dashboard') {
      const state = demoState();
      const report = totalReport(state);
      return sendJson(res, 200, {
        baseCurrency: state.baseCurrency,
        netWorth: report.total,
        byClass: report.byClass,
        byLiquidity: report.byLiquidity,
        netEquity: report.total - (report.byClass.liability ?? 0),
        isStale: report.isStale,
        computedAt: report.computedAt,
        pendingApprovals: approvals(state),
        unconverted: report.unconverted.length,
      });
    }

    // Approve a pending money move (the tile's inline action).
    if (method === 'POST' && parts[0] === 'moves' && parts[1] && parts[2] === 'approve') {
      const body = await readBody(req);
      const state = demoState();
      const move = state.moves.find((m) => m.id === parts[1]);
      if (!move) return sendJson(res, 404, { error: 'Move not found' });
      const res2 = approveMove(move, 'principal', { approvedBy: 'principal@user' }, Boolean(body.escalationConfirmed));
      if (!res2.ok) return sendJson(res, 409, { error: res2.reason });
      move.state = res2.move.state;
      move.approvedBy = res2.move.approvedBy;
      move.approvedAt = res2.move.approvedAt;
      // High-risk moves require a second factor - in the real system that's MFA;
      // in this demo the tile passes escalationConfirmed=true only after the
      // confirm modal.
      persist(state);
      const entry = auditEntry({
        trustId: 'demo-trust',
        actorUid: 'principal@user',
        actorRole: 'principal',
        action: 'money_move.approved',
        detail: { moveId: move.id, amount: move.amount, highRisk: move.highRisk },
      });
      fs.appendFileSync(AUDIT_FILE, JSON.stringify(entry) + '\n');
      log('info', auditToLine(entry));
      return sendJson(res, 200, { ok: true, move });
    }

    // Reject.
    if (method === 'POST' && parts[0] === 'moves' && parts[1] && parts[2] === 'reject') {
      const state = demoState();
      const move = state.moves.find((m) => m.id === parts[1]);
      if (!move) return sendJson(res, 404, { error: 'Move not found' });
      if (move.state !== 'pending') return sendJson(res, 409, { error: 'Move is not pending' });
      move.state = 'rejected';
      move.rejectedBy = 'principal@user';
      move.rejectedAt = new Date().toISOString();
      persist(state);
      const entry = auditEntry({
        trustId: 'demo-trust',
        actorUid: 'principal@user',
        actorRole: 'principal',
        action: 'money_move.rejected',
        detail: { moveId: move.id, amount: move.amount },
      });
      fs.appendFileSync(AUDIT_FILE, JSON.stringify(entry) + '\n');
      log('info', auditToLine(entry));
      return sendJson(res, 200, { ok: true, move });
    }

    sendJson(res, 404, { error: 'Not found' });
  } catch (e) {
    log('error', `Handler failed: ${e && e.stack ? e.stack : e}`);
    sendJson(res, 500, { error: 'Internal error' });
  }
}

/* ------------------------------------------------------------------ */
/* Boot                                                                */
/* ------------------------------------------------------------------ */

const STATUS = {
  startedAt: null,
  startedAtMs: Date.now(),
  restartCount: 0,
};
setInterval(writeStatus, 15_000).unref();

(function boot() {
  ensureDir();
  // Track restart count for self-heal visibility.
  if (fs.existsSync(STATUS_FILE)) {
    try {
      const prev = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8'));
      STATUS.restartCount = (prev.restartCount || 0) + 1;
    } catch { /* fresh start */ }
  }
  STATUS.startedAt = new Date().toISOString();
  acquireLock();

  const server = http.createServer(handler);
  server.listen(PORT, HOST, () => {
    writeStatus({ listening: true });
    log('info', `Wealth widget bridge listening on http://${HOST}:${PORT}`);
    console.log(`Wealth widget bridge on http://${HOST}:${PORT} (pid ${process.pid})`);
  });
  server.on('error', (e) => {
    // Self-heal: if a port conflict killed us, log + exit gracefully.
    if (e.code === 'EADDRINUSE') {
      log('error', `Port ${PORT} in use - another bridge is running. Exiting.`);
      releaseLock();
      process.exit(1);
    }
    throw e;
  });

  // Self-heal: uncaught errors are logged (never silent).
  process.on('uncaughtException', (e) => {
    log('error', `Uncaught: ${e && e.stack ? e.stack : e}`);
    // Do not crash the tile's data surface silently - but honor the law: log, then exit.
    releaseLock();
    process.exit(1);
  });
})();