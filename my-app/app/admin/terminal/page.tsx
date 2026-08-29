'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSocket } from '@/hooks/useSocket';
import { formatPeso } from '@/lib/format';
import { calculateLoyaltyDiscountForItems } from '@/lib/pos-utils';

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
  // Discount (e.g., Student / PWD)
  discountAmount?: number;
  discountReason?: string;
  discountRate?: number;
  loyaltyDiscount?: number;
}

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
}

// VAT Configuration - Adjustable for future rate changes
const VAT_RATE = 0.12; // 12% VAT rate
const VAT_INCLUSIVE_DIVISOR = 112; // Used to extract VAT from VAT-inclusive prices (price * 12/112)

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

  // ── Draggable column widths (persisted per device) ─────────────────────────
  const [colW, setColW] = useState<{ calc: number; summary: number }>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = JSON.parse(localStorage.getItem('terminal-col-widths') || '');
        if (saved?.calc && saved?.summary) return saved;
      } catch (e) {
        console.error('Could not read the saved column widths, using defaults:', e);
      }
    }
    return { calc: 220, summary: 260 };
  });
  const dragCol = useRef<{ target: 'calc' | 'summary'; startX: number; startW: number } | null>(null);

  useEffect(() => {
    function onMove(e: PointerEvent) {
      if (!dragCol.current) return;
      const dx = e.clientX - dragCol.current.startX;
      const { target, startW } = dragCol.current;
      setColW((prev) => {
        const w = target === 'calc'
          ? Math.min(460, Math.max(170, startW + dx))
          : Math.min(520, Math.max(210, startW - dx));
        return { ...prev, [target]: w };
      });
    }
    function onUp() {
      if (!dragCol.current) return;
      dragCol.current = null;
      try {
        localStorage.setItem('terminal-col-widths', JSON.stringify(colW));
      } catch (e) {
        console.error('Could not save the column widths on this device:', e);
      }
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [colW]);

  function startColDrag(target: 'calc' | 'summary', e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragCol.current = { target, startX: e.clientX, startW: colW[target] };
  }
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
  const [overrideStock, setOverrideStock] = useState(false);
  const [cashInput, setCashInput] = useState('');
  const [orderFeedback, setOrderFeedback] = useState<'idle' | 'success'>('idle');
  const [cashReceived, setCashReceived] = useState<number>(0);
  // Student / PWD discount rate (%) applied at the calculator; 0 = no discount
  const [discountRate, setDiscountRate] = useState<number>(0);
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

  const applyCashAmount = () => {
    const cash = parseFloat(cashInput) || 0;
    setCashReceived(cash);
  };

  const cartSubtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const discountAmount = discountRate > 0 ? Math.round(cartSubtotal * discountRate / 100 * 100) / 100 : 0;
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
  const total = Math.max(0, cartSubtotal - discountAmount - loyaltyDiscount);
  const cashValue = cashReceived > 0 ? cashReceived : Number.parseFloat(cashInput || '0') || 0;
  const changeValue = cashValue > 0 ? cashValue - total : 0;
  const hasCashInput = cashInput.trim() !== '' || cashReceived > 0;

  const calculateChange = () => {
    if (!hasCashInput) return null;
    if (changeValue < 0) return `(${Math.abs(changeValue).toFixed(2)})`;
    return changeValue.toFixed(2);
  };

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
        } else {
          // Use defaults if not configured
          setBusinessSettings({
            businessName: 'CaféOS Coffee Shop',
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
           discountRate: discountRate > 0 ? discountRate : undefined,
           discountReason: discountRate > 0 ? 'STUDENT_PWD' : undefined,
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
      
      // Calculate tax breakdown from BIR pricing for RECEIPT DISPLAY ONLY
      // Product price = basePrice + VAT, so VAT = price * VAT_RATE/VAT_INCLUSIVE_DIVISOR
      // Note: This is just for display on the receipt, not for payment calculation
      let vatTaxableTotal = 0;
      let vatExemptTotal = 0;
      cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        if (item.vatExempt) {
          vatExemptTotal += itemTotal;
        } else {
          // VAT included in price = price × (rate / (100 + rate))
          // For 12%: VAT = price × 0.12 / 112 = price × (1 - 1/1.12)
          const vatPortion = itemTotal * (1 - 1 / 1.12);
          vatTaxableTotal += (itemTotal - vatPortion); // Base price before VAT
        }
      });
      const subtotal = vatTaxableTotal + vatExemptTotal;
      const vatAmount = vatTaxableTotal * VAT_RATE; // VAT_RATE of base price
      
      setReceipt({
        orderNumber: data.orderNumber,
        receiptSerial: data.receiptSerial || `INV-${Date.now()}`,
        customerName: customerName.trim() || 'Guest',
        totalAmount: total, // Discounted (VAT-inclusive) amount paid
        items: cart.map(i => ({ name: i.name, quantity: i.quantity, price: i.price, vatExempt: i.vatExempt })),
        tableName: table?.name,
        deliveryAddress: orderType === 'DELIVERY' ? deliveryAddress.trim() : undefined,
        createdAt: new Date().toISOString(),
        paymentMethod,
        orderType,
        subtotal,
        vatTaxableTotal,
        vatExemptTotal,
        vatAmount,
         discountAmount: discountRate > 0 ? discountAmount : 0,
         discountReason: discountRate > 0 ? 'STUDENT_PWD' : undefined,
         discountRate: discountRate > 0 ? discountRate : undefined,
         loyaltyDiscount: loyaltyDiscount > 0 ? loyaltyDiscount : undefined,
        cashReceived: paymentMethod === 'CASH' ? cashReceived : undefined,
        change: paymentMethod === 'CASH' ? cashReceived - total : undefined,
      });
      clearCart();
      setCustomerName('Walk-In');
      setSelectedTable(null);
      setSelectedLoyaltyCard(null);
      setLoyaltyVouchers([]);
      setLoyaltyVoucherCodes([]);
      setPaymentMethod('CASH');
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

  return (
    <div className="flex h-screen w-full bg-[radial-gradient(circle_at_top,_#fffaf4_0%,_#f7f3ee_35%,_#f0ece7_100%)] text-stone-900 overflow-hidden">

      {/* Loading State */}
      {loading && (
        <div className="flex h-full w-full items-center justify-center bg-white">
          <div className="text-center">
            <div className="inline-block w-10 h-10 border-4 border-[var(--pos-accent)] border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-[var(--pos-ink-soft)]">Loading terminal...</p>
          </div>
        </div>
      )}

      {/* Error State with Retry */}
      {!loading && fetchError && (
        <div className="flex h-full w-full items-center justify-center bg-white p-6">
          <div className="text-center max-w-md">
            <div className="text-5xl mb-4">⚠️</div>
            <h2 className="text-xl font-semibold text-[var(--pos-ink)] mb-2">Failed to Load Terminal</h2>
            <p className="text-[var(--pos-ink-soft)] mb-4">{fetchError}</p>
            <p className="text-sm text-[var(--pos-ink-soft)]/70 mb-4">
              This usually happens on first install when the database hasn&apos;t been seeded yet.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2.5 bg-[var(--pos-accent)] text-white font-semibold rounded-[var(--radius-md)] hover:bg-[var(--pos-accent-hover)] transition-colors"
            >
              Retry (Reload)
            </button>
          </div>
        </div>
      )}

      {/* Main Terminal UI - only show when loaded and no error */}
      {!loading && !fetchError && (
        <>

      {/* ── COLUMN 1: Calculator (220px) ──────────────────────────────── */}
      <div
        className="flex h-full flex-shrink-0 flex-col overflow-hidden border-r border-[var(--pos-border)] bg-[var(--pos-paper)] relative"
        style={{ width: colW.calc, minWidth: 170, maxWidth: 460 }}
      >
        {/* Drag handle (left edge) */}
        <div
          onPointerDown={(e) => startColDrag('calc', e)}
          className="absolute left-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-[var(--pos-accent)]/40"
          title="Drag to resize"
        />
        {/* Cash Calculator */}
        <div className="border-b border-[var(--pos-border)] bg-[var(--pos-surface)] p-2.5">
          <div className="mb-2 rounded-[var(--radius-lg)] bg-[var(--pos-ink)] p-2.5 text-white shadow-[var(--shadow-modal)]">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] uppercase tracking-[0.12em] text-stone-300">Total</span>
              <span className="text-sm font-semibold tracking-[-0.04em] text-white" style={{ fontFamily: '"SF Pro Display", "SF Pro Text", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>{formatPeso(total)}</span>
            </div>
            {discountRate > 0 && (
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] uppercase tracking-[0.12em] text-stone-300">Discount ({discountRate}%)</span>
                <span className="text-sm font-semibold tracking-[-0.04em] text-[#d7f3d7]" style={{ fontFamily: '"SF Pro Display", "SF Pro Text", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>−{formatPeso(discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] uppercase tracking-[0.12em] text-stone-300">Cash</span>
              <span className={`text-sm font-semibold tracking-[-0.04em] ${cashValue >= total && cashValue > 0 ? 'text-[var(--pos-accent-soft)]' : 'text-white'}`} style={{ fontFamily: '"SF Pro Display", "SF Pro Text", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
                {hasCashInput ? formatPeso(cashValue) : '—'}
              </span>
            </div>
            <div className="flex justify-between items-center border-t border-white/10 pt-1.5">
              <span className="text-[10px] uppercase tracking-[0.12em] text-stone-300">Change</span>
              <span className={`text-sm font-semibold tracking-[-0.04em] ${calculateChange() !== null && Number(calculateChange()) >= 0 ? 'text-[#d7f3d7]' : 'text-[#f7d2ce]'}`} style={{ fontFamily: '"SF Pro Display", "SF Pro Text", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
                {calculateChange() !== null ? `₱${calculateChange()}` : '—'}
              </span>
            </div>
            {loyaltyDiscount > 0 && (
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] uppercase tracking-[0.12em] text-stone-300">Loyalty</span>
                <span className="text-sm font-semibold tracking-[-0.04em] text-[#d7f3d7]" style={{ fontFamily: '"SF Pro Display", "SF Pro Text", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>−{formatPeso(loyaltyDiscount)}</span>
              </div>
            )}
          </div>

          {typeof businessSettings?.studentPwdDiscountRate === 'number' && (
            <button
              onClick={() => setDiscountRate(discountRate > 0 ? 0 : (businessSettings?.studentPwdDiscountRate ?? 20))}
              className={`mb-1.5 w-full rounded-[var(--radius-md)] py-1.5 text-[10px] font-semibold tracking-[0.04em] transition ${
                discountRate > 0
                  ? 'bg-[var(--pos-accent)] text-white'
                  : 'border border-[var(--pos-border)] bg-[var(--pos-surface)] text-[var(--pos-ink-soft)] hover:bg-[var(--pos-muted)]'
              }`}
              style={{ fontFamily: '"SF Pro Display", "SF Pro Text", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}
            >
              {discountRate > 0
                ? `Student/PWD −${discountRate}%  (−${formatPeso(discountAmount)})`
                : `Apply Student / PWD −${businessSettings?.studentPwdDiscountRate ?? 20}%`}
            </button>
          )}

          <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--pos-ink-soft)]">Enter cash tendered</div>
          <div className="grid grid-cols-4 gap-1 mb-1.5">{[100,200,500,1000].map(a=>(<button key={a} onClick={()=>setCashInput(String(a))} className="rounded-[var(--radius-md)] border border-[var(--pos-border)] bg-[var(--pos-surface)] py-1.5 text-[10px] font-semibold tracking-[-0.04em] text-[var(--pos-ink)] hover:bg-[var(--pos-muted)]" style={{ fontFamily: '"SF Pro Display", "SF Pro Text", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>₱{a}</button>))}</div>
          <div className="grid grid-cols-3 gap-1 mb-1.5">{['1','2','3','4','5','6','7','8','9'].map(k=>(<button key={k} onClick={()=>handleCashInput(k)} className="min-h-[44px] rounded-[var(--radius-md)] border border-[var(--pos-border)] bg-[var(--pos-surface)] text-sm font-semibold tracking-[-0.04em] text-[var(--pos-ink)] hover:bg-[var(--pos-muted)]" style={{ fontFamily: '"SF Pro Display", "SF Pro Text", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>{k}</button>))}</div>
          <div className="grid grid-cols-3 gap-1 mb-1.5">
            <button onClick={()=>handleCashInput('00')} className="min-h-[44px] rounded-[var(--radius-md)] border border-[var(--pos-border)] bg-[var(--pos-surface)] text-sm font-semibold tracking-[-0.04em] text-[var(--pos-ink)] hover:bg-[var(--pos-muted)]" style={{ fontFamily: '"SF Pro Display", "SF Pro Text", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>00</button>
            <button onClick={()=>handleCashInput('0')} className="min-h-[44px] rounded-[var(--radius-md)] border border-[var(--pos-border)] bg-[var(--pos-surface)] text-sm font-semibold tracking-[-0.04em] text-[var(--pos-ink)] hover:bg-[var(--pos-muted)]" style={{ fontFamily: '"SF Pro Display", "SF Pro Text", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>0</button>
            <button onClick={()=>handleCashInput('clear')} className="min-h-[44px] rounded-[var(--radius-md)] border border-[var(--pos-danger-soft)] bg-[var(--pos-danger-soft)] text-sm font-semibold tracking-[-0.04em] text-[var(--pos-danger)]" style={{ fontFamily: '"SF Pro Display", "SF Pro Text", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>C</button>
          </div>
          <button onClick={applyCashAmount} disabled={!cashInput || Number.parseFloat(cashInput) < total} className="w-full rounded-[var(--radius-md)] bg-[var(--pos-accent)] py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[var(--pos-accent-hover)] disabled:cursor-not-allowed disabled:bg-[var(--pos-muted)] disabled:text-[var(--pos-ink-soft)]">Apply</button>
        </div>

        {/* Order Type / Table / Address */}
        <div className="border-b border-[var(--pos-border)] p-2.5">
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--pos-ink-soft)]">Order type</label>
          <div className="grid grid-cols-3 gap-1 mb-1.5">
            {['DINE_IN', 'TAKEOUT', 'DELIVERY'].map((type) => (
              <button
                key={type}
                onClick={() => {
                  setOrderType(type);
                  if (type !== 'DINE_IN') setSelectedTable(null);
                }}
                className={`min-h-[32px] rounded-[var(--radius-sm)] border px-1.5 text-[6px] font-semibold transition ${
                  orderType === type
                    ? 'border-[var(--pos-accent)] bg-[var(--pos-accent)] text-white'
                    : 'border-[var(--pos-border)] bg-[var(--pos-surface)] text-[var(--pos-ink-soft)] hover:bg-[var(--pos-muted)]'
                }`}
              >
                {type === 'DINE_IN' ? 'Dine-in' : type === 'TAKEOUT' ? 'Takeout' : 'Delivery'}
              </button>
            ))}
          </div>

          {orderType === 'DINE_IN' && (
            <div className="mt-2">
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--pos-ink-soft)]">Table #</label>
              <select
                value={selectedTable ?? ''}
                onChange={e => setSelectedTable(e.target.value ? Number(e.target.value) : null)}
                className="w-full rounded-[var(--radius-md)] border border-[var(--pos-border)] bg-[var(--pos-surface)] px-2.5 py-2 text-xs text-[var(--pos-ink)] shadow-sm outline-none transition focus:border-[var(--pos-accent)] focus:ring-2 focus:ring-[var(--pos-accent)]/20"
              >
                <option value="">Select table</option>
                {tables.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          )}

          {orderType === 'DELIVERY' && (
            <div className="mt-2">
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--pos-ink-soft)]">Address</label>
              <input
                type="text"
                value={deliveryAddress}
                onChange={e => setDeliveryAddress(e.target.value)}
                placeholder="House number, street, landmark"
                className="w-full rounded-[var(--radius-md)] border border-[var(--pos-border)] bg-[var(--pos-surface)] px-2.5 py-2 text-xs text-[var(--pos-ink)] placeholder:text-[var(--pos-ink-soft)]/60 shadow-sm outline-none transition focus:border-[var(--pos-accent)] focus:ring-2 focus:ring-[var(--pos-accent)]/20"
              />
            </div>
          )}
        </div>

        {/* Customer Input */}
        <div className="p-2 border-b border-gray-100">
          <label className="text-gray-500 text-[10px] font-semibold block mb-1">Customer</label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={customerName}
              onChange={e => setCustomerName(e.target.value)}
              placeholder="Walk-in"
              className="flex-1 rounded-[var(--radius-md)] border border-[var(--pos-border)] bg-[var(--pos-surface)] px-2.5 py-2 text-xs text-[var(--pos-ink)] shadow-sm outline-none transition placeholder:text-[var(--pos-ink-soft)]/60 focus:border-[var(--pos-accent)] focus:ring-2 focus:ring-[var(--pos-accent)]/20"
            />
            {businessSettings?.loyaltyEnabled && (
              <button
                type="button"
                onClick={openLoyaltyPicker}
                className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-md)] border border-[var(--pos-border)] bg-[var(--pos-surface)] text-xs font-semibold text-[var(--pos-ink)] hover:bg-[var(--pos-muted)]"
                title="Select loyalty member"
              >
                💳
              </button>
            )}
          </div>
          {selectedLoyaltyCard && (
            <div className="mt-1.5 flex items-center justify-between rounded-[var(--radius-sm)] bg-[var(--pos-accent-soft)] px-2 py-1">
              <span className="text-[9px] font-semibold text-[var(--pos-accent)]">
                {selectedLoyaltyCard.customerName}
              </span>
              {loyaltyVoucherCodes.length > 0 && (
                <span className="text-[8px] font-bold text-green-700">
                  🎁 {loyaltyVoucherCodes.length} auto-applied
                </span>
              )}
            </div>
          )}
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
                            ☕ {card.coffeesCompleted} coffees • 🎁 {card.rewardsAvailable} rewards
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
      </div>

      {/* ── COLUMN 2: Order Summary (260px) ──────────────────────────────── */}
      <div
        className="flex h-full flex-shrink-0 flex-col overflow-hidden border-r border-[var(--pos-border)] bg-[var(--pos-surface)] relative"
        style={{ width: colW.summary, minWidth: 210, maxWidth: 520 }}
      >
        {/* Drag handle (left edge) — drag right edge effect: narrows when pulled left */}
        <div
          onPointerDown={(e) => startColDrag('summary', e)}
          className="absolute left-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-[var(--pos-accent)]/40"
          title="Drag to resize"
        />
        {/* ── COLUMN 2: Order Summary ── */}
        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-2">
          {cart.length === 0 ? (
            <div className="py-6 text-center text-xs text-[var(--pos-ink-soft)]">No items in cart</div>
          ) : (
            <div className="space-y-1">
              {cart.map(item => (
                <div key={item.key ?? item.productId} className="rounded-[var(--radius-sm)] border border-[var(--pos-border)] bg-[var(--pos-paper)] p-1.5">
                  <div className="flex items-center gap-1">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => updateCartItemQuantity(item.key ?? item.productId, -1)}
                        className="flex h-4 w-4 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--pos-border)] bg-[var(--pos-surface)] text-[10px] font-bold text-[var(--pos-ink)] hover:bg-[var(--pos-muted)]"
                      >
                        -
                      </button>
                      <button
                        onClick={() => updateCartItemQuantity(item.key ?? item.productId, 1)}
                        className="flex h-4 w-4 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--pos-border)] bg-[var(--pos-surface)] text-[10px] font-bold text-[var(--pos-ink)] hover:bg-[var(--pos-muted)]"
                      >
                        +
                      </button>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-[10px] font-medium text-[var(--pos-ink)]">{item.name}</p>
                      {item.selectionsLabel && (
                        <p className="break-words text-[9px] text-[var(--pos-accent)]">{item.selectionsLabel}</p>
                      )}
                      <div className="mt-0.5 flex items-center justify-between text-[9px] text-[var(--pos-ink-soft)]">
                        <span>Qty {item.quantity}</span>
                        <span className="font-semibold text-[var(--pos-ink)]">{formatPeso(item.price * item.quantity)}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => removeFromCart(item.key ?? item.productId)}
                      className="flex h-4 w-4 items-center justify-center rounded-[var(--radius-sm)] text-[10px] text-[var(--pos-ink-soft)] hover:bg-[var(--pos-danger-soft)] hover:text-[var(--pos-danger)]"
                    >
                      ✕
                    </button>
                  </div>

                  {businessSettings?.loyaltyEnabled && (
                    <div className="mt-1.5 rounded-[var(--radius-sm)] border border-[var(--pos-border)] bg-white/60 p-1.5">
                      <div className="mb-1 flex items-center justify-between gap-1">
                        <span className="text-[8px] font-semibold uppercase tracking-[0.12em] text-[var(--pos-ink-soft)]">Loyalty count</span>
                        <button
                          type="button"
                          onClick={() => openItemLoyaltyPicker(item.productId)}
                          className="rounded-full border border-[var(--pos-border)] bg-[var(--pos-surface)] px-0.5 py-0 text-[5px] font-semibold uppercase tracking-[0.02em] text-[var(--pos-ink-soft)] hover:bg-[var(--pos-muted)]"
                        >
                          + add member
                        </button>
                      </div>

                      {(item.loyaltyAssignments ?? []).length === 0 ? (
                        <div className="text-[8px] text-[var(--pos-ink-soft)]">No loyalty member assigned yet.</div>
                      ) : (
                        <div className="space-y-1">
                          {(item.loyaltyAssignments ?? []).map((assignment, idx) => (
                            <div key={`${item.productId}-${idx}`} className="flex items-center gap-1">
                              <select
                                value={assignment.customerName}
                                onChange={(e) => updateLoyaltyAssignment(item.productId, idx, 'customerName', e.target.value)}
                                className="min-w-0 flex-1 rounded-[var(--radius-sm)] border border-[var(--pos-border)] bg-[var(--pos-surface)] px-1 py-0.5 text-[8px] text-[var(--pos-ink)] outline-none focus:border-[var(--pos-accent)]"
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
                                className="w-8 rounded-[var(--radius-sm)] border border-[var(--pos-border)] bg-[var(--pos-surface)] px-0.5 py-0.5 text-center text-[8px] text-[var(--pos-ink)] outline-none focus:border-[var(--pos-accent)]"
                              />
                              <button
                                type="button"
                                onClick={() => removeLoyaltyAssignment(item.productId, idx)}
                                className="flex h-4 w-4 items-center justify-center rounded-[var(--radius-sm)] text-[10px] text-[var(--pos-ink-soft)] hover:bg-[var(--pos-danger-soft)] hover:text-[var(--pos-danger)]"
                                aria-label="Remove loyalty assignment"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Order Details */}
        <div className="space-y-3 border-t border-[var(--pos-border)] bg-[var(--pos-surface)] p-3">
          {error && <div className="rounded-[var(--radius-md)] border border-[var(--pos-danger)] bg-[var(--pos-danger-soft)] p-2 text-xs text-[var(--pos-danger)]">{error}</div>}

          {warnings.length > 0 && (
            <div className="rounded-[var(--radius-md)] border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800">
              {warnings.map((warning) => (
                <p key={warning} className="flex items-start gap-1.5">
                  <span aria-hidden>⚠️</span>
                  <span>{warning}</span>
                </p>
              ))}
              <button
                type="button"
                onClick={() => setWarnings([])}
                className="mt-1 font-semibold underline"
              >
                Dismiss
              </button>
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-[var(--pos-ink-soft)]">{itemCount} item{itemCount !== 1 ? 's' : ''}</span>
            <span className="text-2xl font-semibold text-[var(--pos-ink)]" style={{ fontFamily: 'Georgia, serif' }}>{formatPeso(total)}</span>
          </div>

          {/* Payment Method */}
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--pos-ink-soft)]">Payment</label>
            <div className="grid grid-cols-3 gap-1.5">
              {['CASH', 'GCASH', 'PAYMAYA'].map(pm => (
                <button
                  key={pm}
                  onClick={() => setPaymentMethod(pm)}
                  className={`min-h-[44px] rounded-[var(--radius-md)] border text-[10px] font-semibold transition ${
                    paymentMethod === pm
                      ? 'border-[var(--pos-accent)] bg-[var(--pos-accent)] text-white'
                      : 'border-[var(--pos-border)] bg-[var(--pos-surface)] text-[var(--pos-ink-soft)] hover:bg-[var(--pos-muted)]'
                  }`}
                >
                  {pm === 'CASH' ? 'Cash' : pm === 'GCASH' ? 'G-Cash' : 'PayMaya'}
                </button>
              ))}
            </div>
          </div>

          {/* Auto Print Toggle */}
          <div className="flex items-center justify-between py-1">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--pos-ink-soft)]">Auto-print</span>
            <button
              onClick={() => setAutoPrint(!autoPrint)}
              className={`relative h-6 w-11 rounded-full transition-colors ${autoPrint ? 'bg-[var(--pos-accent)]' : 'bg-[var(--pos-muted)]'}`}
            >
              <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${autoPrint ? 'translate-x-5' : 'left-1'}`} />
            </button>
          </div>

          {/* Sell-out override Toggle */}
          <div className="flex items-center justify-between py-1">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--pos-ink-soft)]">Sell sold-out items</span>
            <button
              onClick={() => setOverrideStock(!overrideStock)}
              className={`relative h-6 w-11 rounded-full transition-colors ${overrideStock ? 'bg-[var(--pos-accent)]' : 'bg-[var(--pos-muted)]'}`}
            >
              <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${overrideStock ? 'translate-x-5' : 'left-1'}`} />
            </button>
          </div>

          {orderFeedback === 'success' && (
            <div className="rounded-[var(--radius-md)] border border-[var(--pos-accent)] bg-[var(--pos-accent-soft)] px-2.5 py-2 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--pos-accent)]">
              Order placed
            </div>
          )}

          <button
            onClick={placeOrder}
            disabled={placing || cart.length === 0}
            className="w-full rounded-[var(--radius-md)] bg-[var(--pos-accent)] py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--pos-accent-hover)] disabled:cursor-not-allowed disabled:bg-[var(--pos-muted)] disabled:text-[var(--pos-ink-soft)]"
          >
            {placing ? 'Placing order…' : orderFeedback === 'success' ? '✅ Place Order' : '✅ Place Order'}
          </button>

          {cart.length > 0 && (
            <button onClick={clearCart} className="w-full rounded-[var(--radius-md)] border border-[var(--pos-border)] bg-[var(--pos-surface)] py-2.5 text-sm font-medium text-[var(--pos-ink-soft)] transition hover:border-[var(--pos-danger)] hover:text-[var(--pos-danger)]">
              🗑 Clear Cart
            </button>
          )}
        </div>
      </div>

      {/* ── COLUMN 3: Products ──────────────────────────────── */}
      <div className="flex h-full flex-1 flex-col overflow-y-auto overflow-x-visible bg-[radial-gradient(circle_at_top,_#fffefc_0%,_#f5f1ea_45%,_#efeae2_100%)] min-w-0">

        {/* Search + Category Tabs */}
        <div className="sticky top-0 z-20 border-b border-[var(--pos-border)] bg-white/90 px-4 pt-3 pb-2 shadow-[0_8px_22px_rgba(30,24,20,0.04)] backdrop-blur-sm">
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search products..."
            className="mb-3 w-full rounded-[var(--radius-lg)] border border-[var(--pos-border)] bg-[var(--pos-paper)] px-3 py-2.5 text-sm text-[var(--pos-ink)] placeholder:text-[var(--pos-ink-soft)]/70 shadow-sm outline-none transition focus:border-[var(--pos-accent)] focus:ring-2 focus:ring-[var(--pos-accent)]/15"
          />
          {!search && (
            <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide -mx-4 px-4">
              {/* All Products Tab */}
              <button
                onClick={() => setActiveCategory('all')}
                className={`flex-shrink-0 flex items-center gap-1 rounded-[var(--radius-sm)] px-1.5 py-1 text-[10px] font-medium transition-all ${
                  activeCategory === 'all'
                    ? 'bg-[var(--pos-accent-soft)] text-[var(--pos-accent)] shadow-sm ring-1 ring-[var(--pos-accent)]/15'
                    : 'bg-[var(--pos-muted)] text-[var(--pos-ink-soft)] hover:bg-[var(--pos-border)]'
                }`}
              >
                <CategoryGlyph name="all" active={activeCategory === 'all'} className="h-3 w-3" />
                <span>All</span>
                <span className="text-[9px] opacity-75">({allProducts.length})</span>
              </button>
              {/* Category Tabs */}
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`flex-shrink-0 flex items-center gap-1 rounded-[var(--radius-sm)] px-1.5 py-1 text-[10px] font-medium transition-all ${
                    activeCategory === cat.id
                      ? 'bg-[var(--pos-accent-soft)] text-[var(--pos-accent)] shadow-sm ring-1 ring-[var(--pos-accent)]/15'
                      : 'bg-[var(--pos-muted)] text-[var(--pos-ink-soft)] hover:bg-[var(--pos-border)]'
                  }`}
                >
                  <CategoryGlyph name={cat.name} active={activeCategory === cat.id} className="h-3 w-3" />
                  <span>{cat.name}</span>
                  <span className="text-[9px] opacity-75">({cat.products.length})</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Products Grid */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-3">
          {search && (
            <p className="mb-3 text-xs font-medium text-[var(--pos-ink-soft)]">{displayedProducts.length} result{displayedProducts.length !== 1 ? 's' : ''} for &quot;{search}&quot;</p>
          )}
          <div className="grid w-full grid-cols-4 gap-3">
            {displayedProducts.map(product => {
              const outOfStock = product.inventory && product.inventory.quantity === 0;
              const cartItem = cart.find(i => i.productId === product.id);
              const catIcon = categories.find(c => c.products.some(p => p.id === product.id))?.icon;
              const blocked = outOfStock && !overrideStock;
              return (
                <button
                  key={product.id}
                  onClick={() => !blocked && handleProductClick(product)}
                  disabled={blocked}
                  className={`relative flex w-full min-w-0 min-h-[320px] flex-col items-center justify-between rounded-[var(--radius-lg)] border bg-white p-4 text-center shadow-sm transition-all overflow-hidden ${
                    blocked
                      ? 'cursor-not-allowed border-gray-100 opacity-40'
                      : cartItem
                        ? 'border-[var(--pos-accent)] bg-[var(--pos-accent-soft)] shadow-md shadow-[rgba(74,93,58,0.08)]'
                        : 'border-[var(--pos-border)] hover:border-[var(--pos-accent)] hover:shadow-md active:scale-[0.97]'
                  }`}
                >
                  {cartItem && (
                    <span className="absolute right-2 top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--pos-accent)] text-[10px] font-bold text-white">
                      {cartItem.quantity}
                    </span>
                  )}
                  <div className="mb-3 flex h-40 w-40 items-center justify-center overflow-hidden rounded-[var(--radius-md)] border border-[var(--pos-border)] bg-[var(--pos-muted)] text-[var(--pos-ink-soft)]">
                    {isImageUrl(product.imageUrl)
                      ? <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
                      : <CategoryGlyph name={categories.find(c => c.products.some(p => p.id === product.id))?.name ?? 'all'} active={false} className="h-8 w-8" />}
                  </div>
                  <p className="line-clamp-2 break-words text-sm font-semibold leading-tight text-[var(--pos-ink)]">{product.name}</p>
                  <p className="mt-2 text-base font-bold text-[var(--pos-ink)]">₱{product.price.toFixed(2)}</p>
                  {outOfStock && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/60">
                      <span className={`text-xs font-bold ${overrideStock ? 'text-[var(--pos-accent)]' : 'text-gray-400'}`}>{overrideStock ? 'Sell anyway' : 'Sold Out'}</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {displayedProducts.length === 0 && (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <span className="text-5xl mb-3">🔍</span>
              <p className="text-sm font-medium">No products found</p>
            </div>
          )}
        </div>
      </div>

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
              <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600">Official Receipt</p>
              <h2 className="text-lg font-bold text-gray-900 mt-1">{businessSettings?.businessName || 'CaféOS Coffee Shop'}</h2>
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
                {receipt.vatAmount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">VAT (12%):</span>
                    <span className="text-gray-800">₱{receipt.vatAmount.toFixed(2)}</span>
                  </div>
                )}
                {(receipt.discountAmount ?? 0) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">{receipt.discountReason || 'Discount'}{receipt.discountRate ? ` (${receipt.discountRate}%)` : ''}:</span>
                    <span className="text-gray-800">−₱{(receipt.discountAmount ?? 0).toFixed(2)}</span>
                  </div>
                )}
                {(receipt.loyaltyDiscount ?? 0) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Loyalty Reward:</span>
                    <span className="text-gray-800">−₱{(receipt.loyaltyDiscount ?? 0).toFixed(2)}</span>
                  </div>
                )}
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
                    <p>VAT Amount (12%): ₱{receipt.vatAmount.toFixed(2)}</p>
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
              {/* Thermal Print Options */}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const printWindow = window.open('', '_blank', 'width=350,height=600');
                    if (printWindow) {
                      const vatRate = businessSettings?.vatRate || 12;
                      const vatAmount = receipt.vatAmount;
                      printWindow.document.write(`
                        <!DOCTYPE html>
                        <html>
                        <head>
                          <title>Receipt #${escapeHtml(receipt.orderNumber)}</title>
                          <style>
                            @page { margin: 0; size: 80mm auto; }
                            @media print {
                              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                            }
                            body {
                              font-family: 'Courier New', monospace;
                              width: 72mm;
                              margin: 0 auto;
                              padding: 5mm;
                              font-size: 11px;
                              line-height: 1.3;
                            }
                            .header { text-align: center; border-bottom: 1px dashed #666; padding-bottom: 6px; margin-bottom: 6px; }
                            .header h2 { margin: 0; font-size: 14px; }
                            .header p { margin: 2px 0; font-size: 9px; color: #666; }
                            .info { margin-bottom: 8px; }
                            .info-row { display: flex; justify-content: space-between; margin: 2px 0; font-size: 10px; }
                            .items { border-bottom: 1px dashed #666; padding-bottom: 8px; margin-bottom: 8px; }
                            .item { display: flex; justify-content: space-between; margin: 3px 0; }
                            .item-name { flex: 1; }
                            .item-qty { color: #666; font-size: 10px; }
                            .totals { margin-bottom: 8px; }
                            .totals .row { display: flex; justify-content: space-between; }
                            .total-row { font-weight: bold; font-size: 14px; border-top: 1px dashed #666; padding-top: 5px; margin-top: 5px; }
                            .footer { text-align: center; font-size: 9px; color: #666; margin-top: 10px; }
                            .vat-breakdown { font-size: 8px; color: #888; border-top: 1px dashed #ccc; padding-top: 5px; margin-top: 8px; }
                          </style>
                        </head>
                        <body>
                          <div class="header">
                            <p style="font-weight:bold;color:#666;font-size:9px;">OFFICIAL RECEIPT</p>
                            <h2>${businessSettings?.businessName || 'CaféOS Coffee Shop'}</h2>
                            ${businessSettings?.businessAddress ? `<p>${businessSettings.businessAddress}</p>` : ''}
                            ${(businessSettings?.tin || businessSettings?.branchCode) ? `<p>TIN: ${businessSettings.tin || ''}${businessSettings?.branchCode ? '-' + businessSettings.branchCode : ''}</p>` : ''}
        
                            <p>#${escapeHtml(receipt.orderNumber)}</p>
                          </div>
                          <div class="info">
                            <div class="info-row"><span>Date:</span><span>${new Date(receipt.createdAt).toLocaleDateString()}</span></div>
                            <div class="info-row"><span>Time:</span><span>${new Date(receipt.createdAt).toLocaleTimeString()}</span></div>
                            ${receipt.customerName ? `<div class="info-row"><span>Customer:</span><span>${escapeHtml(receipt.customerName)}</span></div>` : ''}
                            ${receipt.tableName ? `<div class="info-row"><span>Table:</span><span>${escapeHtml(receipt.tableName)}</span></div>` : ''}
                            ${receipt.orderType ? `<div class="info-row"><span>Order:</span><span>${receipt.orderType === 'DINE_IN' ? 'Dine-in' : receipt.orderType === 'TAKEOUT' ? 'Takeout' : 'Delivery'}</span></div>` : ''}
                            ${receipt.deliveryAddress ? `<div class="info-row"><span>Deliver to:</span><span>${escapeHtml(receipt.deliveryAddress)}</span></div>` : ''}
                            <div class="info-row"><span>Payment:</span><span>${receipt.paymentMethod}</span></div>
                          </div>
                          <div class="items">
                            ${receipt.items.map(item => `
                              <div class="item">
                                <span class="item-name">${item.quantity}x ${escapeHtml(item.name)}</span>
                                <span>₱${(item.price * item.quantity).toFixed(2)}</span>
                              </div>
                            `).join('')}
                          </div>
                          <div class="totals">
                            <div class="row"><span>Subtotal:</span><span>₱${receipt.subtotal.toFixed(2)}</span></div>
                             <div class="row"><span>VAT (${vatRate}%):</span><span>₱${receipt.vatAmount.toFixed(2)}</span></div>
                              ${(receipt.discountAmount ?? 0) > 0 ? `<div class="row"><span>${escapeHtml(receipt.discountReason || 'Discount')}${receipt.discountRate ? ` (${receipt.discountRate}%)` : ''}:</span><span>−₱${(receipt.discountAmount ?? 0).toFixed(2)}</span></div>` : ''}
                              ${(receipt.loyaltyDiscount ?? 0) > 0 ? `<div class="row"><span>Loyalty Reward:</span><span>−₱${(receipt.loyaltyDiscount ?? 0).toFixed(2)}</span></div>` : ''}
                              <div class="row total-row"><span>TOTAL:</span><span>₱${receipt.totalAmount.toFixed(2)}</span></div>
                            ${receipt.paymentMethod === 'CASH' && receipt.cashReceived !== undefined ? `
                              <div class="row"><span>Cash:</span><span>₱${receipt.cashReceived.toFixed(2)}</span></div>
                              ${receipt.change !== undefined && receipt.change > 0 ? `<div class="row"><span>Change:</span><span>₱${receipt.change.toFixed(2)}</span></div>` : ''}
                            ` : ''}
                          </div>
                          <div class="vat-breakdown">
                            <strong>VAT Breakdown:</strong><br/>
                            Total Sales: ₱${receipt.totalAmount.toFixed(2)}<br/>
                            VATable: ₱${receipt.vatTaxableTotal.toFixed(2)}<br/>
                            VAT: ₱${receipt.vatAmount.toFixed(2)}
                          </div>
                          <div class="footer">
                            ${escapeHtml(businessSettings?.footerMessage || 'Thank you for your visit!')}
                          </div>
                        </body>
                        </html>
                      `);
                      printWindow.document.close();
                      printWindow.focus();
                      setTimeout(() => { printWindow.print(); printWindow.close(); }, 250);
                    }
                  }}
                  className="flex-1 py-3 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-2xl transition-all duration-200 hover:shadow-lg flex items-center justify-center gap-2"
                >
                  🖨️ Thermal
                </button>
              </div>
              <button
                onClick={() => {
                  if (autoPrint) {
                    // Open thermal print for auto-print
                    const printWindow = window.open('', '_blank', 'width=350,height=600');
                    if (printWindow) {
                      const vatRate = businessSettings?.vatRate || 12;
                      printWindow.document.write(`
                        <!DOCTYPE html>
                        <html>
                        <head>
                          <title>Receipt #${escapeHtml(receipt.orderNumber)}</title>
                          <style>
                            @page { margin: 0; size: 80mm auto; }
                            body { font-family: 'Courier New', monospace; width: 72mm; margin: 0 auto; padding: 5mm; font-size: 11px; line-height: 1.3; }
                            .header { text-align: center; border-bottom: 1px dashed #666; padding-bottom: 6px; margin-bottom: 6px; }
                            .header h2 { margin: 0; font-size: 14px; }
                            .header p { margin: 2px 0; font-size: 9px; color: #666; }
                            .info { margin-bottom: 8px; }
                            .info-row { display: flex; justify-content: space-between; margin: 2px 0; font-size: 10px; }
                            .items { border-bottom: 1px dashed #666; padding-bottom: 8px; margin-bottom: 8px; }
                            .item { display: flex; justify-content: space-between; margin: 3px 0; }
                            .totals { margin-bottom: 8px; }
                            .totals .row { display: flex; justify-content: space-between; }
                            .total-row { font-weight: bold; font-size: 14px; border-top: 1px dashed #666; padding-top: 5px; margin-top: 5px; }
                            .footer { text-align: center; font-size: 9px; color: #666; margin-top: 10px; }
                            .vat-breakdown { font-size: 8px; color: #888; border-top: 1px dashed #ccc; padding-top: 5px; margin-top: 8px; }
                          </style>
                        </head>
                        <body>
                          <div class="header">
                            <p style="font-weight:bold;color:#666;font-size:9px;">OFFICIAL RECEIPT</p>
                            <h2>${escapeHtml(businessSettings?.businessName || 'CaféOS Coffee Shop')}</h2>
                            ${businessSettings?.businessAddress ? `<p>${escapeHtml(businessSettings.businessAddress)}</p>` : ''}
                            ${(businessSettings?.tin || businessSettings?.branchCode) ? `<p>TIN: ${escapeHtml(businessSettings.tin || '')}${businessSettings?.branchCode ? '-' + escapeHtml(businessSettings.branchCode) : ''}</p>` : ''}
                            <p>#${escapeHtml(receipt.orderNumber)}</p>
                          </div>
                          <div class="info">
                            <div class="info-row"><span>Date:</span><span>${new Date(receipt.createdAt).toLocaleDateString()}</span></div>
                            <div class="info-row"><span>Time:</span><span>${new Date(receipt.createdAt).toLocaleTimeString()}</span></div>
                            ${receipt.customerName ? `<div class="info-row"><span>Customer:</span><span>${escapeHtml(receipt.customerName)}</span></div>` : ''}
                            ${receipt.tableName ? `<div class="info-row"><span>Table:</span><span>${escapeHtml(receipt.tableName)}</span></div>` : ''}
                            ${receipt.orderType ? `<div class="info-row"><span>Order:</span><span>${receipt.orderType === 'DINE_IN' ? 'Dine-in' : receipt.orderType === 'TAKEOUT' ? 'Takeout' : 'Delivery'}</span></div>` : ''}
                            ${receipt.deliveryAddress ? `<div class="info-row"><span>Deliver to:</span><span>${escapeHtml(receipt.deliveryAddress)}</span></div>` : ''}
                            <div class="info-row"><span>Payment:</span><span>${receipt.paymentMethod}</span></div>
                          </div>
                          <div class="items">
                            ${receipt.items.map(item => `<div class="item"><span>${item.quantity}x ${escapeHtml(item.name)}</span><span>₱${(item.price * item.quantity).toFixed(2)}</span></div>`).join('')}
                          </div>
                          <div class="totals">
                            <div class="row"><span>Subtotal:</span><span>₱${receipt.subtotal.toFixed(2)}</span></div>
                             <div class="row"><span>VAT (${vatRate}%):</span><span>₱${receipt.vatAmount.toFixed(2)}</span></div>
                              ${(receipt.discountAmount ?? 0) > 0 ? `<div class="row"><span>${escapeHtml(receipt.discountReason || 'Discount')}${receipt.discountRate ? ` (${receipt.discountRate}%)` : ''}:</span><span>−₱${(receipt.discountAmount ?? 0).toFixed(2)}</span></div>` : ''}
                              ${(receipt.loyaltyDiscount ?? 0) > 0 ? `<div class="row"><span>Loyalty Reward:</span><span>−₱${(receipt.loyaltyDiscount ?? 0).toFixed(2)}</span></div>` : ''}
                              <div class="row total-row"><span>TOTAL:</span><span>₱${receipt.totalAmount.toFixed(2)}</span></div>
                            ${receipt.paymentMethod === 'CASH' && receipt.cashReceived !== undefined ? `
                              <div class="row"><span>Cash:</span><span>₱${receipt.cashReceived.toFixed(2)}</span></div>
                              ${receipt.change !== undefined && receipt.change > 0 ? `<div class="row"><span>Change:</span><span>₱${receipt.change.toFixed(2)}</span></div>` : ''}
                            ` : ''}
                          </div>
                          <div class="footer">${escapeHtml(businessSettings?.footerMessage || 'Thank you for your visit!')}</div>
                        </body>
                        </html>
                      `);
                      printWindow.document.close();
                      printWindow.focus();
                      setTimeout(() => { printWindow.print(); printWindow.close(); }, 250);
                    }
                  }
                  setReceipt(null);
                }}
                className="w-full py-3 bg-gray-900 hover:bg-gray-800 text-white font-semibold rounded-2xl transition-all duration-200 hover:shadow-lg"
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
