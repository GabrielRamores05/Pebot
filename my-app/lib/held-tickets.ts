/**
 * Held and split tickets on a register (spec 020).
 * Kept on the device that took them (a register's own browser storage):
 * a held ticket is an unsent order, not a sale.
 */

export interface HeldLine {
  key?: string;
  price: number;
  quantity: number;
}

export interface HeldTicket<L extends HeldLine = HeldLine> {
  id: string;
  name: string;
  savedAt: string;
  lines: L[];
  orderType: string;
  tableId: number | null;
  customerName: string;
}

const MAX_HELD = 20;

export function addHeld<L extends HeldLine>(list: HeldTicket<L>[], ticket: HeldTicket<L>): HeldTicket<L>[] {
  return [ticket, ...list.filter((t) => t.id !== ticket.id)].slice(0, MAX_HELD);
}

export function removeHeld<L extends HeldLine>(list: HeldTicket<L>[], id: string): HeldTicket<L>[] {
  return list.filter((t) => t.id !== id);
}

export function heldLabel(t: HeldTicket): string {
  const items = t.lines.reduce((n, l) => n + l.quantity, 0);
  const total = t.lines.reduce((n, l) => n + l.price * l.quantity, 0);
  return `${t.name} · ${items} item${items === 1 ? '' : 's'} · ₱${total.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Split a ticket: `take` says how many of each line (by key) go to the new ticket.
 * Quantities are clamped to what the line has.
 */
export function splitLines<L extends HeldLine & { key: string }>(lines: L[], take: Record<string, number>) {
  const kept: L[] = [];
  const moved: L[] = [];
  for (const line of lines) {
    const n = Math.max(0, Math.min(line.quantity, Math.floor(take[line.key] ?? 0)));
    if (n > 0) moved.push({ ...line, quantity: n });
    if (line.quantity - n > 0) kept.push(n > 0 ? { ...line, quantity: line.quantity - n } : line);
  }
  return { kept, moved };
}
