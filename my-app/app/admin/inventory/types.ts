// Inventory screen data shapes.

export interface InventoryItem {
  id: number;
  quantity: number;
  lowStockThreshold: number;
  unit: string;
  product: {
    id: number;
    name: string;
    price: number;
    available: boolean;
    category: { name: string; icon?: string };
    _count?: { ingredients: number };
  };
}

export interface IngredientItem {
  id: number;
  name: string;
  currentStock: number;
  minStock: number;
  baseUnit: string;
  purchaseUnit: string;
  costPerUnit: number;
  inventoryValue: number;
  status: string;
  statusText: string;
  supplier: { id: number; name: string } | null;
  transactionCount?: number;
}

export interface SupplierItem {
  id: number;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  status: string;
  ingredients: {
    id: number;
    name: string;
    currentStock: number;
    baseUnit: string;
    products: { product: { id: number; name: string } }[];
  }[];
}

// Spec 014 US2 — purchase history detail for one ingredient
export interface PurchaseHistoryRow {
  id: number;
  createdAt: string;
  type: string;
  quantity: number; // base unit
  purchaseUnit: string | null;
  enteredQuantity: number; // as entered
  purchaseCost: number | null;
  unitCost: number | null;
  supplierId: number | null;
  supplierName: string | null;
  notes: string | null;
  voided: boolean;
  change: { delta: number; percent: number } | null;
}

export interface PurchaseHistoryData {
  ingredient: {
    id: number;
    name: string;
    baseUnit: string;
    currentStock: number;
    minStock: number;
    costPerUnit: number;
    supplierId: number | null;
  };
  purchases: PurchaseHistoryRow[];
}

// Spec 014 US3 — per-supplier ingredient prices from purchase history
export interface SupplierIngredientPriceItem {
  supplierId: number;
  ingredientId: number;
  ingredientName: string;
  baseUnit: string;
  purchaseCount: number;
  latestUnitCost: number | null;
  previousUnitCost: number | null;
  change: { delta: number; percent: number } | null;
}

export interface SupplierInsight {
  supplierId: number;
  supplierName: string;
  items: SupplierIngredientPriceItem[];
}
