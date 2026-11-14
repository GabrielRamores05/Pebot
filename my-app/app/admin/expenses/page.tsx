'use client';

import { useState, useEffect, useCallback } from 'react';
import { downloadCsv } from '@/lib/csv';
import { fetchJson, userMessage } from '@/lib/fetch-json';

interface Category {
  id: number;
  name: string;
  description: string | null;
  _count: { expenses: number };
}

interface Supplier {
  id: number;
  name: string;
}

interface Expense {
  id: number;
  amount: number;
  description: string | null;
  expenseDate: string;
  createdAt: string;
  category: { id: number; name: string };
  supplier: { id: number; name: string } | null;
  user: { name: string; email: string; role: string };
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    categoryId: '',
    supplierId: '',
    amount: '',
    description: '',
    expenseDate: '',
  });

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    try {
      setExpenses(await fetchJson<Expense[]>('/api/expenses'));
      setError(null);
    } catch (e) {
      console.error('Failed to fetch expenses:', e);
      setError(userMessage(e, 'Could not load expenses. Try again.'));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      setCategories(await fetchJson<Category[]>('/api/expense-categories'));
    } catch (e) {
      console.error('Failed to fetch categories:', e);
      setError(userMessage(e, 'Could not load expense categories. Try again.'));
    }
  }, []);

  const fetchSuppliers = useCallback(async () => {
    try {
      setSuppliers(await fetchJson<Supplier[]>('/api/suppliers'));
    } catch (e) {
      console.error('Failed to fetch suppliers:', e);
      setError(userMessage(e, 'Could not load suppliers. Try again.'));
    }
  }, []);

  useEffect(() => {
    fetchExpenses();
    fetchCategories();
    fetchSuppliers();
  }, [fetchExpenses, fetchCategories, fetchSuppliers]);

  const totalAmount = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.categoryId || !form.amount) return;

    setSaving(true);
    setError(null);
    try {
      const payload = {
        categoryId: parseInt(form.categoryId),
        supplierId: form.supplierId ? parseInt(form.supplierId) : null,
        amount: parseFloat(form.amount),
        description: form.description || null,
        expenseDate: form.expenseDate || undefined,
      };

      if (editing) {
        await fetchJson(`/api/expenses?id=${editing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        await fetchJson('/api/expenses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      await fetchExpenses();
      setShowModal(false);
      setEditing(null);
      setForm({ categoryId: '', supplierId: '', amount: '', description: '', expenseDate: '' });
    } catch (e) {
      console.error('Failed to save expense:', e);
      setError(userMessage(e, 'Could not save the expense. Try again.'));
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (expense: Expense) => {
    setEditing(expense);
    setForm({
      categoryId: String(expense.category.id),
      supplierId: expense.supplier?.id ? String(expense.supplier.id) : '',
      amount: String(expense.amount),
      description: expense.description || '',
      expenseDate: new Date(expense.expenseDate).toISOString().slice(0, 10),
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this expense?')) return;
    try {
      await fetchJson(`/api/expenses?id=${id}`, { method: 'DELETE' });
      setExpenses((prev) => prev.filter((e) => e.id !== id));
    } catch (e) {
      console.error('Failed to delete expense:', e);
      setError(userMessage(e, 'Could not delete the expense. Try again.'));
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-page min-h-screen">
      <header className="px-6 pb-2 pt-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="c-title">Expenses</h1>
              <p className="mt-1.5 text-sm text-muted">Track your restaurant expenses</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">Total: ₱{totalAmount.toFixed(2)}</span>
            <button
              onClick={() => downloadCsv('expenses', expenses, [
                { label: 'Date', value: (e) => new Date(e.expenseDate).toLocaleDateString('en-PH') },
                { label: 'Category', value: (e) => e.category.name },
                { label: 'Description', value: (e) => e.description ?? '' },
                { label: 'Supplier', value: (e) => e.supplier?.name ?? '' },
                { label: 'Amount (PHP)', value: (e) => e.amount.toFixed(2) },
                { label: 'Recorded by', value: (e) => e.user.name },
              ])}
              disabled={expenses.length === 0}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
            >
              Export CSV
            </button>
            <button
              onClick={() => {
                setEditing(null);
                setForm({ categoryId: '', supplierId: '', amount: '', description: '', expenseDate: '' });
                setShowModal(true);
              }}
              className="bg-black hover:bg-gray-800 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
            >
              + Add Expense
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 space-y-6">
        {error && (
          <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <span>{error}</span>
            <button type="button" onClick={() => setError(null)} className="ml-4 font-medium hover:underline">Dismiss</button>
          </div>
        )}
        {loading ? (
          <div className="text-center py-16 text-gray-400">Loading expenses...</div>
        ) : expenses.length === 0 ? (
          <div className="bg-white/60 backdrop-blur-xl rounded-3xl border border-gray-200/50 p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              </div>
            <p className="text-gray-500 font-medium">No expenses found</p>
            <button
              onClick={() => {
                setEditing(null);
                setForm({ categoryId: '', supplierId: '', amount: '', description: '', expenseDate: '' });
                setShowModal(true);
              }}
              className="mt-3 bg-black text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors"
            >
              Add First Expense
            </button>
          </div>
        ) : (
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl overflow-hidden border border-gray-200/50 shadow-sm">
            <table className="w-full">
              <thead className="bg-gray-50/80">
                <tr>
                  <th className="text-left px-5 py-4 text-gray-500 text-xs font-semibold uppercase tracking-wide">Date</th>
                  <th className="text-left px-5 py-4 text-gray-500 text-xs font-semibold uppercase tracking-wide">Category</th>
                  <th className="text-left px-5 py-4 text-gray-500 text-xs font-semibold uppercase tracking-wide">Supplier</th>
                  <th className="text-left px-5 py-4 text-gray-500 text-xs font-semibold uppercase tracking-wide">Description</th>
                  <th className="text-right px-5 py-4 text-gray-500 text-xs font-semibold uppercase tracking-wide">Amount</th>
                  <th className="text-right px-5 py-4 text-gray-500 text-xs font-semibold uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {expenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-4 text-sm text-gray-500">
                      {new Date(expense.expenseDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="px-5 py-4">
                      <span className="px-2.5 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-semibold">
                        {expense.category.name}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-600">
                      {expense.supplier?.name || '—'}
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-700 max-w-xs truncate">
                      {expense.description || '—'}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span className="text-gray-900 font-semibold">₱{Number(expense.amount).toFixed(2)}</span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEdit(expense)}
                          className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded-xl text-xs font-medium hover:bg-gray-200 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(expense.id)}
                          className="text-red-600 hover:text-red-800 px-3 py-1.5 rounded-xl text-xs font-medium hover:bg-red-50 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Add/Edit Expense Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {editing ? 'Edit Expense' : 'Add New Expense'}
            </h3>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Category *</label>
                  <select
                    name="categoryId"
                    value={form.categoryId}
                    onChange={(e) => setForm((prev) => ({ ...prev, categoryId: e.target.value }))}
                    required
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black"
                  >
                    <option value="">Select category</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Supplier</label>
                  <select
                    name="supplierId"
                    value={form.supplierId}
                    onChange={(e) => setForm((prev) => ({ ...prev, supplierId: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black"
                  >
                    <option value="">No supplier</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Amount (₱) *</label>
                  <input
                    name="amount"
                    type="number"
                    step="0.01"
                    value={form.amount}
                    onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
                    required
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
                  <textarea
                    name="description"
                    value={form.description}
                    onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Date *</label>
                  <input
                    name="expenseDate"
                    type="date"
                    value={form.expenseDate}
                    onChange={(e) => setForm((prev) => ({ ...prev, expenseDate: e.target.value }))}
                    required
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 bg-gray-100 text-gray-700 font-semibold py-3 rounded-xl hover:bg-gray-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-black hover:bg-gray-800 text-white font-semibold py-3 rounded-xl transition disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editing ? 'Save Changes' : 'Add Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
