import { NextRequest, NextResponse } from 'next/server';
import { listExpenses, createExpense, updateExpense, deleteExpense } from '@/modules/finance/service';
import { requirePermission } from '@/lib/auth';
import { badRequest, notFound, serverError, unauthorized } from '@/lib/api-response';
import { ValidationError } from 'zod-validation-error';

export async function GET(req: NextRequest) {
  const user = await requirePermission(req, 'inventory');
  if (!user) return unauthorized();

  try {
    const { searchParams } = new URL(req.url);
    const params: Record<string, unknown> = {};
    const categoryId = searchParams.get('categoryId');
    const supplierId = searchParams.get('supplierId');
    if (categoryId) params.categoryId = parseInt(categoryId);
    if (supplierId) params.supplierId = parseInt(supplierId);
    const expenses = await listExpenses(params);
    return NextResponse.json(expenses);
  } catch (e) {
    return serverError(e, 'Failed to fetch expenses');
  }
}

export async function POST(req: NextRequest) {
  const user = await requirePermission(req, 'inventory');
  if (!user) return unauthorized();

  try {
    const body = await req.json();
    const expense = await createExpense(body, user.userId);
    return NextResponse.json(expense, { status: 201 });
  } catch (e) {
    if (e instanceof ValidationError) {
      return badRequest(e.message);
    }
    const status = (e as { status?: number })?.status ?? 500;
    if (status === 404) return notFound(String(e));
    return serverError(e, 'Failed to create expense');
  }
}

export async function PUT(req: NextRequest) {
  const user = await requirePermission(req, 'inventory');
  if (!user) return unauthorized();

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return badRequest('Expense ID required');

    const body = await req.json();
    const expense = await updateExpense({ id: Number(id), ...body });
    return NextResponse.json(expense);
  } catch (e) {
    if (e instanceof ValidationError) {
      return badRequest(e.message);
    }
    const status = (e as { status?: number })?.status ?? 500;
    if (status === 404) return notFound(String(e));
    return serverError(e, 'Failed to update expense');
  }
}

export async function DELETE(req: NextRequest) {
  const user = await requirePermission(req, 'inventory');
  if (!user) return unauthorized();

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return badRequest('Expense ID required');

    await deleteExpense({ id: Number(id) });
    return NextResponse.json({ success: true });
  } catch (e) {
    if (e instanceof ValidationError) {
      return badRequest(e.message);
    }
    const status = (e as { status?: number })?.status ?? 500;
    if (status === 404) return notFound(String(e));
    return serverError(e, 'Failed to delete expense');
  }
}
