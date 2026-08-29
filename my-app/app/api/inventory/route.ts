import { NextRequest, NextResponse } from 'next/server';
import { listInventory, updateInventory, ProductHasRecipeError } from '@/modules/inventory/service';
import { badRequest, serverError } from '@/lib/api-response';
import { guardFeature } from '@/lib/api-guards';
import { ValidationError } from 'zod-validation-error';

export async function GET(req: NextRequest) {
  const { error } = await guardFeature(req, 'inventory');
  if (error) return error;

  try {
    const inventory = await listInventory();
    return NextResponse.json(inventory);
  } catch (e) {
    return serverError(e);
  }
}

export async function PATCH(req: NextRequest) {
  const { error } = await guardFeature(req, 'inventory');
  if (error) return error;

  try {
    const body = await req.json();
    const inv = await updateInventory(body);
    return NextResponse.json(inv);
  } catch (e) {
    if (e instanceof ValidationError) {
      return badRequest(e.message);
    }
    if (e instanceof ProductHasRecipeError) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    const status = (e as { status?: number })?.status ?? 500;
    if (status === 403) {
      return NextResponse.json({ error: String(e) }, { status: 403 });
    }
    return serverError(e);
  }
}
