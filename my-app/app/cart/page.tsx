'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCartStore, lineKey, type CartItemSelection } from '@/store/cartStore';
import { calculateLoyaltyDiscountForItems } from '@/lib/pos-utils';
import { fetchJson, userMessage } from '@/lib/fetch-json';

interface BrandingState {
  shopName: string;
  logoUrl: string | null;
}

interface Table {
  id: number;
  name: string;
  status: string;
}

interface BusinessSettings {
  gcashAccountName?: string | null;
  gcashQrImage?: string | null;
  paymayaAccountName?: string | null;
  paymayaQrImage?: string | null;
}

interface SelectedLoyaltyVoucher {
  customerName: string;
  codes: string[]; // Array of voucher codes for multiple claims
  voucherIds: number[];
}

interface VoucherDetail {
  code: string;
  rewardName: string;
  discountType: string;
  discountValue: number;
  minPurchase: number;
  validDays: string | null;
  targetType: string;
  targetCategoryId: number | null;
  categoryName: string;
  expiryDate: string | null;
  maxRedemptions: number;
  usedCount: number;
  remainingUses: number;
}

// Validate and sanitize customer name
function validateCustomerName(name: string): { valid: boolean; error?: string; cleaned?: string } {
  const trimmed = name?.trim() || '';
  
  if (!trimmed) {
    return { valid: false, error: 'Customer name is required' };
  }
  
  if (trimmed.length > 100) {
    return { valid: false, error: 'Customer name must be 100 characters or less' };
  }
  
  // Allow alphanumeric, spaces, hyphens, apostrophes, periods (common in names)
  if (!/^[a-zA-Z0-9\s\-'\.ñáéíóúàèìòù]+$/i.test(trimmed)) {
    return { valid: false, error: 'Customer name contains invalid characters' };
  }
  
  return { valid: true, cleaned: trimmed };
}

export default function CartPage() {
  const router = useRouter();
  const cartStore = useCartStore();
  const [branding, setBranding] = useState<BrandingState>({ shopName: 'CaféOS', logoUrl: null });
  const [tables, setTables] = useState<Table[]>([]);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState('');
  const [loyaltyVouchers, setLoyaltyVouchers] = useState<SelectedLoyaltyVoucher | null>(null);
  const [isNameFromLoyalty, setIsNameFromLoyalty] = useState(false);
  const [loyaltyCard, setLoyaltyCard] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'GCASH' | 'PAYMAYA'>('CASH');

  // ── Per-line option editing (checkout) ──────────────────────────────────────
  interface OptionGroupDTO {
    id: number;
    group: { id: number; name: string; selectionType: 'single' | 'multi' };
    options: { id: number; name: string; priceDelta: number }[];
  }
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [groupsCache, setGroupsCache] = useState<Record<number, OptionGroupDTO[]>>({});
  const [draftSingle, setDraftSingle] = useState<Record<number, number>>({});
  const [draftMulti, setDraftMulti] = useState<number[]>([]);

  async function openEditor(item: typeof cartStore.items[number]) {
    const key = lineKey(item.productId, item.selections);
    if (editingKey === key) { setEditingKey(null); return; }
    setEditingKey(key);
    setDraftSingle({});
    setDraftMulti([]);

    // Always fetch fresh; cache only serves as a failure fallback, so a failed
    // request must not look like "this item has no options".
    let groups: OptionGroupDTO[] | null = null;
    try {
      groups = await fetchJson<OptionGroupDTO[]>(`/api/products/${item.productId}/option-groups`, { cache: 'no-store' });
    } catch (e) {
      console.error('Could not load options for this item; using the last known list:', e);
      groups = null;
    }
    if (!groups) groups = groupsCache[item.productId] ?? [];
    setGroupsCache((prev) => ({ ...prev, [item.productId]: groups ?? [] }));
    const list = groups ?? [];

    const dS: Record<number, number> = {};
    const dM: number[] = [];
    for (const sel of item.selections ?? []) {
      for (const att of list) {
        if (!(att.options ?? []).some((o) => o.id === sel.optionId)) continue;
        if (att.group.selectionType === 'single') dS[att.group.id] = sel.optionId;
        else dM.push(sel.optionId);
      }
    }
    for (const att of list) {
      if (att.group.selectionType === 'single' && !dS[att.group.id] && att.options?.length) {
        dS[att.group.id] = att.options[0].id;
      }
    }
    setDraftSingle(dS);
    setDraftMulti(dM);
  }

  function confirmEdit(item: typeof cartStore.items[number]) {
    const list = groupsCache[item.productId] ?? [];
    const newSel: CartItemSelection[] = [];
    for (const att of list) {
      if (att.group.selectionType === 'single') {
        const opt = (att.options ?? []).find((o) => o.id === draftSingle[att.group.id]);
        if (opt) newSel.push({ optionId: opt.id, groupName: att.group.name, name: opt.name, priceDelta: opt.priceDelta });
      } else {
        for (const o of (att.options ?? [])) {
          if (draftMulti.includes(o.id)) {
            newSel.push({ optionId: o.id, groupName: att.group.name, name: o.name, priceDelta: o.priceDelta });
          }
        }
      }
    }
    const oldAdder = (item.selections ?? []).reduce((s, x) => s + x.priceDelta, 0);
    const basePrice = item.basePrice ?? Math.max(0, item.price - oldAdder);
    const newAdder = newSel.reduce((s, x) => s + x.priceDelta, 0);

    cartStore.updateLine(lineKey(item.productId, item.selections), {
      productId: item.productId,
      name: item.name,
      price: basePrice + newAdder,
      basePrice,
      categoryId: item.categoryId,
      notes: item.notes,
      selections: newSel.length > 0 ? newSel : undefined,
    });
    setEditingKey(null);
  }

  const [paymentScreenshot, setPaymentScreenshot] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [businessSettings, setBusinessSettings] = useState<BusinessSettings | null>(null);
  const [uploading, setUploading] = useState(false);
  const [voucherDetails, setVoucherDetails] = useState<VoucherDetail[]>([]);
  const [voucherValidationErrors, setVoucherValidationErrors] = useState<string[]>([]);
  const [selectedItemsForDiscount, setSelectedItemsForDiscount] = useState<Record<string, number>>({}); // voucherCode -> productId


  useEffect(() => {
    fetchJson<{ shopName?: string; logoUrl?: string | null }>('/api/settings/branding')
      .then((d) => setBranding({ shopName: d.shopName ?? 'CaféOS', logoUrl: d.logoUrl ?? null }))
      .catch((e) => console.error('Failed to load branding, using defaults:', e));
  }, []);

  useEffect(() => {
    fetchJson<Table[]>('/api/tables')
      .then((data) => {
        if (Array.isArray(data)) {
          setTables(data);
        } else {
          console.error('Unexpected /api/tables response in cart page:', data);
          setTables([]);
        }
      })
      .catch((e) => console.error('Failed to load tables:', e));
  }, []);

  // Fetch business settings for payment QR codes
  useEffect(() => {
    fetchJson<BusinessSettings>('/api/settings/business')
      .then((data) => setBusinessSettings(data))
      .catch((e) => console.error('Failed to load business settings:', e));
  }, []);

  // Auto-fill customer name from loyalty registration if available
  useEffect(() => {
    try {
      const storedLoyaltyName = localStorage.getItem('loyaltyCustomerName');
      if (storedLoyaltyName) {
        // If loyalty name exists in storage, mark it as from loyalty
        if (!cartStore.customerName) {
          cartStore.setCustomerName(storedLoyaltyName);
        }
        setIsNameFromLoyalty(true);
      } else {
        setIsNameFromLoyalty(false);
      }
    } catch (e) {
      console.error('Could not read the saved loyalty name from this device:', e);
    }
  }, [cartStore]);

  // Fetch voucher details when vouchers are loaded
  useEffect(() => {
    async function fetchVoucherDetails() {
      if (!loyaltyVouchers || loyaltyVouchers.codes.length === 0) {
        setVoucherDetails([]);
        setVoucherValidationErrors([]);
        return;
      }

      const details: VoucherDetail[] = [];
      const errors: string[] = [];

      for (const code of loyaltyVouchers.codes) {
        try {
          const res = await fetch(`/api/loyalty/vouchers/redeem?code=${encodeURIComponent(code)}`);
          const data = await res.json();
          
          if (data.valid && data.voucher) {
            details.push({
              code: data.voucher.code,
              rewardName: data.voucher.rewardName || 'Reward',
              discountType: data.voucher.discountType || 'FREE',
              discountValue: data.voucher.discountValue || 0,
              minPurchase: data.voucher.minPurchase || 0,
              validDays: data.voucher.validDays,
              targetType: data.voucher.targetType || 'ALL',
              targetCategoryId: data.voucher.targetCategoryId,
              categoryName: data.voucher.categoryName || 'All Items',
              expiryDate: data.voucher.expiryDate,
              maxRedemptions: data.voucher.maxRedemptions || 1,
              usedCount: data.voucher.usedCount || 0,
              remainingUses: data.voucher.remainingUses || 1,
            });
            
            // Auto-select first eligible item if not already selected
            } else {
            errors.push(`${code}: ${data.validationErrors?.join(', ') || 'Invalid'}`);
          }
        } catch (e) {
          console.error(`Failed to validate voucher ${code}:`, e);
          errors.push(`${code}: Failed to validate`);
        }
      }

      setVoucherDetails(details);
      setVoucherValidationErrors(errors);
    }

    fetchVoucherDetails();
  }, [loyaltyVouchers]);

  function calculateLoyaltyDiscount(): number {
    if (!voucherDetails || voucherDetails.length === 0) return 0;

    return calculateLoyaltyDiscountForItems(
      cartStore.items.map((item) => ({
        productId: item.productId,
        price: item.price,
        quantity: item.quantity,
        categoryId: item.categoryId,
      })),
      voucherDetails.map((voucher) => ({
        code: voucher.code,
        discountType: voucher.discountType,
        discountValue: voucher.discountValue,
        targetCategoryId: voucher.targetCategoryId,
      })),
      selectedItemsForDiscount
    );
  }


  // Get discount display text
  function getDiscountText(): string {
    if (!voucherDetails || voucherDetails.length === 0) return '';
    
    const types = voucherDetails.map(v => v.discountType);
    
    if (types.every(t => t === 'FREE')) {
      return `${voucherDetails.length} Free Item${voucherDetails.length > 1 ? 's' : ''}`;
    } else if (types.every(t => t === 'PERCENTAGE')) {
      const pct = voucherDetails[0].discountValue;
      return `${pct}% Off`;
    } else if (types.every(t => t === 'FIXED_AMOUNT')) {
      const amt = voucherDetails[0].discountValue;
      return `₱${amt} Off`;
    } else {
      return 'Discount Applied';
    }
  }

  // Fetch loyalty card and settings to calculate free coffees
  useEffect(() => {
    if (!isNameFromLoyalty || !cartStore.customerName) {
      setLoyaltyCard(null);
      return;
    }

    // Fetch loyalty data
    Promise.all([
      fetch(`/api/loyalty/cards/${encodeURIComponent(cartStore.customerName)}`).then(r => r.json()),
      fetch('/api/loyalty/settings').then(r => r.json()),
    ])
      .then(([card]) => {
        setLoyaltyCard(card);

        if (card.activeVouchers && card.activeVouchers.length > 0) {
          const codes = card.activeVouchers.map((v: any) => v.code);
          const voucherIds = card.activeVouchers.map((v: any) => v.id);

          const autoVoucherData = {
            customerName: card.customerName,
            codes,
            voucherIds,
          };

          localStorage.setItem('selectedLoyaltyVouchers', JSON.stringify(autoVoucherData));
          setLoyaltyVouchers(autoVoucherData);
        }
      })
      .catch((err) => {
        console.error('Error fetching loyalty data:', err);
      });
  }, [isNameFromLoyalty, cartStore.customerName]);

  // Load selected loyalty vouchers from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('selectedLoyaltyVouchers');
      if (stored) {
        setLoyaltyVouchers(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Could not read the selected rewards from this device:', e);
    }
  }, []);

  useEffect(() => {
    const handleStorageChange = () => {
      try {
        const stored = localStorage.getItem('selectedLoyaltyVouchers');
        if (stored) {
          setLoyaltyVouchers(JSON.parse(stored));
        } else {
          setLoyaltyVouchers(null);
        }
      } catch (e) {
        console.error('Could not read the selected rewards from this device:', e);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  function removeLoyaltyVouchers() {
    setLoyaltyVouchers(null);
    localStorage.removeItem('selectedLoyaltyVouchers');
  }

  function removeAndRestoreRewards() {
    removeLoyaltyVouchers();
  }

  /**
   * Whether the cart can be ordered: it has items and a usable customer name.
   * Shows the problem and moves the customer to the name field when it cannot.
   */
  function readyToOrder(): boolean {
    if (cartStore.items.length === 0) return false;

    const nameValidation = validateCustomerName(cartStore.customerName);
    if (!nameValidation.valid) {
      setError(nameValidation.error || 'Invalid customer name');
      const nameInput = document.getElementById('customer-name-input');
      nameInput?.focus();
      nameInput?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return false;
    }

    if (!cartStore.customerName.trim()) {
      setError('Unable to process order. Please refresh and try again.');
      return false;
    }

    return true;
  }

  function openConfirmDialog() {
    if (!readyToOrder()) return;

    setShowConfirmDialog(true);
  }

  async function placeOrder() {
    if (!readyToOrder()) return;

    setPlacing(true);
    setError('');

    const selectedTable = tables.find((t) => t.name === cartStore.tableNumber);
    const tableSessionId = Number(localStorage.getItem('cafe_table_session_id') || 0) || null;

    try {
      // Re-fetch fresh loyalty data before placing order (prevent stale data bugs)
      if (isNameFromLoyalty && cartStore.customerName) {
        try {
          const freshCard = await fetch(`/api/loyalty/cards/${encodeURIComponent(cartStore.customerName)}`).then(r => r.json());
          if (freshCard) setLoyaltyCard(freshCard);
        } catch (e) {
          console.error('Warning: Could not refresh loyalty data:', e);
          // Continue anyway - use cached data
        }
      }
      
      // Validate voucher rules before checkout
      if (voucherDetails && voucherDetails.length > 0) {
        const orderTotal = cartStore.total();
        const today = new Date().toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
        
        for (const voucher of voucherDetails) {
          // Check minimum purchase
          if (voucher.minPurchase > 0 && orderTotal < voucher.minPurchase) {
            setError(`Voucher ${voucher.code} requires minimum purchase of ₱${voucher.minPurchase}`);
            return;
          }
          
          // Check valid days
          if (voucher.validDays) {
            const validDaysList = voucher.validDays.split(',');
            if (!validDaysList.includes(today)) {
              setError(`Voucher ${voucher.code} is not valid today (${today}). Valid days: ${voucher.validDays}`);
              return;
            }
          }
          
          // Check expiry
          if (voucher.expiryDate && new Date(voucher.expiryDate) < new Date()) {
            setError(`Voucher ${voucher.code} has expired`);
            return;
          }
          
          // Check remaining uses
          if (voucher.remainingUses <= 0) {
            setError(`Voucher ${voucher.code} has no remaining uses`);
            return;
          }
        }
      }

      // Only the codes are sent: /api/orders derives the peso discount from
      // the stored vouchers and redeems them with the order.
      const loyaltyVoucherCodes = voucherDetails ? voucherDetails.map(v => v.code) : [];

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: cartStore.customerName,
          tableId: selectedTable?.id,
          sessionId: tableSessionId,
          items: cartStore.items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            ...((i.selections?.length ?? 0) > 0 && { optionIds: i.selections!.map((s) => s.optionId) }),
          })),          paymentMethod,
          paymentScreenshot: paymentScreenshot || undefined,
          ...(loyaltyVoucherCodes.length > 0 && { loyaltyVoucherCodes }),
          // Send selection info
          loyaltySelection: selectedItemsForDiscount,
        }),
      });


      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to place order');
        return;
      }

      // Vouchers were redeemed inside the order transaction, so a placed order
      // and a spent reward can no longer disagree.

      // CRITICAL: Always clear vouchers from state and storage after order
      removeLoyaltyVouchers();

      // Save order to localStorage for "My Orders" on menu page
      try {
        const existing = JSON.parse(localStorage.getItem('cafe_orders') || '[]');
        const vouchersUsedText = loyaltyVouchers && loyaltyVouchers.codes && loyaltyVouchers.codes.length > 0 
          ? ` with ${loyaltyVouchers.codes.length} free coffee${loyaltyVouchers.codes.length > 1 ? 's' : ''}`
          : '';
        existing.unshift({
          orderNumber: data.orderNumber,
          customerName: cartStore.customerName,
          totalAmount: data.totalAmount,
          createdAt: new Date().toISOString(),
          status: data.status || 'PENDING',
          loyaltyPromo: data.loyaltyPromo || false,
          notes: `Loyalty rewards applied${vouchersUsedText}`,
        });
        localStorage.setItem('cafe_orders', JSON.stringify(existing.slice(0, 20)));
      } catch (e) {
        // The order is placed; only the local "My Orders" shortcut is missing.
        console.error('Could not save the order to this device\u2019s order list:', e);
      }

      cartStore.clearCart();
      router.push(`/order/${data.orderNumber}`);
    } catch (e) {
      console.error('Failed to place order:', e);
      setError(userMessage(e, 'Network error. Please try again.'));
    } finally {
      setPlacing(false);
    }
  }

  // Calculate totals for confirmation dialog and summary
  const subtotal = cartStore.total();
  const loyaltyDiscount = calculateLoyaltyDiscount();
  const totalAfterDiscount = Math.max(subtotal - loyaltyDiscount, 0);

  // Confirmation Dialog
  const confirmContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 pointer-events-auto">
      <div className={`bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 transition-all duration-300 scale-100 opacity-100`}>
        <h3 className="text-xl font-bold text-gray-900 mb-4">Confirm Order</h3>
        <div className="space-y-3 mb-4 max-h-60 overflow-y-auto border border-gray-100 rounded-xl p-3">
          {cartStore.items.map((item) => (
            <div key={item.productId} className="flex justify-between text-sm">
              <span>{item.name} x{item.quantity}</span>
              <span>₱{(item.price * item.quantity).toFixed(2)}</span>
            </div>
          ))}
          <div className="border-t border-gray-200 pt-2 font-bold flex justify-between">
            <span>Total</span>
            <span>₱{totalAfterDiscount.toFixed(2)}</span>
          </div>
        </div>

        <div className="space-y-2 text-sm text-gray-600 mb-4">
          <p><span className="font-medium">Name:</span> {cartStore.customerName}</p>
          <p><span className="font-medium">Payment:</span> {paymentMethod === 'CASH' ? 'Cash' : paymentMethod === 'GCASH' ? 'GCash' : 'PayMaya'}</p>
          {cartStore.tableNumber && <p><span className="font-medium">Table:</span> {cartStore.tableNumber}</p>}
          {isNameFromLoyalty && <p className="text-green-600 font-medium">✓ Loyalty member registered</p>}
        </div>

        {/* Warning: order cannot be canceled once placed */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
          <p className="text-amber-800 text-sm font-medium flex items-start gap-2">
            <span className="text-lg">⚠️</span>
            <span>
              Once your order is placed, it can no longer be canceled.
              Orders can only be canceled while still <span className="font-bold">pending</span>.
            </span>
          </p>
        </div>

        {paymentMethod === 'CASH' && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4">
            <p className="text-blue-800 text-sm font-medium flex items-start gap-2">
              <span className="text-lg">💵</span>
              <span>Please pay at the counter.</span>
            </p>
          </div>
        )}

        {(paymentMethod === 'GCASH' || paymentMethod === 'PAYMAYA') && businessSettings && (
          <div className="mb-4 p-3 bg-gray-50 rounded-xl border border-gray-200">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">
              {paymentMethod === 'GCASH' ? 'GCash' : 'PayMaya'} Payment Details
            </p>
            {paymentMethod === 'GCASH' && businessSettings.gcashAccountName && (
              <p className="text-sm text-gray-700 mb-1">Account: <span className="font-medium">{businessSettings.gcashAccountName}</span></p>
            )}
            {paymentMethod === 'PAYMAYA' && businessSettings.paymayaAccountName && (
              <p className="text-sm text-gray-700 mb-1">Account: <span className="font-medium">{businessSettings.paymayaAccountName}</span></p>
            )}
            {((paymentMethod === 'GCASH' && businessSettings.gcashQrImage) ||
              (paymentMethod === 'PAYMAYA' && businessSettings.paymayaQrImage)) && (
              <div className="mt-2 flex justify-center">
                <img
                  src={(paymentMethod === 'GCASH' ? businessSettings.gcashQrImage : businessSettings.paymayaQrImage) ?? undefined}
                  alt={paymentMethod === 'GCASH' ? 'GCash QR' : 'PayMaya QR'}
                  className="max-w-32 max-h-32 rounded border border-gray-200 object-contain"
                />
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => setShowConfirmDialog(false)}
            className="flex-1 bg-gray-100 text-gray-700 font-semibold py-3 rounded-xl hover:bg-gray-200 transition"
          >
            Back
          </button>
          <button
            onClick={() => { setShowConfirmDialog(false); setTimeout(placeOrder, 50); }}
            className="flex-1 bg-amber-500 text-slate-900 font-semibold py-3 rounded-xl hover:bg-amber-600 transition"
          >
            Confirm & Place
          </button>
        </div>
      </div>
    </div>
  );

  if (cartStore.items.length === 0) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6">
          <span className="text-5xl">🛒</span>
        </div>
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">Your cart is empty</h2>
        <p className="text-gray-500 mb-8">Go back to the menu and add some items</p>
        <Link href="/menu" className="bg-amber-500 text-slate-900 px-8 py-3.5 rounded-full font-semibold hover:bg-gray-800 transition-all shadow-lg">
          Browse Menu
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/menu" className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-700 transition hover:bg-slate-200">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            {branding.logoUrl && (
              <img src={branding.logoUrl} alt="Shop Logo" className="h-8 w-8 rounded-xl object-cover" />
            )}
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Checkout</p>
              <h1 className="text-lg font-semibold text-slate-900">{branding.shopName}</h1>
            </div>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600">
            {cartStore.itemCount()} items
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-10 pt-4 sm:px-6 lg:px-8">
        <div className="lg:grid lg:grid-cols-[1.45fr_0.9fr] lg:gap-6">
          <div className="space-y-4">
            <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              {cartStore.items.map((item, idx) => {
                const key = lineKey(item.productId, item.selections);
                const isEditing = editingKey === key;
                return (
                <div key={key} className={`${isEditing ? 'bg-amber-50/50 ' : ''}border-t border-slate-100 first:border-t-0`}>
                  <div className="flex items-center gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-semibold text-slate-900">{item.name}</p>
                      <p className="text-xs font-medium text-slate-500">
                        {(item.selections?.length ?? 0) > 0
                          ? item.selections!.map((s) => s.name).join(' · ')
                          : 'Regular'}
                      </p>
                      <p className="text-sm text-slate-500">₱{item.price.toFixed(2)} each</p>
                      <button
                        onClick={() => openEditor(item)}
                        className="mt-1 text-xs font-medium text-amber-600 hover:text-amber-700 underline"
                      >
                        ⭐ Change size / options
                      </button>
                    </div>
                    <div className="flex items-center gap-2 rounded-full bg-slate-100 p-1">
                      <button
                        onClick={() => cartStore.updateQuantity(key, item.quantity - 1)}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-lg font-semibold text-slate-700 shadow-sm"
                      >
                        −
                      </button>
                      <span className="w-7 text-center text-sm font-semibold text-slate-900">{item.quantity}</span>
                      <button
                        onClick={() => cartStore.updateQuantity(key, item.quantity + 1)}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-lg font-semibold text-white"
                      >
                        +
                      </button>
                    </div>
                    <div className="w-20 text-right">
                      <p className="text-base font-semibold text-slate-900">₱{(item.price * item.quantity).toFixed(2)}</p>
                    </div>
                    <button
                      onClick={() => cartStore.removeItem(key)}
                      className="ml-1 text-xl text-slate-300 transition hover:text-red-500"
                      aria-label={`Remove ${item.name}`}
                    >
                      ✕
                    </button>
                  </div>

                  {isEditing && (() => {
                    const list = groupsCache[item.productId] ?? [];
                    return (
                    <div className="border-t border-slate-100 px-4 py-3 space-y-3">
                      {list.length === 0 ? (
                        <>
                          <p className="text-xs text-gray-400">
                            No customization groups loaded for this product yet.
                          </p>
                          <button
                            onClick={() => setEditingKey(null)}
                            className="w-full py-2 rounded-xl bg-slate-100 text-slate-600 text-sm font-medium"
                          >
                            Close
                          </button>
                        </>
                      ) : (
                      <>
                        {(groupsCache[item.productId] ?? []).map((att) => (
                          <div key={att.id}>
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">
                              {att.group.name}
                              {att.group.selectionType === 'single' && <span className="font-normal normal-case text-gray-400"> · pick one</span>}
                            </p>
                            {att.group.selectionType === 'single' ? (
                              <div className="flex flex-wrap gap-1.5">
                                {(att.options ?? []).map((opt) => {
                                  const active = draftSingle[att.group.id] === opt.id;
                                  return (
                                    <button
                                      key={opt.id}
                                      onClick={() => setDraftSingle((prev) => ({ ...prev, [att.group.id]: opt.id }))}
                                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                                        active ? 'bg-black text-white border-black' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                                      }`}
                                    >
                                      {opt.name}{opt.priceDelta > 0 && <span className="ml-1 opacity-70">+₱{opt.priceDelta}</span>}
                                    </button>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="space-y-1.5">
                                {(att.options ?? []).map((opt) => {
                                  const checked = draftMulti.includes(opt.id);
                                  return (
                                    <button
                                      key={opt.id}
                                      onClick={() =>
                                        setDraftMulti((prev) => (checked ? prev.filter((id) => id !== opt.id) : [...prev, opt.id]))
                                      }
                                      className={`flex w-full items-center justify-between px-3 py-2 rounded-xl border text-sm transition-colors ${
                                        checked ? 'border-black bg-white font-medium' : 'border-gray-200 bg-white hover:border-gray-300'
                                      }`}
                                    >
                                      <span>{opt.name}</span>
                                      {opt.priceDelta > 0 && <span className="text-gray-500">+₱{opt.priceDelta}</span>}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        ))}
                      </>
                      )}
                      <button
                        onClick={() => confirmEdit(item)}
                        disabled={false}
                        className="w-full py-2.5 rounded-xl bg-stone-900 hover:bg-stone-700 text-white text-sm font-semibold transition-colors disabled:opacity-50"
                      >
                        Update this item
                      </button>
                    </div>
                    );
                  })()}
                </div>
                );
              })}
            </section>

            {voucherDetails.length > 0 && (
              <section className="rounded-3xl bg-linear-to-r from-green-500 to-emerald-500 p-5 text-white shadow-lg">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">🎁</span>
                  <div className="flex-1">
                    <p className="text-lg font-bold">{getDiscountText()}</p>
                    <div className="mt-3 space-y-3">
                      {voucherDetails.map((voucher) => (
                        <div key={voucher.code} className="rounded-2xl border border-white/20 bg-white/10 p-3">
                          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-white/75">
                            {voucher.categoryName} reward
                          </p>
                          <p className="mb-3 text-sm text-white/90">Which item should be discounted?</p>
                          <div className="flex flex-wrap gap-2">
                            {cartStore.items
                              .filter((item) => !voucher.targetCategoryId || item.categoryId === voucher.targetCategoryId)
                              .map((item) => (
                                <button
                                  key={item.productId}
                                  type="button"
                                  onClick={() =>
                                    setSelectedItemsForDiscount((current) => ({
                                      ...current,
                                      [voucher.code]: item.productId,
                                    }))
                                  }
                                  className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                                    selectedItemsForDiscount[voucher.code] === item.productId
                                      ? 'border-white bg-white text-green-600 shadow-md'
                                      : 'border-white/30 bg-transparent text-white hover:bg-white/10'
                                  }`}
                                >
                                  {item.name}
                                </button>
                              ))}
                          </div>
                          {cartStore.items.filter((item) => !voucher.targetCategoryId || item.categoryId === voucher.targetCategoryId).length === 0 && (
                            <p className="mt-2 text-[10px] text-white/70 italic">No eligible {voucher.categoryName} items in cart.</p>
                          )}
                        </div>
                      ))}
                    </div>
                    {voucherValidationErrors.length > 0 && (
                      <p className="mt-3 text-xs font-medium text-red-100">⚠️ {voucherValidationErrors.join(', ')}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={removeAndRestoreRewards}
                    className="text-xl text-white/80 transition hover:text-white"
                  >
                    ✕
                  </button>
                </div>
              </section>
            )}

            <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">Order details</h2>

              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-600">
                    Your Name <span className="text-red-500">*</span>
                    {isNameFromLoyalty && <span className="ml-2 text-xs text-emerald-600">(Loyalty)</span>}
                  </label>
                  {isNameFromLoyalty ? (
                    <div className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base font-medium text-slate-900">
                      {cartStore.customerName}
                    </div>
                  ) : (
                    <input
                      id="customer-name-input"
                      type="text"
                      value={cartStore.customerName}
                      onChange={(e) => {
                        cartStore.setCustomerName(e.target.value);
                        if (e.target.value.trim()) setError('');
                      }}
                      placeholder="Enter your name"
                      className={`w-full rounded-2xl border px-4 py-3 text-base text-slate-900 focus:outline-none ${
                        error && !cartStore.customerName.trim()
                          ? 'border-red-400 bg-red-50 ring-2 ring-red-200'
                          : 'border-slate-200 focus:ring-2 focus:ring-slate-300'
                      }`}
                    />
                  )}
                  {error && !cartStore.customerName.trim() && (
                    <p className="mt-2 text-sm font-medium text-red-600">⚠️ {error}</p>
                  )}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-600">Table Number</label>
                  {cartStore.tableNumber && <p className="mb-1 text-xs text-blue-600">📱 Table set from QR scan</p>}
                  <select
                    value={cartStore.tableNumber}
                    onChange={(e) => cartStore.setTableNumber(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300"
                  >
                    <option value="">Select a table (optional)</option>
                    {tables
                      .filter((table) => table.status === 'AVAILABLE' || table.name === cartStore.tableNumber)
                      .map((table) => (
                        <option key={table.id} value={table.name}>
                          {table.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-lg font-semibold text-slate-900">Payment method</h2>
              <div className="mb-3 grid grid-cols-3 gap-2">
                {[
                  { value: 'CASH' as const, label: 'Cash', icon: '💵' },
                  { value: 'GCASH' as const, label: 'GCash', icon: '📱' },
                  { value: 'PAYMAYA' as const, label: 'PayMaya', icon: '📱' },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setPaymentMethod(option.value);
                      if (option.value === 'CASH') {
                        setPaymentScreenshot(null);
                      }
                    }}
                    className={`rounded-2xl border-2 py-3 text-sm font-medium transition ${
                      paymentMethod === option.value
                        ? 'border-slate-900 bg-slate-900 text-white shadow-lg'
                        : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <span className="mb-0.5 block text-lg">{option.icon}</span>
                    {option.label}
                  </button>
                ))}
              </div>

              {(paymentMethod === 'GCASH' || paymentMethod === 'PAYMAYA') && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <p className="mb-2 text-sm font-medium text-slate-700">
                    📸 Upload payment screenshot {paymentMethod === 'GCASH' ? '(GCash)' : '(PayMaya)'}
                  </p>
                  <p className="mb-3 text-xs text-slate-500">Attach proof of payment or continue and upload it later.</p>

                  {paymentScreenshot ? (
                    <div className="relative">
                      <img src={paymentScreenshot} alt="Payment screenshot" className="max-h-48 w-full rounded-lg border border-slate-200 object-contain" />
                      <button
                        type="button"
                        onClick={() => setPaymentScreenshot(null)}
                        className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs text-white"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-amber-300 bg-amber-50 py-4 text-sm font-medium text-amber-700 transition hover:bg-amber-100">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (event) => {
                          const file = event.target.files?.[0];
                          if (!file) return;
                          setUploading(true);
                          try {
                            const formData = new FormData();
                            formData.append('file', file);
                            const data = await fetchJson<{ url: string }>('/api/upload', { method: 'POST', body: formData });
                            setPaymentScreenshot(data.url);
                            setError('');
                          } catch (e) {
                            console.error('Payment screenshot upload failed:', e);
                            setError(userMessage(e, 'Your payment screenshot did not upload. Try again, or show it to staff.'));
                          } finally {
                            setUploading(false);
                          }
                        }}
                      />
                      {uploading ? 'Uploading...' : '📤 Tap to upload screenshot'}
                    </label>
                  )}
                </div>
              )}
            </section>
          </div>

          <aside className="mt-4 lg:mt-0">
            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-24">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Summary</p>

              <div className="mt-4 space-y-3 text-sm text-slate-600">
                <div className="flex items-center justify-between">
                  <span>Subtotal</span>
                  <span>₱{subtotal.toFixed(2)}</span>
                </div>
                {voucherDetails.length > 0 && (
                  <div className="flex items-center justify-between text-green-600">
                    <span>{getDiscountText()}</span>
                    <span>-₱{loyaltyDiscount.toFixed(2)}</span>
                  </div>
                )}
                <div className="border-t border-slate-200 pt-3 text-base font-semibold text-slate-900">
                  <div className="flex items-center justify-between">
                    <span>Total</span>
                    <span>₱{totalAfterDiscount.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={openConfirmDialog}
                disabled={placing || voucherValidationErrors.length > 0}
                className="mt-5 w-full rounded-2xl bg-slate-900 px-4 py-4 text-base font-semibold text-white shadow-lg shadow-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {placing
                  ? 'Placing order...'
                  : voucherDetails.length > 0
                    ? `Apply ${getDiscountText()} · ₱${totalAfterDiscount.toFixed(2)}`
                    : `Place order · ₱${subtotal.toFixed(2)}`}
              </button>
            </div>
          </aside>
        </div>
      </main>

      {showConfirmDialog && confirmContent}
      {error && cartStore.customerName.trim() && (
        <div className="mx-auto max-w-6xl px-4 pb-6 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        </div>
      )}
    </div>
  );
}
