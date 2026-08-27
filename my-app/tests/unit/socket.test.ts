import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { emitEvent } from '../../lib/socket';

type GlobalWithIo = typeof globalThis & { io?: unknown };

const g = globalThis as GlobalWithIo;

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  delete g.io;
  vi.restoreAllMocks();
});

function fakeIo() {
  const emit = vi.fn();
  const roomEmit = vi.fn();
  return { emit, roomEmit, to: vi.fn(() => ({ emit: roomEmit })) };
}

test('broadcasts to every client when no room is given', () => {
  const io = fakeIo();
  g.io = { emit: io.emit, to: io.to };

  emitEvent('order:new', { id: 1 });

  expect(io.emit).toHaveBeenCalledWith('order:new', { id: 1 });
  expect(io.to).not.toHaveBeenCalled();
});

test('broadcasts only to the room when one is given', () => {
  const io = fakeIo();
  g.io = { emit: io.emit, to: io.to };

  emitEvent('order:update', { id: 1 }, 'kitchen');

  expect(io.to).toHaveBeenCalledWith('kitchen');
  expect(io.roomEmit).toHaveBeenCalledWith('order:update', { id: 1 });
  expect(io.emit).not.toHaveBeenCalled();
});

test('logs and returns when the socket server is not running', () => {
  expect(() => emitEvent('order:new', { id: 1 })).not.toThrow();
  expect(console.error).toHaveBeenCalledWith(
    expect.stringContaining('global.io not found'),
  );
});

test('a throwing socket server never breaks the caller', () => {
  g.io = {
    emit: () => {
      throw new Error('socket closed');
    },
  };

  expect(() => emitEvent('order:new', { id: 1 })).not.toThrow();
  expect(console.error).toHaveBeenCalledWith('[Socket emit error]', expect.any(Error));
});
