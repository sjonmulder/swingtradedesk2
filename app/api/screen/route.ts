import { NextRequest, NextResponse } from "next/server";
import { fetchDailyBars, fetchQuote, fetchScreenerCandidates } from "@/lib/fmp";
import { computeSignal, SignalResult } from "@/lib/signal";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// With a Starter-tier (or higher) FMP plan, rate limits aren't the binding
// constraint — the real ceiling is the serverless function's max duration.
// Fetching in small concurrent batches (rather than all-at-once or fully
// sequential) keeps total wall-clock time low even as MAX_SYMBOLS grows.
const MAX_SYMBOLS = 100;
const BATCH_SIZE = 15;

async function computeSignalsFor(symbols: string[]) {
  const settled: PromiseSettledResult<SignalResult>[] = [];

  for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
    const batch = symbols.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.allSettled(
      batch.map(async (symbol) => {
        const [bars, quote] = await Promise.all([
          fetchDailyBars(symbol),
          fetchQuote(symbol),
        ]);

        const signal = computeSignal(symbol, bars);
        if (!signal) throw new Error(`Not enough price history for ${symbol}`);

        // Prefer the live/delayed quote for price + change% when available —
        // the last daily bar can lag intraday, especially mid-session.
        if (quote) {
          signal.price = quote.price;
          signal.changePct = quote.changesPercentage;
        }

        return signal;
      })
    );
    settled.push(...batchResults);
  }

  const signals: SignalResult[] = [];
  const errors: { symbol: string; error: string }[] = [];

  settled.forEach((r, i) => {
    if (r.status === "fulfilled") {
      signals.push(r.value);
    } else {
      errors.push({ symbol: symbols[i], error: r.reason?.message || "Fetch failed" });
    }
  });

  // Highest-conviction signals first
  signals.sort((a, b) => Math.abs(b.score) - Math.abs(a.score));

  return { signals, errors };
}

export async function GET(req: NextRequest) {
  const discover = req.nextUrl.searchParams.get("discover") === "true";

  // ---- Discover mode: find tickers via FMP's screener, then score them ----
  if (discover) {
    const marketCapMin = Number(req.nextUrl.searchParams.get("marketCapMin") || 0) || undefined;
    const marketCapMax = Number(req.nextUrl.searchParams.get("marketCapMax") || 0) || undefined;
    const volumeMin = Number(req.nextUrl.searchParams.get("volumeMin") || 0) || undefined;
    const limit = Math.min(
      Number(req.nextUrl.searchParams.get("limit") || 15) || 15,
      MAX_SYMBOLS
    );

    let candidates;
    try {
      candidates = await fetchScreenerCandidates({
        marketCapMoreThan: marketCapMin,
        marketCapLowerThan: marketCapMax,
        volumeMoreThan: volumeMin,
        limit,
      });
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 502 });
    }

    if (candidates.length === 0) {
      return NextResponse.json({
        signals: [],
        errors: [],
        matchedSymbols: [],
        generatedAt: new Date().toISOString(),
        message: "No tickers matched those market cap / volume criteria.",
      });
    }

    const symbols = candidates.map((c) => c.symbol);
    const { signals, errors } = await computeSignalsFor(symbols);

    return NextResponse.json({
      signals,
      errors,
      matchedSymbols: symbols,
      generatedAt: new Date().toISOString(),
    });
  }

  // ---- Manual mode: score exactly the tickers the user typed in ----
  const symbolsParam = req.nextUrl.searchParams.get("symbols") || "";
  const symbols = Array.from(
    new Set(
      symbolsParam
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean)
    )
  ).slice(0, MAX_SYMBOLS);

  if (symbols.length === 0) {
    return NextResponse.json({ error: "No symbols provided" }, { status: 400 });
  }

  const { signals, errors } = await computeSignalsFor(symbols);

  return NextResponse.json({ signals, errors, generatedAt: new Date().toISOString() });
}
