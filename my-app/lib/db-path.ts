import { join, isAbsolute, resolve } from 'path';

export function getDatabasePath(): string {
  const dbUrl = process.env.DATABASE_URL || '';
  if (dbUrl.startsWith('file:')) {
    const dbPath = dbUrl.slice(5);
    if (isAbsolute(dbPath)) return dbPath;
    return resolve(dbPath);
  }
  return join(process.cwd(), 'prisma', 'dev.db');
}
