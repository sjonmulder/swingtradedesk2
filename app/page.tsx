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

const MARKET_CAP_OPTIONS = [
  { label: "Any market cap", value: "0" },
  { label: "Small cap ($300M+)", value: "300000000" },
  { label: "Mid cap ($2B+)", value: "2000000000" },
  { label: "Large cap ($10B+)", value: "10000000000" },
  { label: "Mega cap ($200B+)", value: "200000000000" },
];

const VOLUME_OPTIONS = [
  { label: "Any volume", value: "0" },
  { label: "500K+ avg daily", value: "500000" },
  { label: "1M+ avg daily", value: "1000000" },
  { label: "5M+ avg daily", value: "5000000" },
  { label: "10M+ avg daily", value: "10000000" },
];

type Mode = "manual" | "discover";

function fmtCap(n: number): string {
  if (n >= 1_000_000_000_000) return `$${(n / 1_000_000_000_000).toFixed(1)}T`;
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(0)}M`;
  return `$${n}`;
}

export default function Home() {
  const [mode, setMode] = useState<Mode>("manual");

  // manual mode state
  const [input, setInput] = useState(DEFAULT_WATCHLIST);

  // discover mode state
  const [marketCapMin, setMarketCapMin] = useState(MARKET_CAP_OPTIONS[2].value); // large cap default
  const [volumeMin, setVolumeMin] = useState(VOLUME_OPTIONS[2].value); // 1M+ default
  const [limit, setLimit] = useState(15);
  const MAX_SYMBOLS = 100;

  const [signals, setSignals] = useState<SignalResult[]>([]);
  const [errors, setErrors] = useState<{ symbol: string; error: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastScan, setLastScan] = useState<string | null>(null);
  const [hasScanned, setHasScanned] = useState(false);
  const [matchedCount, setMatchedCount] = useState<number | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const runManualScreen = useCallback(
    async (symbolsOverride?: string) => {
      const symbols = (symbolsOverride ?? input).trim();
      if (!symbols) return;
      setLoading(true);
      setHasScanned(true);
      setMatchedCount(null);
      setInfoMessage(null);
      try {
        const res = await fetch(`/api/screen?symbols=${encodeURIComponent(symbols)}`);
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
    },
    [input]
  );

  const runDiscoverScreen = useCallback(async () => {
    setLoading(true);
    setHasScanned(true);
    setInfoMessage(null);
    try {
      const params = new URLSearchParams({
        discover: "true",
        marketCapMin,
        volumeMin,
        limit: String(limit),
      });
      const res = await fetch(`/api/screen?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Screen failed");
      setSignals(data.signals || []);
      setErrors(data.errors || []);
      setLastScan(data.generatedAt);
      setMatchedCount(data.matchedSymbols?.length ?? null);
      if (data.message) setInfoMessage(data.message);
    } catch (e) {
      setSignals([]);
      setErrors([{ symbol: "—", error: (e as Error).message }]);
    } finally {
      setLoading(false);
    }
  }, [marketCapMin, volumeMin, limit]);

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

        {/* Mode switch */}
        <div className="flex gap-1 mb-3 p-1 bg-base-surface2 border border-base-border rounded-lg w-fit">
          <button
            onClick={() => setMode("manual")}
            className={`px-3.5 py-1.5 rounded-md text-xs font-mono font-medium transition-colors ${
              mode === "manual"
                ? "bg-base-surface text-ink-primary"
                : "text-ink-faint hover:text-ink-muted"
            }`}
          >
            Manual watchlist
          </button>
          <button
            onClick={() => setMode("discover")}
            className={`px-3.5 py-1.5 rounded-md text-xs font-mono font-medium transition-colors ${
              mode === "discover"
                ? "bg-base-surface text-ink-primary"
                : "text-ink-faint hover:text-ink-muted"
            }`}
          >
            Discover by cap / volume
          </button>
        </div>

        {/* Controls */}
        <section className="mb-6 border border-base-border rounded-xl bg-base-surface p-4">
          {mode === "manual" ? (
            <>
              <label className="text-[11px] uppercase tracking-wider text-ink-faint block mb-2">
                Watchlist (comma-separated tickers)
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && runManualScreen()}
                  placeholder="AAPL, MSFT, NVDA..."
                  className="flex-1 bg-base-surface2 border border-base-border rounded-lg px-3 py-2.5 font-mono text-sm text-ink-primary placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-call/40 focus:border-call/60"
                />
                <button
                  onClick={() => runManualScreen()}
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
                      runManualScreen(p.tickers);
                    }}
                    className="text-xs font-mono px-2.5 py-1 rounded-md border border-base-border text-ink-muted hover:text-ink-primary hover:border-base-borderLight transition-colors"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <label className="text-[11px] uppercase tracking-wider text-ink-faint block mb-2">
                Discover tickers matching criteria
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-ink-faint block mb-1">
                    Min. market cap
                  </span>
                  <select
                    value={marketCapMin}
                    onChange={(e) => setMarketCapMin(e.target.value)}
                    className="w-full bg-base-surface2 border border-base-border rounded-lg px-3 py-2.5 font-mono text-sm text-ink-primary focus:outline-none focus:ring-2 focus:ring-call/40 focus:border-call/60"
                  >
                    {MARKET_CAP_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-ink-faint block mb-1">
                    Min. avg. daily volume
                  </span>
                  <select
                    value={volumeMin}
                    onChange={(e) => setVolumeMin(e.target.value)}
                    className="w-full bg-base-surface2 border border-base-border rounded-lg px-3 py-2.5 font-mono text-sm text-ink-primary focus:outline-none focus:ring-2 focus:ring-call/40 focus:border-call/60"
                  >
                    {VOLUME_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-ink-faint block mb-1">
                    Max tickers to screen
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={MAX_SYMBOLS}
                    value={limit}
                    onChange={(e) =>
                      setLimit(Math.max(1, Math.min(MAX_SYMBOLS, Number(e.target.value) || 1)))
                    }
                    className="w-full bg-base-surface2 border border-base-border rounded-lg px-3 py-2.5 font-mono text-sm text-ink-primary focus:outline-none focus:ring-2 focus:ring-call/40 focus:border-call/60"
                  />
                </div>
              </div>
              <button
                onClick={runDiscoverScreen}
                disabled={loading}
                className="w-full sm:w-auto bg-call/90 hover:bg-call text-base-bg font-semibold text-sm rounded-lg px-5 py-2.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Discovering…" : "Discover & Screen"}
              </button>
              <p className="text-[11px] text-ink-faint mt-2.5 leading-relaxed">
                Pulls tickers ranked by market cap that meet both thresholds
                from FMP's stock screener, then runs the full signal on each
                one, fetched in small concurrent batches. Up to {MAX_SYMBOLS}{" "}
                tickers per screen.
              </p>
            </>
          )}
        </section>

        {/* Summary bar */}
        {hasScanned && !loading && (signals.length > 0 || matchedCount !== null) && (
          <div className="flex flex-wrap items-center gap-4 mb-4 text-xs font-mono text-ink-muted">
            {matchedCount !== null && (
              <span>
                <span className="text-ink-primary font-bold">{matchedCount}</span>{" "}
                matched {fmtCap(Number(marketCapMin))}+ cap,{" "}
                {Number(volumeMin) > 0 ? `${(Number(volumeMin) / 1_000_000).toFixed(1)}M+ vol` : "any vol"}
              </span>
            )}
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

          {!loading && infoMessage && (
            <p className="text-ink-muted text-sm py-8 text-center">{infoMessage}</p>
          )}

          {!loading &&
            hasScanned &&
            signals.length === 0 &&
            errors.length === 0 &&
            !infoMessage && (
              <p className="text-ink-muted text-sm py-8 text-center">
                No results. Try different criteria or tickers.
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
                {mode === "manual"
                  ? "Enter tickers above and run a screen to generate signals."
                  : "Set your market cap and volume thresholds, then discover matching tickers."}
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
            from Financial Modeling Prep and may be delayed.
          </p>
        </footer>
      </div>
    </main>
  );
}
