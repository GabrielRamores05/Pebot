import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth';
import { badRequest, notFound, serverError, unauthorized } from '@/lib/api-response';

// GET /api/expenses — list all expenses with filtering
export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission(req, 'inventory');
    if (!user) {
      return unauthorized();
    }

    const { searchParams } = new URL(req.url);
    const categoryId = searchParams.get('categoryId');
    const supplierId = searchParams.get('supplierId');

    const where: Record<string, unknown> = {};
    if (categoryId) where.categoryId = parseInt(categoryId);
    if (supplierId) where.supplierId = parseInt(supplierId);

    const expenses = await prisma.expense.findMany({
      where,
      include: {
        category: true,
        supplier: true,
        user: { select: { name: true, email: true, role: true } },
      },
      orderBy: { expenseDate: 'desc' },
    });

    return NextResponse.json(expenses);
  } catch (error) {
    return serverError(error, 'Failed to fetch expenses');
  }
}

// POST /api/expenses — create a new expense
export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission(req, 'inventory');
    if (!user) {
      return unauthorized();
    }

    const body = await req.json();
    const { categoryId, supplierId, amount, description, expenseDate } = body;

    if (!categoryId || !amount || amount <= 0) {
      return badRequest('categoryId and valid amount are required');
    }

    const category = await prisma.expenseCategory.findUnique({
      where: { id: parseInt(categoryId) },
    });

    if (!category) {
      return notFound('Category not found');
    }

    const expense = await prisma.expense.create({
      data: {
        categoryId: parseInt(categoryId),
        supplierId: supplierId ? parseInt(supplierId) : null,
        userId: user.userId,
        amount: parseFloat(amount),
        description: description || null,
        expenseDate: expenseDate ? new Date(expenseDate) : new Date(),
      },
      include: { category: true, supplier: true },
    });

    return NextResponse.json(expense, { status: 201 });
  } catch (error) {
    return serverError(error, 'Failed to create expense');
  }
}

// PUT /api/expenses?id=X — update an expense
export async function PUT(req: NextRequest) {
  try {
    const user = await requirePermission(req, 'inventory');
    if (!user) {
      return unauthorized();
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return badRequest('Expense ID required');
    }

    const body = await req.json();
    const { categoryId, supplierId, amount, description, expenseDate } = body;

    const data: Record<string, unknown> = {};
    if (categoryId) data.categoryId = parseInt(categoryId);
    if (supplierId !== undefined) data.supplierId = supplierId ? parseInt(supplierId) : null;
    if (amount !== undefined) data.amount = parseFloat(amount);
    if (description !== undefined) data.description = description || null;
    if (expenseDate !== undefined) data.expenseDate = new Date(expenseDate);

    const expense = await prisma.expense.update({
      where: { id: Number(id) },
      data,
      include: { category: true, supplier: true },
    });

    return NextResponse.json(expense);
  } catch (error: any) {
    if (error.code === 'P2025') {
      return notFound('Expense not found');
    }
    return serverError(error, 'Failed to update expense');
  }
}

// DELETE /api/expenses?id=X — delete an expense
export async function DELETE(req: NextRequest) {
  try {
    const user = await requirePermission(req, 'inventory');
    if (!user) {
      return unauthorized();
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return badRequest('Expense ID required');
    }

    await prisma.expense.delete({ where: { id: Number(id) } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return notFound('Expense not found');
    }
    return serverError(error, 'Failed to delete expense');
  }
}
