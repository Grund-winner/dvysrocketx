import { NextResponse } from 'next/server';
import { authenticate } from '@/lib/session';

const GAME_IFRAME_URL = process.env.GAME_IFRAME_URL!;
const TOKEN_B = process.env.TOKEN_B!;
const PARTNER_ID = process.env.PARTNER_ID!;
const PARTNER_IK = process.env.PARTNER_IK!;

export async function POST(request: Request) {
  try {
    let clientAccuracy: number | null = null;

    try {
      const body = await request.json();
      clientAccuracy = body.accuracy ?? null;
    } catch {
      // No body needed for initial auth
    }

    const result = await authenticate();

    // Construct game iframe URL server-side (token not directly exposed as variable)
    const iframeUrl = `${GAME_IFRAME_URL}?b=${encodeURIComponent(TOKEN_B)}&language=en&pid=${encodeURIComponent(PARTNER_ID)}&pik=${encodeURIComponent(PARTNER_IK)}`;

    return NextResponse.json({
      status: result.success ? 'ok' : 'error',
      authenticated: result.success,
      error: result.error || null,
      accuracy: clientAccuracy,
      iframeUrl: iframeUrl,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Auth endpoint error';
    return NextResponse.json({ status: 'error', error: message }, { status: 500 });
  }
}
