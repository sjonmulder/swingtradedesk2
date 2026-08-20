import { sma, ema, rsi, macd, adx } from "../lib/indicators";
import { computeSignal, Bar } from "../lib/signal";

// Synthetic uptrend: 220 bars, gentle noise, clear upward drift
const n = 220;
const closes: number[] = [];
let price = 100;
for (let i = 0; i < n; i++) {
  price += 0.15 + Math.sin(i / 7) * 0.4;
  closes.push(Number(price.toFixed(2)));
}

const highs = closes.map((c) => c + Math.random() * 0.5);
const lows = closes.map((c) => c - Math.random() * 0.5);
const volumes = closes.map((_, i) => 1_000_000 + (i % 30 === 0 ? 800_000 : 0));

console.log("--- SMA(20) tail ---", sma(closes, 20).slice(-3));
console.log("--- EMA(20) tail ---", ema(closes, 20).slice(-3));
console.log("--- RSI(14) tail ---", rsi(closes, 14).slice(-3));
const macdRes = macd(closes);
console.log("--- MACD line tail ---", macdRes.macdLine.slice(-3));
console.log("--- MACD signal tail ---", macdRes.signalLine.slice(-3));
const adxRes = adx(highs, lows, closes, 14);
console.log("--- ADX tail ---", adxRes.adx.slice(-3));

const bars: Bar[] = closes.map((c, i) => ({
  date: `2026-01-${(i % 28) + 1}`,
  open: c - 0.1,
  high: highs[i],
  low: lows[i],
  close: c,
  volume: volumes[i],
}));

const signal = computeSignal("TEST", bars);
console.log("\n--- Composite signal for synthetic uptrend ---");
console.log(JSON.stringify(signal, null, 2));

// Downtrend test
const closesDown = closes.slice().reverse().map((c, i) => c - i * 0.05);
const barsDown: Bar[] = closesDown.map((c, i) => ({
  date: `2026-01-${(i % 28) + 1}`,
  open: c + 0.1,
  high: c + 0.5,
  low: c - 0.5,
  close: c,
  volume: 1_000_000,
}));
const signalDown = computeSignal("TESTDOWN", barsDown);
console.log("\n--- Composite signal for synthetic downtrend ---");
console.log(
  JSON.stringify(
    { direction: signalDown?.direction, score: signalDown?.score, confidence: signalDown?.confidence },
    null,
    2
  )
);
