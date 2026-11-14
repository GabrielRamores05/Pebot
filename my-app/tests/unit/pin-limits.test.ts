import { beforeEach, describe, expect, it, vi } from 'vitest';
import bcrypt from 'bcryptjs';

const users: { id: number; name: string; role: string; active: boolean; permissions: string; pinHash: string | null }[] = [];
vi.mock('@/modules/pins/repository', () => ({
  findActiveUsersWithPin: vi.fn(async () => users),
  setPinHash: vi.fn(),
}));

import { requireApprover } from '@/modules/pins/service';
import { rateLimit, undoAttempt, resetRateLimit } from '@/lib/rate-limit';

describe('manager PIN approval limit (security)', () => {
  beforeEach(async () => {
    users.length = 0;
    users.push({ id: 1, name: 'Manager', role: 'ADMIN', active: true, permissions: '{}', pinHash: await bcrypt.hash('4821', 4) });
    resetRateLimit('approver:7');
    resetRateLimit('approver:8');
  });

  it('approves with the right PIN', async () => {
    await expect(requireApprover('4821', 7)).resolves.toEqual({ id: 1, name: 'Manager' });
  });

  it('stops a cashier after 5 wrong PINs, even if the 6th is right', async () => {
    for (let i = 0; i < 5; i++) await expect(requireApprover('0000', 7)).rejects.toMatchObject({ status: 403 });
    await expect(requireApprover('4821', 7)).rejects.toMatchObject({ status: 429 });
    // Another cashier is not locked out.
    await expect(requireApprover('4821', 8)).resolves.toMatchObject({ id: 1 });
  });
});

describe('undoAttempt', () => {
  it('gives back one counted try', () => {
    resetRateLimit('t');
    rateLimit('t', 1, 60000);
    expect(rateLimit('t', 1, 60000).allowed).toBe(false);
    undoAttempt('t');
    undoAttempt('t');
    expect(rateLimit('t', 1, 60000).allowed).toBe(true);
  });
});
