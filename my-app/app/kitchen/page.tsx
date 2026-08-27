'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { playNewOrderSound, playMessageSound } from '@/lib/sounds';
import { ticketCode } from '@/lib/ticket';
import { selectionsLabelFromJson } from '@/lib/product-options';
import {
  STATIONS,
  StationKey,
  StationOrder,
  StationOrderItem,
  StationOrderMessage,
  groupByStation,
} from '@/lib/kitchen-stations';

type Order = StationOrder;
type OrderItem = StationOrderItem;
type OrderMessage = StationOrderMessage;

export default function KitchenPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeStation, setActiveStation] = useState<StationKey | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'active' | 'completed'>('active');
  const [confirmAction, setConfirmAction] = useState<{ orderId: number; action: string; label: string } | null>(null);
  const [updating, setUpdating] = useState<number | null>(null);
  const [followUps, setFollowUps] = useState<Array<{ orderNumber: string; customerName: string; tableName: string }>>([]);
  const [isStaff, setIsStaff] = useState<boolean>(false);
  const [staffName, setStaffName] = useState<string | null>(null);
  const [threadOrder, setThreadOrder] = useState<Order | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replySending, setReplySending] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.user) {
          setStaffName(data.user.name ?? null);
          setIsStaff(true);
        }
      })
      .catch(() => {});
  }, []);

  const fetchOrders = useCallback(async () => {
    if (!isStaff) return;
    try {
      const today = new Date().toISOString().split('T')[0];
      const res = await fetch(`/api/orders?date=${today}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed');
      const data: Order[] = await res.json();
      setOrders(data);
    } catch (e) {
      console.error('[Kitchen] Error:', e);
    }
  }, [isStaff]);

  

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
      console.error('[Kitchen] Reply error:', e);
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

  // Filtered orders
    const activeOrders = orders.filter((o) => o.status === 'PENDING' || o.status === 'PREPARING')
      .sort((a, b) => (a.queueNumber || 999) - (b.queueNumber || 999));
  const completedOrders = orders.filter((o) => o.status === 'COMPLETED').sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 20);

  const displayOrders = statusFilter === 'active' ? activeOrders : completedOrders;
  const stationGroups = groupByStation(displayOrders);

  // Counts per station (active only)
  const activeGroups = groupByStation(activeOrders);

  function timeSince(dateStr: string) {
    const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
  }

  function renderOrderCard(order: Order, items: OrderItem[], showActions: boolean) {
    const isPending = order.status === 'PENDING';
    const isPreparing = order.status === 'PREPARING';
    const borderColor = isPending ? 'border-yellow-500/50' : isPreparing ? 'border-blue-500/50' : 'border-green-500/50';
    const statusBadge = isPending
      ? 'bg-yellow-500/20 text-yellow-300'
      : isPreparing
        ? 'bg-blue-500/20 text-blue-300'
        : 'bg-green-500/20 text-green-300';
    const msgs = order.messages || [];
    const lastMsg = msgs[msgs.length - 1];
    const hasUnanswered = msgs.length > 0 && lastMsg.sender === order.customerName;

    return (
      <div key={`${order.id}-${items[0]?.id}`} className={`bg-gray-900 border-2 ${borderColor} ${hasUnanswered ? 'ring-2 ring-amber-400' : ''} rounded-xl p-4 flex flex-col`}>
        <div className="flex items-start justify-between mb-2">
          <div>
            <p className="font-mono font-bold text-lg">{ticketCode(order.orderNumber)}</p>
            <p className="text-gray-400 text-sm">{order.customerName}</p>
          </div>
          <div className="text-right">
            <span className={`text-xs px-2 py-1 rounded-full font-semibold ${statusBadge}`}>
              {order.status}
            </span>
            {order.orderType && order.orderType !== 'DINE_IN' && (
              <p className="text-xs mt-1 font-semibold">
                {order.orderType === 'DELIVERY' ? '🛵 Delivery' : '🥡 Takeout'}
              </p>
            )}
            {order.table && <p className="text-gray-500 text-xs mt-1">📍 {order.table.name}</p>}
            {order.deliveryAddress && <p className="text-gray-500 text-xs mt-1">📍 {order.deliveryAddress}</p>}
          </div>
        </div>

        <p className="text-gray-500 text-xs mb-3">⏱ {timeSince(order.createdAt)}</p>

        {msgs.length > 0 && (
          <button
            onClick={() => setThreadOrder(order)}
            className={`mb-3 w-full text-left rounded-xl px-3 py-2 border transition ${
              hasUnanswered ? 'bg-amber-400/10 border-amber-400/40' : 'bg-white/5 border-white/10 hover:bg-white/10'
            }`}
          >
            <span className={`text-[11px] font-bold uppercase tracking-wide ${hasUnanswered ? 'text-amber-300' : 'text-gray-400'}`}>
              💬 {msgs.length} message{msgs.length > 1 ? 's' : ''}{hasUnanswered ? ' · waiting' : ''}
            </span>
            <p className={`text-sm truncate mt-0.5 ${lastMsg.sender === order.customerName ? 'text-gray-200' : 'text-gray-400'}`}>
              {lastMsg.type === 'voice' ? '🎤 Voice message' : lastMsg.content}
            </p>
          </button>
        )}

        <div className="flex-1 space-y-1.5 mb-4">
          {items.map((item) => (
            <div key={item.id} className="flex justify-between text-sm">
              <span className="text-gray-200">{item.quantity}× {item.product.name}{selectionsLabelFromJson(item.selections)}</span>
            </div>
          ))}
        </div>

        {showActions && (
          <div className="space-y-2">
            {isPending && (
              <button
                onClick={() => setConfirmAction({ orderId: order.id, action: 'PREPARING', label: 'Start Preparing' })}
                disabled={updating === order.id}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-lg transition"
              >
                🔥 Start Preparing
              </button>
            )}
            {isPreparing && (
              <button
                onClick={() => setConfirmAction({ orderId: order.id, action: 'COMPLETED', label: 'Mark Ready' })}
                disabled={updating === order.id}
                className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-lg transition"
              >
                ✅ Mark Ready
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // If not signed in as staff, show prompt instead of order data
  if (!isStaff) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,#1f2937_0%,#0f172a_45%,#020617_100%)] text-white p-4 lg:p-6">
        <div className="max-w-md mx-auto py-12 text-center">
          <h2 className="text-2xl font-bold mb-4">Staff Sign In Required</h2>
          <p className="text-gray-400 mb-8">This kitchen screen is for staff only.</p>
          <a href="/login?next=/kitchen" className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-500 transition">
            Sign in to view kitchen
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#1f2937_0%,#0f172a_45%,#020617_100%)] text-white p-4 lg:p-6">
      {/* Header */}
      <header className="mb-6 flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 p-4 shadow-2xl shadow-slate-950/40 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between lg:p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Back of house</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-white lg:text-3xl">🍳 Staff Queue</h1>
          <p className="mt-1 text-sm text-slate-400">{new Date().toLocaleDateString()} &middot; {new Date().toLocaleTimeString()}</p>
        </div>
        <div className="flex flex-wrap gap-2 sm:gap-3">
          <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/10 px-3 py-2">
            <p className="text-xs uppercase tracking-[0.16em] text-yellow-300/80">Pending</p>
            <p className="mt-1 text-lg font-bold text-yellow-300">{activeOrders.filter((o) => o.status === 'PENDING').length}</p>
          </div>
          <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 px-3 py-2">
            <p className="text-xs uppercase tracking-[0.16em] text-blue-300/80">Preparing</p>
            <p className="mt-1 text-lg font-bold text-blue-300">{activeOrders.filter((o) => o.status === 'PREPARING').length}</p>
          </div>
          <div className="rounded-2xl border border-green-500/30 bg-green-500/10 px-3 py-2">
            <p className="text-xs uppercase tracking-[0.16em] text-green-300/80">Done</p>
            <p className="mt-1 text-lg font-bold text-green-300">{completedOrders.length}</p>
          </div>
        </div>
      </header>

      {/* View Toggle */}
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setStatusFilter('active')}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition ${statusFilter === 'active' ? 'bg-white text-slate-900' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
        >
          Active Orders
        </button>
        <button
          onClick={() => setStatusFilter('completed')}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition ${statusFilter === 'completed' ? 'bg-white text-slate-900' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
        >
          Completed
        </button>
      </div>

      {/* Station Tabs */}
      <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => setActiveStation('all')}
          className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition ${activeStation === 'all' ? 'bg-white text-slate-900' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
        >
          All Stations ({statusFilter === 'active' ? activeOrders.length : completedOrders.length})
        </button>
        {STATIONS.map((st) => {
          const count = activeGroups[st.key].length;
          return (
            <button
              key={st.key}
              onClick={() => setActiveStation(st.key)}
              className={`px-4 py-2 rounded-lg font-semibold text-sm whitespace-nowrap transition flex items-center gap-2 ${activeStation === st.key ? 'bg-white text-gray-900' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
            >
              {st.icon} {st.label}
              {count > 0 && (
                <span className={`${st.badge} text-white text-xs px-1.5 py-0.5 rounded-full`}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Station Sections */}
      {activeStation === 'all' ? (
        // Show all stations as sections
        STATIONS.map((st) => {
          const entries = stationGroups[st.key];
          if (entries.length === 0) return null;
          return (
            <section key={st.key} className="mb-8">
              <h2 className={`text-xl font-bold mb-3 flex items-center gap-2`}>
                <span className={`${st.badge} text-white w-8 h-8 rounded-lg flex items-center justify-center text-lg`}>{st.icon}</span>
                {st.label} Station
                <span className="text-gray-500 text-sm font-normal">({entries.length})</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {entries.map((e) => renderOrderCard(e.order, e.items, statusFilter === 'active'))}
              </div>
            </section>
          );
        })
      ) : (
        // Show single station
        <section>
          {stationGroups[activeStation].length === 0 ? (
            <div className="bg-gray-900 rounded-xl h-64 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <p className="text-4xl mb-2">✅</p>
                <p className="text-lg">All caught up at {STATIONS.find((s) => s.key === activeStation)?.label}!</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {stationGroups[activeStation].map((e) => renderOrderCard(e.order, e.items, statusFilter === 'active'))}
            </div>
          )}
        </section>
      )}

      {/* Empty state for all stations */}
      {activeStation === 'all' && displayOrders.length === 0 && (
        <div className="bg-gray-900 rounded-xl h-64 flex items-center justify-center text-gray-500">
          <div className="text-center">
            <p className="text-4xl mb-2">{statusFilter === 'active' ? '✅' : '📋'}</p>
            <p className="text-lg">{statusFilter === 'active' ? 'No active orders!' : 'No completed orders today'}</p>
          </div>
        </div>
      )}

      {/* Confirm Modal */}
      {confirmAction && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-xl font-bold mb-2">{confirmAction.label}?</h3>
            <p className="text-gray-400 text-sm mb-4">This will update the order status.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmAction(null)} className="flex-1 bg-gray-700 text-white py-2.5 rounded-lg hover:bg-gray-600 transition">
                Cancel
              </button>
              <button
                onClick={() => updateStatus(confirmAction.orderId, confirmAction.action)}
                disabled={updating !== null}
                className={`flex-1 text-white py-2.5 rounded-lg font-bold transition ${
                  confirmAction.action === 'PREPARING' ? 'bg-blue-600 hover:bg-blue-500' : 'bg-green-600 hover:bg-green-500'
                } disabled:opacity-50`}
              >
                {updating ? 'Updating...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Message Thread Modal */}
      {threadOrder && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-lg w-full mx-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold">💬 {ticketCode(threadOrder.orderNumber)}</h3>
                <p className="text-gray-400 text-sm">{threadOrder.customerName}{threadOrder.table ? ` · 📍 ${threadOrder.table.name}` : ''}</p>
              </div>
              <button onClick={() => setThreadOrder(null)} className="text-gray-400 hover:text-gray-200 text-xl px-2">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 mb-4">
              {(threadOrder.messages || []).length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">No messages yet</p>
              ) : (
                (threadOrder.messages || []).map((m) => (
                  <div key={m.id} className={`p-3 rounded-xl text-sm max-w-[85%] ${m.sender === threadOrder.customerName ? 'bg-gray-800 text-gray-100 mr-auto' : 'bg-blue-600 text-white ml-auto'}`}>
                    <div className="flex items-center gap-2 mb-1 text-xs text-gray-400">
                      <span>{m.sender === threadOrder.customerName ? `🙋 ${m.sender}` : `👨‍🍳 ${m.sender}`}</span>
                      <span>·</span>
                      <span>{new Date(m.createdAt).toLocaleTimeString()}</span>
                    </div>
                    {m.type === 'voice' ? (
                      <audio src={m.content} controls className="w-full h-8" />
                    ) : (
                      <p>{m.content}</p>
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
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={replySending}
                />
                <button
                  onClick={sendReply}
                  disabled={!replyText.trim() || replySending}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-5 rounded-xl font-semibold text-sm transition disabled:opacity-40"
                >
                  Send
                </button>
              </div>
            ) : (
              <a href="/login?next=/kitchen" className="block w-full text-center bg-white/10 text-gray-200 py-3 rounded-xl font-semibold text-sm hover:bg-white/20 transition-colors">
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
            <div key={i} className="bg-orange-500 text-white px-4 py-3 rounded-xl shadow-2xl text-sm animate-bounce max-w-xs">
              📣 <strong>{fu.tableName}</strong> ({fu.customerName}) followed up <strong>{ticketCode(fu.orderNumber)}</strong>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
