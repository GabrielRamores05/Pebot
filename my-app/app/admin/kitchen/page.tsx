'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { playNewOrderSound, playMessageSound } from '@/lib/sounds';
import { selectionsLabelFromJson } from '@/lib/product-options';
import { ticketCode } from '@/lib/ticket';

interface OrderItem {
  id: number;
  quantity: number;
  selections?: string | null;
  product: { name: string; stationType?: string };
}

interface OrderMessage {
  id: number;
  orderId: number;
  type: string;
  content: string;
  sender: string;
  createdAt: string;
}

interface Order {
  id: number;
  orderNumber: string;
  customerName: string;
  status: 'PENDING' | 'PREPARING' | 'COMPLETED' | 'CANCELLED';
  totalAmount: number;
  createdAt: string;
  table?: { name: string };
  orderType?: string;
  deliveryAddress?: string | null;
  items: OrderItem[];
  messages?: OrderMessage[];
}

type StationKey = 'coffee' | 'kitchen' | 'bar' | 'pastry' | 'general';

const STATIONS: { key: StationKey; icon: string; label: string; border: string; bg: string; badge: string }[] = [
  { key: 'coffee',  icon: '☕', label: 'Coffee',  border: 'border-amber-500/50', bg: 'bg-amber-500/10', badge: 'bg-amber-500' },
  { key: 'kitchen', icon: '🍳', label: 'Kitchen', border: 'border-red-500/50',   bg: 'bg-red-500/10',   badge: 'bg-red-500' },
  { key: 'bar',     icon: '🥤', label: 'Bar',     border: 'border-blue-500/50',  bg: 'bg-blue-500/10',  badge: 'bg-blue-500' },
  { key: 'pastry',  icon: '🧁', label: 'Pastry',  border: 'border-pink-500/50',  bg: 'bg-pink-500/10',  badge: 'bg-pink-500' },
  { key: 'general', icon: '📦', label: 'General', border: 'border-gray-500/50',  bg: 'bg-gray-500/10',  badge: 'bg-gray-500' },
];

function getItemStation(item: OrderItem): StationKey {
  const s = item.product.stationType?.toLowerCase();
  if (s && STATIONS.some((st) => st.key === s)) return s as StationKey;
  return 'general';
}

function groupByStation(orders: Order[]) {
  const grouped: Record<StationKey, { order: Order; items: OrderItem[] }[]> = {
    coffee: [], kitchen: [], bar: [], pastry: [], general: [],
  };
  for (const order of orders) {
    const byStation: Record<string, OrderItem[]> = {};
    for (const item of order.items) {
      const st = getItemStation(item);
      (byStation[st] ||= []).push(item);
    }
    for (const [st, items] of Object.entries(byStation)) {
      grouped[st as StationKey].push({ order, items });
    }
  }
  return grouped;
}

export default function AdminKitchenPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeStation, setActiveStation] = useState<StationKey | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'active' | 'completed'>('active');
  const [confirmAction, setConfirmAction] = useState<{ orderId: number; action: string; label: string } | null>(null);
  const [updating, setUpdating] = useState<number | null>(null);
  const [followUps, setFollowUps] = useState<Array<{ orderNumber: string; customerName: string; tableName: string }>>([]);
  const [staffName, setStaffName] = useState<string | null>(null);
  const [threadOrder, setThreadOrder] = useState<Order | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replySending, setReplySending] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data?.user) setStaffName(data.user.name ?? null); })
      .catch(() => {});
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const res = await fetch(`/api/orders?date=${today}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed');
      const data: Order[] = await res.json();
      setOrders(data);
    } catch (e) {
      console.error('[Admin Kitchen] Error:', e);
    }
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  useEffect(() => {
    const handle = () => { if (document.visibilityState === 'visible') fetchOrders(); };
    document.addEventListener('visibilitychange', handle);
    return () => document.removeEventListener('visibilitychange', handle);
  }, [fetchOrders]);

  useEffect(() => {
    const interval = setInterval(fetchOrders, 30000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  const socketEvents = useMemo(() => ({
    'new-order': (data: unknown) => {
      const order = data as Order;
      playNewOrderSound();
      setOrders((prev) => {
        if (prev.some((o) => o.id === order.id)) return prev;
        return [order, ...prev];
      });
    },
    'order-status-update': (data: unknown) => {
      const order = data as Order;
      setOrders((prev) => {
        const exists = prev.some((o) => o.id === order.id);
        if (exists) return prev.map((o) => (o.id === order.id ? order : o));
        return [order, ...prev];
      });
    },
    'order-followup': (data: unknown) => {
      const fu = data as { orderNumber: string; customerName: string; tableName: string };
      playMessageSound();
      setFollowUps((prev) => [...prev, fu]);
      setTimeout(() => setFollowUps((prev) => prev.slice(1)), 8000);
    },
    'order-message': (data: unknown) => {
      const msg = data as OrderMessage & { orderNumber: string };
      playMessageSound();
      setOrders((prev) => prev.map((o) => {
        if (o.orderNumber !== msg.orderNumber) return o;
        const exists = (o.messages || []).some((m) => m.id === msg.id);
        return { ...o, messages: exists ? o.messages : [...(o.messages || []), msg] };
      }));
      setThreadOrder((prev) => {
        if (prev && prev.orderNumber === msg.orderNumber) {
          const exists = (prev.messages || []).some((m) => m.id === msg.id);
          return { ...prev, messages: exists ? prev.messages : [...(prev.messages || []), msg] };
        }
        return prev;
      });
    },
  }), []);

  useSocket({ events: socketEvents });

  async function sendReply() {
    if (!threadOrder || !replyText.trim() || replySending) return;
    setReplySending(true);
    try {
      const res = await fetch(`/api/orders/${threadOrder.orderNumber}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'text', content: replyText.trim() }),
      });
      if (res.ok) {
        const msg = await res.json();
        const append = (o: Order): Order => ({
          ...o,
          messages: (o.messages || []).some((m) => m.id === msg.id) ? o.messages : [...(o.messages || []), msg],
        });
        setOrders((prev) => prev.map((o) => (o.orderNumber === threadOrder.orderNumber ? append(o) : o)));
        setThreadOrder((prev) => (prev ? append(prev) : prev));
        setReplyText('');
      }
    } catch (e) {
      console.error('[Admin Kitchen] Reply error:', e);
    }
    setReplySending(false);
  }

  async function updateStatus(orderId: number, newStatus: string) {
    setUpdating(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error('Failed');
      const updated = await res.json();
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
    } catch (e) {
      console.error('Error:', e);
    }
    setUpdating(null);
    setConfirmAction(null);
  }

  const activeOrders = orders.filter((o) => o.status === 'PENDING' || o.status === 'PREPARING');
  const completedOrders = orders.filter((o) => o.status === 'COMPLETED').sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 20);

  const displayOrders = statusFilter === 'active' ? activeOrders : completedOrders;
  const stationGroups = groupByStation(displayOrders);
  const activeGroups = groupByStation(activeOrders);

  function timeSince(dateStr: string): { text: string; urgent: boolean } {
    const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (mins < 1) return { text: 'just now', urgent: false };
    if (mins < 10) return { text: `${mins}m`, urgent: false };
    if (mins < 20) return { text: `${mins}m`, urgent: true };
    return { text: `${mins}m`, urgent: true };
  }

  function renderOrderCard(order: Order, items: OrderItem[], showActions: boolean) {
    const isPending = order.status === 'PENDING';
    const isPreparing = order.status === 'PREPARING';
    const isCompleted = order.status === 'COMPLETED';
    const timeInfo = timeSince(order.createdAt);
    const msgs = order.messages || [];
    const lastMsg = msgs[msgs.length - 1];
    const hasUnanswered = msgs.length > 0 && lastMsg.sender === order.customerName;

    // Status colors
    const statusConfig: Record<string, { bg: string; border: string; text: string; badge: string; label: string }> = {
      PENDING: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', badge: 'bg-amber-500', label: 'PENDING' },
      PREPARING: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', badge: 'bg-blue-500', label: 'PREPARING' },
      COMPLETED: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', badge: 'bg-green-500', label: 'READY' },
      CANCELLED: { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-700', badge: 'bg-gray-500', label: 'CANCELLED' },
    };
    const config = statusConfig[order.status] || statusConfig.PENDING;

    return (
      <div className={`bg-white ${config.border} ${hasUnanswered ? 'ring-2 ring-amber-400' : ''} border-2 rounded-2xl p-5 flex flex-col h-full shadow-sm hover:shadow-lg transition-all duration-200`}>
        {/* Header Row */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <p className="text-2xl font-bold text-gray-900">{ticketCode(order.orderNumber)}</p>
            <p className="text-lg font-semibold text-gray-700 mt-1">{order.customerName}</p>
          </div>
          <div className={`${config.badge} ${config.text} px-3 py-1.5 rounded-full text-xs font-bold`}>
            {config.label}
          </div>
        </div>

        {/* Time & Table Row */}
        <div className="flex items-center gap-3 mb-4">
          {order.orderType && order.orderType !== 'DINE_IN' && (
            <span className={`text-sm px-2 py-1 rounded-lg font-semibold ${
              order.orderType === 'DELIVERY' ? 'bg-purple-100 text-purple-700' : 'bg-sky-100 text-sky-700'
            }`}>
              {order.orderType === 'DELIVERY' ? '🛵 Delivery' : '🥡 Takeout'}
            </span>
          )}
          {order.orderType === 'DINE_IN' && (
            <span className="text-sm px-2 py-1 rounded-lg bg-gray-100 text-gray-600">
              🍽️ Dine-in
            </span>
          )}
          {order.table && (
            <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-lg">
              📍 {order.table.name}
            </span>
          )}
          {order.deliveryAddress && (
            <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-lg truncate max-w-[200px]" title={order.deliveryAddress}>
              📍 {order.deliveryAddress}
            </span>
          )}
          <span className={`text-sm px-2 py-1 rounded-lg flex items-center gap-1 ${timeInfo.urgent ? 'bg-red-100 text-red-700 font-semibold' : 'bg-gray-100 text-gray-600'}`}>
            ⏱ {timeInfo.text}
          </span>
        </div>

        {/* Latest message preview — opens the thread */}
        {msgs.length > 0 && (
          <button
            onClick={() => setThreadOrder(order)}
            className={`mb-3 w-full text-left rounded-xl px-3 py-2 border transition ${hasUnanswered ? 'bg-amber-50 border-amber-300' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}`}
          >
            <span className={`text-[11px] font-bold uppercase tracking-wide ${hasUnanswered ? 'text-amber-600' : 'text-gray-400'}`}>
              💬 {msgs.length} message{msgs.length > 1 ? 's' : ''}{hasUnanswered ? ' · waiting' : ''}
            </span>
            <p className={`text-sm truncate mt-0.5 ${lastMsg.sender === order.customerName ? 'text-gray-700' : 'text-gray-500'}`}>
              {lastMsg.type === 'voice' ? '🎤 Voice message' : lastMsg.content}
            </p>
          </button>
        )}

        {/* Items List - Large & Readable */}
        <div className="flex-1 space-y-2 mb-4">
          {items.map((item) => (
            <div key={item.id} className="bg-gray-50 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-gray-900 min-w-[24px]">{item.quantity}×</span>
                <span className="text-base text-gray-700 font-medium">
                  {item.product.name}
                  {item.selections && <span className="text-sm text-amber-700 font-semibold">{selectionsLabelFromJson(item.selections)}</span>}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Action Buttons - Big & Easy to Tap */}
        {showActions && !isCompleted && (
          <div className="mt-auto">
            {isPending && (
              <button
                onClick={() => setConfirmAction({ orderId: order.id, action: 'PREPARING', label: 'Start Preparing' })}
                disabled={updating === order.id}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl transition-all text-lg shadow-md hover:shadow-lg active:scale-[0.98]"
              >
                🔥 START PREPARING
              </button>
            )}
            {isPreparing && (
              <button
                onClick={() => setConfirmAction({ orderId: order.id, action: 'COMPLETED', label: 'Mark Ready' })}
                disabled={updating === order.id}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-xl transition-all text-lg shadow-md hover:shadow-lg active:scale-[0.98]"
              >
                ✅ MARK READY
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full bg-gray-50 text-gray-900 overflow-hidden font-sans">
      {/* Sidebar */}
      <div className="w-72 border-r border-gray-200 flex flex-col bg-white">
        <div className="p-6">
          <h2 className="font-bold text-xl mb-6 text-gray-900">👨‍🍳 Staff Queue</h2>
          
          {/* Stats in Sidebar */}
          <div className="grid grid-cols-3 gap-2 mb-6">
            <div className="bg-amber-50 rounded-xl p-3 text-center border border-amber-200">
              <p className="text-2xl font-bold text-amber-600">{activeOrders.filter((o) => o.status === 'PENDING').length}</p>
              <p className="text-xs text-amber-700 font-medium">Pending</p>
            </div>
            <div className="bg-blue-50 rounded-xl p-3 text-center border border-blue-200">
              <p className="text-2xl font-bold text-blue-600">{activeOrders.filter((o) => o.status === 'PREPARING').length}</p>
              <p className="text-xs text-blue-700 font-medium">Preparing</p>
            </div>
            <div className="bg-green-50 rounded-xl p-3 text-center border border-green-200">
              <p className="text-2xl font-bold text-green-600">{completedOrders.length}</p>
              <p className="text-xs text-green-700 font-medium">Done</p>
            </div>
          </div>

          <div className="space-y-2">
            <button
              onClick={() => setStatusFilter('active')}
              className={`w-full text-left px-4 py-3 rounded-xl font-semibold text-sm transition-all ${
                statusFilter === 'active' 
                  ? 'bg-gray-900 text-white shadow-lg' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Active Orders ({activeOrders.length})
            </button>
            <button
              onClick={() => setStatusFilter('completed')}
              className={`w-full text-left px-4 py-3 rounded-xl font-semibold text-sm transition-all ${
                statusFilter === 'completed' 
                  ? 'bg-gray-900 text-white shadow-lg' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Completed Orders ({completedOrders.length})
            </button>
          </div>
        </div>

        {/* Station Filters */}
        <div className="px-6 pb-4">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Filter by Station</h3>
          <div className="grid grid-cols-1 gap-2">
            <button
              onClick={() => setActiveStation('all')}
              className={`px-4 py-3 rounded-xl font-semibold text-sm text-left transition-all flex items-center justify-between ${
                activeStation === 'all' 
                  ? 'bg-gray-900 text-white shadow-lg' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <span>📋 All Stations</span>
              <span className="bg-gray-500 text-white text-xs px-2 py-0.5 rounded-full">{activeOrders.length}</span>
            </button>
            {STATIONS.map((st) => {
              const count = activeGroups[st.key].length;
              return (
                <button
                  key={st.key}
                  onClick={() => setActiveStation(st.key)}
                  className={`px-4 py-3 rounded-xl font-semibold text-sm text-left transition-all flex items-center justify-between ${
                    activeStation === st.key 
                      ? 'bg-gray-900 text-white shadow-lg' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <span>{st.icon} {st.label}</span>
                  {count > 0 && (
                    <span className={`${st.badge} text-white text-xs px-2 py-0.5 rounded-full`}>{count}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-auto p-6 border-t border-gray-100">
          <p className="text-xs text-gray-400">
            Last updated: {new Date().toLocaleTimeString()}
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="font-bold text-3xl text-gray-900 mb-1">Order Queue</h1>
          <p className="text-gray-500">{new Date().toLocaleDateString()} • {new Date().toLocaleTimeString()}</p>
        </div>

        {/* Station Sections */}
        {activeStation === 'all' ? (
          STATIONS.map((st) => {
            const entries = stationGroups[st.key];
            if (entries.length === 0) return null;
            return (
              <section key={st.key} className="mb-8">
                <h2 className="font-bold text-lg mb-4 flex items-center gap-3 text-gray-900">
                  <span className={`${st.badge} text-white w-8 h-8 rounded-xl flex items-center justify-center text-lg`}>{st.icon}</span>
                  {st.label} Station
                  <span className="text-gray-400 font-normal text-sm">({entries.length} orders)</span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {entries.map((e) => <div key={e.order?.id || e.order?.orderNumber}>{renderOrderCard(e.order, e.items, statusFilter === 'active')}</div>)}
                </div>
              </section>
            );
          })
        ) : (
          <section>
            {stationGroups[activeStation].length === 0 ? (
              <div className="bg-white rounded-2xl h-48 flex items-center justify-center shadow-sm border border-gray-100">
                <div className="text-center">
                  <p className="text-4xl mb-2">✅</p>
                  <p className="text-gray-500 font-medium">All caught up! No orders for this station.</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {stationGroups[activeStation].map((e) => renderOrderCard(e.order, e.items, statusFilter === 'active'))}
              </div>
            )}
          </section>
        )}

        {/* Empty state */}
        {activeStation === 'all' && displayOrders.length === 0 && (
          <div className="bg-white rounded-2xl h-48 flex items-center justify-center shadow-sm border border-gray-100">
            <div className="text-center">
              <p className="text-4xl mb-2">{statusFilter === 'active' ? '🎉' : '📋'}</p>
              <p className="text-gray-500 font-medium">{statusFilter === 'active' ? 'No active orders! All caught up.' : 'No completed orders today'}</p>
            </div>
          </div>
        )}

        {/* Confirm Modal */}
        {confirmAction && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
              <h3 className="font-bold text-xl mb-2 text-gray-900">{confirmAction.label}?</h3>
              <p className="text-gray-500 mb-6">This will update the order status and notify the customer.</p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setConfirmAction(null)} 
                  className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-semibold text-sm hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => updateStatus(confirmAction.orderId, confirmAction.action)}
                  disabled={updating !== null}
                  className="flex-1 bg-gray-900 text-white py-3 rounded-xl font-semibold text-sm hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  {updating ? 'Updating...' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Message Thread Modal */}
        {threadOrder && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 max-w-lg w-full mx-4 shadow-2xl max-h-[85vh] flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-xl text-gray-900">💬 {ticketCode(threadOrder.orderNumber)}</h3>
                  <p className="text-sm text-gray-500">{threadOrder.customerName}{threadOrder.table ? ` · 📍 ${threadOrder.table.name}` : ''}</p>
                </div>
                <button onClick={() => setThreadOrder(null)} className="text-gray-400 hover:text-gray-600 text-xl px-2">✕</button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-1 mb-4">
                {(threadOrder.messages || []).length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">No messages yet</p>
                ) : (
                  (threadOrder.messages || []).map((m) => (
                    <div key={m.id} className={`p-3 rounded-xl text-sm max-w-[85%] ${m.sender === threadOrder.customerName ? 'bg-gray-100 text-gray-800 mr-auto' : 'bg-gray-900 text-white ml-auto'}`}>
                      <div className="flex items-center gap-2 mb-1 text-xs text-gray-400">
                        <span>{m.sender === threadOrder.customerName ? `🙋 ${m.sender}` : `👨‍🍳 ${m.sender}`}</span>
                        <span>·</span>
                        <span>{new Date(m.createdAt).toLocaleTimeString()}</span>
                      </div>
                      {m.type === 'voice' ? (
                        <audio src={m.content} controls className="w-full h-8" />
                      ) : (
                        <p className={m.sender === threadOrder.customerName ? 'text-gray-700' : 'text-white'}>{m.content}</p>
                      )}
                    </div>
                  ))
                )}
              </div>

              {staffName ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendReply()}
                    placeholder={`Reply as ${staffName}...`}
                    className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                    disabled={replySending}
                  />
                  <button
                    onClick={sendReply}
                    disabled={!replyText.trim() || replySending}
                    className="bg-gray-900 text-white px-5 rounded-xl font-semibold text-sm transition disabled:opacity-40"
                  >
                    Send
                  </button>
                </div>
              ) : (
                <a href="/login?next=/kitchen" className="block w-full text-center bg-gray-100 text-gray-600 py-3 rounded-xl font-semibold text-sm hover:bg-gray-200 transition-colors">
                  🔒 Sign in to reply
                </a>
              )}
            </div>
          </div>
        )}

        {/* Follow-up Toasts */}
        {followUps.length > 0 && (
          <div className="fixed top-4 right-4 z-50 space-y-2">
            {followUps.map((fu, i) => (
              <div key={i} className="bg-amber-500 text-white px-5 py-4 rounded-xl shadow-xl text-sm font-semibold">
                📣 <strong>{fu.tableName}</strong> ({fu.customerName}) followed up - <strong>{ticketCode(fu.orderNumber)}</strong>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
