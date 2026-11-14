'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface BrandingState {
  shopName: string;
  logoUrl: string | null;
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [branding, setBranding] = useState<BrandingState>({ shopName: 'Pebot', logoUrl: null });
  const [mounted, setMounted] = useState(false);
  // Spec 020: quick PIN sign-in for a shared register.
  const [mode, setMode] = useState<'email' | 'pin'>('email');
  const [pin, setPin] = useState('');
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
    fetch('/api/settings/branding')
      .then((r) => r.json())
      .then((d) => setBranding({ shopName: d.shopName ?? 'Pebot', logoUrl: d.logoUrl ?? null }))
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Login failed');
        return;
      }

      const next = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('next') : null;
      router.push(next && next.startsWith('/') ? next : '/admin');
    } catch {
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const goNext = () => {
    const next = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('next') : null;
    router.push(next && next.startsWith('/') ? next : '/admin');
  };

  const submitPin = async () => {
    if (pin.length < 4 || loading) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/pin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Sign-in failed');
        setPin('');
        return;
      }
      goNext();
    } catch {
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const pressKey = (k: string) => {
    setError('');
    if (k === 'back') setPin((p) => p.slice(0, -1));
    else if (k === 'ok') void submitPin();
    else setPin((p) => (p.length < 6 ? p + k : p));
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,#fffaf4_0%,#f7f0e4_30%,#efe7de_100%)] px-5 py-8 text-stone-900 sm:px-8">
      <div className="absolute inset-0 opacity-60">
        <div className="absolute left-[-8%] top-[-12%] h-72 w-72 rounded-full bg-[#eac8a5]/30 blur-3xl" />
        <div className="absolute bottom-[-12%] right-[-8%] h-80 w-80 rounded-full bg-[#d8b086]/20 blur-3xl" />
      </div>

      <div className={`relative z-10 mx-auto grid max-w-5xl items-center gap-6 transition-all duration-700 lg:grid-cols-[1.1fr_0.9fr] ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
        <section className="hidden rounded-4xl border border-[#e9daba] bg-[#1f1a17] p-8 text-white shadow-[0_28px_70px_rgba(31,26,23,0.2)] lg:block">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-2xl shadow-inner">
              {branding.logoUrl ? (
                <img src={branding.logoUrl} alt="Logo" className="h-full w-full rounded-2xl object-cover" />
              ) : (
                '🍽️'
              )}
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#d5c39d]">Pebot</p>
              <h2 className="text-xl font-bold">{branding.shopName}</h2>
            </div>
          </div>

          <h1 className="max-w-md text-4xl font-black tracking-[-0.07em] text-white">
            Run your restaurant with precision.
          </h1>

          <p className="mt-5 max-w-md text-base leading-7 text-stone-300">
            Bring service, loyalty, kitchen flow, and sales into one premium command center designed for busy restaurant teams.
          </p>

          <div className="mt-8 space-y-3">
            {[
              'Live order tracking',
              'Table-ready ordering',
              'Loyalty & promotions',
              'Inventory-level awareness',
            ].map((item) => (
              <div key={item} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-stone-200">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#efd6b4] text-sm text-stone-900">✓</span>
                {item}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-4xl border border-[#e8d5b2] bg-[#fffdfb]/85 p-5 shadow-[0_28px_70px_rgba(77,52,30,0.08)] backdrop-blur-xl sm:p-7 lg:p-8">
          <div className="mb-6 flex justify-center lg:hidden">
            <div className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-linear-to-br from-[#2d221d] via-[#5f3e2b] to-[#b67c4d] text-3xl text-white shadow-md">
              {branding.logoUrl ? (
                <img src={branding.logoUrl} alt="Logo" className="h-full w-full rounded-[22px] object-cover" />
              ) : (
                '🍽️'
              )}
            </div>
          </div>

          <div className="mb-6 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8b6c47]">Staff access</p>
            <h2 className="mt-2 text-3xl font-black tracking-[-0.06em] text-stone-900">Welcome back</h2>
            <p className="mt-2 text-sm text-stone-500">Sign in to manage orders, service, and loyalty.</p>
          </div>

          <div className="mb-5 grid grid-cols-2 gap-1 rounded-2xl bg-[#f3ece2] p-1" role="tablist" aria-label="Sign-in method">
            {(['email', 'pin'] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => { setMode(m); setError(''); setPin(''); }}
                className={`h-10 rounded-xl text-sm font-semibold transition ${mode === m ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-800'}`}
              >
                {m === 'email' ? 'Email and password' : 'Staff PIN'}
              </button>
            ))}
          </div>

          {mode === 'pin' && (
            <div className="space-y-4">
              <div className="flex justify-center gap-3 py-2" aria-label={`${pin.length} digits entered`}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <span key={i} className={`h-3.5 w-3.5 rounded-full transition ${i < pin.length ? 'bg-[#1d1917]' : i < 4 ? 'border-2 border-[#d9c7aa]' : 'border-2 border-dashed border-[#e6d8c2]'}`} />
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'back', '0', 'ok'].map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => pressKey(k)}
                    disabled={loading || (k === 'ok' && pin.length < 4)}
                    className={`h-14 rounded-2xl text-xl font-semibold tabular-nums transition disabled:opacity-40 ${
                      k === 'ok' ? 'bg-[#1d1917] text-base text-white hover:bg-[#2d2724]' : 'border border-[#ebddc4] bg-[#faf5ee] text-stone-900 hover:bg-white'
                    }`}
                    aria-label={k === 'back' ? 'Delete last digit' : k === 'ok' ? 'Sign in' : k}
                  >
                    {k === 'back' ? '⌫' : k === 'ok' ? (loading ? '…' : 'Sign in') : k}
                  </button>
                ))}
              </div>
              {error && <p className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600" role="alert">{error}</p>}
              <p className="text-center text-xs text-stone-500">Your PIN is set by the owner in Staff &amp; HR.</p>
            </div>
          )}

          {mode === 'email' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@restaurant.com"
                required
                className="w-full rounded-2xl border border-[#ebddc4] bg-[#faf5ee] px-4 py-3.5 text-base text-stone-900 placeholder:text-stone-400 focus:border-[#d0ab79] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#f2dfc0]/60"
              />
            </div>

            <div>
              <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                required
                className="w-full rounded-2xl border border-[#ebddc4] bg-[#faf5ee] px-4 py-3.5 text-base text-stone-900 placeholder:text-stone-400 focus:border-[#d0ab79] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#f2dfc0]/60"
              />
            </div>

            {error && (
              <p className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-[#1d1917] px-4 py-3.5 text-base font-semibold text-white shadow-[0_16px_28px_rgba(29,25,23,0.18)] transition hover:-translate-y-0.5 hover:bg-[#2d2724] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
          )}

          <div className="mt-6 flex items-center justify-center gap-3 text-sm text-stone-500">
            <Link href="/" className="inline-flex items-center gap-2 font-medium text-stone-600 transition hover:text-stone-900">
              <span>←</span>
              Back to home
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
