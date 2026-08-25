import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { emitEvent } from '@/lib/socket';

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
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
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
    console.error(e);
    return NextResponse.json({ error: 'Failed to send follow-up' }, { status: 500 });
  }
}
