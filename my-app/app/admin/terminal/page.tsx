'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSocket } from '@/hooks/useSocket';
import { formatPeso } from '@/lib/format';
import { calculateLoyaltyDiscountForItems } from '@/lib/pos-utils';
import { CheckoutError, computeCheckout, serviceChargeRateFor, type CheckoutTotals } from '@/lib/checkout';
import DiscountPicker, { discountProblem, toCheckoutDiscount, toOrderDiscount, type TerminalDiscount } from './DiscountPicker';
import CashDrawerPanel from './CashDrawerPanel';
import { printInvoice, printKitchenTicket } from '@/lib/print-documents';
import type { InvoiceOrder } from '@/lib/invoice';

interface InventoryData { quantity: number; lowStockThreshold: number; }
interface Product { id: number; name: string; description?: string; price: number; imageUrl?: string; available: boolean; inventory?: InventoryData; vatExempt?: boolean; marginType?: string; marginValue?: number; capitalCost?: number; }
interface Category { id: number; name: string; icon?: string; products: Product[]; }
interface CartLoyaltyAssignment { customerName: string; quantity: number; }
interface CartItem { key?: string; productId: number; name: string; price: number; quantity: number; vatExempt?: boolean; loyaltyAssignments?: CartLoyaltyAssignment[]; optionIds?: number[]; selectionsLabel?: string; categoryId?: number; }
interface Table { id: number; name: string; status: string; }
interface LoyaltyCard { id: number; customerName: string; membershipCode?: string | null; memberSince?: string | null; coffeesCompleted: number; rewardsAvailable: number; lastRewardRedeemDate: string | null; }
interface VoucherDetail {
  code: string;
  status: string;
  rewardName: string;
  discountType: string;
  discountValue: number;
  minPurchase: number;
  targetType: string;
  targetCategoryId: number | null;
  categoryName: string;
}

interface OrderReceipt {
  orderNumber: string;
  receiptSerial: string;
  customerName: string;
  totalAmount: number;
  items: { name: string; quantity: number; price: number; vatExempt?: boolean }[];
  tableName?: string;
  deliveryAddress?: string;
  createdAt: string;
  paymentMethod: string;
  orderType: string;
  // Tax breakdown
  subtotal: number;
  vatTaxableTotal: number;
  vatExemptTotal: number;
  vatAmount: number;
  // Cash payment details
  cashReceived?: number;
  change?: number;
  // Discount (spec 017): Senior Citizen / PWD / Student
  discountAmount?: number;
  discountReason?: string;
  discountRate?: number;
  loyaltyDiscount?: number;
  vatRemoved?: number;
  serviceCharge?: number;
}

const DISCOUNT_LABELS: Record<string, string> = {
  SENIOR: 'Senior Citizen discount',
  PWD: 'PWD discount',
  SENIOR_PWD: 'Senior/PWD discount',
  STUDENT: 'Student discount',
  STUDENT_PWD: 'Student/PWD discount',
};

/** Lines between the item list and the total, in bill order (spec 017). */
function receiptAdjustments(r: OrderReceipt): { label: string; amount: number }[] {
  const lines: { label: string; amount: number }[] = [];
  if ((r.loyaltyDiscount ?? 0) > 0) lines.push({ label: 'Loyalty reward', amount: -(r.loyaltyDiscount ?? 0) });
  if ((r.vatRemoved ?? 0) > 0) lines.push({ label: 'Less VAT (Senior/PWD)', amount: -(r.vatRemoved ?? 0) });
  if ((r.discountAmount ?? 0) > 0) {
    const label = DISCOUNT_LABELS[r.discountReason ?? ''] ?? 'Discount';
    lines.push({ label: r.discountRate ? `${label} (${r.discountRate}%)` : label, amount: -(r.discountAmount ?? 0) });
  }
  if ((r.serviceCharge ?? 0) > 0) lines.push({ label: 'Service charge', amount: r.serviceCharge ?? 0 });
  return lines;
}

const signedPeso = (n: number) => `${n < 0 ? '−' : ''}₱${Math.abs(n).toFixed(2)}`;

interface BusinessSettings {
  businessName: string;
  businessAddress: string;
  tin: string;
  branchCode: string;
  vatRate: number;
  footerMessage: string;
  serialNo?: string;
  loyaltyEnabled?: boolean;
  studentPwdDiscountRate?: number;
  vatRegistered?: boolean;
  serviceChargeRate?: number;
  serviceChargeOrderTypes?: string;
  receiptPrinter?: string | null;
  kitchenPrinter?: string | null;
  paperWidth?: string | null;
  autoPrintInvoice?: boolean;
  autoPrintKitchen?: boolean;
}

function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c] || c));
}

function isImageUrl(value?: string) {
  return Boolean(value && (value.startsWith('/') || value.startsWith('http')));
}

function CategoryGlyph({ name, active, className = 'h-5 w-5' }: { name: string; active?: boolean; className?: string }) {
  const stroke = active ? 'var(--pos-accent)' : 'var(--pos-ink-soft)';
  const iconName = name.toLowerCase();

  const baseProps = {
    className,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke,
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  switch (iconName) {
    case 'all':
      return (
        <svg {...baseProps}>
          <circle cx="12" cy="12" r="8" />
          <path d="M8 12h8M12 8v8" />
        </svg>
      );
    case 'coffee':
    case 'coffee & tea':
    case 'coffee and tea':
      return (
        <svg {...baseProps}>
          <path d="M5 9h10a2 2 0 0 1 2 2v1a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4v-1a2 2 0 0 1 2-2Z" />
          <path d="M17 10h1.5A2.5 2.5 0 0 1 21 12.5v.5a2 2 0 0 1-2 2h-2" />
          <path d="M7 9V7a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
      );
    case 'food':
    case 'meals':
      return (
        <svg {...baseProps}>
          <path d="M7 4v7" />
          <path d="M10 4v7" />
          <path d="M13 4v7" />
          <path d="M4 9h16" />
          <path d="M6 9v7a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V9" />
        </svg>
      );
    case 'tea':
      return (
        <svg {...baseProps}>
          <path d="M4 9h12a2 2 0 0 1 2 2v3a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-3a2 2 0 0 1 2-2Z" />
          <path d="M16 11h2a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2h-2" />
          <path d="M7 9V7a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
      );
    case 'pitcher':
    case 'pitchers':
      return (
        <svg {...baseProps}>
          <path d="M8 4h8l-1 4h-6L8 4Z" />
          <path d="M9 8h6l-.8 9.2A2 2 0 0 1 12.2 19h-.4A2 2 0 0 1 9.8 17.2L9 8Z" />
          <path d="M10 12h4" />
        </svg>
      );
    case 'beer':
    case 'beverages':
      return (
        <svg {...baseProps}>
          <path d="M7 5h8l-1 14a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2L7 5Z" />
          <path d="M10 5V3h4v2" />
          <path d="M9 9h6" />
        </svg>
      );
    default:
      return (
        <svg {...baseProps}>
          <path d="M12 3v7l4 4-4 8-4-8 4-4V3Z" />
          <path d="M12 10h.01" />
        </svg>
      );
  }
}

export default function PosTerminalPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | number>('all');
  const [cart, setCart] = useState<CartItem[]>([]);
  // Option picker state: which product is being configured
  interface PickerGroup { id: number; group: { id: number; name: string; selectionType: 'single' | 'multi' }; options: { id: number; name: string; priceDelta: number }[] }
  const [picker, setPicker] = useState<{ product: Product; groups: PickerGroup[]; categoryId?: number } | null>(null);
  const [pickerSingle, setPickerSingle] = useState<Record<number, number>>({});
  const [pickerMulti, setPickerMulti] = useState<number[]>([]);

  const [customerName, setCustomerName] = useState('Walk-In');
  const [tables, setTables] = useState<Table[]>([]);
  const [selectedTable, setSelectedTable] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Non-fatal problems reported by the order API (e.g. loyalty points that were
  // not added). The sale went through; the cashier still has to know.
  const [warnings, setWarnings] = useState<string[]>([]);
  const [loyaltySearch, setLoyaltySearch] = useState('');
  const [allLoyaltyResults, setAllLoyaltyResults] = useState<LoyaltyCard[]>([]);
  const [loyaltyResults, setLoyaltyResults] = useState<LoyaltyCard[]>([]);
  const [showLoyaltyDropdown, setShowLoyaltyDropdown] = useState(false);
  const [showLoyaltyModal, setShowLoyaltyModal] = useState(false);
  const [loyaltyLoading, setLoyaltyLoading] = useState(false);
  const [selectedLoyaltyCard, setSelectedLoyaltyCard] = useState<LoyaltyCard | null>(null);
  const [loyaltyVouchers, setLoyaltyVouchers] = useState<VoucherDetail[]>([]);
  const [loyaltyVoucherCodes, setLoyaltyVoucherCodes] = useState<string[]>([]);
  const [pendingLoyaltyItemId, setPendingLoyaltyItemId] = useState<number | null>(null);
  const [receipt, setReceipt] = useState<OrderReceipt | null>(null);
  const [businessSettings, setBusinessSettings] = useState<BusinessSettings | null>(null);
  const [showCartPanel, setShowCartPanel] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [orderType, setOrderType] = useState('DINE_IN');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [autoPrint, setAutoPrint] = useState(false);
  // The saved order behind the receipt on screen, for printing the invoice (spec 019).
  const [lastOrder, setLastOrder] = useState<InvoiceOrder | null>(null);
  const [printMsg, setPrintMsg] = useState<string | null>(null);
  const [overrideStock, setOverrideStock] = useState(false);
  const [cashInput, setCashInput] = useState('');
  const [orderFeedback, setOrderFeedback] = useState<'idle' | 'success'>('idle');
  const [cashReceived, setCashReceived] = useState<number>(0);
  // Senior Citizen / PWD / Student discount for the current bill (spec 017)
  const [discount, setDiscount] = useState<TerminalDiscount>({ kind: 'NONE' });
  const [isDownloading, setIsDownloading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const receiptRef = useRef<HTMLDivElement>(null);

  // Reset cash calculator when payment method changes to non-CASH
  useEffect(() => {
    if (paymentMethod !== 'CASH') {
      setCashReceived(0);
      setCashInput('');
    }
  }, [paymentMethod]);

  // Download receipt as premium PDF
  const downloadReceiptPDF = async () => {
    try {
      if (!receiptRef.current || !receipt || isDownloading) return;
      
      setIsDownloading(true);
      
      const { default: jsPDF } = await import('jspdf');
      const { default: html2canvas } = await import('html2canvas');
      
      const element = receiptRef.current;
      const canvas = await html2canvas(element, { scale: 2, backgroundColor: '#ffffff' });
      if (canvas.width === 0 || canvas.height === 0) {
        throw new Error('Failed to generate canvas');
      }
      const imgData = canvas.toDataURL('image/png');
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 190; // A4 width minus margins
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 10, 10, imgWidth, imgHeight);
      pdf.save(`receipt-${receipt.orderNumber}.pdf`);
    } catch (error) {
      console.error('Failed to download PDF:', error);
      alert('Failed to download receipt. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  // Download receipt as Image
  const downloadReceiptImage = async () => {
    try {
      if (!receiptRef.current || !receipt || isDownloading) return;
      
      setIsDownloading(true);
      
      const { default: html2canvas } = await import('html2canvas');
      
      // Clone the element and ensure it has a solid background
      const canvas = await html2canvas(receiptRef.current, { 
        scale: 2, 
        backgroundColor: '#ffffff',
        logging: false, 
        useCORS: true,
        onclone: (clonedDoc, clonedElement) => {
          // Ensure the cloned element has solid white background
          clonedElement.style.backgroundColor = '#ffffff';
          clonedElement.style.backgroundImage = 'none';
        }
      });
      if (canvas.width === 0 || canvas.height === 0) {
        throw new Error('Failed to generate canvas');
      }
      const imgData = canvas.toDataURL('image/png');
      
      // Create download link
      const link = document.createElement('a');
      link.download = `receipt-${receipt.orderNumber}.png`;
      link.href = imgData;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Failed to download image:', error);
      alert('Failed to download receipt image. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  // Calculator functions
  const handleCashInput = (value: string) => {
    if (value === 'clear') {
      setCashInput('');
    } else if (value === 'backspace') {
      setCashInput(prev => prev.slice(0, -1));
    } else if (value === '00') {
      setCashInput(prev => prev + '00');
    } else if (value === '.') {
      // Prevent multiple decimals
      if (!cashInput.includes('.')) setCashInput(prev => prev + value);
    } else {
      // Only allow numeric values
      if (/^\d+$/.test(value)) {
        setCashInput(prev => prev + value);
      }
    }
  };

  const resetCalculator = () => {
    setCashInput('');
    setCashReceived(0);
  };

  // The amount typed is the amount tendered (spec 018: no separate Apply step).
  useEffect(() => {
    setCashReceived(Number.parseFloat(cashInput) || 0);
  }, [cashInput]);

  const cartSubtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const loyaltyDiscount = cart.length > 0 && loyaltyVouchers.length > 0
    ? calculateLoyaltyDiscountForItems(
        cart.map(i => ({ productId: i.productId, price: i.price, quantity: i.quantity, categoryId: i.categoryId })),
        loyaltyVouchers.map(v => ({
          code: v.code,
          discountType: v.discountType,
          discountValue: v.discountValue,
          targetCategoryId: v.targetCategoryId,
        })),
        {}
      )
    : 0;
  // The bill, calculated exactly as the server will (lib/checkout.ts, spec 017).
  const studentRate = businessSettings?.studentPwdDiscountRate ?? 20;
  const billInput = {
    lines: cart.map((i) => ({ amount: i.price * i.quantity, vatExempt: Boolean(i.vatExempt) })),
    loyaltyDiscount,
    vatRegistered: businessSettings?.vatRegistered ?? true,
    vatRate: businessSettings?.vatRate ?? 12,
    serviceChargeRate: serviceChargeRateFor(businessSettings, orderType),
  };
  let billError: string | null = null;
  let bill: CheckoutTotals;
  try {
    bill = computeCheckout({ ...billInput, discount: toCheckoutDiscount(discount, studentRate) });
  } catch (e) {
    billError = e instanceof CheckoutError ? e.message : 'This discount cannot be applied.';
    bill = computeCheckout(billInput);
  }
  const total = bill.total;
  const cashValue = cashReceived > 0 ? cashReceived : Number.parseFloat(cashInput || '0') || 0;
  const changeValue = cashValue > 0 ? cashValue - total : 0;
  const hasCashInput = cashInput.trim() !== '' || cashReceived > 0;

  useEffect(() => {
    let cancelled = false;

    async function loadInitialData() {
      setLoading(true);
      setFetchError(null);
      try {
        const [categoriesRes, tablesRes, settingsRes] = await Promise.all([
          fetch('/api/categories'),
          fetch('/api/tables'),
          fetch('/api/settings/business'),
        ]);

        if (cancelled) return;

        if (!categoriesRes.ok) {
          throw new Error(`Categories API error: ${categoriesRes.status}`);
        }
        if (!tablesRes.ok) {
          throw new Error(`Tables API error: ${tablesRes.status}`);
        }

        const categoriesData = await categoriesRes.json();
        const tablesData = await tablesRes.json();

        setCategories(categoriesData);
        setActiveCategory('all');
        setTables(tablesData);

        if (settingsRes.ok) {
          const settingsData = await settingsRes.json();
          setBusinessSettings(settingsData);
          setAutoPrint(Boolean(settingsData.autoPrintInvoice));
        } else {
          // Use defaults if not configured
          setBusinessSettings({
            businessName: 'My Restaurant',
            businessAddress: '',
            tin: '',
            branchCode: '0000',
            vatRate: 12,
            footerMessage: 'Thank you for your visit!',
          });
        }
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Failed to load terminal data';
        console.error('[Terminal] Load error:', err);
        setFetchError(message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadInitialData();

    return () => { cancelled = true; };
  }, []);

  // Sellable quantity is a derived cache of ingredient stock — keep the
  // terminal's product grid live whenever stock / recipes change.
  const refreshCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/categories');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setCategories(data);
      }
    } catch (err) {
      console.error('[Terminal] refresh categories failed:', err);
    }
  }, []);

  useSocket({
    events: {
      'ingredients-update': () => { refreshCategories(); },
      'inventory-update': () => { refreshCategories(); },
      'product-update': () => { refreshCategories(); },
    },
  });

  function addToCart(product: Product, opts?: { optionIds?: number[]; selectionsLabel?: string; unitPrice?: number; categoryId?: number }) {
    const key = opts?.optionIds?.length ? `${product.id}:${[...opts.optionIds].sort((a, b) => a - b).join(',')}` : String(product.id);
    const unitPrice = opts?.unitPrice ?? product.price;
    setCart(prev => {
      const existing = prev.find(i => (i.key ?? String(i.productId)) === key);
      if (existing) return prev.map(i => (i.key ?? String(i.productId)) === key ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { key, productId: product.id, name: product.name, price: unitPrice, quantity: 1, vatExempt: product.vatExempt ?? false, optionIds: opts?.optionIds, selectionsLabel: opts?.selectionsLabel, categoryId: opts?.categoryId }];
    });
  }

  async function handleProductClick(product: Product) {
    const category = categories.find(c => c.products.some(p => p.id === product.id));
    // Fast path: no customization groups attached → straight into the cart
    try {
      const res = await fetch(`/api/products/${product.id}/option-groups`);
      const data = res.ok ? await res.json() : [];
      const groups: PickerGroup[] = Array.isArray(data)
        ? data.filter((g: PickerGroup) => (g.options?.length ?? 0) > 0)
        : [];
      if (groups.length === 0) {
        addToCart(product, { categoryId: category?.id });
        return;
      }
      const defaults: Record<number, number> = {};
      for (const g of groups) {
        if (g.group.selectionType === 'single' && g.options?.length) defaults[g.group.id] = g.options[0].id;
      }
      setPickerSingle(defaults);
      setPickerMulti([]);
      setPicker({ product, groups, categoryId: category?.id });
    } catch {
      addToCart(product);
    }
  }

  function updateQty(keyOrId: number | string, qty: number) {
    const key = String(keyOrId);
    if (qty <= 0) setCart(prev => prev.filter(i => (i.key ?? String(i.productId)) !== key));
    else setCart(prev => prev.map(i => (i.key ?? String(i.productId)) === key ? { ...i, quantity: qty } : i));
  }

  function clearCart() {
    setCart([]);
    setWarnings([]);
    setCustomerName('Walk-In');
    setSelectedTable(null);
    setSelectedLoyaltyCard(null);
    setLoyaltyVouchers([]);
    setLoyaltyVoucherCodes([]);
    setPendingLoyaltyItemId(null);
    setDeliveryAddress('');
    setSearch('');
    resetCalculator();
  }

  function removeFromCart(keyOrId: number | string) {
    const key = String(keyOrId);
    setCart(prev => prev.filter(i => (i.key ?? String(i.productId)) !== key));
  }

  function updateCartItemQuantity(keyOrId: number | string, delta: number) {
    const key = String(keyOrId);
    const item = cart.find(i => (i.key ?? String(i.productId)) === key);
    if (!item) return;
    const qty = item.quantity + delta;
    if (qty <= 0) {
      removeFromCart(key);
    } else setCart(prev => prev.map(i => (i.key ?? String(i.productId)) === key ? { ...i, quantity: qty } : i));
  }

  async function loadLoyaltyMembers() {
    setLoyaltyLoading(true);
    try {
      const res = await fetch('/api/loyalty/cards', { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to fetch loyalty members');
      const allCards: LoyaltyCard[] = await res.json();
      setAllLoyaltyResults(allCards);
      setLoyaltyResults(allCards);
      return allCards;
    } catch (e) {
      console.error('Error loading loyalty customers:', e);
      setAllLoyaltyResults([]);
      setLoyaltyResults([]);
      return [];
    } finally {
      setLoyaltyLoading(false);
    }
  }

  async function openLoyaltyPicker() {
    setShowLoyaltyModal(true);
    const members = await loadLoyaltyMembers();
    if (loyaltySearch.trim()) {
      setLoyaltyResults(members.filter(card =>
        card.customerName.toLowerCase().includes(loyaltySearch.toLowerCase())
      ));
    }
  }

  function searchLoyaltyCustomers(query: string) {
    setLoyaltySearch(query);
    const normalized = query.trim().toLowerCase();
    const filtered = allLoyaltyResults.filter(card =>
      card.customerName.toLowerCase().includes(normalized)
    );
    setLoyaltyResults(normalized ? filtered : allLoyaltyResults);
  }

  function selectLoyaltyCustomer(card: LoyaltyCard) {
    setSelectedLoyaltyCard(card);
    setLoyaltySearch('');
    setShowLoyaltyDropdown(false);
    setShowLoyaltyModal(false);
    setLoyaltyResults(allLoyaltyResults);

    // Auto-fetch active vouchers for this customer so rewards are applied automatically
    if (pendingLoyaltyItemId !== null) {
      setCart(prev => prev.map(item => {
        if (item.productId !== pendingLoyaltyItemId) return item;
        const existing = item.loyaltyAssignments ?? [];
        const totalAssigned = existing.reduce((sum, entry) => sum + entry.quantity, 0);
        const remaining = Math.max(0, item.quantity - totalAssigned);
        const nextAssignment = { customerName: card.customerName, quantity: remaining > 0 ? remaining : item.quantity };
        const nextAssignments = existing.length > 0 ? [...existing, nextAssignment] : [nextAssignment];
        return { ...item, loyaltyAssignments: nextAssignments.filter(a => a.quantity > 0 && a.customerName.trim()) };
      }));
      setPendingLoyaltyItemId(null);
    }
   }

  async function fetchCustomerVouchers(name: string) {
    try {
      const res = await fetch(`/api/loyalty/cards/${encodeURIComponent(name)}`, { cache: 'no-store' });
      if (!res.ok) {
        setLoyaltyVouchers([]);
        setLoyaltyVoucherCodes([]);
        return;
      }
      const data = await res.json();
      const cards = Array.isArray(data) ? data : [data];
      const card = cards[0];
      const rawVouchers: VoucherDetail[] = (card?.activeVouchers || []).filter((v: VoucherDetail) => v.status === 'ACTIVE');
      setLoyaltyVouchers(rawVouchers);
      setLoyaltyVoucherCodes(rawVouchers.map(v => v.code));
    } catch {
      setLoyaltyVouchers([]);
      setLoyaltyVoucherCodes([]);
    }
  }

  // Auto-fetch and apply loyalty vouchers when a loyalty customer is selected
  useEffect(() => {
    if (selectedLoyaltyCard) {
      fetchCustomerVouchers(selectedLoyaltyCard.customerName);
    } else {
      setLoyaltyVouchers([]);
      setLoyaltyVoucherCodes([]);
    }
  }, [selectedLoyaltyCard]);

  function addLoyaltyAssignment(productId: number, customerName?: string) {
    setCart(prev => prev.map(item => {
      if (item.productId !== productId) return item;
      const existing = item.loyaltyAssignments ?? [];
      const totalAssigned = existing.reduce((sum, entry) => sum + entry.quantity, 0);
      const remaining = Math.max(0, item.quantity - totalAssigned);
      if (remaining <= 0) return item;
      const defaultName = customerName || allLoyaltyResults[0]?.customerName || '';
      const nextAssignment = { customerName: defaultName, quantity: remaining };
      return { ...item, loyaltyAssignments: [...existing, nextAssignment].filter(a => a.quantity > 0 && a.customerName.trim()) };
    }));
  }

  function updateLoyaltyAssignment(productId: number, index: number, field: 'customerName' | 'quantity', value: string | number) {
    setCart(prev => prev.map(item => {
      if (item.productId !== productId) return item;
      const assignments = [...(item.loyaltyAssignments ?? [])];
      if (!assignments[index]) return item;
      const nextValue = field === 'quantity' ? Math.max(1, Number(value) || 1) : String(value);
      assignments[index] = { ...assignments[index], [field]: nextValue } as CartLoyaltyAssignment;

      const total = assignments.reduce((sum, entry) => sum + Number(entry.quantity || 0), 0);
      if (total > item.quantity) {
        const overflow = total - item.quantity;
        assignments[index] = { ...assignments[index], quantity: Math.max(1, Number(assignments[index].quantity || 1) - overflow) };
      }

      return { ...item, loyaltyAssignments: assignments.filter(a => a.customerName.trim() && a.quantity > 0) };
    }));
  }

  function removeLoyaltyAssignment(productId: number, index: number) {
    setCart(prev => prev.map(item => {
      if (item.productId !== productId) return item;
      const assignments = (item.loyaltyAssignments ?? []).filter((_, idx) => idx !== index);
      return { ...item, loyaltyAssignments: assignments };
    }));
  }

  function openItemLoyaltyPicker(productId: number) {
    setPendingLoyaltyItemId(productId);
    setShowLoyaltyModal(true);
    loadLoyaltyMembers();
  }

  // Product price already includes VAT (from BIR pricing), no need to calculate separately
  const itemCount = cart.reduce((s, i) => s + i.quantity, 0);

  const activeCat = typeof activeCategory === 'number' ? categories.find(c => c.id === activeCategory) : null;
  const allProducts = categories.flatMap(c => c.products);
  const displayedProducts = search
    ? allProducts.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.description?.toLowerCase().includes(search.toLowerCase())
      )
    : activeCategory === 'all'
      ? allProducts
      : activeCat?.products ?? [];

  async function placeOrder() {
    if (cart.length === 0) { setError('Cart is empty'); return; }

    if (businessSettings?.loyaltyEnabled) {
      const itemAssignmentsWithoutMember = cart.some(item => (item.loyaltyAssignments ?? []).some(entry => !entry.customerName.trim()));
      if (itemAssignmentsWithoutMember) {
        setError('Please complete each loyalty assignment before placing the order.');
        return;
      }
    }

    // Calculate totals for validation - product prices already include VAT (from BIR pricing).
    // `total` is the discounted (VAT-inclusive) total shown in the calculator.
    const totalAmount = total;
    const problem = billError ?? discountProblem(discount);
    if (problem) { setError(problem); return; }

    // Validate cash payment
    if (paymentMethod === 'CASH') {
      if (cashReceived <= 0) {
        setError('Please use the cash calculator to enter payment amount');
        return;
      }
      if (cashReceived < totalAmount) {
        setError(`Insufficient cash. Required: ₱${totalAmount.toFixed(2)}`);
        return;
      }
    }
    if (!customerName.trim()) { setError('Please enter customer name'); return; }
    if (orderType === 'DELIVERY' && !deliveryAddress.trim()) {
      setError('Please enter a delivery address for delivery orders.');
      return;
    }
    setPlacing(true);
    setError(null);
    setWarnings([]);
    try {
      const loyaltyTargetName = cart
        .flatMap(item => item.loyaltyAssignments ?? [])
        .find(entry => entry.customerName.trim())?.customerName || null;

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
           customerName: customerName.trim(),
           loyaltyCustomerName: loyaltyTargetName || customerName.trim(),
           paymentMethod,
           tableId: selectedTable ?? undefined,
           orderType,
           deliveryAddress: orderType === 'DELIVERY' ? deliveryAddress.trim() : undefined,
           paymentConfirmed: true,
           overrideStock,
           discount: toOrderDiscount(discount),
           // The peso amount is not sent: /api/orders derives it from these
           // codes and redeems them with the order.
           ...(loyaltyVoucherCodes.length > 0 && { loyaltyVoucherCodes }),
           items: cart.map(i => ({
            productId: i.productId,
            quantity: i.quantity,
            ...(i.optionIds?.length ? { optionIds: i.optionIds } : {}),
            notes: (i.loyaltyAssignments ?? []).length > 0 ? JSON.stringify(i.loyaltyAssignments) : undefined,
          })),
        }),
      });
       const data = await res.json();
       if (!res.ok) { setError(data.error || 'Failed to place order'); return; }
       const table = tables.find(t => t.id === selectedTable);

       // Vouchers are redeemed by /api/orders inside the order transaction,
       // so there is nothing to redeem here. Anything that went wrong after
       // the sale was committed comes back as a warning.
       if (Array.isArray(data.warnings) && data.warnings.length > 0) {
         setWarnings(data.warnings);
       }
      
      // Receipt figures: the saved order's own breakdown (same calculation as the bill shown).
      const saved = data as Partial<Record<string, unknown>>;
      const num = (k: string, fallback: number) => (typeof saved[k] === 'number' ? (saved[k] as number) : fallback);
      const reasonByKind: Record<string, string | undefined> = {
        STUDENT: 'STUDENT',
        STATUTORY: typeof saved.discountReason === 'string' ? saved.discountReason : 'SENIOR',
      };
      
      setReceipt({
        orderNumber: data.orderNumber,
        receiptSerial: (data as { invoiceNumber?: string | null }).invoiceNumber || data.orderNumber,
        customerName: customerName.trim() || 'Guest',
        totalAmount: num('totalAmount', total),
        items: cart.map(i => ({ name: i.name, quantity: i.quantity, price: i.price, vatExempt: i.vatExempt })),
        tableName: table?.name,
        deliveryAddress: orderType === 'DELIVERY' ? deliveryAddress.trim() : undefined,
        createdAt: new Date().toISOString(),
        paymentMethod,
        orderType,
        subtotal: num('grossAmount', bill.gross),
        vatTaxableTotal: num('vatableSales', bill.vatableSales),
        vatExemptTotal: num('vatExemptSales', bill.vatExemptSales),
        vatAmount: num('vatAmount', bill.vatAmount),
        discountAmount: num('discountAmount', bill.discount),
        discountReason: reasonByKind[discount.kind],
        discountRate: discount.kind === 'STUDENT' ? studentRate : discount.kind === 'STATUTORY' ? 20 : undefined,
        loyaltyDiscount: num('loyaltyDiscount', bill.loyaltyDiscount) || undefined,
        vatRemoved: num('vatRemoved', bill.vatRemoved) || undefined,
        serviceCharge: num('serviceCharge', bill.serviceCharge) || undefined,
        cashReceived: paymentMethod === 'CASH' ? cashReceived : undefined,
        change: paymentMethod === 'CASH' ? cashReceived - num('totalAmount', total) : undefined,
      });
      setLastOrder(data as InvoiceOrder);
      setPrintMsg(null);
      const paidCash = paymentMethod === 'CASH' ? { received: cashReceived, change: cashReceived - num('totalAmount', total) } : null;
      if (autoPrint) {
        printInvoice(data as InvoiceOrder, businessSettings, { cash: paidCash }).then((r) => { if (!r.ok) setPrintMsg(`Invoice did not print: ${r.error ?? 'printer problem'}`); });
      }
      if (businessSettings?.autoPrintKitchen) {
        printKitchenTicket(data as InvoiceOrder, businessSettings).then((r) => { if (!r.ok) setPrintMsg(`Kitchen ticket did not print: ${r.error ?? 'printer problem'}`); });
      }
      clearCart();
      setCustomerName('Walk-In');
      setSelectedTable(null);
      setSelectedLoyaltyCard(null);
      setLoyaltyVouchers([]);
      setLoyaltyVoucherCodes([]);
      setPaymentMethod('CASH');
      setDiscount({ kind: 'NONE' });
      setOrderType('DINE_IN');
      setDeliveryAddress('');
      resetCalculator();
      setOrderFeedback('success');
      window.setTimeout(() => setOrderFeedback('idle'), 1500);
    } catch {
      setError('Network error');
    } finally {
      setPlacing(false);
    }
  }

  const ROW = 'flex items-center justify-between gap-3';
  const typeLabel = orderType === 'DINE_IN' ? 'Dine-in' : orderType === 'TAKEOUT' ? 'Takeout' : 'Delivery';
  const tableName = tables.find((t) => t.id === selectedTable)?.name;
  const segBtn = (active: boolean) =>
    `h-9 rounded-[10px] px-3 text-[13px] font-semibold transition ${active ? 'bg-[var(--pos-surface)] text-[var(--pos-ink)] shadow-[0_1px_2px_rgba(45,30,20,0.12)]' : 'text-[var(--pos-ink-soft)] hover:text-[var(--pos-ink)]'}`;
  const fieldCls =
    'h-10 w-full rounded-[12px] border border-[var(--pos-border)] bg-[var(--pos-surface)] px-3 text-sm text-[var(--pos-ink)] outline-none transition placeholder:text-[var(--pos-ink-soft)]/60 focus:border-[var(--pos-accent)] focus:ring-2 focus:ring-[var(--pos-accent)]/15';
  const keypad = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', 'backspace'];

  return (
    <div className="flex h-full min-h-screen w-full flex-col bg-[var(--pos-paper)] text-[var(--pos-ink)]">

      {loading && (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <div className="mb-3 inline-block h-9 w-9 animate-spin rounded-full border-[3px] border-[var(--pos-accent)] border-t-transparent" />
            <p className="text-sm text-[var(--pos-ink-soft)]">Loading the register…</p>
          </div>
        </div>
      )}

      {!loading && fetchError && (
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="max-w-md rounded-[20px] border border-[var(--pos-border)] bg-[var(--pos-surface)] p-6 text-center">
            <h2 className="mb-2 text-xl font-bold tracking-[-0.02em]">The register could not load</h2>
            <p className="mb-2 text-sm text-[var(--pos-ink-soft)]">{fetchError}</p>
            <p className="mb-4 text-xs text-[var(--pos-ink-soft)]">
              This usually happens on a first install before the menu has been set up.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="h-10 rounded-[12px] bg-[var(--pos-accent)] px-5 text-sm font-semibold text-white hover:bg-[var(--pos-accent-hover)]"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {!loading && !fetchError && (
        <>
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-3 px-5 pb-3 pt-5">
        <div className="min-w-0">
          <h1 className="text-[30px] font-bold leading-none tracking-[-0.035em]">New order</h1>
          <p className="mt-1.5 truncate text-sm text-[var(--pos-ink-soft)]">
            {typeLabel}{tableName ? ` · ${tableName}` : ''} · {customerName.trim() || 'Walk-in'} ·{' '}
            <span className="font-semibold text-[var(--pos-ink)]">{itemCount} item{itemCount === 1 ? '' : 's'}</span>
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <div className="w-60">
            <CashDrawerPanel businessName={businessSettings?.businessName || 'My Restaurant'} />
          </div>
          <div className="relative flex-1 sm:w-80 sm:flex-none">
            <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--pos-ink-soft)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
              <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
            </svg>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search the menu"
              aria-label="Search the menu"
              className={`${fieldCls} pl-9`}
            />
          </div>
        </div>
      </header>

      {/* Register: categories · products · ticket */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 px-5 pb-5 min-[1024px]:grid-cols-[minmax(0,1fr)_360px] min-[1440px]:grid-cols-[210px_minmax(0,1fr)_400px]">

        {/* Categories */}
        <aside className="hidden min-h-0 flex-col rounded-[20px] border border-[var(--pos-border)] bg-[var(--pos-surface)] p-2 min-[1440px]:flex">
          <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto">
            {[{ id: 'all' as const, name: 'All items', count: allProducts.length, glyph: 'all' }, ...categories.map((c) => ({ id: c.id, name: c.name, count: c.products.length, glyph: c.name }))].map((c) => {
              const active = !search && activeCategory === c.id;
              return (
                <button
                  key={String(c.id)}
                  onClick={() => { setSearch(''); setActiveCategory(c.id); }}
                  className={`flex h-12 w-full items-center gap-3 rounded-[14px] px-2.5 text-left text-sm transition ${active ? 'bg-[var(--pos-accent-soft)] font-semibold text-[var(--pos-accent-hover)]' : 'text-[var(--pos-ink-soft)] hover:bg-[var(--pos-muted)] hover:text-[var(--pos-ink)]'}`}
                >
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] ${active ? 'bg-[var(--pos-accent)] text-white' : 'bg-[var(--pos-muted)]'}`}>
                    <CategoryGlyph name={c.glyph} active={false} className={`h-4 w-4 ${active ? '[&]:stroke-white' : ''}`} />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{c.name}</span>
                  <span className="text-xs tabular-nums opacity-70">{c.count}</span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Products */}
        <section className="flex min-h-0 flex-col rounded-[20px] border border-[var(--pos-border)] bg-[var(--pos-surface)]">
          <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-4">
            <div className="min-w-0">
              <h2 className="truncate text-base font-bold tracking-[-0.01em]">
                {search ? `Results for “${search}”` : activeCategory === 'all' ? 'Everything on the menu' : activeCat?.name}
              </h2>
              <p className="text-xs text-[var(--pos-ink-soft)]">
                {displayedProducts.length} item{displayedProducts.length === 1 ? '' : 's'} · tap to add, the badge shows how many are on the ticket
              </p>
            </div>
          </div>
          {/* Categories as chips on narrow screens */}
          <div className="flex gap-1.5 overflow-x-auto px-4 pb-2 min-[1440px]:hidden">
            {[{ id: 'all' as const, name: 'All' }, ...categories.map((c) => ({ id: c.id, name: c.name }))].map((c) => (
              <button
                key={String(c.id)}
                onClick={() => { setSearch(''); setActiveCategory(c.id); }}
                className={`h-9 shrink-0 rounded-full border px-3.5 text-[13px] font-semibold ${activeCategory === c.id && !search ? 'border-[var(--pos-accent)] bg-[var(--pos-accent)] text-white' : 'border-[var(--pos-border)] text-[var(--pos-ink-soft)]'}`}
              >
                {c.name}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
            <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
              {displayedProducts.map((product) => {
                const outOfStock = product.inventory && product.inventory.quantity === 0;
                const inCart = cart.filter((i) => i.productId === product.id).reduce((n, i) => n + i.quantity, 0);
                const blocked = outOfStock && !overrideStock;
                const catName = categories.find((c) => c.products.some((p) => p.id === product.id))?.name ?? 'all';
                return (
                  <button
                    key={product.id}
                    onClick={() => !blocked && handleProductClick(product)}
                    disabled={blocked}
                    className={`group relative flex flex-col overflow-hidden rounded-[16px] border text-left transition ${
                      blocked
                        ? 'cursor-not-allowed border-[var(--pos-border)] opacity-50'
                        : inCart
                          ? 'border-[var(--pos-accent)] ring-1 ring-[var(--pos-accent)]'
                          : 'border-[var(--pos-border)] hover:border-[var(--pos-ink-soft)]/40 active:scale-[0.98]'
                    }`}
                  >
                    <div className="relative aspect-[4/3] w-full overflow-hidden bg-[var(--pos-muted)]">
                      {isImageUrl(product.imageUrl)
                        ? <img src={product.imageUrl} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                        : <div className="flex h-full w-full items-center justify-center"><CategoryGlyph name={catName} active={false} className="h-8 w-8 opacity-60" /></div>}
                      {outOfStock && (
                        <span className="absolute left-2 top-2 rounded-full bg-[var(--pos-surface)] px-2 py-0.5 text-[11px] font-semibold text-[var(--pos-danger)]">
                          {overrideStock ? 'Sold out · selling anyway' : 'Sold out'}
                        </span>
                      )}
                      {inCart > 0 && (
                        <span className="absolute right-2 top-2 flex h-7 min-w-7 items-center justify-center rounded-full bg-[var(--pos-accent)] px-2 text-xs font-bold text-white tabular-nums">
                          {inCart}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col justify-between gap-2 p-3">
                      <p className="line-clamp-2 text-sm font-semibold leading-snug">{product.name}</p>
                      <div className={ROW}>
                        <span className="text-[15px] font-bold tabular-nums tracking-[-0.01em]">{formatPeso(product.price)}</span>
                        <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--pos-border)] text-lg leading-none text-[var(--pos-ink-soft)] transition group-hover:border-[var(--pos-accent)] group-hover:bg-[var(--pos-accent)] group-hover:text-white">+</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            {displayedProducts.length === 0 && (
              <div className="flex h-56 flex-col items-center justify-center text-center text-[var(--pos-ink-soft)]">
                <p className="text-sm font-semibold text-[var(--pos-ink)]">Nothing matches</p>
                <p className="text-xs">Try another word or pick a category.</p>
              </div>
            )}
          </div>
        </section>

        {/* Ticket */}
        <section className="flex min-h-0 flex-col overflow-hidden rounded-[20px] border border-[var(--pos-border)] bg-[var(--pos-surface)]">
          <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="space-y-3 border-b border-[var(--pos-border)] p-4">
            <div className={ROW}>
              <h2 className="text-base font-bold tracking-[-0.01em]">Ticket</h2>
              {cart.length > 0 && (
                <button onClick={clearCart} className="text-xs font-semibold text-[var(--pos-ink-soft)] hover:text-[var(--pos-danger)]">
                  Clear ticket
                </button>
              )}
            </div>
            <div className="grid grid-cols-3 gap-1 rounded-[12px] bg-[var(--pos-muted)] p-1">
              {(['DINE_IN', 'TAKEOUT', 'DELIVERY'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => { setOrderType(type); if (type !== 'DINE_IN') setSelectedTable(null); }}
                  className={segBtn(orderType === type)}
                >
                  {type === 'DINE_IN' ? 'Dine-in' : type === 'TAKEOUT' ? 'Takeout' : 'Delivery'}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Customer name"
                aria-label="Customer name"
                className={fieldCls}
              />
              {orderType === 'DINE_IN' ? (
                <select
                  value={selectedTable ?? ''}
                  onChange={(e) => setSelectedTable(e.target.value ? Number(e.target.value) : null)}
                  aria-label="Table"
                  className={fieldCls}
                >
                  <option value="">No table</option>
                  {tables.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              ) : orderType === 'DELIVERY' ? (
                <input
                  type="text"
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  placeholder="Delivery address"
                  aria-label="Delivery address"
                  className={fieldCls}
                />
              ) : (
                <div className="flex h-10 items-center rounded-[12px] bg-[var(--pos-muted)] px-3 text-xs text-[var(--pos-ink-soft)]">Takeout counter</div>
              )}
            </div>
            {businessSettings?.loyaltyEnabled && (
              <button
                type="button"
                onClick={openLoyaltyPicker}
                className="flex w-full items-center gap-3 rounded-[14px] border border-[var(--pos-border)] px-3 py-2 text-left transition hover:border-[var(--pos-ink-soft)]/40"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--pos-accent-soft)] text-[var(--pos-accent)]">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M19 8v6M16 11h6" /></svg>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{selectedLoyaltyCard ? selectedLoyaltyCard.customerName : 'Add a loyalty member'}</span>
                  <span className="block truncate text-xs text-[var(--pos-ink-soft)]">
                    {selectedLoyaltyCard
                      ? loyaltyVoucherCodes.length > 0 ? `${loyaltyVoucherCodes.length} reward${loyaltyVoucherCodes.length === 1 ? '' : 's'} applied` : 'Earns stamps on this sale'
                      : 'Walk-in · they would earn stamps on this sale'}
                  </span>
                </span>
                <span className="text-[var(--pos-ink-soft)]">›</span>
              </button>
            )}
          </div>

          {/* Lines */}
          <div className="px-4 py-2">
            {cart.length === 0 ? (
              <div className="flex min-h-[96px] flex-col items-center justify-center text-center">
                <p className="text-sm font-semibold">Tap a dish to start</p>
                <p className="mt-0.5 text-xs text-[var(--pos-ink-soft)]">Items you add appear here.</p>
              </div>
            ) : (
              <ul className="divide-y divide-[var(--pos-border)]">
                {cart.map((item) => (
                  <li key={item.key ?? item.productId} className="py-2.5">
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold leading-snug">{item.name}</p>
                        {item.selectionsLabel && <p className="text-xs text-[var(--pos-accent)]">{item.selectionsLabel}</p>}
                        <p className="text-xs text-[var(--pos-ink-soft)] tabular-nums">{formatPeso(item.price)} each</p>
                      </div>
                      <div className="flex items-center rounded-full border border-[var(--pos-border)]">
                        <button onClick={() => updateCartItemQuantity(item.key ?? item.productId, -1)} className="h-8 w-8 rounded-full text-base text-[var(--pos-ink-soft)] hover:bg-[var(--pos-muted)]" aria-label={`One less ${item.name}`}>−</button>
                        <span className="w-6 text-center text-sm font-semibold tabular-nums">{item.quantity}</span>
                        <button onClick={() => updateCartItemQuantity(item.key ?? item.productId, 1)} className="h-8 w-8 rounded-full text-base text-[var(--pos-ink-soft)] hover:bg-[var(--pos-muted)]" aria-label={`One more ${item.name}`}>+</button>
                      </div>
                      <div className="w-20 text-right">
                        <p className="text-sm font-bold tabular-nums">{formatPeso(item.price * item.quantity)}</p>
                        <button onClick={() => removeFromCart(item.key ?? item.productId)} className="text-[11px] text-[var(--pos-ink-soft)] hover:text-[var(--pos-danger)]">Remove</button>
                      </div>
                    </div>

                    {businessSettings?.loyaltyEnabled && (
                      <div className="mt-2 rounded-[12px] bg-[var(--pos-paper)] px-2.5 py-2">
                        <div className={ROW}>
                          <span className="text-[11px] font-semibold text-[var(--pos-ink-soft)]">Stamps to</span>
                          <button type="button" onClick={() => openItemLoyaltyPicker(item.productId)} className="text-[11px] font-semibold text-[var(--pos-accent)] hover:underline">
                            + Member
                          </button>
                        </div>
                        {(item.loyaltyAssignments ?? []).length === 0 ? (
                          <p className="text-[11px] text-[var(--pos-ink-soft)]">No member on this item.</p>
                        ) : (
                          <div className="mt-1 space-y-1">
                            {(item.loyaltyAssignments ?? []).map((assignment, idx) => (
                              <div key={`${item.productId}-${idx}`} className="flex items-center gap-1.5">
                                <select
                                  value={assignment.customerName}
                                  onChange={(e) => updateLoyaltyAssignment(item.productId, idx, 'customerName', e.target.value)}
                                  className="h-8 min-w-0 flex-1 rounded-[10px] border border-[var(--pos-border)] bg-[var(--pos-surface)] px-2 text-xs outline-none focus:border-[var(--pos-accent)]"
                                  aria-label="Loyalty member"
                                >
                                  <option value="">Select member</option>
                                  {allLoyaltyResults.map((card) => (
                                    <option key={`${card.id}-${card.customerName}`} value={card.customerName}>{card.customerName}</option>
                                  ))}
                                </select>
                                <input
                                  type="number"
                                  min={1}
                                  max={item.quantity}
                                  value={assignment.quantity}
                                  onChange={(e) => updateLoyaltyAssignment(item.productId, idx, 'quantity', Number(e.target.value) || 1)}
                                  className="h-8 w-12 rounded-[10px] border border-[var(--pos-border)] bg-[var(--pos-surface)] text-center text-xs outline-none focus:border-[var(--pos-accent)]"
                                  aria-label="Quantity for this member"
                                />
                                <button type="button" onClick={() => removeLoyaltyAssignment(item.productId, idx)} className="h-8 w-8 rounded-[10px] text-xs text-[var(--pos-ink-soft)] hover:bg-[var(--pos-danger-soft)] hover:text-[var(--pos-danger)]" aria-label="Remove member">
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Discount, totals, payment */}
          <div className="space-y-3 border-t border-[var(--pos-border)] p-4">
            <DiscountPicker value={discount} onChange={setDiscount} studentRate={studentRate} />
            {billError && <p className="text-xs text-[var(--pos-danger)]" role="alert">{billError}</p>}

            <dl className="space-y-1 text-sm">
              <div className={ROW}><dt className="text-[var(--pos-ink-soft)]">Subtotal</dt><dd className="tabular-nums">{formatPeso(bill.gross)}</dd></div>
              {loyaltyDiscount > 0 && <div className={ROW}><dt className="text-[var(--pos-ink-soft)]">Loyalty reward</dt><dd className="tabular-nums text-[var(--pos-accent)]">−{formatPeso(bill.loyaltyDiscount)}</dd></div>}
              {bill.vatRemoved > 0 && <div className={ROW}><dt className="text-[var(--pos-ink-soft)]">Less VAT (Senior/PWD)</dt><dd className="tabular-nums text-[var(--pos-accent)]">−{formatPeso(bill.vatRemoved)}</dd></div>}
              {bill.discount > 0 && <div className={ROW}><dt className="text-[var(--pos-ink-soft)]">Discount</dt><dd className="tabular-nums text-[var(--pos-accent)]">−{formatPeso(bill.discount)}</dd></div>}
              {bill.serviceCharge > 0 && <div className={ROW}><dt className="text-[var(--pos-ink-soft)]">Service charge</dt><dd className="tabular-nums">{formatPeso(bill.serviceCharge)}</dd></div>}
              <div className={`${ROW} border-t border-dashed border-[var(--pos-border)] pt-2`}>
                <dt className="text-base font-bold">Total</dt>
                <dd className="text-2xl font-bold tabular-nums tracking-[-0.03em]">{formatPeso(total)}</dd>
              </div>
            </dl>

            <div className="grid grid-cols-3 gap-1 rounded-[12px] bg-[var(--pos-muted)] p-1">
              {['CASH', 'GCASH', 'PAYMAYA'].map((pm) => (
                <button key={pm} onClick={() => setPaymentMethod(pm)} className={segBtn(paymentMethod === pm)}>
                  {pm === 'CASH' ? 'Cash' : pm === 'GCASH' ? 'GCash' : 'Maya'}
                </button>
              ))}
            </div>

            {paymentMethod === 'CASH' && (
              <div className="space-y-2">
                <div className="flex gap-1.5">
                  <button onClick={() => setCashInput(total.toFixed(2))} disabled={total <= 0} className="h-9 flex-1 rounded-[10px] border border-[var(--pos-border)] text-xs font-semibold hover:bg-[var(--pos-muted)] disabled:opacity-40">Exact</button>
                  {[100, 200, 500, 1000].map((a) => (
                    <button key={a} onClick={() => setCashInput(String(a))} className="h-9 flex-1 rounded-[10px] border border-[var(--pos-border)] text-xs font-semibold tabular-nums hover:bg-[var(--pos-muted)]">₱{a}</button>
                  ))}
                </div>
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <label className="relative block">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--pos-ink-soft)]">₱</span>
                    <input
                      inputMode="decimal"
                      value={cashInput}
                      onChange={(e) => setCashInput(e.target.value.replace(/[^0-9.]/g, ''))}
                      placeholder="Cash received"
                      aria-label="Cash received"
                      className={`${fieldCls} pl-7 text-base font-semibold tabular-nums`}
                    />
                  </label>
                  <div className={`flex h-10 min-w-[120px] flex-col justify-center rounded-[12px] px-3 ${changeValue < 0 && hasCashInput ? 'bg-[var(--pos-danger-soft)] text-[var(--pos-danger)]' : 'bg-[var(--tile-sage)] text-[var(--c-good)]'}`}>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.08em] opacity-80">{changeValue < 0 && hasCashInput ? 'Short' : 'Change'}</span>
                    <span className="text-sm font-bold leading-tight tabular-nums">{hasCashInput ? formatPeso(Math.abs(changeValue)) : '—'}</span>
                  </div>
                </div>
                <details className="group">
                  <summary className="cursor-pointer list-none text-xs font-semibold text-[var(--pos-ink-soft)] hover:text-[var(--pos-ink)]">
                    <span className="group-open:hidden">Show keypad</span><span className="hidden group-open:inline">Hide keypad</span>
                  </summary>
                  <div className="mt-2 grid grid-cols-3 gap-1.5">
                    {keypad.map((k) => (
                      <button
                        key={k}
                        onClick={() => handleCashInput(k)}
                        className="h-11 rounded-[12px] border border-[var(--pos-border)] text-base font-semibold tabular-nums hover:bg-[var(--pos-muted)]"
                        aria-label={k === 'backspace' ? 'Delete last digit' : k}
                      >
                        {k === 'backspace' ? '⌫' : k}
                      </button>
                    ))}
                  </div>
                </details>
              </div>
            )}

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--pos-ink-soft)]">
              <label className="flex cursor-pointer items-center gap-2">
                <input type="checkbox" checked={autoPrint} onChange={() => setAutoPrint(!autoPrint)} className="h-4 w-4 accent-[var(--pos-accent)]" />
                Print receipt automatically
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input type="checkbox" checked={overrideStock} onChange={() => setOverrideStock(!overrideStock)} className="h-4 w-4 accent-[var(--pos-accent)]" />
                Sell sold-out items
              </label>
            </div>

          </div>
          </div>

          {/* Pinned: problems and the Charge button stay in view */}
          <div className="space-y-2 border-t border-[var(--pos-border)] bg-[var(--pos-surface)] p-4">
            {error && <div className="rounded-[12px] bg-[var(--pos-danger-soft)] px-3 py-2 text-sm text-[var(--pos-danger)]" role="alert">{error}</div>}
            {warnings.length > 0 && (
              <div className="rounded-[12px] bg-[var(--tile-sand)] px-3 py-2 text-sm text-[var(--c-amber)]" role="status">
                {warnings.map((w) => <p key={w}>{w}</p>)}
                <button type="button" onClick={() => setWarnings([])} className="mt-1 text-xs font-semibold underline">Dismiss</button>
              </div>
            )}

            <button
              onClick={placeOrder}
              disabled={placing || cart.length === 0}
              className="flex h-14 w-full items-center justify-between rounded-[16px] bg-[var(--pos-accent)] px-5 text-base font-bold text-white transition hover:bg-[var(--pos-accent-hover)] disabled:cursor-not-allowed disabled:bg-[var(--pos-muted)] disabled:text-[var(--pos-ink-soft)]"
            >
              <span>{placing ? 'Placing order…' : orderFeedback === 'success' ? 'Order placed' : `Charge ${formatPeso(total)}`}</span>
              <span aria-hidden>→</span>
            </button>
          </div>
        </section>
      </div>

        {businessSettings?.loyaltyEnabled && showLoyaltyModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/35 px-4 backdrop-blur-[2px]">
            <div className="w-full max-w-lg rounded-[24px] border border-[var(--pos-border)] bg-[var(--pos-surface)] p-4 shadow-[0_24px_80px_rgba(28,25,23,0.18)]">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--pos-ink-soft)]">Loyalty members</p>
                  <h3 className="mt-1 text-lg font-semibold text-[var(--pos-ink)]">Select member</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowLoyaltyModal(false)}
                  className="h-8 w-8 rounded-full text-sm font-semibold text-[var(--pos-ink-soft)] transition hover:bg-[var(--pos-muted)]"
                >
                  ✕
                </button>
              </div>

              <div className="mb-3">
                <input
                  type="text"
                  value={loyaltySearch}
                  onChange={(e) => searchLoyaltyCustomers(e.target.value)}
                  placeholder="Search by customer name..."
                  className="w-full rounded-[var(--radius-md)] border border-[var(--pos-border)] bg-[var(--pos-paper)] px-3 py-2.5 text-sm text-[var(--pos-ink)] outline-none transition focus:border-[var(--pos-accent)] focus:ring-2 focus:ring-[var(--pos-accent)]/15"
                />
              </div>

              <div className="max-h-[320px] overflow-y-auto rounded-[var(--radius-md)] border border-[var(--pos-border)] bg-[var(--pos-paper)]">
                {loyaltyLoading ? (
                  <div className="px-3 py-5 text-center text-xs text-[var(--pos-ink-soft)]">Loading members...</div>
                ) : loyaltyResults.length > 0 ? (
                  <div className="divide-y divide-[var(--pos-border)]">
                    {loyaltyResults.map((card) => (
                      <button
                        key={card.id}
                        type="button"
                        onClick={() => selectLoyaltyCustomer(card)}
                        className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left transition hover:bg-white"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[var(--pos-ink)]">{card.customerName}</p>
                          {card.membershipCode && (
                            <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--pos-accent)]">
                              {card.membershipCode}
                            </p>
                          )}
                          <p className="mt-0.5 text-[10px] text-[var(--pos-ink-soft)]">
                            {card.coffeesCompleted} stamps • 🎁 {card.rewardsAvailable} rewards
                          </p>
                        </div>
                        <span className="rounded-full bg-[var(--pos-accent-soft)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--pos-accent)]">
                          Select
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="px-3 py-5 text-center text-xs text-[var(--pos-ink-soft)]">
                    {loyaltySearch.trim() ? 'No matching loyalty members found' : 'No loyalty members available'}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      {/* BIR-Compliant Receipt Modal */}
      {receipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setReceipt(null)}
          />
          <div ref={receiptRef} className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-300" style={{ fontSize: '11px' }}>
            {/* Receipt Header */}
            <div className="px-4 py-4 text-center border-b-2 border-dashed border-gray-300 bg-gray-50 rounded-t-2xl">
              <p className="text-[10px] font-bold uppercase tracking-widest text-accent-text">Official Receipt</p>
              <h2 className="text-lg font-bold text-gray-900 mt-1">{businessSettings?.businessName || 'My Restaurant'}</h2>
              {businessSettings?.businessAddress && (
                <p className="text-[10px] text-gray-500 mt-1">{businessSettings.businessAddress}</p>
              )}
              {(businessSettings?.tin || businessSettings?.branchCode) && (
                <p className="text-[10px] text-gray-500 mt-0.5">TIN: {businessSettings.tin}{businessSettings.branchCode ? `-${businessSettings.branchCode}` : ''}</p>
              )}
              {businessSettings?.serialNo && (
                <p className="text-[9px] text-gray-400 mt-0.5">Serial: {businessSettings.serialNo}</p>
              )}
              <p className="text-xs font-mono mt-2 text-gray-700">#{receipt.orderNumber}</p>
              <button
                onClick={() => setReceipt(null)}
                className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 text-lg w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-200"
              >✕</button>
            </div>

            {/* Receipt Body */}
            <div className="px-4 py-3">
              {/* Transaction Info */}
              <div className="text-[10px] space-y-1 border-b border-gray-200 pb-3">
                <div className="flex justify-between">
                  <span className="text-gray-500">Date:</span>
                  <span className="text-gray-800">{new Date(receipt.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Time:</span>
                  <span className="text-gray-800">{new Date(receipt.createdAt).toLocaleTimeString()}</span>
                </div>
                {receipt.customerName && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Customer:</span>
                    <span className="text-gray-800 font-medium">{receipt.customerName}</span>
                  </div>
                )}
                {receipt.tableName && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Table:</span>
                    <span className="text-gray-800">{receipt.tableName}</span>
                  </div>
                )}
                {receipt.orderType && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Order:</span>
                    <span className="text-gray-800">{receipt.orderType === 'DINE_IN' ? 'Dine-in' : receipt.orderType === 'TAKEOUT' ? 'Takeout' : 'Delivery'}</span>
                  </div>
                )}
                {receipt.deliveryAddress && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Deliver to:</span>
                    <span className="text-gray-800">{receipt.deliveryAddress}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">Payment:</span>
                  <span className="text-gray-800 font-medium">{receipt.paymentMethod === 'CASH' ? 'CASH' : receipt.paymentMethod === 'GCASH' ? 'GCASH' : receipt.paymentMethod === 'PAYMAYA' ? 'PAYMAYA' : receipt.paymentMethod}</span>
                </div>
              </div>

              {/* Items - Thermal Format */}
              <div className="py-3 border-b border-gray-200">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">━━━━━ ITEMS ━━━━━</p>
                <div className="space-y-1.5">
                  {receipt.items.map((item, idx) => (
                    <div key={idx} className="text-[11px]">
                      <div className="flex justify-between items-start">
                        <span className="text-gray-800 flex-1">{item.name}</span>
                        <span className="text-gray-800 font-medium ml-2">₱{(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                      <div className="text-gray-500 text-[10px]">
                        {item.quantity} x ₱{item.price.toFixed(2)}
                        {item.vatExempt && <span className="ml-2 text-green-600">VAT-EX</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals - Thermal Format */}
              <div className="py-3 space-y-1 text-[11px] border-b border-gray-200">
                <div className="flex justify-between">
                  <span className="text-gray-500">Subtotal:</span>
                  <span className="text-gray-800">₱{receipt.subtotal.toFixed(2)}</span>
                </div>
                {receiptAdjustments(receipt).map((line) => (
                  <div key={line.label} className="flex justify-between">
                    <span className="text-gray-500">{line.label}:</span>
                    <span className="text-gray-800">{signedPeso(line.amount)}</span>
                  </div>
                ))}
              </div>

              {/* Grand Total */}
              <div className="py-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-gray-900">TOTAL</span>
                  <span className="text-lg font-bold text-gray-900">₱{receipt.totalAmount.toFixed(2)}</span>
                </div>
                {receipt.paymentMethod === 'CASH' && receipt.cashReceived !== undefined && (
                  <>
                    <div className="flex justify-between text-[10px] mt-1">
                      <span className="text-gray-500">Cash Tendered:</span>
                      <span className="text-gray-800">₱{receipt.cashReceived.toFixed(2)}</span>
                    </div>
                    {receipt.change !== undefined && receipt.change > 0 && (
                      <div className="flex justify-between text-[10px]">
                        <span className="text-gray-500">Change:</span>
                        <span className="text-gray-800 font-medium">₱{receipt.change.toFixed(2)}</span>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* VAT Breakdown - BIR Required */}
              <div className="py-2 text-[9px] text-gray-500 border-t border-dashed border-gray-200 mt-2">
                <p className="font-medium text-gray-600">VAT Breakdown:</p>
                <p>Total Sales (VAT Incl): ₱{receipt.totalAmount.toFixed(2)}</p>
                {receipt.vatTaxableTotal > 0 && (
                  <>
                    <p>VATable Sales: ₱{receipt.vatTaxableTotal.toFixed(2)}</p>
                    <p>VAT Amount ({businessSettings?.vatRate ?? 12}%): ₱{receipt.vatAmount.toFixed(2)}</p>
                  </>
                )}
                {receipt.vatExemptTotal > 0 && (
                  <p>Exempt Sales: ₱{receipt.vatExemptTotal.toFixed(2)}</p>
                )}
              </div>

              {/* Footer */}
              <p className="text-center text-[10px] text-gray-500 pt-3 mt-2">
                {businessSettings?.footerMessage || 'Thank you for your visit!'}
              </p>
              <p className="text-center text-[9px] text-gray-400">
                Please come again!
              </p>
            </div>

            {/* Print & Close Buttons */}
            <div className="px-6 pb-6 space-y-3">
              {/* Download Image - Thermal Print */}
              <div className="flex gap-2">
                <button
                  onClick={downloadReceiptImage}
                  disabled={isDownloading}
                  className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 disabled:from-emerald-300 disabled:to-teal-400 text-white font-semibold rounded-2xl transition-all duration-200 hover:shadow-lg flex items-center justify-center gap-2 disabled:cursor-not-allowed"
                >
                  {isDownloading ? (
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  )}
                  {isDownloading ? 'Saving...' : 'Save Image'}
                </button>
              </div>
              {printMsg && <p className="rounded-xl bg-danger-bg px-3 py-2 text-sm text-danger" role="alert">{printMsg}</p>}
              <div className="grid grid-cols-3 gap-2">
                <button
                  disabled={!lastOrder}
                  onClick={async () => {
                    if (!lastOrder) return;
                    const r = await printInvoice(lastOrder, businessSettings, {
                      cash: receipt.paymentMethod === 'CASH' && receipt.cashReceived != null ? { received: receipt.cashReceived, change: receipt.change ?? 0 } : null,
                    });
                    setPrintMsg(r.ok ? null : `Invoice did not print: ${r.error ?? 'printer problem'}`);
                  }}
                  className="c-btn c-btn--primary col-span-1 disabled:opacity-50"
                >
                  Print invoice
                </button>
                <button
                  disabled={!lastOrder}
                  onClick={async () => {
                    if (!lastOrder) return;
                    const r = await printInvoice(lastOrder, businessSettings, { paper: 'A4' });
                    setPrintMsg(r.ok ? null : `Invoice did not print: ${r.error ?? 'printer problem'}`);
                  }}
                  className="c-btn c-btn--ghost disabled:opacity-50"
                >
                  A4 copy
                </button>
                <button
                  disabled={!lastOrder}
                  onClick={async () => {
                    if (!lastOrder) return;
                    const r = await printKitchenTicket(lastOrder, businessSettings);
                    setPrintMsg(r.ok ? null : `Kitchen ticket did not print: ${r.error ?? 'printer problem'}`);
                  }}
                  className="c-btn c-btn--ghost disabled:opacity-50"
                >
                  Kitchen ticket
                </button>
              </div>
              <button
                onClick={() => { setReceipt(null); setPrintMsg(null); }}
                className="c-btn c-btn--ghost w-full"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Option Picker Modal (size / temp / add-ons) ── */}
      {picker && (() => {
        const chosen: { optionId: number; groupName: string; name: string; priceDelta: number }[] = [];
        for (const g of picker.groups) {
          if (g.group.selectionType === 'single') {
            const opt = (g.options ?? []).find((o) => o.id === pickerSingle[g.group.id]);
            if (opt) chosen.push({ optionId: opt.id, groupName: g.group.name, name: opt.name, priceDelta: opt.priceDelta });
          } else {
            for (const opt of (g.options ?? [])) {
              if (pickerMulti.includes(opt.id)) chosen.push({ optionId: opt.id, groupName: g.group.name, name: opt.name, priceDelta: opt.priceDelta });
            }
          }
        }
        const unitTotal = picker.product.price + chosen.reduce((s, x) => s + x.priceDelta, 0);
        return (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => setPicker(null)}
          >
            <div
              className="bg-white rounded-3xl w-full max-w-md max-h-[86vh] flex flex-col overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-5 border-b border-gray-100">
                <h3 className="text-lg font-bold text-gray-900">{picker.product.name}</h3>
                <p className="text-xs text-gray-400">Choose options, then confirm</p>
              </div>

              <div className="p-5 space-y-4 overflow-y-auto flex-1 min-h-0">
                {picker.groups.map((g) => (
                  <div key={g.id} className="rounded-2xl bg-gray-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                      {g.group.name}
                      {g.group.selectionType === 'single' && <span className="text-gray-400 font-normal"> · choose one</span>}
                    </p>
                    {g.group.selectionType === 'single' ? (
                      <div className="flex flex-wrap gap-1.5">
                        {g.options.map((opt) => {
                          const active = pickerSingle[g.group.id] === opt.id;
                          return (
                            <button
                              key={opt.id}
                              onClick={() => setPickerSingle((prev) => ({ ...prev, [g.group.id]: opt.id }))}
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
                        {g.options.map((opt) => {
                          const checked = pickerMulti.includes(opt.id);
                          return (
                            <button
                              key={opt.id}
                              onClick={() =>
                                setPickerMulti((prev) => (checked ? prev.filter((id) => id !== opt.id) : [...prev, opt.id]))
                              }
                              className={`flex w-full items-center justify-between px-3 py-2 rounded-xl border text-sm transition-colors ${
                                checked ? 'border-black bg-white font-medium' : 'border-gray-200 bg-white hover:border-gray-300'
                              }`}
                            >
                              <span className="flex items-center gap-2">
                                <span className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] ${checked ? 'bg-black border-black text-white' : 'border-gray-300 text-transparent'}`}>✓</span>
                                {opt.name}
                              </span>
                              {opt.priceDelta > 0 && <span className="text-gray-500">+₱{opt.priceDelta}</span>}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="p-5 border-t border-gray-100 grid grid-cols-2 gap-3 bg-gray-50">
                <button
                  onClick={() => setPicker(null)}
                  className="py-2.5 rounded-xl bg-white border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const label = chosen.length
                      ? ` (${chosen.map((x) => (x.priceDelta > 0 ? `+${x.name}` : x.name)).join(' · ')})`
                      : undefined;
                    addToCart(picker.product, {
                      optionIds: chosen.map((x) => x.optionId),
                      selectionsLabel: label,
                      unitPrice: unitTotal,
                      categoryId: picker.categoryId,
                    });
                    setPicker(null);
                  }}
                  className="py-2.5 rounded-xl bg-stone-900 hover:bg-stone-700 text-white text-sm font-semibold transition-colors"
                >
                  Add to Order · ₱{unitTotal.toFixed(2)}
                </button>
              </div>
            </div>
          </div>
        );
      })()}


        </>
      )}
    </div>
  );
}
