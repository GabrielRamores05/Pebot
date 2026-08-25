import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission(req, 'inventory');
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const categories = await prisma.expenseCategory.findMany({
      include: { _count: { select: { expenses: true } } },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(categories);
  } catch (error) {
    console.error('Error fetching expense categories:', error);
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission(req, 'inventory');
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { name, description } = body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Category name is required' }, { status: 400 });
    }

    const category = await prisma.expenseCategory.create({
      data: {
        name,
        description: description || null,
      },
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') {
      return NextResponse.json({ error: 'Category already exists' }, { status: 409 });
    }
    console.error('Error creating expense category:', error);
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 });
  }
}