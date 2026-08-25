import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth';

// GET /api/expenses — list all expenses with filtering
export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission(req, 'inventory');
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
    console.error('Error fetching expenses:', error);
    return NextResponse.json({ error: 'Failed to fetch expenses' }, { status: 500 });
  }
}

// POST /api/expenses — create a new expense
export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission(req, 'inventory');
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { categoryId, supplierId, amount, description, expenseDate } = body;

    if (!categoryId || !amount || amount <= 0) {
      return NextResponse.json({ error: 'categoryId and valid amount are required' }, { status: 400 });
    }

    const category = await prisma.expenseCategory.findUnique({
      where: { id: parseInt(categoryId) },
    });

    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
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
    console.error('Error creating expense:', error);
    return NextResponse.json({ error: 'Failed to create expense' }, { status: 500 });
  }
}

// PUT /api/expenses?id=X — update an expense
export async function PUT(req: NextRequest) {
  try {
    const user = await requirePermission(req, 'inventory');
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Expense ID required' }, { status: 400 });
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
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }
    console.error('Error updating expense:', error);
    return NextResponse.json({ error: 'Failed to update expense' }, { status: 500 });
  }
}

// DELETE /api/expenses?id=X — delete an expense
export async function DELETE(req: NextRequest) {
  try {
    const user = await requirePermission(req, 'inventory');
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Expense ID required' }, { status: 400 });
    }

    await prisma.expense.delete({ where: { id: Number(id) } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }
    console.error('Error deleting expense:', error);
    return NextResponse.json({ error: 'Failed to delete expense' }, { status: 500 });
  }
}
