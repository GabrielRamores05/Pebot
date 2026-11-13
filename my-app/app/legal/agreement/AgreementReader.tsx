'use client';

import { useEffect, useState } from 'react';

type Lang = 'en' | 'fil';

interface AgreementPayload {
  version: string;
  lang: Lang;
  text: string;
}

/** The license agreement, with an English / Filipino switch. Used on /activate and /legal/agreement. */
export default function AgreementReader({
  className = '',
  onLoaded,
}: {
  className?: string;
  onLoaded?: (version: string) => void;
}) {
  const [lang, setLang] = useState<Lang>('en');
  const [data, setData] = useState<AgreementPayload | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setError('');
    fetch(`/api/license/agreement?lang=${lang}`, { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) throw new Error();
        return (await r.json()) as AgreementPayload;
      })
      .then((d) => {
        if (cancelled) return;
        setData(d);
        onLoaded?.(d.version);
      })
      .catch(() => !cancelled && setError("The agreement couldn't be loaded. Restart Pebot and try again."));
    return () => {
      cancelled = true;
    };
  }, [lang, onLoaded]);

  return (
    <div className={className}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-[0.08em] text-faint">
          {data ? `Version ${data.version}` : 'License agreement'}
        </p>
        <div role="tablist" aria-label="Language" className="inline-flex rounded-field border border-hair bg-panel p-0.5 text-sm">
          {(['en', 'fil'] as const).map((l) => (
            <button
              key={l}
              type="button"
              role="tab"
              aria-selected={lang === l}
              onClick={() => setLang(l)}
              className={`rounded-[6px] px-3 py-1 font-medium transition-colors ${
                lang === l ? 'bg-card text-ink shadow-card' : 'text-muted hover:text-ink'
              }`}
            >
              {l === 'en' ? 'English' : 'Filipino'}
            </button>
          ))}
        </div>
      </div>
      <div
        tabIndex={0}
        className="h-[min(52vh,520px)] overflow-y-auto rounded-card border border-hair bg-card px-5 py-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
      >
        {error ? (
          <p className="text-sm text-danger">{error}</p>
        ) : data ? (
          <pre className="whitespace-pre-wrap font-sans text-[13.5px] leading-relaxed text-ink">{data.text}</pre>
        ) : (
          <p className="text-sm text-muted">Loading…</p>
        )}
      </div>
    </div>
  );
}
