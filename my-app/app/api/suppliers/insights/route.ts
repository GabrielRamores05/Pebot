import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';
import { serverError, unauthorized } from '@/lib/api-response';
import { getSupplierPurchaseInsights } from '@/modules/inventory/service';

// GET /api/suppliers/insights — per-supplier ingredient prices derived from
// purchase rows (spec 014 US3): each ingredient that supplier has PURCHASE
// history for, with that supplier's latest price and the ₱/% change vs that
// supplier's previous price for the same ingredient. Suppliers without
// purchases return an empty items list.
export async function GET(req: NextRequest) {
  const user = await requirePermission(req, 'inventory');
  if (!user) {
    return unauthorized();
  }

  try {
    const insights = await getSupplierPurchaseInsights();
    return NextResponse.json(insights);
  } catch (error) {
    return serverError(error, 'Failed to load supplier price insights');
  }
}
