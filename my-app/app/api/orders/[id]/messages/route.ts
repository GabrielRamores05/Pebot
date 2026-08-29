import { NextRequest, NextResponse } from 'next/server';
import { listMessages, createMessage } from '@/modules/orders/service';
import { badRequest, notFound, serverError } from '@/lib/api-response';

// GET /api/orders/[id]/messages — list messages for an order
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const messages = await listMessages(id);
    return NextResponse.json(messages);
  } catch (e: any) {
    if (e.status === 404) return notFound(e.message);
    return serverError(e);
  }
}

// POST /api/orders/[id]/messages — add a follow-up message
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    let body;
    try {
      body = await req.json();
    } catch {
      return badRequest('Invalid JSON body');
    }

    const message = await createMessage(id, body, req);
    return NextResponse.json(message, { status: 201 });
  } catch (e: any) {
    if (e.status === 400) return badRequest(e.message);
    if (e.status === 404) return notFound(e.message);
    return serverError(e);
  }
}
