import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth';

// GET /api/suppliers - list all suppliers
export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission(req, 'inventory');
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const suppliers = await prisma.supplier.findMany({
      include: {
        ingredients: { select: { id: true, name: true, currentStock: true, baseUnit: true } },
        expenses: { select: { id: true, amount: true, expenseDate: true, description: true } },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(suppliers);
  } catch (error) {
    console.error('Error fetching suppliers:', error);
    return NextResponse.json({ error: 'Failed to fetch suppliers' }, { status: 500 });
  }
}

// POST /api/suppliers - create a new supplier
export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission(req, 'inventory');
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { name, contactPerson, phone, email, address, notes, status } = body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Supplier name is required' }, { status: 400 });
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
    console.error('Error creating supplier:', error);
    return NextResponse.json({ error: 'Failed to create supplier' }, { status: 500 });
  }
}

// PUT /api/suppliers/:id - update a supplier
export async function PUT(req: NextRequest) {
  try {
    const user = await requirePermission(req, 'inventory');
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Supplier ID required' }, { status: 400 });

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
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
    }
    console.error('Error updating supplier:', error);
    return NextResponse.json({ error: 'Failed to update supplier' }, { status: 500 });
  }
}

// DELETE /api/suppliers/:id - delete a supplier
export async function DELETE(req: NextRequest) {
  try {
    const user = await requirePermission(req, 'inventory');
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Supplier ID required' }, { status: 400 });

    await prisma.supplier.delete({
      where: { id: Number(id) },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
    }
    console.error('Error deleting supplier:', error);
    return NextResponse.json({ error: 'Failed to delete supplier' }, { status: 500 });
  }
}
