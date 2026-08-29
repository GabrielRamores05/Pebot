import { NextRequest, NextResponse } from 'next/server';
import { listExpenseCategories, createExpenseCategory } from '@/modules/finance/service';
import { requirePermission } from '@/lib/auth';
import { badRequest, conflict, serverError, unauthorized } from '@/lib/api-response';
import { ValidationError } from 'zod-validation-error';

export async function GET(req: NextRequest) {
  const user = await requirePermission(req, 'inventory');
  if (!user) return unauthorized();

  try {
    const categories = await listExpenseCategories();
    return NextResponse.json(categories);
  } catch (e) {
    return serverError(e, 'Failed to fetch categories');
  }
}

export async function POST(req: NextRequest) {
  const user = await requirePermission(req, 'inventory');
  if (!user) return unauthorized();

  try {
    const body = await req.json();
    const category = await createExpenseCategory(body);
    return NextResponse.json(category, { status: 201 });
  } catch (e) {
    if (e instanceof ValidationError) {
      return badRequest(e.message);
    }
    const status = (e as { status?: number })?.status ?? 500;
    if (status === 409) return conflict(String(e));
    return serverError(e, 'Failed to create category');
  }
}
