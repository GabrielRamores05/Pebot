/** An error response from one of our own API routes. */
export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/**
 * Fetch JSON from an API route, throwing when the request or the response
 * failed so the caller cannot mistake a failure for data.
 */
export async function fetchJson<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body && typeof body.error === 'string') message = body.error;
    } catch (parseErr) {
      console.error(`[fetchJson] ${input} returned ${res.status} with a non-JSON body:`, parseErr);
    }
    throw new ApiError(message, res.status);
  }
  return (await res.json()) as T;
}

/** A plain sentence to show a person for any thrown error. */
export function userMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof TypeError) return 'No connection to the server — check your network and try again.';
  return fallback;
}
