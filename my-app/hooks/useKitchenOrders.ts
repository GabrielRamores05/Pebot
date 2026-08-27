'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { todayIsoDate } from '@/lib/dates';
import { StationOrder, StationOrderMessage, groupByStation } from '@/lib/kitchen-stations';
import { playMessageSound, playNewOrderSound } from '@/lib/sounds';

const REFRESH_MS = 30000;
const FOLLOW_UP_VISIBLE_MS = 8000;
const COMPLETED_SHOWN = 20;

export interface KitchenFollowUp {
  orderNumber: string;
  customerName: string;
  tableName: string;
}

export interface UseKitchenOrdersOptions {
  /** Prefix for console messages, so both queue screens stay tellable apart in logs. */
  logLabel: string;
  /** Hold back the order data until we know a staff member is signed in. */
  requireStaff?: boolean;
  /** Show active orders in queue-number order rather than newest-first. */
  sortActiveByQueueNumber?: boolean;
}

/**
 * The live order queue behind both kitchen screens: today's orders, kept
 * current by socket events and a periodic refresh, plus the two actions a
 * screen can take on an order — advancing its status and replying to the
 * customer's message thread.
 */
export function useKitchenOrders({
  logLabel,
  requireStaff = false,
  sortActiveByQueueNumber = false,
}: UseKitchenOrdersOptions) {
  const [orders, setOrders] = useState<StationOrder[]>([]);
  const [staffName, setStaffName] = useState<string | null>(null);
  const [isStaff, setIsStaff] = useState(false);
  const [followUps, setFollowUps] = useState<KitchenFollowUp[]>([]);
  const [threadOrder, setThreadOrder] = useState<StationOrder | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replySending, setReplySending] = useState(false);
  const [updating, setUpdating] = useState<number | null>(null);

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
    if (requireStaff && !isStaff) return;
    try {
      const res = await fetch(`/api/orders?date=${todayIsoDate()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed');
      const data: StationOrder[] = await res.json();
      setOrders(data);
    } catch (e) {
      console.error(`[${logLabel}] Error:`, e);
    }
  }, [isStaff, logLabel, requireStaff]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  useEffect(() => {
    const handle = () => { if (document.visibilityState === 'visible') fetchOrders(); };
    document.addEventListener('visibilitychange', handle);
    return () => document.removeEventListener('visibilitychange', handle);
  }, [fetchOrders]);

  useEffect(() => {
    const interval = setInterval(fetchOrders, REFRESH_MS);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  const socketEvents = useMemo(() => ({
    'new-order': (data: unknown) => {
      const order = data as StationOrder;
      playNewOrderSound();
      setOrders((prev) => (prev.some((o) => o.id === order.id) ? prev : [order, ...prev]));
    },
    'order-status-update': (data: unknown) => {
      const order = data as StationOrder;
      setOrders((prev) =>
        prev.some((o) => o.id === order.id)
          ? prev.map((o) => (o.id === order.id ? order : o))
          : [order, ...prev]
      );
    },
    'order-followup': (data: unknown) => {
      const followUp = data as KitchenFollowUp;
      playMessageSound();
      setFollowUps((prev) => [...prev, followUp]);
      setTimeout(() => setFollowUps((prev) => prev.slice(1)), FOLLOW_UP_VISIBLE_MS);
    },
    'order-message': (data: unknown) => {
      const msg = data as StationOrderMessage & { orderNumber: string };
      playMessageSound();
      setOrders((prev) => prev.map((o) => (o.orderNumber === msg.orderNumber ? appendMessage(o, msg) : o)));
      setThreadOrder((prev) => (prev && prev.orderNumber === msg.orderNumber ? appendMessage(prev, msg) : prev));
    },
  }), []);

  useSocket({ events: socketEvents });

  const sendReply = useCallback(async () => {
    if (!threadOrder || !replyText.trim() || replySending) return;
    setReplySending(true);
    try {
      const res = await fetch(`/api/orders/${threadOrder.orderNumber}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'text', content: replyText.trim() }),
      });
      if (res.ok) {
        const msg: StationOrderMessage = await res.json();
        setOrders((prev) =>
          prev.map((o) => (o.orderNumber === threadOrder.orderNumber ? appendMessage(o, msg) : o))
        );
        setThreadOrder((prev) => (prev ? appendMessage(prev, msg) : prev));
        setReplyText('');
      }
    } catch (e) {
      console.error(`[${logLabel}] Reply error:`, e);
    }
    setReplySending(false);
  }, [logLabel, replySending, replyText, threadOrder]);

  const updateStatus = useCallback(async (orderId: number, newStatus: string) => {
    setUpdating(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error('Failed');
      const updated: StationOrder = await res.json();
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
    } catch (e) {
      console.error(`[${logLabel}] Status error:`, e);
    }
    setUpdating(null);
  }, [logLabel]);

  const activeOrders = useMemo(() => {
    const active = orders.filter((o) => o.status === 'PENDING' || o.status === 'PREPARING');
    return sortActiveByQueueNumber
      ? active.sort((a, b) => (a.queueNumber || 999) - (b.queueNumber || 999))
      : active;
  }, [orders, sortActiveByQueueNumber]);

  const completedOrders = useMemo(
    () =>
      orders
        .filter((o) => o.status === 'COMPLETED')
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, COMPLETED_SHOWN),
    [orders]
  );

  return {
    isStaff,
    staffName,
    activeOrders,
    completedOrders,
    activeStationGroups: groupByStation(activeOrders),
    followUps,
    threadOrder,
    setThreadOrder,
    replyText,
    setReplyText,
    replySending,
    sendReply,
    updating,
    updateStatus,
  };
}

function appendMessage<T extends StationOrder>(order: T, msg: StationOrderMessage): T {
  const messages = order.messages || [];
  return messages.some((m) => m.id === msg.id) ? order : { ...order, messages: [...messages, msg] };
}
