'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  { id: 'orders',   label: '📋 Live Orders' },
  { id: 'queue',    label: '🍳 Staff Queue' },
  { id: 'tables',   label: '🪑 Tables' },
  { id: 'stations', label: '🏭 Stations' },
];

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

const KANBAN_COLUMNS = [
  { status: 'PENDING' as const,   label: 'Pending',   emoji: '⏳', accent: 'border-amber-300', headerBg: 'bg-amber-50', headerText: 'text-accent-text', badge: 'bg-amber-100 text-accent-text' },
  { status: 'PREPARING' as const, label: 'Preparing', emoji: '👨‍🍳', accent: 'border-blue-300',   headerBg: 'bg-blue-50',   headerText: 'text-blue-700',   badge: 'bg-blue-100 text-blue-700' },
  { status: 'COMPLETED' as const, label: 'Ready',     emoji: '✅', accent: 'border-green-300',  headerBg: 'bg-green-50',  headerText: 'text-green-700',  badge: 'bg-green-100 text-green-700' },
  { status: 'CANCELLED' as const, label: 'Cancelled', emoji: '✕',  accent: 'border-red-300',    headerBg: 'bg-red-50',    headerText: 'text-red-700',    badge: 'bg-red-100 text-red-700' },
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

  return (
    <div className={`flex flex-col h-screen ${mobileMode ? 'bg-gray-100 overflow-y-auto' : 'bg-gradient-to-br from-gray-50 to-gray-100'} text-gray-900`}>
      {/* Top Tab Navigation - Apple Style */}
      <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-xl border-b border-gray-200/50 px-2 sm:px-6 flex-shrink-0 shadow-sm">
        <div className="flex items-center gap-0.5 sm:gap-1 overflow-x-auto">
          {TOP_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 sm:px-5 py-3 font-medium text-xs sm:text-sm border-b-2 transition-all whitespace-nowrap rounded-t-lg ${
                activeTab === tab.id
                  ? 'border-black text-black bg-gray-50/50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50/50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'queue' && (
        <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0"><StaffQueuePanel /></div>
      )}
      {activeTab === 'tables' && (
        <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0"><TablesPanel /></div>
      )}
      {activeTab === 'stations' && (
        <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0"><StationsPanel /></div>
      )}
      {activeTab === 'orders' && (
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        {/* Kanban Toolbar - Premium Style */}
        <div className={`flex flex-col sm:flex-row items-center justify-between px-2 sm:px-6 py-2 sm:py-4 border-b bg-white/50 backdrop-blur-sm shrink-0 gap-2 ${mobileMode ? 'border-gray-200' : ''}`}>
          <div className="flex items-center gap-2 sm:gap-4">
            <span className={`font-medium ${mobileMode ? 'text-sm' : 'text-xs sm:text-sm'} text-gray-500`}>{orders.length} orders</span>
            <button
              onClick={() => setMobileMode(!mobileMode)}
              className={`px-2 py-1 rounded-full font-medium text-xs transition-all ${
                mobileMode 
                  ? 'bg-black text-white' 
                  : 'bg-gray-100 text-gray-600 border border-gray-200'
              }`}
            >
              {mobileMode ? '📱 Mobile' : '🖥️ Desktop'}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowVoicePanel(true)}
              className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 transition text-sm shadow-sm border border-gray-200"
              title="Voice Settings"
            >🔊</button>
          </div>
        </div>

        {/* Kanban Board - Premium Apple Style */}
        <div className={`flex-1 flex ${mobileMode ? 'flex-col' : 'md:gap-4'} p-1 md:p-4 overflow-x-auto ${mobileMode ? 'overflow-y-scroll' : 'overflow-y-hidden'} touch-pan-y min-h-0`}>
          {KANBAN_COLUMNS.map((col) => {
            const colOrders = ordersByStatus[col.status] || [];
            const isDragOver = dragOverColumn === col.status;
            return (
              <div
                key={col.status}
                data-kanban-col={col.status}
                className={`flex flex-col ${mobileMode ? 'w-full min-w-full mb-4' : 'min-w-[70vw] sm:min-w-[240px] md:min-w-[260px]'} flex-1 rounded-2xl border transition-all shadow-sm ${mobileMode ? 'bg-white border-gray-200' : ''} ${
                  isDragOver ? `${col.accent} bg-white` : 'border-gray-200 bg-white/80'
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
                {/* Column Header */}
                <div className={`px-2 sm:px-4 py-2 sm:py-3.5 rounded-t-2xl ${col.headerBg} border-b border-gray-100 flex items-center justify-between shrink-0 ${mobileMode ? 'border-gray-200' : ''}`}>
                  <div className="flex items-center gap-2.5">
                    <span className="text-lg">{col.emoji}</span>
                    <span className={`font-semibold text-sm ${col.headerText}`}>{col.label}</span>
                  </div>
                  <span className={`text-xs min-w-[24px] text-center px-2 py-0.5 rounded-full font-bold ${col.badge}`}>
                    {colOrders.length}
                  </span>
                </div>

                {/* Cards */}
                <div className={`flex-1 overflow-y-auto overflow-x-hidden p-2 space-y-2 ${mobileMode ? 'min-h-[150px]' : ''}`}>
                  {colOrders.length === 0 ? (
                    <div className="text-center py-10 text-gray-400 text-sm">
                      <div className="mb-2 text-2xl">📭</div>
                      No orders
                    </div>
                  ) : (
                    colOrders.map((order) => (
                      <div
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
                        className={`bg-white rounded-lg sm:rounded-xl p-1.5 sm:p-2.5 cursor-grab active:cursor-grabbing hover:shadow-md hover:shadow-gray-200/50 transition-all select-none border shadow-sm ${mobileMode ? 'border-gray-200 mb-1.5 touch-pan-y' : 'border-gray-100'}`}
                      >
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="font-mono font-bold text-[10px] text-gray-900">#{order.orderNumber.split('-').pop()}</span>
                          <div className="flex items-center gap-0.5">
                            {unreadOrders.has(order.orderNumber) && (
                              <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                            )}
                            {order.loyaltyPromo && <span className="text-[9px]">☕</span>}
                            {order.paymentMethod && order.paymentMethod !== 'CASH' && (
                              <span className="text-[9px]">{order.paymentMethod === 'GCASH' ? '📱' : order.paymentMethod === 'PAYMAYA' ? '📱' : '💵'}</span>
                            )}
                          </div>
                        </div>
                        <p className="text-[11px] font-semibold text-gray-900 truncate">{order.customerName}</p>
                        <div className="flex items-center justify-between mt-0.5">
                          <span className="text-[9px] text-gray-500">
                            {order.items.length} item{order.items.length !== 1 ? 's' : ''}
                          </span>
                          <span className="text-[11px] font-bold text-gray-900">₱{order.totalAmount.toFixed(0)}</span>
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                          <span className="text-[8px] text-gray-400">{timeAgo(order.createdAt)}</span>
                          {order.table && <span className="text-[8px] text-gray-500">📍 {order.table.name}</span>}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
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
                🧾 View Invoice
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
                <p className="flex items-center gap-2">🕐 {new Date(selected.createdAt).toLocaleString()}</p>
                {selected.table && <p className="flex items-center gap-2">📍 {selected.table.name}</p>}
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
                  💬 Messages
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
                          <span>{m.sender === 'staff' || m.sender === currentUser?.name ? `💼 ${m.sender}` : `🙋 ${m.sender}`}</span>
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
              <h3 className="font-bold text-lg text-gray-900">🔊 AI Voice Settings</h3>
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
                    onClick={() => {
                      const printWindow = window.open('', '_blank', 'width=350,height=600');
                      if (printWindow) {
                        const invVatRate = businessSettings?.vatRate ?? 12;
                        const invHasVat = invVatRate > 0;
                        const invSubtotal = invHasVat ? selectedOrder.totalAmount / (1 + invVatRate / 100) : selectedOrder.totalAmount;
                        const invVatAmount = invHasVat ? selectedOrder.totalAmount - invSubtotal : 0;

                        printWindow.document.write(`
                          <!DOCTYPE html>
                          <html>
                          <head>
                            <title>Receipt #${selectedOrder.orderNumber}</title>
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
                              .header { text-align: center; border-bottom: 1px dashed #666; padding-bottom: 8px; margin-bottom: 8px; }
                              .header h2 { margin: 0; font-size: 14px; }
                              .header p { margin: 2px 0; font-size: 9px; color: #666; }
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
                              <p>#${selectedOrder.orderNumber}</p>
                            </div>
                            <div class="items">
                              ${selectedOrder.items.map(item => `
                                <div class="item">
                                  <span class="item-name">${item.quantity}x ${item.product.name}</span>
                                  <span>₱${item.subtotal.toFixed(2)}</span>
                                </div>
                              `).join('')}
                            </div>
                            <div class="totals">
                              <div class="row"><span>Subtotal:</span><span>₱${invSubtotal.toFixed(2)}</span></div>
                              <div class="row"><span>VAT (${invVatRate}%):</span><span>₱${invVatAmount.toFixed(2)}</span></div>
                              <div class="row total-row"><span>TOTAL:</span><span>₱${selectedOrder.totalAmount.toFixed(2)}</span></div>
                              ${(selectedOrder as any).amountPaid ? `<div class="row"><span>Cash:</span><span>₱${(selectedOrder as any).amountPaid.toFixed(2)}</span></div><div class="row"><span>Change:</span><span>₱${((selectedOrder as any).amountPaid - selectedOrder.totalAmount).toFixed(2)}</span></div>` : ''}
                            </div>
                            <div class="vat-breakdown">
                              <strong>VAT Breakdown:</strong><br/>
                              Total Sales: ₱${selectedOrder.totalAmount.toFixed(2)}<br/>
                              VATable: ₱${invSubtotal.toFixed(2)}<br/>
                              VAT: ₱${invVatAmount.toFixed(2)}
                            </div>
                            <div class="footer">
                              ${businessSettings?.footerMessage || 'Thank you for your visit!'}
                            </div>
                          </body>
                          </html>
                        `);
                        printWindow.document.close();
                        printWindow.focus();
                        setTimeout(() => { printWindow.print(); printWindow.close(); }, 250);
                      }
                    }}
                    className="flex-1 py-2.5 bg-accent hover:bg-amber-500 text-white font-semibold text-sm rounded-xl transition flex items-center justify-center gap-1.5"
                  >
                    🖨️ Thermal
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 text-white font-semibold text-sm rounded-xl transition flex items-center justify-center gap-1.5"
                  >
                    📄 A4/Plain
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
