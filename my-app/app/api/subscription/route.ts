import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { getUserSubscription } from '@/lib/subscription';
import { serverError, unauthorized } from '@/lib/api-response';

// GET /api/subscription – the signed-in user's subscription tier and features.
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  try {
    const subscription = await getUserSubscription(user.userId);
    return NextResponse.json(subscription);
  } catch (e) {
    return serverError(e, 'Failed to fetch subscription');
  }
}
