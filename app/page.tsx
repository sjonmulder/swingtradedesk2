"use client";

import { useState, useCallback } from "react";
import { SignalResult } from "@/lib/signal";
import { ScreenerRow } from "@/components/ScreenerRow";

const DEFAULT_WATCHLIST = "AAPL, MSFT, NVDA, AMZN, TSLA, SPY";
const PRESETS = [
  { label: "Mega Cap", tickers: "AAPL, MSFT, GOOGL, AMZN, META" },
  { label: "Semis", tickers: "NVDA, AMD, AVGO, TSM, SMCI" },
  { label: "Index / ETF", tickers: "SPY, QQQ, IWM, DIA" },
  { label: "High Beta", tickers: "TSLA, COIN, PLTR, MSTR" },
];

export default function Home() {
  const [input, setInput] = useState(DEFAULT_WATCHLIST);
  const [signals, setSignals] = useState<SignalResult[]>([]);
  const [errors, setErrors] = useState<{ symbol: string; error: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastScan, setLastScan] = useState<string | null>(null);
  const [hasScanned, setHasScanned] = useState(false);

  const runScreen = useCallback(async (symbolsOverride?: string) => {
    const symbols = (symbolsOverride ?? input).trim();
    if (!symbols) return;
    setLoading(true);
    setHasScanned(true);
    try {
      const res = await fetch(
        `/api/screen?symbols=${encodeURIComponent(symbols)}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Screen failed");
      setSignals(data.signals || []);
      setErrors(data.errors || []);
      setLastScan(data.generatedAt);
    } catch (e) {
      setSignals([]);
      setErrors([{ symbol: "—", error: (e as Error).message }]);
    } finally {
      setLoading(false);
    }
  }, [input]);

  const callCount = signals.filter((s) => s.direction === "CALL").length;
  const putCount = signals.filter((s) => s.direction === "PUT").length;

  return (
    <main className="min-h-screen bg-scan">
      <div className="mx-auto max-w-5xl px-4 md:px-6 py-8 md:py-12">
        {/* Header */}
        <header className="mb-8 md:mb-10">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-ink-faint font-mono mb-2">
            <span className="h-1.5 w-1.5 rounded-full bg-call animate-pulse" />
            directional screener
          </div>
          <h1 className="font-display text-3xl md:text-4xl font-bold text-ink-primary tracking-tight">
            Signal Desk
          </h1>
          <p className="text-ink-muted text-sm mt-2 max-w-xl leading-relaxed">
            Scores each ticker on trend regime, moving-average crossover, MACD
            momentum, RSI, and volume confirmation to flag a directional bias.
          </p>
        </header>

        {/* Controls */}
        <section className="mb-6 border border-base-border rounded-xl bg-base-surface p-4">
          <label className="text-[11px] uppercase tracking-wider text-ink-faint block mb-2">
            Watchlist (comma-separated tickers)
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runScreen()}
              placeholder="AAPL, MSFT, NVDA..."
              className="flex-1 bg-base-surface2 border border-base-border rounded-lg px-3 py-2.5 font-mono text-sm text-ink-primary placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-call/40 focus:border-call/60"
            />
            <button
              onClick={() => runScreen()}
              disabled={loading}
              className="bg-call/90 hover:bg-call text-base-bg font-semibold text-sm rounded-lg px-5 py-2.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {loading ? "Scanning…" : "Run Screen"}
            </button>
          </div>

          <div className="flex flex-wrap gap-2 mt-3">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => {
                  setInput(p.tickers);
                  runScreen(p.tickers);
                }}
                className="text-xs font-mono px-2.5 py-1 rounded-md border border-base-border text-ink-muted hover:text-ink-primary hover:border-base-borderLight transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>
        </section>

        {/* Summary bar */}
        {hasScanned && !loading && signals.length > 0 && (
          <div className="flex items-center gap-4 mb-4 text-xs font-mono text-ink-muted">
            <span>
              <span className="text-call font-bold">{callCount}</span> call
            </span>
            <span>
              <span className="text-put font-bold">{putCount}</span> put
            </span>
            <span>
              <span className="text-ink-primary font-bold">
                {signals.length - callCount - putCount}
              </span>{" "}
              neutral
            </span>
            {lastScan && (
              <span className="ml-auto text-ink-faint">
                scanned {new Date(lastScan).toLocaleTimeString()}
              </span>
            )}
          </div>
        )}

        {/* Results */}
        <section className="space-y-2.5">
          {loading &&
            Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-[68px] rounded-lg border border-base-border bg-base-surface animate-pulse"
              />
            ))}

          {!loading && hasScanned && signals.length === 0 && errors.length === 0 && (
            <p className="text-ink-muted text-sm py-8 text-center">
              No results. Try a different set of tickers.
            </p>
          )}

          {!loading &&
            signals.map((s) => <ScreenerRow key={s.symbol} signal={s} />)}

          {!loading && errors.length > 0 && (
            <div className="border border-put-dim bg-put-bg/40 rounded-lg px-4 py-3 text-xs font-mono text-put">
              {errors.map((e, i) => (
                <div key={i}>
                  {e.symbol !== "—" ? `${e.symbol}: ` : ""}
                  {e.error}
                </div>
              ))}
            </div>
          )}

          {!hasScanned && (
            <div className="border border-dashed border-base-border rounded-xl px-6 py-14 text-center">
              <p className="text-ink-muted text-sm">
                Enter tickers above and run a screen to generate signals.
              </p>
            </div>
          )}
        </section>

        {/* Disclaimer */}
        <footer className="mt-10 pt-6 border-t border-base-border">
          <p className="text-[11px] leading-relaxed text-ink-faint max-w-2xl">
            Not financial advice. Signals are generated from historical price
            and volume data using standard technical indicators (moving
            averages, MACD, RSI, ADX, volume). They are a starting point for
            your own research, not a recommendation to buy or sell any
            security or option contract. Technical signals can and do fail,
            especially around earnings and other news events. Data sourced
            from Yahoo Finance and may be delayed.
          </p>
        </footer>
      </div>
    </main>
  );
}
