import { NextRequest, NextResponse } from 'next/server';
import { getOrder, updateOrder } from '@/modules/orders/service';
import { badRequest, notFound, serverError } from '@/lib/api-response';
import { guardStaff } from '@/lib/api-guards';

// GET /api/orders/[id] – fetch single order by orderNumber or id
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const order = await getOrder(id);
    return NextResponse.json(order);
  } catch (e: any) {
    if (e.status === 404) return notFound(e.message);
    return serverError(e);
  }
}

// PATCH /api/orders/[id] – update order status
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();

    const bodyKeys = Object.keys(body as Record<string, unknown>);
    const isCustomerCancel =
      bodyKeys.length === 1 && bodyKeys[0] === 'status' && body.status === 'CANCELLED';

    if (!isCustomerCancel) {
      const { error } = await guardStaff(req);
      if (error) return error;
    }

    const order = await updateOrder(id, body);
    return NextResponse.json(order);
  } catch (e: any) {
    if (e.status === 400) return badRequest(e.message);
    if (e.status === 404) return notFound(e.message);
    return serverError(e);
  }
}
