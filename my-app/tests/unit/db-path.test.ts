import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { join, resolve } from 'node:path';
import { getDatabasePath } from '../../lib/db-path';

const original = process.env.DATABASE_URL;

beforeEach(() => {
  vi.unstubAllEnvs();
});

afterEach(() => {
  process.env.DATABASE_URL = original;
});

test('an absolute file: URL is used as given', () => {
  vi.stubEnv('DATABASE_URL', 'file:/var/data/cafeos.db');
  expect(getDatabasePath()).toBe('/var/data/cafeos.db');
});

test('a relative file: URL is resolved against the working directory', () => {
  vi.stubEnv('DATABASE_URL', 'file:./prisma/dev.db');
  expect(getDatabasePath()).toBe(resolve('./prisma/dev.db'));
});

test('falls back to prisma/dev.db when DATABASE_URL is unset or not a file URL', () => {
  const fallback = join(process.cwd(), 'prisma', 'dev.db');

  vi.stubEnv('DATABASE_URL', '');
  expect(getDatabasePath()).toBe(fallback);

  vi.stubEnv('DATABASE_URL', 'postgresql://localhost:5432/cafeos');
  expect(getDatabasePath()).toBe(fallback);
});
