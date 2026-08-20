import {
  sma,
  ema,
  rsi,
  macd,
  adx,
  averageVolume,
  lastValid,
  valueAt,
} from "./indicators";

export type Direction = "CALL" | "PUT" | "NEUTRAL";

export interface Reason {
  label: string;
  detail: string;
  weight: number; // -20..20, contribution to composite score
}

export interface SignalResult {
  symbol: string;
  price: number;
  changePct: number;
  direction: Direction;
  score: number; // -100..100
  confidence: number; // 0..100, driven by trend strength (ADX) + agreement
  reasons: Reason[];
  indicators: {
    ema20: number | null;
    ema50: number | null;
    sma50: number | null;
    sma200: number | null;
    rsi14: number | null;
    macdLine: number | null;
    macdSignal: number | null;
    macdHist: number | null;
    adx14: number | null;
    plusDI: number | null;
    minusDI: number | null;
    volume: number | null;
    avgVolume20: number | null;
  };
}

export interface Bar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export function computeSignal(symbol: string, bars: Bar[]): SignalResult | null {
  if (bars.length < 30) return null;

  const closes = bars.map((b) => b.close);
  const highs = bars.map((b) => b.high);
  const lows = bars.map((b) => b.low);
  const volumes = bars.map((b) => b.volume);

  const ema20Arr = ema(closes, 20);
  const ema50Arr = ema(closes, 50);
  const sma50Arr = sma(closes, 50);
  const sma200Arr = sma(closes, 200);
  const rsiArr = rsi(closes, 14);
  const macdRes = macd(closes, 12, 26, 9);
  const adxRes = adx(highs, lows, closes, 14);
  const avgVolArr = averageVolume(volumes, 20);

  const price = closes[closes.length - 1];
  const prevClose = closes[closes.length - 2];
  const changePct = ((price - prevClose) / prevClose) * 100;

  const ema20 = lastValid(ema20Arr);
  const ema50 = lastValid(ema50Arr);
  const ema20Prev = valueAt(ema20Arr, 1);
  const ema50Prev = valueAt(ema50Arr, 1);
  const sma50 = lastValid(sma50Arr);
  const sma200 = lastValid(sma200Arr);
  const rsi14 = lastValid(rsiArr);
  const macdLine = lastValid(macdRes.macdLine);
  const macdSignal = lastValid(macdRes.signalLine);
  const macdHist = lastValid(macdRes.histogram);
  const macdHistPrev = valueAt(macdRes.histogram, 1);
  const adx14 = lastValid(adxRes.adx);
  const plusDI = lastValid(adxRes.plusDI);
  const minusDI = lastValid(adxRes.minusDI);
  const volume = volumes[volumes.length - 1];
  const avgVolume20 = lastValid(avgVolArr);

  const reasons: Reason[] = [];
  let score = 0;

  // 1) Long-term trend regime: price vs 50/200 SMA (weight up to 20)
  if (sma50 !== null) {
    if (price > sma50) {
      const w = sma200 !== null && price > sma200 ? 20 : 12;
      score += w;
      reasons.push({
        label: "Trend regime",
        detail:
          sma200 !== null && price > sma200
            ? "Price above both the 50-day and 200-day average — established uptrend."
            : "Price above the 50-day average.",
        weight: w,
      });
    } else {
      const w = sma200 !== null && price < sma200 ? -20 : -12;
      score += w;
      reasons.push({
        label: "Trend regime",
        detail:
          sma200 !== null && price < sma200
            ? "Price below both the 50-day and 200-day average — established downtrend."
            : "Price below the 50-day average.",
        weight: w,
      });
    }
  }

  // 2) MA crossover: EMA20 vs EMA50, plus whether a cross just happened (weight up to 20)
  if (ema20 !== null && ema50 !== null && ema20Prev !== null && ema50Prev !== null) {
    const nowAbove = ema20 > ema50;
    const wasAbove = ema20Prev > ema50Prev;
    const justCrossed = nowAbove !== wasAbove;
    const w = nowAbove ? (justCrossed ? 20 : 14) : justCrossed ? -20 : -14;
    score += w;
    reasons.push({
      label: "Moving average crossover",
      detail: nowAbove
        ? justCrossed
          ? "20-EMA just crossed above the 50-EMA — fresh bullish crossover."
          : "20-EMA is above the 50-EMA — short-term trend intact."
        : justCrossed
        ? "20-EMA just crossed below the 50-EMA — fresh bearish crossover."
        : "20-EMA is below the 50-EMA — short-term trend down.",
      weight: w,
    });
  }

  // 3) MACD: line vs signal, histogram expanding or contracting (weight up to 20)
  if (macdLine !== null && macdSignal !== null && macdHist !== null) {
    const bullish = macdLine > macdSignal;
    const expanding =
      macdHistPrev !== null ? Math.abs(macdHist) > Math.abs(macdHistPrev) : false;
    const w = bullish ? (expanding ? 20 : 10) : expanding ? -20 : -10;
    score += w;
    reasons.push({
      label: "MACD momentum",
      detail: bullish
        ? expanding
          ? "MACD above signal line with the histogram expanding — momentum building higher."
          : "MACD above signal line, but momentum is flattening."
        : expanding
        ? "MACD below signal line with the histogram expanding — momentum building lower."
        : "MACD below signal line, but downside momentum is flattening.",
      weight: w,
    });
  }

  // 4) RSI zone (weight up to 15)
  if (rsi14 !== null) {
    let w = 0;
    let detail = `RSI at ${rsi14.toFixed(1)} — neutral zone.`;
    if (rsi14 >= 70) {
      w = 6;
      detail = `RSI at ${rsi14.toFixed(1)} — strong momentum, but stretched toward overbought.`;
    } else if (rsi14 >= 55) {
      w = 15;
      detail = `RSI at ${rsi14.toFixed(1)} — bullish momentum without being overbought.`;
    } else if (rsi14 <= 30) {
      w = -6;
      detail = `RSI at ${rsi14.toFixed(1)} — oversold, downside momentum may be stretched.`;
    } else if (rsi14 <= 45) {
      w = -15;
      detail = `RSI at ${rsi14.toFixed(1)} — bearish momentum without being oversold.`;
    }
    score += w;
    reasons.push({ label: "RSI momentum", detail, weight: w });
  }

  // 5) Volume confirmation (weight up to 15)
  if (avgVolume20 !== null && avgVolume20 > 0) {
    const volRatio = volume / avgVolume20;
    const priceUp = changePct >= 0;
    let w = 0;
    let detail = `Volume is ${volRatio.toFixed(2)}x the 20-day average.`;
    if (volRatio >= 1.3) {
      w = priceUp ? 15 : -15;
      detail += priceUp
        ? " Above-average volume confirms the move higher."
        : " Above-average volume confirms the move lower.";
    } else if (volRatio <= 0.6) {
      w = priceUp ? -4 : 4;
      detail += priceUp
        ? " Move is happening on light volume — weaker confirmation."
        : " Decline is happening on light volume — weaker confirmation.";
    } else {
      detail += " Volume is unremarkable, offering little confirmation either way.";
    }
    score += w;
    reasons.push({ label: "Volume confirmation", detail, weight: w });
  }

  score = Math.max(-100, Math.min(100, score));

  let direction: Direction = "NEUTRAL";
  if (score >= 22) direction = "CALL";
  else if (score <= -22) direction = "PUT";

  // Confidence: blends trend strength (ADX) with how many components agree with the final direction
  const agreeing = reasons.filter((r) =>
    direction === "CALL" ? r.weight > 0 : direction === "PUT" ? r.weight < 0 : false
  ).length;
  const agreementPct = reasons.length > 0 ? (agreeing / reasons.length) * 100 : 0;
  const trendStrength = adx14 !== null ? Math.min(100, adx14 * 2.5) : 30;
  const confidence =
    direction === "NEUTRAL"
      ? Math.round(Math.max(10, 40 - Math.abs(score)))
      : Math.round(agreementPct * 0.5 + trendStrength * 0.5);

  return {
    symbol,
    price,
    changePct,
    direction,
    score: Math.round(score),
    confidence: Math.max(0, Math.min(100, confidence)),
    reasons,
    indicators: {
      ema20,
      ema50,
      sma50,
      sma200,
      rsi14,
      macdLine,
      macdSignal,
      macdHist,
      adx14,
      plusDI,
      minusDI,
      volume,
      avgVolume20,
    },
  };
}
