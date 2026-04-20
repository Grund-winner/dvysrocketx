import { NextResponse } from 'next/server';
import { fetchState } from '@/lib/session';

export async function GET() {
  try {
    const data = await fetchState();
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'State endpoint error';
    return NextResponse.json({ status: 'error', error: message }, { status: 500 });
  }
}
