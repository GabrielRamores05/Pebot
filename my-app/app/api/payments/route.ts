import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { emitEvent } from '@/lib/socket';
import { getAuthUser } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { orderId, method, referenceNo, terminalId } = await req.json() as {
      orderId: number;
      method: 'CASH' | 'CARD' | 'EWALLET';
      referenceNo?: string;
      terminalId?: string;
    };

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    const payment = await prisma.$transaction(async (tx) => {
      const p = await tx.paymentTransaction.create({
        data: {
          orderId,
          amount: order.totalAmount,
          method,
          status: 'COMPLETED',
          referenceNo,
          terminalId,
          processedAt: new Date(),
        },
      });

      await tx.order.update({
        where: { id: orderId },
        data: { status: 'COMPLETED' },
      });

      return p;
    });

    const updatedOrder = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { product: true } }, table: true, payment: true },
    });

    emitEvent('order-status-update', updatedOrder);
    emitEvent('analytics-update', { type: 'payment-completed', order: updatedOrder });

    return NextResponse.json(payment, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const payments = await prisma.paymentTransaction.findMany({
      include: { order: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return NextResponse.json(payments);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
