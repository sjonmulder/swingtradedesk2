"use client";

import { Direction } from "@/lib/signal";

export function SignalMeter({
  score,
  direction,
}: {
  score: number;
  direction: Direction;
}) {
  // score: -100..100 -> position 0..100%
  const pct = ((score + 100) / 200) * 100;
  const color =
    direction === "CALL" ? "#2DD4A7" : direction === "PUT" ? "#EF6351" : "#C9A227";

  return (
    <div className="w-full">
      <div className="relative h-2 w-full rounded-full overflow-hidden bg-base-surface2 border border-base-border">
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            width: "100%",
            background:
              "linear-gradient(90deg, #EF6351 0%, #EF6351 33%, #2E3546 46%, #2E3546 54%, #2DD4A7 67%, #2DD4A7 100%)",
            opacity: 0.35,
          }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-3.5 w-1.5 rounded-full shadow-[0_0_8px_var(--glow)]"
          style={
            {
              left: `${pct}%`,
              backgroundColor: color,
              "--glow": color,
            } as React.CSSProperties
          }
        />
      </div>
      <div className="flex justify-between mt-1 text-[10px] uppercase tracking-wider text-ink-faint font-mono">
        <span>put</span>
        <span>neutral</span>
        <span>call</span>
      </div>
    </div>
  );
}
