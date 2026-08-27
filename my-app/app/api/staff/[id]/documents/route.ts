import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth';
import { badRequest, serverError, unauthorized } from '@/lib/api-response';

// GET /api/staff/[id]/documents
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, 'staff');
  if (!auth) return unauthorized();

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
  if (!auth) return unauthorized();

  try {
    const { id } = await params;
    const body = await req.json();
    const { name, type, fileUrl, expiryDate, notes } = body;
    if (!name) return badRequest('name required');

    const doc = await prisma.staffDocument.create({
      data: {
        userId: Number(id), name, type: type ?? 'OTHER',
        fileUrl: fileUrl || null, expiryDate: expiryDate ? new Date(expiryDate) : null,
        uploadedById: auth.userId, notes: notes || null,
      },
    });
    return NextResponse.json(doc, { status: 201 });
  } catch (e) {
    return serverError(e, 'Failed to create document');
  }
}
