'use client';

import { printInvoice, printKitchenTicket } from '@/lib/print-documents';
import type { InvoiceOrder } from '@/lib/invoice';

/** Print failures are shown in the console and as a toast-free status (spec 019). */
function alertPrint(error?: string) {
  console.error('Print failed:', error);
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('pebot:print-failed', { detail: error }));
}

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { formatPeso } from '@/lib/format';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useSocket } from '@/hooks/useSocket';
import { playNewOrderSound, playMessageSound } from '@/lib/sounds';
import { fetchJson, userMessage } from '@/lib/fetch-json';
import { minutesSince, todayIsoDate } from '@/lib/dates';
import {
  type VoiceSettings,
  fetchVoiceSettings,
  saveVoiceSettings,
  DEFAULT_VOICE_SETTINGS,
  previewVoice,
} from '@/lib/sounds';

// Dynamic imports for sub-tabs
const StaffQueuePanel = dynamic(() => import('./kitchen/page'), { ssr: false });
const TablesPanel = dynamic(() => import('./tables/page'), { ssr: false });
const StationsPanel = dynamic(() => import('./stations/page'), { ssr: false });

type TopTab = 'orders' | 'queue' | 'tables' | 'stations';

interface CurrentUser {
  name: string;
  role: string;
}

const TOP_TABS: { id: TopTab; label: string }[] = [
  { id: 'orders',   label: 'Board' },
  { id: 'queue',    label: 'Staff queue' },
  { id: 'tables',   label: 'Tables' },
  { id: 'stations', label: 'Stations' },
];

/** Minutes after which an open ticket is called out as late. */
const LATE_AFTER_MIN = 15;

interface OrderItem {
  id: number;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  product: { name: string };
}

interface Order {
  id: number;
  orderNumber: string;
  customerName: string;
  status: 'PENDING' | 'PREPARING' | 'COMPLETED' | 'CANCELLED';
  totalAmount: number;
  loyaltyPromo?: boolean;
  paymentMethod?: string;
  paymentScreenshot?: string;
  createdAt: string;
  table?: { name: string };
  items: OrderItem[];
}

interface OrderMessage {
  id: number;
  type: string;
  content: string;
  sender: string;
  createdAt: string;
  orderNumber?: string;
  customerName?: string;
}

const statusColor = (status: string) => {
  switch (status) {
    case 'PENDING': return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'PREPARING': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'COMPLETED': return 'bg-green-100 text-green-800 border-green-200';
    case 'CANCELLED': return 'bg-red-100 text-red-800 border-red-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

function timeAgo(dateStr: string) {
  const mins = minutesSince(dateStr);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// Ticket colours follow the stage: sand = waiting, peach = cooking, sage = ready.
const KANBAN_COLUMNS = [
  { status: 'PENDING' as const,   label: 'Waiting',   dot: 'bg-[#C9A35B]', card: 'bg-tile-sand',  next: { status: 'PREPARING', label: 'Start' } },
  { status: 'PREPARING' as const, label: 'Preparing', dot: 'bg-accent',    card: 'bg-tile-peach', next: { status: 'COMPLETED', label: 'Mark ready' } },
  { status: 'COMPLETED' as const, label: 'Ready',     dot: 'bg-good',      card: 'bg-tile-sage',  next: null },
  { status: 'CANCELLED' as const, label: 'Cancelled', dot: 'bg-hair-strong', card: 'bg-panel',    next: null },
];

export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  // Simple auth check - just verify user is logged in
  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.user) {
          router.push('/login');
          return;
        }
        // User is logged in, allow access
        setAuthorized(true);
      })
      .catch((e) => {
        console.error('Could not confirm the signed-in user, returning to sign-in:', e);
        router.push('/login');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [router]);

  const [activeTab, setActiveTab] = useState<TopTab>(() => {
    // Try to restore from sessionStorage for page persistence
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('adminActiveTab');
      if (saved && TOP_TABS.some(t => t.id === saved)) {
        return saved as TopTab;
      }
    }
    return 'orders' as TopTab;
  });

  // Save active tab to sessionStorage for page persistence
  useEffect(() => {
    sessionStorage.setItem('adminActiveTab', activeTab);
  }, [activeTab]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [showInvoice, setShowInvoice] = useState(false);
  const [businessSettings, setBusinessSettings] = useState<any>(null);
  const [selected, setSelected] = useState<Order | null>(null);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const selectedRef = useRef<Order | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const dragItemRef = useRef<Order | null>(null);

  // Touch drag state for iPad/mobile
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const [touchDragging, setTouchDragging] = useState<{ order: Order; x: number; y: number } | null>(null);
  const touchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function getColumnAtPoint(x: number, y: number): string | null {
    const el = document.elementFromPoint(x, y);
    const col = el?.closest('[data-kanban-col]') as HTMLElement | null;
    return col?.dataset.kanbanCol || null;
  }

  function handleTouchStart(order: Order, e: React.TouchEvent) {
    const touch = e.touches[0];
    touchStartPos.current = { x: touch.clientX, y: touch.clientY };
    dragItemRef.current = order;
    // Long-press to start drag (300ms)
    touchTimerRef.current = setTimeout(() => {
      setTouchDragging({ order, x: touch.clientX, y: touch.clientY });
    }, 300);
  }

  function handleTouchMove(e: React.TouchEvent) {
    const touch = e.touches[0];
    if (touchTimerRef.current && touchStartPos.current) {
      const dx = Math.abs(touch.clientX - touchStartPos.current.x);
      const dy = Math.abs(touch.clientY - touchStartPos.current.y);
      if (dx > 10 || dy > 10) {
        // Started moving before long-press, start drag immediately
        if (!touchDragging && dragItemRef.current) {
          clearTimeout(touchTimerRef.current);
          touchTimerRef.current = null;
          setTouchDragging({ order: dragItemRef.current, x: touch.clientX, y: touch.clientY });
        }
      }
    }
    if (touchDragging) {
      e.preventDefault();
      setTouchDragging((prev) => prev ? { ...prev, x: touch.clientX, y: touch.clientY } : null);
      const col = getColumnAtPoint(touch.clientX, touch.clientY);
      setDragOverColumn(col);
    }
  }

  function handleTouchEnd() {
    if (touchTimerRef.current) { clearTimeout(touchTimerRef.current); touchTimerRef.current = null; }
    if (touchDragging) {
      const col = getColumnAtPoint(touchDragging.x, touchDragging.y);
      const order = touchDragging.order;
      if (col && order.status !== col) {
        updateStatus(order.id, col);
      }
      setTouchDragging(null);
      setDragOverColumn(null);
      dragItemRef.current = null;
    }
    touchStartPos.current = null;
  }

  // Messages state
  const [orderMessages, setOrderMessages] = useState<OrderMessage[]>([]);
  const [replyText, setReplyText] = useState('');
  const [replySending, setReplySending] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [msgNotif, setMsgNotif] = useState<Array<{ orderNumber: string; customerName: string }>>([]);
  const [followUpNotif, setFollowUpNotif] = useState<Array<{ orderNumber: string; customerName: string; tableName: string }>>([]);
  const [unreadOrders, setUnreadOrders] = useState<Set<string>>(new Set());
  const [mobileMode, setMobileMode] = useState(false);
  const [showItemsDropdown, setShowItemsDropdown] = useState(true);

  // Voice settings state
  const [showVoicePanel, setShowVoicePanel] = useState(false);
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>(DEFAULT_VOICE_SETTINGS);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

  // Load current user
  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.user) setCurrentUser(data.user); })
      .catch(() => {});
  }, []);

  // Load voice settings from server and available voices
  useEffect(() => {
    fetchVoiceSettings().then(setVoiceSettings);

    function loadVoices() {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length) setAvailableVoices(voices);
    }
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  function updateVoice(patch: Partial<VoiceSettings>) {
    setVoiceSettings((prev) => {
      const next = { ...prev, ...patch };
      saveVoiceSettings(next);
      return next;
    });
  }

  // Keep ref in sync
  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  const fetchOrders = useCallback(async () => {
    try {
      // Fetch all recent orders (last 3 days from server)
      const response = await fetch(`/api/orders`, { cache: 'no-store' });
      
      if (!response.ok) throw new Error('Failed to fetch orders');
      
      const allOrders: Order[] = await response.json();
      
      // Filter by today and yesterday (client-side, timezone-aware)
      const todayStr = todayIsoDate();
      const yesterdayStr = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      const filteredOrders = allOrders.filter(order => {
        const orderDate = new Date(order.createdAt).toISOString().split('T')[0];
        return orderDate === todayStr || orderDate === yesterdayStr;
      });
      
      setOrders(filteredOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (error) {
      console.error('Fetch error:', error);
    }
  }, []);

  // Load orders on mount
  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Periodic refresh every 30 seconds (socket events handle real-time updates)
  useEffect(() => {
    const interval = setInterval(fetchOrders, 30000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  // Fetch business settings for invoice
  useEffect(() => {
    fetch('/api/settings/business')
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setBusinessSettings(d))
      .catch(() => {});
  }, []);

  // Memoize socket events - DO NOT include selected in dependencies!
  // This prevents handlers from being re-registered when selected changes
  const socketEvents = useMemo(() => ({
    'new-order': (data: unknown) => {
      const order = data as Order;
      setOrders((prev) => {
        if (prev.find((o) => o.id === order.id)) {
          return prev;
        }
        return [order, ...prev];
      });
    },
    'order-status-update': (data: unknown) => {
      const order = data as Order;
      setOrders((prev) => {
        const updated = prev.map((o) => (o.id === order.id ? order : o));
        return updated.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      });
      // Use ref to avoid recreating handlers
      if (selectedRef.current?.id === order.id) {
        setSelected(order);
      }
    },
    'order-message': (data: unknown) => {
      const msg = data as OrderMessage;
      // Only notify for customer messages, not our own staff replies
      if (msg.sender === 'staff' || msg.sender === selected?.customerName) return;
      playMessageSound();
      // Show notification
      setMsgNotif((prev) => [...prev, { orderNumber: msg.orderNumber || '', customerName: msg.customerName || '' }]);
      setTimeout(() => setMsgNotif((prev) => prev.slice(1)), 5000);
      // Mark as unread unless currently viewing this order
      if (selectedRef.current?.orderNumber !== msg.orderNumber) {
        setUnreadOrders((prev) => new Set(prev).add(msg.orderNumber || ''));
      }
      // If currently viewing this order, add message to list
      if (selectedRef.current?.orderNumber === msg.orderNumber) {
        setOrderMessages((prev) => {
          // Deduplicate — the message may already exist from sendReply
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      }
    },
    'order-followup': (data: unknown) => {
      const fu = data as { orderNumber: string; customerName: string; tableName: string };
      playMessageSound();
      setFollowUpNotif((prev) => [...prev, fu]);
      setTimeout(() => setFollowUpNotif((prev) => prev.slice(1)), 8000);
    },
  }), []);

  // Socket events - real-time updates from server
  useSocket({
    events: socketEvents,
  });

  // Fetch messages when an order is selected
  useEffect(() => {
    if (!selected) { setOrderMessages([]); return; }
    fetchJson<OrderMessage[]>(`/api/orders/${selected.orderNumber}/messages`)
      .then(setOrderMessages)
      .catch((e) => {
        console.error(`Failed to load messages for order ${selected.orderNumber}:`, e);
        setOrderMessages([]);
      });
  }, [selected?.id]);

  async function sendReply() {
    if (!selected || !replyText.trim() || replySending) return;
    setReplySending(true);
    setReplyError(null);
    try {
      const msg = await fetchJson<OrderMessage>(`/api/orders/${selected.orderNumber}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'text', content: replyText.trim(), sender: currentUser?.name || 'Staff' }),
      });
      setOrderMessages((prev) => [...prev, msg]);
      setReplyText('');
    } catch (e) {
      console.error('Failed to send reply:', e);
      setReplyError(userMessage(e, 'The reply did not send. Try again.'));
    }
    setReplySending(false);
  }

  // Filter by status or loyalty
  const filtered = orders.filter((o) => {
    if (statusFilter === 'LOYALTY') {
      return o.loyaltyPromo === true;
    }
    return statusFilter === 'ALL' || o.status === statusFilter;
  });

  // Group orders by status for Kanban columns
  const ordersByStatus = useMemo(() => {
    const groups: Record<string, Order[]> = { PENDING: [], PREPARING: [], COMPLETED: [], CANCELLED: [] };
    orders.forEach((o) => { if (groups[o.status]) groups[o.status].push(o); });
    return groups;
  }, [orders]);

  async function updateStatus(orderId: number, newStatus: string) {
    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!response.ok) throw new Error('Failed');
      
      const updated = await response.json();
      setOrders((prev) => {
        const next = prev.map((o) => (o.id === updated.id ? updated : o));
        return next.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      });
      if (selected?.id === updated.id) setSelected(updated);
    } catch (error) {
      console.error('Update error:', error);
    }
  }

  // Show loading while checking permissions
  if (loading || !authorized) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-950">
        <div className="text-amber-400 text-lg">Checking permissions...</div>
      </div>
    );
  }

  const openOrders = orders.filter((o) => o.status === 'PENDING' || o.status === 'PREPARING');
  const lateCount = openOrders.filter((o) => minutesSince(o.createdAt) >= LATE_AFTER_MIN).length;
  const avgWait = openOrders.length
    ? Math.round(openOrders.reduce((sum, o) => sum + minutesSince(o.createdAt), 0) / openOrders.length)
    : 0;
  const oldest = openOrders.reduce((m, o) => Math.max(m, minutesSince(o.createdAt)), 0);

  return (
    <div className="flex h-full min-h-screen flex-col bg-page text-ink">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-4 px-6 pb-4 pt-6">
        <div className="min-w-0">
          <h1 className="c-title">Live orders</h1>
          <p className="mt-1.5 text-sm text-muted">
            <span className="font-semibold text-ink">{ordersByStatus.PENDING.length} waiting</span> · {ordersByStatus.PREPARING.length} preparing ·{' '}
            {ordersByStatus.COMPLETED.length} ready
            {openOrders.length > 0 && <> · oldest open ticket <span className="font-semibold text-ink">{oldest} min</span></>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl bg-panel p-1" role="tablist" aria-label="Live order views">
            {TOP_TABS.map((tab) => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`h-9 rounded-[10px] px-3.5 text-[13px] font-semibold transition ${activeTab === tab.id ? 'bg-card text-ink shadow-card' : 'text-muted hover:text-ink'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {activeTab === 'orders' && (
            <>
              <button
                onClick={() => setMobileMode(!mobileMode)}
                className="c-btn c-btn--ghost h-11"
                title={mobileMode ? 'Show columns side by side' : 'Stack columns (phones)'}
              >
                {mobileMode ? 'Columns' : 'Stacked'}
              </button>
              <button onClick={() => setShowVoicePanel(true)} className="c-btn c-btn--ghost h-11" title="Voice announcements">
                Voice
              </button>
            </>
          )}
        </div>
      </header>

      {/* Tab content */}
      {activeTab === 'queue' && (
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden"><StaffQueuePanel /></div>
      )}
      {activeTab === 'tables' && (
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden"><TablesPanel /></div>
      )}
      {activeTab === 'stations' && (
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden"><StationsPanel /></div>
      )}
      {activeTab === 'orders' && (
      <div className="flex min-h-0 flex-1 flex-col">
        {/* Headline numbers */}
        <div className="grid grid-cols-2 gap-3 px-6 pb-4 md:grid-cols-4">
          {[
            { label: 'Open tickets', value: String(openOrders.length), note: `${ordersByStatus.COMPLETED.length} ready to hand over`, tile: 'bg-tile-peach' },
            { label: 'Average wait', value: `${avgWait} min`, note: 'Waiting and preparing', tile: 'bg-tile-sand' },
            { label: 'Late', value: String(lateCount), note: `Open more than ${LATE_AFTER_MIN} min`, tile: lateCount > 0 ? 'bg-danger-bg' : 'bg-tile-sage' },
            { label: 'Today so far', value: String(orders.length), note: `${ordersByStatus.CANCELLED.length} cancelled`, tile: 'bg-tile-sky' },
          ].map((t) => (
            <div key={t.label} className={`rounded-[18px] px-4 py-3 ${t.tile}`}>
              <p className="text-xs font-semibold text-muted">{t.label}</p>
              <p className="mt-0.5 text-2xl font-bold tabular-nums tracking-[-0.03em]">{t.value}</p>
              <p className="truncate text-xs text-muted">{t.note}</p>
            </div>
          ))}
        </div>

        {/* Board */}
        <div className={`flex min-h-0 flex-1 gap-4 overflow-x-auto px-6 pb-6 ${mobileMode ? 'flex-col overflow-y-auto' : ''} touch-pan-y`}>
          {KANBAN_COLUMNS.map((col) => {
            const colOrders = ordersByStatus[col.status] || [];
            const isDragOver = dragOverColumn === col.status;
            const colTotal = colOrders.reduce((sum, o) => sum + o.totalAmount, 0);
            return (
              <section
                key={col.status}
                data-kanban-col={col.status}
                aria-label={col.label}
                className={`flex min-h-0 flex-col rounded-[20px] border transition-colors ${mobileMode ? 'w-full' : col.status === 'CANCELLED' ? 'min-w-[170px] flex-[0.6]' : 'min-w-[220px] flex-1'} ${
                  isDragOver ? 'border-accent bg-accent-soft/40' : 'border-hair bg-card'
                }`}
                onDragOver={(e) => { e.preventDefault(); if (!mobileMode) setDragOverColumn(col.status); }}
                onDragLeave={() => setDragOverColumn(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverColumn(null);
                  const order = dragItemRef.current;
                  if (order && order.status !== col.status) {
                    updateStatus(order.id, col.status);
                  }
                  dragItemRef.current = null;
                }}
              >
                <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-4">
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${col.dot}`} aria-hidden />
                    <h2 className="text-[15px] font-bold">{col.label}</h2>
                    <span className="rounded-full bg-panel px-2 text-xs font-semibold tabular-nums text-muted">{colOrders.length}</span>
                  </div>
                  <span className="text-xs tabular-nums text-faint">{formatPeso(colTotal)}</span>
                </div>

                <div className={`min-h-0 flex-1 space-y-2.5 overflow-y-auto overflow-x-hidden px-3 pb-3 ${mobileMode ? 'min-h-[120px]' : ''}`}>
                  {colOrders.length === 0 ? (
                    <div className="flex h-24 items-center justify-center rounded-[16px] border border-dashed border-hair text-xs text-faint">
                      {col.status === 'PENDING' ? 'New orders land here' : col.status === 'CANCELLED' ? 'Nothing cancelled' : 'Drag a ticket here'}
                    </div>
                  ) : (
                    colOrders.map((order) => {
                      const age = minutesSince(order.createdAt);
                      const late = (order.status === 'PENDING' || order.status === 'PREPARING') && age >= LATE_AFTER_MIN;
                      const shown = order.items.slice(0, 4);
                      const more = order.items.length - shown.length;
                      return (
                        <article
                          key={order.id}
                          draggable={!mobileMode}
                          onDragStart={() => { dragItemRef.current = order; }}
                          onDragEnd={() => { dragItemRef.current = null; setDragOverColumn(null); }}
                          onTouchStart={(e) => !mobileMode && handleTouchStart(order, e)}
                          onTouchMove={(e) => !mobileMode && handleTouchMove(e)}
                          onTouchEnd={() => !mobileMode && handleTouchEnd()}
                          onClick={() => {
                            if (touchDragging) return;
                            setSelected(order);
                            setUnreadOrders((prev) => { const next = new Set(prev); next.delete(order.orderNumber); return next; });
                          }}
                          className={`cursor-grab select-none rounded-[16px] p-3.5 transition active:cursor-grabbing hover:shadow-card ${col.card} ${mobileMode ? 'touch-pan-y' : ''}`}
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="rounded-full bg-card/70 px-2 py-0.5 text-[11px] font-bold tabular-nums">#{order.orderNumber.split('-').pop()}</span>
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${late ? 'bg-danger text-white' : 'bg-card/70 text-muted'}`}>
                              {timeAgo(order.createdAt)}{late ? ' · late' : ''}
                            </span>
                            {unreadOrders.has(order.orderNumber) && <span className="h-2 w-2 rounded-full bg-danger" title="New message" />}
                            {order.loyaltyPromo && <span className="ml-auto rounded-full bg-card/70 px-2 py-0.5 text-[11px] font-semibold text-accent-text">Reward</span>}
                          </div>
                          <h3 className="mt-2 truncate text-[17px] font-bold tracking-[-0.02em]">
                            {order.table ? order.table.name : order.customerName}
                          </h3>
                          {order.table && <p className="-mt-0.5 truncate text-xs text-muted">{order.customerName}</p>}
                          <ul className="mt-2 space-y-0.5 rounded-[12px] bg-card/60 px-3 py-2 text-[13px]">
                            {shown.map((item) => (
                              <li key={item.id} className="flex gap-2">
                                <span className="w-6 shrink-0 font-semibold tabular-nums">{item.quantity}×</span>
                                <span className="min-w-0 truncate">{item.product.name}</span>
                              </li>
                            ))}
                            {more > 0 && <li className="pl-8 text-xs text-muted">+{more} more</li>}
                          </ul>
                          <div className="mt-2.5 flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-[15px] font-bold tabular-nums">{formatPeso(order.totalAmount)}</p>
                              <p className="text-[11px] text-muted">
                                {order.items.reduce((n, i) => n + i.quantity, 0)} items
                                {order.paymentMethod ? ` · ${order.paymentMethod === 'GCASH' ? 'GCash' : order.paymentMethod === 'PAYMAYA' || order.paymentMethod === 'MAYA' ? 'Maya' : order.paymentMethod === 'CASH' ? 'Cash' : order.paymentMethod}` : ''}
                              </p>
                            </div>
                            {col.next && (
                              <button
                                onClick={(e) => { e.stopPropagation(); updateStatus(order.id, col.next!.status); }}
                                className="h-9 shrink-0 whitespace-nowrap rounded-full bg-ink px-3.5 text-[13px] font-semibold text-white transition hover:bg-[#3E3832]"
                              >
                                {col.next.label}
                              </button>
                            )}
                          </div>
                        </article>
                      );
                    })
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>
      )}

      {/* Touch drag ghost - Premium Style */}
      {touchDragging && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{ left: touchDragging.x - 80, top: touchDragging.y - 25 }}
        >
          <div className="bg-white border-2 border-black rounded-xl p-2 sm:p-3 shadow-2xl w-[160px] sm:w-[200px]">
            <span className="font-mono font-bold text-[10px] sm:text-xs text-gray-900">#{touchDragging.order.orderNumber.split('-').pop()}</span>
            <p className="text-xs sm:text-sm font-semibold text-gray-900 truncate">{touchDragging.order.customerName}</p>
            <span className="text-[10px] sm:text-[11px] text-gray-500">{touchDragging.order.items.length} items · ₱{touchDragging.order.totalAmount.toFixed(0)}</span>
          </div>
        </div>
      )}

      {/* ===== Slide-over Panels (overlay on top of any content) ===== */}

      {/* Order Detail Slide-over - Premium Style */}
      {selected && !showVoicePanel && (
        <div className="fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setSelected(null)} />
          <div className="relative ml-auto w-full max-w-md bg-white border-l border-gray-200 shadow-2xl flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0 bg-gray-50/50">
              <div>
                <h3 className="font-bold text-lg text-gray-900">{selected.orderNumber}</h3>
                <p className="text-sm text-gray-500">{selected.customerName}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-xl transition w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Status buttons — Premium Style */}
              <div className="flex gap-2 flex-wrap">
                {(['PENDING', 'PREPARING', 'COMPLETED', 'CANCELLED'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => updateStatus(selected.id, s)}
                    disabled={selected.status === s}
                    className={`px-4 py-2 rounded-xl font-medium text-xs transition ${
                      selected.status === s
                        ? `${statusColor(s)} ring-2 ring-gray-300/50`
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200 border border-gray-200'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>

              {/* Invoice Button */}
              <button
                onClick={() => {
                  setSelectedOrder(selected);
                  setShowInvoice(true);
                }}
                className="w-full py-3 bg-accent hover:bg-amber-500 text-white font-semibold rounded-xl transition flex items-center justify-center gap-2"
              >
                View Invoice
              </button>

              {/* Order Items - Collapsible Dropdown */}
              <div className="bg-gray-50 rounded-2xl overflow-hidden">
                <button
                  onClick={() => setShowItemsDropdown(!showItemsDropdown)}
                  className="w-full p-4 flex items-center justify-between text-left hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">📋</span>
                    <span className="font-semibold text-gray-700">Items ({selected.items.length})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-900">₱{selected.totalAmount.toFixed(2)}</span>
                    <span className={`transform transition-transform ${showItemsDropdown ? 'rotate-180' : ''} text-gray-400`}>▼</span>
                  </div>
                </button>
                {showItemsDropdown && (
                  <div className="px-4 pb-4 border-t border-gray-200">
                    <div className="py-3 space-y-3">
                      {selected.items.map((item) => (
                        <div key={item.id} className="flex justify-between items-center">
                          <div className="flex-1">
                            <p className="text-gray-900 font-medium">{item.product.name}</p>
                            <p className="text-gray-500 text-sm">×{item.quantity} @ ₱{item.unitPrice.toFixed(2)}</p>
                          </div>
                          <span className="font-bold text-gray-900 text-lg">₱{item.subtotal.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="border-t border-gray-200 pt-3 flex justify-between font-bold text-base">
                      <span className="text-gray-600">Total</span>
                      <span className="text-gray-900">₱{selected.totalAmount.toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Order Info - Premium Style */}
              <div className="bg-gray-50 rounded-2xl p-4 space-y-2 text-sm text-gray-600">
                <p className="flex items-center gap-2">{new Date(selected.createdAt).toLocaleString()}</p>
                {selected.table && <p className="flex items-center gap-2">{selected.table.name}</p>}
                {selected.paymentMethod && (
                  <p className="flex items-center gap-2">💳 <span className={`font-semibold ${
                  selected.paymentMethod === 'CASH' ? 'text-green-600' :
                    selected.paymentMethod === 'GCASH' ? 'text-blue-600' :
                    selected.paymentMethod === 'PAYMAYA' ? 'text-blue-600' : 'text-slate-500'
                  }`}>
                  {selected.paymentMethod === 'CASH' ? 'Cash' :
                   selected.paymentMethod === 'GCASH' ? 'GCash' :
                   selected.paymentMethod === 'PAYMAYA' ? 'PayMaya' : selected.paymentMethod}
                  </span></p>
                )}
                {selected.paymentScreenshot && (
                  <a href={selected.paymentScreenshot} target="_blank" rel="noopener noreferrer">
                    <img src={selected.paymentScreenshot} alt="Payment proof" className="max-w-full max-h-48 rounded-xl border border-gray-200 mt-2 hover:opacity-80 transition shadow-sm" />
                  </a>
                )}
              </div>

              {/* Messages - Premium Style */}
              <div className="bg-gray-50 rounded-2xl p-4">
                <h4 className="font-semibold text-sm mb-3 flex items-center gap-2 text-gray-700">
                  Messages
                  {orderMessages.length > 0 && (
                    <span className="text-[10px] bg-gray-900 text-white px-2 py-0.5 rounded-full">{orderMessages.length}</span>
                  )}
                </h4>
                {orderMessages.length === 0 ? (
                  <p className="text-xs text-gray-400">No messages yet</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto mb-3">
                    {orderMessages.map((m) => (
                      <div key={m.id} className={`p-3 rounded-xl text-xs ${
                        m.sender === 'staff'
                          ? 'bg-gray-900 text-white ml-3'
                          : 'bg-white border border-gray-200'
                      }`}>
                        <div className="flex items-center gap-1 mb-1 text-[10px] text-gray-500">
                          <span>{m.sender === 'staff' || m.sender === currentUser?.name ? `${m.sender}` : `${m.sender}`}</span>
                          <span>·</span>
                          <span>{new Date(m.createdAt).toLocaleTimeString()}</span>
                        </div>
                        {m.type === 'voice' ? (
                          <audio src={m.content} controls className="w-full h-8" />
                        ) : (
                          <p className="text-gray-700">{m.content}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2 mt-3">
                  <input
                    type="text" value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendReply()}
                    placeholder="Reply..."
                    className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 focus:border-gray-300"
                    disabled={replySending}
                  />
                  <button onClick={sendReply} disabled={!replyText.trim() || replySending}
                    className="bg-black hover:bg-gray-800 text-white px-5 rounded-xl font-semibold text-sm transition disabled:opacity-40 shadow-lg shadow-black/10">
                    Send
                  </button>
                </div>
                {replyError && (
                  <p className="mt-2 text-sm text-red-600">{replyError}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Voice Settings Slide-over - Premium Style */}
      {showVoicePanel && (
        <div className="fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setShowVoicePanel(false)} />
          <div className="relative ml-auto w-full max-w-md bg-white border-l border-gray-200 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0 bg-gray-50/50">
              <h3 className="font-bold text-lg text-gray-900">AI Voice Settings</h3>
              <button onClick={() => setShowVoicePanel(false)} className="text-gray-400 hover:text-gray-600 text-xl transition w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Enable / Disable - Premium Style */}
              <div className="bg-gray-50 rounded-2xl p-5">
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="font-semibold text-gray-700">Voice Notifications</span>
                  <div
                    onClick={() => updateVoice({ enabled: !voiceSettings.enabled })}
                    className={`w-14 h-8 rounded-full flex items-center transition-colors ${
                      voiceSettings.enabled ? 'bg-black' : 'bg-gray-300'
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-full bg-white shadow-md transition-transform ${
                      voiceSettings.enabled ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </div>
                </label>
              </div>

              {/* Voice Selection - Premium Style */}
              <div className="bg-gray-50 rounded-2xl p-5">
                <label className="block text-sm font-semibold text-gray-700 mb-3">AI Voice</label>
                <select
                  value={voiceSettings.voiceName}
                  onChange={(e) => updateVoice({ voiceName: e.target.value })}
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-900 shadow-sm"
                >
                  <option value="">Auto (English)</option>
                  {availableVoices.map((v) => (
                    <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>
                  ))}
                </select>
              </div>

              {/* Rate & Pitch - Premium Style */}
              <div className="bg-gray-50 rounded-2xl p-5 grid grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Speed: {voiceSettings.rate.toFixed(1)}x
                  </label>
                  <input type="range" min="0.5" max="2" step="0.1" value={voiceSettings.rate}
                    onChange={(e) => updateVoice({ rate: parseFloat(e.target.value) })}
                    className="w-full accent-black" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Pitch: {voiceSettings.pitch.toFixed(1)}
                  </label>
                  <input type="range" min="0" max="2" step="0.1" value={voiceSettings.pitch}
                    onChange={(e) => updateVoice({ pitch: parseFloat(e.target.value) })}
                    className="w-full accent-black" />
                </div>
              </div>

              {/* Volume - Premium Style */}
              <div className="bg-gray-50 rounded-2xl p-5">
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Volume: {Math.round(voiceSettings.volume * 100)}%
                </label>
                <input type="range" min="0" max="1" step="0.05" value={voiceSettings.volume}
                  onChange={(e) => updateVoice({ volume: parseFloat(e.target.value) })}
                  className="w-full accent-black" />
              </div>

              {/* Custom Messages - Premium Style */}
              <div className="bg-gray-50 rounded-2xl p-5 space-y-4">
                <h3 className="font-semibold text-gray-700 text-sm">Voice Messages</h3>
                {[
                  { key: 'msgNewOrder' as const, label: 'New Order (Staff)' },
                  { key: 'msgPreparing' as const, label: 'Order Preparing (Customer)' },
                  { key: 'msgCompleted' as const, label: 'Order Completed (Customer)' },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <label className="block text-xs text-gray-500 mb-1.5">{label}</label>
                    <input type="text" value={voiceSettings[key]}
                      onChange={(e) => updateVoice({ [key]: e.target.value })}
                      className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 text-sm shadow-sm" />
                  </div>
                ))}
              </div>

              {/* Preview & Reset - Premium Style */}
              <div className="flex gap-3 pt-2">
                <button onClick={() => previewVoice()}
                  className="flex-1 bg-black hover:bg-gray-800 text-white font-semibold py-3.5 rounded-xl transition shadow-lg shadow-black/20">
                  ▶ Preview Voice
                </button>
                <button onClick={() => { updateVoice(DEFAULT_VOICE_SETTINGS); setVoiceSettings(DEFAULT_VOICE_SETTINGS); }}
                  className="px-5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3.5 rounded-xl transition border border-gray-200">
                  Reset
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Message notification toasts - Premium Style */}
      {msgNotif.length > 0 && (
        <div className="fixed top-4 right-4 z-50 space-y-2">
          {msgNotif.map((n, i) => (
            <div key={i} className="bg-black text-white px-5 py-3.5 rounded-2xl shadow-2xl text-sm animate-bounce max-w-xs border border-gray-800">
              💬 <strong>{n.customerName}</strong> sent a message on <strong>{n.orderNumber}</strong>
            </div>
          ))}
        </div>
      )}

      {/* Follow-up notification toasts - Premium Style */}
      {followUpNotif.length > 0 && (
        <div className="fixed top-20 right-4 z-50 space-y-2">
          {followUpNotif.map((n, i) => (
            <div key={i} className="bg-amber-500 text-white px-5 py-3.5 rounded-2xl shadow-2xl text-sm animate-bounce max-w-xs">
              📣 <strong>{n.tableName}</strong> ({n.customerName}) followed up <strong>{n.orderNumber}</strong>
            </div>
          ))}
        </div>
      )}

      {/* Invoice Modal - Thermal Printer Optimized */}
      {selectedOrder && showInvoice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={(e) => e.target === e.currentTarget && setShowInvoice(false)}>
            {/* Thermal Receipt Preview - 80mm width */}
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto">
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
                <p className="text-xs font-mono mt-2 text-gray-700">#{selectedOrder.orderNumber}</p>
                <button
                  onClick={() => setShowInvoice(false)}
                  className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 text-lg w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-200"
                >✕</button>
              </div>

              {/* Receipt Body */}
              <div className="px-4 py-3">
                {/* Transaction Info */}
                <div className="text-[10px] space-y-1 border-b border-gray-200 pb-3">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Date:</span>
                    <span className="text-gray-800">{new Date(selectedOrder.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Time:</span>
                    <span className="text-gray-800">{new Date(selectedOrder.createdAt).toLocaleTimeString()}</span>
                  </div>
                  {selectedOrder.customerName && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Customer:</span>
                      <span className="text-gray-800 font-medium">{selectedOrder.customerName}</span>
                    </div>
                  )}
                  {selectedOrder.table && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Table:</span>
                      <span className="text-gray-800">{selectedOrder.table.name}</span>
                    </div>
                  )}
                  {(selectedOrder as any).serverName && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Server:</span>
                      <span className="text-gray-800">{(selectedOrder as any).serverName}</span>
                    </div>
                  )}
                  {selectedOrder.paymentMethod && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Payment:</span>
                      <span className="text-gray-800 font-medium">{selectedOrder.paymentMethod === 'CASH' ? 'CASH' : selectedOrder.paymentMethod === 'GCASH' ? 'GCASH' : selectedOrder.paymentMethod === 'PAYMAYA' ? 'PAYMAYA' : selectedOrder.paymentMethod}</span>
                    </div>
                  )}
                </div>

                {/* Items - Thermal Format */}
                <div className="py-3 border-b border-gray-200">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">━━━━━ ITEMS ━━━━━</p>
                  <div className="space-y-1.5">
                    {selectedOrder.items.map((item) => (
                      <div key={item.id} className="text-[11px]">
                        <div className="flex justify-between items-start">
                          <span className="text-gray-800 flex-1">{item.product.name}</span>
                          <span className="text-gray-800 font-medium ml-2">₱{item.subtotal.toFixed(2)}</span>
                        </div>
                        <div className="text-gray-500 text-[10px]">
                          {item.quantity} x ₱{item.unitPrice.toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Totals - Thermal Format */}
                {(() => {
                  const invVatRate = businessSettings?.vatRate ?? 12;
                  const invHasVat = invVatRate > 0;
                  const invSubtotal = invHasVat ? selectedOrder.totalAmount / (1 + invVatRate / 100) : selectedOrder.totalAmount;
                  const invVatAmount = invHasVat ? selectedOrder.totalAmount - invSubtotal : 0;
                  return (
                    <div className="py-3 space-y-1 text-[11px] border-b border-gray-200">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Subtotal:</span>
                        <span className="text-gray-800">₱{invSubtotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">VAT ({invVatRate}%):</span>
                        <span className="text-gray-800">₱{invVatAmount.toFixed(2)}</span>
                      </div>
                    </div>
                  );
                })()}

                {/* Grand Total */}
                <div className="py-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-gray-900">TOTAL</span>
                    <span className="text-lg font-bold text-gray-900">₱{selectedOrder.totalAmount.toFixed(2)}</span>
                  </div>
                  {(selectedOrder as any).amountPaid !== undefined && (selectedOrder as any).amountPaid > 0 && (
                    <>
                      <div className="flex justify-between text-[10px] mt-1">
                        <span className="text-gray-500">Cash Tendered:</span>
                        <span className="text-gray-800">₱{(selectedOrder as any).amountPaid.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-[10px]">
                        <span className="text-gray-500">Change:</span>
                        <span className="text-gray-800 font-medium">₱{((selectedOrder as any).amountPaid - selectedOrder.totalAmount).toFixed(2)}</span>
                      </div>
                    </>
                  )}
                </div>

                {/* VAT Breakdown - BIR Required */}
                {(() => {
                  const invVatRate = businessSettings?.vatRate ?? 12;
                  const invHasVat = invVatRate > 0;
                  const invSubtotal = invHasVat ? selectedOrder.totalAmount / (1 + invVatRate / 100) : selectedOrder.totalAmount;
                  const invVatAmount = invHasVat ? selectedOrder.totalAmount - invSubtotal : 0;
                  return (
                    <div className="py-2 text-[9px] text-gray-500 border-t border-dashed border-gray-200 mt-2">
                      <p className="font-medium text-gray-600">VAT Breakdown:</p>
                      <p>Total Sales (VAT Incl): ₱{selectedOrder.totalAmount.toFixed(2)}</p>
                      <p>VATable Sales: ₱{invSubtotal.toFixed(2)}</p>
                      <p>VAT Amount ({invVatRate}%): ₱{invVatAmount.toFixed(2)}</p>
                    </div>
                  );
                })()}

                {/* Footer */}
                <p className="text-center text-[10px] text-gray-500 pt-3 mt-2">
                  {businessSettings?.footerMessage || 'Thank you for your visit!'}
                </p>
                <p className="text-center text-[9px] text-gray-400">
                  {businessSettings?.businessAddress ? 'Please come again!' : ''}
                </p>

                {/* Print Buttons */}
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={async () => {
                      const r = await printInvoice(selectedOrder as unknown as InvoiceOrder, businessSettings, { copyLabel: 'Reprint' });
                      if (!r.ok) alertPrint(r.error);
                    }}
                    className="c-btn c-btn--primary flex-1"
                  >
                    Print invoice
                  </button>
                  <button
                    onClick={async () => {
                      const r = await printInvoice(selectedOrder as unknown as InvoiceOrder, businessSettings, { paper: 'A4', copyLabel: 'Reprint' });
                      if (!r.ok) alertPrint(r.error);
                    }}
                    className="c-btn c-btn--ghost flex-1"
                  >
                    A4 copy
                  </button>
                  <button
                    onClick={async () => {
                      const r = await printKitchenTicket(selectedOrder as unknown as InvoiceOrder, businessSettings);
                      if (!r.ok) alertPrint(r.error);
                    }}
                    className="c-btn c-btn--ghost flex-1"
                  >
                    Kitchen ticket
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
