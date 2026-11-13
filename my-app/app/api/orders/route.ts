import { NextRequest, NextResponse } from 'next/server';
import { listOrders, createOrder } from '@/modules/orders/service';
import { badRequest, serverError } from '@/lib/api-response';
import { guardStaff } from '@/lib/api-guards';
import { getAuthUser } from '@/lib/auth';
import { ValidationError } from 'zod-validation-error';

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
    // Customers order by QR without signing in; only staff may discount or confirm payment.
    const user = await getAuthUser(req);
    const order = await createOrder(body, { staff: Boolean(user) });
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
    if (e.status === 400 || e instanceof ValidationError) {
      return badRequest(e.message);
    }
    if (e.status === 403) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    return serverError(e, 'Failed to create order');
  }
}
