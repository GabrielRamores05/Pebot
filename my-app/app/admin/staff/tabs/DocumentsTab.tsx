'use client';

import { useState, useEffect } from 'react';
import { fetchJson, userMessage } from '@/lib/fetch-json';
import { Badge } from '../shared';
import type { StaffMember } from '../shared';

// ─── DOCUMENTS ───────────────────────────────────────────────────────────────
export function DocumentsTab() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [selectedId, setSelectedId] = useState<number | ''>('');
  const [docs, setDocs] = useState<any[]>([]);
  const [form, setForm] = useState({ name: '', type: 'CONTRACT', fileUrl: '', expiryDate: '', notes: '' });
  const [error, setError] = useState('');

  const load = async () => {
    try { setStaff(await fetchJson<StaffMember[]>('/api/staff')); setError(''); }
    catch (e) { console.error('Failed to load staff for documents:', e); setError(userMessage(e, 'Could not load staff. Try again.')); }
  };
  async function loadDocs(id: number) {
    try { setDocs(await fetchJson<Record<string, unknown>[]>(`/api/staff/${id}/documents`)); setError(''); }
    catch (e) { console.error('Failed to load staff documents:', e); setError(userMessage(e, 'Could not load documents. Try again.')); }
  }
  useEffect(() => { load(); }, []);
  useEffect(() => { if (selectedId) loadDocs(Number(selectedId)); }, [selectedId]);

  async function submit() {
    if (!selectedId) return;
    try {
      await fetchJson(`/api/staff/${selectedId}/documents`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      setForm({ name: '', type: 'CONTRACT', fileUrl: '', expiryDate: '', notes: '' }); await loadDocs(Number(selectedId));
    } catch (e) {
      console.error('Failed to add document:', e);
      setError(userMessage(e, 'Could not add the document. Try again.'));
    }
  }
  async function remove(id: number) {
    try {
      await fetchJson(`/api/staff/documents/${id}`, { method: 'DELETE' });
      if (selectedId) await loadDocs(Number(selectedId));
    } catch (e) {
      console.error('Failed to delete document:', e);
      setError(userMessage(e, 'Could not delete the document. Try again.'));
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-base font-bold">Documents</h2>
      {error && <div className="rounded-xl bg-danger-bg px-4 py-3 text-sm text-danger">{error}</div>}
      <select value={selectedId} onChange={e => setSelectedId(e.target.value ? Number(e.target.value) : '')} className="rounded-lg border border-hair px-3 py-2 text-sm max-w-xs">
        <option value="">Select staff member…</option>
        {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>

      {selectedId && (
        <div className="space-y-3">
          <div className="rounded-2xl border border-hair bg-card p-4 shadow-sm space-y-2">
            <p className="text-sm font-semibold text-ink">Add document</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <input placeholder="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="h-10 rounded-xl border border-hair bg-card px-3 text-sm outline-none focus:border-accent" />
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="h-10 rounded-xl border border-hair bg-card px-3 text-sm outline-none focus:border-accent">
                <option value="CONTRACT">Contract</option><option value="NDA">NDA</option><option value="CERTIFICATION">Certification</option><option value="OTHER">Other</option>
              </select>
              <input placeholder="File URL" value={form.fileUrl} onChange={e => setForm({ ...form, fileUrl: e.target.value })} className="h-10 rounded-xl border border-hair bg-card px-3 text-sm outline-none focus:border-accent" />
              <input type="date" value={form.expiryDate} onChange={e => setForm({ ...form, expiryDate: e.target.value })} className="h-10 rounded-xl border border-hair bg-card px-3 text-sm outline-none focus:border-accent" />
            </div>
            <button onClick={submit} className="c-btn c-btn--primary">Add</button>
          </div>

          <div className="space-y-2">
            {docs.map(d => (
              <div key={d.id} className="flex items-center justify-between rounded-xl border border-hair bg-card p-3">
                <div>
                  <p className="font-medium text-ink text-sm">{d.name} <Badge color="purple">{d.type}</Badge></p>
                  {d.expiryDate && <p className="text-xs text-faint">Expires {d.expiryDate.slice(0,10)}</p>}
                </div>
                <button onClick={() => remove(d.id)} className="text-xs text-red-600 hover:underline">Delete</button>
              </div>
            ))}
            {docs.length === 0 && <p className="text-faint text-sm">No documents.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
