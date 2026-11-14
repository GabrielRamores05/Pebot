'use client';

import { useEffect, useState } from 'react';
import { fetchJson, userMessage } from '@/lib/fetch-json';

interface BackupView {
  extraFolder: string | null;
  keep: number;
  lastAt: string | null;
  lastOk: string | null;
  lastError: string | null;
  lastFiles: string[];
  defaultFolder: string;
}

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }) : 'Never');

// Spec 022: automatic daily copy of the data to this PC and, ideally, a USB stick.
export default function AutoBackupPanel() {
  const [v, setV] = useState<BackupView | null>(null);
  const [folder, setFolder] = useState('');
  const [keep, setKeep] = useState('14');
  const [msg, setMsg] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const show = (d: BackupView) => { setV(d); setFolder(d.extraFolder ?? ''); setKeep(String(d.keep)); };
  useEffect(() => { fetchJson<BackupView>('/api/backup/auto').then(show).catch(() => setMsg({ tone: 'bad', text: 'Could not read the backup settings.' })); }, []);

  async function save() {
    setBusy(true); setMsg(null);
    try {
      show(await fetchJson<BackupView>('/api/backup/auto', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ extraFolder: folder.trim() || null, keep: Number(keep) }) }));
      setMsg({ tone: 'good', text: 'Saved.' });
    } catch (e) { setMsg({ tone: 'bad', text: userMessage(e, 'Could not save.') }); } finally { setBusy(false); }
  }

  async function runNow() {
    setBusy(true); setMsg(null);
    try {
      const d = await fetchJson<BackupView>('/api/backup/auto', { method: 'POST' });
      show(d);
      setMsg(d.lastError ? { tone: 'bad', text: d.lastError } : { tone: 'good', text: `Backed up to ${d.lastFiles.length} place${d.lastFiles.length === 1 ? '' : 's'}.` });
    } catch (e) { setMsg({ tone: 'bad', text: userMessage(e, 'Backup failed.') }); } finally { setBusy(false); }
  }

  const stale = v && (!v.lastOk || Date.now() - Date.parse(v.lastOk) > 2 * 24 * 3600 * 1000);
  return (
    <div className="c-card space-y-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-ink">Automatic daily backup</h3>
          <p className="text-xs text-faint">Pebot copies your data once a day while it runs. Add a USB stick or second drive so a broken PC does not take your records with it.</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${stale ? 'bg-warn-bg text-warn' : 'bg-good-bg text-good'}`}>
          Last backup: {when(v?.lastOk ?? null)}
        </span>
      </div>
      {v && <p className="text-xs text-muted">Always saved on this PC in <code className="rounded bg-panel px-1">{v.defaultFolder}</code></p>}
      <div className="grid gap-2 sm:grid-cols-[1fr_120px_auto_auto] sm:items-end">
        <label className="text-xs font-semibold text-muted">Also copy to (USB or other drive)
          <input value={folder} onChange={(e) => setFolder(e.target.value)} placeholder="E:\PebotBackups"
            className="mt-1 block h-10 w-full rounded-xl border border-hair bg-card px-3 text-sm outline-none focus:border-accent" />
        </label>
        <label className="text-xs font-semibold text-muted">Keep copies
          <input type="number" min={1} max={365} value={keep} onChange={(e) => setKeep(e.target.value)}
            className="mt-1 block h-10 w-full rounded-xl border border-hair bg-card px-3 text-sm outline-none focus:border-accent" />
        </label>
        <button onClick={save} disabled={busy} className="c-btn c-btn--ghost disabled:opacity-50">Save</button>
        <button onClick={runNow} disabled={busy} className="c-btn c-btn--primary disabled:opacity-50">{busy ? 'Working…' : 'Back up now'}</button>
      </div>
      {v?.lastError && !msg && <p className="text-sm text-danger">Last try ({when(v.lastAt)}): {v.lastError}</p>}
      {msg && <p className={`text-sm ${msg.tone === 'good' ? 'text-good' : 'text-danger'}`}>{msg.text}</p>}
      <p className="text-xs text-faint">To restore, use Restore Data above and pick a .db file from the backup folder.</p>
    </div>
  );
}
