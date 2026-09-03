'use client';
import Link from 'next/link';

import { useState, useEffect, useCallback, Fragment, useRef, useMemo } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { fetchJson, userMessage } from '@/lib/fetch-json';

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
    _count?: { ingredients: number };
  };
}

interface IngredientItem {
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

interface SupplierItem {
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

export default function InventoryPage() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterCat, setFilterCat] = useState('All');
  const [editId, setEditId] = useState<number | null>(null);
  const [editQty, setEditQty] = useState('');
  const [editThreshold, setEditThreshold] = useState('');
  const [adjustId, setAdjustId] = useState<number | null>(null);
  const [adjustAmt, setAdjustAmt] = useState('');
  const [saving, setSaving] = useState(false);
  const [ingredients, setIngredients] = useState<IngredientItem[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierItem[]>([]);
  const [expandedSupplierId, setExpandedSupplierId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'products' | 'ingredients' | 'suppliers' | 'capacity'>('products');
  const [loadingIngredients, setLoadingIngredients] = useState(false);
  const [ingEditId, setIngEditId] = useState<number | null>(null);
  const [ingEditStock, setIngEditStock] = useState('');
  const [ingEditThreshold, setIngEditThreshold] = useState('');
  const [ingEditSupplier, setIngEditSupplier] = useState<number | ''>('');
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
      const data = await fetchJson<unknown>('/api/ingredients/production-capacity');
      if (Array.isArray(data)) {
        setCapacity(data);
      } else if (data && typeof data === 'object' && 'entries' in data && Array.isArray(data.entries)) {
        setCapacity(data.entries);
      }
    } catch (e) {
      console.error('Failed to fetch capacity:', e);
      setError(userMessage(e, 'Could not load production capacity. Try again.'));
    } finally {
      setCapacityLoading(false);
    }
  }, []);

// ── Ingredient management (moved from Products ▸ Ingredients) ──────────────
const [showIngredientModal, setShowIngredientModal] = useState(false);
const [editingIngredientFull, setEditingIngredientFull] = useState<any>(null);
  const [ingredientForm, setIngredientForm] = useState({
    name: '', baseUnit: 'g', purchaseUnit: 'g',
    currentStock: 0, minStock: 0, costPerUnit: 0, supplierId: null as number | null,
  });
const [formSaving, setFormSaving] = useState(false);
const [showSupplierQuickModal, setShowSupplierQuickModal] = useState(false);
const [supplierQuickForm, setSupplierQuickForm] = useState({ name: '', contactPerson: '', phone: '', email: '', address: '' });
const [ingSearch, setIngSearch] = useState('');
const [ingSort, setIngSort] = useState<'name' | 'name-desc' | 'stock' | 'stock-desc' | 'shortfall'>('name');
// Purchase planner (moved from Products page)
const [plannerOpen, setPlannerOpen] = useState(false);
const [calcProducts, setCalcProducts] = useState<Record<number, number>>({});
const [calcResult, setCalcResult] = useState<any>(null);
const [calcLoading, setCalcLoading] = useState(false);
const [calcSearch, setCalcSearch] = useState('');
const [calcSortToggle, setCalcSortToggle] = useState<'name' | 'name-desc'>('name');
const invoiceRef = useRef<HTMLDivElement>(null);
const [shopName, setShopName] = useState('CafeOS');

  // Purchase history UI removed — superseded by the Stock History page

  const fetchInventory = useCallback(async () => {
    try {
      setInventory(await fetchJson<InventoryItem[]>('/api/inventory'));
    } catch (e) {
      console.error('Failed to fetch inventory:', e);
      setError(userMessage(e, 'Could not load inventory. Try again.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchInventory(); }, [fetchInventory]);

  const fetchIngredients = useCallback(async () => {
    setLoadingIngredients(true);
    try {
      const data = await fetchJson<{ ingredients?: IngredientItem[]; summary?: unknown }>('/api/ingredients/dashboard');
      if (data.ingredients) {
        setIngredients(data.ingredients);
        setIngredientStats(data.summary);
      } else {
        // Fallback: fetch from basic endpoint if dashboard not yet available
        setIngredients(await fetchJson<IngredientItem[]>('/api/ingredients'));
      }
    } catch (e) {
      console.error('Failed to fetch ingredients:', e);
      setError(userMessage(e, 'Could not load ingredients. Try again.'));
    } finally {
      setLoadingIngredients(false);
    }
  }, []);

  const fetchSuppliers = useCallback(async () => {
    try {
      setSuppliers(await fetchJson<SupplierItem[]>('/api/suppliers'));
    } catch (e) {
      console.error('Failed to fetch suppliers:', e);
      setError(userMessage(e, 'Could not load suppliers. Try again.'));
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
      await fetchJson(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      await fetchSuppliers();
      setShowSupplierModal(false);
      setEditingSupplier(null);
    } catch (e) {
      console.error('Failed to save supplier:', e);
      alert(userMessage(e, 'Failed to save supplier'));
    }
  }

  useEffect(() => {
    fetchIngredients();
    fetchSuppliers();
    fetchCapacity();
    fetch('/api/settings/branding')
      .then((r) => r.json())
      .then((b) => { if (b?.shopName) setShopName(b.shopName); })
      .catch(() => {});
  }, [fetchIngredients, fetchSuppliers, fetchCapacity]);

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

  // Search + sort for the Ingredients tab (moved from Products ▸ Ingredients,
  // backed by real numbers: shortfall = how far below the minimum an item sits)
  const ingVisible = useMemo(() => {
    const q = ingSearch.trim().toLowerCase();
    const arr = ingredients.filter(
      (i) =>
        !q ||
        [i.name, i.supplier?.name].some(
          (v) => v && String(v).toLowerCase().includes(q)
        )
    );
    const cmp: Record<string, (a: IngredientItem, b: IngredientItem) => number> = {
      name: (a, b) => a.name.localeCompare(b.name),
      'name-desc': (a, b) => b.name.localeCompare(a.name),
      stock: (a, b) => a.currentStock - b.currentStock,
      'stock-desc': (a, b) => b.currentStock - a.currentStock,
      shortfall: (a, b) => a.currentStock - a.minStock - (b.currentStock - b.minStock),
    };
    return [...arr].sort(cmp[ingSort] ?? cmp.name);
  }, [ingredients, ingSearch, ingSort]);

  async function saveEdit(productId: number) {
    setSaving(true);
    try {
      await fetchJson('/api/inventory', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          lowStockThreshold: parseInt(editThreshold),
        }),
      });
      setEditId(null);
      await fetchInventory();
    } catch (e) {
      console.error('Failed to save inventory settings:', e);
      alert(userMessage(e, 'Failed to save inventory settings'));
    } finally {
      setSaving(false);
    }
  }

  async function applyAdjustment(productId: number) {
    const amt = parseInt(adjustAmt);
    if (isNaN(amt) || amt === 0) return;
    setSaving(true);
    try {
      await fetchJson('/api/inventory', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, adjustment: amt }),
      });
      setAdjustId(null);
      setAdjustAmt('');
      await fetchInventory();
    } catch (e) {
      console.error('Failed to adjust stock:', e);
      alert(userMessage(e, 'Failed to adjust stock'));
    } finally {
      setSaving(false);
    }
  }

  async function saveIngredientEdit(id: number) {
    if (isNaN(parseInt(ingEditStock)) || isNaN(parseInt(ingEditThreshold))) return;
    setIngSaving(true);
    try {
      await fetchJson(`/api/ingredients/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentStock: parseFloat(ingEditStock),
          minStock: parseFloat(ingEditThreshold),
          supplierId: ingEditSupplier || undefined,
          purchaseUnit: ingEditPurchaseUnit || undefined,
        }),
      });
      setIngEditId(null);
      await fetchIngredients();
    } catch (e) {
      console.error('Failed to update ingredient:', e);
      alert(userMessage(e, 'Failed to update ingredient'));
    } finally {
      setIngSaving(false);
    }
  }

  // ── Ingredient create/edit/delete (moved from Products ▸ Ingredients) ─────
  const defaultUnits = ['pcs', 'kg', 'g', 'ml', 'L', 'oz', 'lb', 'cup', 'scoop', 'slice', 'piece', 'pack', 'box', 'can', 'bottle'];
  const uniqueUnits = Array.from(new Set([
    ...defaultUnits,
    ...ingredients.map((ing) => ing.baseUnit || '').filter((u) => u.trim() !== ''),
  ])).sort();

  function openAddIngredient() {
    setEditingIngredientFull(null);
    setIngredientForm({ name: '', baseUnit: 'g', purchaseUnit: 'g', currentStock: 0, minStock: 0, costPerUnit: 0, supplierId: null });
    setShowIngredientModal(true);
  }

  function openEditIngredientFull(ing: IngredientItem) {
    setEditingIngredientFull(ing);
    setIngredientForm({
      name: ing.name,
      baseUnit: ing.baseUnit,
      purchaseUnit: ing.purchaseUnit || ing.baseUnit || 'g',
      currentStock: ing.currentStock,
      minStock: ing.minStock,
      costPerUnit: ing.costPerUnit,
      supplierId: ing.supplier?.id || null,
    });
    setShowIngredientModal(true);
  }

  async function saveIngredientFull() {
    if (!ingredientForm.name.trim()) return;
    setFormSaving(true);
    try {
      if (editingIngredientFull) {
        await fetchJson(`/api/ingredients/${editingIngredientFull.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(ingredientForm),
        });
      } else {
        await fetchJson('/api/ingredients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(ingredientForm),
        });
      }
      setShowIngredientModal(false);
      await fetchIngredients();
    } catch (e) {
      console.error('Failed to save ingredient:', e);
      alert(userMessage(e, 'Failed to save ingredient'));
    } finally {
      setFormSaving(false);
    }
  }

  async function quickCreateSupplier() {
    try {
      const res = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(supplierQuickForm),
      });
      if (res.ok) {
        const created = await res.json();
        setSuppliers((prev) => [...prev, created]);
        setIngredientForm((f) => ({ ...f, supplierId: created.id }));
        setShowSupplierQuickModal(false);
        setSupplierQuickForm({ name: '', contactPerson: '', phone: '', email: '', address: '' });
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Failed to create supplier');
      }
    } catch (e) {
      console.error('Failed to create supplier:', e);
      alert('Network error creating supplier');
    }
  }

  async function deleteIngredient(id: number) {
    if (!confirm('Delete this ingredient? This will also remove it from all products that use it.')) return;
    try {
      await fetchJson(`/api/ingredients/${id}`, { method: 'DELETE' });
      await fetchIngredients();
    } catch (e) {
      console.error('Failed to delete ingredient:', e);
      alert(userMessage(e, 'Failed to delete ingredient'));
    }
  }

  // ── Purchase planner (moved from Products ▸ Ingredients) ──────────────────
  const plannerProducts = useMemo(() => {
    const seen = new Set<number>();
    const out: { id: number; name: string }[] = [];
    for (const i of inventory) {
      if (!seen.has(i.product.id)) {
        seen.add(i.product.id);
        out.push({ id: i.product.id, name: i.product.name });
      }
    }
    return out;
  }, [inventory]);

  async function calculateIngredients() {
    const items = Object.entries(calcProducts)
      .map(([productId, qty]) => ({ productId: parseInt(productId), quantity: qty }))
      .filter((item) => item.quantity > 0);

    if (items.length === 0) {
      alert('Please select products and quantities first');
      return;
    }

    setCalcLoading(true);
    try {
      const res = await fetch('/api/ingredients/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      const data = await res.json();
      setCalcResult(data);
    } catch (e) {
      console.error('Failed to calculate:', e);
      alert('Calculation failed');
    } finally {
      setCalcLoading(false);
    }
  }

  // Download invoice - reliable canvas-based approach
  const downloadInvoice = async (format: 'png' | 'pdf') => {
    if (!calcResult || !calcResult.ingredients?.length) return;

    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        alert('Failed to create canvas');
        return;
      }

      // Pre-calculate wrapped product lines for height calculation
      const productLines: string[] = [];
      Object.entries(calcProducts).filter(([, qty]) => qty > 0).forEach(([pid, qty]) => {
        const prod = plannerProducts.find((p) => p.id === Number(pid));
        if (prod) {
          productLines.push(`${prod.name} (${qty}x)`);
        }
      });

      const estimatedWrappedLines = Math.ceil(productLines.length / 8) || 1;

      const headerHeight = 70;
      const ingredientRowHeight = 22;
      const footerHeight = 30;
      const productsSectionHeight = 20 + estimatedWrappedLines * 14 + 10;
      const totalHeight =
        headerHeight + productsSectionHeight + calcResult.ingredients.length * ingredientRowHeight + footerHeight + 50;

      canvas.width = 350;
      canvas.height = totalHeight;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#fffbeb';
      ctx.fillRect(0, 0, canvas.width, 60);

      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(0, 60, canvas.width, 3);

      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(15, 15, 30, 30);

      ctx.fillStyle = '#1e293b';
      ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillText('Purchase Invoice', 55, 32);

      ctx.fillStyle = '#64748b';
      ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillText(
        `${shopName} • ${new Date().toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}`,
        55,
        48
      );

      ctx.fillStyle = '#d97706';
      ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`₱${calcResult.grandTotal?.toFixed(2)}`, canvas.width - 15, 35);

      ctx.fillStyle = '#64748b';
      ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillText('TOTAL', canvas.width - 15, 50);
      ctx.textAlign = 'left';

      const productsY = 80;
      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 10px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillText('Making:', 15, productsY);

      ctx.fillStyle = '#fef3c7';
      ctx.fillRect(10, productsY + 5, canvas.width - 20, 18);

      ctx.fillStyle = '#b45309';
      ctx.font = 'bold 9px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillText('Product', 15, productsY + 16);
      ctx.textAlign = 'right';
      ctx.fillText('Qty', canvas.width - 15, productsY + 16);
      ctx.textAlign = 'left';

      let currentLine = '';
      const wrappedLines: string[] = [];
      const maxWidth = canvas.width - 30;

      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');
      if (tempCtx) {
        tempCtx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
        productLines.forEach((item) => {
          const testLine = currentLine ? currentLine + ', ' + item : item;
          const textWidth = tempCtx.measureText(testLine).width;

          if (textWidth > maxWidth && currentLine) {
            wrappedLines.push(currentLine);
            currentLine = item;
          } else {
            currentLine = testLine;
          }
        });
        if (currentLine) wrappedLines.push(currentLine);
      } else {
        wrappedLines.push(...productLines);
      }

      let prodY = productsY + 20;
      wrappedLines.forEach((line) => {
        ctx.fillStyle = '#334155';
        ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.fillText(line, 15, prodY);
        prodY += 14;
      });

      const ingStartY = prodY + 10;
      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 10px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillText('Ingredients:', 15, ingStartY);

      const tableHeaderY = ingStartY + 15;
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(10, tableHeaderY, canvas.width - 20, 16);

      ctx.fillStyle = '#475569';
      ctx.font = 'bold 9px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillText('Item', 15, tableHeaderY + 11);
      ctx.textAlign = 'right';
      ctx.fillText('Qty', 130, tableHeaderY + 11);
      ctx.fillText('Cost', canvas.width - 15, tableHeaderY + 11);
      ctx.textAlign = 'left';

      let rowY = tableHeaderY + 20;
      calcResult.ingredients?.forEach((ing: any, idx: number) => {
        ctx.fillStyle = idx % 2 === 0 ? '#f8fafc' : '#ffffff';
        ctx.fillRect(10, rowY - 10, canvas.width - 20, 20);

        ctx.fillStyle = '#334155';
        ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.fillText(ing.name.substring(0, 20), 15, rowY + 2);

        ctx.fillStyle = '#334155';
        ctx.textAlign = 'right';
        ctx.fillText(`${ing.quantityNeeded} ${ing.baseUnit}`, 130, rowY + 2);

        ctx.fillStyle = '#059669';
        ctx.font = 'medium 10px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.fillText(`₱${ing.totalCost?.toFixed(2)}`, canvas.width - 15, rowY + 2);
        ctx.textAlign = 'left';

        rowY += 22;
      });

      const footerY = totalHeight - 25;
      ctx.fillStyle = '#f1f5f9';
      ctx.fillRect(0, footerY, canvas.width, 25);
      ctx.fillStyle = '#64748b';
      ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${shopName} • Purchase Request`, canvas.width / 2, footerY + 15);
      ctx.textAlign = 'left';

      if (format === 'png') {
        const link = document.createElement('a');
        link.download = `purchase-invoice-${new Date().toISOString().split('T')[0]}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      } else if (format === 'pdf') {
        const imgData = canvas.toDataURL('image/png');
        const pdfWidth = 80; // mm (receipt size)
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

        const { jsPDF } = await import('jspdf');
        const pdf = new jsPDF('p', 'mm', [pdfWidth, pdfHeight]);
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`purchase-invoice-${new Date().toISOString().split('T')[0]}.pdf`);
      }
    } catch (err) {
      console.error('Failed to generate invoice:', err);
      alert('Failed to generate invoice. Please try again.');
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
        {error && (
          <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <span>{error}</span>
            <button type="button" onClick={() => setError(null)} className="ml-4 font-medium hover:underline">Dismiss</button>
          </div>
        )}
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
                  onClick={openAddIngredient}
                  className="bg-black hover:bg-gray-800 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
                >
                  + New Ingredient
                </button>
                <button
                  onClick={() => { setShowPurchaseModal(true); setPurchaseResult(null); }}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
                >
                  + Add Purchase
                </button>
                <button
                  onClick={() => { setPlannerOpen(true); setCalcResult(null); setCalcProducts({}); }}
                  className="bg-amber-50 hover:bg-amber-100 text-amber-700 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
                >
                  🧾 Plan Purchases
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
                  onClick={openAddIngredient}
                  className="mt-3 bg-black hover:bg-gray-800 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-colors"
                >
                  Add First Ingredient
                </button>
              </div>
            ) : (
              <>
              <div className="flex items-center justify-between gap-3 mb-3">
                <input
                  type="text"
                  placeholder="Search ingredients..."
                  value={ingSearch}
                  onChange={(e) => setIngSearch(e.target.value)}
                  className="flex-1 max-w-xs px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-transparent"
                />
                <select
                  value={ingSort}
                  onChange={(e) => setIngSort(e.target.value as typeof ingSort)}
                  className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-black/10"
                >
                  <option value="name">Name A–Z</option>
                  <option value="name-desc">Name Z–A</option>
                  <option value="stock">Stock low → high</option>
                  <option value="stock-desc">Stock high → low</option>
                  <option value="shortfall">Biggest shortfall first</option>
                </select>
              </div>
              <div className="bg-white/80 backdrop-blur-xl rounded-2xl overflow-hidden border border-gray-200/50 shadow-sm">
                <table className="w-full">
                  <thead className="bg-gray-50/80">
                    <tr>
                      <th className="text-left px-5 py-4 text-gray-500 text-xs font-semibold uppercase tracking-wide">Ingredient</th>
                      <th className="text-left px-5 py-4 text-gray-500 text-xs font-semibold uppercase tracking-wide">Supplier</th>
                      <th className="text-center px-5 py-4 text-gray-500 text-xs font-semibold uppercase tracking-wide">Stock</th>
                      <th className="text-center px-5 py-4 text-gray-500 text-xs font-semibold uppercase tracking-wide">Min Stock</th>
                      <th className="text-center px-5 py-4 text-gray-500 text-xs font-semibold uppercase tracking-wide">Unit Cost</th>
                      <th className="text-right px-5 py-4 text-gray-500 text-xs font-semibold uppercase tracking-wide">Inv. Value</th>
                      <th className="text-left px-5 py-4 text-gray-500 text-xs font-semibold uppercase tracking-wide">Status</th>
                      <th className="text-right px-5 py-4 text-gray-500 text-xs font-semibold uppercase tracking-wide">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {ingVisible.map((ing) => {
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
                            {ing.supplier ? (
                              <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                                {ing.supplier.name}
                              </span>
                            ) : (
                              <span className="text-gray-400 text-xs">Unassigned</span>
                            )}
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
                                    onClick={() => { setIngEditId(null); setIngEditStock(''); setIngEditThreshold(''); setIngEditSupplier(''); setIngEditPurchaseUnit(''); }}
                                    className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1.5 rounded-xl text-xs transition-colors"
                                  >
                                    Cancel
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={() => { setIngEditId(ing.id); setIngEditStock(String(ing.currentStock)); setIngEditThreshold(String(ing.minStock)); setIngEditSupplier(ing.supplier?.id || ''); setIngEditPurchaseUnit(ing.purchaseUnit || ''); }}
                                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => openEditIngredientFull(ing)}
                                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors"
                                  >
                                    Details
                                  </button>
                                  <button
                                    onClick={() => deleteIngredient(ing.id)}
                                    className="bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors"
                                  >
                                    Delete
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
              </>
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
                        Price Per Unit: ₱{purchaseResult.pricePerUnit} | New Stock: {purchaseResult.newStock} | Latest Cost/Unit: ₱{purchaseResult.newWeightedCost}
                      </p>
                    </div>
                  )}
                </form>
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
                      {suppliers.map((supplier) => {
                        const isExpanded = expandedSupplierId === supplier.id;
                        const linkedProducts = Array.from(
                          new Set(
                            (supplier.ingredients ?? []).flatMap((i) =>
                              (i.products ?? []).map((p) => p.product.name)
                            )
                          )
                        );
                        return (
                          <Fragment key={supplier.id}>
                            <tr
                              onClick={() => setExpandedSupplierId(isExpanded ? null : supplier.id)}
                              className={`cursor-pointer transition-colors ${isExpanded ? 'bg-gray-50' : 'hover:bg-gray-50/50'}`}
                            >
                              <td className="px-5 py-4">
                                <div className="flex items-center gap-2">
                                  <span className={`text-gray-400 text-xs transition-transform ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
                                  <div>
                                    <p className="text-gray-900 font-medium text-sm">{supplier.name}</p>
                                    {supplier.notes && (
                                      <p className="text-gray-500 text-xs mt-0.5 line-clamp-1">{supplier.notes}</p>
                                    )}
                                  </div>
                                </div>
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
                                    onClick={(e) => { e.stopPropagation(); setEditingSupplier(supplier); setShowSupplierModal(true); }}
                                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors"
                                  >
                                    Edit
                                  </button>
                                </div>
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr key={`${supplier.id}-detail`} className="bg-gray-50/70">
                                <td colSpan={5} className="px-5 py-4 border-t border-gray-100">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Supplies these ingredients</p>
                                      {(supplier.ingredients?.length ?? 0) === 0 ? (
                                        <p className="text-gray-400 text-sm">No ingredients assigned yet.</p>
                                      ) : (
                                        <div className="flex flex-wrap gap-2">
                                          {supplier.ingredients.map((ing) => (
                                            <span key={ing.id} className="inline-flex items-center gap-1 bg-white border border-gray-200 px-2.5 py-1 rounded-full text-xs text-gray-700">
                                              {ing.name}
                                              <span className="text-gray-400">·</span>
                                              <span className={ing.currentStock <= 0 ? 'text-red-500 font-medium' : 'text-gray-500'}>
                                                {ing.currentStock.toLocaleString()} {ing.baseUnit}
                                              </span>
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                    <div>
                                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Menu items that use them</p>
                                      {linkedProducts.length === 0 ? (
                                        <p className="text-gray-400 text-sm">No menu items linked yet.</p>
                                      ) : (
                                        <div className="flex flex-wrap gap-2">
                                          {linkedProducts.map((name) => (
                                            <span key={name} className="inline-flex bg-amber-50 text-amber-800 px-2.5 py-1 rounded-full text-xs font-medium">
                                              {name}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
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
                  const isRecipeManaged = (item.product._count?.ingredients ?? 0) > 0;
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
                            {isRecipeManaged && (
                              <p className="text-[10px] text-gray-400 mt-0.5">from ingredients</p>
                            )}
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
                                onClick={() => {
                                  if (isRecipeManaged) {
                                    alert(
                                      `${item.product.name} is prepared from ingredients, so its stock follows your ingredient supplies. To change it, use Adjust or Purchase on its ingredients in the Ingredients tab.`
                                    );
                                    return;
                                  }
                                  setAdjustId(item.id);
                                  setAdjustAmt('');
                                }}
                                className={
                                  isRecipeManaged
                                    ? 'bg-gray-50 hover:bg-gray-100 text-gray-400 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors'
                                    : 'bg-blue-50 hover:bg-blue-100 text-blue-600 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors'
                                }
                              >
                                {isRecipeManaged ? 'From ingredients' : '±Adjust'}
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

      {/* ── Ingredient Form Modal (moved from Products ▸ Ingredients) ── */}
      {showIngredientModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingIngredientFull ? 'Edit Ingredient' : 'New Ingredient'}
              </h3>
              <button
                onClick={() => setShowIngredientModal(false)}
                className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700 flex items-center justify-center transition-all"
              >
                ✕
              </button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto flex-1 min-h-0">
              <div>
                <label className="text-gray-500 text-xs font-medium block mb-1">Ingredient Name *</label>
                <input
                  type="text"
                  value={ingredientForm.name}
                  onChange={(e) => setIngredientForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Espresso Beans"
                  className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-500 text-xs font-medium block mb-1">Base Unit *</label>
                  <select
                    value={ingredientForm.baseUnit}
                    onChange={(e) => setIngredientForm((f) => ({ ...f, baseUnit: e.target.value }))}
                    className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                  >
                    {uniqueUnits.map((unit) => (
                      <option key={unit} value={unit}>{unit}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-gray-500 text-xs font-medium block mb-1">Purchase Unit</label>
                  <select
                    value={ingredientForm.purchaseUnit}
                    onChange={(e) => setIngredientForm((f) => ({ ...f, purchaseUnit: e.target.value }))}
                    className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                  >
                    {(ingredientForm.baseUnit === 'g'
                      ? ['kg', 'g', 'oz', 'lb']
                      : ingredientForm.baseUnit === 'ml'
                        ? ['L', 'ml']
                        : ['pcs', 'pack', 'box', 'bottle']
                    ).map((unit) => (
                      <option key={unit} value={unit}>{unit}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-500 text-xs font-medium block mb-1">Current Stock</label>
                  <input
                    type="number"
                    step="0.01"
                    value={ingredientForm.currentStock}
                    onChange={(e) => setIngredientForm((f) => ({ ...f, currentStock: parseFloat(e.target.value) || 0 }))}
                    className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                  />
                </div>
                <div>
                  <label className="text-gray-500 text-xs font-medium block mb-1">Min Stock (Alert)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={ingredientForm.minStock}
                    onChange={(e) => setIngredientForm((f) => ({ ...f, minStock: parseFloat(e.target.value) || 0 }))}
                    className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-500 text-xs font-medium block mb-1">Cost per Unit (₱)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={ingredientForm.costPerUnit}
                    onChange={(e) => setIngredientForm((f) => ({ ...f, costPerUnit: parseFloat(e.target.value) || 0 }))}
                    placeholder="0.00"
                    className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                  />
                </div>
                <div>
                  <label className="text-gray-500 text-xs font-medium block mb-1">Supplier</label>
                  <select
                    value={ingredientForm.supplierId || ''}
                    onChange={(e) => setIngredientForm((f) => ({ ...f, supplierId: e.target.value ? parseInt(e.target.value) : null }))}
                    className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                  >
                    <option value="">No supplier</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              {!editingIngredientFull && (
                <button
                  onClick={() => { setSupplierQuickForm({ name: '', contactPerson: '', phone: '', email: '', address: '' }); setShowSupplierQuickModal(true); }}
                  className="text-blue-600 hover:text-blue-700 text-xs font-medium"
                >
                  + Add a new supplier
                </button>
              )}
            </div>
            <div className="p-5 bg-gray-50 grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowIngredientModal(false)}
                className="bg-white text-gray-600 py-2.5 rounded-xl font-medium border border-gray-200 hover:bg-gray-100 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={saveIngredientFull}
                disabled={formSaving || !ingredientForm.name.trim()}
                className="bg-black hover:bg-gray-800 text-white py-2.5 rounded-xl font-semibold transition-all disabled:opacity-50"
              >
                {formSaving ? 'Saving...' : editingIngredientFull ? 'Update' : 'Add Ingredient'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Quick-create Supplier Modal ── */}
      {showSupplierQuickModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
            <div className="p-5 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">Add New Supplier</h3>
            </div>
            <div className="p-5 space-y-3 overflow-y-auto flex-1 min-h-0">
              <input
                type="text"
                placeholder="Supplier Name"
                value={supplierQuickForm.name}
                onChange={(e) => setSupplierQuickForm({ ...supplierQuickForm, name: e.target.value })}
                className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                required
              />
              <input
                type="text"
                placeholder="Contact Person"
                value={supplierQuickForm.contactPerson}
                onChange={(e) => setSupplierQuickForm({ ...supplierQuickForm, contactPerson: e.target.value })}
                className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
              />
              <input
                type="text"
                placeholder="Phone"
                value={supplierQuickForm.phone}
                onChange={(e) => setSupplierQuickForm({ ...supplierQuickForm, phone: e.target.value })}
                className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
              />
              <input
                type="text"
                placeholder="Email"
                value={supplierQuickForm.email}
                onChange={(e) => setSupplierQuickForm({ ...supplierQuickForm, email: e.target.value })}
                className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
              />
              <input
                type="text"
                placeholder="Address"
                value={supplierQuickForm.address}
                onChange={(e) => setSupplierQuickForm({ ...supplierQuickForm, address: e.target.value })}
                className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
              />
            </div>
            <div className="p-5 bg-gray-50 grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowSupplierQuickModal(false)}
                className="bg-white text-gray-600 py-2.5 rounded-xl font-medium border border-gray-200 hover:bg-gray-100 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={quickCreateSupplier}
                className="bg-black hover:bg-gray-800 text-white py-2.5 rounded-xl font-semibold transition-all"
              >
                Save Supplier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Purchase Planner (moved from Products ▸ Ingredients) ── */}
      {plannerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto"
          onClick={() => setPlannerOpen(false)}
        >
          <div
            className="bg-white rounded-3xl w-full max-w-2xl my-8 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Calculate Ingredients Needed</h3>
                <p className="text-gray-400 text-xs">Enter product quantities to calculate total ingredients needed</p>
              </div>
              <button
                onClick={() => setPlannerOpen(false)}
                className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700 flex items-center justify-center transition-all"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {plannerProducts.map((p) => (
                  <div key={p.id} className="bg-gray-50 rounded-2xl p-3 border border-gray-100 hover:border-amber-300 transition-all">
                    <div className="text-gray-800 text-sm font-medium truncate">{p.name}</div>
                    <div className="flex items-center gap-2 mt-2">
                      <input
                        type="number"
                        min="0"
                        value={calcProducts[p.id] || ''}
                        onChange={(e) => setCalcProducts((prev) => ({ ...prev, [p.id]: parseInt(e.target.value) || 0 }))}
                        placeholder="0"
                        className="w-full bg-white text-gray-900 text-sm rounded-xl px-3 py-2 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                      <span className="text-gray-400 text-xs whitespace-nowrap font-medium">pcs</span>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={calculateIngredients}
                disabled={calcLoading}
                className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-semibold transition-all disabled:opacity-50"
              >
                {calcLoading ? 'Calculating...' : 'Calculate Ingredients'}
              </button>

              {/* Invoice preview */}
              {calcResult && (
                <div
                  ref={invoiceRef}
                  className="bg-white rounded-lg border border-slate-200 shadow-lg overflow-hidden max-w-sm mx-auto"
                  style={{ fontSize: '11px' }}
                >
                  <div className="bg-white px-4 py-4 border-b-2 border-amber-400">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-amber-500 rounded-lg flex items-center justify-center">
                          <span className="text-white text-lg">🧾</span>
                        </div>
                        <div>
                          <h4 className="text-slate-800 font-bold text-base">Purchase Invoice</h4>
                          <p className="text-slate-400 text-xs">#{Math.random().toString(36).substring(2, 8).toUpperCase()}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-amber-600 font-bold text-2xl">₱{calcResult.grandTotal?.toFixed(2)}</div>
                        <p className="text-slate-400 text-xs">Total Amount</p>
                      </div>
                    </div>
                    <div className="mt-3 flex justify-between text-slate-500 text-xs pt-2 border-t border-slate-100">
                      <span>{shopName}</span>
                      <span>{new Date().toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                  </div>

                  <div className="mb-1.5">
                    <p className="text-slate-400 text-xs mb-0.5">Making:</p>
                    <div className="flex items-center py-1 bg-amber-50 rounded-t text-xs font-semibold text-amber-700">
                      <span className="flex-1">Product</span>
                      <span className="w-16 text-right">Qty</span>
                    </div>
                    {Object.entries(calcProducts).filter(([, qty]) => qty > 0).map(([pid, qty]) => {
                      const prod = plannerProducts.find((p) => p.id === Number(pid));
                      return prod ? (
                        <div key={pid} className="flex items-center py-1 border-b border-amber-50 last:border-0 text-xs">
                          <span className="flex-1 text-slate-700">{prod.name}</span>
                          <span className="w-16 text-right text-amber-700 font-medium">×{qty}</span>
                        </div>
                      ) : null;
                    })}
                  </div>

                  <div className="mb-1.5">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-slate-400 text-xs mb-0">Ingredients:</p>
                      <input
                        type="text"
                        placeholder="Search..."
                        value={calcSearch}
                        onChange={(e) => setCalcSearch(e.target.value)}
                        className="text-xs px-3 py-1.5 border border-slate-200 rounded-lg w-32 focus:outline-none focus:border-amber-400 text-black placeholder-slate-400 bg-white"
                      />
                    </div>
                    <div className="flex items-center py-1.5 bg-slate-800 rounded text-xs font-semibold text-slate-200">
                      <button
                        className="flex-1 text-left hover:text-white"
                        onClick={() => setCalcSortToggle(calcSortToggle === 'name' ? 'name-desc' : 'name')}
                      >
                        Item {calcSortToggle === 'name' ? '↑' : '↓'}
                      </button>
                      <span className="w-14 text-right">Stock</span>
                      <span className="w-14 text-right">Needed</span>
                      <span className="w-14 text-right">Deficit</span>
                      <span className="w-10 text-right">Unit</span>
                      <span className="w-14 text-right">Cost</span>
                    </div>
                    <div>
                      {calcResult.ingredients
                        ?.filter((ing: any) => !calcSearch || ing.name.toLowerCase().includes(calcSearch.toLowerCase()))
                        .sort((a: any, b: any) =>
                          calcSortToggle === 'name' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
                        )
                        .map((ing: any, idx: number) => {
                          const deficit = (ing.currentStock || 0) - ing.quantityNeeded;
                          const isDeficit = deficit < 0;
                          return (
                            <div key={idx} className="flex items-center py-1.5 border-b border-slate-50 text-xs hover:bg-amber-50/50">
                              <span className="flex-1 text-slate-700 truncate" title={ing.name}>{ing.name}</span>
                              <span className="w-14 text-right text-slate-500">{ing.currentStock || 0}</span>
                              <span className="w-14 text-right text-slate-700 font-medium">{ing.quantityNeeded}</span>
                              <span className={`w-14 text-right font-medium ${isDeficit ? 'text-red-500' : 'text-emerald-500'}`}>
                                {isDeficit ? deficit : '+' + deficit}
                              </span>
                              <span className="w-10 text-right text-slate-400">{ing.baseUnit}</span>
                              <span className="w-14 text-right text-slate-700 font-medium">₱{ing.totalCost?.toFixed(2)}</span>
                            </div>
                          );
                        })}
                    </div>
                    <div className="flex items-center py-1 bg-slate-50 border-t border-slate-200 text-xs font-semibold text-slate-700">
                      <span className="flex-1">
                        Total ({calcResult.ingredients?.filter((ing: any) => !calcSearch || ing.name.toLowerCase().includes(calcSearch.toLowerCase())).length} items)
                      </span>
                      <span className="w-16 text-right"></span>
                      <span className="w-16 text-right"></span>
                      <span className="w-16 text-right"></span>
                      <span className="w-12 text-right"></span>
                      <span className="w-16 text-right text-emerald-600">₱{calcResult.grandTotal?.toFixed(2)}</span>
                    </div>
                  </div>
                  {calcResult.ingredients?.length === 0 && (
                    <p className="text-slate-400 text-center py-1 text-xs">No ingredients defined</p>
                  )}

                  <div className="bg-slate-50 px-4 py-3 border-t border-slate-200 text-center">
                    <p className="text-slate-600 text-xs font-medium">Thank you for your business! 🙏</p>
                    <p className="text-slate-400 text-xs mt-0.5">{shopName} • Purchase Request</p>
                  </div>
                </div>
              )}

              {/* Download Buttons */}
              {calcResult && calcResult.ingredients?.length > 0 && (
                <div className="flex gap-2 max-w-sm mx-auto">
                  <button
                    onClick={() => downloadInvoice('png')}
                    className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium text-sm transition-colors"
                  >
                    ⬇ PNG
                  </button>
                  <button
                    onClick={() => downloadInvoice('pdf')}
                    className="flex-1 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-lg font-medium text-sm transition-colors"
                  >
                    ⬇ PDF
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
     </div>
   );
}
