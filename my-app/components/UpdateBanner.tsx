'use client';

import { useEffect, useState } from 'react';
import type { UpdateInfo } from '@/lib/update-check';

const DISMISS_KEY = 'pebot-update-dismissed';

// Slim bar at the top of the admin screens when a newer Pebot is out (owner only).
export default function UpdateBanner({ isAdmin }: { isAdmin: boolean }) {
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [hidden, setHidden] = useState(false);
  const [notes, setNotes] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    const load = () => fetch('/api/system/update').then((r) => (r.ok ? r.json() : null)).then((d) => d && setInfo(d)).catch(() => {});
    load();
    const t = setInterval(load, 60 * 60 * 1000);
    return () => clearInterval(t);
  }, [isAdmin]);

  useEffect(() => {
    try { if (info?.latest && localStorage.getItem(DISMISS_KEY) === info.latest) setHidden(true); } catch { /* storage blocked */ }
  }, [info?.latest]);

  if (!info?.available || hidden) return null;
  return (
    <div className="border-b border-hair bg-accent-soft px-4 py-2 text-sm text-accent-text">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-semibold">Pebot {info.latest} is available</span>
        <span className="text-xs opacity-80">You have {info.current}. Your data stays when you install it.</span>
        <span className="ml-auto flex items-center gap-2">
          {info.notes && <button onClick={() => setNotes(!notes)} className="text-xs font-semibold underline">What&apos;s new</button>}
          {info.url && <a href={info.url} target="_blank" rel="noreferrer" className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-white">Download</a>}
          <button
            onClick={() => { setHidden(true); try { localStorage.setItem(DISMISS_KEY, info.latest ?? ''); } catch { /* storage blocked */ } }}
            className="text-xs opacity-70 hover:opacity-100" aria-label="Hide until the next version">Later</button>
        </span>
      </div>
      {notes && info.notes && <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-card p-3 font-sans text-xs text-ink">{info.notes}</pre>}
    </div>
  );
}
