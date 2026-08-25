import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { calculateStationWaitTime } from '@/lib/waitTime';

// GET /api/orders/[id]/wait-time — estimated wait per station for this order
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    // Support both numeric ID and order number
    const order = await prisma.order.findFirst({
      where: isNaN(Number(id)) ? { orderNumber: id } : { id: Number(id) },
      include: { items: { include: { product: { select: { stationType: true, prepTimeMinutes: true } } } } },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Collect unique stations in this order
    const stationItems = new Map<string, number>();
    for (const item of order.items) {
      const st = item.product.stationType;
      const prep = item.product.prepTimeMinutes * item.quantity;
      stationItems.set(st, (stationItems.get(st) || 0) + prep);
    }

    const estimatedTimes: Record<string, number> = {};
    for (const [st, ownPrep] of stationItems) {
      const queueWait = await calculateStationWaitTime(st, order.createdAt);
      // Add this order's own prep divided by staff
      const station = await prisma.staffStationControl.findUnique({ where: { stationType: st } });
      const staffCount = Math.max(station?.staffCount ?? 1, 1);
      estimatedTimes[st] = queueWait + Math.ceil(ownPrep / staffCount);
    }

    const maxWait = Math.max(...Object.values(estimatedTimes), 0);

    // Queue position: count orders at same stations that are pending/preparing and created before this one
    const queuePosition = await prisma.order.count({
      where: {
        status: { in: ['PENDING', 'PREPARING'] },
        createdAt: { lt: order.createdAt },
      },
    });

    return NextResponse.json({
      estimatedTimes,
      estimatedWait: maxWait,
      queuePosition: queuePosition + 1, // +1 = this order's position
      queueNumber: order.queueNumber,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to calculate wait time' }, { status: 500 });
  }
}
