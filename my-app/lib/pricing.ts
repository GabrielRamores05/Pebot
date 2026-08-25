// BIR-Compliant Pricing Engine for CaféOS
// Computes selling price from capital cost + margin + VAT

export interface ProductPricing {
  capitalCost: number;
  marginType: 'PERCENTAGE' | 'PESOS';
  marginValue: number;
  vatExempt: boolean;
}

export interface ComputedPrice {
  basePrice: number; // cost + margin
  vatRate: number;
  vatAmount: number;
  sellingPrice: number; // final price before discount
  profit: number; // sellingPrice - capitalCost
  profitMargin: number; // percentage profit
}

export interface BusinessSettingsData {
  businessName: string;
  businessAddress: string;
  tin: string;
  branchCode: string;
  vatRate: number;
  receiptSerialPrefix: string;
  lastReceiptNumber: number;
  footerMessage: string;
}

/**
 * Compute the selling price from capital cost + margin + VAT
 * @param pricing - Product pricing data (cost, margin type/value, VAT exemption)
 * @param vatRate - Current VAT rate (default 12%)
 * @returns Computed price breakdown
 */
export function computePrice(pricing: ProductPricing, vatRate: number = 12): ComputedPrice {
  const { capitalCost, marginType, marginValue, vatExempt } = pricing;
  
  // Calculate base price (cost + margin)
  let basePrice: number;
  if (marginType === 'PERCENTAGE') {
    basePrice = capitalCost * (1 + marginValue / 100);
  } else {
    basePrice = capitalCost + marginValue;
  }
  
  // Calculate VAT
  let vatAmount = 0;
  let sellingPrice = basePrice;
  
  if (!vatExempt) {
    vatAmount = basePrice * (vatRate / 100);
    sellingPrice = basePrice + vatAmount;
  }
  
  // Calculate profit
  const profit = sellingPrice - capitalCost;
  const profitMargin = capitalCost > 0 ? (profit / capitalCost) * 100 : 0;
  
  return {
    basePrice: Math.round(basePrice * 100) / 100,
    vatRate: vatExempt ? 0 : vatRate,
    vatAmount: Math.round(vatAmount * 100) / 100,
    sellingPrice: Math.round(sellingPrice * 100) / 100,
    profit: Math.round(profit * 100) / 100,
    profitMargin: Math.round(profitMargin * 100) / 100,
  };
}

/**
 * Calculate order totals with tax breakdown
 * @param items - Array of items with quantity and unit price
 * @param vatRate - Current VAT rate
 * @returns Order totals with VAT breakdown
 */
export interface OrderItemTotal {
  quantity: number;
  unitPrice: number;
  subtotal: number;
  vatAmount: number;
  vatExemptAmount: number;
}

export interface OrderTotals {
  subtotal: number;
  vatTaxableTotal: number;
  vatExemptTotal: number;
  vatAmount: number;
  total: number;
}

export function computeOrderTotals(
  items: { quantity: number; unitPrice: number; vatExempt?: boolean }[],
  vatRate: number = 12
): OrderTotals {
  let vatTaxableTotal = 0;
  let vatExemptTotal = 0;
  
  for (const item of items) {
    const itemTotal = item.quantity * item.unitPrice;
    if (item.vatExempt) {
      vatExemptTotal += itemTotal;
    } else {
      vatTaxableTotal += itemTotal;
    }
  }
  
  const subtotal = vatTaxableTotal + vatExemptTotal;
  const vatAmount = vatTaxableTotal * (vatRate / 100);
  const total = subtotal;
  
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    vatTaxableTotal: Math.round(vatTaxableTotal * 100) / 100,
    vatExemptTotal: Math.round(vatExemptTotal * 100) / 100,
    vatAmount: Math.round(vatAmount * 100) / 100,
    total: Math.round(total * 100) / 100,
  };
}

/**
 * Generate a BIR-compliant receipt serial number
 * @param prefix - Serial prefix (e.g., "INV")
 * @param number - Sequential number
 * @returns Formatted serial number (e.g., "INV-000001")
 */
export function generateReceiptSerial(prefix: string, number: number): string {
  return `${prefix}-${number.toString().padStart(6, '0')}`;
}

/**
 * Format TIN for display (add dashes)
 * @param tin - Raw TIN number
 * @returns Formatted TIN (XXX-XXX-XXX-XXX)
 */
export function formatTIN(tin: string): string {
  if (!tin || tin.length < 9) return tin;
  // Format as XXX-XXX-XXX-XXX
  return tin.replace(/(\d{3})(\d{3})(\d{3})(\d+)/, '$1-$2-$3-$4');
}
