import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import { writeFileSync, renameSync, existsSync, mkdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { getAuthUser, requireRole } from '@/lib/auth';
import { getDatabasePath } from '@/lib/db-path';
import { prisma } from '@/lib/prisma';
import { apiError, badRequest, forbidden, unauthorized } from '@/lib/api-response';

const SQLITE_MAGIC = Buffer.from('SQLite format 3\x00', 'latin1');

function looksLikeSqlite(buf: Buffer): boolean {
  return buf.length >= 16 && buf.subarray(0, 16).equals(SQLITE_MAGIC);
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return unauthorized();
    }
    if (!requireRole(user, ['ADMIN'])) {
      return forbidden();
    }

    // Parse the form data (ZIP file upload)
    const formData = await req.formData();
    const file = formData.get('backup') as File | null;

    if (!file) {
      return badRequest('No backup file provided');
    }

    // Read and validate the archive
    const bytes = Buffer.from(await file.arrayBuffer());

    let zip: JSZip;
    try {
      zip = await JSZip.loadAsync(bytes);
    } catch {
      return badRequest('Failed to restore backup. The selected file is not a valid CafeOS backup.');
    }

    const dbEntry = zip.file('dev.db');
    if (!dbEntry) {
      return badRequest('Failed to restore backup. The selected file is not a valid CafeOS backup.');
    }

    const dbData = await dbEntry.async('nodebuffer');
    if (!looksLikeSqlite(dbData)) {
      return badRequest('Failed to restore backup. The selected file is not a valid CafeOS backup.');
    }

    // Resolve the active database path (respects DATABASE_URL set by main.js)
    const dbPath = getDatabasePath();
    const tmpDir = join(process.cwd(), 'tmp');
    if (!existsSync(tmpDir)) {
      mkdirSync(tmpDir, { recursive: true });
    }
    const stagedPath = join(tmpDir, `restore-${Date.now()}.db`);

    if (!existsSync(dbPath)) {
      return apiError('Current database file not found', 500);
    }

    // Write the new database to a staging path first
    writeFileSync(stagedPath, dbData);

    // Disconnect Prisma so the SQLite file handle is released, then swap the file
    await prisma.$disconnect();

    let swapped = false;
    try {
      renameSync(stagedPath, dbPath);
      swapped = true;
    } finally {
      // Reconnect the client regardless of whether the swap succeeded
      await prisma.$connect();
      if (!swapped) {
        // Swap failed; clean up the staging file
        try {
          unlinkSync(stagedPath);
        } catch (cleanupErr) {
          console.error('[RESTORE] Failed to remove staged database file:', stagedPath, cleanupErr);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Database restored successfully. Please log in again.',
      redirect: '/login',
    });
  } catch (error) {
    console.error('Restore error:', error);
    return NextResponse.json({ error: 'Restore failed: ' + String(error) }, { status: 500 });
  }
}