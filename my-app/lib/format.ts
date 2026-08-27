/** Format a number as Philippine Peso: ₱1,500.00 */
export function formatPeso(amount: number | null | undefined): string {
  const val = Number.isFinite(amount) ? (amount as number) : 0;
  return `₱${val.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
