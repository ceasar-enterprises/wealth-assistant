/* Push a live pending money move into the packaged (release) app so the
 * reviewer can exercise inherent approve -> MFA-confirm -> audited flow in the
 * real engine. Runs against the RELEASE build's own state + audit files.
 */
const fs = require('fs');
const path = require('path');

const devRoot = path.resolve(__dirname, '..');
const releaseRoot = process.env.WHERE
  ? path.resolve(process.env.WHERE)
  : path.join(devRoot, 'release/WealthCommand/resources/app/widget');

const { proposeMove, auditEntry, auditToLine } = require(path.join(releaseRoot, '../backend/dist/core/index.js'));

const STATE_FILE = path.join(releaseRoot, 'data/demo-state.json');
const AUDIT_FILE = path.join(releaseRoot, 'data/audit.jsonl');

if (!fs.existsSync(STATE_FILE)) {
  console.error('No demo state at ' + STATE_FILE);
  process.exit(1);
}

const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));

const res = proposeMove(
  {
    description: 'Vesting purchase - SEED Fund (Series B)',
    direction: 'out',
    amount: 12000,
    currency: 'USD',
    payee: 'SEED Fund - escrow account',
    rail: 'wire',
  },
  'steward:maria@family-office',
  true,
);

if (!res.ok) {
  console.error('proposeMove failed: ' + res.reason);
  process.exit(1);
}

state.moves.push(res.move);
fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));

const entry = auditEntry({
  trustId: 'demo-trust',
  actorUid: 'steward:maria@family-office',
  actorRole: 'steward',
  action: 'money_move.proposed',
  detail: { moveId: res.move.id, amount: res.move.amount, highRisk: res.move.highRisk },
});
fs.appendFileSync(AUDIT_FILE, JSON.stringify(entry) + '\n');

const pending = state.moves.filter((m) => m.state === 'pending').length;
console.log(auditToLine(entry));
console.log('pending=' + pending + ' | state file: ' + STATE_FILE);