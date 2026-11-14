'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

interface BrandingState {
  shopName: string;
  logoUrl: string | null;
}

const DOORS = [
  {
    href: '/menu',
    tone: 'bg-tile-peach',
    kicker: 'Guests',
    title: 'Order from the menu',
    text: 'Browse dishes, add notes and send the order to the kitchen.',
    icon: (
      <path d="M4 6h16M4 12h16M4 18h10" strokeLinecap="round" />
    ),
  },
  {
    href: '/login',
    tone: 'bg-tile-sage',
    kicker: 'Staff',
    title: 'Sign in',
    text: 'Open the register, live orders, kitchen, stock and reports.',
    icon: (
      <>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 20c1.2-3.6 4-5.5 7-5.5s5.8 1.9 7 5.5" strokeLinecap="round" />
      </>
    ),
  },
  {
    href: '/kitchen',
    tone: 'bg-tile-sand',
    kicker: 'Kitchen',
    title: 'Kitchen display',
    text: 'Tickets in the order they came in, with timers and bump buttons.',
    icon: (
      <>
        <rect x="3.5" y="5" width="17" height="11" rx="2" />
        <path d="M9 20h6M12 16v4" strokeLinecap="round" />
      </>
    ),
  },
];

export default function HomePage() {
  const [branding, setBranding] = useState<BrandingState>({ shopName: 'Pebot', logoUrl: null });

  useEffect(() => {
    fetch('/api/settings/branding')
      .then((r) => r.json())
      .then((d) => setBranding({ shopName: d.shopName ?? 'Pebot', logoUrl: d.logoUrl ?? null }))
      .catch(() => setBranding({ shopName: 'Pebot', logoUrl: null }));
  }, []);

  const today = new Date().toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="min-h-screen bg-page px-4 py-6 text-ink sm:px-8 lg:px-12">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-6xl flex-col">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-ink text-lg font-black text-white">
              {branding.logoUrl ? <img src={branding.logoUrl} alt="" className="h-full w-full object-cover" /> : branding.shopName.slice(0, 1)}
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-faint">Welcome to</p>
              <h1 className="text-base font-bold tracking-tight">{branding.shopName}</h1>
            </div>
          </div>
          <p className="hidden text-sm text-muted sm:block">{today}</p>
        </header>

        <main className="flex flex-1 flex-col justify-center py-10">
          <h2 className="max-w-3xl text-[40px] font-black leading-[1.02] tracking-[-0.05em] sm:text-6xl">
            Good food, served on time.
            <span className="block text-accent">Where do you want to go?</span>
          </h2>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {DOORS.map((d) => (
              <Link
                key={d.href}
                href={d.href}
                className={`group flex min-h-[220px] flex-col justify-between rounded-[28px] ${d.tone} p-6 transition hover:-translate-y-1 hover:shadow-[0_24px_48px_rgba(60,40,20,0.12)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent`}
              >
                <div className="flex items-start justify-between">
                  <span className="rounded-full bg-card/70 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">{d.kicker}</span>
                  <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.7" className="text-ink/70" aria-hidden>
                    {d.icon}
                  </svg>
                </div>
                <div>
                  <h3 className="text-2xl font-bold tracking-[-0.03em]">{d.title}</h3>
                  <p className="mt-1.5 text-sm leading-6 text-muted">{d.text}</p>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink">
                    Open <span className="transition group-hover:translate-x-1">→</span>
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </main>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-hair pt-4 text-xs text-faint">
          <span>Powered by Pebot restaurant POS</span>
          <Link href="/legal/agreement" className="hover:text-ink">License agreement</Link>
        </footer>
      </div>
    </div>
  );
}
