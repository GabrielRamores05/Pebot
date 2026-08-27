import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { badRequest, serverError } from '@/lib/api-response';

const UPLOADS_DIR = join(process.cwd(), 'uploads');

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return badRequest('No file provided');

    await mkdir(UPLOADS_DIR, { recursive: true });

    const bytes = await file.arrayBuffer();
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    await writeFile(join(UPLOADS_DIR, filename), Buffer.from(bytes));

    return NextResponse.json({ url: `/api/files/${filename}` });
  } catch (e) {
    return serverError(e, 'Upload failed');
  }
}
