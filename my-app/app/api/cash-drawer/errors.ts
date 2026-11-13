import { ValidationError } from 'zod-validation-error';
import { apiError, serverError } from '@/lib/api-response';

/** Maps cash drawer service errors to responses: validation 400, otherwise the error's status. */
export function drawerError(e: unknown) {
  if (e instanceof ValidationError) return apiError(e.message, 400);
  const status = (e as { status?: number })?.status;
  if (status && status >= 400 && status < 500) return apiError((e as Error).message, status);
  return serverError(e, 'Cash drawer request failed');
}
