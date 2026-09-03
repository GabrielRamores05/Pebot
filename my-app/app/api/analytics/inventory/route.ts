import { NextRequest, NextResponse } from 'next/server';
import { serverError } from '@/lib/api-response';
import { guardFeature } from '@/lib/api-guards';
import { getInventorySummary } from '@/modules/inventory/service';

// GET /api/analytics/inventory — inventory health summary (spec 014 US5):
// healthy / low / out counts plus total stock value (Σ currentStock ×
// costPerUnit). Uses the same shared low/out rule as the ingredient page and
// alerts, so raising a threshold flips this summary instantly everywhere.
export async function GET(req: NextRequest) {
  const { error } = await guardFeature(req, 'analytics');
  if (error) return error;

  try {
    const summary = await getInventorySummary();
    return NextResponse.json(summary);
  } catch (e) {
    return serverError(e, 'Failed to load inventory summary');
  }
}
