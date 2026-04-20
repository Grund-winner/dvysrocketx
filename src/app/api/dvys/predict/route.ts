import { NextResponse } from 'next/server';
import { fetchHistory } from '@/lib/session';
import { predict, extractCoefs } from '@/lib/dvys-predictor';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const clientHistory: number[] = body.history || [];
    const clientPredictions: Array<{ category: string; timestamp: number }> = body.predictions || [];

    // Calculate consecutive info from client predictions
    let consecutiveCat: string | null = null;
    let consecutiveCount = 0;
    if (clientPredictions.length > 0) {
      consecutiveCat = clientPredictions[clientPredictions.length - 1].category;
      consecutiveCount = 1;
      for (let i = clientPredictions.length - 2; i >= 0; i--) {
        if (clientPredictions[i].category === consecutiveCat) consecutiveCount++;
        else break;
      }
    }

    // Calculate accuracy from client data
    let accuracy: number | null = null;
    if (body.hits !== undefined && body.total !== undefined && body.total >= 3) {
      accuracy = Math.round((body.hits / body.total) * 100);
    }

    // Fetch latest history from API
    const rawData = await fetchHistory();
    const apiCoefs = extractCoefs(rawData);

    if (apiCoefs.length === 0) {
      return NextResponse.json({ status: 'error', error: 'No crash data available' }, { status: 503 });
    }

    // Merge client history with API history
    let mergedHistory: number[];

    if (clientHistory.length === 0) {
      mergedHistory = apiCoefs.slice();
    } else {
      const apiLen = apiCoefs.length;
      const storedLen = clientHistory.length;
      let overlap = 0;

      for (let i = 0; i < Math.min(apiLen, storedLen); i++) {
        const sIdx = storedLen - apiLen + i;
        if (sIdx >= 0 && Math.abs(apiCoefs[i] - clientHistory[sIdx]) < 0.001) {
          overlap++;
        } else {
          break;
        }
      }

      if (overlap >= Math.floor(apiLen * 0.5)) {
        const newCoefs = apiCoefs.slice(overlap);
        mergedHistory = clientHistory.concat(newCoefs);
      } else {
        mergedHistory = clientHistory.concat(apiCoefs);
      }

      if (mergedHistory.length > 1000) {
        mergedHistory = mergedHistory.slice(-1000);
      }
    }

    // Run prediction
    const result = predict(
      mergedHistory,
      { cat: consecutiveCat, count: consecutiveCount },
      accuracy
    );

    return NextResponse.json({
      status: 'ok',
      prediction: result.prediction,
      confidence: result.confidence,
      signals: result.signals,
      signalTypes: result.signalTypes,
      category: result.category,
      last_rounds: apiCoefs.slice(-15).reverse(),
      total_rounds: result.rounds,
      avg: result.avg,
      std_dev: result.std,
      accuracy: result.accuracy,
      history: mergedHistory.slice(-100),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Prediction endpoint error';
    return NextResponse.json({ status: 'error', error: message }, { status: 500 });
  }
}
