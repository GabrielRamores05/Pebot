'use client';

import { useState, useEffect } from 'react';
import { fetchJson, userMessage } from '@/lib/fetch-json';
import type { StaffMember } from '../shared';

// ─── REVIEWS ─────────────────────────────────────────────────────────────────
export function ReviewsTab() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [form, setForm] = useState({ userId: '', period: '', rating: '3', strengths: '', improvements: '', goals: '' });
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const [s, r] = await Promise.all([fetchJson<StaffMember[]>('/api/staff'), fetchJson<Record<string, unknown>[]>('/api/performance-reviews')]);
      setStaff(s); setReviews(r); setError('');
    } catch (e) {
      console.error('Failed to load performance reviews:', e);
      setError(userMessage(e, 'Could not load reviews. Try again.'));
    }
  };
  useEffect(() => { load(); }, []);

  async function submit() {
    try {
      await fetchJson('/api/performance-reviews', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, userId: Number(form.userId), rating: Number(form.rating) }) });
      setForm({ userId: '', period: '', rating: '3', strengths: '', improvements: '', goals: '' }); await load();
    } catch (e) {
      console.error('Failed to submit performance review:', e);
      setError(userMessage(e, 'Could not submit the review. Try again.'));
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-base font-bold">Reviews</h2>
      {error && <div className="rounded-xl bg-danger-bg px-4 py-3 text-sm text-danger">{error}</div>}
      <div className="c-card p-5 space-y-3">
        <p className="text-sm font-semibold text-ink">New review</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <select value={form.userId} onChange={e => setForm({ ...form, userId: e.target.value })} className="h-10 rounded-xl border border-hair bg-card px-3 text-sm outline-none focus:border-accent"><option value="">Staff</option>{staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          <input placeholder="Period (e.g. Q3 2026)" value={form.period} onChange={e => setForm({ ...form, period: e.target.value })} className="h-10 rounded-xl border border-hair bg-card px-3 text-sm outline-none focus:border-accent" />
          <select value={form.rating} onChange={e => setForm({ ...form, rating: e.target.value })} className="h-10 rounded-xl border border-hair bg-card px-3 text-sm outline-none focus:border-accent">{[1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}</select>
          <input placeholder="Strengths" value={form.strengths} onChange={e => setForm({ ...form, strengths: e.target.value })} className="h-10 rounded-xl border border-hair bg-card px-3 text-sm outline-none focus:border-accent" />
          <input placeholder="Improvements" value={form.improvements} onChange={e => setForm({ ...form, improvements: e.target.value })} className="h-10 rounded-xl border border-hair bg-card px-3 text-sm outline-none focus:border-accent" />
          <input placeholder="Goals" value={form.goals} onChange={e => setForm({ ...form, goals: e.target.value })} className="h-10 rounded-xl border border-hair bg-card px-3 text-sm outline-none focus:border-accent" />
        </div>
        <button onClick={submit} className="c-btn c-btn--primary">Submit review</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {reviews.map(r => (
          <div key={r.id} className="c-card p-4">
            <div className="flex items-center justify-between">
              <p className="font-medium text-ink">{r.user?.name}</p>
              <span className="rounded-full bg-tile-sand px-2 py-0.5 text-xs font-bold text-warn tabular-nums">{r.rating} / 5</span>
            </div>
            <p className="text-xs text-faint">{r.period} · by {r.reviewer?.name}</p>
            {r.strengths && <p className="text-xs mt-1"><span className="font-medium">Strengths:</span> {r.strengths}</p>}
            {r.improvements && <p className="text-xs"><span className="font-medium">Improve:</span> {r.improvements}</p>}
            {r.goals && <p className="text-xs"><span className="font-medium">Goals:</span> {r.goals}</p>}
          </div>
        ))}
        {reviews.length === 0 && <p className="text-faint text-sm">No reviews yet.</p>}
      </div>
    </div>
  );
}
