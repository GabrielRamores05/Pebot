import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth';

// GET /api/staff/[id]/documents
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, 'staff');
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const docs = await prisma.staffDocument.findMany({
    where: { userId: Number(id) },
    include: { uploader: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(docs);
}

// POST /api/staff/[id]/documents — create a document record
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, 'staff');
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await params;
    const body = await req.json();
    const { name, type, fileUrl, expiryDate, notes } = body;
    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });

    const doc = await prisma.staffDocument.create({
      data: {
        userId: Number(id), name, type: type ?? 'OTHER',
        fileUrl: fileUrl || null, expiryDate: expiryDate ? new Date(expiryDate) : null,
        uploadedById: auth.userId, notes: notes || null,
      },
    });
    return NextResponse.json(doc, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to create document' }, { status: 500 });
  }
}
