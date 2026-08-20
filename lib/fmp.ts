import type { Bar } from "./signal";

// FMP restructured its API in 2025: new accounts only have access to the
// "stable" endpoint set (https://financialmodelingprep.com/stable/...),
// not the older /api/v3/ routes. This client targets the stable API.
const FMP_BASE = "https://financialmodelingprep.com/stable";

export class FmpError extends Error {}

interface FmpHistoricalRow {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

function requireApiKey(): string {
  const apiKey = process.env.FMP_API_KEY;
  if (!apiKey) {
    throw new FmpError(
      "Missing FMP_API_KEY. Add it to .env.local for local dev, or to your Vercel project's Environment Variables, then redeploy."
    );
  }
  return apiKey;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function fmpFetch(path: string, params: Record<string, string>) {
  const apiKey = requireApiKey();
  const query = new URLSearchParams({ ...params, apikey: apiKey });
  const url = `${FMP_BASE}${path}?${query.toString()}`;

  const res = await fetch(url, { cache: "no-store" });

  if (res.status === 401 || res.status === 403) {
    throw new FmpError(
      `FMP rejected the API key (${res.status}) on ${path} — check FMP_API_KEY and that your plan includes this endpoint.`
    );
  }
  if (res.status === 429) {
    throw new FmpError(`FMP rate limit hit (429) on ${path}.`);
  }
  if (!res.ok) {
    throw new FmpError(`FMP request failed (${res.status}) on ${path}.`);
  }

  return res.json();
}

/** Fetches ~`days` calendar days of daily OHLCV bars, oldest first. */
export async function fetchDailyBars(symbol: string, days = 300): Promise<Bar[]> {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - Math.ceil(days * 1.6)); // pad for weekends/holidays

  const data = await fmpFetch("/historical-price-eod/full", {
    symbol,
    from: isoDate(start),
    to: isoDate(end),
  });

  // The stable API returns a flat array; guard for a wrapped shape too,
  // in case FMP changes this again.
  const rows: FmpHistoricalRow[] = Array.isArray(data)
    ? data
    : data?.historical ?? [];

  if (!rows || rows.length === 0) {
    throw new FmpError(`No historical data returned for "${symbol}" — check the ticker.`);
  }

  const bars: Bar[] = rows
    .filter((d) => d.open != null && d.high != null && d.low != null && d.close != null)
    .map((d) => ({
      date: d.date,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
      volume: d.volume ?? 0,
    }))
    // Stable endpoint returns newest-first, like the legacy one did.
    .reverse();

  return bars;
}

export interface LiveQuote {
  price: number;
  changesPercentage: number;
  volume: number;
}

interface FmpQuoteRow {
  symbol: string;
  price: number;
  changePercentage?: number;
  changesPercentage?: number;
  volume: number;
}

/** Live/delayed quote for a fresher price + change% than the last daily bar. */
export async function fetchQuote(symbol: string): Promise<LiveQuote | null> {
  const apiKey = process.env.FMP_API_KEY;
  if (!apiKey) return null;

  try {
    const data = await fmpFetch("/quote", { symbol });
    const q: FmpQuoteRow | null = Array.isArray(data) ? data[0] : data;
    if (!q || typeof q.price !== "number") return null;

    return {
      price: q.price,
      changesPercentage: q.changesPercentage ?? q.changePercentage ?? 0,
      volume: q.volume,
    };
  } catch {
    // Quote is a nice-to-have; fall back to the last historical bar silently.
    return null;
  }
}

export interface ScreenerCriteria {
  marketCapMoreThan?: number;
  marketCapLowerThan?: number;
  volumeMoreThan?: number;
  volumeLowerThan?: number;
  limit?: number;
}

interface FmpScreenerRow {
  symbol: string;
  companyName?: string;
  marketCap?: number;
  volume?: number;
  exchangeShortName?: string;
  isEtf?: boolean;
  isFund?: boolean;
}

/**
 * Uses FMP's stock screener to discover tickers matching market cap / volume
 * criteria, rather than requiring the user to type in symbols by hand.
 * Filters to actively-traded, non-fund US-exchange common stock by default.
 */
export async function fetchScreenerCandidates(
  criteria: ScreenerCriteria
): Promise<{ symbol: string; marketCap: number | null; volume: number | null }[]> {
  const params: Record<string, string> = {
    isActivelyTrading: "true",
    isEtf: "false",
    isFund: "false",
    limit: String(Math.min(criteria.limit ?? 25, 100)),
  };
  if (criteria.marketCapMoreThan) {
    params.marketCapMoreThan = String(criteria.marketCapMoreThan);
  }
  if (criteria.marketCapLowerThan) {
    params.marketCapLowerThan = String(criteria.marketCapLowerThan);
  }
  if (criteria.volumeMoreThan) {
    params.volumeMoreThan = String(criteria.volumeMoreThan);
  }
  if (criteria.volumeLowerThan) {
    params.volumeLowerThan = String(criteria.volumeLowerThan);
  }

  const data = await fmpFetch("/company-screener", params);

  if (!Array.isArray(data)) {
    throw new FmpError("Unexpected response shape from FMP screener.");
  }

  const rows: FmpScreenerRow[] = data;
  return rows
    .filter((r) => r.symbol && !r.isEtf && !r.isFund)
    .map((r) => ({
      symbol: r.symbol,
      marketCap: r.marketCap ?? null,
      volume: r.volume ?? null,
    }));
}
