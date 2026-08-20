"use client";

import { useState } from "react";
import { SignalResult } from "@/lib/signal";
import { DirectionBadge } from "./DirectionBadge";
import { SignalMeter } from "./SignalMeter";

function fmt(n: number | null, digits = 2): string {
  if (n === null || Number.isNaN(n)) return "—";
  return n.toFixed(digits);
}

function fmtVol(n: number | null): string {
  if (n === null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

export function ScreenerRow({ signal }: { signal: SignalResult }) {
  const [open, setOpen] = useState(false);
  const changeUp = signal.changePct >= 0;

  return (
    <div className="border border-base-border rounded-lg bg-base-surface hover:border-base-borderLight transition-colors">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full grid grid-cols-[1fr_auto] md:grid-cols-[110px_120px_1fr_140px_90px_28px] items-center gap-3 md:gap-4 px-4 py-3.5 text-left"
      >
        <div className="flex flex-col">
          <span className="font-mono font-bold text-base text-ink-primary">
            {signal.symbol}
          </span>
          <span className="text-xs text-ink-muted font-mono tabular">
            ${fmt(signal.price)}{" "}
            <span className={changeUp ? "text-call" : "text-put"}>
              {changeUp ? "+" : ""}
              {fmt(signal.changePct)}%
            </span>
          </span>
        </div>

        <div className="hidden md:block">
          <DirectionBadge direction={signal.direction} />
        </div>

        <div className="hidden md:block">
          <SignalMeter score={signal.score} direction={signal.direction} />
        </div>

        <div className="hidden md:flex flex-col items-start">
          <span className="text-[10px] uppercase tracking-wider text-ink-faint">
            Confidence
          </span>
          <span className="font-mono text-sm text-ink-primary tabular">
            {signal.confidence}%
          </span>
        </div>

        <div className="md:hidden flex justify-end">
          <DirectionBadge direction={signal.direction} />
        </div>

        <div className="hidden md:block text-right font-mono text-sm text-ink-muted tabular">
          {signal.score > 0 ? "+" : ""}
          {signal.score}
        </div>

        <div className="flex justify-end">
          <span
            className={`text-ink-faint transition-transform duration-200 ${
              open ? "rotate-180" : ""
            }`}
            aria-hidden
          >
            ▾
          </span>
        </div>
      </button>

      {/* mobile-only meter row */}
      <div className="md:hidden px-4 pb-3 -mt-1">
        <SignalMeter score={signal.score} direction={signal.direction} />
      </div>

      {open && (
        <div className="border-t border-base-border px-4 py-4 grid gap-4 md:grid-cols-[1.3fr_1fr]">
          <div>
            <h4 className="text-[11px] uppercase tracking-wider text-ink-faint mb-2">
              Why this reading
            </h4>
            <ul className="space-y-2">
              {signal.reasons.map((r, i) => (
                <li key={i} className="flex gap-2.5 text-sm">
                  <span
                    className={`mt-1 h-1.5 w-1.5 rounded-full shrink-0 ${
                      r.weight > 0
                        ? "bg-call"
                        : r.weight < 0
                        ? "bg-put"
                        : "bg-neutral"
                    }`}
                  />
                  <span className="text-ink-muted leading-relaxed">
                    <span className="text-ink-primary font-medium">
                      {r.label}:
                    </span>{" "}
                    {r.detail}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-[11px] uppercase tracking-wider text-ink-faint mb-2">
              Raw indicators
            </h4>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 font-mono text-xs">
              <Stat label="EMA 20" value={fmt(signal.indicators.ema20)} />
              <Stat label="EMA 50" value={fmt(signal.indicators.ema50)} />
              <Stat label="SMA 50" value={fmt(signal.indicators.sma50)} />
              <Stat label="SMA 200" value={fmt(signal.indicators.sma200)} />
              <Stat label="RSI 14" value={fmt(signal.indicators.rsi14, 1)} />
              <Stat label="ADX 14" value={fmt(signal.indicators.adx14, 1)} />
              <Stat label="MACD" value={fmt(signal.indicators.macdLine, 3)} />
              <Stat label="Signal" value={fmt(signal.indicators.macdSignal, 3)} />
              <Stat label="Volume" value={fmtVol(signal.indicators.volume)} />
              <Stat
                label="Avg Vol 20"
                value={fmtVol(signal.indicators.avgVolume20)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-base-border/60 py-1">
      <span className="text-ink-faint">{label}</span>
      <span className="text-ink-primary tabular">{value}</span>
    </div>
  );
}
