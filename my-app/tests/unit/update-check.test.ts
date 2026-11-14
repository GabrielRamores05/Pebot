import { describe, expect, it } from 'vitest';
import { checkForUpdate, compareVersions, parseRelease, safeReleaseUrl } from '@/lib/update-check';

const fakeFetch = (status: number, body: unknown) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

describe('update check', () => {
  it('compares versions number by number', () => {
    expect(compareVersions('1.0.10', '1.0.9')).toBe(1);
    expect(compareVersions('v1.1', '1.1.0')).toBe(0);
    expect(compareVersions('1.0.4', '1.1.0')).toBe(-1);
  });
  it('only trusts https GitHub links', () => {
    expect(safeReleaseUrl('https://github.com/x/y/releases/tag/v1.1.0')).toContain('github.com');
    expect(safeReleaseUrl('http://github.com/x')).toBeNull();
    expect(safeReleaseUrl('https://evil.example/download.exe')).toBeNull();
    expect(safeReleaseUrl('javascript:alert(1)')).toBeNull();
  });
  it('ignores drafts and pre-releases', () => {
    expect(parseRelease({ tag_name: 'v2.0.0', prerelease: true })).toBeNull();
    expect(parseRelease({ tag_name: 'v2.0.0', html_url: 'https://github.com/a/b', body: 'New' })).toMatchObject({ version: '2.0.0', notes: 'New' });
  });
  it('reports a newer release', async () => {
    const r = await checkForUpdate({ current: '1.0.4', fetchImpl: fakeFetch(200, { tag_name: 'v1.1.0', html_url: 'https://github.com/a/b/releases/tag/v1.1.0' }) });
    expect(r).toMatchObject({ available: true, latest: '1.1.0', error: null });
  });
  it('says nothing new on the same version, and stays quiet when offline', async () => {
    expect((await checkForUpdate({ current: '1.1.0', fetchImpl: fakeFetch(200, { tag_name: '1.1.0' }) })).available).toBe(false);
    const offline = await checkForUpdate({ current: '1.0.4', fetchImpl: (async () => { throw new Error('ENOTFOUND'); }) as unknown as typeof fetch });
    expect(offline).toMatchObject({ available: false, error: expect.stringContaining('Offline') });
    expect((await checkForUpdate({ current: '1.0.4', fetchImpl: fakeFetch(404, {}) })).error).toMatch(/No releases/);
  });
});
