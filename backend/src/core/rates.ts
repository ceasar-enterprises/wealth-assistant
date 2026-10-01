import type { FxRate } from './net-worth';

/**
 * FX rates for net-worth conversion. Fetch on demand (open.er-api.com, no key)
 * and cache with a staleness threshold. Serves stale rates offline  the
 * net-worth report then reports `isStale` instead of refusing to show a number.
 */

export interface RateStore {
  get(currency: string, baseCurrency: string): Promise<FxRate | undefined>;
}

/** Default HTTP fetch (Node >=18 global fetch). */
async function fetchRate(
  currency: string,
  baseCurrency: string,
): Promise<FxRate | undefined> {
  const url = `https://open.er-api.com/v6/latest/${baseCurrency}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return undefined;
    const data = (await response.json()) as {
      rates?: Record<string, number>;
      time_last_update_unix?: number;
    };
    const rate = data.rates?.[currency];
    if (!rate || rate <= 0) return undefined;
    return {
      currency,
      rateToBase: rate,
      observedAt:
        (data.time_last_update_unix ?? Math.floor(Date.now() / 1000)) * 1000,
      source: 'open.er-api.com',
    };
  } catch {
    return undefined; // offline / timeout  caller uses stale cache
  } finally {
    clearTimeout(timer);
  }
}

/**
 * In-memory rate cache. Reads have a TTL; when a cached rate is stale but
 * present it is still returned (so the caller can serve a stale number).
 */
export class RateCache {
  private rates = new Map<string, FxRate>();

  constructor(private opts: { staleMs?: number } = {}) {}

  private key(currency: string, base: string) {
    return `${base}:${currency}`;
  }

  async get(currency: string, baseCurrency: string): Promise<FxRate> {
    if (currency === baseCurrency) {
      return { currency, rateToBase: 1, observedAt: Date.now(), source: 'identity' };
    }
    const cached = this.rates.get(this.key(currency, baseCurrency));
    const staleMs = this.opts.staleMs ?? 12 * 60 * 60 * 1000;
    if (cached && Date.now() - cached.observedAt <= staleMs) {
      return cached;
    }
    const fresh = await fetchRate(currency, baseCurrency);
    if (fresh) {
      this.rates.set(this.key(currency, baseCurrency), fresh);
      return fresh;
    }
    // Offline or fetch failed  return the stale value if we have one.
    if (cached) return cached;
    const identity = this.identityRate(currency, baseCurrency);
    this.rates.set(this.key(currency, baseCurrency), identity);
    return identity;
  }

  /** Only used as a last-resort fallback, clearly marked. */
  private identityRate(currency: string, _base: string): FxRate {
    return {
      currency,
      rateToBase: 1,
      observedAt: Date.now(),
      source: 'identity-fallback',
    };
  }
}