import { NextRequest, NextResponse } from 'next/server';
import { followUp } from '@/modules/orders/service';
import { serverError } from '@/lib/api-response';

// POST /api/orders/[id]/follow-up — customer follows up on their order
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const result = await followUp(id);
    return NextResponse.json(result);
  } catch (e: any) {
    if (e.status === 400) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    if (e.status === 404) {
      return NextResponse.json({ error: e.message }, { status: 404 });
    }
    return serverError(e, 'Failed to send follow-up');
  }
}
