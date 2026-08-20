import { NextRequest, NextResponse } from "next/server";
import { fetchDailyBars, fetchQuote } from "@/lib/fmp";
import { computeSignal, SignalResult } from "@/lib/signal";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const symbolsParam = req.nextUrl.searchParams.get("symbols") || "";
  const symbols = Array.from(
    new Set(
      symbolsParam
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean)
    )
  ).slice(0, 30); // cap batch size

  if (symbols.length === 0) {
    return NextResponse.json({ error: "No symbols provided" }, { status: 400 });
  }

  const results = await Promise.allSettled(
    symbols.map(async (symbol) => {
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

  const signals: SignalResult[] = [];
  const errors: { symbol: string; error: string }[] = [];

  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      signals.push(r.value);
    } else {
      errors.push({ symbol: symbols[i], error: r.reason?.message || "Fetch failed" });
    }
  });

  // Highest-conviction signals first
  signals.sort((a, b) => Math.abs(b.score) - Math.abs(a.score));

  return NextResponse.json({ signals, errors, generatedAt: new Date().toISOString() });
}
