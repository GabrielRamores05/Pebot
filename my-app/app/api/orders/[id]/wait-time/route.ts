import { NextRequest, NextResponse } from 'next/server';
import { getWaitTime } from '@/modules/orders/service';
import { serverError } from '@/lib/api-response';

// GET /api/orders/[id]/wait-time — estimated wait per station for this order
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const result = await getWaitTime(id);
    return NextResponse.json(result);
  } catch (e: any) {
    if (e.status === 404) {
      return NextResponse.json({ error: e.message }, { status: 404 });
    }
    return serverError(e, 'Failed to calculate wait time');
  }
}
