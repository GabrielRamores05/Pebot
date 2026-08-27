import { describe, expect, test } from 'vitest';
import { findOrCreateCardData, normalizeMemberName } from '../../lib/loyalty-utils';

describe('loyalty member data', () => {
  test('normalizes surrounding, repeated, and mixed-case whitespace', () => {
    expect(normalizeMemberName('  Ana   de la Cruz  ')).toBe('ANA DE LA CRUZ');
  });

  test('builds normalized card data without changing the category', () => {
    expect(findOrCreateCardData('  Gabriel  Ramos ', 12)).toEqual({
      customerName: 'GABRIEL RAMOS',
      categoryId: 12,
    });
    expect(findOrCreateCardData('Walk In', null).categoryId).toBeNull();
  });
});
