import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { emitEvent } from '@/lib/socket';
import { notFound, serverError } from '@/lib/api-response';

// POST /api/orders/[id]/follow-up — customer follows up on their order
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const order = await prisma.order.findFirst({
      where: isNaN(Number(id)) ? { orderNumber: id } : { id: Number(id) },
      include: { table: true },
    });

    if (!order) {
      return notFound('Order not found');
    }

    if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
      return NextResponse.json({ error: 'Order is already ' + order.status.toLowerCase() }, { status: 400 });
    }

    const tableName = order.table?.name || 'No table';

    emitEvent('order-followup', {
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      tableName,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return serverError(e, 'Failed to send follow-up');
  }
}
