'use client';

import { useEffect, useState } from 'react';
import type { UpdateInfo } from '@/lib/update-check';

export default function UpdatesCard() {
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const load = (force = false) => {
    setBusy(true);
    fetch(`/api/system/update${force ? '?force=1' : ''}`).then((r) => (r.ok ? r.json() : null)).then((d) => d && setInfo(d)).catch(() => {}).finally(() => setBusy(false));
  };
  useEffect(() => { load(); }, []);

  return (
    <div className="c-card space-y-2 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-ink">Updates</h3>
          <p className="text-xs text-faint">Pebot checks for a new version when this PC is online. Installing an update keeps your data.</p>
        </div>
        <button onClick={() => load(true)} disabled={busy} className="c-btn c-btn--ghost text-sm disabled:opacity-50">{busy ? 'Checking…' : 'Check now'}</button>
      </div>
      {info && (
        <p className="text-sm text-muted">
          This PC has Pebot <b className="text-ink">{info.current}</b>.{' '}
          {info.available ? (
            <>Version <b className="text-accent-text">{info.latest}</b> is out.{' '}
              {info.url && <a href={info.url} target="_blank" rel="noreferrer" className="font-semibold text-accent-text underline">Download</a>}</>
          ) : info.error ? <span className="text-faint">{info.error}</span> : <span className="text-good">You have the latest version.</span>}
        </p>
      )}
    </div>
  );
}
