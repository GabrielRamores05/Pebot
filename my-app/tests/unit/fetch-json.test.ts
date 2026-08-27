import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ApiError, fetchJson, userMessage } from '../../lib/fetch-json';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function response(init: { ok: boolean; status: number; json: () => unknown }) {
  return { ok: init.ok, status: init.status, json: async () => init.json() };
}

describe('fetchJson', () => {
  test('returns the parsed body and passes the request options through', async () => {
    fetchMock.mockResolvedValue(response({ ok: true, status: 200, json: () => ({ id: 7 }) }));

    const init = { method: 'POST', body: '{}' };
    await expect(fetchJson<{ id: number }>('/api/orders', init)).resolves.toEqual({ id: 7 });
    expect(fetchMock).toHaveBeenCalledWith('/api/orders', init);
  });

  test('throws an ApiError carrying the route\'s own error message', async () => {
    fetchMock.mockResolvedValue(
      response({ ok: false, status: 409, json: () => ({ error: 'Order already paid' }) }),
    );

    await expect(fetchJson('/api/orders/1/pay')).rejects.toMatchObject({
      name: 'ApiError',
      message: 'Order already paid',
      status: 409,
    });
  });

  test('falls back to the status when the body has no error string', async () => {
    fetchMock.mockResolvedValue(response({ ok: false, status: 403, json: () => ({ error: 42 }) }));

    await expect(fetchJson('/api/admin')).rejects.toMatchObject({
      message: 'Request failed (403)',
      status: 403,
    });
  });

  test('falls back to the status when the failing body is not JSON', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error('Unexpected token <');
      },
    });

    await expect(fetchJson('/api/report')).rejects.toMatchObject({
      message: 'Request failed (500)',
      status: 500,
    });
    expect(console.error).toHaveBeenCalled();
  });

  test('lets a network failure surface as-is', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(fetchJson('/api/orders')).rejects.toBeInstanceOf(TypeError);
  });
});

describe('userMessage', () => {
  test('uses the API error message', () => {
    expect(userMessage(new ApiError('Table is occupied', 409), 'Something went wrong')).toBe(
      'Table is occupied',
    );
  });

  test('explains a lost connection', () => {
    expect(userMessage(new TypeError('Failed to fetch'), 'Something went wrong')).toBe(
      'No connection to the server — check your network and try again.',
    );
  });

  test('uses the fallback for anything else', () => {
    expect(userMessage(new Error('boom'), 'Could not save the order')).toBe(
      'Could not save the order',
    );
    expect(userMessage('boom', 'Could not save the order')).toBe('Could not save the order');
  });
});
