// Server-side session management for game API
// Token NEVER exposed to client

const AUTH_URL = process.env.AUTH_URL!;
const STATE_URL = process.env.STATE_URL!;
const HIST_URL = process.env.HIST_URL!;
const TOKEN_B = process.env.TOKEN_B!;

interface SessionData {
  headers: Record<string, string>;
  createdAt: number;
}

const SESSION_TTL = 30 * 60 * 1000; // 30 minutes
const sessionCache = new Map<string, SessionData>();

let cachedSession: SessionData | null = null;

function isExpired(session: SessionData): boolean {
  return Date.now() - session.createdAt > SESSION_TTL;
}

export async function authenticate(): Promise<{ success: boolean; sessionId?: string; customerId?: string; error?: string }> {
  try {
    const res = await fetch(AUTH_URL, {
      method: 'POST',
      headers: {
        'auth-token': TOKEN_B,
        'Content-Type': 'application/json',
      },
      body: '{}',
    });

    if (!res.ok) {
      return { success: false, error: `Auth HTTP ${res.status}` };
    }

    const data = await res.json();

    if (!data.sessionId || !data.customerId) {
      return { success: false, error: 'No session data in response' };
    }

    cachedSession = {
      headers: {
        'customer-id': String(data.customerId),
        'session-id': String(data.sessionId),
        'accept': 'application/json',
      },
      createdAt: Date.now(),
    };

    return {
      success: true,
      sessionId: data.sessionId,
      customerId: data.customerId,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown auth error';
    return { success: false, error: message };
  }
}

export async function getSession(): Promise<Record<string, string>> {
  if (cachedSession && !isExpired(cachedSession)) {
    return cachedSession.headers;
  }

  const result = await authenticate();
  if (!result.success || !cachedSession) {
    throw new Error(result.error || 'Authentication failed');
  }

  return cachedSession.headers;
}

export async function fetchHistory(): Promise<unknown> {
  const headers = await getSession();
  const res = await fetch(HIST_URL, {
    method: 'GET',
    headers: {
      'customer-id': headers['customer-id'],
      'session-id': headers['session-id'],
      'accept': 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(`History HTTP ${res.status}`);
  }

  return res.json();
}

export async function fetchState(): Promise<unknown> {
  const headers = await getSession();
  const res = await fetch(STATE_URL, {
    method: 'GET',
    headers: {
      'customer-id': headers['customer-id'],
      'session-id': headers['session-id'],
      'accept': 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(`State HTTP ${res.status}`);
  }

  return res.json();
}
