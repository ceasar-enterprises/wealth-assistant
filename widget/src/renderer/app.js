/* Wealth Command tile UI logic.
 * Collapsed -> compact net-worth chip.
 * Click -> flip/expand to mini command panel (net worth, approvals, portfolio),
 * inline approve/reject with MFA confirm for high-risk moves.
 */

const tileEl = document.getElementById('tile');
const panelEl = document.getElementById('panel');
const formatter = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const state = {
  dashboard: null,
  expanded: false,
  busy: new Set(),
};

function fmt(n) {
  if (n === undefined || n === null || Number.isNaN(n)) return '--';
  return formatter.format(n);
}
function fmtShort(n) {
  if (n === undefined || n === null) return '--';
  const abs = Math.abs(n);
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

async function refresh() {
  const res = await window.wealth.dashboard();
  if (res.ok) {
    state.dashboard = res.data;
    renderTile();
    if (state.expanded) renderPanel();
  } else {
    document.getElementById('panelFoot').innerHTML =
      `<span class="status err">Bridge offline - retrying...</span>`;
  }
}

function renderTile() {
  const d = state.dashboard;
  if (!d) return;
  document.getElementById('tileValue').textContent = fmtShort(d.netWorth);
  const badge = document.getElementById('approvalBadge');
  const count = d.pendingApprovals.length;
  badge.hidden = count === 0;
  badge.textContent = String(count);
  const stale = document.getElementById('staleBadge');
  stale.hidden = !d.isStale;
}

function renderPanel() {
  const d = state.dashboard;
  if (!d) return;
  document.getElementById('panelNetWorth').textContent = fmt(d.netWorth);
  const equity = d.netEquity;
  document.getElementById('panelSub').textContent =
    `${fmt(equity)} equity${d.isStale ? ' * cached' : ''} * ${d.byClass ? Object.keys(d.byClass).length : 0} classes`;

  // Approvals
  const list = document.getElementById('approvalList');
  if (d.pendingApprovals.length === 0) {
    list.innerHTML = `<div class="empty">No pending approvals.</div>`;
  } else {
    list.innerHTML = '';
    for (const mv of d.pendingApprovals) {
      list.appendChild(approvalNode(mv));
    }
  }

  // Portfolio / liquidity
  const liq = document.getElementById('liquidityList');
  liq.innerHTML = '';
  for (const [key, value] of Object.entries(d.byLiquidity || {})) {
    const row = document.createElement('div');
    row.className = 'liquidity-row';
    const label = key.replace('_', ' ');
    row.innerHTML = `<span>${label}</span><span class="amt">${fmt(value)}</span>`;
    liq.appendChild(row);
  }

  document.getElementById('assetSub').textContent =
    d.unconverted > 0 ? `${d.unconverted} asset(s) not yet converted` : 'All assets converted';

  const foot = document.getElementById('panelFoot');
  foot.innerHTML = `<span>${d.isStale ? 'stale rates' : 'live rates'} * ${new Date(d.computedAt).toLocaleTimeString()}</span><span class="status">secure</span>`;
}

function approvalNode(mv) {
  const el = document.createElement('div');
  el.className = 'approval' + (mv.highRisk ? ' danger' : '');

  const top = document.createElement('div');
  top.className = 'approval-top';
  const desc = document.createElement('span');
  desc.className = 'approval-desc';
  desc.textContent = mv.description;
  const amt = document.createElement('span');
  amt.className = 'approval-amt';
  amt.textContent = `${mv.direction === 'out' ? '-' : '+'} ${fmt(mv.amount)} ${mv.currency}`;
  top.append(desc, amt);

  const meta = document.createElement('div');
  meta.className = 'approval-meta';
  meta.textContent = `${mv.payee || 'Unknown payee'}${mv.highRisk ? ' * HIGH RISK - requires 2FA confirm' : ''}`;

  const actions = document.createElement('div');
  actions.className = 'approval-actions';

  const approveBtn = document.createElement('button');
  approveBtn.className = 'btn approve';
  approveBtn.textContent = 'Approve';
  approveBtn.disabled = state.busy.has(mv.id);
  approveBtn.addEventListener('click', async () => {
    if (mv.highRisk) {
      const confirmed = window.confirm(
        `High-risk move: ${fmt(mv.amount)} ${mv.currency} to ${mv.payee}. Confirm with 2FA-style escalation?`,
      );
      if (!confirmed) return;
    }
    state.busy.add(mv.id);
    approveBtn.disabled = true;
    approveBtn.textContent = '...';
    const res = await window.wealth.approve(mv.id, mv.highRisk);
    state.busy.delete(mv.id);
    await refresh();
  });

  const rejectBtn = document.createElement('button');
  rejectBtn.className = 'btn reject';
  rejectBtn.textContent = 'Reject';
  rejectBtn.disabled = state.busy.has(mv.id);
  rejectBtn.addEventListener('click', async () => {
    state.busy.add(mv.id);
    rejectBtn.disabled = true;
    await window.wealth.reject(mv.id);
    state.busy.delete(mv.id);
    await refresh();
  });

  actions.append(approveBtn, rejectBtn);
  el.append(top, meta, actions);
  return el;
}

/* --------------------------------------------------------- */
/* Flip / expand                                             */
/* --------------------------------------------------------- */

function setExpanded(value) {
  state.expanded = value;
  window.wealth.setCollapsed(!value);
  if (value) {
    tileEl.hidden = true;
    panelEl.hidden = false;
    panelEl.classList.remove('flip-in');
    void panelEl.offsetWidth;
    panelEl.classList.add('flip-in');
    renderPanel();
  } else {
    panelEl.hidden = true;
    tileEl.hidden = false;
    renderTile();
  }
}

tileEl.addEventListener('click', () => setExpanded(true));
tileEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    setExpanded(true);
  }
});
document.getElementById('closePanel').addEventListener('click', () => setExpanded(false));

window.wealth.onRefresh(refresh);

/* Boot: query immediately, then quietly on a schedule. */
refresh();
setInterval(refresh, 30_000);