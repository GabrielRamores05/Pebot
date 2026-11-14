import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, requireRole } from '@/lib/auth';
import { badRequest, forbidden, serverError, unauthorized } from '@/lib/api-response';
import { getDatabasePath } from '@/lib/db-path';
import { defaultFolder, folderProblem, readConfig, runBackup, writeConfig } from '@/lib/auto-backup.js';

// Automatic daily backup settings (spec 022). Owner (ADMIN) only.
async function admin(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return { error: unauthorized() };
  if (!requireRole(user, ['ADMIN'])) return { error: forbidden() };
  return { user };
}

function view() {
  const db = getDatabasePath();
  const cfg = readConfig(db);
  return { ...cfg, defaultFolder: defaultFolder(db) };
}

// GET: settings and the last result.
export async function GET(req: NextRequest) {
  const a = await admin(req);
  if (a.error) return a.error;
  try {
    return NextResponse.json(view());
  } catch (e) {
    return serverError(e, 'Could not read the backup settings');
  }
}

// PUT { extraFolder: string | null, keep: number }
export async function PUT(req: NextRequest) {
  const a = await admin(req);
  if (a.error) return a.error;
  try {
    const body = await req.json().catch(() => ({}));
    const extraFolder = typeof body.extraFolder === 'string' && body.extraFolder.trim() ? body.extraFolder.trim() : null;
    const keep = Number(body.keep ?? 14);
    if (!Number.isInteger(keep) || keep < 1 || keep > 365) return badRequest('Keep between 1 and 365 copies.');
    if (extraFolder) {
      const problem = folderProblem(extraFolder);
      if (problem) return badRequest(problem);
    }
    const db = getDatabasePath();
    writeConfig(db, { ...readConfig(db), extraFolder, keep });
    return NextResponse.json(view());
  } catch (e) {
    return serverError(e, 'Could not save the backup settings');
  }
}

// POST: back up now.
export async function POST(req: NextRequest) {
  const a = await admin(req);
  if (a.error) return a.error;
  try {
    runBackup(getDatabasePath());
    return NextResponse.json(view());
  } catch (e) {
    return serverError(e, 'Backup failed');
  }
}
