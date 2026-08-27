import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { badRequest, serverError } from '@/lib/api-response';

const UPLOADS_DIR = join(process.cwd(), 'uploads');
const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};
const MAX_FILE_SIZE = 5 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return badRequest('No file provided');
    if (file.size > MAX_FILE_SIZE) {
      return badRequest('File must be 5 MB or smaller');
    }

    const extension = MIME_EXTENSIONS[file.type];
    if (!extension) {
      return badRequest('Only JPEG, PNG, WebP, and GIF images are allowed');
    }

    await mkdir(UPLOADS_DIR, { recursive: true });

    const bytes = await file.arrayBuffer();
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
    await writeFile(join(UPLOADS_DIR, filename), Buffer.from(bytes));

    return NextResponse.json({ url: `/api/files/${filename}` });
  } catch (e) {
    return serverError(e, 'Upload failed');
  }
}
