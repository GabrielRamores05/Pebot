'use client';

import { useCallback, useEffect, useState } from 'react';

interface Status {
  state: 'no-agreement' | 'agreement-accepted' | 'active';
  licenseNo: number | null;
  activatedAt: string | null;
  agreementVersion: string;
  local: boolean;
  machineCode?: string | null;
}

/** Settings → License: status, Machine Code (main PC only), agreement, move to a new PC. */
export default function LicensePanel() {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [deactivationCode, setDeactivationCode] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/license/status', { cache: 'no-store' });
      if (!r.ok) throw new Error();
      setStatus((await r.json()) as Status);
    } catch {
      setError("Couldn't load the license status.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function deactivate() {
    setBusy(true);
    setError('');
    try {
      const r = await fetch('/api/license/deactivate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setDeactivationCode(d.deactivationCode as string);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'Could not move the license. Try again.');
    } finally {
      setBusy(false);
    }
  }

  if (deactivationCode) {
    return (
      <section className="rounded-card border border-hair bg-card p-6">
        <h2 className="text-lg font-semibold text-ink">License removed from this computer</h2>
        <p className="mt-2 text-sm text-muted">
          Send this deactivation code to Pebot support, together with the Machine Code shown on your new computer.
          Your restaurant data on this computer has not been changed.
        </p>
        <p className="mt-4 select-all rounded-field border border-hair bg-panel px-4 py-3 font-mono text-lg font-semibold tracking-wider text-ink">
          {deactivationCode}
        </p>
        <p className="mt-3 text-xs text-faint">Write it down or take a photo before closing this page.</p>
        <a href="/activate" className="mt-5 inline-flex h-10 items-center rounded-field border border-hair-strong px-4 text-sm font-medium text-ink hover:bg-panel">
          Go to activation
        </a>
      </section>
    );
  }

  if (!status) {
    return <p className="text-sm text-muted">{error || 'Loading license…'}</p>;
  }

  const rows: [string, string][] = [
    ['Status', status.state === 'active' ? 'Active' : 'Not activated'],
    ['License number', status.licenseNo ? `#${status.licenseNo}` : '—'],
    ['Activated on', status.activatedAt ? new Date(status.activatedAt).toLocaleDateString('en-PH', { dateStyle: 'long' }) : '—'],
    ['Covers', 'This location: this computer plus all tablets, terminals and phones on its network'],
  ];
  if (status.local && status.machineCode) rows.push(['Machine Code', status.machineCode]);

  return (
    <div className="space-y-4">
      <section className="rounded-card border border-hair bg-card p-6">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-ink">Pebot license</h2>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              status.state === 'active' ? 'bg-good-bg text-good' : 'bg-warn-bg text-warn'
            }`}
          >
            {status.state === 'active' ? 'Active' : 'Not activated'}
          </span>
        </div>
        <dl className="mt-4 divide-y divide-hair text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="flex flex-col gap-0.5 py-2.5 sm:flex-row sm:gap-6">
              <dt className="w-40 shrink-0 text-muted">{k}</dt>
              <dd className={k === 'Machine Code' ? 'font-mono font-semibold tracking-wider text-ink' : 'text-ink'}>{v}</dd>
            </div>
          ))}
        </dl>
        <a href="/legal/agreement" className="mt-4 inline-block text-sm font-medium text-accent-text hover:underline">
          Read the license agreement (v{status.agreementVersion})
        </a>
      </section>

      {status.state === 'active' && (
        <section className="rounded-card border border-hair bg-card p-6">
          <h2 className="text-base font-semibold text-ink">Move to a new computer</h2>
          <p className="mt-1 text-sm text-muted">
            Use this before replacing or reformatting this computer. Pebot will stop working here and give you a
            deactivation code for your new key. Free up to 3 times a year. Your data is not deleted. Make a backup in
            Account &amp; Data first so you can restore it on the new computer.
          </p>
          {!status.local ? (
            <p className="mt-4 text-sm text-faint">This can only be done on the main Pebot computer.</p>
          ) : !confirming ? (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="mt-4 inline-flex h-10 items-center rounded-field border border-hair-strong px-4 text-sm font-medium text-ink hover:bg-panel"
            >
              Move to a new computer…
            </button>
          ) : (
            <div className="mt-4 rounded-field border border-danger/30 bg-danger-bg p-4">
              <p className="text-sm text-danger">
                Pebot will stop working on this computer immediately, on every device. Type <strong>MOVE</strong> to
                confirm.
              </p>
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                className="mt-3 h-10 w-40 rounded-field border border-hair-strong bg-card px-3 font-mono text-sm uppercase text-ink focus:outline-none"
                aria-label="Type MOVE to confirm"
              />
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={typed.trim().toUpperCase() !== 'MOVE' || busy}
                  onClick={deactivate}
                  className="inline-flex h-10 items-center rounded-field bg-danger px-4 text-sm font-semibold text-white disabled:opacity-40"
                >
                  {busy ? 'Removing…' : 'Remove license from this computer'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirming(false);
                    setTyped('');
                  }}
                  className="inline-flex h-10 items-center rounded-field px-4 text-sm font-medium text-muted hover:text-ink"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        </section>
      )}
    </div>
  );
}
