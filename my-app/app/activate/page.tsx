'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import AgreementReader from '../legal/agreement/AgreementReader';

interface Status {
  state: 'no-agreement' | 'agreement-accepted' | 'active';
  reason: string | null;
  message: string | null;
  licenseNo: number | null;
  agreementVersion: string;
  local: boolean;
  machineCode?: string | null;
}

export default function ActivatePage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loadError, setLoadError] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [key, setKey] = useState('');
  const [copied, setCopied] = useState(false);
  const [activatedNo, setActivatedNo] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/license/status', { cache: 'no-store' });
      if (!r.ok) throw new Error();
      setStatus((await r.json()) as Status);
    } catch {
      setLoadError("Pebot couldn't start its license check. Close Pebot and open it again.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function accept() {
    if (!status) return;
    setBusy(true);
    setError('');
    try {
      const r = await fetch('/api/license/agreement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: status.agreementVersion }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setStatus(d as Status);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'Could not save. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function activate(keyText: string) {
    setBusy(true);
    setError('');
    try {
      const r = await fetch('/api/license/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: keyText }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setActivatedNo(d.licenseNo as number);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'Activation failed. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function importFile(file: File) {
    const text = await file.text();
    setKey(text.trim());
    await activate(text);
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Copy failed. Select the code and copy it manually.');
    }
  }

  if (loadError) return <Shell><p className="text-danger">{loadError}</p></Shell>;
  if (!status) return <Shell><p className="text-muted">Checking license…</p></Shell>;

  if (!status.local) {
    return (
      <Shell title="Activate on the main computer">
        <p className="text-muted">Pebot can only be activated on the computer it is installed on.</p>
      </Shell>
    );
  }

  if (activatedNo !== null || status.state === 'active') {
    return (
      <Shell title="Pebot is activated" step="Done">
        <p className="text-muted">
          License {activatedNo ?? status.licenseNo ? `#${activatedNo ?? status.licenseNo} ` : ''}is now active on this
          computer. Thank you for choosing Pebot.
        </p>
        <button type="button" onClick={() => (window.location.href = '/')} className={primaryBtn + ' mt-6'}>
          Open Pebot
        </button>
      </Shell>
    );
  }

  if (status.state === 'no-agreement') {
    return (
      <Shell title="License agreement" step="Step 1 of 2" wide>
        <p className="mb-5 text-muted">
          Please read the agreement. It explains what your license covers, support, refunds, and who is responsible for
          backups.
        </p>
        <AgreementReader />
        <label className="mt-5 flex cursor-pointer items-start gap-3 text-sm text-ink">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[var(--c-accent)]"
          />
          <span>I have read and I accept the Pebot license agreement.</span>
        </label>
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        <button type="button" disabled={!agreed || busy} onClick={accept} className={primaryBtn + ' mt-5'}>
          {busy ? 'Saving…' : 'Accept and continue'}
        </button>
      </Shell>
    );
  }

  const code = status.machineCode;
  const blocked = status.reason === 'machine-unreadable' || status.reason === 'not-configured';

  return (
    <Shell title="Activate Pebot" step="Step 2 of 2">
      {blocked || !code ? (
        <p className="rounded-field bg-danger-bg px-4 py-3 text-sm text-danger">{status.message}</p>
      ) : (
        <>
          <ol className="space-y-1.5 text-sm text-muted">
            <li>1. Send this Machine Code to Pebot support on Messenger.</li>
            <li>2. We&apos;ll reply with your license key.</li>
            <li>3. Paste the key below, or import the .lic file we sent.</li>
          </ol>

          <div className="mt-5 flex items-center justify-between gap-4 rounded-card border border-hair bg-panel px-5 py-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.08em] text-faint">Machine Code</p>
              <p className="mt-1 select-all font-mono text-xl font-semibold tracking-wider text-ink sm:text-2xl">{code}</p>
            </div>
            <button type="button" onClick={() => copyCode(code)} className={secondaryBtn}>
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>

          {status.reason && status.reason !== 'no-key' && status.message && (
            <p className="mt-4 rounded-field bg-warn-bg px-4 py-3 text-sm text-warn">{status.message}</p>
          )}

          <form
            className="mt-6"
            onSubmit={(e) => {
              e.preventDefault();
              void activate(key);
            }}
          >
            <label htmlFor="license-key" className="text-sm font-medium text-ink">
              License key
            </label>
            <textarea
              id="license-key"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              rows={3}
              spellCheck={false}
              autoComplete="off"
              placeholder="PEBOT-…"
              className="mt-2 w-full resize-none rounded-field border border-hair-strong bg-card px-3 py-2.5 font-mono text-sm text-ink placeholder:text-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15"
            />
            {error && <p className="mt-2 text-sm text-danger">{error}</p>}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button type="submit" disabled={busy || !key.trim()} className={primaryBtn}>
                {busy ? 'Checking…' : 'Activate'}
              </button>
              <button type="button" disabled={busy} onClick={() => fileRef.current?.click()} className={secondaryBtn}>
                Import license file
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".lic,.txt"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (f) void importFile(f);
                }}
              />
            </div>
          </form>
        </>
      )}
      <p className="mt-8 text-xs text-faint">
        <a href="/legal/agreement" className="underline-offset-2 hover:text-muted hover:underline">
          Read the license agreement again
        </a>
      </p>
    </Shell>
  );
}

const primaryBtn =
  'inline-flex h-10 items-center justify-center rounded-field bg-accent px-5 text-sm font-semibold text-on-accent transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40';
const secondaryBtn =
  'inline-flex h-10 items-center justify-center rounded-field border border-hair-strong bg-card px-4 text-sm font-medium text-ink transition-colors hover:bg-panel disabled:opacity-40';

function Shell({
  children,
  title,
  step,
  wide = false,
}: {
  children: React.ReactNode;
  title?: string;
  step?: string;
  wide?: boolean;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-page px-5 py-10 text-ink">
      <div className={`w-full ${wide ? 'max-w-3xl' : 'max-w-xl'}`}>
        <div className="mb-8 flex items-baseline justify-between">
          <span className="text-lg font-bold tracking-tight">Pebot</span>
          {step && <span className="text-xs font-medium text-faint">{step}</span>}
        </div>
        {title && <h1 className="mb-2 text-2xl font-semibold tracking-tight">{title}</h1>}
        {children}
      </div>
    </main>
  );
}
