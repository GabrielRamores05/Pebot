'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSocket } from '@/hooks/useSocket';
import html2canvas from 'html2canvas';

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
  const [shopName, setShopName] = useState('CafeOS');
  const [tab, setTab] = useState<'products'|'all'|'categories'|'ingredients'>('products');
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

  // ── Ingredients State ──────────────────────────────────────────────────────
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [supplierForm, setSupplierForm] = useState({ name: '', contactPerson: '', phone: '', email: '', address: '' });
  const [ingredientsLoading, setIngredientsLoading] = useState(false);
  const [showIngredientModal, setShowIngredientModal] = useState(false);

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

  // Get unique base units for dropdown (includes common defaults + existing ones)
  const defaultUnits = ['pcs', 'kg', 'g', 'ml', 'L', 'oz', 'lb', 'cup', 'scoop', 'slice', 'piece', 'pack', 'box', 'can', 'bottle'];
  const existingUnits = Array.from(new Set(ingredients.map((ing: any) => ing.baseUnit || '').filter((u: string) => u.trim() !== '')));
  const uniqueUnits = Array.from(new Set([...defaultUnits, ...existingUnits])).sort();
  const [editingIngredient, setEditingIngredient] = useState<any>(null);
  const [ingredientForm, setIngredientForm] = useState({
    name: '', category: '', baseUnit: 'g', purchaseUnit: 'g', currentStock: 0, minStock: 0, costPerUnit: 0, supplierId: null as number | null
  });
  const [ingredientSaving, setIngredientSaving] = useState(false);

  // Purchase Calculator State
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [calcProducts, setCalcProducts] = useState<Record<number, number>>({});
  const [calcResult, setCalcResult] = useState<any>(null);
  const [calcLoading, setCalcLoading] = useState(false);
  const [ingredientSearch, setIngredientSearch] = useState('');
  const [ingredientSort, setIngredientSort] = useState<'name' | 'name-desc' | 'needed' | 'needed-desc' | 'deficit' | 'deficit-desc'>('name');
  const [ingredientSearch2, setIngredientSearch2] = useState('');
  const [isLiveEditMode, setIsLiveEditMode] = useState(false);
  const [editingIngredientId, setEditingIngredientId] = useState<number | null>(null);
  const [editingIngredientData, setEditingIngredientData] = useState<any>(null);
  const ingredientInputRef = useRef<HTMLInputElement>(null);
  const ingredientUnitInputRef = useRef<HTMLSelectElement>(null);
  const ingredientStockInputRef = useRef<HTMLInputElement>(null);
  const ingredientMinStockInputRef = useRef<HTMLInputElement>(null);
  const ingredientCostInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus first input when entering edit mode
  useEffect(() => {
    if (editingIngredientId && ingredientInputRef.current) {
      setTimeout(() => {
        ingredientInputRef.current?.focus();
        ingredientInputRef.current?.select();
      }, 10);
    }
  }, [editingIngredientId]);
  const invoiceRef = useRef<HTMLDivElement>(null);

  // Download invoice - reliable canvas-based approach
  const downloadInvoice = async (format: 'png' | 'pdf') => {
    if (!calcResult || !calcResult.ingredients?.length) return;
    
    try {
      // Create a simple canvas-based invoice (receipt style - narrower)
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        alert('Failed to create canvas');
        return;
      }
      
      // Pre-calculate wrapped product lines for height calculation
      const productLines: string[] = [];
      Object.entries(calcProducts).filter(([_, qty]) => qty > 0).forEach(([pid, qty]) => {
        const prod = products.find(p => p.id === Number(pid));
        if (prod) {
          productLines.push(`${prod.name} (${qty}x)`);
        }
      });
      
      // Calculate wrapped lines count (estimate without canvas context)
      // Each product line is roughly 20 chars, so estimate ~15 products per line
      const estimatedWrappedLines = Math.ceil(productLines.length / 8) || 1;
      
      const headerHeight = 70;
      const ingredientRowHeight = 22;
      const footerHeight = 30;
      const productsSectionHeight = 20 + (estimatedWrappedLines * 14) + 10;
      const totalHeight = headerHeight + productsSectionHeight + (calcResult.ingredients.length * ingredientRowHeight) + footerHeight + 50;
      
      // Use receipt-style width (280px for good mobile compatibility)
      canvas.width = 350;
      canvas.height = totalHeight;
      
      // Background - white
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Header background - light amber
      ctx.fillStyle = '#fffbeb';
      ctx.fillRect(0, 0, canvas.width, 60);
      
      // Header accent line
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(0, 60, canvas.width, 3);
      
      // Shop icon (amber square)
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(15, 15, 30, 30);
      
      // Title
      ctx.fillStyle = '#1e293b';
      ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillText('Purchase Invoice', 55, 32);
      
      // Date
      ctx.fillStyle = '#64748b';
      ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillText(`${shopName} • ${new Date().toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}`, 55, 48);
      
      // Total on right
      ctx.fillStyle = '#d97706';
      ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`₱${calcResult.grandTotal?.toFixed(2)}`, canvas.width - 15, 35);
      
      ctx.fillStyle = '#64748b';
      ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillText('TOTAL', canvas.width - 15, 50);
      ctx.textAlign = 'left';
      
      // Products Section
      const productsY = 80;
      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 10px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillText('Making:', 15, productsY);
      
      // Products table header
      ctx.fillStyle = '#fef3c7';
      ctx.fillRect(10, productsY + 5, canvas.width - 20, 18);
      
      ctx.fillStyle = '#b45309';
      ctx.font = 'bold 9px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillText('Product', 15, productsY + 16);
      ctx.textAlign = 'right';
      ctx.fillText('Qty', canvas.width - 15, productsY + 16);
      ctx.textAlign = 'left';
      
      // Products - single line horizontal format like "Americano (12x), Espresso (12x)"
      Object.entries(calcProducts).filter(([_, qty]) => qty > 0).forEach(([pid, qty]) => {
        const prod = products.find(p => p.id === Number(pid));
        if (prod) {
          productLines.push(`${prod.name} (${qty}x)`);
        }
      });
      
      // Split into multiple lines if too long
      let currentLine = '';
      const wrappedLines: string[] = [];
      const maxWidth = canvas.width - 30;
      
      // Use a temporary context for measuring
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
      
      // Draw products on single/multiple lines
      let prodY = productsY + 20;
      wrappedLines.forEach((line) => {
        ctx.fillStyle = '#334155';
        ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.fillText(line, 15, prodY);
        prodY += 14;
      });
      
      // Products section height calculated earlier
      
      // Ingredients Section
      const ingStartY = prodY + 10;
      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 10px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillText('Ingredients:', 15, ingStartY);
      
      // Ingredients table header
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
      
      // Ingredients rows
      let rowY = tableHeaderY + 20;
      calcResult.ingredients?.forEach((ing: any, idx: number) => {
        // Row background (alternating)
        ctx.fillStyle = idx % 2 === 0 ? '#f8fafc' : '#ffffff';
        ctx.fillRect(10, rowY - 10, canvas.width - 20, 20);
        
        // Name
        ctx.fillStyle = '#334155';
        ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.fillText(ing.name.substring(0, 20), 15, rowY + 2);
        
        // Quantity
        ctx.fillStyle = '#334155';
        ctx.textAlign = 'right';
        ctx.fillText(`${ing.quantityNeeded} ${ing.baseUnit}`, 130, rowY + 2);
        
        // Cost
        ctx.fillStyle = '#059669';
        ctx.font = 'medium 10px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.fillText(`₱${ing.totalCost?.toFixed(2)}`, canvas.width - 15, rowY + 2);
        ctx.textAlign = 'left';
        
        rowY += 22;
      });
      
      // Footer
      const footerY = totalHeight - 25;
      ctx.fillStyle = '#f1f5f9';
      ctx.fillRect(0, footerY, canvas.width, 25);
      ctx.fillStyle = '#64748b';
      ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${shopName} • Purchase Request`, canvas.width / 2, footerY + 15);
      ctx.textAlign = 'left';
      
      // Handle download format
      if (format === 'png') {
        const link = document.createElement('a');
        link.download = `purchase-invoice-${new Date().toISOString().split('T')[0]}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      } else if (format === 'pdf') {
        // Convert canvas to image and create PDF
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
  };

  // Product Ingredients Assignment
  const [productIngredients, setProductIngredients] = useState<any[]>([]);
  const [ingredientQuantities, setIngredientQuantities] = useState<Record<number, number>>({});
  const [ingredientRequired, setIngredientRequired] = useState<Record<number, boolean>>({});
  const [availability, setAvailability] = useState<any>(null);

  // Fetch ingredients when editing a product
  const fetchProductIngredients = async (productId: number) => {
    try {
      const res = await fetch(`/api/ingredients/product/${productId}`);
      const data = await res.json();
      setProductIngredients(data);
      const qtyMap: Record<number, number> = {};
      const reqMap: Record<number, boolean> = {};
      data.forEach((pi: any) => { qtyMap[pi.ingredientId] = pi.quantity; reqMap[pi.ingredientId] = pi.required ?? true; });
      setIngredientQuantities(qtyMap);
      setIngredientRequired(reqMap);
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
        required: ingredientRequired[parseInt(ingId)] ?? true,
      }));
    
    try {
      await fetch(`/api/ingredients/product/${productId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ingredients: items }),
      });
      notif('✅ Ingredients saved!');
      fetchAvailability(productId);
    } catch (e) {
      console.error('Failed to save product ingredients:', e);
    }
  };

  // ── Ingredients Functions ───────────────────────────────────────────────────
  const fetchIngredients = async () => {
    setIngredientsLoading(true);
    try {
      const res = await fetch('/api/ingredients');
      const data = await res.json();
      setIngredients(data);
    } catch (e) {
      console.error('Failed to fetch ingredients:', e);
    } finally {
      setIngredientsLoading(false);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const res = await fetch('/api/suppliers');
      const data = await res.json();
      setSuppliers(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to fetch suppliers:', e);
      setSuppliers([]);
    }
  };

  function openAddIngredient() {
    fetchSuppliers();
    setEditingIngredient(null);
    setIngredientForm({ name: '', category: '', baseUnit: 'g', purchaseUnit: 'g', currentStock: 0, minStock: 0, costPerUnit: 0, supplierId: null });
    setShowIngredientModal(true);
  }

  async function createSupplier() {
    try {
      const res = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(supplierForm),
      });
      if (res.ok) {
        const created = await res.json();
        setSuppliers(prev => [...prev, created]);
        setIngredientForm(f => ({ ...f, supplierId: created.id }));
        setShowSupplierModal(false);
        setSupplierForm({ name: '', contactPerson: '', phone: '', email: '', address: '' });
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to create supplier');
      }
    } catch (e) {
      console.error('Failed to create supplier:', e);
      alert('Network error creating supplier');
    }
  }

  function openEditIngredient(ing: any) {
    fetchSuppliers();
    setEditingIngredient(ing);
    setIngredientForm({
      name: ing.name,
      category: ing.category || '',
      baseUnit: ing.baseUnit,
      purchaseUnit: ing.purchaseUnit || ing.baseUnit || 'g',
      currentStock: ing.currentStock,
      minStock: ing.minStock,
      costPerUnit: ing.costPerUnit,
      supplierId: ing.supplier?.id || ing.supplierId || null,
    });
    setShowIngredientModal(true);
  }

  async function saveIngredient() {
    if (!ingredientForm.name.trim()) return;
    setIngredientSaving(true);
    try {
      if (editingIngredient) {
        await fetch(`/api/ingredients/${editingIngredient.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(ingredientForm),
        });
        notif('✅ Ingredient updated!');
      } else {
        await fetch('/api/ingredients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(ingredientForm),
        });
        notif('✅ Ingredient added!');
      }
      setShowIngredientModal(false);
      fetchIngredients();
    } catch (e) {
      console.error('Failed to save ingredient:', e);
      notif('❌ Failed to save ingredient');
    } finally {
      setIngredientSaving(false);
    }
  }

  async function deleteIngredient(id: number) {
    if (!confirm('Delete this ingredient? This will also remove it from all products.')) return;
    try {
      await fetch(`/api/ingredients/${id}`, { method: 'DELETE' });
      notif('✅ Ingredient deleted!');
      fetchIngredients();
    } catch (e) {
      console.error('Failed to delete ingredient:', e);
      notif('❌ Failed to delete ingredient');
    }
  }

  async function calculateIngredients() {
    const items = Object.entries(calcProducts).map(([productId, qty]) => ({
      productId: parseInt(productId),
      quantity: qty
    })).filter(item => item.quantity > 0);

    if (items.length === 0) {
      notif('Please select products and quantities first');
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
      notif('❌ Calculation failed');
    } finally {
      setCalcLoading(false);
    }
  }

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
      const [pRes, cRes, bRes] = await Promise.all([
        fetch('/api/products'),
        fetch('/api/categories'),
        fetch('/api/settings/branding'),
      ]);
      const [p, c, b] = await Promise.all([pRes.json(), cRes.json(), bRes.json()]);
      setProducts(p);
      setCategories(c);
      if (b?.shopName) setShopName(b.shopName);
      // Fetch reviews for all products
      if (p && p.length > 0) {
        fetchReviews(p.map((prod: Product) => prod.id));
      }
    } catch (e) {
      console.error('Failed to load products/categories:', e);
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
    
    // Calculate final price from BIR pricing
    const capitalCost = parseFloat(productForm.capitalCost) || 0;
    const marginType = productForm.marginType || 'PERCENTAGE';
    const marginValue = parseFloat(productForm.marginValue) || 30;
    const vatExempt = productForm.vatExempt || false;
    const vatRate = 12;
    
    // Calculate base price (cost + margin)
    let basePrice: number;
    if (marginType === 'PERCENTAGE') {
      basePrice = capitalCost * (1 + marginValue / 100);
    } else {
      basePrice = capitalCost + marginValue;
    }
    
    // Calculate final price with VAT
    let finalPrice = basePrice;
    if (!vatExempt) {
      finalPrice = basePrice * (1 + vatRate / 100);
    }
    
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
    if (editingProduct) {
      await fetch('/api/products', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingProduct.id, ...body }),
      });
      notif('✅ Product updated!');
    } else {
      await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      notif('✅ Product added!');
    }
    setProductSaving(false);
    setShowProductModal(false);
    fetchAll();
  }

  async function toggleAvailable(p: Product) {
    await fetch('/api/products', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: p.id, available: !p.available }),
    });
    notif(p.available ? '⚠️ Product hidden from menu' : '✅ Product visible on menu');
    fetchAll();
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
      const results = await Promise.all(
        targets.map(async (p) => {
          const res = await fetch('/api/products', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: p.id }),
          });
          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.error || `Failed to delete ${p.name}`);
          }
          return data;
        })
      );
      setDeleteModal({ open: false, targets: [] });
      setSelectedIds(new Set());
      notif(`🗑️ ${targets.length === 1 ? `"${targets[0].name}" removed` : `${targets.length} products removed`}`);
      await fetchAll();
    } catch (err) {
      console.error('Delete error:', err);
      notif(`❌ ${err instanceof Error ? err.message : 'Error deleting products'}`);
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
          console.error('❌ Failed to update category:', data);
          notif(`❌ ${data?.error || 'Failed to update category'}`);
          return;
        }
        notif('✅ Category updated!');
      } else {
        const res = await fetch('/api/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, icon: catForm.icon, sortOrder: categories.length }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          console.error('❌ Failed to create category:', data);
          notif(`❌ ${data?.error || 'Failed to create category'}`);
          return;
        }
        notif('✅ Category added!');
      }

      setShowCatModal(false);
      fetchAll();
    } catch (err) {
      console.error('❌ Network error while saving category:', err);
      notif('❌ Network error while saving category');
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
        notif('🗑️ Category deleted');
        await fetchAll();
      } else {
        notif(`❌ ${data.error || 'Failed to delete category'}`);
      }
    } catch (err) {
      console.error('Delete category error:', err);
      notif(`❌ ${err instanceof Error ? err.message : 'Error deleting category'}`);
    }
  }

  const filteredProducts = products.filter((p) => {
    if (filterCat !== 'ALL' && p.categoryId !== filterCat) return false;
    if (search) return p.name.toLowerCase().includes(search.toLowerCase());
    return true;
  });

  const renderProductCard = (p: Product, includeReviews = false) => (
    <div key={p.id} className="group rounded-2xl border border-slate-200 bg-white p-4 transition-colors hover:border-amber-500">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-slate-800 font-bold">{p.name}</p>
          <p className="text-xs text-slate-500">₱{Number(p.price).toFixed(2)}</p>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => openEditProduct(p)}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-600 text-sm text-white transition-colors hover:bg-amber-500"
            title="Edit product"
          >
            ✎
          </button>
          <button
            onClick={() => openDeleteModal([p])}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-600 text-sm text-white transition-colors hover:bg-red-500"
            title="Delete product"
          >
            🗑️
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
        {p.available !== false && <span className="rounded bg-green-100 px-2 py-1 text-green-700">Available</span>}
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
    <div className="h-full overflow-y-auto bg-white p-6 space-y-6">
      {/* Notification */}
      {notification && (
        <div className="fixed top-4 right-4 bg-amber-600 text-white px-5 py-3 rounded-xl shadow-2xl z-50 font-medium">
          {notification}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-slate-800 text-2xl font-bold">Menu Management</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setTab('products')}
            className={`px-4 py-2 rounded-xl font-semibold text-sm transition-colors ${tab === 'products' ? 'bg-amber-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
          >
            🍽️ Products
          </button>
          <button
            onClick={() => setTab('all')}
            className={`px-4 py-2 rounded-xl font-semibold text-sm transition-colors ${tab === 'all' ? 'bg-amber-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
          >
            🗂️ All Products
          </button>
          <button
            onClick={() => setTab('categories')}
            className={`px-4 py-2 rounded-xl font-semibold text-sm transition-colors ${tab === 'categories' ? 'bg-amber-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
          >
            🏷️ Categories
          </button>
          <button
            onClick={() => { setTab('ingredients'); fetchIngredients(); fetchSuppliers(); }}
            className={`px-5 py-2.5 rounded-2xl font-medium text-sm transition-all duration-300 ${tab === 'ingredients' ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/25' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
          >
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
              Ingredients
            </span>
          </button>
        </div>
      </div>

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
                  className="min-w-0 flex-1 rounded-xl bg-slate-100 px-4 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
                <select
                  value={filterCat}
                  onChange={(e) => setFilterCat(e.target.value === 'ALL' ? 'ALL' : parseInt(e.target.value))}
                  className="rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  <option value="ALL">All Categories</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{(c as any).icon} {c.name}</option>)}
                </select>
                <button
                  onClick={openAddProduct}
                  className="whitespace-nowrap rounded-xl bg-amber-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-amber-500"
                >
                  ➕ Add Product
                </button>
                <button
                  onClick={openAddCat}
                  className="whitespace-nowrap rounded-xl border border-slate-300 bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-200"
                >
                  🏷️ Manage Categories
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
                    className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold px-4 py-2 rounded-xl text-sm transition-colors"
                  >
                    ➕ Add Category
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
                          className="bg-amber-600 hover:bg-amber-500 text-white px-3 py-2 rounded-lg text-sm transition-colors font-medium"
                        >
                          ✎ Edit
                        </button>
                        <button
                          onClick={() => deleteCat(c)}
                          className="bg-red-600 hover:bg-red-500 text-white px-3 py-2 rounded-lg text-sm transition-colors font-medium"
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {/* ── Ingredients Tab ── */}
          {tab === 'ingredients' && (
            <div className="space-y-6">
              {/* Apple-Inspired Premium Header */}
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-white via-slate-50 to-white p-8 shadow-xl border border-slate-200/60">
                {/* Subtle decorative elements */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-amber-100/50 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-orange-100/30 to-transparent rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>
                
                <div className="relative flex items-center justify-between">
                  <div className="flex items-center gap-5">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/25 ring-1 ring-white/20">
                      <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-3xl font-semibold tracking-tight text-slate-800">Ingredients</h2>
                      <p className="text-slate-500 mt-1 text-sm font-medium">Manage inventory & calculate purchase needs</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setCalculatorOpen(!calculatorOpen)}
                      className={`px-6 py-3 rounded-2xl font-medium text-sm transition-all duration-300 shadow-lg backdrop-blur-md ${calculatorOpen ? 'bg-amber-500 text-white' : 'bg-white/80 text-slate-700 hover:bg-white border border-slate-200/60'}`}
                    >
                      <span className="flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        Calculator
                      </span>
                    </button>
                    <button
                      onClick={() => setIsLiveEditMode(!isLiveEditMode)}
                      className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-medium text-sm transition-all duration-300 border-2 ${
                        isLiveEditMode 
                          ? 'bg-emerald-500 text-white border-emerald-600 shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40' 
                          : 'bg-white text-slate-600 border-slate-200 hover:border-amber-400 hover:text-amber-600 shadow-lg shadow-slate-200/25'
                      }`}
                    >
                      <span className={`w-2.5 h-2.5 rounded-full ${isLiveEditMode ? 'bg-white animate-pulse' : 'bg-slate-400'}`}></span>
                      {isLiveEditMode ? '✓ Live Edit ON' : '○ Live Edit OFF'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Apple-Inspired Premium Stats Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="group bg-white/90 backdrop-blur-xl rounded-3xl p-5 shadow-sm border border-slate-200/40 hover:shadow-xl hover:border-slate-300/60 hover:-translate-y-1 transition-all duration-300 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-amber-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <div className="relative flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-100 to-amber-200/50 flex items-center justify-center shadow-inner ring-1 ring-amber-200/30">
                      <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-slate-400 text-xs font-medium tracking-wide uppercase">Total</p>
                      <p className="text-2xl font-semibold text-slate-800">{ingredients.length}</p>
                    </div>
                  </div>
                </div>
                <div className="group bg-white/90 backdrop-blur-xl rounded-3xl p-5 shadow-sm border border-slate-200/40 hover:shadow-xl hover:border-slate-300/60 hover:-translate-y-1 transition-all duration-300 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <div className="relative flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-100 to-emerald-200/50 flex items-center justify-center shadow-inner ring-1 ring-emerald-200/30">
                      <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-slate-400 text-xs font-medium tracking-wide uppercase">In Stock</p>
                      <p className="text-2xl font-semibold text-slate-800">{ingredients.filter(i => i.currentStock > 0).length}</p>
                    </div>
                  </div>
                </div>
                <div className="group bg-white/90 backdrop-blur-xl rounded-3xl p-5 shadow-sm border border-slate-200/40 hover:shadow-xl hover:border-slate-300/60 hover:-translate-y-1 transition-all duration-300 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-rose-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <div className="relative flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-100 to-rose-200/50 flex items-center justify-center shadow-inner ring-1 ring-rose-200/30">
                      <svg className="w-6 h-6 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-slate-400 text-xs font-medium tracking-wide uppercase">Low Stock</p>
                      <p className="text-2xl font-semibold text-slate-800">{ingredients.filter(i => i.currentStock <= i.minStock).length}</p>
                    </div>
                  </div>
                </div>
                <div className="group bg-white/90 backdrop-blur-xl rounded-3xl p-5 shadow-sm border border-slate-200/40 hover:shadow-xl hover:border-slate-300/60 hover:-translate-y-1 transition-all duration-300 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <div className="relative flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-100 to-blue-200/50 flex items-center justify-center shadow-inner ring-1 ring-blue-200/30">
                      <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-slate-400 text-xs font-medium tracking-wide uppercase">Total Value</p>
                      <p className="text-2xl font-semibold text-slate-800">₱{ingredients.reduce((sum, i) => sum + (i.currentStock * i.costPerUnit), 0).toFixed(0)}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Apple-Inspired Premium Purchase Calculator Panel */}
              {calculatorOpen && (
                <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-8 shadow-xl border border-slate-200/40 shadow-slate-200/30">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/25 ring-1 ring-white/20">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-slate-800">Calculate Ingredients Needed</h3>
                      <p className="text-slate-500 text-sm">Enter product quantities to calculate total ingredients needed</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
                    {products.map(p => (
                      <div key={p.id} className="bg-slate-50/50 rounded-2xl p-4 border border-slate-200/50 hover:border-amber-300/50 hover:bg-slate-50 transition-all duration-200">
                        <div className="text-slate-800 text-sm font-medium truncate">{p.name}</div>
                        <div className="flex items-center gap-2 mt-3">
                          <input
                            type="number"
                            min="0"
                            value={calcProducts[p.id] || ''}
                            onChange={(e) => setCalcProducts(prev => ({ ...prev, [p.id]: parseInt(e.target.value) || 0 }))}
                            placeholder="0"
                            className="w-full bg-white text-slate-800 text-sm rounded-xl px-4 py-2.5 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 transition-all shadow-sm"
                          />
                          <span className="text-slate-400 text-xs whitespace-nowrap font-medium">pcs</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={calculateIngredients}
                    disabled={calcLoading}
                    className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-2xl font-semibold transition-all duration-300 shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 disabled:opacity-50 disabled:shadow-none"
                  >
                    {calcLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Calculating...
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        Calculate Ingredients
                      </span>
                    )}
                  </button>

                  {/* Premium Invoice Design - Clean & Professional */}
                  {calcResult && (
                    <div 
                      ref={invoiceRef} 
                      className="bg-white rounded-lg border border-slate-200 mt-3 shadow-lg overflow-hidden max-w-sm mx-auto"
                      style={{ fontSize: '11px' }}
                    >
                      {/* Clean Invoice Header */}
                      <div className="bg-white px-4 py-4 border-b-2 border-amber-400">
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-amber-500 rounded-lg flex items-center justify-center">
                              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
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
                      
                      {/* Products Made - Table */}
                      <div className="mb-1.5">
                        <p className="text-slate-400 text-xs mb-0.5">Making:</p>
                        {/* Table Header */}
                        <div className="flex items-center py-1 bg-amber-50 rounded-t text-xs font-semibold text-amber-700">
                          <span className="flex-1">Product</span>
                          <span className="w-16 text-right">Qty</span>
                        </div>
                        {/* Table Rows */}
                        {Object.entries(calcProducts).filter(([_, qty]) => qty > 0).map(([pid, qty]) => {
                          const prod = products.find(p => p.id === Number(pid));
                          return prod ? (
                            <div key={pid} className="flex items-center py-1 border-b border-amber-50 last:border-0 text-xs">
                              <span className="flex-1 text-slate-700">{prod.name}</span>
                              <span className="w-16 text-right text-amber-700 font-medium">×{qty}</span>
                            </div>
                          ) : null;
                        })}
                      </div>

                      {/* Ingredients Table - Excel Style with Search & Sort */}
                      <div className="mb-1.5">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-slate-400 text-xs mb-0">Ingredients:</p>
                          <input
                            type="text"
                            placeholder="Search..."
                            value={ingredientSearch}
                            onChange={(e) => setIngredientSearch(e.target.value)}
                            className="text-xs px-3 py-1.5 border border-slate-200 rounded-lg w-32 focus:outline-none focus:border-amber-400 text-black placeholder-slate-400 bg-white"
                          />
                        </div>
                        {/* Table Header */}
                        <div className="flex items-center py-1.5 bg-slate-800 rounded text-xs font-semibold text-slate-200">
                          <button 
                            className="flex-1 text-left hover:text-white"
                            onClick={() => setIngredientSort(ingredientSort === 'name' ? 'name-desc' : 'name')}
                          >
                            Item {ingredientSort === 'name' ? '↑' : '↓'}
                          </button>
                          <span className="w-14 text-right">Stock</span>
                          <span className="w-14 text-right">Needed</span>
                          <span className="w-14 text-right">Deficit</span>
                          <span className="w-10 text-right">Unit</span>
                          <span className="w-14 text-right">Cost</span>
                        </div>
                        {/* Table Body */}
                        <div>
                          {calcResult.ingredients
                            ?.filter((ing: any) => !ingredientSearch || ing.name.toLowerCase().includes(ingredientSearch.toLowerCase()))
                            .sort((a: any, b: any) => {
                              switch (ingredientSort) {
                                case 'name': return a.name.localeCompare(b.name);
                                case 'name-desc': return b.name.localeCompare(a.name);
                                case 'needed': return a.quantityNeeded - b.quantityNeeded;
                                case 'needed-desc': return b.quantityNeeded - a.quantityNeeded;
                                case 'deficit': return (a.quantityNeeded - (a.currentStock || 0)) - (b.quantityNeeded - (b.currentStock || 0));
                                case 'deficit-desc': return (b.quantityNeeded - (b.currentStock || 0)) - (a.quantityNeeded - (a.currentStock || 0));
                                default: return 0;
                              }
                            })
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
                        {/* Summary Row */}
                        <div className="flex items-center py-1 bg-slate-50 border-t border-slate-200 text-xs font-semibold text-slate-700">
                          <span className="flex-1">Total ({calcResult.ingredients?.filter((ing: any) => !ingredientSearch || ing.name.toLowerCase().includes(ingredientSearch.toLowerCase())).length} items)</span>
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
                      
                      {/* Clean Invoice Footer */}
                      <div className="bg-slate-50 px-4 py-3 border-t border-slate-200 text-center">
                        <p className="text-slate-600 text-xs font-medium">Thank you for your business! 🙏</p>
                        <p className="text-slate-400 text-xs mt-0.5">{shopName} • Purchase Request</p>
                      </div>
                    </div>
                  )}
                  
                  {/* Download Buttons - PNG and PDF */}
                  {calcResult && calcResult.ingredients?.length > 0 && (
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => downloadInvoice('png')}
                        className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-1.5"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        PNG
                      </button>
                      <button
                        onClick={() => downloadInvoice('pdf')}
                        className="flex-1 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-1.5"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        PDF
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Apple-Inspired Ingredients List */}
              {ingredientsLoading ? (
                <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-12 shadow-sm border border-slate-200/50">
                  <div className="flex flex-col items-center justify-center">
                    <div className="w-10 h-10 border-3 border-slate-200 border-t-amber-500 rounded-full animate-spin"></div>
                    <p className="text-slate-500 mt-4">Loading ingredients...</p>
                  </div>
                </div>
              ) : ingredients.length === 0 ? (
                <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-16 shadow-sm border border-slate-200/50 text-center">
                  <div className="w-24 h-24 bg-gradient-to-br from-amber-100 to-orange-100 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner">
                    <svg className="w-12 h-12 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-slate-800 mb-2">No Ingredients Yet</h3>
                  <p className="text-slate-500 mb-6">Click "Add Ingredient" to get started</p>
                  <button
                    onClick={openAddIngredient}
                    className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-2xl font-medium text-sm hover:from-amber-600 hover:to-orange-600 transition-all duration-300 shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40"
                  >
                    + Add First Ingredient
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Search and Table Header */}
                  <div className="flex items-center justify-between gap-4">
                    <input
                      type="text"
                      placeholder="Search ingredients..."
                      value={ingredientSearch2}
                      onChange={(e) => setIngredientSearch2(e.target.value)}
                      className="flex-1 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all"
                    />
                    <button
                      onClick={() => { setShowIngredientModal(true); setEditingIngredient(null); setIngredientForm({ name: '', category: '', baseUnit: 'g', purchaseUnit: 'g', currentStock: 0, minStock: 0, costPerUnit: 0, supplierId: null }); }}
                      className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold rounded-xl hover:from-amber-600 hover:to-orange-600 transition-all shadow-lg shadow-amber-500/20"
                    >
                      + Add Ingredient
                    </button>
                  </div>

                  {/* Premium Apple-Style Table */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Ingredient</th>
                            <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Current Stock</th>
                            <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Min Stock</th>
                            <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Cost/Unit</th>
                            <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                            <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ingredients
                            .filter(ing => !ingredientSearch2 || ing.name.toLowerCase().includes(ingredientSearch2.toLowerCase()))
                            .map((ing) => (
                              <tr key={ing.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors group">
                                <td className="px-4 py-3">
                                  {isLiveEditMode && editingIngredientId === ing.id ? (
                                    <div className="space-y-2">
                                      <input
                                        type="text"
                                        ref={ingredientInputRef}
                                        value={editingIngredientData?.name || ''}
                                        onChange={(e) => setEditingIngredientData({ ...editingIngredientData, name: e.target.value })}
                                        className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:border-amber-500 text-black"
                                        placeholder="Name"
                                      />
                                      <select
                                        ref={ingredientUnitInputRef}
                                        value={editingIngredientData?.baseUnit || ''}
                                        onChange={(e) => setEditingIngredientData({ ...editingIngredientData, baseUnit: e.target.value })}
                                        className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:outline-none focus:border-amber-500 text-black bg-white"
                                      >
                                        <option value="">Select Unit</option>
                                        {uniqueUnits.map((unit: string) => (
                                          <option key={unit} value={unit}>{unit}</option>
                                        ))}
                </select>
                <button
                  onClick={() => setShowSupplierModal(true)}
                  className="mt-2 text-xs text-amber-600 hover:text-amber-700 font-medium underline"
                >
                  + Add New Supplier
                </button>
              </div>
                                  ) : (
                                    <div className={`flex items-center gap-3 cursor-pointer hover:bg-slate-100 -m-2 p-2 rounded-lg ${isLiveEditMode ? 'hover:bg-slate-100' : ''}`} onClick={isLiveEditMode ? () => { setEditingIngredientId(ing.id); setEditingIngredientData({ ...ing }); } : undefined}>
                                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${ing.currentStock <= ing.minStock ? 'bg-rose-100' : 'bg-amber-100'}`}>
                                        <svg className={`w-5 h-5 ${ing.currentStock <= ing.minStock ? 'text-rose-600' : 'text-amber-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                                        </svg>
                                      </div>
                                      <div>
                                        <p className="text-slate-800 font-semibold text-sm">{ing.name}</p>
                                        <p className="text-slate-400 text-xs">Unit: {ing.baseUnit}</p>
                                      </div>
                                    </div>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  {isLiveEditMode && editingIngredientId === ing.id ? (
                                    <input
                                      type="number"
                                      ref={ingredientStockInputRef}
                                      value={editingIngredientData?.currentStock || 0}
                                      onChange={(e) => setEditingIngredientData({ ...editingIngredientData, currentStock: parseFloat(e.target.value) || 0 })}
                                      className="w-20 px-2 py-1 text-sm text-right border border-slate-300 rounded focus:outline-none focus:border-amber-500 text-black"
                                    />
                                  ) : (
                                    <span 
                                      className={`cursor-pointer hover:bg-slate-200 px-2 py-1 rounded ${ing.currentStock <= ing.minStock ? 'text-rose-600 font-semibold' : 'text-slate-700'} ${isLiveEditMode ? '' : 'cursor-default'}`}
                                      onClick={isLiveEditMode ? () => { setEditingIngredientId(ing.id); setEditingIngredientData({ ...ing }); } : undefined}
                                    >
                                      {ing.currentStock.toLocaleString()}
                                      <span className="text-slate-400 text-xs ml-1">{ing.baseUnit}</span>
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  {isLiveEditMode && editingIngredientId === ing.id ? (
                                    <input
                                      type="number"
                                      ref={ingredientMinStockInputRef}
                                      value={editingIngredientData?.minStock || 0}
                                      onChange={(e) => setEditingIngredientData({ ...editingIngredientData, minStock: parseFloat(e.target.value) || 0 })}
                                      className="w-20 px-2 py-1 text-sm text-right border border-slate-300 rounded focus:outline-none focus:border-amber-500 text-black"
                                    />
                                  ) : (
                                    <span 
                                      className={`cursor-pointer hover:bg-slate-200 px-2 py-1 rounded text-slate-600 ${isLiveEditMode ? '' : 'cursor-default'}`}
                                      onClick={isLiveEditMode ? () => { setEditingIngredientId(ing.id); setEditingIngredientData({ ...ing }); } : undefined}
                                    >
                                      {ing.minStock.toLocaleString()}
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  {isLiveEditMode && editingIngredientId === ing.id ? (
                                    <input
                                      type="number"
                                      ref={ingredientCostInputRef}
                                      step="0.01"
                                      value={editingIngredientData?.costPerUnit || 0}
                                      onChange={(e) => setEditingIngredientData({ ...editingIngredientData, costPerUnit: parseFloat(e.target.value) || 0 })}
                                      className="w-24 px-2 py-1 text-sm text-right border border-slate-300 rounded focus:outline-none focus:border-amber-500 text-black"
                                    />
                                  ) : (
                                    <span 
                                      className={`cursor-pointer hover:bg-slate-200 px-2 py-1 rounded text-emerald-600 font-semibold ${isLiveEditMode ? '' : 'cursor-default'}`}
                                      onClick={isLiveEditMode ? () => { setEditingIngredientId(ing.id); setEditingIngredientData({ ...ing }); } : undefined}
                                    >
                                      ₱{ing.costPerUnit}
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  {ing.currentStock <= ing.minStock ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-100 text-rose-700 text-xs font-semibold rounded-lg">
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                      </svg>
                                      Low
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-lg">
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                      </svg>
                                      OK
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  {isLiveEditMode && editingIngredientId === ing.id ? (
                                    <div className="flex items-center justify-end gap-1">
                                      <button
                                        onClick={async () => {
                                          try {
                                            const res = await fetch(`/api/ingredients/${ing.id}`, {
                                              method: 'PUT',
                                              headers: { 'Content-Type': 'application/json' },
                                              body: JSON.stringify(editingIngredientData),
                                            });
                                            if (res.ok) {
                                              setIngredients(ingredients.map(i => i.id === ing.id ? editingIngredientData : i));
                                              setEditingIngredientId(null);
                                              setEditingIngredientData(null);
                                              setNotification('Ingredient updated successfully');
                                              setTimeout(() => setNotification(null), 3000);
                                            }
                                          } catch (err) {
                                            console.error('Failed to update ingredient:', err);
                                          }
                                        }}
                                        className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                        title="Save"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                      </button>
                                      <button
                                        onClick={() => { setEditingIngredientId(null); setEditingIngredientData(null); }}
                                        className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors"
                                        title="Cancel"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                      </button>
                                    </div>
                                  ) : (
                                    <div className={`flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all ${isLiveEditMode ? '' : 'opacity-100'}`}>
                                      {isLiveEditMode && (
                                        <button
                                          onClick={() => { setEditingIngredientId(ing.id); setEditingIngredientData({ ...ing }); }}
                                          className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-colors"
                                        >
                                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                          </svg>
                                        </button>
                                      )}
                                      <button
                                        onClick={() => deleteIngredient(ing.id)}
                                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                      </button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

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
                  <span className="text-xs text-amber-600 ml-1">(auto-calculated)</span>
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
                <p className="text-amber-600 text-xs font-semibold uppercase tracking-wider mb-3">BIR Pricing</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-600 text-sm block mb-1">Capital Cost (₱)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.50"
                      value={productForm.capitalCost || ''}
                      onChange={(e) => setProductForm((f: any) => ({ ...f, capitalCost: parseFloat(e.target.value) || 0 }))}
                      placeholder="0.00"
                      className="w-full bg-slate-100 text-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
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
                <p className="text-emerald-700 text-xs font-semibold uppercase tracking-wider mb-3">💰 Price Preview</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Capital Cost:</span>
                    <span className="font-medium">₱{(productForm.capitalCost || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Margin ({productForm.marginType === 'PERCENTAGE' ? `${productForm.marginValue || 0}%` : '₱'}):</span>
                    <span className="font-medium">₱{productForm.marginType === 'PERCENTAGE' 
                      ? ((productForm.capitalCost || 0) * (productForm.marginValue || 0) / 100).toFixed(2) 
                      : (productForm.marginValue || 0).toFixed(2)}</span>
                  </div>
                  <div className="border-t border-emerald-200 pt-2 flex justify-between">
                    <span className="text-slate-600">Selling Price (before VAT):</span>
                    <span className="font-semibold">₱{((productForm.marginType === 'PERCENTAGE' 
                      ? (productForm.capitalCost || 0) * (1 + (productForm.marginValue || 0) / 100) 
                      : (productForm.capitalCost || 0) + (productForm.marginValue || 0))).toFixed(2)}</span>
                  </div>
                  {productForm.vatExempt ? (
                    <div className="border-t border-emerald-300 pt-2 flex justify-between bg-emerald-100 -mx-4 px-4 -mb-4 pb-2 rounded-b-xl">
                      <span className="text-emerald-800 font-semibold">Final Price (VAT Exempt):</span>
                      <span className="text-emerald-800 font-bold text-lg">₱{((productForm.marginType === 'PERCENTAGE' 
                        ? (productForm.capitalCost || 0) * (1 + (productForm.marginValue || 0) / 100) 
                        : (productForm.capitalCost || 0) + (productForm.marginValue || 0))).toFixed(2)}</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between">
                        <span className="text-slate-600">VAT (12%):</span>
                        <span className="font-medium">₱{((productForm.marginType === 'PERCENTAGE' 
                          ? (productForm.capitalCost || 0) * (1 + (productForm.marginValue || 0) / 100) 
                          : (productForm.capitalCost || 0) + (productForm.marginValue || 0)) * 0.12).toFixed(2)}</span>
                      </div>
                      <div className="border-t border-emerald-300 pt-2 flex justify-between bg-emerald-100 -mx-4 px-4 -mb-4 pb-2 rounded-b-xl">
                        <span className="text-emerald-800 font-semibold">Final Price (incl. VAT):</span>
                        <span className="text-emerald-800 font-bold text-lg">₱{((productForm.marginType === 'PERCENTAGE' 
                          ? (productForm.capitalCost || 0) * (1 + (productForm.marginValue || 0) / 100) 
                          : (productForm.capitalCost || 0) + (productForm.marginValue || 0)) * 1.12).toFixed(2)}</span>
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
                        <option value="coffee">☕ Coffee</option>
                        <option value="kitchen">🍳 Kitchen</option>
                        <option value="bar">🥤 Bar</option>
                        <option value="pastry">🧁 Pastry</option>
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
                      {imageUploading ? 'Uploading...' : '📁 Upload'}
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

              {/* Ingredients Section in Product Modal */}
              {editingProduct && (
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <h4 className="text-slate-800 font-semibold mb-3">Recipe (per 1 product)</h4>
                  {ingredients.length === 0 ? (
                    <p className="text-slate-500 text-sm">No ingredients defined yet. Add ingredients in the Ingredients tab first.</p>
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
                                if (e.target.checked && !(ing.id in ingredientRequired)) {
                                  setIngredientRequired(prev => ({ ...prev, [ing.id]: true }));
                                }
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
                            {/* Required / Optional toggle (only while in use) */}
                            <label className={`text-xs font-medium px-2 py-1 rounded ${used ? 'bg-slate-100 text-slate-700' : 'bg-slate-50 text-slate-400'} flex items-center gap-1`}>
                              <input
                                type="radio"
                                name={`req-${ing.id}`}
                                checked={used && (ingredientRequired[ing.id] ?? true)}
                                onChange={() => setIngredientRequired(prev => ({ ...prev, [ing.id]: true }))}
                                className="h-3 w-3"
                                disabled={!used}
                              />
                              Required
                              <input
                                type="radio"
                                name={`req-${ing.id}`}
                                checked={used && !ingredientRequired[ing.id]}
                                onChange={() => setIngredientRequired(prev => ({ ...prev, [ing.id]: false }))}
                                className="h-3 w-3"
                                disabled={!used}
                              />
                              Optional
                            </label>
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
                className="bg-amber-600 text-white py-3 rounded-xl font-bold hover:bg-amber-500 transition-colors disabled:opacity-50"
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
              <h3 className="text-slate-800 font-bold text-lg">⚠️ Confirm Delete</h3>
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
              <p className="text-slate-600 text-sm">Type <span className="font-mono text-amber-600 font-bold">DELETE</span> to confirm:</p>
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
                    {catIconUploading ? 'Uploading...' : '📁 Upload Image'}
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
                className="bg-amber-600 text-white py-3 rounded-xl font-bold hover:bg-amber-500 transition-colors disabled:opacity-50"
              >
                {catSaving ? 'Saving...' : editingCat ? 'Update' : 'Add Category'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Apple-Inspired Premium Ingredient Modal ── */}
      {showIngredientModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden transform transition-all duration-300 scale-100 ring-1 ring-black/5">
            {/* Modal Header */}
            <div className="relative bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6 overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl"></div>
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-orange-500/5 rounded-full blur-2xl"></div>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-gradient-radial from-amber-500/10 to-transparent rounded-full"></div>
              <div className="relative flex items-center justify-between">
                <h3 className="text-slate-800 font-semibold text-xl flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/25">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  {editingIngredient ? 'Edit Ingredient' : 'Add Ingredient'}
                </h3>
                <button 
                  onClick={() => setShowIngredientModal(false)} 
                  className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 flex items-center justify-center transition-all"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            {/* Modal Body */}
            <div className="p-6 space-y-5">
              <div>
                <label className="text-slate-600 text-sm font-medium block mb-2">Ingredient Name <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  value={ingredientForm.name}
                   onChange={(e) => setIngredientForm(f => ({ ...f, name: e.target.value }))}
                   placeholder="e.g. Espresso Beans"
                   className="w-full bg-slate-50 text-slate-800 rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 border border-slate-200 transition-all"
                 />
               </div>
               <div>
                 <label className="text-slate-600 text-sm font-medium block mb-2">Category</label>
                 <select
                   value={ingredientForm.category || ''}
                   onChange={(e) => setIngredientForm(f => ({ ...f, category: e.target.value }))}
                   className="w-full bg-slate-50 text-slate-800 rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 border border-slate-200 transition-all"
                 >
                   <option value="">General</option>
                   {['Coffee', 'Dairy', 'Syrup', 'Powder', 'Food', 'Packaging', 'General'].map((cat) => (
                     <option key={cat} value={cat}>{cat}</option>
                   ))}
                 </select>
               </div>
               <div>
                 <label className="text-slate-600 text-sm font-medium block mb-2">Base Unit <span className="text-rose-500">*</span></label>
                 <select
                   value={ingredientForm.baseUnit}
                   onChange={(e) => setIngredientForm(f => ({ ...f, baseUnit: e.target.value }))}
                   className="w-full bg-slate-50 text-slate-800 rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 border border-slate-200 transition-all"
                 >
                   <option value="">Select Unit</option>
                   {uniqueUnits.map((unit: string) => (
                     <option key={unit} value={unit}>{unit}</option>
                   ))}
                 </select>
               </div>
               <div>
                 <label className="text-slate-600 text-sm font-medium block mb-2">Purchase Unit</label>
                 <select
                   value={ingredientForm.purchaseUnit}
                   onChange={(e) => setIngredientForm(f => ({ ...f, purchaseUnit: e.target.value }))}
                   className="w-full bg-slate-50 text-slate-800 rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 border border-slate-200 transition-all"
                 >
                   <option value="">Same as base unit</option>
                   {(ingredientForm.baseUnit === 'g' ? ['kg', 'g', 'mg', 'oz', 'lb', 'pcs', 'pack', 'box', 'sachet'] :
                     ingredientForm.baseUnit === 'ml' ? ['L', 'ml', 'pcs', 'bottle', 'pack', 'box', 'sachet', 'cup', 'scoop'] :
                     ['pcs', 'kg', 'g', 'L', 'ml', 'bottle', 'pack', 'box', 'sachet']).map((unit) => (
                       <option key={unit} value={unit}>{unit}</option>
                   ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-600 text-sm font-medium block mb-2">Current Stock</label>
                  <input
                    type="number"
                    step="0.01"
                    value={ingredientForm.currentStock}
                    onChange={(e) => setIngredientForm(f => ({ ...f, currentStock: parseFloat(e.target.value) || 0 }))}
                    className="w-full bg-slate-50 text-slate-800 rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 border border-slate-200 transition-all"
                  />
                </div>
                <div>
                  <label className="text-slate-600 text-sm font-medium block mb-2">Min Stock (Alert)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={ingredientForm.minStock}
                    onChange={(e) => setIngredientForm(f => ({ ...f, minStock: parseFloat(e.target.value) || 0 }))}
                    className="w-full bg-slate-50 text-slate-800 rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 border border-slate-200 transition-all"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-600 text-sm font-medium block mb-2">Cost per Unit (₱)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={ingredientForm.costPerUnit}
                    onChange={(e) => setIngredientForm(f => ({ ...f, costPerUnit: parseFloat(e.target.value) || 0 }))}
                    placeholder="0.00"
                    className="w-full bg-slate-50 text-slate-800 rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 border border-slate-200 transition-all"
                  />
                </div>
                <div>
                  <label className="text-slate-600 text-sm font-medium block mb-2">Supplier</label>
                  <select
                    value={ingredientForm.supplierId || ''}
                    onChange={(e) => setIngredientForm(f => ({ ...f, supplierId: e.target.value ? parseInt(e.target.value) : null }))}
                    className="w-full bg-slate-50 text-slate-800 rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 border border-slate-200 transition-all"
                  >
                    <option value="">No supplier</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            
            {/* Modal Footer */}
            <div className="p-6 bg-slate-50 grid grid-cols-2 gap-3">
              <button 
                onClick={() => setShowIngredientModal(false)} 
                className="bg-white text-slate-600 py-3.5 rounded-2xl font-medium border border-slate-200 hover:bg-slate-100 hover:border-slate-300 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={saveIngredient}
                disabled={ingredientSaving || !ingredientForm.name.trim()}
                className="bg-gradient-to-r from-amber-500 to-orange-500 text-white py-3.5 rounded-2xl font-semibold hover:from-amber-600 hover:to-orange-600 transition-all duration-300 disabled:opacity-50 shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30"
              >
                {ingredientSaving ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  </span>
                ) : editingIngredient ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Update
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Ingredient
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showSupplierModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden">
            <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
              <h3 className="text-slate-800 font-semibold text-xl">Add New Supplier</h3>
            </div>
            <div className="p-6 space-y-4">
              <input
                type="text"
                placeholder="Supplier Name"
                value={supplierForm.name}
                onChange={e => setSupplierForm({...supplierForm, name: e.target.value})}
                className="w-full bg-slate-50 text-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 border border-slate-200"
                required
              />
              <input
                type="text"
                placeholder="Contact Person"
                value={supplierForm.contactPerson}
                onChange={e => setSupplierForm({...supplierForm, contactPerson: e.target.value})}
                className="w-full bg-slate-50 text-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 border border-slate-200"
              />
              <input
                type="text"
                placeholder="Phone"
                value={supplierForm.phone}
                onChange={e => setSupplierForm({...supplierForm, phone: e.target.value})}
                className="w-full bg-slate-50 text-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 border border-slate-200"
              />
              <input
                type="text"
                placeholder="Email"
                value={supplierForm.email}
                onChange={e => setSupplierForm({...supplierForm, email: e.target.value})}
                className="w-full bg-slate-50 text-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 border border-slate-200"
              />
              <input
                type="text"
                placeholder="Address"
                value={supplierForm.address}
                onChange={e => setSupplierForm({...supplierForm, address: e.target.value})}
                className="w-full bg-slate-50 text-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 border border-slate-200"
              />
            </div>
            <div className="p-6 bg-slate-50 grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowSupplierModal(false)}
                className="bg-white text-slate-600 py-3.5 rounded-2xl font-medium border border-slate-200 hover:bg-slate-100 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={createSupplier}
                className="bg-amber-500 text-white py-3.5 rounded-2xl font-medium hover:bg-amber-600 transition-all"
              >
                Save Supplier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
