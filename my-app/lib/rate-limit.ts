import { NextRequest } from 'next/server';

interface Attempt {
  count: number;
  firstAttempt: number;
}

const attempts = new Map<string, Attempt>();

/** Client address, as far as the LAN server can tell. */
export function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers.get('x-real-ip')?.trim() || 'unknown';
}

/**
 * Fixed-window limiter kept in process memory: the POS is a single Node server,
 * so there is nowhere else to keep it and nothing else to share it with.
 * Returns the seconds left in the window once the limit is reached.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const existing = attempts.get(key);

  if (!existing || now - existing.firstAttempt > windowMs) {
    attempts.set(key, { count: 1, firstAttempt: now });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  existing.count += 1;
  if (existing.count > limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((existing.firstAttempt + windowMs - now) / 1000),
    };
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

/** Clear a key's window — called after a success so a valid sign-in isn't punished. */
export function resetRateLimit(key: string): void {
  attempts.delete(key);
}
