import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth';
import { badRequest, notFound, serverError, unauthorized } from '@/lib/api-response';
import { deleteSupplier } from '@/modules/inventory/repository';

// GET /api/suppliers - list all suppliers
export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission(req, 'inventory');
    if (!user) {
      return unauthorized();
    }

    const suppliers = await prisma.supplier.findMany({
      include: {
        ingredients: {
          select: {
            id: true,
            name: true,
            currentStock: true,
            baseUnit: true,
            // Which menu items depend on this supplier's ingredient
            products: { select: { product: { select: { id: true, name: true } } } },
          },
        },
        expenses: { select: { id: true, amount: true, expenseDate: true, description: true } },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(suppliers);
  } catch (error) {
    return serverError(error, 'Failed to fetch suppliers');
  }
}

// POST /api/suppliers - create a new supplier
export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission(req, 'inventory');
    if (!user) {
      return unauthorized();
    }

    const body = await req.json();
    const { name, contactPerson, phone, email, address, notes, status } = body;

    if (!name || typeof name !== 'string') {
      return badRequest('Supplier name is required');
    }

    const supplier = await prisma.supplier.create({
      data: {
        name,
        contactPerson: contactPerson || null,
        phone: phone || null,
        email: email || null,
        address: address || null,
        notes: notes || null,
        status: status || 'ACTIVE',
      },
    });

    return NextResponse.json(supplier, { status: 201 });
  } catch (error) {
    return serverError(error, 'Failed to create supplier');
  }
}

// PUT /api/suppliers/:id - update a supplier
export async function PUT(req: NextRequest) {
  try {
    const user = await requirePermission(req, 'inventory');
    if (!user) {
      return unauthorized();
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return badRequest('Supplier ID required');

    const body = await req.json();
    const { name, contactPerson, phone, email, address, notes, status } = body;

    const supplier = await prisma.supplier.update({
      where: { id: Number(id) },
      data: {
        name: name || undefined,
        contactPerson: contactPerson || null,
        phone: phone || null,
        email: email || null,
        address: address || null,
        notes: notes || null,
        status: status || undefined,
      },
    });

    return NextResponse.json(supplier);
  } catch (error: any) {
    if (error.code === 'P2025') {
      return notFound('Supplier not found');
    }
    return serverError(error, 'Failed to update supplier');
  }
}

// DELETE /api/suppliers/:id - delete a supplier
export async function DELETE(req: NextRequest) {
  try {
    const user = await requirePermission(req, 'inventory');
    if (!user) {
      return unauthorized();
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return badRequest('Supplier ID required');

    // Domain-side guard: recomputes affected ingredients' latest supplier
    // from remaining purchase history (spec 014 T032).
    await deleteSupplier(Number(id));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return notFound('Supplier not found');
    }
    return serverError(error, 'Failed to delete supplier');
  }
}
