'use client';



// ---------------------------------------------------------------------------
// Spec 014 US3: ₱/% change vs previous purchase text (increase red, decrease
// green, equal neutral — equal price shows ₱0.00 (0%), never "no data").
// ---------------------------------------------------------------------------
export function TrendText({ change, baseUnit }: { change: { delta: number; percent: number } | null; baseUnit?: string }) {
  if (!change) {
    return <span className="text-xs text-gray-400">First purchase</span>;
  }
  if (change.delta === 0) {
    return <span className="text-xs font-medium text-gray-400">₱0.00 (0%)</span>;
  }
  const up = change.delta > 0;
  const sign = up ? '+' : '-';
  return (
    <span className={`text-xs font-semibold ${up ? 'text-rose-600' : 'text-emerald-600'}`}>
      {sign}₱{Math.abs(change.delta).toFixed(2)}{baseUnit ? ` / ${baseUnit}` : ''} ({sign}
      {Math.abs(change.percent).toFixed(2)}%)
    </span>
  );
}
