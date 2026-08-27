import { logAction } from '@/lib/audit-log';

/**
 * Run a follow-on step that must not undo work already committed, without
 * hiding its failure.
 *
 * The error is logged with its context and recorded in the audit log, and the
 * message is returned so the caller can tell the person on the other end that
 * the step did not happen. Returns null when the step succeeded.
 */
export async function runRecoverableStep(
  step: string,
  context: Record<string, unknown>,
  fn: () => Promise<void>,
): Promise<string | null> {
  try {
    await fn();
    return null;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[${step}] failed:`, err);
    await logAction({
      action: `${step}_FAILED`,
      resource: 'system',
      details: { ...context, error: message },
    });
    return message;
  }
}
