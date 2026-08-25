'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

interface BrandingState {
  shopName: string;
  logoUrl: string | null;
}

export default function HomePage() {
  const [branding, setBranding] = useState<BrandingState>({ shopName: 'CaféOS', logoUrl: null });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetch('/api/settings/branding')
      .then((r) => r.json())
      .then((d) => {
        setBranding({ shopName: d.shopName ?? 'CaféOS', logoUrl: d.logoUrl ?? null });
      })
      .catch(() => {
        setBranding({ shopName: 'CaféOS', logoUrl: null });
      });
  }, []);

  const featureCards = [
    { icon: '⚡', title: 'Live service', text: 'Track every order in real time from bar to table.' },
    { icon: '☕', title: 'Smart coffee flow', text: 'Build faster sessions with faster menu decisions.' },
    { icon: '🎁', title: 'Rewards', text: 'Keep loyalty and promotions visible without friction.' },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,#fffaf4_0%,#f7f0e4_36%,#efe7de_100%)] px-5 py-8 text-stone-900 sm:px-8 lg:px-12">
      <div className="absolute inset-0 opacity-60">
        <div className="absolute left-[-10%] top-[-10%] h-72 w-72 rounded-full bg-[#e9ceb0]/30 blur-3xl" />
        <div className="absolute bottom-[-8%] right-[-8%] h-80 w-80 rounded-full bg-[#d9b891]/20 blur-3xl" />
      </div>

      <div className={`relative z-10 mx-auto max-w-6xl transition-all duration-700 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
        <header className="mb-10 flex items-center justify-between rounded-full border border-[#e9d7bd] bg-white/70 px-4 py-3 shadow-[0_10px_25px_rgba(70,46,21,0.06)] backdrop-blur-xl md:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#2d221d] via-[#5f3e2b] to-[#b67c4d] text-xl text-white shadow-md">
              {branding.logoUrl ? (
                <img src={branding.logoUrl} alt="Shop Logo" className="h-full w-full rounded-2xl object-cover" />
              ) : (
                '☕'
              )}
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8b6c47]">CaféOS</p>
              <h1 className="text-base font-bold tracking-tight text-stone-900">{branding.shopName}</h1>
            </div>
          </div>
          <div className="hidden items-center gap-2 md:flex">
            <span className="rounded-full bg-[#f7efe6] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#835f3c]">Live orders</span>
            <span className="rounded-full bg-[#edf8f1] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#2c7b56]">Loyalty ready</span>
          </div>
        </header>

        <main className="grid items-center gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-[32px] border border-[#eadac0] bg-[#fffdfb]/80 p-6 shadow-[0_30px_70px_rgba(77,52,30,0.08)] backdrop-blur-xl sm:p-8 lg:p-10">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#ecdab9] bg-[#f8f0e5] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7c5939]">
              <span>Premium POS</span>
            </div>

            <h2 className="max-w-xl text-4xl font-black leading-[1.04] tracking-[-0.06em] text-stone-900 sm:text-5xl lg:text-6xl">
              Brew better service.
              <span className="block text-[#8b5e34]">Serve faster.</span>
            </h2>

            <p className="mt-5 max-w-xl text-base leading-7 text-stone-600 sm:text-lg">
              A refined café operating system for serving customers, managing live orders, rewards, and premium retail flow from one elegant command center.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/menu"
                className="flex items-center justify-center gap-3 rounded-full bg-[#1d1917] px-6 py-3.5 text-base font-semibold text-white shadow-[0_16px_28px_rgba(29,25,23,0.2)] transition hover:-translate-y-0.5 hover:bg-[#2d2724]"
              >
                <span>📱</span>
                Customer menu
              </Link>
              <Link
                href="/login"
                className="flex items-center justify-center gap-3 rounded-full border border-[#e8d7bd] bg-white px-6 py-3.5 text-base font-semibold text-stone-800 shadow-sm transition hover:-translate-y-0.5 hover:bg-[#f9f3ec]"
              >
                <span>🔐</span>
                Staff login
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap gap-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">
              <span className="rounded-full bg-[#f5eee7] px-3 py-2">Table ordering</span>
              <span className="rounded-full bg-[#eef6ef] px-3 py-2">Loyalty</span>
              <span className="rounded-full bg-[#fdf4e7] px-3 py-2">Inventory</span>
            </div>
          </section>

          <aside className="rounded-[32px] border border-[#eadac0] bg-[#1f1a17] p-4 text-white shadow-[0_30px_68px_rgba(31,26,23,0.2)] sm:p-6">
            <div className="mb-4 flex items-center justify-between rounded-2xl bg-white/5 px-3 py-2.5">
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] text-[#d4c29d]">Today</p>
                <p className="mt-1 text-lg font-bold">Operations</p>
              </div>
              <span className="rounded-full bg-[#d1f1d9] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#165934]">Online</span>
            </div>

            <div className="space-y-3">
              {[
                { label: 'Live orders', value: '24', tone: 'amber' },
                { label: 'Ready queue', value: '08', tone: 'green' },
                { label: 'Loyalty redemptions', value: '12', tone: 'orange' },
              ].map((metric) => (
                <div key={metric.label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] uppercase tracking-[0.12em] text-stone-300">{metric.label}</p>
                    <span className={`h-2.5 w-2.5 rounded-full ${metric.tone === 'amber' ? 'bg-[#f1c98f]' : metric.tone === 'green' ? 'bg-[#9fe8b4]' : 'bg-[#f7bd7d]'}`} />
                  </div>
                  <p className="mt-3 text-3xl font-black tracking-[-0.05em]">{metric.value}</p>
                </div>
              ))}
            </div>
          </aside>
        </main>

        <section className="mt-10 grid gap-4 md:grid-cols-3">
          {featureCards.map((card) => (
            <div key={card.title} className="rounded-[26px] border border-[#eadac0] bg-white/75 p-5 shadow-[0_18px_35px_rgba(77,52,30,0.05)] backdrop-blur-xl">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f7efe7] text-2xl shadow-sm">{card.icon}</div>
              <h3 className="text-lg font-bold text-stone-900">{card.title}</h3>
              <p className="mt-2 text-sm leading-6 text-stone-600">{card.text}</p>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
