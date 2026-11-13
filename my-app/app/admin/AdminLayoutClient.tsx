'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import {
  IconMonitor, IconProducts, IconAnalytics, IconInventory, IconSettings,
  IconTerminal, IconConsultant, IconAudit, IconStar, IconLogout,
  IconClockBack, IconReceipt, IconWallet, IconUsers, IconGift, IconReport,
  IconPlate, IconCash, IconBell, IconPanel,
} from '@/lib/assets';
import { useSocket } from '@/hooks/useSocket';
import { playNewOrderSound } from '@/lib/sounds';

interface User {
  name: string;
  role: string;
  email: string;
  permissions?: Record<string, boolean>;
}

interface BrandingState {
  shopName: string;
  logoUrl: string | null;
}

interface BrandingUpdatedDetail {
  shopName?: string;
  logoUrl?: string | null;
}

const BRANDING_UPDATED_EVENT = 'branding:updated';


type NavGroup = 'Service' | 'Business' | 'Team & setup';

const navItems = [
  { href: '/admin',               Icon: IconMonitor,    label: 'Live Orders',   group: 'Service' as NavGroup,      roles: ['ADMIN', 'STAFF'], permission: 'liveOrders' },
  { href: '/admin/terminal',      Icon: IconTerminal,   label: 'New Order',     group: 'Service' as NavGroup,      roles: ['ADMIN', 'STAFF'], permission: 'terminal' },
  { href: '/admin/order-history', Icon: IconReceipt,    label: 'Order History', group: 'Service' as NavGroup,      roles: ['ADMIN', 'STAFF'], permission: 'analytics' },
  { href: '/admin/analytics',     Icon: IconAnalytics,  label: 'Analytics',     group: 'Business' as NavGroup,     roles: ['ADMIN', 'STAFF'], permission: 'analytics' },
  { href: '/admin/end-of-day',    Icon: IconReport,     label: 'End of Day',    group: 'Business' as NavGroup,     roles: ['ADMIN', 'STAFF'], permission: 'analytics' },
  { href: '/admin/products',      Icon: IconProducts,   label: 'Products',      group: 'Business' as NavGroup,     roles: ['ADMIN', 'STAFF'], permission: 'products' },
  { href: '/admin/inventory',     Icon: IconInventory,  label: 'Inventory',     group: 'Business' as NavGroup,     roles: ['ADMIN', 'STAFF'], permission: 'inventory' },
  { href: '/admin/stock-history', Icon: IconClockBack,  label: 'Stock History', group: 'Business' as NavGroup,     roles: ['ADMIN', 'STAFF'], permission: 'inventory' },
  { href: '/admin/expenses',      Icon: IconWallet,     label: 'Expenses',      group: 'Business' as NavGroup,     roles: ['ADMIN', 'STAFF'], permission: 'inventory' },
  { href: '/admin/loyalty',       Icon: IconGift,       label: 'Loyalty',       group: 'Business' as NavGroup,     roles: ['ADMIN', 'STAFF'], permission: 'loyalty' },
  { href: '/admin/reviews',       Icon: IconStar,       label: 'Reviews',       group: 'Business' as NavGroup,     roles: ['ADMIN', 'STAFF'], permission: 'products' },
  { href: '/admin/staff',         Icon: IconUsers,      label: 'Staff',         group: 'Team & setup' as NavGroup, roles: ['ADMIN'],          permission: 'staff' },
  { href: '/admin/settings',      Icon: IconSettings,   label: 'Settings',      group: 'Team & setup' as NavGroup, roles: ['ADMIN', 'STAFF'], permission: 'settings' },
  { href: '/admin/consultant',    Icon: IconConsultant, label: 'Consultant',    group: 'Team & setup' as NavGroup, roles: ['ADMIN'],          permission: 'settings' },
  { href: '/admin/audit-logs',    Icon: IconAudit,      label: 'Audit Logs',    group: 'Team & setup' as NavGroup, roles: ['ADMIN'],          permission: 'settings' },
];

const NAV_GROUPS: NavGroup[] = ['Service', 'Business', 'Team & setup'];

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('') || '?';
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [branding, setBranding] = useState<BrandingState>({ shopName: 'Pebot', logoUrl: null });
  const [notifQueue, setNotifQueue] = useState<Array<{ orderNumber: string; customerName: string; tableName?: string; id: number }>>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [guestLeftNotif, setGuestLeftNotif] = useState<Array<{ guestNames: string; tableName: string; id: number }>>([]);
  // Cash drawer status for the sidebar card (spec 017/018). Null = unknown or no access.
  const [drawer, setDrawer] = useState<{ open: boolean; expected?: number; since?: string } | null>(null);

  const handleNewOrder = useCallback((data: any) => {
    playNewOrderSound();
    const notificationId = Date.now();
    const notif = {
      orderNumber: data.orderNumber || 'New',
      customerName: data.customerName || 'Customer',
      tableName: data.table?.name,
      id: notificationId,
    };
    setNotifQueue(prev => [...prev, notif]);
    // Auto-dismiss after 5s - remove specific notification by ID
    setTimeout(() => {
      setNotifQueue(prev => prev.filter(n => n.id !== notificationId));
    }, 5000);
  }, []);

  const handleGuestLeft = useCallback((data: any) => {
    const notificationId = Date.now();
    const guestNames = data.guestNames || 'Customer';
    const tableName = data.tableName || 'Table';
    setGuestLeftNotif(prev => [...prev, { guestNames, tableName, id: notificationId }]);
    // Auto-dismiss after 5s - remove specific notification by ID
    setTimeout(() => {
      setGuestLeftNotif(prev => prev.filter(n => n.id !== notificationId));
    }, 5000);
  }, []);

  useSocket({
    events: {
      'new-order': handleNewOrder,
      'table-guest-left': handleGuestLeft,
    },
  });

  // Fetch user and handle redirect on mount
  useEffect(() => {
    let cancelled = false;

    const redirectToLogin = () => {
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      router.replace(`/login?next=${next}`);
    };

    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (data?.user) {
          setUser(data.user);
        } else {
          redirectToLogin();
        }
      })
      .catch(() => {
        if (!cancelled) redirectToLogin();
      });

    fetch('/api/settings/branding')
      .then((r) => r.json())
      .then((d) => setBranding({ shopName: d.shopName ?? 'Pebot', logoUrl: d.logoUrl ?? null }))
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    function handleBrandingUpdated(event: Event) {
      const detail = (event as CustomEvent<BrandingUpdatedDetail>).detail;
      if (!detail) return;

      setBranding((current) => ({
        shopName: detail.shopName !== undefined ? detail.shopName : current.shopName,
        logoUrl: detail.logoUrl !== undefined ? detail.logoUrl : current.logoUrl,
      }));
    }

    window.addEventListener(BRANDING_UPDATED_EVENT, handleBrandingUpdated as EventListener);
    return () => {
      window.removeEventListener(BRANDING_UPDATED_EVENT, handleBrandingUpdated as EventListener);
    };
  }, []);

  const visibleNav = navItems.filter((n) => {
    // Admin has full access
    if (!user || user.role === 'ADMIN') return true;
    // Check role first
    if (!n.roles.includes(user.role)) return false;
    // For non-admin staff, check permissions
    if (n.permission && user.permissions) {
      return user.permissions[n.permission] === true;
    }
    return true;
  });

  useEffect(() => {
    if (!user) return;
    const canSee = user.role === 'ADMIN' || user.permissions?.terminal === true;
    if (!canSee) return;
    let cancelled = false;
    const load = () =>
      fetch('/api/cash-drawer')
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (cancelled || !d) return;
          setDrawer(d.drawer ? { open: true, expected: d.drawer.totals.expectedCash, since: d.drawer.openedAt } : { open: false });
        })
        .catch(() => {});
    load();
    const t = window.setInterval(load, 60_000);
    return () => { cancelled = true; window.clearInterval(t); };
  }, [user, pathname]);

  // Enforce per-route permissions for non-admin staff. ADMIN has full access.
  useEffect(() => {
    if (!user || user.role === 'ADMIN') return;

    const currentNav = navItems.find(
      (n) => pathname === n.href || (n.href !== '/admin' && pathname.startsWith(n.href)),
    );
    const allowed =
      !currentNav ||
      (currentNav.roles.includes(user.role) &&
        (!currentNav.permission || user.permissions?.[currentNav.permission] === true));

    if (!allowed) {
      router.replace(visibleNav.length > 0 ? visibleNav[0].href : '/unauthorized');
    }
  }, [user, pathname, visibleNav, router]);

  const peso = (n: number) => '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const collapsed = sidebarCollapsed;
  const logOut = async () => {
    await fetch('/api/auth/me', { method: 'DELETE' });
    router.push('/login');
  };

  return (
    <div className="flex h-screen overflow-hidden bg-page text-ink">
      {/* Mobile header */}
      <div className="fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-3 border-b border-hair bg-page/95 px-4 backdrop-blur md:hidden">
        <button
          onClick={() => setSidebarOpen(true)}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-hair bg-card text-muted"
          aria-label="Open menu"
        >
          <IconPanel size={18} />
        </button>
        <span className="truncate text-sm font-bold">{branding.shopName}</span>
      </div>

      {sidebarOpen && <div className="fixed inset-0 z-40 bg-black/30 md:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
      <nav
        aria-label="Main"
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-shrink-0 flex-col bg-page transition-[width,transform] duration-300 md:relative md:z-auto md:translate-x-0 ${sidebarOpen ? 'translate-x-0 shadow-pop' : '-translate-x-full'} ${collapsed ? 'md:w-[76px]' : 'md:w-64'}`}
      >
        {/* Brand */}
        <div className={`flex items-center gap-3 px-4 pb-2 pt-5 ${collapsed ? 'md:flex-col md:px-3' : ''}`}>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-accent text-on-accent">
            {branding.logoUrl
              ? <img src={branding.logoUrl} alt="" className="h-full w-full object-cover" />
              : <IconPlate size={20} strokeWidth={1.75} />}
          </div>
          <div className={`min-w-0 flex-1 ${collapsed ? 'md:hidden' : ''}`}>
            <p className="truncate text-[17px] font-bold leading-tight tracking-[-0.02em]">{branding.shopName}</p>
            <p className="truncate text-xs text-faint">Pebot POS</p>
          </div>
          <button
            onClick={() => setSidebarCollapsed(!collapsed)}
            className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-hair bg-card text-muted transition-colors hover:text-ink md:flex"
            title={collapsed ? 'Expand menu' : 'Collapse menu'}
            aria-label={collapsed ? 'Expand menu' : 'Collapse menu'}
          >
            <IconPanel size={16} />
          </button>
        </div>

        {/* Groups */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 pb-3">
          {NAV_GROUPS.map((group) => {
            const items = visibleNav.filter((n) => n.group === group);
            if (items.length === 0) return null;
            return (
              <div key={group} className="mt-4">
                <p className={`mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-faint ${collapsed ? 'md:sr-only' : ''}`}>{group}</p>
                <div className="space-y-0.5">
                  {items.map((item) => {
                    const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setSidebarOpen(false)}
                        aria-current={isActive ? 'page' : undefined}
                        title={collapsed ? item.label : undefined}
                        className={`flex h-10 items-center gap-3 rounded-xl px-3 text-[14px] transition-colors ${collapsed ? 'md:justify-center md:px-0' : ''} ${
                          isActive ? 'bg-accent-soft font-semibold text-accent-text' : 'text-muted hover:bg-panel hover:text-ink'
                        }`}
                      >
                        <item.Icon size={18} strokeWidth={1.75} className="shrink-0" />
                        <span className={`truncate ${collapsed ? 'md:hidden' : ''}`}>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Status + user */}
        <div className="space-y-2 px-3 pb-4">
          {drawer && !collapsed && (
            <Link
              href="/admin/terminal"
              className="flex items-center gap-3 rounded-2xl border border-hair bg-card px-3 py-2.5 transition-colors hover:border-hair-strong"
            >
              <span className={`h-2 w-2 shrink-0 rounded-full ${drawer.open ? 'bg-good' : 'bg-hair-strong'}`} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold">{drawer.open ? 'Cash drawer open' : 'Cash drawer closed'}</span>
                <span className="block truncate text-xs text-faint">
                  {drawer.open && drawer.expected != null
                    ? `Should hold ${peso(drawer.expected)}`
                    : 'Open it from New Order'}
                </span>
              </span>
              <IconCash size={16} className="shrink-0 text-faint" />
            </Link>
          )}
          {user && (
            <div className={`flex items-center gap-3 rounded-2xl px-2 py-1.5 ${collapsed ? 'md:flex-col' : ''}`}>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-panel text-xs font-bold text-muted">
                {initials(user.name)}
              </span>
              <span className={`min-w-0 flex-1 ${collapsed ? 'md:hidden' : ''}`}>
                <span className="block truncate text-[13px] font-semibold">{user.name}</span>
                <span className="block truncate text-xs capitalize text-faint">{user.role.toLowerCase()}</span>
              </span>
              <button
                onClick={logOut}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-faint transition-colors hover:bg-danger-bg hover:text-danger"
                title="Log out"
                aria-label="Log out"
              >
                <IconLogout size={17} />
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* Notifications */}
      {(notifQueue.length > 0 || guestLeftNotif.length > 0) && (
        <div className="fixed right-4 top-16 z-[60] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2 md:top-4" aria-live="polite">
          {notifQueue.map((n, i) => (
            <div key={`${n.orderNumber}-${i}`} className="flex items-start gap-3 rounded-2xl border border-hair bg-card p-3 shadow-pop">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-good-bg text-good">
                <IconBell size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">New order {n.orderNumber}</p>
                <p className="truncate text-xs text-faint">{n.customerName}{n.tableName ? ` · ${n.tableName}` : ''}</p>
              </div>
              <button onClick={() => setNotifQueue((prev) => prev.filter((_, idx) => idx !== i))} className="text-faint hover:text-ink" aria-label="Dismiss">
                ×
              </button>
            </div>
          ))}
          {guestLeftNotif.map((n, i) => (
            <div key={`guest-left-${i}`} className="flex items-start gap-3 rounded-2xl border border-hair bg-card p-3 shadow-pop">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-warn-bg text-warn">
                <IconUsers size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Guest left</p>
                <p className="truncate text-xs text-faint">{n.guestNames} left {n.tableName}</p>
              </div>
              <button onClick={() => setGuestLeftNotif((prev) => prev.filter((_, idx) => idx !== i))} className="text-faint hover:text-ink" aria-label="Dismiss">
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Main content: a raised sheet on the canvas */}
      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto pt-14 md:pt-0">
        {children}
      </main>
    </div>
  );
}
