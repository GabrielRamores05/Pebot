'use client';

import { useState, useEffect } from 'react';

interface AuditLog {
  id: number;
  userId: number | null;
  user: { id: number; name: string; email: string; role: string } | null;
  action: string;
  resource: string;
  resourceId: number | null;
  details: string | null;
  ip: string | null;
  createdAt: string;
}

interface AuditResponse {
  logs: AuditLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const RESOURCE_OPTIONS = ['all', 'order', 'loyalty_card', 'loyalty_voucher', 'business_settings', 'inventory', 'ingredient', 'supplier', 'product'];
const ACTION_OPTIONS = ['all', 'ORDER_CREATE', 'ORDER_CANCEL', 'LOYALTY_POINTS_AWARD', 'LOYALTY_REWARD_EARNED', 'LOYALTY_POINTS_ADD', 'LOYALTY_CARD_RENAME', 'LOYALTY_CARD_DELETE', 'SETTINGS_UPDATE'];

export default function AuditLogsPage() {
  const [data, setData] = useState<AuditResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    resource: '',
    action: '',
    page: 1,
  });

  async function fetchLogs() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.resource && filters.resource !== 'all') params.set('resource', filters.resource);
      if (filters.action && filters.action !== 'all') params.set('action', filters.action);
      params.set('page', String(filters.page));
      params.set('limit', '50');

      const res = await fetch(`/api/audit-logs?${params}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.error || 'Failed to fetch audit logs');
        return;
      }
      const json: AuditResponse = await res.json();
      setData(json);
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchLogs();
  }, [filters]);

  const parsedDetails = (log: AuditLog) => {
    if (!log.details) return null;
    try {
      return JSON.parse(log.details);
    } catch {
      return { raw: log.details };
    }
  };

  const actionColors: Record<string, string> = {
    ORDER_CREATE: 'bg-blue-100 text-blue-800',
    ORDER_CANCEL: 'bg-red-100 text-red-800',
    LOYALTY_POINTS_AWARD: 'bg-purple-100 text-purple-800',
    LOYALTY_REWARD_EARNED: 'bg-yellow-100 text-yellow-800',
    LOYALTY_POINTS_ADD: 'bg-green-100 text-green-800',
    LOYALTY_CARD_RENAME: 'bg-pink-100 text-pink-800',
    LOYALTY_CARD_DELETE: 'bg-gray-100 text-gray-800',
    SETTINGS_UPDATE: 'bg-orange-100 text-orange-800',
  };

  return (
    <div className="h-screen flex flex-col bg-page">
      <div className="px-6 pb-2 pt-6">
        <h1 className="c-title">Audit Logs</h1>
        <p className="mt-1.5 text-sm text-muted">Track all actions taken in the system</p>
      </div>

      <div className="p-6 border-b border-gray-200 bg-white">
        <div className="flex gap-4 items-end flex-wrap">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Resource</label>
            <select
              value={filters.resource}
              onChange={(e) => setFilters({ ...filters, resource: e.target.value, page: 1 })}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-400 outline-none"
            >
              {RESOURCE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt === 'all' ? 'All Resources' : opt.replace('_', ' ')}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Action</label>
            <select
              value={filters.action}
              onChange={(e) => setFilters({ ...filters, action: e.target.value, page: 1 })}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-400 outline-none"
            >
              {ACTION_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt === 'all' ? 'All Actions' : opt}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={() => setFilters({ resource: '', action: '', page: 1 })}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            Clear Filters
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading audit logs...</div>
        ) : error ? (
          <div className="p-8 text-center text-red-500">{error}</div>
        ) : !data || data.logs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No audit logs found.</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Time</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Action</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Resource</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">User</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Details</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.logs.map((log) => {
                const details = parsedDetails(log);
                return (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 text-sm text-gray-600 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${actionColors[log.action] || 'bg-gray-100 text-gray-800'}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{log.resource}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {log.user ? <span className="font-medium">{log.user.name}</span> : <span className="text-gray-400">System</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {details && typeof details === 'object' ? (
                        <pre className="max-w-xs overflow-x-auto text-xs">{JSON.stringify(details, null, 2)}</pre>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{log.ip || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {data && (
        <div className="border-t border-gray-200 bg-white px-6 py-3 flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Showing {((data.page - 1) * data.limit) + 1}-{Math.min(data.page * data.limit, data.total)} of {data.total} entries
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
              disabled={filters.page <= 1 || loading}
              className="px-3 py-1 border border-gray-200 rounded text-sm disabled:opacity-50"
            >
              Previous
            </button>
            <span className="px-3 py-1 text-sm text-gray-600">
              Page {data.page} of {data.totalPages}
            </span>
            <button
              onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
              disabled={filters.page >= data.totalPages || loading}
              className="px-3 py-1 border border-gray-200 rounded text-sm disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
