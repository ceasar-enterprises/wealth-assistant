import type { Asset } from './model';

/** Latest FX rate for converting an amount into base currency. */
export interface FxRate {
  /** ISO currency, e.g. 'USD'. */
  currency: string;
  /** Units of base currency per 1 unit of `currency`. */
  rateToBase: number;
  /** When this rate was fetched (epoch ms). */
  observedAt: number;
  source: string;
}

/** The result of aggregating assets into one net-worth number. */
export interface NetWorthReport {
  baseCurrency: string;
  /** Total net asset value in base currency. */
  total: number;
  /** Breakdown by asset class, all in base currency. */
  byClass: Record<string, number>;
  /** Breakdown by liquidity, all in base currency. */
  byLiquidity: Record<string, number>;
  /** Assets that could not be converted (missing rate)  still shown. */
  unconverted: Asset[];
  /** Total computed when stale rates were used (offline behavior). */
  isStale: boolean;
  computedAt: string;
}

const LIQUIDITY_ORDER = ['liquid', 'semi_liquid', 'illiquid'] as const;

/**
 * Aggregate a list of assets into a net-worth report. Converts each asset's
 * currency into `baseCurrency` via the rate map. If rates are older than
 * `staleAfterMs`, the report marks `isStale` (stale-cache behavior: still serve
 * the number, but label it).
 */
export function computeNetWorth(
  assets: Asset[],
  baseCurrency: string,
  rateMap: ReadonlyMap<string, FxRate>,
  opts: { staleAfterMs?: number; now?: number } = {},
): NetWorthReport {
  const { staleAfterMs = 24 * 60 * 60 * 1000, now = Date.now() } = opts;
  const byClass: Record<string, number> = {};
  const byLiquidity: Record<string, number> = {};
  const unconverted: Asset[] = [];

  let total = 0;
  let isStale = false;

  for (const asset of assets) {
    // Base-currency assets need no conversion.
    if (asset.currency === baseCurrency) {
      total += asset.value;
      byClass[asset.class] = (byClass[asset.class] ?? 0) + asset.value;
      byLiquidity[asset.liquidity] =
        (byLiquidity[asset.liquidity] ?? 0) + asset.value;
      continue;
    }

    const rate = rateMap.get(asset.currency);
    if (!rate || rate.rateToBase <= 0) {
      unconverted.push(asset);
      continue;
    }
    if (now - rate.observedAt > staleAfterMs) isStale = true;
    const converted = asset.value * rate.rateToBase;
    total += converted;
    byClass[asset.class] = (byClass[asset.class] ?? 0) + converted;
    byLiquidity[asset.liquidity] =
      (byLiquidity[asset.liquidity] ?? 0) + converted;
  }

  // Order liquidity keys consistently.
  const orderedLiquidity: Record<string, number> = {};
  for (const key of LIQUIDITY_ORDER) {
    if (byLiquidity[key] !== undefined) orderedLiquidity[key] = byLiquidity[key];
  }

  return {
    baseCurrency,
    total,
    byClass,
    byLiquidity: orderedLiquidity,
    unconverted,
    isStale,
    computedAt: new Date(now).toISOString(),
  };
}

/** Net worth minus liabilities (true equity picture for asset holders). */
export function netEquity(report: NetWorthReport, liabilityClass = 'liability'): number {
  const liabilities = report.byClass[liabilityClass] ?? 0;
  return report.total - liabilities;
}