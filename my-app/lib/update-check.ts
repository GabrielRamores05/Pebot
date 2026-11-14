/**
 * Update notice (QA follow-up). When the PC is online, ask the public releases
 * feed for the newest Pebot and tell the owner. It only notifies: the owner
 * downloads and runs the installer, which keeps their data.
 *
 * The feed is the GitHub "latest release" of a public releases repository, so
 * the source code repository can stay private. Nothing about the restaurant
 * is sent.
 */

export const UPDATE_FEED_URL =
  process.env.PEBOT_UPDATE_FEED || 'https://api.github.com/repos/GabrielRamores05/pebot-releases/releases/latest';

export interface UpdateInfo {
  current: string;
  latest: string | null;
  available: boolean;
  /** Release page to download from (https://github.com only). */
  url: string | null;
  notes: string | null;
  publishedAt: string | null;
  checkedAt: string;
  error: string | null;
}

/** 1.2.10 > 1.2.9; ignores a leading "v" and anything after "-". */
export function compareVersions(a: string, b: string): number {
  const parts = (v: string) => v.trim().replace(/^v/i, '').split('-')[0].split('.').map((n) => parseInt(n, 10) || 0);
  const x = parts(a), y = parts(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  return 0;
}

/** Only links to GitHub over https are shown, whatever the feed says. */
export function safeReleaseUrl(url: unknown): string | null {
  if (typeof url !== 'string') return null;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && (u.hostname === 'github.com' || u.hostname.endsWith('.github.com')) ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Read a GitHub release (or a plain {version, url, notes} file). */
export function parseRelease(json: unknown): { version: string; url: string | null; notes: string | null; publishedAt: string | null } | null {
  if (!json || typeof json !== 'object') return null;
  const r = json as Record<string, unknown>;
  const version = typeof r.tag_name === 'string' ? r.tag_name : typeof r.version === 'string' ? r.version : null;
  if (!version || !/^v?\d+(\.\d+){0,3}/i.test(version)) return null;
  if (r.draft === true || r.prerelease === true) return null;
  const notes = typeof r.body === 'string' ? r.body : typeof r.notes === 'string' ? r.notes : null;
  return {
    version: version.replace(/^v/i, ''),
    url: safeReleaseUrl(r.html_url ?? r.url),
    notes: notes ? notes.slice(0, 2000) : null,
    publishedAt: typeof r.published_at === 'string' ? r.published_at : null,
  };
}

export async function checkForUpdate(opts: {
  current: string;
  feedUrl?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<UpdateInfo> {
  const base = { current: opts.current, latest: null, available: false, url: null, notes: null, publishedAt: null, checkedAt: new Date().toISOString() };
  const f = opts.fetchImpl ?? fetch;
  try {
    const res = await f(opts.feedUrl ?? UPDATE_FEED_URL, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Pebot-update-check' },
      signal: AbortSignal.timeout(opts.timeoutMs ?? 8000),
      cache: 'no-store',
    });
    if (res.status === 404) return { ...base, error: 'No releases published yet.' };
    if (!res.ok) return { ...base, error: `The update server answered ${res.status}.` };
    const rel = parseRelease(await res.json());
    if (!rel) return { ...base, error: 'The update information could not be read.' };
    return { ...base, latest: rel.version, available: compareVersions(rel.version, opts.current) > 0, url: rel.url, notes: rel.notes, publishedAt: rel.publishedAt, error: null };
  } catch {
    return { ...base, error: 'Offline. Pebot will check again when the internet is back.' };
  }
}
