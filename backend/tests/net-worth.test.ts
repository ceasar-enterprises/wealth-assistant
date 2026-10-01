import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  computeNetWorth,
  netEquity,
  type Asset,
  type FxRate,
} from '../dist/core/index.js';

function asset(partial: Partial<Asset> & { class: Asset['class'] }): Asset {
  return {
    id: 'a1',
    trustId: 't1',
    name: 'Asset',
    value: 0,
    currency: 'USD',
    valueSource: 'manual',
    liquidity: 'liquid',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...partial,
  };
}

function rate(currency: string, rateToBase: number, obsAgoMs: number): FxRate {
  return { currency, rateToBase, observedAt: Date.now() - obsAgoMs, source: 'test' };
}

describe('computeNetWorth', () => {
  it('converts multi-currency assets into the base currency', () => {
    const assets = [
      asset({ class: 'bank', value: 100, currency: 'USD' }),
      asset({ class: 'property', value: 2, currency: 'EUR', liquidity: 'illiquid' }),
    ];
    const rates = new Map([['EUR', rate('EUR', 1.08, 1000)]]);
    const report = computeNetWorth(assets, 'USD', rates);
    assert.equal(report.total, 100 + 2 * 1.08);
    assert.equal(report.byClass.property, 2.16);
    assert.equal(report.byLiquidity.illiquid, 2.16);
    assert.equal(report.unconverted.length, 0);
  });

  it('marks report stale when a converted rate is older than threshold', () => {
    const assets = [asset({ class: 'bank', value: 10, currency: 'EUR' })];
    const rates = new Map([
      ['EUR', rate('EUR', 1.08, 25 * 60 * 60 * 1000)], // 25h old
    ]);
    const report = computeNetWorth(assets, 'USD', rates, { staleAfterMs: 24 * 60 * 60 * 1000 });
    assert.equal(report.isStale, true);
    assert.equal(report.total, 10.8);
  });

  it('does not mark stale for fresh rates', () => {
    const assets = [asset({ class: 'bank', value: 10, currency: 'EUR' })];
    const rates = new Map([['EUR', rate('EUR', 1.08, 1000)]]);
    const report = computeNetWorth(assets, 'USD', rates);
    assert.equal(report.isStale, false);
  });

  it('collects unconverted assets and excludes them from totals', () => {
    const assets = [asset({ class: 'bank', value: 100, currency: 'USD' }), asset({ class: 'crypto', value: 50, currency: 'XXX' })];
    const report = computeNetWorth(assets, 'USD', new Map());
    assert.equal(report.unconverted.length, 1);
    assert.equal(report.byClass.crypto, undefined);
    assert.equal(report.total, 100);
  });
});

describe('netEquity', () => {
  it('subtracts liabilities from total', () => {
    const assets = [
      asset({ class: 'bank', value: 500, currency: 'USD' }),
      asset({ class: 'liability', value: 200, currency: 'USD', liquidity: 'semi_liquid' }),
    ];
    const report = computeNetWorth(assets, 'USD', new Map());
    assert.equal(report.total, 700);
    assert.equal(netEquity(report), 500);
  });
});