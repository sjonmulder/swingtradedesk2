// Pure functions for technical indicators. All accept arrays ordered oldest -> newest.

export function sma(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

export function ema(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  const k = 2 / (period + 1);
  let prev: number | null = null;
  for (let i = 0; i < values.length; i++) {
    if (i === period - 1) {
      // seed with SMA of first `period` values
      const seedSlice = values.slice(0, period);
      prev = seedSlice.reduce((a, b) => a + b, 0) / period;
      out[i] = prev;
    } else if (i >= period) {
      prev = values[i] * k + (prev as number) * (1 - k);
      out[i] = prev;
    }
  }
  return out;
}

export function rsi(closes: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(closes.length).fill(null);
  if (closes.length < period + 1) return out;

  let gainSum = 0;
  let lossSum = 0;
  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    if (change >= 0) gainSum += change;
    else lossSum += -change;
  }
  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

export interface MacdResult {
  macdLine: (number | null)[];
  signalLine: (number | null)[];
  histogram: (number | null)[];
}

export function macd(
  closes: number[],
  fast = 12,
  slow = 26,
  signalPeriod = 9
): MacdResult {
  const emaFast = ema(closes, fast);
  const emaSlow = ema(closes, slow);
  const macdLine: (number | null)[] = closes.map((_, i) => {
    const f = emaFast[i];
    const s = emaSlow[i];
    return f !== null && s !== null ? f - s : null;
  });

  // signal line = EMA of macdLine, computed only over the non-null tail
  const firstValidIdx = macdLine.findIndex((v) => v !== null);
  const signalLine: (number | null)[] = new Array(closes.length).fill(null);
  if (firstValidIdx !== -1) {
    const validMacd = macdLine.slice(firstValidIdx).map((v) => v as number);
    const emaOfMacd = ema(validMacd, signalPeriod);
    for (let i = 0; i < emaOfMacd.length; i++) {
      signalLine[firstValidIdx + i] = emaOfMacd[i];
    }
  }

  const histogram: (number | null)[] = closes.map((_, i) => {
    const m = macdLine[i];
    const s = signalLine[i];
    return m !== null && s !== null ? m - s : null;
  });

  return { macdLine, signalLine, histogram };
}

// Wilder's ADX / +DI / -DI
export interface AdxResult {
  adx: (number | null)[];
  plusDI: (number | null)[];
  minusDI: (number | null)[];
}

export function adx(
  highs: number[],
  lows: number[],
  closes: number[],
  period = 14
): AdxResult {
  const n = closes.length;
  const plusDI: (number | null)[] = new Array(n).fill(null);
  const minusDI: (number | null)[] = new Array(n).fill(null);
  const adxOut: (number | null)[] = new Array(n).fill(null);
  if (n < period * 2) return { adx: adxOut, plusDI, minusDI };

  const tr: number[] = [0];
  const plusDM: number[] = [0];
  const minusDM: number[] = [0];

  for (let i = 1; i < n; i++) {
    const upMove = highs[i] - highs[i - 1];
    const downMove = lows[i - 1] - lows[i];
    plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
    tr.push(
      Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1])
      )
    );
  }

  let trSum = tr.slice(1, period + 1).reduce((a, b) => a + b, 0);
  let plusDMSum = plusDM.slice(1, period + 1).reduce((a, b) => a + b, 0);
  let minusDMSum = minusDM.slice(1, period + 1).reduce((a, b) => a + b, 0);

  const dxValues: (number | null)[] = new Array(n).fill(null);

  for (let i = period; i < n; i++) {
    if (i > period) {
      trSum = trSum - trSum / period + tr[i];
      plusDMSum = plusDMSum - plusDMSum / period + plusDM[i];
      minusDMSum = minusDMSum - minusDMSum / period + minusDM[i];
    }
    const pdi = trSum === 0 ? 0 : (100 * plusDMSum) / trSum;
    const mdi = trSum === 0 ? 0 : (100 * minusDMSum) / trSum;
    plusDI[i] = pdi;
    minusDI[i] = mdi;
    const dx = pdi + mdi === 0 ? 0 : (100 * Math.abs(pdi - mdi)) / (pdi + mdi);
    dxValues[i] = dx;
  }

  // ADX = Wilder-smoothed average of DX, first value is simple average of first `period` DX values
  const firstDxIdx = period;
  const dxSlice = dxValues.slice(firstDxIdx, firstDxIdx + period).filter((v) => v !== null) as number[];
  if (dxSlice.length === period) {
    let avgDx = dxSlice.reduce((a, b) => a + b, 0) / period;
    adxOut[firstDxIdx + period - 1] = avgDx;
    for (let i = firstDxIdx + period; i < n; i++) {
      const dx = dxValues[i];
      if (dx === null) continue;
      avgDx = (avgDx * (period - 1) + dx) / period;
      adxOut[i] = avgDx;
    }
  }

  return { adx: adxOut, plusDI, minusDI };
}

export function averageVolume(volumes: number[], period = 20): (number | null)[] {
  return sma(volumes, period);
}

export function lastValid<T>(arr: (T | null)[]): T | null {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i] !== null) return arr[i];
  }
  return null;
}

export function valueAt<T>(arr: (T | null)[], indexFromEnd: number): T | null {
  const idx = arr.length - 1 - indexFromEnd;
  if (idx < 0 || idx >= arr.length) return null;
  return arr[idx];
}
