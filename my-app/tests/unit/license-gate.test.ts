import { createRequire } from 'node:module';
import { describe, expect, test } from 'vitest';

const require = createRequire(import.meta.url);
const { classifyRequest, isLocalAddress, SETUP_PAGE_HTML } = require('../../lib/license/gate.js') as typeof import('../../lib/license/gate.js');

const unlicensed = (pathname: string, local: boolean, method = 'GET') => classifyRequest({ pathname, local, licensed: false, method });
const licensed = (pathname: string, local: boolean, method = 'GET') => classifyRequest({ pathname, local, licensed: true, method });

describe('isLocalAddress', () => {
  test('only loopback addresses are the main PC', () => {
    for (const a of ['127.0.0.1', '::1', '::ffff:127.0.0.1']) expect(isLocalAddress(a)).toBe(true);
    for (const a of ['192.168.1.20', '::ffff:192.168.1.20', '', undefined, null]) expect(isLocalAddress(a)).toBe(false);
  });
});

describe('unlicensed Pebot fails closed', () => {
  test('business pages send the main PC to activation and other devices to the setup page', () => {
    for (const p of ['/', '/admin', '/admin/terminal', '/kitchen', '/menu', '/order/5', '/login']) {
      expect(unlicensed(p, true)).toEqual({ action: 'redirect', location: '/activate' });
      expect(unlicensed(p, false)).toEqual({ action: 'setup-page' });
    }
  });

  test('every business API is refused, from anywhere', () => {
    for (const p of ['/api/products', '/api/orders', '/api/auth/login', '/api/restore', '/api/backup', '/api']) {
      for (const local of [true, false]) {
        expect(unlicensed(p, local, 'POST')).toEqual({ action: 'json', status: 403, error: 'LICENSE_REQUIRED' });
      }
    }
  });

  test('activation pages and changes are only for the main PC', () => {
    expect(unlicensed('/activate', true)).toEqual({ action: 'allow' });
    expect(unlicensed('/activate', false)).toEqual({ action: 'setup-page' });
    expect(unlicensed('/legal/agreement', true)).toEqual({ action: 'allow' });
    for (const p of ['/api/license/activate', '/api/license/deactivate', '/api/license/agreement']) {
      expect(unlicensed(p, true, 'POST')).toEqual({ action: 'allow' });
      expect(unlicensed(p, false, 'POST')).toEqual({ action: 'json', status: 403, error: 'LOCAL_ONLY' });
    }
  });

  test('status and the agreement text are readable from anywhere', () => {
    expect(unlicensed('/api/license/status', false)).toEqual({ action: 'allow' });
    expect(unlicensed('/api/license/status/', false)).toEqual({ action: 'allow' });
    expect(unlicensed('/api/license/agreement', false, 'GET')).toEqual({ action: 'allow' });
  });

  test('static assets load so the activation screen can render', () => {
    for (const p of ['/_next/static/chunks/main.js', '/fonts/a.woff2', '/icons/icon-192.png', '/favicon.ico', '/manifest.json']) {
      expect(unlicensed(p, false)).toEqual({ action: 'allow' });
    }
  });

  test('path tricks cannot ride the static allow-list', () => {
    for (const p of ['/_next/../admin', '/_next/%2e%2e/api/orders', '/fonts/..%2fadmin', '/_next\\..\\admin', '/%E0%A4%A']) {
      expect(unlicensed(p, true)).toMatchObject({ action: 'json', status: 400 });
    }
  });
});

describe('licensed Pebot', () => {
  test('serves everything, and /activate goes home', () => {
    expect(licensed('/admin', false)).toEqual({ action: 'allow' });
    expect(licensed('/api/orders', false, 'POST')).toEqual({ action: 'allow' });
    expect(licensed('/legal/agreement', false)).toEqual({ action: 'allow' });
    expect(licensed('/activate', true)).toEqual({ action: 'redirect', location: '/' });
  });

  test('license changes still come only from the main PC', () => {
    expect(licensed('/api/license/deactivate', false, 'POST')).toEqual({ action: 'json', status: 403, error: 'LOCAL_ONLY' });
    expect(licensed('/api/license/deactivate', true, 'POST')).toEqual({ action: 'allow' });
  });
});

test('the setup page is bilingual and has no business data', () => {
  expect(SETUP_PAGE_HTML).toContain('being set up');
  expect(SETUP_PAGE_HTML).toContain('Paki-order');
});
