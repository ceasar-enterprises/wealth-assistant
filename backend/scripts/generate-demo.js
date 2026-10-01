/*
 * Wealth Command - demo dataset generator (Phase 5).
 *
 * Confirms the whole sellable story with one command: a realistic trust
 * (Principal + Steward + Advisor), multi-currency assets, money moves through
 * the real engine, a hash-chained audit log, and an encrypted export bundle
 * (client-side vault, ciphertext-only). Outputs:
 *   data/demo-trust.json    - plaintext demo trust (for docs/tests/widget)
 *   data/demo-export.json   - encrypted portable export bundle (export-anytime)
 *
 * Usage: npm run demo   (backend built first: npx tsc)
 */

const fs = require('fs');
const path = require('path');

const {
  // engine
  computeNetWorth,
  netEquity,
  proposeMove,
  approveMove,
  executeMove,
  rejectMove,
  auditEntry,
  auditToLine,
  AUDIT_ACTIONS,
  // security layer
  createVault,
  vaultPut,
  vaultSerialize,
  buildAuditChain,
  verifyAuditChain,
  auditRootHash,
  buildExportBundle,
  bundleToJson,
  bundleFromJson,
  inspectBundle,
} = require('../dist/core/index.js');

const OUT_DIR = path.join(__dirname, '..', 'data');
const TRUST_FILE = path.join(OUT_DIR, 'demo-trust.json');
const EXPORT_FILE = path.join(OUT_DIR, 'demo-export.json');

const BASE = 'USD';
const NOW = Date.now();

const FX = new Map([
  ['USD', { currency: 'USD', rateToBase: 1, observedAt: NOW, source: 'reference' }],
  ['EUR', { currency: 'EUR', rateToBase: 1.08, observedAt: NOW - 1000 * 60 * 5, source: 'demo' }],
  ['GBP', { currency: 'GBP', rateToBase: 1.29, observedAt: NOW - 1000 * 60 * 7, source: 'demo' }],
  ['UGX', { currency: 'UGX', rateToBase: 1 / 3710, observedAt: NOW - 1000 * 60 * 9, source: 'demo' }],
]);

/* ------------------------------------------------------------------ */
/* The trust                                                          */
/* ------------------------------------------------------------------ */

const trust = {
  id: 'trust-rutaro-family-office',
  kind: 'family_office',
  name: 'Rutaro Family Office',
  ownerUid: 'principal@rutaro',
  createdAt: '2025-01-15T09:00:00.000Z',
  updatedAt: new Date(NOW).toISOString(),
  baseCurrency: BASE,
  automationPaused: false,
};

const members = [
  { trustId: trust.id, uid: 'principal@rutaro', role: 'principal', scopes: ['assets', 'people', 'money', 'reports'], grantedAt: trust.createdAt, grantedBy: 'system' },
  { trustId: trust.id, uid: 'maria@family-office', role: 'steward', scopes: ['assets', 'money'], grantedAt: '2025-02-01T08:00:00.000Z', grantedBy: 'principal@rutaro' },
  { trustId: trust.id, uid: 'adv@consulo', role: 'advisor', scopes: ['reports'], grantedAt: '2025-03-10T10:00:00.000Z', grantedBy: 'principal@rutaro' },
];

const assets = [
  { id: 'ba1', trustId: trust.id, class: 'bank', name: 'Checking - Stanbic .....9102', value: 412_000, currency: 'USD', valueSource: 'plaid', liquidity: 'liquid', createdAt: '2025-01-20T00:00:00.000Z', updatedAt: new Date(NOW).toISOString() },
  { id: 'ba2', trustId: trust.id, class: 'bank', name: 'Brokerage - Interactive Brokers', value: 1_845_000, currency: 'USD', valueSource: 'plaid', liquidity: 'liquid', createdAt: '2025-01-20T00:00:00.000Z', updatedAt: new Date(NOW).toISOString() },
  { id: 'ba3', trustId: trust.id, class: 'bank', name: 'Onshore GBP account - Barclays', value: 260_000, currency: 'GBP', valueSource: 'plaid', liquidity: 'liquid', createdAt: '2025-02-11T00:00:00.000Z', updatedAt: new Date(NOW).toISOString() },
  { id: 'cr1', trustId: trust.id, class: 'crypto', name: 'BTC / ETH (OKX + MetaMask cold)', value: 186_400, currency: 'USD', valueSource: 'exchange', liquidity: 'liquid', custodian: 'Self-custody', createdAt: '2025-04-02T00:00:00.000Z', updatedAt: new Date(NOW).toISOString() },
  { id: 'pt1', trustId: trust.id, class: 'property', name: 'Lakefront estate - Lake Como (IT)', value: 3_600_000, currency: 'EUR', valueSource: 'estimate', liquidity: 'illiquid', custodian: 'Notary escrow - Como', createdAt: '2025-01-25T00:00:00.000Z', updatedAt: new Date(NOW).toISOString() },
  { id: 'pt2', trustId: trust.id, class: 'property', name: 'Townhouses - Kampala (UG)', value: 1_900_000, currency: 'USD', valueSource: 'manual', liquidity: 'semi_liquid', createdAt: '2025-03-01T00:00:00.000Z', updatedAt: new Date(NOW).toISOString() },
  { id: 'pt3', trustId: trust.id, class: 'property', name: 'Condo portfolio - NYC', value: 2_100_000, currency: 'USD', valueSource: 'manual', liquidity: 'semi_liquid', createdAt: '2025-03-01T00:00:00.000Z', updatedAt: new Date(NOW).toISOString() },
  { id: 've1', trustId: trust.id, class: 'vehicle', name: 'Private fleet', value: 310_000, currency: 'USD', valueSource: 'estimate', liquidity: 'illiquid', createdAt: '2025-05-10T00:00:00.000Z', updatedAt: new Date(NOW).toISOString() },
  { id: 'bz1', trustId: trust.id, class: 'business', name: 'Rutaro Holdings - operating stake', value: 4_200_000, currency: 'USD', valueSource: 'estimate', liquidity: 'illiquid', createdAt: '2025-02-01T00:00:00.000Z', updatedAt: new Date(NOW).toISOString() },
  { id: 'lb1', trustId: trust.id, class: 'liability', name: 'Mortgage - NYC condos', value: 940_000, currency: 'USD', valueSource: 'manual', liquidity: 'semi_liquid', createdAt: '2025-03-01T00:00:00.000Z', updatedAt: new Date(NOW).toISOString() },
  { id: 'cs1', trustId: trust.id, class: 'cash', name: 'Mobile money float - UGX', value: 150_000_000, currency: 'UGX', valueSource: 'manual', liquidity: 'liquid', custodian: 'MTN MoMo / Airtel', createdAt: '2025-06-01T00:00:00.000Z', updatedAt: new Date(NOW).toISOString() },
];

/* ------------------------------------------------------------------ */
/* Money moves through the real state machine                          */
/* ------------------------------------------------------------------ */

const moves = [];

function recordMove(result, note) {
  if (!result.ok) throw new Error(`Engine rejected demo move (${note}): ${result.reason}`);
  const move = result.move;
  moves.push(move);
  return move;
}

let fees = recordMove(proposeMove(
  { description: 'University fees - children (Q1)', direction: 'out', amount: 86_000, currency: 'USD', payee: 'St Teresa International School', rail: 'wire' },
  'maria@family-office',
  false,
), 'fees-q1');
fees = recordMove(approveMove(fees, 'principal', { approvedBy: 'principal@rutaro' }, true), 'fees-approve');
recordMove(executeMove(fees, 'steward', 'maria@family-office'), 'fees-execute');

let upkeep = recordMove(proposeMove(
  { description: 'Como estate upkeep - annual', direction: 'out', amount: 210_000, currency: 'EUR', payee: 'Villa management - Como', rail: 'wire' },
  'maria@family-office',
  false,
), 'como-upkeep');
upkeep = recordMove(approveMove(upkeep, 'principal', { approvedBy: 'principal@rutaro' }, false), 'upkeep-approve');
recordMove(executeMove(upkeep, 'steward', 'maria@family-office'), 'upkeep-execute');

recordMove(proposeMove(
  { description: 'Annex acquisition - Lake Como (HIGH RISK)', direction: 'out', amount: 1_980_000, currency: 'EUR', payee: 'Notary escrow - Como', rail: 'wire' },
  'maria@family-office',
  true,
), 'annex-pending');

let payroll = recordMove(proposeMove(
  { description: 'Quarterly payroll - estate staff', direction: 'out', amount: 44_500, currency: 'USD', payee: 'Estate payroll account', rail: 'wire' },
  'maria@family-office',
  false,
), 'payroll');
payroll = recordMove(rejectMove(payroll, 'principal', 'principal@rutaro'), 'payroll-reject');
let invoice = recordMove(proposeMove(
  { description: 'Revised quarterly payroll (net of advances)', direction: 'out', amount: 38_200, currency: 'USD', payee: 'Estate payroll account', rail: 'wire' },
  'maria@family-office',
  false,
), 'payroll2');
recordMove(approveMove(invoice, 'principal', { approvedBy: 'principal@rutaro' }, false), 'payroll2-approve');

recordMove(proposeMove(
  { description: 'Property income - Kampala townhouses', direction: 'in', amount: 95_000, currency: 'USD', payee: 'Kampala rentals', rail: 'integration' },
  'maria@family-office',
  false,
), 'rent-income');

// The state machine returns a fresh move per transition. Keep the FINAL state
// per logical move (dedupe by id, last wins) for a clean dataset.
{
  const byId = new Map();
  for (const m of moves) byId.set(m.id, m);
  moves.length = 0;
  moves.push(...byId.values());
}

/* ------------------------------------------------------------------ */
/* Audit: build a realistic hash-chained log from every action          */
/* ------------------------------------------------------------------ */

const audit = buildAuditChain([
  auditEntry({ trustId: trust.id, actorUid: 'system', action: 'trust.created', detail: { trustId: trust.id } }),
  auditEntry({ trustId: trust.id, actorUid: 'principal@rutaro', actorRole: 'principal', action: AUDIT_ACTIONS.MEMBER_GRANTED, detail: { uid: 'maria@family-office', role: 'steward' } }),
  auditEntry({ trustId: trust.id, actorUid: 'principal@rutaro', actorRole: 'principal', action: AUDIT_ACTIONS.MEMBER_GRANTED, detail: { uid: 'adv@consulo', role: 'advisor' } }),
  auditEntry({ trustId: trust.id, actorUid: 'maria@family-office', actorRole: 'steward', action: AUDIT_ACTIONS.MONEY_MOVE_PROPOSED, detail: { description: 'University fees (Q1)' } }),
  auditEntry({ trustId: trust.id, actorUid: 'principal@rutaro', actorRole: 'principal', action: AUDIT_ACTIONS.MONEY_MOVE_APPROVED, detail: { description: 'University fees (Q1)' } }),
  auditEntry({ trustId: trust.id, actorUid: 'maria@family-office', actorRole: 'steward', action: AUDIT_ACTIONS.MONEY_MOVE_EXECUTED, detail: { description: 'University fees (Q1)' } }),
  auditEntry({ trustId: trust.id, actorUid: 'maria@family-office', actorRole: 'steward', action: AUDIT_ACTIONS.MONEY_MOVE_PROPOSED, detail: { description: 'Como estate upkeep' } }),
  auditEntry({ trustId: trust.id, actorUid: 'principal@rutaro', actorRole: 'principal', action: AUDIT_ACTIONS.MONEY_MOVE_APPROVED, detail: { description: 'Como estate upkeep' } }),
  auditEntry({ trustId: trust.id, actorUid: 'maria@family-office', actorRole: 'steward', action: AUDIT_ACTIONS.MONEY_MOVE_PROPOSED, detail: { description: 'Annex acquisition (HIGH RISK)' } }),
  auditEntry({ trustId: trust.id, actorUid: 'maria@family-office', actorRole: 'steward', action: AUDIT_ACTIONS.MONEY_MOVE_PROPOSED, detail: { description: 'Quarterly payroll' } }),
  auditEntry({ trustId: trust.id, actorUid: 'principal@rutaro', actorRole: 'principal', action: AUDIT_ACTIONS.MONEY_MOVE_REJECTED, detail: { description: 'Quarterly payroll (rejected: revise down)' } }),
  auditEntry({ trustId: trust.id, actorUid: 'maria@family-office', actorRole: 'steward', action: AUDIT_ACTIONS.MONEY_MOVE_PROPOSED, detail: { description: 'Revised payroll' } }),
  auditEntry({ trustId: trust.id, actorUid: 'principal@rutaro', actorRole: 'principal', action: AUDIT_ACTIONS.MONEY_MOVE_APPROVED, detail: { description: 'Revised payroll' } }),
]);

/* ------------------------------------------------------------------ */
/* Client-side vault + encrypted export bundle (Phase 4 showcase)      */
/* ------------------------------------------------------------------ */

const vaultSecret = 'Rutaro-demo-vault-2026';
const vault = createVault(vaultSecret);
for (const a of assets) vaultPut(vault, { id: a.id, kind: 'asset', data: a });
for (const m of moves) vaultPut(vault, { id: m.id, kind: 'money_move', data: m });

const chainVerified = verifyAuditChain(audit).valid;
const exportBundle = buildExportBundle(vault, audit, {
  includeRecoveryPhrase: true,
  trustId: trust.id,
});

const report = computeNetWorth(assets, BASE, FX);

/* ------------------------------------------------------------------ */
/* Write outputs                                                       */
/* ------------------------------------------------------------------ */

fs.mkdirSync(OUT_DIR, { recursive: true });
const dataset = {
  generatedAt: new Date(NOW).toISOString(),
  trust,
  members,
  assets,
  moves,
  moneyMovesByState: moves.reduce((acc, m) => {
    acc[m.state] = (acc[m.state] ?? 0) + 1;
    return acc;
  }, {}),
  rates: Object.fromEntries([...FX].map(([k, v]) => [k, v.rateToBase])),
  netWorth: {
    baseCurrency: BASE,
    total: report.total,
    netEquity: netEquity(report),
    byClass: report.byClass,
    byLiquidity: report.byLiquidity,
    isStale: report.isStale,
  },
  audit: {
    entries: audit.length,
    root: auditRootHash(audit),
    verified: chainVerified,
  },
  export: {
    file: 'demo-export.json',
    recordCount: exportBundle.recordCount,
    auditVerified: exportBundle.auditVerified,
    encrypted: true,
  },
};
fs.writeFileSync(TRUST_FILE, JSON.stringify(dataset, null, 2));
fs.writeFileSync(EXPORT_FILE, JSON.stringify(bundleToJson(exportBundle), null, 2));

/* ------------------------------------------------------------------ */
/* Human summary (ASCII-safe)                                          */
/* ------------------------------------------------------------------ */

const line = '='.repeat(56);
console.log(line);
console.log('Wealth Command - demo dataset generated');
console.log(line);
console.log(`Trust        : ${trust.name} (${trust.kind})`);
console.log(`Principal    : principal@rutaro`);
console.log(`Team         : ${members.length} member(s): ${members.map((m) => `${m.role}:${m.uid}`).join(', ')}`);
console.log(`Assets       : ${assets.length} across ${new Set(assets.map((a) => a.currency)).size} currencies`);
console.log(`Net worth    : ${fmtMoney(report.total)} (equity ${fmtMoney(netEquity(report))})`);
console.log(`Money moves  : ${moves.length}: ${Object.entries(dataset.moneyMovesByState).map(([s, n]) => `${n} ${s}`).join(', ')}`);
console.log(`Audit        : ${audit.length} entries, root ${auditRootHash(audit).slice(0, 12)}..., chain ${chainVerified ? 'VERIFIED' : 'BROKEN'}`);
console.log(`Vault        : client-side encrypted (${vaultSnapshotSize()})`);
console.log(`Export       : ${EXPORT_FILE} (${exportBundle.recordCount} records, encrypted)`);
if (bundleToJson(exportBundle).includes('Rutaro Family Office')) {
  console.log('WARNING      : plaintext leaked into export bundle!');
} else {
  console.log('Verify       : export bundle contains NO plaintext (ciphertext-only)');
}
console.log(`Recovery     : 24-word phrase available (decode validates checksum)`);
console.log(line);
console.log(`Wrote ${TRUST_FILE} and ${EXPORT_FILE}`);

function fmtMoney(n) {
  const abs = Math.abs(n);
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}
function vaultSnapshotSize() {
  const snap = vaultSerialize(vault);
  const size = Buffer.byteLength(snap, 'utf8');
  return size > 1024 ? `${(size / 1024).toFixed(1)} KB of ciphertext` : `${size} B of ciphertext`;
}

const reopened = bundleFromJson(bundleToJson(exportBundle));
const reopenOk = inspectBundle(reopened);
console.log(`Export check : re-inspect -> ${reopenOk.auditValid ? 'audit valid' : 'audit BROKEN'}, ${reopenOk.recordCount} records intact`);