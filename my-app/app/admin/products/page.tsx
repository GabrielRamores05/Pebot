'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSocket } from '@/hooks/useSocket';
import OptionGroupManager from '../OptionGroupManager';
import html2canvas from 'html2canvas';
import { VAT_RATE, basePrice, marginAmount, sellingPrice, vatAmount } from '@/lib/bir-pricing';
import { fetchJson, userMessage } from '@/lib/fetch-json';

interface Category {
  id: number;
  name: string;
  icon?: string;
  // ...add other Category fields as needed...

}

export default function Page() {
  interface Product {
    id: number;
    name: string;
    price: number;
    categoryId: number;
    category: Category;
    available?: boolean;
    imageUrl?: string | null;
    description?: string | null;
    prepTimeMinutes?: number | null;
    stationType?: string | null;
    // BIR pricing fields
    capitalCost?: number;
    marginType?: string;
    marginValue?: number;
    vatExempt?: boolean;
  }

  // Review info per product
  interface ProductReviewInfo {
    productId: number;
    averageRating: number;
    totalReviews: number;
  }

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<string | null>(null);
  const [shopName, setShopName] = useState('Pebot');
  const [tab, setTab] = useState<'products'|'all'|'categories'|'options'>('products');
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState<'ALL' | number>('ALL');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; targets: Product[] }>({ open: false, targets: [] });
  const [deleteInput, setDeleteInput] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [productReviews, setProductReviews] = useState<Record<number, ProductReviewInfo>>({});

  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const EMPTY_PRODUCT = { name: '', description: '', price: '', categoryId: '', imageUrl: '', prepTimeMinutes: '5', stationType: 'general', capitalCost: 0, marginType: 'PERCENTAGE', marginValue: 30, vatExempt: false } as any;
  const [productForm, setProductForm] = useState<any>(EMPTY_PRODUCT);
  const [productSaving, setProductSaving] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);

  const [showCatModal, setShowCatModal] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const EMPTY_CATEGORY = { name: '', icon: '' } as any;
  const [catForm, setCatForm] = useState<any>(EMPTY_CATEGORY);
  const [catSaving, setCatSaving] = useState(false);
  const [catIconUploading, setCatIconUploading] = useState(false);

  // ── Ingredients State (list feeds the product recipe editor; management now lives in Inventory ▸ Ingredients) ──
  const [ingredients, setIngredients] = useState<any[]>([]);

  // ── Option groups (customization) state ────────────────────────────────────
  const [optionGroups, setOptionGroups] = useState<{ id: number; name: string; selectionType: 'single' | 'multi' }[]>([]);
  const [attachedGroupIds, setAttachedGroupIds] = useState<number[]>([]);

  useEffect(() => {
    fetch('/api/option-groups')
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setOptionGroups(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (showProductModal && editingProduct?.id) {
      fetch(`/api/products/${editingProduct.id}/option-groups`)
        .then((r) => (r.ok ? r.json() : []))
        .then((d) => setAttachedGroupIds((Array.isArray(d) ? d : []).map((a: any) => a.group.id)))
        .catch(() => {});
    }
    if (!showProductModal) setAttachedGroupIds([]);
  }, [showProductModal, editingProduct?.id]);

  async function toggleProductOptionGroup(productId: number, groupId: number, attach: boolean) {
    try {
      if (attach) {
        await fetchJson(`/api/products/${productId}/option-groups`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ groupId }),
        });
      } else {
        await fetchJson(`/api/products/${productId}/option-groups?groupId=${groupId}`, { method: 'DELETE' });
      }
      setAttachedGroupIds((prev) =>
        attach ? [...prev, groupId] : prev.filter((id) => id !== groupId)
      );
    } catch (e) {
      console.error('Failed to update customization:', e);
      alert(userMessage(e, 'Failed to update customization'));
    }
  }

  // ── Stations State ───────────────────────────────────────────────────────────
  const [stations, setStations] = useState<any[]>([]);

  // Fetch stations on mount
  useEffect(() => {
    fetch('/api/stations')
      .then(r => r.json())
      .then(data => setStations(data || []))
      .catch(console.error);
  }, []);

  // Helper function to get station icon
  function getStationIcon(stationType: string) {
    // First check if we have a custom station with emoji
    const customStation = stations.find((s: any) => s.stationType?.toLowerCase() === stationType.toLowerCase());
    if (customStation?.emoji) return customStation.emoji;
    
    // Fallback to default icons
    const icons: Record<string, string> = {
      coffee: '☕',
      kitchen: '🍳',
      bar: '🥤',
      pastry: '🧁',
      general: '📦',
    };
    return icons[stationType.toLowerCase()] || '📦';
  }

  // Product Ingredients Assignment
  const [productIngredients, setProductIngredients] = useState<any[]>([]);
  const [ingredientQuantities, setIngredientQuantities] = useState<Record<number, number>>({});
  const [availability, setAvailability] = useState<any>(null);

  // Derived capital cost = Σ (ingredient.costPerUnit × quantity) over the recipe.
  const computedCapital = ingredients.reduce(
    (sum: number, ing: any) => {
      const qty = ingredientQuantities[ing.id];
      return sum + (qty > 0 ? (ing.costPerUnit || 0) * qty : 0);
    },
    0,
  );

  // Price preview for the product form
  const previewMargin = marginAmount(computedCapital || 0, productForm.marginType, productForm.marginValue || 0);
  const previewBasePrice = basePrice(computedCapital || 0, productForm.marginType, productForm.marginValue || 0);

  // Fetch ingredients when editing a product
  const fetchProductIngredients = async (productId: number) => {
    try {
      const res = await fetch(`/api/ingredients/product/${productId}`);
      const data = await res.json();
      setProductIngredients(data);
      const qtyMap: Record<number, number> = {};
      data.forEach((pi: any) => { qtyMap[pi.ingredientId] = pi.quantity; });
      setIngredientQuantities(qtyMap);
      fetchAvailability(productId);
    } catch (e) {
      console.error('Failed to fetch product ingredients:', e);
    }
  };

  const fetchAvailability = async (productId: number) => {
    try {
      const res = await fetch(`/api/ingredients/production-capacity?productId=${productId}`);
      const data = await res.json();
      const arr = Array.isArray(data) ? data : [];
      setAvailability(arr[0] || null);
    } catch (e) {
      console.error('Failed to fetch availability:', e);
    }
  };

  const saveProductIngredients = async (productId: number) => {
    const items = Object.entries(ingredientQuantities)
      .filter(([_, qty]) => qty > 0)
      .map(([ingId, qty]) => ({
        ingredientId: parseInt(ingId),
        quantity: qty,
        required: true,
      }));
    
    try {
      await fetchJson(`/api/ingredients/product/${productId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ingredients: items }),
      });
      notif('Ingredients saved!');
      await fetchAvailability(productId);
    } catch (e) {
      console.error('Failed to save product ingredients:', e);
      notif(`${userMessage(e, 'Failed to save product ingredients')}`);
    }
  };

  // ── Ingredients Functions ───────────────────────────────────────────────────
  const fetchIngredients = async () => {
    try {
      const res = await fetch('/api/ingredients');
      const data = await res.json();
      setIngredients(data);
    } catch (e) {
      console.error('Failed to fetch ingredients:', e);
    }
  };


  function notif(msg: string) {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  }
  
  // Fetch reviews for all products
  const fetchReviews = async (productIds: number[]) => {
    const reviewData: Record<number, ProductReviewInfo> = {};
    await Promise.all(
      productIds.map(async (id) => {
        try {
          const res = await fetch(`/api/reviews?productId=${id}`);
          const data = await res.json();
          if (res.ok) {
            reviewData[id] = {
              productId: id,
              averageRating: data.averageRating || 0,
              totalReviews: data.totalReviews || 0,
            };
          }
        } catch (e) {
          console.error(`Error fetching reviews for product ${id}:`, e);
        }
      })
    );
    setProductReviews(reviewData);
  };

  const fetchAll = useCallback(async () => {
    try {
      const [p, c, b] = await Promise.all([
        fetchJson<Product[]>('/api/products'),
        fetchJson<Category[]>('/api/categories'),
        fetchJson<{ shopName?: string }>('/api/settings/branding'),
      ]);
      setProducts(p);
      setCategories(c);
      if (b?.shopName) setShopName(b.shopName);
      // Fetch reviews for all products
      if (p && p.length > 0) {
        fetchReviews(p.map((prod: Product) => prod.id));
      }
    } catch (e) {
      console.error('Failed to load products/categories:', e);
      notif(`${userMessage(e, 'Could not load products and categories. Try again.')}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Keep product list in sync with real-time changes
  useSocket({
    events: {
      'product-update': () => { fetchAll(); },
      'ingredients-update': () => { fetchIngredients(); if (editingProduct) fetchAvailability(editingProduct.id); },
      'inventory-update': () => { fetchAll(); if (editingProduct) fetchAvailability(editingProduct.id); },
    },
  });

  // ── Product CRUD ────────────────────────────────────────────────────────────
  function openAddProduct() {
    setEditingProduct(null);
    setProductForm(EMPTY_PRODUCT);
    setShowProductModal(true);
  }

  function openEditProduct(p: Product) {
    setEditingProduct(p);
    setProductForm({
      name: p.name,
      description: p.description ?? '',
      price: String(p.price),
      categoryId: String(p.categoryId),
      imageUrl: p.imageUrl ?? '',
      prepTimeMinutes: String(p.prepTimeMinutes ?? 5),
      stationType: p.stationType ?? 'general',
      capitalCost: p.capitalCost ?? 0,
      marginType: p.marginType ?? 'PERCENTAGE',
      marginValue: p.marginValue ?? 30,
      vatExempt: p.vatExempt ?? false,
    });
    // Fetch product ingredients and all ingredients
    setIngredientQuantities({});
    setProductIngredients([]);
    fetchProductIngredients(p.id);
    fetchIngredients(); // Ensure ingredients list is loaded
    setShowProductModal(true);
  }

  async function handleImageUpload(file: File) {
    setImageUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    const data = await res.json();
  if (data.url) setProductForm((f: any) => ({ ...f, imageUrl: data.url }));
    setImageUploading(false);
  }

  async function saveProduct() {
    if (!productForm.name.trim() || !productForm.categoryId) return;
    
    // Calculate final price from BIR pricing (capital is derived from the recipe)
    const capitalCost = computedCapital;
    const marginType = productForm.marginType || 'PERCENTAGE';
    const marginValue = parseFloat(productForm.marginValue) || 30;
    const vatExempt = productForm.vatExempt || false;
    const finalPrice = sellingPrice(capitalCost, marginType, marginValue, vatExempt);
    
    setProductSaving(true);
    const body = {
      name: productForm.name.trim(),
      description: productForm.description.trim() || null,
      price: Math.round(finalPrice * 100) / 100, // Auto-calculated from BIR pricing
      categoryId: parseInt(productForm.categoryId),
      imageUrl: productForm.imageUrl.trim() || null,
      prepTimeMinutes: parseInt(productForm.prepTimeMinutes) || 5,
      stationType: productForm.stationType || 'general',
      capitalCost,
      marginType,
      marginValue,
      vatExempt,
    };
    try {
      if (editingProduct) {
        await fetchJson('/api/products', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingProduct.id, ...body }),
        });
        notif('Product updated!');
      } else {
        await fetchJson('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        notif('Product added!');
      }
      setShowProductModal(false);
      await fetchAll();
    } catch (e) {
      console.error('Failed to save product:', e);
      notif(`${userMessage(e, 'Failed to save product')}`);
    } finally {
      setProductSaving(false);
    }
  }

  async function toggleAvailable(p: Product) {
    try {
      await fetchJson('/api/products', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: p.id, available: !p.available }),
      });
      notif(p.available ? 'Product hidden from menu' : 'Product visible on menu');
      await fetchAll();
    } catch (e) {
      console.error('Failed to update product availability:', e);
      notif(`${userMessage(e, 'Failed to update product availability')}`);
    }
  }

  function openDeleteModal(targets: Product[]) {
    setDeleteInput('');
    setDeleteModal({ open: true, targets });
  }

  async function confirmDelete() {
    const { targets } = deleteModal;
    const expected = targets.length === 1 ? targets[0].name : 'DELETE';
    if (deleteInput.trim() !== expected) return;
    setDeleteLoading(true);
    try {
      await Promise.all(
        targets.map(async (p) => {
          await fetchJson('/api/products', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: p.id }),
          });
          return p;
        })
      );
      setDeleteModal({ open: false, targets: [] });
      setSelectedIds(new Set());
      notif(`${targets.length === 1 ? `"${targets[0].name}" removed` : `${targets.length} products removed`}`);
      await fetchAll();
    } catch (err) {
      console.error('Delete error:', err);
      notif(`${userMessage(err, 'Error deleting products')}`);
    } finally {
      setDeleteLoading(false);
    }
  }

  function toggleSelect(id: number) {
    setSelectedIds((prev: Set<number>) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === filteredProducts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredProducts.map((p) => p.id)));
    }
  }

  // ── Category CRUD ───────────────────────────────────────────────────────────
  function openAddCat() {
    setEditingCat(null);
    setCatForm(EMPTY_CATEGORY);
    setShowCatModal(true);
  }

  function openEditCat(c: Category) {
    setEditingCat(c);
    setCatForm({ name: c.name, icon: (c as any).icon ?? '' });
    setShowCatModal(true);
  }

  async function handleCatIconUpload(file: File) {
    setCatIconUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    const data = await res.json();
    if (data.url) setCatForm((f: any) => ({ ...f, icon: data.url }));
    setCatIconUploading(false);
  }

  async function saveCat() {
    const name = catForm.name.trim();
    if (!name) return;

    setCatSaving(true);
    try {
      if (editingCat) {
        const res = await fetch('/api/categories', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingCat.id, name, icon: catForm.icon }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          console.error('Failed to update category:', data);
          notif(`${data?.error || 'Failed to update category'}`);
          return;
        }
        notif('Category updated!');
      } else {
        const res = await fetch('/api/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, icon: catForm.icon, sortOrder: categories.length }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          console.error('Failed to create category:', data);
          notif(`${data?.error || 'Failed to create category'}`);
          return;
        }
        notif('Category added!');
      }

      setShowCatModal(false);
      fetchAll();
    } catch (err) {
      console.error('Network error while saving category:', err);
      notif('Network error while saving category');
    } finally {
      setCatSaving(false);
    }
  }

  async function deleteCat(c: Category) {
    if (!confirm(`Delete category "${c.name}"? This fails if it has products.`)) return;
    try {
      const res = await fetch('/api/categories', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: c.id }),
      });
      const data = await res.json();
      if (res.ok) {
        notif('Category deleted');
        await fetchAll();
      } else {
        notif(`${data.error || 'Failed to delete category'}`);
      }
    } catch (err) {
      console.error('Delete category error:', err);
      notif(`${err instanceof Error ? err.message : 'Error deleting category'}`);
    }
  }

  const filteredProducts = products.filter((p) => {
    if (filterCat !== 'ALL' && p.categoryId !== filterCat) return false;
    if (search) return p.name.toLowerCase().includes(search.toLowerCase());
    return true;
  });

  const renderProductCard = (p: Product, includeReviews = false) => (
    <div key={p.id} className="group c-card p-4 transition-colors hover:border-hair-strong">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-slate-800 font-bold">{p.name}</p>
          <p className="text-sm font-bold tabular-nums">₱{Number(p.price).toFixed(2)}</p>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => openEditProduct(p)}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-hair text-muted transition-colors hover:border-ink hover:text-ink"
            title="Edit dish"
            aria-label={`Edit ${p.name}`}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 20h4L19 9l-4-4L4 16v4z" /><path d="m14 6 4 4" /></svg>
          </button>
          <button
            onClick={() => openDeleteModal([p])}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-hair text-muted transition-colors hover:border-danger hover:bg-danger-bg hover:text-danger"
            title="Delete dish"
            aria-label={`Delete ${p.name}`}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>
          </button>
        </div>
      </div>

      {p.imageUrl ? (
        <div className="mb-2 h-28 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
          <img src={p.imageUrl} alt={p.name} className="h-full w-full object-contain p-2 transition-transform duration-200 group-hover:scale-[1.02]" />
        </div>
      ) : (
        <div className="mb-2 flex h-28 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-xs text-slate-400">
          No image
        </div>
      )}

      {p.description && <p className="mb-2 line-clamp-2 text-xs text-slate-500">{p.description}</p>}
      <div className="flex items-center gap-2 text-xs">
        <span className="text-gray-500">{p.category?.name}</span>
        {p.available !== false && <span className="rounded-full bg-good-bg px-2 py-0.5 font-semibold text-good">On the menu</span>}
      </div>

      {includeReviews && productReviews[p.id] && productReviews[p.id].totalReviews > 0 && (
        <div className="mt-2">
          <div className="mb-1 flex items-center gap-1 text-xs">
            <span className="text-amber-400">
              {'★'.repeat(Math.round(productReviews[p.id].averageRating))}
              {'☆'.repeat(5 - Math.round(productReviews[p.id].averageRating))}
            </span>
            <span className="text-slate-500">
              {productReviews[p.id].averageRating.toFixed(1)} ({productReviews[p.id].totalReviews})
            </span>
          </div>
          <button
            onClick={() => {
              fetch(`/api/reviews?productId=${p.id}`)
                .then((r) => r.json())
                .then((data) => {
                  if (data.reviews && data.reviews.length > 0) {
                    const reviewList = data.reviews
                      .map((r: any) => `${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)} ${r.customerName}: ${r.comment || '(no comment)'}${r.imageUrl ? '\n[Photo attached]' : ''}`)
                      .join('\n\n');
                    alert(`Reviews for ${p.name}:\n\n${reviewList}`);
                  }
                });
            }}
            className="text-xs text-amber-400 underline hover:text-amber-300"
          >
            View all reviews
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="h-full space-y-5 overflow-y-auto bg-page px-6 pb-8 pt-6">
      {notification && (
        <div className="fixed right-4 top-4 z-50 rounded-2xl border border-hair bg-card px-4 py-3 text-sm font-semibold shadow-pop" role="status">
          {notification}
        </div>
      )}

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="c-title">Menu</h1>
          <p className="mt-1.5 text-sm text-muted">
            {products.length} dish{products.length === 1 ? '' : 'es'} in {categories.length} categor{categories.length === 1 ? 'y' : 'ies'} · {products.filter((p) => p.available).length} on the menu now
          </p>
        </div>
        <nav className="flex gap-1 border-b border-hair" aria-label="Menu sections">
          {([['products', 'Dishes'], ['all', 'All dishes'], ['categories', 'Categories'], ['options', 'Options']] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              aria-current={tab === key ? 'page' : undefined}
              className={`-mb-px whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-semibold transition ${tab === key ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink'}`}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      {loading ? (
        <div className="flex items-center justify-center h-60 text-gray-500">Loading...</div>
      ) : (
        <>
          {tab === 'products' && (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search dishes"
                  className="h-10 min-w-0 flex-1 rounded-xl border border-hair bg-card px-4 text-sm outline-none focus:border-accent"
                />
                <select
                  value={filterCat}
                  onChange={(e) => setFilterCat(e.target.value === 'ALL' ? 'ALL' : parseInt(e.target.value))}
                  className="h-10 rounded-xl border border-hair bg-card px-3 text-sm outline-none focus:border-accent"
                >
                  <option value="ALL">All Categories</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{(c as any).icon} {c.name}</option>)}
                </select>
                <button
                  onClick={openAddProduct}
                  className="c-btn c-btn--primary"
                >
                  Add Product
                </button>
                <button
                  onClick={openAddCat}
                  className="c-btn c-btn--ghost"
                >
                  Manage Categories
                </button>
              </div>

              <div className="mt-4">
                {filteredProducts.length === 0 ? (
                  <div className="flex h-40 flex-col items-center justify-center text-gray-600">
                    <p className="mb-2 text-3xl">🍽️</p>
                    <p className="text-sm">No products found</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredProducts.map((p) => renderProductCard(p, false))}
                  </div>
                )}
              </div>
            </>
          )}

          {tab === 'all' && (
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {products.length === 0 ? (
                <div className="col-span-full flex h-40 flex-col items-center justify-center text-gray-600">
                  <p className="mb-2 text-3xl">🍽️</p>
                  <p className="text-sm">No products found</p>
                </div>
              ) : (
                products.map((p) => renderProductCard(p, true))
              )}
            </div>
          )}

          {tab === 'categories' && (
            <div className="space-y-3">
              {categories.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-gray-600">
                  <p className="text-3xl mb-2">🏷️</p>
                  <p className="text-sm">No categories found</p>
                </div>
              ) : (
                <>
                  <button
                    onClick={openAddCat}
                    className="w-full bg-accent hover:bg-amber-500 text-white font-bold px-4 py-2 rounded-xl text-sm transition-colors"
                  >
                    Add Category
                  </button>
                  {categories.map((c) => (
                    <div key={c.id} className="bg-white rounded-2xl p-4 border border-slate-200 hover:border-amber-500 transition-colors group flex items-center gap-4">
                      {(c as any).icon && (
                        <div className="text-3xl">{(c as any).icon}</div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-800 font-bold">{c.name}</p>
                        <p className="text-slate-500 text-xs mt-1">ID: {c.id}</p>
                      </div>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                        <button
                          onClick={() => openEditCat(c)}
                          className="bg-accent hover:bg-amber-500 text-white px-3 py-2 rounded-lg text-sm transition-colors font-medium"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteCat(c)}
                          className="bg-red-600 hover:bg-red-500 text-white px-3 py-2 rounded-lg text-sm transition-colors font-medium"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

        </>

      )}

      {tab === 'options' && <OptionGroupManager />}

      {/* ── Product Modal ── */}
      {showProductModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md border border-slate-200 flex flex-col shadow-xl" style={{ maxHeight: '90vh' }}>
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-slate-800 font-bold text-lg">{editingProduct ? 'Edit Product' : 'Add Product'}</h3>
              <button onClick={() => setShowProductModal(false)} className="text-slate-500 hover:text-slate-800 text-xl">✕</button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto">
              <div>
                <label className="text-slate-600 text-sm block mb-1">Product Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={productForm.name}
                  onChange={(e) => setProductForm((f: any) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Caramel Latte"
                  className="w-full bg-slate-100 text-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="text-slate-600 text-sm block mb-1">Category <span className="text-red-500">*</span></label>
                <select
                  value={productForm.categoryId}
                  onChange={(e) => setProductForm((f: any) => ({ ...f, categoryId: e.target.value }))}
                  className="w-full bg-slate-100 text-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="">Select category...</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{(c as any).icon} {c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-slate-600 text-sm block mb-1">
                  Selling Price (₱) <span className="text-red-500">*</span>
                  <span className="text-xs text-accent-text ml-1">(auto-calculated)</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.50"
                  value={productForm.price}
                  onChange={(e) => setProductForm((f: any) => ({ ...f, price: e.target.value }))}
                  placeholder="Auto-calculated from BIR pricing"
                  className="w-full bg-slate-200 text-slate-600 rounded-xl px-4 py-2.5 text-sm cursor-not-allowed"
                  disabled
                />
              </div>
              {/* BIR Pricing Section */}
              <div className="border-t border-slate-200 pt-4 mt-4">
                <p className="text-accent-text text-xs font-semibold uppercase tracking-wider mb-3">BIR Pricing</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-600 text-sm block mb-1">Capital Cost (₱) — auto from recipe</label>
                    <div className="w-full bg-slate-100 text-slate-800 rounded-xl px-4 py-2.5 text-sm flex items-center justify-between">
                      <span>₱{computedCapital.toFixed(2)}</span>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wide">Calculated</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-slate-600 text-sm block mb-1">Margin Type</label>
                    <select
                      value={productForm.marginType || 'PERCENTAGE'}
                      onChange={(e) => setProductForm((f: any) => ({ ...f, marginType: e.target.value }))}
                      className="w-full bg-slate-100 text-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="PERCENTAGE">Percentage (%)</option>
                      <option value="PESOS">Pesos (₱)</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <label className="text-slate-600 text-sm block mb-1">Margin Value</label>
                    <input
                      type="number"
                      min="0"
                      step={productForm.marginType === 'PERCENTAGE' ? '1' : '0.50'}
                      value={productForm.marginValue || ''}
                      onChange={(e) => setProductForm((f: any) => ({ ...f, marginValue: parseFloat(e.target.value) || 0 }))}
                      placeholder={productForm.marginType === 'PERCENTAGE' ? '30' : '50'}
                      className="w-full bg-slate-100 text-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="text-slate-600 text-sm block mb-1">VAT</label>
                    <select
                      value={productForm.vatExempt ? 'exempt' : 'vatable'}
                      onChange={(e) => setProductForm((f: any) => ({ ...f, vatExempt: e.target.value === 'exempt' }))}
                      className="w-full bg-slate-100 text-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="vatable">VAT-able (12%)</option>
                      <option value="exempt">VAT Exempt</option>
                    </select>
                  </div>
                </div>
              </div>
              {/* Price Preview - Shows computed values */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mt-4">
                <p className="text-emerald-700 text-xs font-semibold uppercase tracking-wider mb-3">Price Preview</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Capital Cost:</span>
                    <span className="font-medium">₱{(computedCapital || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Margin ({productForm.marginType === 'PERCENTAGE' ? `${productForm.marginValue || 0}%` : '₱'}):</span>
                    <span className="font-medium">₱{previewMargin.toFixed(2)}</span>
                  </div>
                  <div className="border-t border-emerald-200 pt-2 flex justify-between">
                    <span className="text-slate-600">Selling Price (before VAT):</span>
                    <span className="font-semibold">₱{previewBasePrice.toFixed(2)}</span>
                  </div>
                  {productForm.vatExempt ? (
                    <div className="border-t border-emerald-300 pt-2 flex justify-between bg-emerald-100 -mx-4 px-4 -mb-4 pb-2 rounded-b-xl">
                      <span className="text-emerald-800 font-semibold">Final Price (VAT Exempt):</span>
                      <span className="text-emerald-800 font-bold text-lg">₱{previewBasePrice.toFixed(2)}</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between">
                        <span className="text-slate-600">VAT ({VAT_RATE}%):</span>
                        <span className="font-medium">₱{vatAmount(previewBasePrice, false).toFixed(2)}</span>
                      </div>
                      <div className="border-t border-emerald-300 pt-2 flex justify-between bg-emerald-100 -mx-4 px-4 -mb-4 pb-2 rounded-b-xl">
                        <span className="text-emerald-800 font-semibold">Final Price (incl. VAT):</span>
                        <span className="text-emerald-800 font-bold text-lg">₱{(previewBasePrice + vatAmount(previewBasePrice, false)).toFixed(2)}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-600 text-sm block mb-1">Prep Time (min)</label>
                  <input
                    type="number"
                    min="1"
                    value={productForm.prepTimeMinutes}
                    onChange={(e) => setProductForm((f: any) => ({ ...f, prepTimeMinutes: e.target.value }))}
                    placeholder="5"
                    className="w-full bg-slate-100 text-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="text-slate-600 text-sm block mb-1">Station</label>
                  <select
                    value={productForm.stationType}
                    onChange={(e) => setProductForm((f: any) => ({ ...f, stationType: e.target.value }))}
                    className="w-full bg-slate-100 text-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="general">General</option>
                    {stations.length > 0 ? (
                      stations.map((station: any) => (
                        <option key={station.stationType} value={station.stationType}>
                          {getStationIcon(station.stationType)} {station.stationType.charAt(0).toUpperCase() + station.stationType.slice(1)}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="coffee">Drinks</option>
                        <option value="kitchen">Kitchen</option>
                        <option value="bar">Bar</option>
                        <option value="pastry">Pastry</option>
                      </>
                    )}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-slate-600 text-sm block mb-1">Description</label>
                <textarea
                  value={productForm.description}
                  onChange={(e) => setProductForm((f: any) => ({ ...f, description: e.target.value }))}
                  placeholder="Optional short description..."
                  rows={2}
                  className="w-full bg-slate-100 text-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                />
              </div>
              <div>
                <label className="text-slate-600 text-sm block mb-1">Product Image</label>
                {productForm.imageUrl && (
                  <div className="relative mb-2 h-32 w-full overflow-hidden rounded-xl bg-slate-100">
                    <img src={productForm.imageUrl} alt="preview" className="h-full w-full object-contain p-2" />
                    <button
                      onClick={() => setProductForm((f: any) => ({ ...f, imageUrl: '' }))}
                      className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 text-xs text-white hover:bg-slate-700"
                    >✕</button>
                  </div>
                )}
                <div className="flex gap-2">
                  <label className="cursor-pointer">
                    <div className={`bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl px-3 py-2.5 text-sm text-center border border-dashed border-slate-400 hover:border-amber-500 transition-colors whitespace-nowrap ${imageUploading ? 'opacity-50' : ''}`}>
                      {imageUploading ? 'Uploading...' : 'Upload'}
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={imageUploading}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); }}
                    />
                  </label>
                  <input
                    type="text"
                    value={productForm.imageUrl}
                      onChange={(e) => setProductForm((f: any) => ({ ...f, imageUrl: e.target.value }))}
                    placeholder="or paste image URL..."
                    className="flex-1 bg-slate-100 text-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Customization Section in Product Modal */}
              {editingProduct && optionGroups.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <h4 className="text-slate-800 font-semibold mb-1">Customization</h4>
                  <p className="text-xs text-slate-400 mb-2">Tick the choice groups offered for this product (managed under Options).</p>
                  <div className="space-y-1.5">
                    {optionGroups.map((g) => (
                      <label key={g.id} className="flex items-center gap-2 text-sm text-slate-600">
                        <input
                          type="checkbox"
                          checked={attachedGroupIds.includes(g.id)}
                          onChange={(e) => toggleProductOptionGroup(editingProduct.id, g.id, e.target.checked)}
                        />
                        {g.name}
                        <span className="text-[10px] text-slate-400">
                          ({g.selectionType === 'single' ? 'pick one' : 'add many'})
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Ingredients Section in Product Modal */}
              {editingProduct && (
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <h4 className="text-slate-800 font-semibold mb-3">Recipe (per 1 product)</h4>
                  {ingredients.length === 0 ? (
                    <p className="text-slate-500 text-sm">No ingredients defined yet. Add ingredients in Inventory ▸ Ingredients.</p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {ingredients.map(ing => {
                        const used = ingredientQuantities[ing.id] > 0;
                        return (
                          <div key={ing.id} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={used}
                              onChange={(e) => {
                                setIngredientQuantities(prev => ({
                                  ...prev,
                                  [ing.id]: e.target.checked ? (prev[ing.id] || 1) : 0
                                }));
                              }}
                              className="w-4 h-4 rounded"
                            />
                            <span className="text-slate-700 text-sm flex-1">{ing.name}</span>
                            <input
                              type="number"
                              min="0"
                              step="0.001"
                              value={ingredientQuantities[ing.id] || ''}
                              onChange={(e) => setIngredientQuantities(prev => ({
                                ...prev,
                                [ing.id]: parseFloat(e.target.value) || 0
                              }))}
                              placeholder="0"
                              className="w-20 bg-slate-100 text-slate-800 text-sm rounded px-2 py-1 border border-slate-300"
                              disabled={!used}
                            />
                            <span className="text-slate-500 text-xs w-10">{ing.baseUnit}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {editingProduct && ingredients.length > 0 && (
                    <button
                      onClick={() => saveProductIngredients(editingProduct.id)}
                      className="mt-3 w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium text-sm transition-colors"
                    >
                      Save Ingredients
                    </button>
                  )}

                  {/* Inventory Availability (read-only, derived from recipes) */}
                  {editingProduct && (
                    <div className="mt-4 pt-3 border-t border-slate-200">
                      <h5 className="text-slate-700 font-semibold mb-2">Inventory Availability</h5>
                      {availability ? (
                        <div className="space-y-1.5 text-sm">
                          <div className="flex justify-between">
                            <span className="text-slate-500">Current Sellable Quantity</span>
                            <span className="text-slate-800 font-bold">
                              {availability.sellable >= Number.MAX_SAFE_INTEGER ? 'Unlimited' : `${availability.sellable} ${availability.productName}`}
                            </span>
                          </div>
                          {availability.limitingIngredient && (
                            <div className="flex justify-between">
                              <span className="text-slate-500">Limiting Ingredient</span>
                              <span className="text-slate-800">{availability.limitingIngredient}</span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="text-slate-500">Status</span>
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                              availability.status === 'OUT_OF_STOCK' ? 'bg-red-100 text-red-700'
                              : availability.status === 'LOW_STOCK' ? 'bg-orange-100 text-orange-700'
                              : 'bg-emerald-100 text-emerald-700'
                            }`}>
                              {availability.status.replace('_', ' ')}
                            </span>
                          </div>
                          <div className="mt-2 space-y-1">
                            {availability.ingredients.map((ing: any) => (
                              <div key={ing.ingredientId} className="flex justify-between text-xs">
                                <span className={ing.required ? 'text-slate-700' : 'text-slate-400'}>
                                  {ing.name} {ing.required ? '' : '(optional)'}
                                </span>
                                <span className="text-slate-500">
                                  {ing.available} {ing.baseUnit} → {ing.servings >= Number.MAX_SAFE_INTEGER ? '∞' : ing.servings} {ing.servings === Infinity ? '' : 'servings'}
                                </span>
                              </div>
                            ))}
                          </div>
                          <p className="text-[10px] text-slate-400 mt-1">* Sellable quantity is calculated from ingredient stock. Adjust levels in the Ingredients tab.</p>
                        </div>
                      ) : (
                        <p className="text-slate-400 text-sm">No recipe defined — product is always available.</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="p-5 border-t border-slate-200 grid grid-cols-2 gap-3">
              <button onClick={() => setShowProductModal(false)} className="bg-slate-100 text-slate-700 py-3 rounded-xl font-medium hover:bg-slate-200 transition-colors">Cancel</button>
              <button
                onClick={saveProduct}
                disabled={productSaving || !productForm.name.trim() || !productForm.categoryId}
                className="bg-accent text-white py-3 rounded-xl font-bold hover:bg-amber-500 transition-colors disabled:opacity-50"
              >
                {productSaving ? 'Saving...' : editingProduct ? 'Update' : 'Add Product'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ── */}
      {deleteModal.open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md border border-red-200 shadow-xl">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-slate-800 font-bold text-lg">Confirm Delete</h3>
              <button
                onClick={() => setDeleteModal({ open: false, targets: [] })}
                className="text-slate-500 hover:text-slate-800 text-xl"
              >
                ✕
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-slate-800">You are about to delete <span className="font-bold">{deleteModal.targets.length}</span> product{deleteModal.targets.length !== 1 ? 's' : ''}.</p>
              <div className="bg-slate-100 rounded-xl p-3 max-h-32 overflow-y-auto">
                {deleteModal.targets.map((p) => (
                  <p key={p.id} className="text-slate-600 text-xs py-0.5">• {p.name}</p>
                ))}
              </div>
              <p className="text-slate-600 text-sm">Type <span className="font-mono text-accent-text font-bold">DELETE</span> to confirm:</p>
              <input
                autoFocus
                type="text"
                value={deleteInput}
                onChange={(e) => setDeleteInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && deleteInput.trim() === (deleteModal.targets.length === 1 ? deleteModal.targets[0].name : 'DELETE') && confirmDelete()}
                placeholder={deleteModal.targets.length === 1 ? deleteModal.targets[0].name : 'DELETE'}
                className="w-full bg-slate-100 text-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 font-mono"
              />
            </div>
            <div className="p-5 border-t border-slate-200 grid grid-cols-2 gap-3">
              <button
                onClick={() => setDeleteModal({ open: false, targets: [] })}
                className="bg-slate-100 text-slate-700 py-3 rounded-xl font-medium hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleteInput.trim() !== (deleteModal.targets.length === 1 ? deleteModal.targets[0].name : 'DELETE') || deleteLoading}
                className="bg-red-700 text-white py-3 rounded-xl font-bold hover:bg-red-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {deleteLoading ? 'Deleting...' : `Delete${deleteModal.targets.length > 1 ? ` ${deleteModal.targets.length} Products` : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Category Modal ── */}
      {showCatModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm border border-slate-200 shadow-xl">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-slate-800 font-bold text-lg">{editingCat ? 'Edit Category' : 'Add Category'}</h3>
              <button onClick={() => setShowCatModal(false)} className="text-slate-400 hover:text-slate-700 text-xl">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-slate-600 text-sm block mb-1">Category Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={catForm.name}
                  onChange={(e) => setCatForm((f: any) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Hot Drinks"
                  className="w-full bg-slate-100 text-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="text-slate-600 text-sm block mb-1">Icon</label>
                {catForm.icon && (catForm.icon.startsWith('/') || catForm.icon.startsWith('http')) ? (
                  <div className="relative mb-2 h-16 w-16 overflow-hidden rounded-xl bg-slate-100">
                    <img src={catForm.icon} alt="icon" className="h-full w-full object-contain p-1" />
                    <button
                      onClick={() => setCatForm((f: any) => ({ ...f, icon: '' }))}
                      className="absolute top-0.5 right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-xs text-white hover:bg-slate-700"
                    >✕</button>
                  </div>
                ) : null}
                <label className="cursor-pointer block mb-2">
                  <div className={`bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl px-3 py-2 text-sm text-center border border-dashed border-slate-400 hover:border-amber-500 transition-colors ${catIconUploading ? 'opacity-50' : ''}`}>
                    {catIconUploading ? 'Uploading...' : 'Upload Image'}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={catIconUploading}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCatIconUpload(f); }}
                  />
                </label>
                <p className="text-slate-500 text-xs mb-2 text-center">— or pick an emoji —</p>
                <div className="grid grid-cols-9 gap-1 bg-slate-100 rounded-xl p-2 mb-2">
                  {['☕','🧋','🍵','🫖','🧃','🥤','🍺','🍹','🥛',
                    '🍰','🎂','🧁','🍩','🍪','🍫','🍬','🍭','🍦',
                    '🥪','🥗','🍜','🍝','🍲','🥘','🍛','🍗','🥓',
                    '🌮','🌯','🥙','🥞','🧇','🥚','🍳','🧀','🥩',
                    '🍎','🍊','🍋','🍇','🍓','🫐','🥑','🍅','🌽',
                  ].map((em) => (
                    <button
                      key={em}
                      type="button"
                      onClick={() => setCatForm((f: any) => ({ ...f, icon: em }))}
                      className={`text-xl p-1 rounded-lg transition-colors hover:bg-slate-200 ${catForm.icon === em ? 'bg-amber-100 ring-1 ring-amber-500' : ''}`}
                    >{em}</button>
                  ))}
                </div>
                <input
                  type="text"
                  value={catForm.icon}
                  onChange={(e) => setCatForm((f: any) => ({ ...f, icon: e.target.value }))}
                  placeholder="or type any emoji..."
                  className="w-full bg-slate-100 text-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>
            <div className="p-5 border-t border-slate-200 grid grid-cols-2 gap-3">
              <button onClick={() => setShowCatModal(false)} className="bg-slate-100 text-slate-700 py-3 rounded-xl font-medium hover:bg-slate-200 transition-colors">Cancel</button>
              <button
                onClick={saveCat}
                disabled={catSaving || !catForm.name.trim()}
                className="bg-accent text-white py-3 rounded-xl font-bold hover:bg-amber-500 transition-colors disabled:opacity-50"
              >
                {catSaving ? 'Saving...' : editingCat ? 'Update' : 'Add Category'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
