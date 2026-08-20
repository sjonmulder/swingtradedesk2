import { Direction } from "@/lib/signal";

const STYLES: Record<Direction, string> = {
  CALL: "bg-call-bg text-call border-call-dim",
  PUT: "bg-put-bg text-put border-put-dim",
  NEUTRAL: "bg-neutral-bg text-neutral border-neutral-dim",
};

const ARROW: Record<Direction, string> = {
  CALL: "▲",
  PUT: "▼",
  NEUTRAL: "◆",
};

export function DirectionBadge({ direction }: { direction: Direction }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-xs font-bold tracking-wider ${STYLES[direction]}`}
    >
      <span aria-hidden>{ARROW[direction]}</span>
      {direction}
    </span>
  );
}
