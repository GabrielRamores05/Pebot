import { NextRequest, NextResponse } from 'next/server';
import { listOrders, createOrder } from '@/modules/orders/service';
import { badRequest, serverError } from '@/lib/api-response';
import { guardStaff } from '@/lib/api-guards';

// GET /api/orders – list orders (staff only; customers track a single order by number)
export async function GET(req: NextRequest) {
  const guard = await guardStaff(req);
  if (guard.error) return guard.error;
  try {
    const { searchParams } = new URL(req.url);
    const result = await listOrders({
      status: searchParams.get('status') ?? undefined,
      date: searchParams.get('date') ?? undefined,
      search: searchParams.get('search') ?? undefined,
      all: searchParams.get('all') === 'true',
    });
    return NextResponse.json(result);
  } catch (e: any) {
    if (e.status) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return serverError(e, 'Failed to fetch orders');
  }
}

// POST /api/orders – place a new order
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const order = await createOrder(body);
    return NextResponse.json(order, { status: 201 });
  } catch (e: any) {
    if (e instanceof Error && e.name === 'LoyaltyVoucherError') {
      return NextResponse.json(
        { error: `${(e as any).reasons.join(' ')} Your order was not placed — nothing has been charged.` },
        { status: 409 },
      );
    }
    if (e instanceof Error && e.name === 'InsufficientStockError') {
      const names = (e as any).items.map((i: { name: string }) => i.name).join(', ');
      return NextResponse.json(
        { error: `Sorry, these items are no longer available: ${names}. Your order was not placed — nothing has been charged.` },
        { status: 409 },
      );
    }
    if (e.status === 400) {
      return badRequest(e.message);
    }
    return serverError(e, 'Failed to create order');
  }
}
