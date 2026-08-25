import { useRouter } from 'next/navigation';
import { useCartStore } from '@/store/cartStore';
import type { CartState } from '@/store/cartStore';

interface SelectedLoyaltyVoucher {
  customerName: string;
  codes: string[];
  voucherIds: number[];
}

/**
 * Handles loyalty voucher operations
 */
export class LoyaltyVoucherHandler {
  private cartStore: CartState;
  private router: ReturnType<typeof useRouter>;

  constructor(cartStore: CartState, router: ReturnType<typeof useRouter>) {
    this.cartStore = cartStore;
    this.router = router;
  }

  /**
   * Remove loyalty vouchers from state and storage
   */
  removeLoyaltyVouchers(): void {
    // This would typically be done via state setter in a hook
    // For now, we'll just clear localStorage
    localStorage.removeItem('selectedLoyaltyVouchers');
  }

  /**
   * When removing claimed rewards, restore them to available count
   */
  removeAndRestoreRewards(): void {
    this.removeLoyaltyVouchers();
    // Note: In a real implementation, we'd also update available free coffees
    // This would need access to loyalty card state
  }

  /**
   * Save order to localStorage for "My Orders" on menu page
   * @param orderNumber - The order number
   * @param customerName - Customer name
   * @param totalAmount - Total amount
   * @param loyaltyVouchers - Loyalty vouchers used
   * @param loyaltyPromo - Whether loyalty promo was applied
   */
  saveOrderToLocalStorage(
    orderNumber: string,
    customerName: string,
    totalAmount: number,
    loyaltyVouchers: SelectedLoyaltyVoucher | null,
    loyaltyPromo: boolean = false
  ): void {
    try {
      const existing = JSON.parse(localStorage.getItem('cafe_orders') || '[]');
      const vouchersUsedText = loyaltyVouchers && loyaltyVouchers.codes && loyaltyVouchers.codes.length > 0 
        ? ` with ${loyaltyVouchers.codes.length} free coffee${loyaltyVouchers.codes.length > 1 ? 's' : ''}`
        : '';
      existing.unshift({
        orderNumber,
        customerName,
        totalAmount,
        createdAt: new Date().toISOString(),
        status: 'PENDING',
        loyaltyPromo,
        notes: `Loyalty rewards applied${vouchersUsedText}`,
      });
      localStorage.setItem('cafe_orders', JSON.stringify(existing.slice(0, 20)));
    } catch (error) {
      console.error('Failed to save order to localStorage:', error);
    }
  }

  /**
   * Clear cart and navigate to order page
   * @param orderNumber - The order number to navigate to
   */
  clearCartAndNavigate(orderNumber: string): void {
    this.cartStore.clearCart();
    this.router.push(`/order/${orderNumber}`);
  }
}

/**
 * Creates a loyalty voucher handler instance
 * @param cartStore - Cart store instance
 * @param router - Router instance
 * @returns Loyalty voucher handler
 */
export function createLoyaltyVoucherHandler(
  cartStore: CartState,
  router: ReturnType<typeof useRouter>
): LoyaltyVoucherHandler {
  return new LoyaltyVoucherHandler(cartStore, router);
}