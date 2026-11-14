import { describe, expect, it } from 'vitest';
import { addHeld, heldLabel, removeHeld, splitLines, type HeldTicket } from '@/lib/held-tickets';

type Line = { key: string; name: string; price: number; quantity: number };
const cart: Line[] = [
  { key: 'a', name: 'Chicken Adobo', price: 185, quantity: 2 },
  { key: 'b', name: 'Iced Tea', price: 65, quantity: 2 },
  { key: 'c', name: 'Leche Flan', price: 95, quantity: 1 },
];

describe('splitLines (spec 020)', () => {
  it('moves whole lines to a new ticket', () => {
    const { kept, moved } = splitLines(cart, { b: 2, c: 1 });
    expect(kept).toEqual([cart[0]]);
    expect(moved).toEqual([cart[1], cart[2]]);
  });

  it('moves part of a line', () => {
    const { kept, moved } = splitLines(cart, { a: 1 });
    expect(kept[0]).toEqual({ ...cart[0], quantity: 1 });
    expect(moved).toEqual([{ ...cart[0], quantity: 1 }]);
    expect(kept).toHaveLength(3);
  });

  it('ignores zero, negative and too-large quantities safely', () => {
    const { kept, moved } = splitLines(cart, { a: 0, b: -1, c: 9 });
    expect(moved).toEqual([cart[2]]);
    expect(kept).toEqual([cart[0], cart[1]]);
  });
});

describe('held tickets', () => {
  const t = (id: string, name: string): HeldTicket<Line> => ({ id, name, savedAt: '2026-11-14T08:00:00.000Z', lines: cart, orderType: 'DINE_IN', tableId: null, customerName: name });

  it('adds newest first and removes by id', () => {
    const list = addHeld(addHeld([], t('1', 'Table 3')), t('2', 'Ana'));
    expect(list.map((x) => x.id)).toEqual(['2', '1']);
    expect(removeHeld(list, '2').map((x) => x.id)).toEqual(['1']);
  });

  it('keeps at most 20 held tickets', () => {
    let list: HeldTicket<Line>[] = [];
    for (let i = 0; i < 25; i++) list = addHeld(list, t(String(i), 'x'));
    expect(list).toHaveLength(20);
    expect(list[0].id).toBe('24');
  });

  it('labels a held ticket with its items and total', () => {
    expect(heldLabel(t('1', 'Table 3'))).toBe('Table 3 · 5 items · ₱595.00');
  });
});
