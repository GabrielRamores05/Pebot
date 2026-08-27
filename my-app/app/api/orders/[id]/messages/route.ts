import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { emitEvent } from '@/lib/socket';
import { getAuthUser, requireRole } from '@/lib/auth';
import { badRequest, notFound } from '@/lib/api-response';

// GET /api/orders/[id]/messages — list messages for an order
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Support both numeric ID and order number
  const where = /^\d+$/.test(id)
    ? { orderId: parseInt(id) }
    : { order: { orderNumber: id } };

  const messages = await prisma.orderMessage.findMany({
    where,
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json(messages);
}

// POST /api/orders/[id]/messages — add a follow-up message
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let body;
  try {
    body = await req.json();
  } catch {
    return badRequest('Invalid JSON body');
  }

  const { type, content } = body as {
    type?: string;
    content?: string;
    sender?: string;
  };

  if (!content || !content.trim()) {
    return badRequest('Message content is required');
  }

  // Find the order
  const order = /^\d+$/.test(id)
    ? await prisma.order.findUnique({ where: { id: parseInt(id) } })
    : await prisma.order.findUnique({ where: { orderNumber: id } });

  if (!order) {
    return notFound('Order not found');
  }

  // Verify the order is active (not completed or cancelled)
  if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
    return badRequest('Cannot send message for completed or cancelled order');
  }

  // A message is either from the customer or from a signed-in staff member.
  // Never trust the `sender` in the body — the customer's name belongs to the
  // order, and a staff reply requires a staff session (only staff can reply).
  const staffUser = await getAuthUser(req);
  const messageSender = staffUser && requireRole(staffUser, ['ADMIN', 'STAFF', 'KITCHEN'])
    ? staffUser.name
    : order.customerName || 'customer';

  const message = await prisma.orderMessage.create({
    data: {
      orderId: order.id,
      type: type === 'voice' ? 'voice' : 'text',
      content: content.trim(),
      sender: messageSender,
    },
  });

  // Notify admin/kitchen via socket, and the customer's order room for an instant reply
  const payload = {
    ...message,
    orderNumber: order.orderNumber,
    customerName: order.customerName,
  };
  emitEvent('order-message', payload);
  emitEvent('order-message', payload, `order-${order.orderNumber}`);

  return NextResponse.json(message, { status: 201 });
}
