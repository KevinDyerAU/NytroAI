import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Wraps a promise with a timeout
 * @param promise The promise to wrap
 * @param ms Timeout in milliseconds (default: 30000)
 * @param message Error message for timeout
 * @returns The promise result or throws a timeout error
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number = 30000,
  message = 'Request timed out'
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${message} (after ${ms / 1000}s)`));
    }, ms);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);
    throw error;
  }
}

/**
 * Creates an AbortController with automatic timeout cleanup
 * @param ms Timeout in milliseconds
 * @returns Object with signal and cleanup function
 */
export function createTimeoutController(ms: number = 30000): {
  signal: AbortSignal;
  cleanup: () => void;
} {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ms);

  return {
    signal: controller.signal,
    cleanup: () => clearTimeout(timeoutId),
  };
}

console.log('[Supabase] Initializing with URL:', supabaseUrl ? `${supabaseUrl.split('/')[2]}` : 'MISSING');
console.log('[Supabase] Anonymous key configured:', supabaseAnonKey ? 'YES' : 'NO');

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('CRITICAL: Supabase credentials not configured!');
  console.error('VITE_SUPABASE_URL:', supabaseUrl);
  console.error('VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? 'SET' : 'MISSING');
  console.error('Available env vars:', Object.keys(import.meta.env).filter(k => k.startsWith('VITE_')));
}

// Recovery: Clear corrupted sessions from localStorage before initializing Supabase
function recoverFromCorruptedSession() {
  try {
    const host = supabaseUrl?.split('/')[2];
    if (!host) return;

    const sessionKey = `sb-${host}-auth-token`;
    const storedSession = localStorage.getItem(sessionKey);

    if (storedSession) {
      try {
        const session = JSON.parse(storedSession);
        // Check for corrupted state: missing refresh_token, expired tokens, or invalid structure
        const isCorrupted =
          !session.refresh_token ||
          (session.access_token && !session.user) ||
          (session.expires_at && session.expires_at < Date.now() / 1000);

        if (isCorrupted) {
          console.warn('[Supabase] Detected corrupted session, clearing...');
          localStorage.removeItem(sessionKey);
        }
      } catch (e) {
        console.warn('[Supabase] Corrupted session data detected (JSON parse error), clearing...');
        localStorage.removeItem(sessionKey);
      }
    }
  } catch (err) {
    console.error('[Supabase] Error recovering from corrupted session:', err);
  }
}

if (typeof window !== 'undefined') {
  recoverFromCorruptedSession();
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
    global: {
      headers: {
        'Content-Type': 'application/json',
      },
    },
    db: {
      schema: 'public',
    },
    realtime: {
      params: {
        eventsPerSecond: 2,
      },
    },
  }
);

// Set up error handler for token refresh failures
if (typeof window !== 'undefined') {
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' || !session) {
      // Ensure clean state when token refresh fails or user signs out
      try {
        const sessionKey = `sb-${supabaseUrl?.split('/')[2]}-auth-token`;
        localStorage.removeItem(sessionKey);
        console.log('[Supabase] Cleared invalid session after auth state change');
      } catch (err) {
        console.error('[Supabase] Error clearing session:', err);
      }
    }
  });
}
