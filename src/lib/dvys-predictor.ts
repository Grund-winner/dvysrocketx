// DVYS Predictor V4 - Tendances intelligentes avec rotation
// Migrated from original HTML to TypeScript

interface ConsecutiveInfo {
  cat: string | null;
  count: number;
}

interface TrendInfo {
  trend: string;
  strength: number;
  streak?: string;
  streakLen?: number;
}

interface PredictionResult {
  prediction: number;
  confidence: number;
  signals: string[];
  signalTypes: string[];
  category: string;
  rounds: number;
  avg: number;
  std: number;
  accuracy: number | null;
}

// --- Utility functions ---
function avg(a: number[]): number {
  if (!a.length) return 0;
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i];
  return s / a.length;
}

function sd(a: number[]): number {
  if (a.length < 2) return 0;
  const m = avg(a);
  let s = 0;
  for (let i = 0; i < a.length; i++) s += Math.pow(a[i] - m, 2);
  return Math.sqrt(s / (a.length - 1));
}

function rr(a: number, b: number): number {
  return a + Math.random() * (b - a);
}

function cl(v: number, l: number, h: number): number {
  return Math.max(l, Math.min(h, v));
}

function cat(v: number): string {
  return v < 2 ? 'low' : v < 10 ? 'mid' : 'high';
}

// --- Detect game trend ---
export function detectTrend(history: number[]): TrendInfo {
  const n = history.length;
  if (n < 5) return { trend: 'mid', strength: 0.5 };

  const recent = history.slice(-10);
  const recent8 = n >= 8 ? history.slice(-8) : recent;
  const recent5 = n >= 5 ? history.slice(-5) : recent;

  const avg5 = avg(recent5);
  const avg8 = avg(recent8);
  const avg10 = avg(recent);

  // Count distribution
  let lowC = 0, midC = 0, highC = 0;
  for (let i = 0; i < recent.length; i++) {
    if (recent[i] < 2) lowC++;
    else if (recent[i] < 10) midC++;
    else highC++;
  }

  const total = recent.length;
  const lowPct = lowC / total;
  const midPct = midC / total;
  const highPct = highC / total;

  // Detect streaks
  const streak = cat(recent[recent.length - 1]);
  let streakLen = 1;
  for (let j = recent.length - 2; j >= 0; j--) {
    if (cat(recent[j]) === streak) streakLen++;
    else break;
  }

  // Rules
  if (lowPct >= 0.55 || (avg5 < 1.8 && avg8 < 2.2)) {
    return { trend: 'low', strength: Math.min(lowPct / 0.7, 1), streak, streakLen };
  }
  if (highPct >= 0.4 || (avg5 > 6 && streak === 'high' && streakLen >= 2)) {
    return { trend: 'high', strength: Math.min(highPct / 0.5, 1), streak, streakLen };
  }
  if (midPct >= 0.4 || (avg5 >= 2 && avg5 <= 8)) {
    return { trend: 'mid', strength: Math.min(midPct / 0.6, 1), streak, streakLen };
  }
  return { trend: 'mid', strength: 0.4, streak, streakLen };
}

// --- Generate prediction value ---
export function generateValue(chosenCat: string, history: number[], forceTransition: boolean): number {
  const n = history.length;
  const allAvg = avg(history);
  const recent5 = n >= 5 ? avg(history.slice(-5)) : allAvg;

  // Category averages from history
  const lows: number[] = [];
  const mids: number[] = [];
  const highs: number[] = [];
  for (let i = 0; i < n; i++) {
    if (history[i] < 2) lows.push(history[i]);
    else if (history[i] < 10) mids.push(history[i]);
    else highs.push(history[i]);
  }
  const avgLow = lows.length ? avg(lows) : 1.35;
  const avgMid = mids.length ? avg(mids) : 3.5;
  const avgHigh = highs.length ? avg(highs) : 15;

  let pred: number;

  if (chosenCat === 'low') {
    pred = avgLow * rr(0.85, 1.20);
    pred = cl(pred, 1.15, 1.98);
  } else if (chosenCat === 'mid' && forceTransition) {
    pred = rr(2.05, 3.20);
    pred = cl(pred, 2.01, 3.50);
  } else if (chosenCat === 'mid') {
    pred = avgMid * rr(0.65, 1.40);
    pred = cl(pred, 2.0, 9.99);

    if (n >= 3) {
      const last3 = history.slice(-3);
      const m3 = avg(last3);
      if (m3 > 4) pred = cl(pred * rr(0.8, 1.1), 2.0, 9.99);
      else if (m3 < 2) pred = cl(pred * rr(0.7, 1.05), 2.0, 7.0);
    }
  } else if (chosenCat === 'high') {
    pred = avgHigh * rr(0.5, 1.0);
    pred = cl(pred, 10.0, 22);
  } else {
    pred = avgMid * rr(0.65, 1.40);
    pred = cl(pred, 2.0, 9.99);
  }

  // Natural noise
  pred = pred * rr(0.95, 1.05);
  return cl(Math.round(pred * 100) / 100, 1.15, 25);
}

// --- Calculate confidence ---
export function calcConfidence(
  chosenCat: string,
  trend: TrendInfo,
  n: number,
  isForced: boolean,
  accuracy: number | null
): number {
  let conf = 50;

  // More data = more reliable
  if (n >= 50) conf += 8;
  else if (n >= 30) conf += 6;
  else if (n >= 15) conf += 4;
  else if (n >= 8) conf += 2;

  // Agreement between trend and prediction
  if (chosenCat === trend.trend) {
    conf += Math.round(trend.strength * 15);
  } else if (isForced) {
    conf -= 5;
  }

  // Accuracy history
  if (accuracy !== null) {
    if (accuracy >= 60) conf += 8;
    else if (accuracy >= 50) conf += 4;
    else conf += 1;
  }

  return cl(Math.round(conf), 28, 92);
}

// --- Main prediction function ---
export function predict(
  fullHistory: number[],
  consecutiveInfo: ConsecutiveInfo,
  accuracy: number | null
): PredictionResult {
  if (fullHistory.length < 3) {
    return {
      prediction: cl(avg(fullHistory) + rr(-0.2, 0.2), 1.15, 4),
      confidence: 25,
      signals: ['donnees_insuffisantes'],
      signalTypes: ['info'],
      category: 'mid',
      rounds: fullHistory.length,
      avg: Math.round(avg(fullHistory) * 100) / 100,
      std: 0,
      accuracy: null,
    };
  }

  const n = fullHistory.length;

  // 1. Detect game trend
  const trendInfo = detectTrend(fullHistory);
  const gameTrend = trendInfo.trend;

  // 2. Check consecutive predictions
  let isForced = false;
  let chosenCat = gameTrend;

  // 3. Apply rotation limits
  if (consecutiveInfo.cat === 'low' && consecutiveInfo.count >= 3) {
    chosenCat = 'mid';
    isForced = true;
  } else if (consecutiveInfo.cat === 'mid' && consecutiveInfo.count >= 3) {
    chosenCat = 'low';
    isForced = true;
  } else if (consecutiveInfo.cat === 'high' && consecutiveInfo.count >= 2) {
    chosenCat = 'mid';
    isForced = true;
  }

  // 5. Generate value
  const forceTransition = isForced && gameTrend === 'low' && chosenCat === 'mid';
  const pred = generateValue(chosenCat, fullHistory, forceTransition);

  // 6. Calculate confidence
  const conf = calcConfidence(chosenCat, trendInfo, n, isForced, accuracy);

  // 7. Generate signals
  const signals: string[] = [];
  const signalTypes: string[] = [];

  signals.push('tendance_' + gameTrend);
  signalTypes.push(gameTrend === 'low' ? 'down' : gameTrend === 'high' ? 'up' : 'info');

  if (trendInfo.streakLen && trendInfo.streakLen >= 3) {
    signals.push('serie_' + trendInfo.streak + '_' + trendInfo.streakLen);
    signalTypes.push(trendInfo.streak === 'low' ? 'down' : 'up');
  }

  if (isForced) {
    signals.push('rotation_securite');
    signalTypes.push('info');
  }

  if (forceTransition) {
    signals.push('transition_bas_vers_mid');
    signalTypes.push('up');
  }

  if (n >= 15) signals.push('memoire_' + n + '_tours');
  signalTypes.push('info');

  if (accuracy !== null) {
    signals.push('precision_' + accuracy + '%');
    signalTypes.push(accuracy >= 45 ? 'up' : 'down');
  }

  return {
    prediction: pred,
    confidence: conf,
    signals,
    signalTypes,
    category: chosenCat,
    rounds: n,
    avg: Math.round(avg(fullHistory) * 100) / 100,
    std: Math.round(sd(fullHistory) * 100) / 100,
    accuracy,
  };
}

// --- Extract crash coefficients from API response ---
export function extractCoefs(data: unknown): number[] {
  const values: number[] = [];
  if (!Array.isArray(data)) return values;

  for (const item of data) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;

    if (Array.isArray(obj.finalValues)) {
      for (const v of obj.finalValues) {
        const fv = parseFloat(String(v));
        if (fv > 0) values.push(fv);
      }
      continue;
    }

    const coef = obj.coef ?? obj.crash ?? obj.value ?? obj.topCoefficient ?? obj.multiplier ?? obj.coefficient;
    if (coef !== undefined) {
      const fv = parseFloat(String(coef));
      if (fv > 0) values.push(fv);
    }
  }

  return values;
}
