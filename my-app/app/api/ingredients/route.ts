import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth';

// GET /api/ingredients - Get all ingredients
export async function GET() {
  try {
    const ingredients = await prisma.ingredient.findMany({
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(ingredients);
  } catch (error) {
    console.error('Error fetching ingredients:', error);
    return NextResponse.json({ error: 'Failed to fetch ingredients' }, { status: 500 });
  }
}

// POST /api/ingredients - Create new ingredient
export async function POST(request: NextRequest) {
  const user = await requirePermission(request, 'inventory');
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
    console.error('Error creating ingredient:', error);
    return NextResponse.json({ error: 'Failed to create ingredient' }, { status: 500 });
  }
}
