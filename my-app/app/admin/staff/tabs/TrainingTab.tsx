'use client';

import { useState, useEffect } from 'react';
import { fetchJson, userMessage } from '@/lib/fetch-json';
import { Badge } from '../shared';
import type { StaffMember } from '../shared';

// ─── TRAINING ────────────────────────────────────────────────────────────────
export function TrainingTab() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const [s, c] = await Promise.all([fetchJson<StaffMember[]>('/api/staff'), fetchJson<Record<string, unknown>[]>('/api/training')]);
      setStaff(s); setCourses(c); setError('');
    } catch (e) {
      console.error('Failed to load training:', e);
      setError(userMessage(e, 'Could not load training. Try again.'));
    }
  };
  useEffect(() => { load(); }, []);

  async function addCourse() {
    if (!newName.trim()) return;
    try {
      await fetchJson('/api/training', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newName }) });
      setNewName(''); await load();
    } catch (e) {
      console.error('Failed to create training course:', e);
      setError(userMessage(e, 'Could not create the course. Try again.'));
    }
  }
  async function enroll(courseId: number, userId: number) {
    try {
      await fetchJson(`/api/training/${courseId}/enroll`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) });
      await load();
    } catch (e) {
      console.error('Failed to enroll staff in training:', e);
      setError(userMessage(e, 'Could not enroll staff. Try again.'));
    }
  }
  async function complete(courseId: number, userId: number) {
    try {
      await fetchJson(`/api/training/${courseId}/enroll`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, status: 'COMPLETED', completedAt: new Date().toISOString() }) });
      await load();
    } catch (e) {
      console.error('Failed to complete training:', e);
      setError(userMessage(e, 'Could not mark training complete. Try again.'));
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-base font-bold">Training</h2>
      {error && <div className="rounded-xl bg-danger-bg px-4 py-3 text-sm text-danger">{error}</div>}
      <div className="flex gap-2">
        <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="New course name…" className="rounded-lg border border-hair px-3 py-1.5 text-sm flex-1 max-w-xs" />
        <button onClick={addCourse} className="px-4 py-1.5 rounded-lg bg-accent text-white text-sm font-semibold">Add course</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {courses.map(c => (
          <div key={c.id} className="c-card p-4">
            <p className="font-medium text-ink">{c.name}</p>
            <p className="text-xs text-faint">{c.enrollments?.length ?? 0} enrolled</p>
            <details className="mt-2">
              <summary className="text-xs text-accent-text cursor-pointer">Manage enrollments</summary>
              <div className="mt-2 space-y-1">
                {staff.map(s => {
                  const en = c.enrollments?.find((e: any) => e.userId === s.id);
                  return (
                    <div key={s.id} className="flex items-center justify-between text-xs">
                      <span>{s.name}</span>
                      {!en
                        ? <button onClick={() => enroll(c.id, s.id)} className="text-blue-600 hover:underline">Enroll</button>
                        : en.status === 'COMPLETED'
                          ? <Badge color="green">Completed</Badge>
                          : <button onClick={() => complete(c.id, s.id)} className="text-green-600 hover:underline">Mark done</button>}
                    </div>
                  );
                })}
              </div>
            </details>
          </div>
        ))}
        {courses.length === 0 && <p className="text-faint text-sm">No courses yet.</p>}
      </div>
    </div>
  );
}
