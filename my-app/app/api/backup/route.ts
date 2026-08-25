import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import { readFileSync, existsSync } from 'fs';
import { getDatabasePath } from '@/lib/db-path';
import { getAuthUser, requireRole } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!requireRole(user, ['ADMIN'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Path to the SQLite database (resolved from DATABASE_URL or fallback)
    const dbPath = getDatabasePath();

    // Check if database file exists
    if (!existsSync(dbPath)) {
      return NextResponse.json({ error: 'Database file not found' }, { status: 404 });
    }

    // Generate timestamp for filename
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}-${pad(now.getMinutes())}`;
    const zipFilename = `cafeos-backup-${timestamp}.zip`;

    // Read the database file
    const dbData = readFileSync(dbPath);

    // Build the ZIP archive containing the snapshot
    const zip = new JSZip();
    zip.file('dev.db', dbData);
    const zipData = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
    });

    return new NextResponse(new Uint8Array(zipData), {
      headers: {
        'Content-Disposition': `attachment; filename="${zipFilename}"`,
        'Content-Type': 'application/zip',
      },
    });
  } catch (error) {
    console.error('Backup error:', error);
    return NextResponse.json({ error: 'Backup failed: ' + String(error) }, { status: 500 });
  }
}