import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartItemSelection {
  optionId: number;
  groupName: string;
  name: string;
  priceDelta: number;
}

export interface CartItem {
  productId: number;
  name: string;
  price: number; // unit price including selection adders
  basePrice?: number; // product price before option adders (for re-configuring)
  quantity: number;
  categoryId?: number; // Added for category-based loyalty filtering
  notes?: string;
  selections?: CartItemSelection[];
}

/** Unique identity of a cart line: product + its exact configuration. */
export function lineKey(productId: number, selections?: CartItemSelection[]): string {
  const ids = (selections ?? [])
    .map((s) => s.optionId)
    .sort((a, b) => a - b)
    .join(',');
  return `${productId}::${ids}`;
}


export interface CartState {
  items: CartItem[];
  customerName: string;
  tableNumber: string;
  addItem: (item: Omit<CartItem, 'quantity'>) => void;
  removeItem: (key: string) => void;
  updateQuantity: (key: string, qty: number) => void;
  /** Re-configure an existing line (new options/price). Merges if it collides
   *  with another line that ends up identical. */
  updateLine: (oldKey: string, item: Omit<CartItem, 'quantity'>, quantity?: number) => void;
  setCustomerName: (name: string) => void;
  setTableNumber: (table: string) => void;
  clearCart: () => void;
  total: () => number;
  itemCount: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      customerName: '',
      tableNumber: '',

      addItem: (item) =>
        set((state) => {
          const key = lineKey(item.productId, item.selections);
          const existing = state.items.find((i) => lineKey(i.productId, i.selections) === key);
          if (existing) {
            return {
              items: state.items.map((i) =>
                lineKey(i.productId, i.selections) === key ? { ...i, quantity: i.quantity + 1 } : i
              ),
            };
          }
          return { items: [...state.items, { ...item, quantity: 1 }] };
        }),

      removeItem: (key) =>
        set((state) => ({ items: state.items.filter((i) => lineKey(i.productId, i.selections) !== key) })),

      updateQuantity: (key, qty) =>
        set((state) => ({
          items:
            qty <= 0
              ? state.items.filter((i) => lineKey(i.productId, i.selections) !== key)
              : state.items.map((i) =>
                  lineKey(i.productId, i.selections) === key ? { ...i, quantity: qty } : i
                ),
        })),

      updateLine: (oldKey, item, quantity) =>
        set((state) => {
          const oldLine = state.items.find((i) => lineKey(i.productId, i.selections) === oldKey);
          const qty = quantity ?? oldLine?.quantity ?? 1;
          // Remove the old configuration first…
          let items = state.items.filter((i) => lineKey(i.productId, i.selections) !== oldKey);
          const newKey = lineKey(item.productId, item.selections);
          const existing = items.find((i) => lineKey(i.productId, i.selections) === newKey);
          if (existing) {
            // …then fold into an identical line if one exists
            items = items.map((i) =>
              lineKey(i.productId, i.selections) === newKey ? { ...i, quantity: i.quantity + qty } : i
            );
          } else {
            items = [...items, { ...item, quantity: qty }];
          }
          return { items };
        }),

      setCustomerName: (name) => set({ customerName: name }),
      setTableNumber: (table) => set({ tableNumber: table }),
      clearCart: () => set({ items: [], customerName: '', tableNumber: '' }),

      total: () =>
        get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),

      itemCount: () =>
        get().items.reduce((sum, i) => sum + i.quantity, 0),
    }),
    { name: 'cafeos-cart' }
  )
);
