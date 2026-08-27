import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { serverError, unauthorized } from '@/lib/api-response';
import { requirePermission } from '@/lib/auth';

// GET /api/ingredients - Get all ingredients
export async function GET() {
  try {
    const ingredients = await prisma.ingredient.findMany({
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(ingredients);
  } catch (error) {
    return serverError(error, 'Failed to fetch ingredients');
  }
}

// POST /api/ingredients - Create new ingredient
export async function POST(request: NextRequest) {
  const user = await requirePermission(request, 'inventory');
  if (!user) return unauthorized();

  try {
    const body = await request.json();
    const { name, category, baseUnit, purchaseUnit, currentStock, minStock, costPerUnit, supplierId, supplier } = body;

    const resolvedSupplierId = supplierId
      ? parseInt(String(supplierId))
      : supplier && typeof supplier === 'string' && !isNaN(parseInt(supplier))
        ? parseInt(supplier)
        : supplier && typeof supplier === 'object' && 'id' in supplier
          ? (supplier as any).id
          : null;

    const ingredient = await prisma.ingredient.create({
      data: {
        name,
        category: category || undefined,
        baseUnit: baseUnit || 'g',
        purchaseUnit: purchaseUnit || baseUnit || 'g',
        currentStock: currentStock || 0,
        minStock: minStock || 0,
        costPerUnit: costPerUnit || 0,
        supplierId: resolvedSupplierId,
      },
    });

    return NextResponse.json(ingredient, { status: 201 });
  } catch (error) {
    return serverError(error, 'Failed to create ingredient');
  }
}
