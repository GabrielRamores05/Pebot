import bcrypt from 'bcryptjs';
import { canApprove, pinProblem } from '@/lib/approvals';
import * as repo from '@/modules/pins/repository';
import { rateLimit, resetRateLimit } from '@/lib/rate-limit';

// Staff PINs (spec 020): quick sign-in on a shared register and manager approvals.

function fail(message: string, status: number): Error {
  const e = new Error(message);
  (e as unknown as { status: number }).status = status;
  return e;
}

async function matching(pin: string) {
  const users = await repo.findActiveUsersWithPin();
  for (const u of users) {
    if (u.pinHash && (await bcrypt.compare(pin, u.pinHash))) return u;
  }
  return null;
}

/** Set, change (pin) or clear ('' / null) a staff member's PIN. PINs are unique among active staff. */
export async function setPin(userId: number, pin: string | null | undefined) {
  if (pin == null || pin === '') {
    await repo.setPinHash(userId, null);
    return;
  }
  const problem = pinProblem(String(pin));
  if (problem) throw fail(problem, 400);
  const owner = await matching(String(pin));
  if (owner && owner.id !== userId) throw fail('Another staff member already uses that PIN. Pick another.', 409);
  await repo.setPinHash(userId, await bcrypt.hash(String(pin), 10));
}

/** The active staff member with this PIN, for quick sign-in; null when none matches. */
export async function findUserByPin(pin: string) {
  if (pinProblem(pin) === 'Use 4 to 6 digits.') return null;
  const u = await matching(pin);
  if (!u) return null;
  const { pinHash: _omit, ...user } = u;
  void _omit;
  return user;
}

/**
 * The manager who approves with this PIN, or a 403 error. `askedBy` is the
 * signed-in user asking: 5 wrong PINs per 15 minutes each, so a cashier cannot
 * guess a manager's PIN.
 */
export async function requireApprover(pin: unknown, askedBy?: number) {
  if (typeof pin !== 'string' || !/^\d{4,6}$/.test(pin)) throw fail('Enter a manager PIN.', 403);
  const key = `approver:${askedBy ?? 'anyone'}`;
  if (!rateLimit(key, 5, 15 * 60 * 1000).allowed) {
    throw fail('Too many wrong manager PINs. Wait 15 minutes or ask the manager to sign in.', 429);
  }
  const u = await matching(pin);
  if (!u || !canApprove(u)) throw fail('That PIN is not a manager PIN.', 403);
  resetRateLimit(key);
  return { id: u.id, name: u.name };
}
