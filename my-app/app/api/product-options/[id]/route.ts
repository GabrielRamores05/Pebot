import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth';
import { apiError, conflict, notFound, serverError, unauthorized } from '@/lib/api-response';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/product-options/:id — fetch a single per-product option with ingredients
export async function GET(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  try {
    const option = await prisma.productOption.findUnique({
      where: { id: Number(id) },
      include: { ingredients: true, group: true },
    });
    if (!option) return notFound('Option not found');
    return NextResponse.json(option);
  } catch {
    return apiError('Failed to fetch option', 500);
  }
}

// PUT /api/product-options/:id — update a per-product option
export async function PUT(req: NextRequest, { params }: RouteParams) {
  const user = await requirePermission(req, 'products');
  if (!user) return unauthorized();

  const { id } = await params;
  try {
    const body = await req.json();
    const { name, priceDelta, sortOrder, available } = body as {
      name?: string;
      priceDelta?: number;
      sortOrder?: number;
      available?: boolean;
    };

    const option = await prisma.productOption.update({
      where: { id: Number(id) },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(priceDelta !== undefined && { priceDelta }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(available !== undefined && { available }),
      },
    });
    return NextResponse.json(option);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return conflict('This product already has an option with that name in this group');
    }
    if (error.code === 'P2025') {
      return notFound('Option not found');
    }
    return serverError(error, 'Failed to update option');
  }
}

// DELETE /api/product-options/:id
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const user = await requirePermission(req, 'products');
  if (!user) return unauthorized();

  const { id } = await params;
  try {
    await prisma.productOption.delete({ where: { id: Number(id) } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return notFound('Option not found');
    }
    return serverError(error, 'Failed to delete option');
  }
}
