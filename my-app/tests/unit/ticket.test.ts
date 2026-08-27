import { describe, expect, test } from 'vitest';
import {
  CODES_PER_LETTER,
  fullOrderNumber,
  nextSequenceForDay,
  sequenceValue,
  ticketCode,
  ticketDatePart,
} from '../../lib/ticket';

describe('ticket formatting', () => {
  test('formats the shop date and full order number', () => {
    expect(ticketDatePart(new Date(2026, 7, 5))).toBe('080526');
    expect(fullOrderNumber('080526', 'B', 7)).toBe('ORD-080526-B007');
  });

  test('extracts short codes and supports legacy values', () => {
    expect(ticketCode('ORD-080526-B007')).toBe('B007');
    expect(ticketCode('LEGACY42')).toBe('LEGACY42');
  });
});

describe('daily ticket sequencing', () => {
  test('starts at A001 when no valid ticket exists', () => {
    expect(nextSequenceForDay([])).toEqual({ letter: 'A', num: 1 });
    expect(nextSequenceForDay(['old-format', 'ORD-080526-A12'])).toEqual({
      letter: 'A',
      num: 1,
    });
  });

  test('increments after the highest valid ticket regardless of input order', () => {
    expect(
      nextSequenceForDay([
        'ORD-080526-A100',
        'ORD-080526-B003',
        'ORD-080526-A999',
        'invalid',
      ]),
    ).toEqual({ letter: 'B', num: 4 });
  });

  test('rolls from one letter to the next and wraps after Z999', () => {
    expect(nextSequenceForDay(['ORD-080526-A999'])).toEqual({ letter: 'B', num: 1 });
    expect(nextSequenceForDay(['ORD-080526-Z999'])).toEqual({ letter: 'A', num: 1 });
  });

  test('maps a code to its overall position', () => {
    expect(sequenceValue({ letter: 'A', num: 1 })).toBe(1);
    expect(sequenceValue({ letter: 'B', num: 1 })).toBe(CODES_PER_LETTER + 1);
  });
});
