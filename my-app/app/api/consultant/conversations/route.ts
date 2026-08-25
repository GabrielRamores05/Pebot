import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth';

// GET /api/consultant/conversations — list all conversations for the user
export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission(req, 'settings');
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const conversations = await prisma.aIConversation.findMany({
      where: { userId: user.userId },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });

    return NextResponse.json(conversations);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    return NextResponse.json({ error: 'Failed to fetch conversations' }, { status: 500 });
  }
}

// POST /api/consultant/conversations — create a new conversation
export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission(req, 'settings');
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { title } = body as { title?: string };

    const conversation = await prisma.aIConversation.create({
      data: {
        userId: user.userId,
        title: title || 'New Conversation',
      },
    });

    return NextResponse.json(conversation, { status: 201 });
  } catch (error) {
    console.error('Error creating conversation:', error);
    return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 });
  }
}

// PATCH /api/consultant/conversations?id=X — update conversation title
export async function PATCH(req: NextRequest) {
  try {
    const user = await requirePermission(req, 'settings');
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Conversation ID required' }, { status: 400 });
    }

    const body = await req.json();
    const { title } = body as { title?: string };

    const conversation = await prisma.aIConversation.update({
      where: { id: Number(id), userId: user.userId },
      data: { title: title || undefined },
    });

    return NextResponse.json(conversation);
  } catch (error) {
    console.error('Error updating conversation:', error);
    return NextResponse.json({ error: 'Failed to update conversation' }, { status: 500 });
  }
}
