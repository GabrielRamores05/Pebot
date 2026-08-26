// Order ticket numbering: ORD-MMDDYY-LNNN (e.g. ORD-082526-A001)
//
// The sequence restarts at A001 when the shop's calendar day rolls over,
// climbs A001→A999, then B001→B999 … and wraps Z999→A001. The format is
// fixed-width on purpose: full codes sort chronologically as plain strings,
// which is what lets the kitchen line up tickets without a separate number.

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const CODES_PER_LETTER = 999;

export function ticketDatePart(now: Date): string {
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const yy = String(now.getFullYear()).slice(-2);
  return `${mm}${dd}${yy}`;
}

export function fullOrderNumber(datePart: string, letter: string, num: number): string {
  return `ORD-${datePart}-${letter}${String(num).padStart(3, '0')}`;
}

// The short form staff and customers see: "ORD-082526-A001" -> "A001".
// Orders created before this format existed fall back to their last segment.
export function ticketCode(orderNumber: string): string {
  const idx = orderNumber.lastIndexOf('-');
  return idx === -1 ? orderNumber : orderNumber.slice(idx + 1);
}

function parseCode(code: string): { letterIdx: number; num: number } | null {
  const m = /^([A-Z])(\d{3})$/.exec(code);
  if (!m) return null;
  return { letterIdx: LETTERS.indexOf(m[1]), num: parseInt(m[2], 10) };
}

// Next code after the highest existing code issued today.
export function nextSequenceForDay(existingOrderNumbers: string[]): { letter: string; num: number } {
  let best: { letterIdx: number; num: number } | null = null;
  for (const full of existingOrderNumbers) {
    const parsed = parseCode(ticketCode(full));
    if (!parsed) continue;
    if (
      !best ||
      parsed.letterIdx > best.letterIdx ||
      (parsed.letterIdx === best.letterIdx && parsed.num > best.num)
    ) {
      best = parsed;
    }
  }
  if (!best) return { letter: 'A', num: 1 };
  if (best.num < CODES_PER_LETTER) return { letter: LETTERS[best.letterIdx], num: best.num + 1 };
  return { letter: LETTERS[(best.letterIdx + 1) % LETTERS.length], num: 1 };
}

// Overall position in the day's sequence (A001=1, A002=2 … B001=1000).
export function sequenceValue(seq: { letter: string; num: number }): number {
  return LETTERS.indexOf(seq.letter) * CODES_PER_LETTER + seq.num;
}
