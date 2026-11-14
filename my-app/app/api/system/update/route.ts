import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, requireRole } from '@/lib/auth';
import { forbidden, unauthorized } from '@/lib/api-response';
import { checkForUpdate, type UpdateInfo } from '@/lib/update-check';
import pkg from '@/package.json';

// GET /api/system/update[?force=1] — is a newer Pebot out? Owner (ADMIN) only.
// Asks the internet at most every 6 hours; ?force=1 asks now.
const EVERY_MS = 6 * 60 * 60 * 1000;
let cached: UpdateInfo | null = null;
let checking: Promise<UpdateInfo> | null = null;

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (!requireRole(user, ['ADMIN'])) return forbidden();

  const force = req.nextUrl.searchParams.get('force') === '1';
  const stale = !cached || Date.now() - Date.parse(cached.checkedAt) > EVERY_MS || (cached.error && Date.now() - Date.parse(cached.checkedAt) > 10 * 60 * 1000);
  if (force || stale) {
    checking ??= checkForUpdate({ current: pkg.version }).finally(() => { checking = null; });
    cached = await checking;
  }
  return NextResponse.json(cached);
}
