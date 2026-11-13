export interface StationOrderItem {
  id: number;
  quantity: number;
  selections?: string | null;
  product: { name: string; stationType?: string };
}

export interface StationOrderMessage {
  id: number;
  orderId: number;
  type: string;
  content: string;
  sender: string;
  createdAt: string;
}

export interface StationOrder {
  id: number;
  orderNumber: string;
  customerName: string;
  status: 'PENDING' | 'PREPARING' | 'COMPLETED' | 'CANCELLED';
  totalAmount: number;
  createdAt: string;
  queueNumber?: number | null;
  orderType?: string;
  deliveryAddress?: string | null;
  table?: { name: string };
  items: StationOrderItem[];
  messages?: StationOrderMessage[];
}

export type StationKey = 'coffee' | 'kitchen' | 'bar' | 'pastry' | 'general';

export const STATIONS: { key: StationKey; icon: string; label: string; border: string; bg: string; badge: string }[] = [
  { key: 'coffee',  icon: '☕', label: 'Drinks',  border: 'border-amber-500/50', bg: 'bg-amber-500/10', badge: 'bg-amber-500' },
  { key: 'kitchen', icon: '🍳', label: 'Kitchen', border: 'border-red-500/50',   bg: 'bg-red-500/10',   badge: 'bg-red-500' },
  { key: 'bar',     icon: '🥤', label: 'Bar',     border: 'border-blue-500/50',  bg: 'bg-blue-500/10',  badge: 'bg-blue-500' },
  { key: 'pastry',  icon: '🧁', label: 'Pastry',  border: 'border-pink-500/50',  bg: 'bg-pink-500/10',  badge: 'bg-pink-500' },
  { key: 'general', icon: '📦', label: 'General', border: 'border-gray-500/50',  bg: 'bg-gray-500/10',  badge: 'bg-gray-500' },
];

export function getItemStation(item: StationOrderItem): StationKey {
  const s = item.product.stationType?.toLowerCase();
  if (s && STATIONS.some((st) => st.key === s)) return s as StationKey;
  return 'general';
}

/** Build station-grouped view: for each station, list orders that have ≥1 item at that station, showing only the relevant items */
export function groupByStation<T extends StationOrder>(orders: T[]) {
  const grouped: Record<StationKey, { order: T; items: StationOrderItem[] }[]> = {
    coffee: [], kitchen: [], bar: [], pastry: [], general: [],
  };
  for (const order of orders) {
    const byStation: Record<string, StationOrderItem[]> = {};
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
