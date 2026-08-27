import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { emitEvent } from '@/lib/socket';
import { notFound, serverError } from '@/lib/api-response';

export async function POST(req: NextRequest) {
  try {
    const { orderId, method, referenceNo, terminalId } = await req.json() as {
      orderId: number;
      method: 'CASH' | 'CARD' | 'EWALLET';
      referenceNo?: string;
      terminalId?: string;
    };

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return notFound('Order not found');

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
    return serverError(e);
  }
}

export async function GET() {
  try {
    const payments = await prisma.paymentTransaction.findMany({
      include: { order: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return NextResponse.json(payments);
  } catch (e) {
    return serverError(e);
  }
}
