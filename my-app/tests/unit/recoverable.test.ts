import { beforeEach, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ logAction: vi.fn() }));

vi.mock('@/lib/audit-log', () => ({ logAction: mocks.logAction }));

import { runRecoverableStep } from '../../lib/recoverable';

beforeEach(() => {
  mocks.logAction.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

test('a successful step reports nothing and is not audited', async () => {
  const fn = vi.fn().mockResolvedValue(undefined);

  await expect(runRecoverableStep('PRINT_RECEIPT', { orderId: 5 }, fn)).resolves.toBeNull();
  expect(fn).toHaveBeenCalledOnce();
  expect(mocks.logAction).not.toHaveBeenCalled();
});

test('a failed step returns its message and records it with the context', async () => {
  const fn = vi.fn().mockRejectedValue(new Error('Printer offline'));

  await expect(runRecoverableStep('PRINT_RECEIPT', { orderId: 5 }, fn)).resolves.toBe(
    'Printer offline',
  );
  expect(mocks.logAction).toHaveBeenCalledWith({
    action: 'PRINT_RECEIPT_FAILED',
    resource: 'system',
    details: { orderId: 5, error: 'Printer offline' },
  });
});

test('a non-Error rejection is still reported as a message', async () => {
  const fn = vi.fn().mockRejectedValue('timeout');

  await expect(runRecoverableStep('AWARD_LOYALTY', {}, fn)).resolves.toBe('timeout');
  expect(mocks.logAction).toHaveBeenCalledWith({
    action: 'AWARD_LOYALTY_FAILED',
    resource: 'system',
    details: { error: 'timeout' },
  });
});
