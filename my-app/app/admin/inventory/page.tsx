'use client';
import Link from 'next/link';

import { useState, useEffect, useCallback } from 'react';
import { useSocket } from '@/hooks/useSocket';

interface InventoryItem {
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
  };
}

interface IngredientItem {
  id: number;
  name: string;
  category: string;
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

interface IngredientTransactionItem {
  id: number;
  type: string;
  quantity: number;
  purchaseCost: number | null;
  unitCost: number | null;
  purchaseUnit: string | null;
  notes: string | null;
  createdAt: string;
  ingredient: { id: number; name: string; baseUnit: string; category: string };
}

interface SupplierItem {
  id: number;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  status: string;
  ingredients: { id: number; name: string; currentStock: number; baseUnit: string }[];
}

export default function InventoryPage() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCat, setFilterCat] = useState('All');
  const [editId, setEditId] = useState<number | null>(null);
  const [editQty, setEditQty] = useState('');
  const [editThreshold, setEditThreshold] = useState('');
  const [adjustId, setAdjustId] = useState<number | null>(null);
  const [adjustAmt, setAdjustAmt] = useState('');
  const [saving, setSaving] = useState(false);
  const [ingredients, setIngredients] = useState<IngredientItem[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierItem[]>([]);
  const [activeTab, setActiveTab] = useState<'products' | 'ingredients' | 'suppliers' | 'capacity'>('products');
  const [loadingIngredients, setLoadingIngredients] = useState(false);
  const [ingEditId, setIngEditId] = useState<number | null>(null);
  const [ingEditStock, setIngEditStock] = useState('');
  const [ingEditThreshold, setIngEditThreshold] = useState('');
  const [ingEditSupplier, setIngEditSupplier] = useState<number | ''>('');
  const [ingEditCategory, setIngEditCategory] = useState('');
  const [ingEditPurchaseUnit, setIngEditPurchaseUnit] = useState('');
  const [ingSaving, setIngSaving] = useState(false);

  // Dashboard + purchase modal state
  const [ingredientStats, setIngredientStats] = useState<any>(null);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [purchaseForm, setPurchaseForm] = useState({
    ingredientId: '' as string | number,
    quantity: '',
    purchaseUnit: '',
    purchaseCost: '',
    supplierId: '' as string | number,
    purchaseDate: '',
    notes: '',
  });
  const [purchaseSaving, setPurchaseSaving] = useState(false);
  const [purchaseResult, setPurchaseResult] = useState<any>(null);

  // Production Capacity state (derived, read-only view of sellable quantities)
  const [capacity, setCapacity] = useState<any[]>([]);
  const [capacityLoading, setCapacityLoading] = useState(false);
  const fetchCapacity = useCallback(async () => {
    setCapacityLoading(true);
    try {
      const res = await fetch('/api/ingredients/production-capacity');
      const data = await res.json();
      setCapacity(Array.isArray(data) ? data : (data.entries ? data.entries : []));
    } catch (e) {
      console.error('Failed to fetch capacity:', e);
      setCapacity([]);
    } finally {
      setCapacityLoading(false);
    }
  }, []);

  // Adjust stock modal state
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustingIngredient, setAdjustingIngredient] = useState<IngredientItem | null>(null);
  const [adjustForm, setAdjustForm] = useState({
    quantity: '',
    reason: 'WASTE',
    notes: '',
  });
  const [adjustSaving, setAdjustSaving] = useState(false);

  // Purchase history state
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyIngredient, setHistoryIngredient] = useState<IngredientItem | null>(null);
  const [historyData, setHistoryData] = useState<IngredientTransactionItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchInventory = useCallback(async () => {
    const res = await fetch('/api/inventory');
    const data = await res.json();
    setInventory(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchInventory(); }, [fetchInventory]);

  const fetchIngredients = useCallback(async () => {
    setLoadingIngredients(true);
    try {
      const res = await fetch('/api/ingredients/dashboard');
      const data = await res.json();
      if (data.ingredients) {
        setIngredients(data.ingredients);
        setIngredientStats(data.summary);
      } else {
        // Fallback: fetch from basic endpoint if dashboard not yet available
        const res2 = await fetch('/api/ingredients');
        const fallback = await res2.json();
        setIngredients(Array.isArray(fallback) ? fallback : []);
      }
    } catch (e) {
      console.error('Failed to fetch ingredients:', e);
      setIngredients([]);
    } finally {
      setLoadingIngredients(false);
    }
  }, []);

  const fetchSuppliers = useCallback(async () => {
    try {
      const res = await fetch('/api/suppliers');
      const data = await res.json();
      setSuppliers(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to fetch suppliers:', e);
      setSuppliers([]);
    }
  }, []);

  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<SupplierItem | null>(null);

  async function saveSupplier(formData: Partial<SupplierItem>) {
    try {
      const url = editingSupplier
        ? `/api/suppliers?id=${editingSupplier.id}`
        : '/api/suppliers';
      const method = editingSupplier ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        await fetchSuppliers();
        setShowSupplierModal(false);
        setEditingSupplier(null);
      }
    } catch (e) {
      console.error('Failed to save supplier:', e);
    }
  }

  useEffect(() => { fetchIngredients(); fetchSuppliers(); fetchCapacity(); }, [fetchIngredients, fetchSuppliers, fetchCapacity]);

  useSocket({
    events: {
      'inventory-update': () => { fetchInventory(); fetchCapacity(); },
      'low-stock-alert': (data: unknown) => {
        const items = data as InventoryItem[];
      },
      'ingredients-update': () => { fetchIngredients(); fetchCapacity(); },
    },
  });

  const categories = ['All', ...Array.from(new Set(inventory.map((i) => i.product.category.name)))];

  const filtered = inventory.filter((i) => filterCat === 'All' || i.product.category.name === filterCat);

  const lowStock = inventory.filter((i) => i.quantity <= i.lowStockThreshold);

  async function saveEdit(productId: number) {
    setSaving(true);
    await fetch('/api/inventory', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId,
        lowStockThreshold: parseInt(editThreshold),
      }),
    });
    setSaving(false);
    setEditId(null);
    fetchInventory();
  }

  async function applyAdjustment(productId: number) {
    const amt = parseInt(adjustAmt);
    if (isNaN(amt)) return;
    setSaving(true);
    await fetch('/api/inventory', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, adjustment: amt }),
    });
    setSaving(false);
    setAdjustId(null);
    setAdjustAmt('');
    fetchInventory();
  }

  async function saveIngredientEdit(id: number) {
    if (isNaN(parseInt(ingEditStock)) || isNaN(parseInt(ingEditThreshold))) return;
    setIngSaving(true);
    try {
      await fetch(`/api/ingredients/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentStock: parseFloat(ingEditStock),
          minStock: parseFloat(ingEditThreshold),
          supplierId: ingEditSupplier || undefined,
          category: ingEditCategory || undefined,
          purchaseUnit: ingEditPurchaseUnit || undefined,
        }),
      });
      setIngEditId(null);
      fetchIngredients();
    } catch (e) {
      console.error('Failed to update ingredient:', e);
    } finally {
      setIngSaving(false);
    }
  }

  async function savePurchase() {
    const qty = parseFloat(purchaseForm.quantity);
    const cost = parseFloat(purchaseForm.purchaseCost);
    if (isNaN(qty) || qty <= 0 || isNaN(cost) || cost < 0) return;
    if (!purchaseForm.purchaseUnit) return;
    if (!purchaseForm.ingredientId) {
      alert('Please select an ingredient');
      return;
    }

    setPurchaseSaving(true);
    setPurchaseResult(null);
    try {
      const res = await fetch('/api/ingredients/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ingredientId: parseInt(String(purchaseForm.ingredientId)),
          quantity: qty,
          purchaseUnit: purchaseForm.purchaseUnit,
          purchaseCost: cost,
          supplierId: purchaseForm.supplierId ? parseInt(String(purchaseForm.supplierId)) : null,
          purchaseDate: purchaseForm.purchaseDate || undefined,
          notes: purchaseForm.notes || undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setPurchaseResult(data);
        setShowPurchaseModal(false);
        setPurchaseForm({
          ingredientId: '', quantity: '', purchaseUnit: '', purchaseCost: '',
          supplierId: '', purchaseDate: '', notes: '',
        });
        fetchIngredients();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to record purchase');
      }
    } catch (e) {
      console.error('Failed to save purchase:', e);
      alert('Network error recording purchase');
    } finally {
      setPurchaseSaving(false);
    }
  }

  async function saveAdjustment() {
    const qty = parseFloat(adjustForm.quantity);
    if (isNaN(qty) || qty === 0) {
      alert('Please enter a valid adjustment amount');
      return;
    }
    if (!adjustingIngredient) return;

    setAdjustSaving(true);
    try {
      const res = await fetch(`/api/ingredients/${adjustingIngredient.id}/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quantity: qty,
          reason: adjustForm.reason,
          notes: adjustForm.notes || undefined,
        }),
      });
      if (res.ok) {
        setShowAdjustModal(false);
        setAdjustingIngredient(null);
        setAdjustForm({ quantity: '', reason: 'WASTE', notes: '' });
        fetchIngredients();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to adjust stock');
      }
    } catch (e) {
      console.error('Failed to adjust stock:', e);
      alert('Network error adjusting stock');
    } finally {
      setAdjustSaving(false);
    }
  }

  async function fetchHistory(ingredientId: number) {
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/ingredients/transactions?ingredientId=${ingredientId}`);
      const data = await res.json();
      setHistoryData(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to fetch history:', e);
      setHistoryData([]);
    } finally {
      setHistoryLoading(false);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 min-h-screen">
      {/* Apple-inspired Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-gray-200/50 px-6 py-4 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-100 to-amber-200 rounded-xl flex items-center justify-center text-xl shadow-sm">
              📦
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900 -tracking-[0.3px]">Inventory</h1>
              <p className="text-xs text-gray-500">Manage your stock levels</p>
            </div>
          </div>
          <button
            onClick={fetchInventory}
            className="flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-xl text-sm font-medium shadow-sm border border-gray-200 transition-all hover:shadow-md"
          >
            <span>🔄</span>
            Refresh
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Tab Navigation */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveTab('products')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              activeTab === 'products'
                ? 'bg-gray-900 text-white shadow-md'
                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            📦 Products
          </button>
          <button
            onClick={() => setActiveTab('ingredients')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              activeTab === 'ingredients'
                ? 'bg-gray-900 text-white shadow-md'
                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            🥄 Ingredients
          </button>
          <button
            onClick={() => setActiveTab('suppliers')}
            className={`
              px-4 py-2 rounded-xl text-sm font-medium transition-all
              ${activeTab === 'suppliers'
                ? 'bg-black text-white shadow-md'
                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
              }
            `}
          >
            🏢 Suppliers
          </button>
          <button
            onClick={() => setActiveTab('capacity')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              activeTab === 'capacity'
                ? 'bg-amber-600 text-white shadow-md'
                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            📊 Production Capacity
          </button>
        </div>

        {/* Ingredients Tab */}
        {activeTab === 'ingredients' && (
          <div className="space-y-4">
            {/* Dashboard Stats */}
            {ingredientStats && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-5 border border-gray-200/50 shadow-sm">
                  <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide">Total Ingredients</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{ingredientStats.totalIngredients}</p>
                </div>
                <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-5 border border-gray-200/50 shadow-sm">
                  <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide">In Stock</p>
                  <p className="text-2xl font-bold text-green-600 mt-1">{ingredientStats.inStock}</p>
                </div>
                <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-5 border border-red-200/50 shadow-sm">
                  <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide">Low Stock</p>
                  <p className="text-2xl font-bold text-orange-500 mt-1">{ingredientStats.lowStock}</p>
                </div>
                <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-5 border border-red-200/50 shadow-sm">
                  <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide">Out of Stock</p>
                  <p className="text-2xl font-bold text-red-600 mt-1">{ingredientStats.outOfStock}</p>
                </div>
                <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-5 border border-gray-200/50 shadow-sm">
                  <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide">Total Value</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">₱{Number(ingredientStats.totalInventoryValue || 0).toFixed(2)}</p>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-between items-center">
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowPurchaseModal(true); setPurchaseResult(null); }}
                  className="bg-black hover:bg-gray-800 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
                >
                  + Add Purchase
                </button>
                <button
                  onClick={() => setShowAdjustModal(true)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
                >
                  ± Adjust Stock
                </button>
              </div>
              <button
                onClick={fetchIngredients}
                className="flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-xl text-sm font-medium shadow-sm border border-gray-200 transition-all hover:shadow-md"
              >
                <span>🔄</span>
                Refresh
              </button>
            </div>

            {loadingIngredients ? (
              <div className="flex items-center justify-center py-16 text-gray-400">
                Loading ingredients...
              </div>
            ) : ingredients.length === 0 ? (
              <div className="bg-white/60 backdrop-blur-xl rounded-3xl border border-gray-200/50 p-12 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">🥄</span>
                </div>
                <p className="text-gray-500 font-medium">No ingredients found</p>
                <button
                  onClick={() => setShowPurchaseModal(true)}
                  className="mt-3 bg-black hover:bg-gray-800 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-colors"
                >
                  Add First Ingredient
                </button>
              </div>
            ) : (
              <div className="bg-white/80 backdrop-blur-xl rounded-2xl overflow-hidden border border-gray-200/50 shadow-sm">
                <table className="w-full">
                  <thead className="bg-gray-50/80">
                    <tr>
                      <th className="text-left px-5 py-4 text-gray-500 text-xs font-semibold uppercase tracking-wide">Ingredient</th>
                      <th className="text-left px-5 py-4 text-gray-500 text-xs font-semibold uppercase tracking-wide">Category</th>
                      <th className="text-center px-5 py-4 text-gray-500 text-xs font-semibold uppercase tracking-wide">Stock</th>
                      <th className="text-center px-5 py-4 text-gray-500 text-xs font-semibold uppercase tracking-wide">Min Stock</th>
                      <th className="text-center px-5 py-4 text-gray-500 text-xs font-semibold uppercase tracking-wide">Unit Cost</th>
                      <th className="text-right px-5 py-4 text-gray-500 text-xs font-semibold uppercase tracking-wide">Inv. Value</th>
                      <th className="text-left px-5 py-4 text-gray-500 text-xs font-semibold uppercase tracking-wide">Status</th>
                      <th className="text-right px-5 py-4 text-gray-500 text-xs font-semibold uppercase tracking-wide">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {ingredients.map((ing) => {
                      const isLow = ing.currentStock <= ing.minStock && ing.currentStock > 0;
                      const isOut = ing.currentStock <= 0;
                      const isEditing = ingEditId === ing.id;
                      const statusColor = isOut ? 'bg-red-100 text-red-800' : isLow ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800';
                      const statusText = isOut ? 'OUT OF STOCK' : isLow ? 'LOW STOCK' : 'IN STOCK';
                      return (
                        <tr key={ing.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-5 py-4">
                            <p className="text-gray-900 font-medium text-sm">{ing.name}</p>
                            <p className="text-gray-400 text-xs mt-0.5">{ing.baseUnit} (purchase: {ing.purchaseUnit || ing.baseUnit})</p>
                          </td>
                          <td className="px-5 py-4">
                            <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">
                              {ing.category || '—'}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-center">
                            {isEditing ? (
                              <input
                                type="number"
                                step="0.1"
                                value={ingEditStock}
                                onChange={(e) => setIngEditStock(e.target.value)}
                                className="w-20 bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-black"
                              />
                            ) : (
                              <span className={`text-base font-semibold ${isOut ? 'text-red-500' : isLow ? 'text-orange-500' : 'text-gray-900'}`}>
                                {ing.currentStock.toLocaleString()} {ing.baseUnit}
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-4 text-center">
                            {isEditing ? (
                              <input
                                type="number"
                                step="0.1"
                                value={ingEditThreshold}
                                onChange={(e) => setIngEditThreshold(e.target.value)}
                                className="w-20 bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-black"
                              />
                            ) : (
                              <span className="text-gray-600 text-sm font-medium">{ing.minStock.toLocaleString()} {ing.baseUnit}</span>
                            )}
                          </td>
                          <td className="px-5 py-4 text-center">
                            {isEditing ? (
                              <input
                                type="number"
                                step="0.01"
                                value={ingEditStock}
                                onChange={(e) => {}}
                                readOnly
                                className="w-24 bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-3 py-2 text-sm text-center focus:outline-none"
                              />
                            ) : (
                              <span className="text-gray-900 font-semibold text-sm">₱{ing.costPerUnit.toFixed(2)}</span>
                            )}
                            <span className="text-gray-400 text-xs ml-1">/{ing.baseUnit}</span>
                          </td>
                          <td className="px-5 py-4 text-right">
                            <span className="text-gray-900 font-semibold text-sm">
                              ₱{Number(ing.inventoryValue || 0).toFixed(2)}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${statusColor}`}>
                              {statusText}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center justify-end gap-2">
                              {isEditing ? (
                                <>
                                  <button
                                    onClick={() => saveIngredientEdit(ing.id)}
                                    disabled={ingSaving}
                                    className="bg-black hover:bg-gray-800 text-white px-3 py-1.5 rounded-xl text-xs font-medium transition-colors disabled:opacity-50"
                                  >
                                    {ingSaving ? 'Saving...' : 'Save'}
                                  </button>
                                  <button
                                    onClick={() => { setIngEditId(null); setIngEditStock(''); setIngEditThreshold(''); setIngEditSupplier(''); setIngEditCategory(''); setIngEditPurchaseUnit(''); }}
                                    className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1.5 rounded-xl text-xs transition-colors"
                                  >
                                    Cancel
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={() => { setIngEditId(ing.id); setIngEditStock(String(ing.currentStock)); setIngEditThreshold(String(ing.minStock)); setIngEditSupplier(ing.supplier?.id || ''); setIngEditCategory(ing.category || ''); setIngEditPurchaseUnit(ing.purchaseUnit || ''); }}
                                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => { setHistoryIngredient(ing); setShowHistoryModal(true); fetchHistory(ing.id); }}
                                    className="bg-blue-50 hover:bg-blue-100 text-blue-600 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors"
                                  >
                                    History
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
           </div>
          )}

          {/* Add Purchase Modal */}
          {showPurchaseModal && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
              onClick={() => setShowPurchaseModal(false)}
            >
              <div
                className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Ingredient Purchase</h3>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    await savePurchase();
                  }}
                >
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Ingredient *</label>
                      <select
                        value={purchaseForm.ingredientId}
                        onChange={(e) => setPurchaseForm((f) => ({ ...f, ingredientId: e.target.value }))}
                        required
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black"
                      >
                        <option value="">Select ingredient</option>
                        {ingredients.map((ing) => (
                          <option key={ing.id} value={ing.id}>
                            {ing.name} ({ing.purchaseUnit || ing.baseUnit})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Quantity *</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={purchaseForm.quantity}
                          onChange={(e) => setPurchaseForm((f) => ({ ...f, quantity: e.target.value }))}
                          required
                            onInput={(e) => {
                            const target = e.target as HTMLInputElement;
                            if (target.value) {
                              const qty = parseFloat(target.value);
                            }
                          }}
                          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Unit *</label>
                        <select
                          value={purchaseForm.purchaseUnit}
                          onChange={(e) => setPurchaseForm((f) => ({ ...f, purchaseUnit: e.target.value }))}
                          required
                          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black"
                        >
                          <option value="">Select unit</option>
                          {['kg', 'g', 'L', 'ml', 'pcs', 'bottle', 'pack', 'box', 'sachet'].map((u) => (
                            <option key={u} value={u}>{u}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Purchase Cost (₱) *</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={purchaseForm.purchaseCost}
                        onChange={(e) => setPurchaseForm((f) => ({ ...f, purchaseCost: e.target.value }))}
                        required
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black"
                      />
                    </div>

                    {/* Auto-calculated Price Per Unit display */}
                    {purchaseForm.quantity && purchaseForm.purchaseCost && purchaseForm.purchaseUnit && (
                      <div className="bg-gray-50 rounded-xl p-4">
                        <span className="text-xs text-gray-500 font-medium">
                          Price Per Unit:{' '}
                          {(() => {
                            const qty = parseFloat(purchaseForm.quantity);
                            const cost = parseFloat(purchaseForm.purchaseCost);
                            if (qty > 0) {
                              return `₱${Math.round((cost / qty) * 100) / 100}/${purchaseForm.purchaseUnit}`;
                            }
                            return '—';
                          })()}
                        </span>
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Supplier</label>
                      <select
                        value={purchaseForm.supplierId}
                        onChange={(e) => setPurchaseForm((f) => ({ ...f, supplierId: e.target.value }))}
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black"
                      >
                        <option value="">No supplier</option>
                        {suppliers.map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Purchase Date</label>
                      <input
                        type="date"
                        value={purchaseForm.purchaseDate}
                        onChange={(e) => setPurchaseForm((f) => ({ ...f, purchaseDate: e.target.value }))}
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
                      <textarea
                        value={purchaseForm.notes}
                        onChange={(e) => setPurchaseForm((f) => ({ ...f, notes: e.target.value }))}
                        rows={2}
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black resize-none"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 mt-6">
                    <button
                      type="button"
                      onClick={() => setShowPurchaseModal(false)}
                      className="flex-1 bg-gray-100 text-gray-700 font-semibold py-3 rounded-xl hover:bg-gray-200 transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={purchaseSaving}
                      className="flex-1 bg-black hover:bg-gray-800 text-white font-semibold py-3 rounded-xl transition disabled:opacity-50"
                    >
                      {purchaseSaving ? 'Saving...' : 'Save Purchase'}
                    </button>
                  </div>

                  {purchaseResult && (
                    <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-4">
                      <p className="text-sm text-green-800 font-medium">Purchase recorded!</p>
                      <p className="text-xs text-green-700 mt-1">
                        Price Per Unit: ₱{purchaseResult.pricePerUnit} | New Stock: {purchaseResult.newStock} | Weighted Avg Cost/Unit: ₱{purchaseResult.newWeightedCost}
                      </p>
                    </div>
                  )}
                </form>
              </div>
            </div>
          )}

          {/* Adjust Stock Modal */}
          {showAdjustModal && adjustingIngredient && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
              onClick={() => setShowAdjustModal(false)}
            >
              <div
                className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Adjust Stock: {adjustingIngredient.name}
                </h3>
                <div className="bg-gray-50 rounded-xl p-3 mb-4">
                  <p className="text-xs text-gray-500">Current stock</p>
                  <p className="text-lg font-semibold text-gray-900">{adjustingIngredient.currentStock} {adjustingIngredient.baseUnit}</p>
                </div>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    await saveAdjustment();
                  }}
                >
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Adjustment Amount *</label>
                      <input
                        type="number"
                        step="0.1"
                        value={adjustForm.quantity}
                        onChange={(e) => setAdjustForm((f) => ({ ...f, quantity: e.target.value }))}
                        placeholder="Use - for waste/spoilage, + for correction"
                        required
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Reason *</label>
                      <select
                        value={adjustForm.reason}
                        onChange={(e) => setAdjustForm((f) => ({ ...f, reason: e.target.value as any }))}
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black"
                      >
                        <option value="WASTE">Waste</option>
                        <option value="SPOILAGE">Spoilage</option>
                        <option value="DAMAGED">Damaged</option>
                        <option value="CORRECTION">Correction</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
                      <textarea
                        value={adjustForm.notes}
                        onChange={(e) => setAdjustForm((f) => ({ ...f, notes: e.target.value }))}
                        rows={2}
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black resize-none"
                      />
                    </div>
                  </div>
                  <div className="flex gap-3 mt-6">
                    <button
                      type="button"
                      onClick={() => setShowAdjustModal(false)}
                      className="flex-1 bg-gray-100 text-gray-700 font-semibold py-3 rounded-xl hover:bg-gray-200 transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={adjustSaving}
                      className="flex-1 bg-gray-700 hover:bg-gray-900 text-white font-semibold py-3 rounded-xl transition disabled:opacity-50"
                    >
                      {adjustSaving ? 'Saving...' : 'Apply Adjustment'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Purchase History Modal */}
          {showHistoryModal && historyIngredient && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
              onClick={() => setShowHistoryModal(false)}
            >
              <div
                className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full p-6"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Purchase History: {historyIngredient.name}
                </h3>
                <p className="text-xs text-gray-500 mb-4">All stock movements for this ingredient</p>
                {historyLoading ? (
                  <div className="text-center py-8 text-gray-400">Loading history...</div>
                ) : historyData.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">No transactions found</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left px-4 py-3 text-gray-500 text-xs font-semibold uppercase">Date</th>
                          <th className="text-left px-4 py-3 text-gray-500 text-xs font-semibold uppercase">Type</th>
                          <th className="text-right px-4 py-3 text-gray-500 text-xs font-semibold uppercase">Qty ({historyIngredient.baseUnit})</th>
                          <th className="text-right px-4 py-3 text-gray-500 text-xs font-semibold uppercase">Cost</th>
                          <th className="text-right px-4 py-3 text-gray-500 text-xs font-semibold uppercase">Unit Cost</th>
                          <th className="text-left px-4 py-3 text-gray-500 text-xs font-semibold uppercase">Notes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {historyData.map((tx) => (
                          <tr key={tx.id}>
                            <td className="px-4 py-3 text-gray-500">{new Date(tx.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${
                                tx.type === 'PURCHASE' ? 'bg-green-100 text-green-800' :
                                tx.type === 'USAGE' ? 'bg-blue-100 text-blue-800' :
                                'bg-orange-100 text-orange-800'
                              }`}>
                                {tx.type}
                              </span>
                            </td>
                            <td className={`px-4 py-3 text-right font-medium ${tx.quantity < 0 ? 'text-red-600' : 'text-green-600'}`}>
                              {tx.quantity > 0 ? '+' : ''}{tx.quantity.toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-right text-gray-600">
                              {tx.purchaseCost !== null ? `₱${Number(tx.purchaseCost).toFixed(2)}` : '—'}
                            </td>
                            <td className="px-4 py-3 text-right text-gray-600">
                              {tx.unitCost !== null ? `₱${Number(tx.unitCost).toFixed(2)}` : '—'}
                            </td>
                            <td className="px-4 py-3 text-gray-600 max-w-xs truncate">
                              {tx.notes || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="flex justify-end mt-4">
                  <button
                    onClick={() => setShowHistoryModal(false)}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

         {/* Suppliers Tab Content */}
         {activeTab === 'suppliers' && (
           <div className="space-y-4">
             <div className="flex justify-between items-center">
               <h2 className="text-lg font-semibold text-gray-900">Suppliers</h2>
               <button
                 onClick={() => { setEditingSupplier(null); setShowSupplierModal(true); }}
                 className="bg-black hover:bg-gray-800 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
               >
                 + Add Supplier
               </button>
             </div>

             {suppliers.length === 0 ? (
               <div className="bg-white/60 backdrop-blur-xl rounded-3xl border border-gray-200/50 p-12 text-center">
                 <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                   <span className="text-3xl">🏢</span>
                 </div>
                 <p className="text-gray-500 font-medium">No suppliers found</p>
                 <button
                   onClick={() => { setEditingSupplier(null); setShowSupplierModal(true); }}
                   className="mt-3 bg-black hover:bg-gray-800 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-colors"
                 >
                   Add First Supplier
                 </button>
               </div>
             ) : (
               <div className="bg-white/80 backdrop-blur-xl rounded-2xl overflow-hidden border border-gray-200/50 shadow-sm">
                 <table className="w-full">
                   <thead className="bg-gray-50/80">
                     <tr>
                       <th className="text-left px-5 py-4 text-gray-500 text-xs font-semibold uppercase tracking-wide">Name</th>
                       <th className="text-left px-5 py-4 text-gray-500 text-xs font-semibold uppercase tracking-wide">Contact</th>
                       <th className="text-left px-5 py-4 text-gray-500 text-xs font-semibold uppercase tracking-wide">Status</th>
                       <th className="text-left px-5 py-4 text-gray-500 text-xs font-semibold uppercase tracking-wide">Ingredients</th>
                       <th className="text-right px-5 py-4 text-gray-500 text-xs font-semibold uppercase tracking-wide">Actions</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-gray-100">
                     {suppliers.map((supplier) => (
                       <tr key={supplier.id} className="hover:bg-gray-50/50 transition-colors">
                         <td className="px-5 py-4">
                           <p className="text-gray-900 font-medium text-sm">{supplier.name}</p>
                           {supplier.notes && (
                             <p className="text-gray-500 text-xs mt-0.5 line-clamp-1">{supplier.notes}</p>
                           )}
                         </td>
                         <td className="px-5 py-4">
                           <p className="text-gray-600 text-sm">{supplier.contactPerson || '—'}</p>
                           {supplier.phone && <p className="text-gray-500 text-xs">{supplier.phone}</p>}
                         </td>
                         <td className="px-5 py-4">
                           <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${
                             supplier.status === 'ACTIVE'
                               ? 'bg-green-100 text-green-800'
                               : 'bg-red-100 text-red-800'
                           }`}>
                             {supplier.status}
                           </span>
                         </td>
                         <td className="px-5 py-4 text-sm text-gray-600">
                           {supplier.ingredients?.length > 0
                             ? `${supplier.ingredients.length} linked`
                             : 'No ingredients'}
                         </td>
                         <td className="px-5 py-4">
                           <div className="flex items-center justify-end gap-2">
                             <button
                               onClick={() => { setEditingSupplier(supplier); setShowSupplierModal(true); }}
                               className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors"
                             >
                               Edit
                             </button>
                           </div>
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
             )}
           </div>
         )}

         {/* Products Tab Content */}
        {activeTab === 'products' && (
        <>
        {/* Low Stock Alerts - Apple Card Style */}
        {lowStock.length > 0 && (
          <div className="bg-white/60 backdrop-blur-xl rounded-3xl border border-red-200/50 p-5 shadow-lg">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">⚠️</span>
              <p className="text-red-600 font-semibold">Low Stock Alert ({lowStock.length} items)</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {lowStock.map((item) => (
                <span 
                  key={item.id} 
                  className="bg-red-50 text-red-700 px-3 py-1.5 rounded-full text-sm font-medium border border-red-100"
                >
                  {item.product.name}: {item.quantity} {item.unit}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Stats - Apple Card Grid */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-5 border border-gray-200/50 shadow-sm">
            <p className="text-3xl font-bold text-gray-900">{inventory.length}</p>
            <p className="text-gray-500 text-sm font-medium mt-1">Total Products</p>
          </div>
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-5 border border-red-200/50 shadow-sm">
            <p className="text-3xl font-bold text-red-500">{lowStock.length}</p>
            <p className="text-gray-500 text-sm font-medium mt-1">Low Stock</p>
          </div>
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-5 border border-green-200/50 shadow-sm">
            <p className="text-3xl font-bold text-green-500">{inventory.filter((i) => i.quantity > i.lowStockThreshold).length}</p>
            <p className="text-gray-500 text-sm font-medium mt-1">Well Stocked</p>
          </div>
        </div>

        {/* Category Filter - Pill Style */}
        <div className="flex gap-2 flex-wrap">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCat(cat)}
              className={`
                px-4 py-2 rounded-full text-sm font-medium transition-all duration-200
                ${filterCat === cat 
                  ? 'bg-black text-white shadow-lg' 
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                }
              `}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Inventory Table - Apple Style */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-gray-400">Loading inventory...</div>
          </div>
        ) : (
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl overflow-hidden border border-gray-200/50 shadow-sm">
            <table className="w-full">
              <thead className="bg-gray-50/80">
                <tr>
                  <th className="text-left px-5 py-4 text-gray-500 text-xs font-semibold uppercase tracking-wide">Product</th>
                  <th className="text-left px-5 py-4 text-gray-500 text-xs font-semibold uppercase tracking-wide">Category</th>
                  <th className="text-center px-5 py-4 text-gray-500 text-xs font-semibold uppercase tracking-wide">Stock</th>
                  <th className="text-center px-5 py-4 text-gray-500 text-xs font-semibold uppercase tracking-wide">Threshold</th>
                  <th className="text-center px-5 py-4 text-gray-500 text-xs font-semibold uppercase tracking-wide">Status</th>
                  <th className="text-right px-5 py-4 text-gray-500 text-xs font-semibold uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((item) => {
                  const isLow = item.quantity <= item.lowStockThreshold;
                  const isEditing = editId === item.id;
                  const isAdjusting = adjustId === item.id;
                  const pct = Math.min((item.quantity / (item.lowStockThreshold * 2)) * 100, 100);

                  return (
                    <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-4">
                        <p className="text-gray-900 font-medium text-sm">{item.product.name}</p>
                        <p className="text-gray-400 text-xs mt-0.5">₱{item.product.price.toFixed(2)}</p>
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1.5 bg-gray-100 px-2.5 py-1 rounded-full text-xs font-medium text-gray-600">
                          {item.product.category.icon} {item.product.category.name}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        {isAdjusting ? (
                          <div className="flex items-center justify-center gap-1">
                            <input
                              type="number"
                              value={adjustAmt}
                              onChange={(e) => setAdjustAmt(e.target.value)}
                              placeholder="±"
                              className="w-16 bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                            />
                          </div>
                        ) : (
                          <div className="flex flex-col items-center">
                            <p className={`text-base font-semibold ${isLow ? 'text-red-500' : 'text-gray-900'}`}>
                              {item.quantity} {item.unit}
                            </p>
                            {/* Progress bar */}
                            <div className="w-16 h-1.5 bg-gray-100 rounded-full mt-1 overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all ${isLow ? 'bg-red-400' : 'bg-green-400'}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4 text-center">
                        {isEditing ? (
                          <input
                            type="number"
                            value={editThreshold}
                            onChange={(e) => setEditThreshold(e.target.value)}
                            className="w-16 bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                          />
                        ) : (
                          <span className="text-gray-600 text-sm font-medium">{item.lowStockThreshold} {item.unit}</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-center">
                        {isLow ? (
                          <span className="inline-flex items-center gap-1 bg-red-50 text-red-600 px-2.5 py-1 rounded-full text-xs font-semibold">
                            Low
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-green-50 text-green-600 px-2.5 py-1 rounded-full text-xs font-semibold">
                            OK
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {isEditing ? (
                            <>
                              <button
                                onClick={() => saveEdit(item.product.id)}
                                disabled={saving}
                                className="bg-black hover:bg-gray-800 text-white px-3 py-1.5 rounded-xl text-xs font-medium transition-colors"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditId(null)}
                                className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1.5 rounded-xl text-xs transition-colors"
                              >
                                Cancel
                              </button>
                            </>
                          ) : isAdjusting ? (
                            <>
                              <button
                                onClick={() => applyAdjustment(item.product.id)}
                                disabled={saving}
                                className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-xl text-xs font-medium transition-colors"
                              >
                                Apply
                              </button>
                              <button
                                onClick={() => setAdjustId(null)}
                                className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1.5 rounded-xl text-xs transition-colors"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => {
                                  setEditId(item.id);
                                  setEditQty(String(item.quantity));
                                  setEditThreshold(String(item.lowStockThreshold));
                                }}
                                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => { setAdjustId(item.id); setAdjustAmt(''); }}
                                className="bg-blue-50 hover:bg-blue-100 text-blue-600 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors"
                              >
                                ±Adjust
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        </>
        )}

        {/* Production Capacity Tab — derived sellable quantities + limiting ingredient */}
        {activeTab === 'capacity' && (
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl overflow-hidden border border-gray-200/50 shadow-sm">
            {capacityLoading ? (
              <div className="p-8 text-center text-gray-400">Calculating production capacity…</div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50/80">
                  <tr>
                    <th className="text-left px-5 py-4 text-gray-500 text-xs font-semibold uppercase tracking-wide">Product</th>
                    <th className="text-center px-5 py-4 text-gray-500 text-xs font-semibold uppercase tracking-wide">Can Make</th>
                    <th className="text-left px-5 py-4 text-gray-500 text-xs font-semibold uppercase tracking-wide">Limiting Ingredient</th>
                    <th className="text-center px-5 py-4 text-gray-500 text-xs font-semibold uppercase tracking-wide">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {capacity.map((c: any) => {
                    const isUnlimited = c.sellable >= Number.MAX_SAFE_INTEGER;
                    const sellableDisplay = isUnlimited ? '∞' : c.sellable;
                    const statusColor =
                      c.status === 'OUT_OF_STOCK' ? 'bg-red-100 text-red-800'
                      : c.status === 'LOW_STOCK' ? 'bg-orange-100 text-orange-800'
                      : 'bg-green-100 text-green-800';
                    const statusText =
                      c.status === 'OUT_OF_STOCK' ? 'UNAVAILABLE'
                      : c.status === 'LOW_STOCK' ? 'LOW STOCK'
                      : 'AVAILABLE';
                    return (
                      <tr key={c.productId} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-5 py-4">
                          <p className="text-gray-900 font-medium text-sm">{c.productName}</p>
                        </td>
                        <td className="px-5 py-4 text-center">
                          <span className="text-gray-900 font-bold text-lg">{sellableDisplay}</span>
                        </td>
                        <td className="px-5 py-4">
                          <span className="text-gray-500 text-sm">{c.limitingIngredient || '—'}</span>
                        </td>
                        <td className="px-5 py-4 text-center">
                          <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${statusColor}`}>
                            {statusText}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {capacity.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-5 py-8 text-center text-gray-400">No products found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        )}
        </main>

       {/* Supplier Management Modal */}
       {showSupplierModal && (
         <div
           className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
           onClick={() => setShowSupplierModal(false)}
         >
           <div
             className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6"
             onClick={(e) => e.stopPropagation()}
           >
             <h3 className="text-lg font-semibold text-gray-900 mb-4">
               {editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}
             </h3>
             <form
               onSubmit={async (e) => {
                 e.preventDefault();
                 const form = e.currentTarget;
                 const formData = {
                   name: (form.elements.namedItem('name') as HTMLInputElement).value,
                   contactPerson: (form.elements.namedItem('contactPerson') as HTMLInputElement).value || null,
                   phone: (form.elements.namedItem('phone') as HTMLInputElement).value || null,
                   email: (form.elements.namedItem('email') as HTMLInputElement).value || null,
                   address: (form.elements.namedItem('address') as HTMLInputElement).value || null,
                   notes: (form.elements.namedItem('notes') as HTMLTextAreaElement).value || null,
                   status: (form.elements.namedItem('status') as HTMLSelectElement).value,
                 };
                 await saveSupplier(formData);
               }}
             >
               <div className="space-y-4">
                 <div>
                   <label className="block text-xs font-medium text-gray-500 mb-1">Name *</label>
                   <input
                     name="name"
                     type="text"
                     required
                     defaultValue={editingSupplier?.name || ''}
                     className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black"
                   />
                 </div>
                 <div>
                   <label className="block text-xs font-medium text-gray-500 mb-1">Contact Person</label>
                   <input
                     name="contactPerson"
                     type="text"
                     defaultValue={editingSupplier?.contactPerson || ''}
                     className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black"
                   />
                 </div>
                 <div>
                   <label className="block text-xs font-medium text-gray-500 mb-1">Phone</label>
                   <input
                     name="phone"
                     type="text"
                     defaultValue={editingSupplier?.phone || ''}
                     className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black"
                   />
                 </div>
                 <div>
                   <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
                   <input
                     name="email"
                     type="email"
                     defaultValue={editingSupplier?.email || ''}
                     className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black"
                   />
                 </div>
                 <div>
                   <label className="block text-xs font-medium text-gray-500 mb-1">Address</label>
                   <input
                     name="address"
                     type="text"
                     defaultValue={editingSupplier?.address || ''}
                     className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black"
                   />
                 </div>
                 <div>
                   <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
                   <textarea
                     name="notes"
                     rows={3}
                     defaultValue={editingSupplier?.notes || ''}
                     className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black resize-none"
                   />
                 </div>
                 <div>
                   <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
                   <select
                     name="status"
                     defaultValue={editingSupplier?.status || 'ACTIVE'}
                     className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black"
                   >
                     <option value="ACTIVE">Active</option>
                     <option value="INACTIVE">Inactive</option>
                   </select>
                 </div>
               </div>
               <div className="flex gap-3 mt-6">
                 <button
                   type="button"
                   onClick={() => setShowSupplierModal(false)}
                   className="flex-1 bg-gray-100 text-gray-700 font-semibold py-3 rounded-xl hover:bg-gray-200 transition"
                 >
                   Cancel
                 </button>
                 <button
                   type="submit"
                   className="flex-1 bg-black hover:bg-gray-800 text-white font-semibold py-3 rounded-xl transition"
                 >
                   {editingSupplier ? 'Save Changes' : 'Add Supplier'}
                 </button>
               </div>
             </form>
           </div>
         </div>
       )}
     </div>
   );
}


