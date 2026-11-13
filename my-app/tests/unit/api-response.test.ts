import { beforeEach, expect, test, vi } from 'vitest';
import {
  apiError,
  badRequest,
  conflict,
  featureUnavailable,
  forbidden,
  notFound,
  serverError,
  unauthorized,
} from '../../lib/api-response';

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

async function read(res: Response) {
  return { status: res.status, body: await res.json() };
}

test('apiError puts the message in the error envelope with the given status', async () => {
  expect(await read(apiError('Nope', 418))).toEqual({ status: 418, body: { error: 'Nope' } });
});

test('apiError merges extra fields alongside the error', async () => {
  expect(await read(apiError('Out of stock', 409, { productId: 4 }))).toEqual({
    status: 409,
    body: { error: 'Out of stock', productId: 4 },
  });
});

test('each helper answers with its own status', async () => {
  expect(await read(badRequest('Missing table'))).toEqual({
    status: 400,
    body: { error: 'Missing table' },
  });
  expect(await read(unauthorized())).toEqual({ status: 401, body: { error: 'Unauthorized' } });
  expect(await read(unauthorized('Sign in first'))).toEqual({
    status: 401,
    body: { error: 'Sign in first' },
  });
  expect(await read(forbidden())).toEqual({ status: 403, body: { error: 'Forbidden' } });
  expect(await read(forbidden('Admins only'))).toEqual({
    status: 403,
    body: { error: 'Admins only' },
  });
  expect(await read(featureUnavailable())).toEqual({
    status: 403,
    body: { error: "You don't have permission to use this. Ask the owner to turn it on in Staff." },
  });
  expect(await read(notFound())).toEqual({ status: 404, body: { error: 'Not found' } });
  expect(await read(notFound('No such order'))).toEqual({
    status: 404,
    body: { error: 'No such order' },
  });
  expect(await read(conflict('Already paid'))).toEqual({
    status: 409,
    body: { error: 'Already paid' },
  });
});

test('serverError logs the cause and answers 500', async () => {
  const cause = new Error('db locked');

  expect(await read(serverError(cause))).toEqual({ status: 500, body: { error: 'Server error' } });
  expect(console.error).toHaveBeenCalledWith('Server error', cause);
});

test('serverError accepts a message and extra fields', async () => {
  expect(await read(serverError(new Error('x'), 'Could not save the order', { orderId: 2 }))).toEqual({
    status: 500,
    body: { error: 'Could not save the order', orderId: 2 },
  });
});
