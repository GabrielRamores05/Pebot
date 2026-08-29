import { NextRequest, NextResponse } from 'next/server';
import { badRequest, serverError, unauthorized } from '@/lib/api-response';
import { requirePermission } from '@/lib/auth';
import { listCategories, createCategory, updateCategory, deleteCategory } from '@/modules/catalog/service';
import { ValidationError } from 'zod-validation-error';

export async function GET() {
  try {
    const categories = await listCategories();
    return NextResponse.json(categories);
  } catch (e) {
    return serverError(e, 'Failed to fetch categories');
  }
}

export async function POST(req: NextRequest) {
  const user = await requirePermission(req, 'products');
  if (!user) return unauthorized();

  try {
    const body = await req.json();
    const category = await createCategory(body);
    return NextResponse.json(category, { status: 201 });
  } catch (e) {
    if (e instanceof ValidationError) {
      return badRequest(e.message);
    }
    const status = (e as { status?: number })?.status ?? 500;
    if (status === 400) {
      return NextResponse.json({ error: String(e) }, { status: 400 });
    }
    return serverError(e, 'Failed to create category');
  }
}

export async function PATCH(req: NextRequest) {
  const user = await requirePermission(req, 'products');
  if (!user) return unauthorized();

  try {
    const body = await req.json();
    const category = await updateCategory(body);
    return NextResponse.json(category);
  } catch (e) {
    if (e instanceof ValidationError) {
      return badRequest(e.message);
    }
    const status = (e as { status?: number })?.status ?? 500;
    if (status === 404) {
      return NextResponse.json({ error: String(e) }, { status: 404 });
    }
    if (status === 400) {
      return NextResponse.json({ error: String(e) }, { status: 400 });
    }
    return serverError(e, 'Failed to update category');
  }
}

export async function DELETE(req: NextRequest) {
  const user = await requirePermission(req, 'products');
  if (!user) return unauthorized();

  try {
    const body = await req.json();
    const category = await deleteCategory(body);
    return NextResponse.json({ ok: true, category });
  } catch (e) {
    if (e instanceof ValidationError) {
      return badRequest(e.message);
    }
    const status = (e as { status?: number })?.status ?? 500;
    if (status === 404) {
      return NextResponse.json({ error: String(e) }, { status: 404 });
    }
    if (status === 400) {
      return NextResponse.json({ error: String(e) }, { status: 400 });
    }
    return serverError(e, 'Failed to delete category');
  }
}
