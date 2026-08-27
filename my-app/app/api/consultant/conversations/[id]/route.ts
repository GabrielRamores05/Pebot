import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth';
import { badRequest, notFound, serverError, unauthorized } from '@/lib/api-response';

// GET /api/consultant/conversations/:id — fetch messages for a conversation
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> | { id: string } }) {
  try {
    const user = await requirePermission(req, 'settings');
    if (!user) {
      return unauthorized();
    }

    const resolvedParams = await Promise.resolve(params);
    const { id } = resolvedParams as { id: string };
    const convId = parseInt(id);
    if (isNaN(convId)) {
      return badRequest('Invalid conversation ID');
    }

    const conversation = await prisma.aIConversation.findFirst({
      where: { id: convId, userId: user.userId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!conversation) {
      return notFound('Conversation not found');
    }

    return NextResponse.json(conversation);
  } catch (error) {
    return serverError(error, 'Failed to fetch conversation');
  }
}

// POST /api/consultant/conversations/:id/messages — add a message to a conversation
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> | { id: string } }) {
  try {
    const user = await requirePermission(req, 'settings');
    if (!user) {
      return unauthorized();
    }

    const resolvedParams = await Promise.resolve(params);
    const { id } = resolvedParams as { id: string };
    const convId = parseInt(id);
    if (isNaN(convId)) {
      return badRequest('Invalid conversation ID');
    }

    const body = await req.json();
    const { role, content } = body as { role: 'user' | 'assistant'; content: string };

    if (!role || !content) {
      return badRequest('role and content are required');
    }

    const conversation = await prisma.aIConversation.findFirst({
      where: { id: convId, userId: user.userId },
    });

    if (!conversation) {
      return notFound('Conversation not found');
    }

    const message = await prisma.aIMessage.create({
      data: {
        conversationId: convId,
        role,
        content,
      },
    });

    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    return serverError(error, 'Failed to add message');
  }
}

// DELETE /api/consultant/conversations/:id — delete a conversation
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> | { id: string } }) {
  try {
    const user = await requirePermission(req, 'settings');
    if (!user) {
      return unauthorized();
    }

    const resolvedParams = await Promise.resolve(params);
    const { id } = resolvedParams as { id: string };
    const convId = parseInt(id);
    if (isNaN(convId)) {
      return badRequest('Invalid conversation ID');
    }

    const conversation = await prisma.aIConversation.findFirst({
      where: { id: convId, userId: user.userId },
    });

    if (!conversation) {
      return notFound('Conversation not found');
    }

    await prisma.aIConversation.delete({
      where: { id: convId, userId: user.userId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return serverError(error, 'Failed to delete conversation');
  }
}
