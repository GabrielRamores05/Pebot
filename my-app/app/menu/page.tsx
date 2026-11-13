'use client';

import { useState, useEffect, useRef, Suspense, useMemo, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';

// Prevent static generation since we use useSearchParams
export const dynamic = 'force-dynamic';
import Link from 'next/link';
import { useCartStore, lineKey, type CartItemSelection } from '@/store/cartStore';
import ProductReviews from './ProductReviews';
import { useSocket } from '@/hooks/useSocket';
import { BrowserMultiFormatReader } from '@zxing/library';

interface SavedOrder {
  orderNumber: string;
  customerName: string;
  totalAmount: number;
  createdAt: string;
  status?: 'PENDING' | 'PREPARING' | 'COMPLETED' | 'CANCELLED';
  loyaltyPromo?: boolean;
}

interface InventoryData {
  quantity: number;
  lowStockThreshold: number;
}

interface Product {
  id: number;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  available: boolean;
  inventory?: InventoryData;
}

interface Category {
  id: number;
  name: string;
  icon?: string;
  products: Product[];
}

// ── My Orders Panel ──────────────────────────────────────────────────────
function MyOrdersPanel({ onClose }: { onClose: () => void }) {
  const [orders, setOrders] = useState<SavedOrder[]>([]);
  const [realTimeStatus, setRealTimeStatus] = useState<Record<string, { status: string; loyaltyPromo: boolean }>>({});

  // Load orders from localStorage
  useEffect(() => {
    try {
      const savedOrders = JSON.parse(localStorage.getItem('cafe_orders') || '[]');
      setOrders(savedOrders);
    } catch (e) {
      console.error('Could not read this device\u2019s saved orders:', e);
    }
  }, []);

  // Fetch real-time status for all orders
  useEffect(() => {
    if (orders.length === 0) return;

    const fetchOrderStatuses = async () => {
      const statusMap: Record<string, { status: string; loyaltyPromo: boolean }> = {};
      
      await Promise.all(
        orders.map((o) =>
          fetch(`/api/orders/${o.orderNumber}`)
            .then((r) => r.ok ? r.json() : null)
            .then((data) => {
              if (data) {
                statusMap[o.orderNumber] = {
                  status: data.status || 'PENDING',
                  loyaltyPromo: data.loyaltyPromo || false,
                };
              }
            })
            .catch(() => {})
        )
      );

      setRealTimeStatus(statusMap);
    };

    fetchOrderStatuses();

    // Poll for updates every 5 seconds
    const interval = setInterval(fetchOrderStatuses, 5000);
    return () => clearInterval(interval);
  }, [orders]);

  const statusConfig = {
    PENDING: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800', icon: '⏳' },
    PREPARING: { label: 'Preparing', color: 'bg-blue-100 text-blue-800', icon: '👨‍🍳' },
    COMPLETED: { label: 'Completed', color: 'bg-green-100 text-green-800', icon: '✅' },
    CANCELLED: { label: 'Cancelled', color: 'bg-red-100 text-red-800', icon: '❌' },
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col" onClick={onClose}>
      {/* Backdrop */}
      <div className="flex-1 bg-black/30" />
      {/* Sheet */}
      <div
        className="bg-white/80 backdrop-blur-2xl rounded-t-3xl shadow-2xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h2 className="text-[17px] font-semibold text-gray-900">My Orders</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors text-lg"
          >×</button>
        </div>
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-3">
              <span className="text-3xl">🧾</span>
            </div>
            <p className="text-gray-700 font-medium">No orders yet</p>
            <p className="text-gray-400 text-sm mt-1">Your placed orders will appear here</p>
          </div>
        ) : (
          <div className="overflow-y-auto flex-1 px-4 pb-6 space-y-2.5">
            {orders.map((o) => {
              // Use real-time status from API, fall back to localStorage
              const status = realTimeStatus[o.orderNumber]?.status || o.status || 'PENDING';
              const loyaltyPromo = realTimeStatus[o.orderNumber]?.loyaltyPromo ?? o.loyaltyPromo ?? false;
              const statusInfo = statusConfig[status as keyof typeof statusConfig];
              
              return (
              <Link
                key={o.orderNumber}
                href={`/order/${o.orderNumber}`}
                onClick={onClose}
                className="flex items-start justify-between bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 hover:border-gray-300 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <p className="font-semibold text-gray-900 text-[14px]">{o.orderNumber}</p>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.color}`}>
                      {statusInfo.icon} {statusInfo.label}
                    </span>
                    {loyaltyPromo && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        🎁 Loyalty
                      </span>
                    )}
                  </div>
                  <p className="text-gray-500 text-[12px]">{o.customerName} · {new Date(o.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                <div className="flex items-center gap-2 ml-2">
                  {o.totalAmount != null && (
                    <span className="text-gray-900 font-semibold text-[14px]">₱{o.totalAmount.toFixed(2)}</span>
                  )}
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" viewBox="0 0 24 24" className="text-gray-400 shrink-0">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </div>
              </Link>
            );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── My Loyalty Card Panel ────────────────────────────────────────────────
function MyLoyaltyCardPanel({ onClose }: { onClose: () => void }) {
  const [loadingState, setLoadingState] = useState<'checking' | 'registering' | 'loading' | 'ready'>('checking');
  const [customerName, setCustomerName] = useState('');
  const [cards, setCards] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [inputName, setInputName] = useState('');
  const [settings, setSettings] = useState<any>(null);


  // Check localStorage on mount
  useEffect(() => {
    fetchSettings();
    const stored = localStorage.getItem('loyaltyCustomerName');
    if (stored) {
      setCustomerName(stored);
      fetchCard(stored);
    } else {
      setLoadingState('ready');
    }
  }, []);

  async function fetchSettings() {
    try {
      const res = await fetch('/api/loyalty/settings');
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch (e) {
      console.error('[LOYALTY] Error fetching settings:', e);
    }
  }

  async function fetchCard(name: string) {
    try {
      setLoadingState('loading');
      const res = await fetch(`/api/loyalty/cards/${encodeURIComponent(name)}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to fetch cards');
      const data = await res.json();
      setCards(Array.isArray(data) ? data : [data]);
      setLoadingState('ready');
    } catch (e) {
      console.error('[LOYALTY] Error fetching cards:', e);
      setError('Could not load your cards');
      setLoadingState('ready');
    }
  }

  async function handleRegister() {
    const name = inputName.trim();
    if (!name) {
      setError('Please enter your name');
      return;
    }

    try {
      setLoadingState('registering');
      setError('');
      const res = await fetch('/api/loyalty/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerName: name }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Registration failed');
        setLoadingState('ready');
        return;
      }

      // Success - save to localStorage and display card
      localStorage.setItem('loyaltyCustomerName', name);
      setCustomerName(name);
      setCards(Array.isArray(data) ? data : [data]);
      setLoadingState('ready');
    } catch (e) {
      console.error('[LOYALTY] Error registering:', e);
      setError('An error occurred. Please try again.');
      setLoadingState('ready');
    }
  }

  function handleLogout() {
    localStorage.removeItem('loyaltyCustomerName');
    setCustomerName('');
    setCards([]);
    setInputName('');
    setError('');
    setLoadingState('ready');
  }



  // Registration view - no customer logged in
  if (!customerName) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col" onClick={onClose}>
        <div className="flex-1 bg-black/30 animate-backdrop" />
        <div
          className="bg-white/70 backdrop-blur-2xl rounded-t-3xl shadow-2xl max-h-[70vh] flex flex-col animate-slide-up"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <h2 className="text-[17px] font-semibold text-gray-900">{settings?.cardTitle || 'My Loyalty Card'}</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors text-lg"
            >×</button>
          </div>
          <div className="flex-1 px-4 pb-6 flex flex-col justify-center">
            <div className="text-center">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-4xl">💳</span>
              </div>
              <p className="text-gray-800 font-medium mb-2">{settings?.cardTitle || 'Register for Loyalty Rewards'}</p>
              <p className="text-gray-500 text-sm mb-6">{settings?.cardDescription || 'Earn 1 free item for every 10 purchases'}</p>
              <input
                type="text"
                value={inputName}
                onChange={(e) => {
                  setInputName(e.target.value);
                  setError('');
                }}
                onKeyPress={(e) => e.key === 'Enter' && handleRegister()}
                placeholder="Enter your name..."
                className="w-full border border-gray-200 rounded-2xl px-4 py-3 mb-3 focus:outline-none focus:ring-2 focus:ring-black text-gray-900"
                autoFocus
                disabled={loadingState === 'registering'}
              />
              {error && (
                <p className="text-red-600 text-sm mb-3 font-medium">{error}</p>
              )}
              <button
                onClick={handleRegister}
                disabled={!inputName.trim() || loadingState === 'registering'}
                className="w-full bg-black hover:bg-gray-800 disabled:opacity-50 text-white font-semibold py-3.5 rounded-full transition-all shadow-lg"
              >
                {loadingState === 'registering' ? 'Registering...' : 'Register'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Card view - customer logged in
  return (
    <div className="fixed inset-0 z-50 flex flex-col" onClick={onClose}>
      <div className="flex-1 bg-black/30 animate-backdrop" />
      <div
        className="bg-white/70 backdrop-blur-2xl rounded-t-3xl shadow-2xl max-h-[85vh] flex flex-col overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3 sticky top-0 bg-white/80 backdrop-blur-xl z-10">
          <div>
            <h2 className="text-[17px] font-semibold text-gray-900">{settings?.cardTitle || 'My Loyalty Card'}</h2>
            <p className="text-gray-500 text-xs mt-0.5">{customerName}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors text-lg"
          >×</button>
        </div>



        {loadingState === 'loading' ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-3xl">🍽️</span>
              </div>
              <p className="text-gray-500 text-sm">Loading...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex-1 px-4 pb-6 flex items-center justify-center">
            <div className="text-center">
              <p className="text-red-600 font-medium mb-4">{error}</p>
            </div>
          </div>
        ) : cards.length > 0 ? (
          <div className="flex-1 px-4 pb-6 space-y-4 overflow-y-auto">
            <div className="flex flex-col gap-6 pt-2">
              {cards.map((card, idx) => (
                <div key={card.id || idx} className="space-y-3">
                  {card.activeVoucherCount > 0 && (
                    <div className="w-full bg-linear-to-r from-green-500 to-emerald-500 text-white font-semibold py-3 px-4 rounded-2xl shadow-lg flex items-center gap-2 mb-2">
                      <span className="text-xl">🎁</span>
                      <span className="text-sm">{card.categoryName}: {card.activeVoucherCount} reward(s) ready! Automatically applied at checkout.</span>
                    </div>
                  )}

                  <div 
                    style={card.cardColor ? { backgroundColor: card.cardColor } : { backgroundColor: '#8B4513' }}
                    className="text-white shadow-xl rounded-3xl p-6 text-center relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-full -mr-16 -mt-16"></div>
                    <div className="flex justify-between items-start mb-2 relative z-10">
                       <span className="bg-white/20 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">{card.categoryName}</span>
                    </div>
                    <div className="flex items-center justify-center gap-3 mb-4 relative z-10">
                      <div className="w-12 h-12 bg-white/20 backdrop-blur-xl rounded-xl flex items-center justify-center shadow-inner">
                        <span className="text-2xl">⭐</span>
                      </div>
                      <div className="text-4xl font-bold">{card.progress}/{card.coffeesRequiredForFree}</div>
                    </div>
                    <div className="w-full bg-white/20 backdrop-blur-sm rounded-full h-3 overflow-hidden relative z-10">
                      <div
                        className="h-full transition-all duration-700 ease-out rounded-full bg-white/50"
                        style={{ width: `${Math.min((card.progress / card.coffeesRequiredForFree) * 100, 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-white/70 mt-3 relative z-10 uppercase tracking-wide font-bold">
                      {card.message}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ── Icons ──────────────────────────────────────────────────────────────────
function CartIcon() {
  return (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 01-8 0" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" viewBox="0 0 24 24">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

// ── Product Card ───────────────────────────────────────────────────────────
function ProductCard({ product, catIcon, cartItem, onAdd, onUpdate, isDetailOpen, onOpenDetail, onCloseDetail, bestSeller, reviewSummary, onReviewSubmitted, onOpenReviews }: {
  product: Product;
  catIcon?: string;
  cartItem?: { quantity: number };
  onAdd: () => void;
  onUpdate: (qty: number) => void;
  isDetailOpen?: boolean;
  onOpenDetail?: () => void;
  onCloseDetail?: () => void;
  bestSeller?: boolean;
  reviewSummary?: { avg: number; total: number };
  onReviewSubmitted?: (productId: number, rating: number) => void;
  onOpenReviews?: () => void;
}) {
  const outOfStock = product.inventory && product.inventory.quantity === 0;
  const lowStock = product.inventory &&
    product.inventory.quantity > 0 &&
    product.inventory.quantity <= product.inventory.lowStockThreshold;
  const maxQty = product.inventory ? product.inventory.quantity : Infinity;
  const atMax = cartItem ? cartItem.quantity >= maxQty : false;

  const [showModal, setShowModal] = useState(false);
  const modalRef = useRef<HTMLDivElement | null>(null);

  const detailOpen = isDetailOpen ?? showModal;
  const showLocalModal = typeof isDetailOpen === 'undefined' && detailOpen;

  const openDetail = () => {
    if (onOpenDetail) {
      onOpenDetail();
      return;
    }
    setShowModal(true);
  };

  const closeDetail = () => {
    if (onCloseDetail) {
      onCloseDetail();
      return;
    }
    setShowModal(false);
  };

  useEffect(() => {
    if (!detailOpen) {
      document.body.style.overflow = '';
      return;
    }

    document.body.style.overflow = 'hidden';

    if (modalRef.current) {
      modalRef.current.scrollTop = 0;
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [detailOpen]);

  // Opens the review experience: the parent popup (with the review panel
  // pre-opened) when hosted in the grid, otherwise our own detail modal.
  const handleOpenReviews = () => {
    if (onOpenReviews) {
      onOpenReviews();
      return;
    }
    if (onOpenDetail) {
      onOpenDetail();
    } else {
      setShowModal(true);
    }
  };


  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={openDetail}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openDetail();
          }
        }}
        className={`group relative flex cursor-pointer flex-col items-center overflow-hidden rounded-[22px] border bg-[#fffdfb] shadow-[0_14px_28px_rgba(79,50,27,0.08)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_32px_rgba(79,50,27,0.12)] focus:outline-none focus:ring-2 focus:ring-[#d6b484] ${cartItem ? 'border-[#7dc98f] ring-1 ring-[#7dc98f]/70' : 'border-[#f1e3d2]'}`}
        style={{ minHeight: '190px', maxWidth: '100%', touchAction: 'pan-y' }}
      >
        <div className="w-full px-2 pt-2">
          <div
            className="relative w-full overflow-hidden rounded-2xl border border-[#f3e6d8] bg-[linear-gradient(135deg,#fefaf3_0%,#f1e5d7_100%)]"
            style={{ aspectRatio: '4 / 3' }}
          >
            <div className="absolute inset-0 flex items-center justify-center bg-[linear-gradient(135deg,#fefaf3_0%,#f3e7d6_100%)] text-3xl">
              {catIcon && (catIcon.startsWith('/') || catIcon.startsWith('http'))
                ? <img src={catIcon} alt="" className="h-full w-full object-cover opacity-40" />
                : <span className="font-semibold text-[#c9a06b]">{product.name.charAt(0).toUpperCase()}</span>}
            </div>
            {product.imageUrl ? (
              <img
                src={product.imageUrl}
                alt={product.name}
                loading="lazy"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
              />
            ) : null}
          </div>
        </div>

        <div className="flex w-full flex-1 flex-col px-2 pb-2 pt-2">
          <div className="mb-1 flex items-center justify-between gap-2">
            <h3 className="truncate text-left text-[12.5px] font-semibold leading-tight text-stone-900">{product.name}</h3>
            {bestSeller && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[7px] font-semibold uppercase tracking-[0.12em] text-amber-800">
                🔥 Best Seller
              </span>
            )}
            {lowStock && (
              <span className="rounded-full bg-orange-100 px-1.5 py-0.5 text-[7.5px] font-semibold uppercase tracking-[0.12em] text-orange-700">
                Low
              </span>
            )}
          </div>

          <div className="mt-1 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="block text-left text-[15px] font-bold text-stone-900">₱{product.price.toFixed(2)}</span>
              {outOfStock ? (
                <span className="rounded-full bg-stone-200 px-2.5 py-1 text-[10px] font-medium text-stone-500">
                  Sold out
                </span>
              ) : cartItem ? (
                <span className="rounded-full bg-[#eaf7ee] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#2f8f4a]">
                  Added
                </span>
              ) : null}
            </div>

            {product.inventory && product.inventory.quantity > 0 && (
              <span className="text-[9px] text-stone-500">{product.inventory.quantity} in stock</span>
            )}

            {/* Rating strip — jumps straight to the review panel */}
            <div
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); handleOpenReviews(); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); handleOpenReviews(); } }}
              className="flex items-center justify-between rounded-lg bg-[#faf4ee] px-2 py-1.5 transition-colors hover:bg-[#f3e8da]"
            >
              <span className={`text-[10px] font-medium ${reviewSummary && reviewSummary.total > 0 ? 'text-amber-600' : 'text-stone-400'}`}>
                {reviewSummary && reviewSummary.total > 0
                  ? `⭐ ${reviewSummary.avg.toFixed(1)} · ${reviewSummary.total} review${reviewSummary.total > 1 ? 's' : ''}`
                  : '☆☆☆☆☆ Be first to review'}
              </span>
              <span className="text-[9px] text-stone-400 underline decoration-dotted">Rate it ›</span>
            </div>

            {!outOfStock && (
              cartItem ? (
                <div className="flex items-center justify-between gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleOpenReviews(); }}
                    className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#f0e0ca] bg-[#fdf6ec] text-base text-amber-500 shadow-sm transition hover:-translate-y-0.5 hover:bg-white"
                    aria-label={`Review ${product.name}`}
                    title="Review this product"
                  >
                    ⭐
                  </button>
                  <div className="flex items-center justify-end gap-1 rounded-2xl bg-[#f4efe8] px-1 py-1 shadow-inner">
                    <button
                      onClick={(e) => { e.stopPropagation(); onUpdate(cartItem.quantity - 1); }}
                      className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#e6dccb] bg-white text-base font-semibold text-stone-700 transition hover:bg-stone-50"
                      aria-label="Remove one"
                    >−</button>
                    <span className="w-5 text-center text-[11px] font-bold text-stone-800">{cartItem.quantity}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); onUpdate(cartItem.quantity + 1); }}
                      disabled={atMax}
                      className="flex h-8 w-8 items-center justify-center rounded-xl bg-stone-900 text-base font-semibold text-white transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="Add one more"
                    >+</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleOpenReviews(); }}
                    className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#f0e0ca] bg-[#fdf6ec] text-base text-amber-500 shadow-sm transition hover:-translate-y-0.5 hover:bg-white"
                    aria-label={`Review ${product.name}`}
                    title="Review this product"
                  >
                    ⭐
                  </button>
                  <div className="flex justify-end">
                    <button
                      onClick={(e) => { e.stopPropagation(); onAdd(); }}
                      className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#1b1a18] text-lg font-semibold text-white shadow-md transition hover:bg-[#312d29] active:scale-95"
                      aria-label={`Add ${product.name} to cart`}
                    >
                      +
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {showLocalModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm animate-backdrop"
          onClick={closeDetail}
          style={{ cursor: 'zoom-out' }}
        >
          <div
            ref={modalRef}
            className="relative my-auto flex max-h-[86vh] w-[min(92vw,440px)] flex-col overflow-y-auto rounded-[28px] bg-white p-4 shadow-2xl animate-modal-in"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={closeDetail}
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-xl font-bold text-gray-600 transition hover:bg-gray-300"
              aria-label="Close"
            >×</button>

            <div className="mb-4 overflow-hidden rounded-[20px] border border-[#f0e5d8] bg-[#faf4ee]">
              <img
                src={product.imageUrl || ''}
                alt={product.name}
                className="h-56 w-full object-cover"
                style={{ background: '#fafaf9' }}
              />
            </div>

            <div className="space-y-3">
              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h3 className="text-xl font-bold text-gray-900">{product.name}</h3>
                  <span className="text-lg font-bold text-gray-900">₱{product.price.toFixed(2)}</span>
                </div>
                {product.description && (
                  <p className="text-sm leading-6 text-gray-600">{product.description}</p>
                )}
              </div>

              {lowStock && (
                <span className="inline-flex rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-orange-600">
                  Only {product.inventory!.quantity} left
                </span>
              )}

              <button
                onClick={() => {
                  onAdd();
                  closeDetail();
                }}
                disabled={outOfStock}
                className="flex h-12 w-full items-center justify-center rounded-full bg-[#1b1a18] px-4 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(31,26,23,0.2)] transition hover:bg-[#312d29] disabled:cursor-not-allowed disabled:bg-stone-300"
              >
                {outOfStock ? 'Out of Stock' : 'Add to Order'}
              </button>

              <button
                onClick={handleOpenReviews}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-gray-100 px-4 py-3 text-sm font-medium text-gray-700 transition hover:bg-gray-200"
              >
                <span>⭐</span>
                <span>See reviews &amp; rate this</span>
              </button>
            </div>

            <ProductReviews
              productId={product.id}
              onSubmitted={(rating) => onReviewSubmitted?.(product.id, rating)}
            />
          </div>
        </div>
      )}
    </>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
interface ProductOptionGroupDTO {
  id: number;
  group: {
    id: number;
    name: string;
    selectionType: 'single' | 'multi';
  };
  options: { id: number; name: string; priceDelta: number }[];
}

function MenuPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [branding, setBranding] = useState({ shopName: 'Pebot', logoUrl: null as string | null });
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState<number | 'all' | null>('all');
  const [tableFromQr, setTableFromQr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showOrders, setShowOrders] = useState(false);
  const [showLoyalty, setShowLoyalty] = useState(false);
  const [showMoodModal, setShowMoodModal] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [bestSellerIds, setBestSellerIds] = useState<Set<number>>(new Set());
  const [searchFocused, setSearchFocused] = useState(false);
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [tableSessionId, setTableSessionId] = useState<number | null>(null);
  const [ratingsMap, setRatingsMap] = useState<Record<number, { avg: number; total: number }>>({});
  const [pWriteOpen, setPWriteOpen] = useState(false);
  const [productOptions, setProductOptions] = useState<ProductOptionGroupDTO[]>([]);
  const [singlePicks, setSinglePicks] = useState<Record<number, number>>({});
  const [multiPicks, setMultiPicks] = useState<number[]>([]);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [defaultOptionsMap, setDefaultOptionsMap] = useState<Record<number, CartItemSelection[]>>({});
  const cartStore = useCartStore();
  const sectionRefs = useRef<Record<number, HTMLElement | null>>({});
  const tabsRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Entry modal state
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [entryTableId, setEntryTableId] = useState<number | null>(null);
  const [occupantCount, setOccupantCount] = useState(1);
  const [entryLoading, setEntryLoading] = useState(false);
  const [entryError, setEntryError] = useState('');
  const [entryName, setEntryName] = useState('');

  // Guest mood modal state
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [guestMoodEmoji, setGuestMoodEmoji] = useState<string>('🙂');
  const [guestMoodNote, setGuestMoodNote] = useState('');
  const [guestSaving, setGuestSaving] = useState(false);

  // Fetch branding
  useEffect(() => {
    fetch('/api/settings/branding')
      .then((r) => r.json())
      .then((d) => setBranding({ shopName: d.shopName ?? 'Pebot', logoUrl: d.logoUrl ?? null }))
      .catch(() => {});
  }, []);

  // Fetch review ratings once for every product card
  useEffect(() => {
    fetch('/api/reviews')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const map: Record<number, { sum: number; total: number }> = {};
        for (const rev of d?.reviews ?? []) {
          const cur = map[rev.productId] ?? { sum: 0, total: 0 };
          cur.sum += rev.rating;
          cur.total += 1;
          map[rev.productId] = cur;
        }
        const out: Record<number, { avg: number; total: number }> = {};
        for (const [pid, v] of Object.entries(map)) {
          out[Number(pid)] = { avg: v.sum / v.total, total: v.total };
        }
        setRatingsMap(out);
      })
      .catch(() => {});
  }, []);

  // Load this product's customization groups (Size / Temp / add-ons)
  useEffect(() => {
    if (selectedProductId === null) {
      setPWriteOpen(false);
      setProductOptions([]);
      setSinglePicks({});
      setMultiPicks([]);
      setOptionsError(null);
      return;
    }
    setPWriteOpen(false);
    let cancelled = false;
    setOptionsError(null);
    fetch(`/api/products/${selectedProductId}/option-groups`)
      .then((r) => {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        const list: ProductOptionGroupDTO[] = Array.isArray(data) ? data : [];
        setProductOptions(list);
        const defaults: Record<number, number> = {};
        for (const att of list) {
          if (att.group.selectionType === 'single' && att.options?.length) {
            defaults[att.group.id] = att.options[0].id;
          }
        }
        setSinglePicks(defaults);
        setMultiPicks([]);
      })
      .catch((e: any) => {
        if (!cancelled) setOptionsError(e?.message ? String(e.message) : 'load failed');
      });
    return () => { cancelled = true; };
  }, [selectedProductId]);

  useEffect(() => {
    if (selectedProductId === null) setPWriteOpen(false);
  }, [selectedProductId]);

  // Default configuration for every product: first option of each attached
  // group (Small · Hot …). Quick-add uses this so no line is ever blank.
  useEffect(() => {
    if (categories.length === 0) return;
    fetch('/api/product-option-groups')
      .then((r) => (r.ok ? r.json() : []))
      .then((attachments) => {
        const map: Record<number, CartItemSelection[]> = {};
        for (const att of Array.isArray(attachments) ? attachments : []) {
          if (att.group.selectionType !== 'single') continue; // multi groups start empty by design
          const first = (att.productOptions ?? [])[0];
          if (!first) continue;
          (map[att.productId] ??= []).push({
            optionId: first.id,
            groupName: att.group.name,
            name: first.name,
            priceDelta: first.priceDelta ?? 0,
          });
        }
        setDefaultOptionsMap(map);
      })
      .catch(() => {});
  }, [categories]);

  const getDefaultSelections = useCallback(
    (productId: number): CartItemSelection[] => defaultOptionsMap[productId] ?? [],
    [defaultOptionsMap]
  );

  const handleReviewSubmitted = useCallback((productId: number, rating: number) => {
    setRatingsMap((prev) => {
      const cur = prev[productId] ?? { avg: 0, total: 0 };
      const total = cur.total + 1;
      const avg = (cur.avg * cur.total + rating) / total;
      return { ...prev, [productId]: { avg, total } };
    });
  }, []);

  const openDetailWithReview = useCallback((pid: number) => {
    setSelectedProductId(pid);
    setPWriteOpen(true);
  }, []);


  // Cleanup: ensure body overflow is never left locked
  useEffect(() => {
    const handleRouteChange = () => {
      document.body.style.overflow = '';
    };
    window.addEventListener('beforeunload', handleRouteChange);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('beforeunload', handleRouteChange);
    };
  }, []);

  // Auto-set table from QR code URL parameter OR localStorage
  useEffect(() => {
    // First check URL parameter, then localStorage
    let table = searchParams.get('table');
    
    // If no URL parameter, check localStorage for previously stored table
    if (!table) {
      table = localStorage.getItem('cafe_current_table');
    }
    
    if (table) {
      // Validate that the table exists in our system before showing it.
      // QR links now carry the table's permanent slug, but older stickers carry
      // the name — match either.
      fetch(`/api/tables?filter=${encodeURIComponent(table || '')}`)
        .then((r) => r.json())
        .then((data) => {
          const foundTable = data.find((t: any) => t.slug === table || t.name === table);
          if (foundTable && table) {
            setTableFromQr(foundTable.name);
            // Store in cart store as well
            cartStore.setTableNumber(foundTable.name);
            
            // Continue with table details - reuse data instead of refetching
            setEntryTableId(foundTable.id);
            setOccupantCount(1);
            
            // Skip entry modal - register the customer as a guest at the table (only if not already registered)
            const customerName = localStorage.getItem('loyaltyCustomerName') || 'Guest';
            const savedMood = localStorage.getItem('customerMood') || '🙂';
            const savedMoodNote = localStorage.getItem('customerMoodNote') || '';
            const rememberedSessionId = Number(localStorage.getItem('cafe_table_session_id') || 0) || null;
            
            // Check if guest already exists for this table (to avoid duplicates)
            const alreadyHasGuest = foundTable?.guests?.some((g: any) => 
              g.displayName.toLowerCase() === customerName.toLowerCase()
            );
            
            // Establish a visit only when the device doesn't already remember a
            // valid one: a returning device (refresh) keeps its remembered visit,
            // while a fresh device always gets a fresh visit so a new group is
            // never mixed with a previous group's orders.
            const shouldAutoEntry = !rememberedSessionId || !alreadyHasGuest;
            
            if (shouldAutoEntry) {
              fetch('/api/tables/entry', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  tableId: foundTable.id,
                  occupants: 1,
                  customerName: customerName,
                  moodEmoji: savedMood,
                  moodNote: savedMoodNote || null,
                  sessionId: rememberedSessionId
                })
              })
              .then(entryRes => entryRes.json())
              .then(entryData => {
                if (entryData.session?.id) {
                  setTableSessionId(entryData.session.id);
                  localStorage.setItem('cafe_table_session_id', String(entryData.session.id));
                }
              })
              .catch(() => {});
            }
            
            // Also set the table and show menu
            setShowEntryModal(false);
            setEntryError('');
          } else {
            // Table doesn't exist or is empty - clear the stored value
            localStorage.removeItem('cafe_current_table');
          }
        })
        .catch(() => {
          // On error, clear stored table
          localStorage.removeItem('cafe_current_table');
        });
    }
  }, [searchParams]);

  // Get customer name from localStorage on mount
  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('loyaltyCustomerName') : null;
    setCustomerName(stored);
    // Pre-fill entry name with saved loyalty name
    if (stored) {
      setEntryName(stored);
    }
    // Pre-fill mood with saved mood
    const savedMood = typeof window !== 'undefined' ? localStorage.getItem('customerMood') : null;
    if (savedMood) {
      setGuestMoodEmoji(savedMood);
    }
  }, []);

  useEffect(() => {
    if (searchParams.get('loyalty') === '1') {
      setShowLoyalty(true);
    }
  }, [searchParams]);

  function refreshCategories() {
    fetch('/api/categories')
      .then((r) => {
        if (!r.ok) return null;
        return r.json();
      })
      .then((data) => {
        if (Array.isArray(data)) setCategories(data);
      })
      .catch(() => {});
  }

  // Handle table entry
  async function handleTableEntry() {
    if (!entryTableId) return;

    // Require name for new customers
    const name = entryName.trim();
    if (!name) {
      setEntryError('Please enter your name');
      return;
    }
    
    setEntryLoading(true);
    setEntryError('');

    const rememberedSessionId = Number(localStorage.getItem('cafe_table_session_id') || 0) || null;

    try {
      const res = await fetch('/api/tables/entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableId: entryTableId,
          occupants: occupantCount,
          customerName: name,
          moodEmoji: '🙂',
          moodNote: null,
          sessionId: rememberedSessionId
        })
      });

      const data = await res.json();

      if (!res.ok) {
        setEntryError(data.error || 'Failed to check in');
        setEntryLoading(false);
        return;
      }

      // Success - set the table number in cart and store session for guests
      cartStore.setTableNumber(tableFromQr || '');
      if (data.session?.id) {
        setTableSessionId(data.session.id);
        localStorage.setItem('cafe_table_session_id', String(data.session.id));
      }
      setShowEntryModal(false);
      setOccupantCount(1);
      setEntryName('');

      // Ask user to set their mood (they can change it)
      setGuestName(name);
      setGuestMoodEmoji('🙂');
      setGuestMoodNote('');
      setShowGuestModal(true);
    } catch (err) {
      setEntryError('Error checking in');
      setEntryLoading(false);
    }
  }

  async function handleGuestSave() {
    if (!tableSessionId) {
      setShowGuestModal(false);
      return;
    }

    const name = guestName.trim() || 'Guest';

    try {
      setGuestSaving(true);

      // Ensure we have a tableId; if not, look up by name from QR
      let tableId = entryTableId;
      if (!tableId && tableFromQr) {
        const res = await fetch(`/api/tables?filter=${encodeURIComponent(tableFromQr)}`);
        if (res.ok) {
          const tables = await res.json();
          const found = tables.find((t: any) => t.name === tableFromQr);
          if (found) {
            tableId = found.id;
          }
        }
      }

      if (!tableId) {
        setShowGuestModal(false);
        setGuestSaving(false);
        return;
      }

      await fetch('/api/tables/guests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableId,
          sessionId: tableSessionId,
          displayName: name,
          moodEmoji: guestMoodEmoji,
          moodNote: guestMoodNote.trim() || null,
        }),
      });
      
      // Save mood to localStorage for next visit
      localStorage.setItem('customerMood', guestMoodEmoji);
      if (guestMoodNote.trim()) {
        localStorage.setItem('customerMoodNote', guestMoodNote.trim());
      }
    } catch {
      // Fail silently for guest metadata; core ordering still works
    } finally {
      setGuestSaving(false);
      setShowGuestModal(false);
    }
  }

  useEffect(() => {
    fetch('/api/categories')
      .then((r) => {
        if (!r.ok) return null;
        return r.json();
      })
      .then((data) => {
        if (Array.isArray(data)) {
          setCategories(data);
          setActiveCategory('all');
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(function() { fetch('/api/menu/best-sellers').then(function(r) {return r.ok ? r.json() : null}).then(function(d) {if (d) setBestSellerIds(new Set(d.bestSellers ? d.bestSellers : []))}).catch(function() {}) }, [])

  // Poll every 30s for availability changes (less aggressive)
  useEffect(() => {
    const interval = setInterval(refreshCategories, 30000);
    return () => clearInterval(interval);
  }, []);  

  // Also update immediately via socket when admin toggles table status
  useSocket({
    room: 'tables',
    events: {
      'table-update': () => {
        // Refresh table list when admin updates tables
        fetch('/api/tables')
          .then(r => r.json())
          .then(tables => {
            const allTables = tables.map((t: any) => ({
              id: t.id,
              name: t.name,
              capacity: t.capacity,
              currentOccupants: t.currentOccupants || 0,
              status: t.status || 'AVAILABLE'
            }));
            setAvailableTables(allTables);
          })
          .catch(console.error);
      },
      'product-update': (data: unknown) => {
        const updated = data as { id: number; available: boolean };
        setCategories((prev) =>
          prev.map((cat) => ({
            ...cat,
            products: cat.products.map((p) =>
              p.id === updated.id ? { ...p, available: updated.available } : p
            ),
          }))
        );
        refreshCategories();
      },
      // Sellable quantity is a derived cache of ingredient stock — refresh the
      // menu immediately whenever stock / recipes change (no 30s wait).
      'ingredients-update': () => { refreshCategories(); },
      'inventory-update': () => { refreshCategories(); },
    },
  });

  // Order completion notifications
  const [orderNotification, setOrderNotification] = useState<any>(null);
  const [showOrderAlert, setShowOrderAlert] = useState(false);
  const [cleanRequestSending, setCleanRequestSending] = useState(false);
  const [cleanRequestSent, setCleanRequestSent] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [showTableScanner, setShowTableScanner] = useState(false);
  const [tableScanning, setTableScanning] = useState(false);
  const [availableTables, setAvailableTables] = useState<{id: number; name: string; capacity: number; currentOccupants: number; status: string}[]>([]);
  const tableVideoRef = useRef<HTMLVideoElement>(null);
  const tableCodeReaderRef = useRef<BrowserMultiFormatReader | null>(null);

  // Scroll active tab into view
  useEffect(() => {
    if (!activeCategory || !tabsRef.current) return;
    const activeBtn = tabsRef.current.querySelector<HTMLElement>('[data-active="true"]');
    if (activeBtn) {
      activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [activeCategory]);

  function scrollToCategory(catId: number) {
    setActiveCategory(catId);
    const el = sectionRefs.current[catId];
    if (el) {
      // Offset for sticky header (~120px)
      const y = el.getBoundingClientRect().top + window.scrollY - 124;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  }

  // Table selector function - called from button
  async function startTableScanner() {
    setShowTableScanner(true);
    
    // Fetch ALL tables with their status
    try {
      const res = await fetch('/api/tables');
      const tables = await res.json();
      // Show ALL tables with their current status and available chairs
      const allTables = tables.map((t: any) => ({
        id: t.id,
        name: t.name,
        capacity: t.capacity,
        currentOccupants: t.currentOccupants || 0,
        status: t.status || 'AVAILABLE'
      }));
      setAvailableTables(allTables);
    } catch (err) {
      console.error('Failed to fetch tables:', err);
    }
    
    try {
      tableCodeReaderRef.current = new BrowserMultiFormatReader();
      
      // Wait for video element to be ready
      await new Promise(resolve => setTimeout(resolve, 500));
      
      if (tableVideoRef.current) {
        await tableCodeReaderRef.current.decodeFromVideoDevice(
          null,
          tableVideoRef.current,
          (result, error) => {
            if (result) {
              const scannedText = result.getText();
              try {
                const url = new URL(scannedText);
                const tableParam = url.searchParams.get('table');
                if (tableParam) {
                  window.location.href = `/menu?table=${tableParam}`;
                } else if (scannedText.includes('table=')) {
                  const match = scannedText.match(/table=([^&]+)/);
                  if (match) {
                    window.location.href = `/menu?table=${match[1]}`;
                  }
                }
              } catch (e) {
                if (scannedText.trim()) {
                  window.location.href = `/menu?table=${scannedText.trim()}`;
                }
              }
              if (tableCodeReaderRef.current) {
                tableCodeReaderRef.current.reset();
              }
              setShowTableScanner(false);
              setTableScanning(false);
            }
          }
        );
      }
    } catch (err) {
      console.error('Scanner error:', err);
      setTableScanning(false);
    }
  }

  // Cleanup scanner on unmount
  useEffect(() => {
    return () => {
      if (tableCodeReaderRef.current) {
        tableCodeReaderRef.current.reset();
      }
    };
  }, []);

  // Track active section on scroll
  useEffect(() => {
    if (search) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = Number(entry.target.getAttribute('data-cat-id'));
            if (id) setActiveCategory(id);
          }
        });
      },
      { rootMargin: '-30% 0px -60% 0px' }
    );
    Object.values(sectionRefs.current).forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [categories, search]);

  function handleAdd(product: Product, categoryId: number, selections?: CartItemSelection[]) {
    const adder = (selections ?? []).reduce((s, x) => s + x.priceDelta, 0);
    cartStore.addItem({
      productId: product.id,
      name: product.name,
      price: product.price + adder,
      basePrice: product.price,
      categoryId: categoryId,
      selections,
    });
  }

  const filteredCategories = search
    ? categories
        .map((cat) => ({
          ...cat,
          products: cat.products.filter((p) =>
            p.available !== false && (
              p.name.toLowerCase().includes(search.toLowerCase()) ||
              p.description?.toLowerCase().includes(search.toLowerCase())
            )
          ),
        }))
        .filter((cat) => cat.products.length > 0)
    : (Array.isArray(categories) ? categories : [])
        .map((cat) => ({
          ...cat,
          products: cat.products.filter((p) => p.available !== false),
        }))
        .filter((cat) => cat.products.length > 0);

  const itemCount = cartStore.itemCount();
  const cartTotal = cartStore.total();
  const shouldShowPaymentBar = itemCount > 0 && selectedProductId === null && !searchFocused;
  const selectedProduct = useMemo(() => {
    if (selectedProductId === null) return null;
    for (const category of categories) {
      const product = category.products.find((item) => item.id === selectedProductId);
      if (product) {
        return { product, categoryIcon: category.icon };
      }
    }
    return null;
  }, [selectedProductId, categories]);

  const chosenSelections: CartItemSelection[] = useMemo(() => {
    const out: CartItemSelection[] = [];
    for (const att of productOptions) {
      if (!att?.group || !Array.isArray(att.options)) continue;
      if (att.group.selectionType === 'single') {
        const opt = att.options.find((o) => o.id === singlePicks[att.group.id]);
        if (opt) out.push({ optionId: opt.id, groupName: att.group.name, name: opt.name, priceDelta: opt.priceDelta });
      } else {
        for (const opt of att.options) {
          if (multiPicks.includes(opt.id)) {
            out.push({ optionId: opt.id, groupName: att.group.name, name: opt.name, priceDelta: opt.priceDelta });
          }
        }
      }
    }
    return out;
  }, [productOptions, singlePicks, multiPicks]);

  const popupUnitTotal = selectedProduct
    ? selectedProduct.product.price + chosenSelections.reduce((s, x) => s + x.priceDelta, 0)
    : 0;

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-5xl animate-pulse">🍽️</div>
          <p className="text-gray-500 font-medium text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-[radial-gradient(circle_at_top,#ffffff_0%,#f5f5f4_45%,#eceae6_100%)] text-slate-900">
      <div className="flex h-full w-full flex-col">
        {/* ── Table Entry Modal ─────────────────────────────────────────── */}
        {showEntryModal && entryTableId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-md p-4"
            onClick={() => setShowEntryModal(false)}
          >
            <div className="bg-white rounded-3xl shadow-2xl p-6 max-w-sm w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-2xl font-semibold text-gray-900 mb-2 text-center">Welcome! 👋</h2>
              <p className="text-gray-500 text-center mb-4">Enter your name and group size</p>

              {entryError && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl mb-4 text-sm">
                  ❌ {entryError}
                </div>
              )}

              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Your name (required)
                </label>
                {customerName ? (
                  <div className="w-full border-2 border-green-300 bg-green-50 rounded-xl px-4 py-3 text-sm font-medium text-green-800">
                    👤 {customerName}
                    <p className="text-[10px] text-green-600 mt-1">Registered member • Name cannot be changed. Ask staff to update.</p>
                  </div>
                ) : (
                  <input
                    type="text"
                    value={entryName}
                    onChange={(e) => {
                      setEntryName(e.target.value);
                      setEntryError('');
                    }}
                    onKeyPress={(e) => e.key === 'Enter' && handleTableEntry()}
                    placeholder="Juan, Anna, Foodie..."
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                    autoFocus
                  />
                )}
              </div>

              <div className="bg-gray-50 border-2 border-gray-200 rounded-2xl p-4 mb-6 text-center">
                <p className="text-gray-600 text-sm font-medium mb-3">How many in your group?</p>
                <div className="flex items-center justify-center gap-6">
                  <button
                    onClick={() => setOccupantCount(Math.max(1, occupantCount - 1))}
                    disabled={occupantCount <= 1 || entryLoading}
                    className="w-12 h-12 rounded-full bg-gray-300 hover:bg-gray-400 disabled:opacity-50 text-white font-bold text-xl flex items-center justify-center transition-colors"
                  >
                    −
                  </button>
                  <div className="text-4xl font-bold text-gray-900 w-20 text-center">{occupantCount}</div>
                  <button
                    onClick={() => setOccupantCount(occupantCount + 1)}
                    disabled={entryLoading}
                    className="w-12 h-12 rounded-full bg-black hover:bg-gray-800 text-white font-bold text-xl flex items-center justify-center transition-colors"
                  >
                    +
                  </button>
                </div>
                <p className="text-amber-800 text-sm font-medium mt-3">Table {tableFromQr}</p>
              </div>

              <button
                onClick={handleTableEntry}
                disabled={entryLoading || !entryName.trim()}
                className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold py-4 rounded-2xl text-lg transition-colors"
              >
                {entryLoading ? '⏳ Checking In...' : '✅ Start Ordering'}
              </button>
            </div>
          </div>
        )}

        {showGuestModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-md p-4 animate-backdrop"
            onClick={() => setShowGuestModal(false)}
          >
            <div className="bg-white rounded-3xl shadow-2xl p-6 max-w-sm w-full animate-modal-in"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-2xl font-semibold text-gray-900 mb-1 text-center">Who&apos;s ordering?</h2>
              <p className="text-gray-500 text-center mb-5">Tell us your name and mood for this table.</p>

              <div className="space-y-4 mb-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-2">Your name (optional)</label>
                  <input
                    type="text"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="Juan, Anna, Foodie..."
                    className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-2">Choose your mood</label>
                  <div className="flex items-center justify-between gap-2">
                    {['😀', '🙂', '😐', '😔', '😡'].map((mood) => (
                      <button
                        key={mood}
                        type="button"
                        onClick={() => setGuestMoodEmoji(mood)}
                        className={`flex-1 py-3 rounded-2xl text-2xl border-2 transition-all ${
                          guestMoodEmoji === mood
                            ? 'bg-black border-black text-white'
                            : 'bg-white border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        {mood}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Describe your mood (optional)</label>
                  <textarea
                    value={guestMoodNote}
                    onChange={(e) => setGuestMoodNote(e.target.value)}
                    rows={2}
                    placeholder="e.g. Hungry and excited!"
                    className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black resize-none"
                  />
                </div>
              </div>

              <button
                onClick={handleGuestSave}
                disabled={guestSaving}
                className="w-full bg-black hover:bg-gray-800 disabled:opacity-50 text-white font-semibold py-3.5 rounded-full text-sm transition-all shadow-lg"
              >
                {guestSaving ? 'Saving...' : 'Continue'}
              </button>

              <button
                onClick={() => setShowGuestModal(false)}
                disabled={guestSaving}
                className="w-full mt-3 text-stone-500 hover:text-stone-800 text-xs font-medium"
              >
                Skip for now
              </button>
            </div>
          </div>
        )}

        {showOrderAlert && orderNotification && (
          <div className="fixed top-4 left-4 right-4 z-50 bg-green-50 border-2 border-green-400 rounded-xl p-4 shadow-lg animate-pulse">
            <div className="flex items-start gap-3">
              <div className="text-2xl">✅</div>
              <div className="flex-1">
                <p className="font-bold text-green-900">Order Ready!</p>
                <p className="text-sm text-green-800 mt-1">Order #{orderNotification.orderNumber} is ready for pickup</p>
              </div>
              <button onClick={() => setShowOrderAlert(false)} className="shrink-0 text-green-600 hover:text-green-800 text-xl font-bold">×</button>
            </div>
          </div>
        )}

        {showOrders && <MyOrdersPanel onClose={() => setShowOrders(false)} />}
        {showLoyalty && <MyLoyaltyCardPanel onClose={() => setShowLoyalty(false)} />}

        {showMoodModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-backdrop"
            onClick={() => setShowMoodModal(false)}
          >
            <div className="bg-white rounded-3xl shadow-2xl p-6 max-w-sm w-full animate-modal-in"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-2xl font-semibold text-gray-900 mb-1 text-center">How are you feeling?</h2>
              <p className="text-gray-500 text-center mb-5">Update your mood anytime</p>

              <div className="space-y-4 mb-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-2">Choose your mood</label>
                  <div className="flex items-center justify-between gap-2">
                    {['😀', '🙂', '😐', '😔', '😡'].map((mood) => (
                      <button
                        key={mood}
                        type="button"
                        onClick={() => setGuestMoodEmoji(mood)}
                        className={`flex-1 py-3 rounded-2xl text-2xl border-2 transition-all ${
                          guestMoodEmoji === mood
                            ? 'bg-black border-black text-white'
                            : 'bg-white border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        {mood}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Describe your mood (optional)</label>
                  <textarea
                    value={guestMoodNote}
                    onChange={(e) => setGuestMoodNote(e.target.value)}
                    rows={2}
                    placeholder="e.g. Hungry and excited!"
                    className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                  />
                </div>
              </div>

              <button
                onClick={async () => {
                  if (!entryTableId && tableFromQr) {
                    const res = await fetch(`/api/tables?filter=${encodeURIComponent(tableFromQr)}`);
                    if (res.ok) {
                      const tables = await res.json();
                      const found = tables.find((t: any) => t.name === tableFromQr);
                      if (found) {
                        setEntryTableId(found.id);
                      }
                    }
                  }

                  if (tableSessionId) {
                    try {
                      const guestsRes = await fetch(`/api/tables?filter=${encodeURIComponent(tableFromQr || '')}`);
                      if (guestsRes.ok) {
                        const tableData = await guestsRes.json();
                        const table = tableData.find((t: any) => t.name === tableFromQr);
                        if (table?.guests?.length > 0) {
                          const guestId = table.guests[0].id;
                          await fetch('/api/tables/guests', {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              id: guestId,
                              moodEmoji: guestMoodEmoji,
                              moodNote: guestMoodNote.trim() || null,
                            }),
                          });
                        }
                      }
                    } catch (e) {
                      console.error('Failed to save the guest mood to the table:', e);
                    }
                  }

                  localStorage.setItem('customerMood', guestMoodEmoji);
                  localStorage.setItem('customerMoodNote', guestMoodNote.trim());
                  setShowMoodModal(false);
                }}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-2xl text-sm transition-colors"
              >
                Save Mood
              </button>

              <button onClick={() => setShowMoodModal(false)} className="w-full mt-3 text-stone-500 hover:text-stone-800 text-xs font-medium">
                Cancel
              </button>
            </div>
          </div>
        )}

        <header className="w-full border-b border-[#eadfcf] bg-[#fffaf4]/90 text-stone-900 shadow-[0_12px_30px_rgba(85,54,30,0.06)] backdrop-blur-xl">
          <div className="flex w-full items-center justify-between gap-3 px-4 pb-2 pt-3 sm:px-6 lg:px-8">
            <div className="min-w-0 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl border border-[#f0e0ca] bg-linear-to-br from-[#f7efe4] to-[#e7d3b6] shadow-sm">
                {branding.logoUrl ? (
                  <img src={branding.logoUrl} alt="Shop Logo" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-xl">🍽️</span>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8a6c45]">Welcome to</p>
                <h1 className="text-[18px] font-bold -tracking-[0.3px] text-stone-900">{branding.shopName}</h1>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button onClick={() => setShowOrders(true)} className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#f0e0ca] bg-white/90 text-stone-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-white" aria-label="Orders">
                <span className="text-xl">🧾</span>
              </button>
              <button onClick={() => setShowMoodModal(true)} className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#f0e0ca] bg-white/90 text-stone-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-white" aria-label="Mood">
                <span className="text-xl">😀</span>
               </button>
               <button onClick={() => startTableScanner()} className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#f0e0ca] bg-white/90 text-stone-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-white" aria-label="Switch Table">
                <span className="text-xl">🔄</span>
              </button>

              {showTableScanner && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-md p-4 animate-backdrop"
                    onClick={() => setShowTableScanner(false)}
                  >
                    <div className="bg-white rounded-3xl p-5 max-w-sm w-full shadow-2xl animate-modal-in"
                      onClick={(e) => e.stopPropagation()}
                    >
                    <h3 className="text-gray-900 text-center font-semibold mb-4">Switch Table</h3>
                    <div className="mb-4">
                      <select
                        onChange={async (e) => {
                          if (e.target.value) {
                            const selectedTable = availableTables.find(t => t.name === e.target.value);
                            if (selectedTable) {
                              const customerName = localStorage.getItem('loyaltyCustomerName') || 'Guest';

                              if (tableFromQr) {
                                const oldTable = availableTables.find(t => t.name === tableFromQr);
                                if (oldTable && oldTable.id !== selectedTable.id && oldTable.currentOccupants > 0) {
                                  const remainingOccupants = (oldTable.currentOccupants || 1) - 1;
                                  await fetch('/api/tables', {
                                    method: 'PUT',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ id: oldTable.id, action: remainingOccupants === 0 ? 'clear' : 'remove', customerName })
                                  });
                                }
                              }

                              const savedMood = localStorage.getItem('customerMood') || '🙂';
                              const savedMoodNote = localStorage.getItem('customerMoodNote') || '';
                              await fetch('/api/tables/entry', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  tableId: selectedTable.id,
                                  occupants: 1,
                                  customerName,
                                  moodEmoji: savedMood,
                                  moodNote: savedMoodNote || null,
                                })
                              });
                            }
                            window.location.href = `/menu?table=${e.target.value}`;
                          }
                        }}
                        className="w-full px-4 py-3 rounded-2xl bg-gray-50 text-gray-900 border border-gray-200"
                        defaultValue=""
                      >
                        <option value="" disabled>Select a table...</option>
                        {availableTables.map(table => {
                          const availableChairs = table.capacity - table.currentOccupants;
                          const statusLabel = table.status === 'AVAILABLE' ? '✅ Available' : table.status === 'OCCUPIED' ? '⏳ Occupied' : '🧹 Needs Cleaning';
                          return (
                            <option key={table.id} value={table.name}>
                              {statusLabel} - Table {table.name} ({availableChairs} chairs available)
                            </option>
                          );
                        })}
                        {availableTables.length === 0 && <option disabled>No tables available</option>}
                      </select>
                    </div>
                    <button onClick={() => setShowTableScanner(false)} className="mt-4 w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-full font-medium">
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <button onClick={() => setShowLoyalty(true)} className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#f0e0ca] bg-[#f7efe7] text-stone-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-[#f3e5d7]" aria-label="Rewards">
                <span className="text-xl">💳</span>
              </button>
              <Link href="/cart" className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#1f1a17] text-white shadow-[0_12px_25px_rgba(31,26,23,0.25)] transition hover:-translate-y-0.5 hover:bg-[#2b2724]" aria-label="Cart">
                <CartIcon />
                {itemCount > 0 && (
                  <>
                    <span className="font-bold text-[11px] tabular-nums">{itemCount}</span>
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white" />
                  </>
                )}
              </Link>
            </div>
          </div>

          {/* Reviews entrance */}
          <div className="flex w-full items-center gap-2 px-4 pb-3 sm:px-6 lg:px-8">
            <Link href="/menu/reviews" className="inline-flex items-center gap-1.5 rounded-full border border-[#f0e0ca] bg-white/90 px-4 py-2 text-[13px] font-medium text-stone-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-white">
              ⭐ Reviews
            </Link>
          </div>

          <div className="px-4 pb-3">
            <div className={`flex items-center gap-2 rounded-full border border-[#e9dcc8] bg-[#faf4ee] px-4 py-2.5 shadow-sm transition-all duration-200 ${searchFocused ? 'border-[#d8b98f] bg-white ring-2 ring-[#eacfa7]/40' : ''}`}>
              <span className="shrink-0 text-stone-500"><SearchIcon /></span>
              <input
                ref={searchRef}
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                placeholder="Search drinks, food..."
                className="flex-1 bg-transparent text-[15px] text-stone-800 placeholder:text-stone-400 focus:outline-none"
              />
              {search && (
                <button onClick={() => { setSearch(''); searchRef.current?.focus(); }} className="shrink-0 rounded-full bg-white p-1 text-stone-400 transition hover:text-stone-700" aria-label="Clear search">
                  <XIcon />
                </button>
              )}
            </div>

            {tableFromQr && (
              <div className="mt-2 text-center flex items-center justify-center gap-2">
                <span className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-800 px-3 py-1.5 rounded-full text-sm font-medium">🍽️ Ordering from {tableFromQr}</span>
                <button
                  onClick={async () => {
                    if (!tableFromQr) return;
                    const table = availableTables.find(t => t.name === tableFromQr);
                    if (!table) return;

                    const remainingOccupants = (table.currentOccupants || 1) - 1;
                    const customerName = localStorage.getItem('loyaltyCustomerName') || 'Guest';

                    try {
                      const res = await fetch('/api/tables', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id: table.id, action: remainingOccupants === 0 ? 'clear' : 'remove', customerName })
                      });
                      if (res.ok) {
                        localStorage.removeItem('cafe_current_table');
                        localStorage.removeItem('cafe_table_session_id');
                        window.location.href = window.location.pathname;
                      } else {
                        const err = await res.json().catch(() => ({}));
                        alert(err.error || 'Failed to leave table. Please try again.');
                      }
                    } catch (err) {
                      console.error('Exit error:', err);
                      alert(err instanceof Error ? err.message : 'Failed to leave table. Please try again.');
                    }
                  }}
                  className="inline-flex items-center gap-1 bg-red-100 text-red-700 px-3 py-1.5 rounded-full text-sm font-medium hover:bg-red-200 transition-colors"
                >
                  🚪 Leave
                </button>
              </div>
            )}
          </div>

          {!search && (
            <div ref={tabsRef} className="lg:hidden flex gap-1.5 overflow-x-auto px-3 py-1 scrollbar-hide snap-x snap-mandatory" style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties} role="tablist" aria-label="Categories">
              <button key="all" data-active={activeCategory === 'all'} onClick={() => setActiveCategory('all')} className={`shrink-0 flex flex-col items-center justify-center gap-0.5 rounded-2xl px-2.5 py-1.5 text-[10px] font-semibold transition-all duration-200 snap-center ${activeCategory === 'all' ? 'bg-[#1d1917] text-white shadow-lg shadow-[#1d1917]/15' : 'border border-[#eedec9] bg-[#fffdfb] text-stone-600 shadow-sm hover:bg-[#f9f2ea]'}`} role="tab" aria-selected={activeCategory === 'all'} tabIndex={activeCategory === 'all' ? 0 : -1}>
                <span className="w-5 h-5 flex items-center justify-center"><span className="text-base">📋</span></span>
                <span className="whitespace-nowrap text-[9px] font-medium leading-tight text-center">All</span>
              </button>
              {categories.map((cat) => {
                const isActive = activeCategory === cat.id;
                return (
                  <button key={cat.id} data-active={isActive} onClick={() => setActiveCategory(cat.id)} className={`shrink-0 flex flex-col items-center justify-center gap-0.5 rounded-2xl px-2.5 py-1.5 text-[10px] font-semibold transition-all duration-200 snap-center ${isActive ? 'bg-[#1d1917] text-white shadow-lg shadow-[#1d1917]/15' : 'border border-[#eedec9] bg-[#fffdfb] text-stone-600 shadow-sm hover:bg-[#f9f2ea]'}`} role="tab" aria-selected={isActive} tabIndex={isActive ? 0 : -1}>
                    <span className="w-5 h-5 flex items-center justify-center">{cat.icon && (cat.icon.startsWith('/') || cat.icon.startsWith('http')) ? <img src={cat.icon} alt="" className="w-5 h-5 rounded-md object-cover" /> : <span className="text-base">{cat.icon}</span>}</span>
                    <span className="whitespace-nowrap text-[9px] font-medium leading-tight text-center">{cat.name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </header>

        <div className="flex min-h-0 flex-1 gap-4 px-3 pb-3 pt-3 sm:px-4 lg:px-5">
          <main id="menu-content" ref={(el) => { (window as any).__menuContentRef = el; }} className="min-w-0 flex-1 overflow-y-auto rounded-[30px] border border-[#eedec9] bg-[#fffdfb]/80 shadow-[0_18px_35px_rgba(86,59,34,0.08)] backdrop-blur-xl pb-4">
            <div className="flex h-full min-h-0 gap-4 p-3 lg:p-4">
              {!search && (
                <aside className="hidden w-55 shrink-0 lg:block">
                  <div className="h-full rounded-[26px] border border-[#eedec9] bg-[#f9f2ea] p-3">
                    <div className="mb-3 flex items-center justify-between">
                      <h2 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8a6c45]">Categories</h2>
                      <span className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-[#8a6c45]">{categories.length}</span>
                    </div>
                    <div className="space-y-2">
                      <button type="button" onClick={() => setActiveCategory('all')} className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-semibold transition ${activeCategory === 'all' ? 'bg-[#1e1a17] text-white shadow-md' : 'bg-white text-stone-700 hover:bg-[#f3e7d8]'}`}>
                        <span className="text-base">📋</span>
                        <span>All items</span>
                      </button>
                      {categories.map((cat) => (
                        <button key={cat.id} type="button" onClick={() => setActiveCategory(cat.id)} className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-semibold transition ${activeCategory === cat.id ? 'bg-[#1e1a17] text-white shadow-md' : 'bg-white text-stone-700 hover:bg-[#f3e7d8]'}`}>
                          <span className="text-base">{cat.icon && (cat.icon.startsWith('/') || cat.icon.startsWith('http')) ? <img src={cat.icon} alt="" className="h-5 w-5 rounded-md object-cover" /> : cat.icon}</span>
                          <span>{cat.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </aside>
              )}

              <div className="min-w-0 flex-1">
                {search && (
                  <div className="px-1 py-3">
                    <p className="text-[13px] text-stone-500">
                      {filteredCategories.reduce((n, c) => n + c.products.length, 0)} results for <span className="font-semibold text-stone-700">&quot;{search}&quot;</span>
                    </p>
                  </div>
                )}

                {!search && categories.length > 0 && (
                  <>
                    {(() => {
                      if (activeCategory === 'all') {
                        return (
                          <section key="all">
                            <div className="mb-3 flex items-center gap-2 px-1">
                              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#f6e9d8] text-xl shadow-sm">📋</div>
                              <h2 className="text-[18px] font-bold text-stone-900 -tracking-[0.3px]">All Items</h2>
                              <span className="ml-auto rounded-full bg-[#f2eadf] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-600">{categories.reduce((n, c) => n + c.products.length, 0)}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              {categories.flatMap((cat) => cat.products).map((product) => {
                                const cartItem = cartStore.items.find((i) => i.productId === product.id);
                                const catInfo = categories.find((c) => c.products.some((p) => p.id === product.id));
                                return (
                                  <ProductCard
                                    key={product.id}
                                    product={product}
                                    catIcon={catInfo?.icon}
                                    cartItem={cartItem}
                                    isDetailOpen={selectedProductId === product.id}
                                    onOpenDetail={() => setSelectedProductId(product.id)}
                                    onCloseDetail={() => setSelectedProductId(null)}
                                    onAdd={() => handleAdd(product, catInfo?.id ?? 0, getDefaultSelections(product.id))}
                                    reviewSummary={ratingsMap[product.id]}
                                    onReviewSubmitted={handleReviewSubmitted}
                                    onOpenReviews={() => router.push(`/menu/reviews?productId=${product.id}&write=1`)}
                                    onUpdate={(qty) => cartStore.updateQuantity(lineKey(product.id, cartItem?.selections), qty)}
                                    bestSeller={bestSellerIds.has(product.id)}
                                  />
                                );
                              })}
                            </div>
                          </section>
                        );
                      }

                      const cat = categories.find((c) => c.id === activeCategory);
                      if (!cat) return null;
                      return (
                        <section key={cat.id}>
                          <div className="mb-3 flex items-center gap-2 px-1">
                            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl bg-[#f6e9d8] shadow-sm">
                              {cat.icon && (cat.icon.startsWith('/') || cat.icon.startsWith('http')) ? <img src={cat.icon} alt="" className="h-full w-full object-cover" /> : <span className="text-xl">{cat.icon}</span>}
                            </div>
                            <h2 className="text-[18px] font-bold text-stone-900 -tracking-[0.3px]">{cat.name}</h2>
                            <span className="ml-auto rounded-full bg-[#f2eadf] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-600">{cat.products.length}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {cat.products.map((product) => {
                              const cartItem = cartStore.items.find((i) => i.productId === product.id);
                              return (
                                <ProductCard
                                  key={product.id}
                                  product={product}
                                  catIcon={cat.icon}
                                  cartItem={cartItem}
                                  isDetailOpen={selectedProductId === product.id}
                                  onOpenDetail={() => setSelectedProductId(product.id)}
                                  onCloseDetail={() => setSelectedProductId(null)}
                                  onAdd={() => handleAdd(product, cat.id, getDefaultSelections(product.id))}
                                  reviewSummary={ratingsMap[product.id]}
                                  onReviewSubmitted={handleReviewSubmitted}
                                  onOpenReviews={() => router.push(`/menu/reviews?productId=${product.id}&write=1`)}
                                  onUpdate={(qty) => cartStore.updateQuantity(lineKey(product.id, cartItem?.selections), qty)}
                                  bestSeller={bestSellerIds.has(product.id)}
                                />
                              );
                            })}
                          </div>
                        </section>
                      );
                    })()}
                  </>
                )}

                {search && filteredCategories.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    {filteredCategories.flatMap((cat) => cat.products).map((product) => {
                      const cartItem = cartStore.items.find((i) => i.productId === product.id);
                      const foundCategory = categories.find((c) => c.products.some((p) => p.id === product.id));
                      return (
                        <ProductCard
                          key={product.id}
                          product={product}
                          catIcon={foundCategory?.icon}
                          cartItem={cartItem}
                          isDetailOpen={selectedProductId === product.id}
                          onOpenDetail={() => setSelectedProductId(product.id)}
                          onCloseDetail={() => setSelectedProductId(null)}
                          onAdd={() => handleAdd(product, foundCategory?.id ?? 0, getDefaultSelections(product.id))}
                          reviewSummary={ratingsMap[product.id]}
                          onReviewSubmitted={handleReviewSubmitted}
                          onOpenReviews={() => router.push(`/menu/reviews?productId=${product.id}&write=1`)}
                          onUpdate={(qty) => cartStore.updateQuantity(lineKey(product.id, cartItem?.selections), qty)}
                          bestSeller={bestSellerIds.has(product.id)}
                        />
                      );
                    })}
                  </div>
                )}

                {filteredCategories.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-24 text-center">
                    <span className="text-5xl mb-4">🔍</span>
                    <p className="text-stone-700 font-semibold text-[16px]">Nothing found</p>
                    <p className="text-stone-400 text-[13px] mt-1">No items match <span className="font-medium">&quot;{search}&quot;</span></p>
                    <button onClick={() => setSearch('')} className="mt-5 text-amber-600 text-[13px] font-semibold hover:underline">Clear search</button>
                  </div>
                )}

                {shouldShowPaymentBar && (
                  <div className="sticky bottom-0 z-20 mt-3 px-1 pb-1">
                    <div className="mx-auto w-full max-w-[320px] rounded-full border border-[#e9dac1] bg-[#fffaf4]/95 shadow-[0_10px_30px_rgba(60,42,27,0.14)] backdrop-blur-xl">
                      <Link href="/cart" className="flex w-full items-center justify-between gap-2 rounded-full bg-[#1f1a17] px-3 py-2 text-white transition active:scale-[0.98] hover:bg-[#312b28]">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#f7efe7] text-[11px] font-bold text-stone-900 shrink-0">🛒</span>
                          <span className="text-[11px] font-semibold whitespace-nowrap">{itemCount} item{itemCount > 1 ? 's' : ''}</span>
                        </div>
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="text-[12px] font-bold tabular-nums whitespace-nowrap">₱{cartTotal.toFixed(2)}</span>
                          <span className="flex h-8 items-center justify-center rounded-full bg-[#f8f1e8] px-2.5 text-[10px] font-bold text-stone-900 whitespace-nowrap">Pay</span>
                        </div>
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </main>

          {selectedProduct && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm animate-backdrop"
              onClick={() => setSelectedProductId(null)}
              style={{ cursor: 'zoom-out' }}
            >
              <div
                className="relative my-auto flex max-h-[86vh] w-[min(92vw,440px)] flex-col overflow-y-auto rounded-[28px] bg-white p-4 shadow-2xl animate-modal-in"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => setSelectedProductId(null)}
                  className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-xl font-bold text-gray-600 transition hover:bg-gray-300"
                  aria-label="Close"
                >×</button>

                <div className="mb-4 overflow-hidden rounded-[20px] border border-[#f0e5d8] bg-[#faf4ee]">
                  <img
                    src={selectedProduct.product.imageUrl || ''}
                    alt={selectedProduct.product.name}
                    className="h-56 w-full object-cover"
                    style={{ background: '#fafaf9' }}
                  />
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <h3 className="text-xl font-bold text-gray-900">{selectedProduct.product.name}</h3>
                      <span className="text-lg font-bold text-gray-900">₱{selectedProduct.product.price.toFixed(2)}</span>
                    </div>
                    {selectedProduct.product.description && (
                      <p className="text-sm leading-6 text-gray-600">{selectedProduct.product.description}</p>
                    )}
                  </div>

                  {selectedProduct.product.inventory && selectedProduct.product.inventory.quantity > 0 && selectedProduct.product.inventory.quantity <= selectedProduct.product.inventory.lowStockThreshold && (
                    <span className="inline-flex rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-orange-600">
                      Only {selectedProduct.product.inventory.quantity} left
                    </span>
                  )}

                  {productOptions.map((att) => {
                    if (!att?.group || !Array.isArray(att.options)) return null;
                    return (
                    <div key={att.id} className="rounded-2xl bg-white border-2 border-[#f0e5d8] p-3 shadow-sm">
                      <p className="text-xs font-bold uppercase tracking-wide text-stone-800 mb-2">
                        {att.group.name}
                        {att.group.selectionType === 'single' && <span className="text-gray-400 font-normal"> · choose one</span>}
                      </p>
                      {att.group.selectionType === 'single' ? (
                        <div className="flex flex-wrap gap-1.5">
                          {(att.options ?? []).map((opt) => {
                            const active = singlePicks[att.group.id] === opt.id;
                            return (
                              <button
                                key={opt.id}
                                onClick={() => setSinglePicks((prev) => ({ ...prev, [att.group.id]: opt.id }))}
                                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                                  active
                                    ? 'bg-amber-500 text-white border-amber-500'
                                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
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
                            const checked = multiPicks.includes(opt.id);
                            return (
                              <button
                                key={opt.id}
                                onClick={() =>
                                  setMultiPicks((prev) =>
                                    checked ? prev.filter((id) => id !== opt.id) : [...prev, opt.id]
                                  )
                                }
                                className={`flex w-full items-center justify-between px-3 py-2 rounded-xl border text-sm transition-colors ${
                                  checked
                                    ? 'border-black bg-white font-medium'
                                    : 'border-gray-200 bg-white hover:border-gray-300'
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
                    );
                  })}

                  <button
                    onClick={() => {
                      handleAdd(selectedProduct.product, selectedProduct.categoryIcon as any || 0, chosenSelections);
                      setSelectedProductId(null);
                    }}
                    disabled={!!selectedProduct.product.inventory && selectedProduct.product.inventory.quantity === 0}
                    className="flex h-12 w-full items-center justify-center rounded-full bg-[#1b1a18] px-4 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(31,26,23,0.2)] transition hover:bg-[#312d29] disabled:cursor-not-allowed disabled:bg-stone-300"
                  >
                    {!!selectedProduct.product.inventory && selectedProduct.product.inventory.quantity === 0 ? 'Out of Stock' : `Add to Order · ₱${popupUnitTotal.toFixed(2)}`}
                  </button>

                </div>
              </div>
            </div>
          )}

          <aside className="hidden w-90 shrink-0 xl:flex">
            <div className="flex h-full w-full flex-col overflow-hidden rounded-[30px] border border-[#eedec9] bg-[#fffdfb]/90 shadow-[0_18px_35px_rgba(86,59,34,0.08)] backdrop-blur-xl">
              <div className="flex items-center justify-between border-b border-[#f0e6d7] px-4 py-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8a6c45]">Order</p>
                  <h2 className="text-lg font-bold text-stone-900">Current ticket</h2>
                </div>
                <span className="rounded-full bg-[#f5efe7] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-700">{itemCount} items</span>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {cartStore.items.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center rounded-3xl border border-dashed border-[#e9dcc8] bg-[#faf5ee] p-6 text-center">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-2xl shadow-sm">🛒</div>
                    <p className="text-base font-semibold text-stone-800">Your cart is empty</p>
                    <p className="mt-2 text-sm text-stone-500">Add a few favorites to start checkout.</p>
                  </div>
                ) : (
                  cartStore.items.map((item) => (
                    <div key={item.productId} className="rounded-[22px] border border-[#f0e5d6] bg-[#fffaf5] p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-stone-900">{item.name}</p>
                          {(item.selections?.length ?? 0) > 0 && (
                            <p className="text-[11px] text-amber-700 mt-0.5">{item.selections!.map((s) => s.name).join(' · ')}</p>
                          )}
                          <p className="mt-0.5 text-[12px] text-stone-500">₱{item.price.toFixed(2)} each</p>
                        </div>
                        <button onClick={() => cartStore.removeItem(lineKey(item.productId, item.selections))} className="text-sm text-stone-400 transition hover:text-red-500">Remove</button>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 rounded-full border border-[#e9dcc8] bg-white px-2 py-1.5 shadow-sm">
                          <button onClick={() => cartStore.updateQuantity(lineKey(item.productId, item.selections), item.quantity - 1)} className="flex h-7 w-7 items-center justify-center rounded-full bg-[#f3e7d7] text-lg font-semibold text-stone-700">−</button>
                          <span className="min-w-5 text-center text-sm font-bold text-stone-800">{item.quantity}</span>
                          <button onClick={() => cartStore.updateQuantity(lineKey(item.productId, item.selections), item.quantity + 1)} className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1f1a17] text-lg font-semibold text-white">+</button>
                        </div>
                        <span className="text-[15px] font-bold text-stone-900">₱{(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="border-t border-[#f0e6d7] bg-[#fffdfb] p-4">
                <div className="mb-3 flex items-center justify-between text-sm text-stone-600">
                  <span>Subtotal</span>
                  <span className="font-semibold text-stone-800">₱{cartTotal.toFixed(2)}</span>
                </div>
                <div className="mb-4 flex items-center justify-between text-sm text-stone-600">
                  <span>Service</span>
                  <span className="font-semibold text-stone-800">₱0.00</span>
                </div>
                <div className="mb-4 flex items-center justify-between text-lg font-bold text-stone-900">
                  <span>Total</span>
                  <span className="tabular-nums">₱{cartTotal.toFixed(2)}</span>
                </div>
                <Link href="/cart" className="flex w-full items-center justify-center rounded-full bg-[#1f1a17] px-4 py-3.5 text-sm font-semibold text-white shadow-[0_16px_28px_rgba(29,25,23,0.2)] transition hover:bg-[#2d2724]">
                  Checkout
                </Link>
              </div>
            </div>
          </aside>
        </div>

      </div>
    </div>
  );
}

export default function MenuPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <MenuPageInner />
    </Suspense>
  );
}