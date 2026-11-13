import { NextResponse } from 'next/server';

/** JSON error envelope used by every API route: { error: message }. */
export function apiError(message: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

export const badRequest = (message: string) => apiError(message, 400);

export const unauthorized = (message = 'Unauthorized') => apiError(message, 401);

export const forbidden = (message = 'Forbidden') => apiError(message, 403);

export const featureUnavailable = () =>
  apiError("You don't have permission to use this. Ask the owner to turn it on in Staff.", 403);

export const notFound = (message = 'Not found') => apiError(message, 404);

export const conflict = (message: string) => apiError(message, 409);

/** Log an unexpected failure and answer with a 500. */
export function serverError(error: unknown, message = 'Server error', extra?: Record<string, unknown>) {
  console.error(message, error);
  return apiError(message, 500, extra);
}
