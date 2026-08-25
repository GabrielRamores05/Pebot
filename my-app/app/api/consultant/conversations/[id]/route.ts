import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth';

// GET /api/consultant/conversations/:id — fetch messages for a conversation
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> | { id: string } }) {
  try {
    const user = await requirePermission(req, 'settings');
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await Promise.resolve(params);
    const { id } = resolvedParams as { id: string };
    const convId = parseInt(id);
    if (isNaN(convId)) {
      return NextResponse.json({ error: 'Invalid conversation ID' }, { status: 400 });
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
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    return NextResponse.json(conversation);
  } catch (error) {
    console.error('Error fetching conversation:', error);
    return NextResponse.json({ error: 'Failed to fetch conversation' }, { status: 500 });
  }
}

// POST /api/consultant/conversations/:id/messages — add a message to a conversation
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> | { id: string } }) {
  try {
    const user = await requirePermission(req, 'settings');
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await Promise.resolve(params);
    const { id } = resolvedParams as { id: string };
    const convId = parseInt(id);
    if (isNaN(convId)) {
      return NextResponse.json({ error: 'Invalid conversation ID' }, { status: 400 });
    }

    const body = await req.json();
    const { role, content } = body as { role: 'user' | 'assistant'; content: string };

    if (!role || !content) {
      return NextResponse.json({ error: 'role and content are required' }, { status: 400 });
    }

    const conversation = await prisma.aIConversation.findFirst({
      where: { id: convId, userId: user.userId },
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
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
    console.error('Error adding message:', error);
    return NextResponse.json({ error: 'Failed to add message' }, { status: 500 });
  }
}

// DELETE /api/consultant/conversations/:id — delete a conversation
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> | { id: string } }) {
  try {
    const user = await requirePermission(req, 'settings');
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await Promise.resolve(params);
    const { id } = resolvedParams as { id: string };
    const convId = parseInt(id);
    if (isNaN(convId)) {
      return NextResponse.json({ error: 'Invalid conversation ID' }, { status: 400 });
    }

    const conversation = await prisma.aIConversation.findFirst({
      where: { id: convId, userId: user.userId },
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    await prisma.aIConversation.delete({
      where: { id: convId, userId: user.userId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    return NextResponse.json({ error: 'Failed to delete conversation' }, { status: 500 });
  }
}
