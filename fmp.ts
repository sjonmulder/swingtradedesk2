import type { Bar } from "./signal";

const FMP_BASE = "https://financialmodelingprep.com/api/v3";

export class FmpError extends Error {}

interface FmpHistoricalRow {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface FmpHistoricalResponse {
  symbol?: string;
  historical?: FmpHistoricalRow[];
  "Error Message"?: string;
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

/** Fetches ~`days` calendar days of daily OHLCV bars, oldest first. */
export async function fetchDailyBars(symbol: string, days = 300): Promise<Bar[]> {
  const apiKey = requireApiKey();
  const url = `${FMP_BASE}/historical-price-full/${encodeURIComponent(
    symbol
  )}?timeseries=${days}&apikey=${apiKey}`;

  const res = await fetch(url, { cache: "no-store" });

  if (res.status === 401 || res.status === 403) {
    throw new FmpError(
      "FMP rejected the API key (401/403) — check that FMP_API_KEY is correct and your plan allows this endpoint."
    );
  }
  if (res.status === 429) {
    throw new FmpError("FMP rate limit hit (429) — slow down or upgrade your plan.");
  }
  if (!res.ok) {
    throw new FmpError(`FMP request failed (${res.status}) for ${symbol}.`);
  }

  const data: FmpHistoricalResponse | FmpHistoricalRow[] = await res.json();

  // Some FMP error responses come back as a plain object with "Error Message"
  if (!Array.isArray(data) && data["Error Message"]) {
    throw new FmpError(data["Error Message"]);
  }

  const historical = Array.isArray(data) ? data : data.historical;
  if (!historical || historical.length === 0) {
    throw new FmpError(`No historical data returned for "${symbol}" — check the ticker.`);
  }

  // FMP returns newest-first; indicator math needs oldest-first.
  const bars: Bar[] = historical
    .filter((d) => d.open != null && d.high != null && d.low != null && d.close != null)
    .map((d) => ({
      date: d.date,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
      volume: d.volume ?? 0,
    }))
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
  changesPercentage: number;
  volume: number;
}

/** Live/delayed quote for a fresher price + change% than the last daily bar. */
export async function fetchQuote(symbol: string): Promise<LiveQuote | null> {
  const apiKey = process.env.FMP_API_KEY;
  if (!apiKey) return null;

  try {
    const url = `${FMP_BASE}/quote/${encodeURIComponent(symbol)}?apikey=${apiKey}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;

    const data: FmpQuoteRow[] = await res.json();
    const q = Array.isArray(data) ? data[0] : null;
    if (!q || typeof q.price !== "number") return null;

    return {
      price: q.price,
      changesPercentage: q.changesPercentage,
      volume: q.volume,
    };
  } catch {
    // Quote is a nice-to-have; fall back to the last historical bar silently.
    return null;
  }
}
