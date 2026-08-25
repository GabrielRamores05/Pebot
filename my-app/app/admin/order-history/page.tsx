'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { IconHistory } from '@/lib/assets';

interface OrderItem {
  id: number;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  notes?: string | null;
  product: { name: string };
}

interface Order {
  id: number;
  orderNumber: string;
  customerName: string;
  loyaltyCustomerName?: string | null;
  status: 'PENDING' | 'PREPARING' | 'COMPLETED' | 'CANCELLED';
  totalAmount: number;
  paymentMethod: string;
  orderType: string;
  deliveryAddress?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  table?: { name: string } | null;
  items: OrderItem[];
}

interface BusinessSettings {
  id: number;
  businessName: string;
  businessAddress: string;
  tin: string;
  branchCode: string;
  vatRate: number;
  receiptSerialPrefix: string;
  lastReceiptNumber: number;
  footerMessage: string;
  loyaltyEnabled: boolean;
}

const STATUS_LABELS: Record<Order['status'], string> = {
  PENDING: '• Pending',
  PREPARING: '• Preparing',
  COMPLETED: '• Completed',
  CANCELLED: '• Cancelled',
};

const STATUS_COLORS: Record<Order['status'], string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  PREPARING: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
};

export default function OrderHistoryPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showInvoice, setShowInvoice] = useState(false);
  const [businessSettings, setBusinessSettings] = useState<BusinessSettings | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month' | 'year'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.user) {
          router.push('/login');
          return;
        }
        setAuthorized(true);
      })
      .catch(() => {
        router.push('/login');
      })
      .finally(() => setLoading(false));
  }, [router]);

  useEffect(() => {
    fetch('/api/settings/business')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setBusinessSettings(d))
      .catch(() => {});
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch('/api/orders?all=true', { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to fetch orders');
      const data = await res.json();
      setOrders(data);
    } catch (e) {
      console.error('Failed to load orders:', e);
    }
  }, []);

  useEffect(() => {
    if (!authorized) return;
    fetchOrders();
  }, [authorized, fetchOrders]);

  const filteredOrders = orders.filter((o) => {
    if (statusFilter !== 'ALL' && o.status !== statusFilter) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      if (!o.orderNumber.toLowerCase().includes(q) && !o.customerName.toLowerCase().includes(q)) {
        return false;
      }
    }
    if (dateFilter !== 'all') {
      const orderDate = new Date(o.createdAt);
      const now = new Date();
      const daysDiff = (now.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24);
      if (dateFilter === 'today' && daysDiff >= 1) return false;
      if (dateFilter === 'week' && daysDiff > 7) return false;
      if (dateFilter === 'month' && daysDiff > 30) return false;
      if (dateFilter === 'year' && daysDiff > 365) return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginated = filteredOrders
    .slice(startIndex, startIndex + itemsPerPage)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const resetFilters = () => {
    setSearchTerm('');
    setStatusFilter('ALL');
    setDateFilter('all');
    setCurrentPage(1);
  };

  const vatRate = businessSettings?.vatRate ?? 12;
  const hasVat = vatRate > 0;

  if (loading || !authorized) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-950">
        <div className="text-amber-400 text-lg">Loading order history...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gradient-to-br from-gray-50 to-gray-100 text-gray-900">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-xl border-b border-gray-200/50 px-6 py-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-linear-to-br from-amber-100 to-amber-200 rounded-xl flex items-center justify-center text-xl">
              <IconHistory size={20} />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Order History</h1>
              <p className="text-xs text-gray-500">
                {filteredOrders.length} order{filteredOrders.length !== 1 ? 's' : ''} found
                {orders.length > 0 && ` (showing ${Math.min(itemsPerPage, filteredOrders.length)} of ${filteredOrders.length})`}
              </p>
            </div>
          </div>
          <button
            onClick={fetchOrders}
            className="px-4 py-2 bg-gray-900 hover:bg-gray-800 rounded-xl text-sm font-medium text-white transition"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Filters */}
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-64">
            <label className="block text-sm font-medium text-gray-600 mb-1">Search</label>
            <input
              type="text"
              placeholder="Order # or customer name..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="PREPARING">Preparing</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Date Range</label>
            <select
              value={dateFilter}
              onChange={(e) => { setDateFilter(e.target.value as any); setCurrentPage(1); }}
              className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
              <option value="year">Last Year</option>
            </select>
          </div>

          {(searchTerm || statusFilter !== 'ALL' || dateFilter !== 'all') && (
            <button
              onClick={resetFilters}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 underline"
            >
              Clear Filters
            </button>
          )}
        </div>

        {/* Orders Table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">#</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Order #</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Customer</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Date</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Items</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600">Total</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-600">Status</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-600">Payment</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-600">Invoice</th>
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-gray-400">
                      No orders match your filters
                    </td>
                  </tr>
                ) : (
                  paginated.map((order) => {
                    const itemCount = order.items.reduce((sum, i) => sum + i.quantity, 0);
                    return (
                      <tr
                        key={order.id}
                        className="border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={() => { setSelectedOrder(order); setShowInvoice(true); }}
                      >
                        <td className="px-4 py-3 text-gray-400 text-xs">{order.id}</td>
                        <td className="px-4 py-3 font-mono font-bold text-gray-900">#{order.orderNumber.split('-').pop()}</td>
                        <td className="px-4 py-3 text-gray-900 font-medium">{order.customerName}</td>
                        <td className="px-4 py-3 text-gray-500 text-sm">
                          {new Date(order.createdAt).toLocaleDateString([], {
                            month: 'short', day: 'numeric', year: '2-digit',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{itemCount} item{itemCount !== 1 ? 's' : ''}</td>
                        <td className="px-4 py-3 text-right font-bold text-gray-900">₱{order.totalAmount.toFixed(2)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[order.status]}`}>
                            {STATUS_LABELS[order.status]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-sm text-gray-600">
                          {order.paymentMethod === 'CASH' ? '💵 Cash' :
                           order.paymentMethod === 'GCASH' ? '📱 GCash' :
                           order.paymentMethod === 'PAYMAYA' ? '📱 PayMaya' : order.paymentMethod}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-amber-600" title="View Invoice">🧾</span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t border-gray-200 text-sm">
              <span className="text-gray-600">
                Page {currentPage} of {totalPages}
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 rounded-lg bg-white border border-gray-200 text-gray-700 disabled:opacity-50 transition"
                >
                  ‹ Prev
                </button>
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 rounded-lg bg-white border border-gray-200 text-gray-700 disabled:opacity-50 transition"
                >
                  Next ›
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Invoice Modal */}
      {selectedOrder && showInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowInvoice(false)}>
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Invoice Header */}
            <div className="px-6 py-6 text-center border-b-2 border-dashed border-gray-200">
              <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600">Official Receipt</p>
              <h2 className="text-lg font-bold text-gray-900 mt-1">{businessSettings?.businessName || 'CaféOS Coffee Shop'}</h2>
              {businessSettings?.businessAddress && (
                <p className="text-[10px] text-gray-500 mt-1">{businessSettings.businessAddress}</p>
              )}
              {(businessSettings?.tin || businessSettings?.branchCode) && (
                <p className="text-[10px] text-gray-500 mt-0.5">
                  TIN: {businessSettings.tin || ''}{businessSettings.branchCode ? `-${businessSettings.branchCode}` : ''}
                </p>
              )}
              <p className="text-xs font-mono mt-2 text-gray-700">#{selectedOrder.orderNumber}</p>
              <button
                onClick={() => setShowInvoice(false)}
                className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 text-lg w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100"
              >
                ✕
              </button>
            </div>

            {/* Invoice Body */}
            <div className="px-6 py-4">
              {/* Transaction Info */}
              <div className="text-xs text-gray-500 space-y-1 border-b border-gray-200 pb-3 mb-3">
                <div className="flex justify-between">
                  <span>Date:</span>
                  <span className="text-gray-800">{new Date(selectedOrder.createdAt).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Customer:</span>
                  <span className="text-gray-800 font-medium">{selectedOrder.customerName}</span>
                </div>
                {selectedOrder.table && (
                  <div className="flex justify-between">
                    <span>Table:</span>
                    <span className="text-gray-800">{selectedOrder.table.name}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Type:</span>
                  <span className="text-gray-800 capitalize">{selectedOrder.orderType?.toLowerCase() || 'dine in'}</span>
                </div>
                {selectedOrder.deliveryAddress && (
                  <div className="flex justify-between">
                    <span>Delivery:</span>
                    <span className="text-gray-800">{selectedOrder.deliveryAddress}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Status:</span>
                  <span className={`font-medium ${STATUS_COLORS[selectedOrder.status]} px-2 py-0.5 rounded-full text-xs`}>
                    {STATUS_LABELS[selectedOrder.status]}
                  </span>
                </div>
              </div>

              {/* Items */}
              <div className="border-b border-gray-200 pb-3 mb-3">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Items</p>
                <div className="space-y-2">
                  {selectedOrder.items.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <div>
                        <p className="text-gray-900 font-medium">{item.product.name}</p>
                        <p className="text-gray-400 text-xs">{item.quantity} × ₱{item.unitPrice.toFixed(2)}</p>
                        {item.notes && <p className="text-gray-400 text-xs mt-1">Note: {item.notes}</p>}
                      </div>
                      <span className="text-gray-900 font-medium">₱{item.subtotal.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals */}
              <div className="space-y-1 text-sm border-b border-gray-200 pb-3 mb-3">
                <div className="flex justify-between">
                  <span className="text-gray-500">Subtotal:</span>
                  <span className="text-gray-800">₱{(hasVat ? selectedOrder.totalAmount / (1 + vatRate / 100) : selectedOrder.totalAmount).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">VAT ({vatRate}%):</span>
                  <span className="text-gray-800">₱{(hasVat ? selectedOrder.totalAmount - (selectedOrder.totalAmount / (1 + vatRate / 100)) : 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-lg border-t pt-2">
                  <span className="text-gray-900">TOTAL</span>
                  <span className="text-gray-900">₱{selectedOrder.totalAmount.toFixed(2)}</span>
                </div>
              </div>

              {/* Payment */}
              <div className="text-xs text-gray-500 mb-4">
                <div className="flex justify-between">
                  <span>Payment Method:</span>
                  <span className="text-gray-800">
                    {selectedOrder.paymentMethod === 'CASH' ? 'Cash' :
                     selectedOrder.paymentMethod === 'GCASH' ? 'GCash' :
                     selectedOrder.paymentMethod === 'PAYMAYA' ? 'PayMaya' :
                     selectedOrder.paymentMethod || 'Cash'}
                  </span>
                </div>
                {selectedOrder.notes && (
                  <div className="flex justify-between mt-1">
                    <span>Notes:</span>
                    <span className="text-gray-800">{selectedOrder.notes}</span>
                  </div>
                )}
              </div>

              {/* Print Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    const printWindow = window.open('', '_blank', 'width=350,height=600');
                    if (!printWindow) return;

                    const bs = businessSettings;
                    const invVatRate = bs?.vatRate ?? 12;
                    const invHasVat = invVatRate > 0;
                    const invSubtotal = invHasVat ? selectedOrder.totalAmount / (1 + invVatRate / 100) : selectedOrder.totalAmount;
                    const invVatAmount = invHasVat ? selectedOrder.totalAmount - invSubtotal : 0;

                    printWindow.document.write(`
                      <!DOCTYPE html>
                      <html>
                      <head>
                        <title>Receipt #${selectedOrder.orderNumber}</title>
                        <style>
                          @page { margin: 0; size: 80mm auto; }
                          @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
                          body { font-family: 'Courier New', monospace; width: 72mm; margin: 0 auto; padding: 5mm; font-size: 11px; line-height: 1.3; }
                          .header { text-align: center; border-bottom: 1px dashed #666; padding-bottom: 8px; margin-bottom: 8px; }
                          .header h2 { margin: 0; font-size: 14px; }
                          .header p { margin: 2px 0; font-size: 9px; color: #666; }
                          .items { border-bottom: 1px dashed #666; padding-bottom: 8px; margin-bottom: 8px; }
                          .item { display: flex; justify-content: space-between; margin: 3px 0; }
                          .totals { margin-bottom: 8px; }
                          .totals .row { display: flex; justify-content: space-between; }
                          .total-row { font-weight: bold; font-size: 14px; border-top: 1px dashed #666; padding-top: 5px; margin-top: 5px; }
                          .footer { text-align: center; font-size: 9px; color: #666; margin-top: 10px; }
                          .vat-breakdown { font-size: 8px; color: #888; border-top: 1px dashed #ccc; padding-top: 5px; margin-top: 8px; }
                        </style>
                      </head>
                      <body>
                        <div class="header">
                          <p style="font-weight:bold;color:#666;font-size:9px;">OFFICIAL RECEIPT</p>
                          <h2>${bs?.businessName || 'CaféOS Coffee Shop'}</h2>
                          ${bs?.businessAddress ? `<p>${bs?.businessAddress}</p>` : ''}
                          ${(bs?.tin || bs?.branchCode) ? `<p>TIN: ${bs?.tin || ''}${bs?.branchCode ? '-' + bs?.branchCode : ''}</p>` : ''}
                          <p>#${selectedOrder.orderNumber}</p>
                        </div>
                        <div class="items">
                          ${selectedOrder.items.map(item => `
                            <div class="item">
                              <span class="item-name">${item.quantity}x ${item.product.name}</span>
                              <span>₱${item.subtotal.toFixed(2)}</span>
                            </div>
                          `).join('')}
                        </div>
                        <div class="totals">
                          <div class="row"><span>Subtotal:</span><span>₱${invSubtotal.toFixed(2)}</span></div>
                          <div class="row"><span>VAT (${invVatRate}%):</span><span>₱${invVatAmount.toFixed(2)}</span></div>
                          <div class="row total-row"><span>TOTAL:</span><span>₱${selectedOrder.totalAmount.toFixed(2)}</span></div>
                        </div>
                        <div class="vat-breakdown">
                          <strong>VAT Breakdown:</strong><br/>
                          Total Sales: ₱${selectedOrder.totalAmount.toFixed(2)}<br/>
                          VATable: ₱${invSubtotal.toFixed(2)}<br/>
                          VAT: ₱${invVatAmount.toFixed(2)}
                        </div>
                        <div class="footer">
                          ${bs?.footerMessage || 'Thank you for your visit!'}
                        </div>
                      </body>
                      </html>
                    `);
                    printWindow.document.close();
                    printWindow.focus();
                    setTimeout(() => { printWindow.print(); printWindow.close(); }, 250);
                  }}
                  className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-semibold text-sm rounded-xl transition flex items-center justify-center gap-1.5"
                >
                  🖨️ Thermal Print
                </button>
                <button
                  onClick={() => window.print()}
                  className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 text-white font-semibold text-sm rounded-xl transition flex items-center justify-center gap-1.5"
                >
                  📄 A4 / Plain
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
