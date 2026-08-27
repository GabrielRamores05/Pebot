import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth';
import { badRequest, conflict, serverError, unauthorized } from '@/lib/api-response';

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission(req, 'inventory');
    if (!user) {
      return unauthorized();
    }

    const categories = await prisma.expenseCategory.findMany({
      include: { _count: { select: { expenses: true } } },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(categories);
  } catch (error) {
    return serverError(error, 'Failed to fetch categories');
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission(req, 'inventory');
    if (!user) {
      return unauthorized();
    }

    const body = await req.json();
    const { name, description } = body;

    if (!name || typeof name !== 'string') {
      return badRequest('Category name is required');
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
      return conflict('Category already exists');
    }
    return serverError(error, 'Failed to create category');
  }
}