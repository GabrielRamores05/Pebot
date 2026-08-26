'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  IconMonitor, IconProducts,
  IconAnalytics, IconInventory,
  IconCoffee, IconSettings,
   IconTerminal, IconHistory, IconConsultant, IconAudit, IconStar,
  IconLogout,

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


const navItems = [
  { href: '/admin',            Icon: IconMonitor,   label: 'Live Orders', roles: ['ADMIN', 'STAFF'], permission: 'liveOrders' },
  { href: '/admin/terminal',   Icon: IconTerminal,  label: 'New Order', roles: ['ADMIN', 'STAFF'], permission: 'terminal' },
  { href: '/admin/analytics',  Icon: IconAnalytics, label: 'Analytics', roles: ['ADMIN', 'STAFF'], permission: 'analytics' },
  { href: '/admin/products',   Icon: IconProducts,  label: 'Products', roles: ['ADMIN', 'STAFF'], permission: 'products' },
  { href: '/admin/inventory',  Icon: IconInventory, label: 'Inventory', roles: ['ADMIN', 'STAFF'], permission: 'inventory' },
  { href: '/admin/stock-history', Icon: IconHistory, label: 'Stock History', roles: ['ADMIN', 'STAFF'], permission: 'inventory' },
  { href: '/admin/expenses',   Icon: IconHistory,   label: 'Expenses', roles: ['ADMIN', 'STAFF'], permission: 'inventory' },
  { href: '/admin/loyalty',    Icon: IconCoffee,    label: 'Loyalty', roles: ['ADMIN', 'STAFF'], permission: 'loyalty' },
  { href: '/admin/order-history', Icon: IconHistory, label: 'Order History', roles: ['ADMIN', 'STAFF'], permission: 'analytics' },
  { href: '/admin/reviews',       Icon: IconStar,   label: 'Reviews', roles: ['ADMIN', 'STAFF'], permission: 'products' },
  { href: '/admin/staff',      Icon: IconMonitor,   label: 'Staff', roles: ['ADMIN'], permission: 'staff' },
  { href: '/admin/settings',   Icon: IconSettings,  label: 'Settings', roles: ['ADMIN', 'STAFF'], permission: 'settings' },
  { href: '/admin/consultant',  Icon: IconConsultant, label: 'Consultant', roles: ['ADMIN'], permission: 'settings' },
  { href: '/admin/audit-logs',  Icon: IconAudit, label: 'Audit Logs', roles: ['ADMIN'], permission: 'settings' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [branding, setBranding] = useState<BrandingState>({ shopName: 'CaféOS', logoUrl: null });
  const [notifQueue, setNotifQueue] = useState<Array<{ orderNumber: string; customerName: string; tableName?: string; id: number }>>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [guestLeftNotif, setGuestLeftNotif] = useState<Array<{ guestNames: string; tableName: string; id: number }>>([]);

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

    fetch('/api/auth/me')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { 
        if (data?.user) {
          setUser(data.user);
        }
      })
      .catch(console.error);

    fetch('/api/settings/branding')
      .then((r) => r.json())
      .then((d) => setBranding({ shopName: d.shopName ?? 'CaféOS', logoUrl: d.logoUrl ?? null }))
      .catch(() => {});
  }, []);

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

  // Redirect to first allowed page if user changes (only run once on initial load, not on refresh)
  const hasRedirected = useRef(false);
  
  useEffect(() => {
    
    // Prevent running on subsequent renders
    if (hasRedirected.current) {
      return;
    }
    
    // Wait until user is loaded
    if (!user) {
      return;
    }
    
    // Add a small delay to ensure client-side navigation is complete
    const timer = setTimeout(() => {
      // Mark as redirected only when redirect logic is about to run
      hasRedirected.current = true;
      
      // Admin has full access
      if (user.role === 'ADMIN') {
        return;
      }
      
      // Check if user has analytics permission - redirect to analytics if so
      if (user.permissions?.analytics) {
        router.push('/admin/analytics');
        return;
      }
      
      // Check if user has any other permissions
      const hasAnyPermission = user.permissions && Object.values(user.permissions).some(v => v === true);
      
      // If no permissions, send to unauthorized
      if (!hasAnyPermission) {
        router.push('/unauthorized');
        return;
      }
      
      // Check if user has access to current page
      const currentNav = navItems.find(n => n.href === pathname);
      const hasAccess = currentNav 
        ? (currentNav.permission && user.permissions ? user.permissions[currentNav.permission] === true : true)
        : true;
      
      if (!hasAccess && visibleNav.length > 0) {
        // Redirect to first available page
        router.push(visibleNav[0].href);
      }
    }, 100);
    
    return () => clearTimeout(timer);
  }, [user, pathname, visibleNav, router]);

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      {/* Mobile Header */}
      <div className="fixed top-0 left-0 right-0 h-14 bg-white border-b border-slate-200 flex items-center px-4 z-40 md:hidden">
        <button
          onClick={() => setSidebarOpen(true)}
          className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div className="ml-3 flex items-center gap-2">
          {branding.logoUrl
            ? <img src={branding.logoUrl} alt="Logo" className="w-7 h-7 rounded-lg object-cover" />
            : <IconCoffee size={18} strokeWidth={1.75} className="text-amber-400" />}
          <span className="text-slate-800 font-bold text-sm truncate">{branding.shopName}</span>
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <nav className={`fixed md:relative z-50 md:z-auto inset-y-0 left-0 bg-white border-r border-slate-200 flex flex-col flex-shrink-0 transition-all duration-300 md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} ${sidebarCollapsed ? 'md:w-16' : 'md:w-52'}`}>
        {/* Logo - hidden on mobile since it's in header */}
        <div className="p-4 border-b border-slate-200 hidden md:flex items-center justify-between">
          <div className="flex items-center gap-3">
            {branding.logoUrl
              ? <img src={branding.logoUrl} alt="Logo" className="w-8 h-8 rounded-lg object-cover shrink-0" />
              : <IconCoffee size={22} strokeWidth={1.75} className="text-amber-400 shrink-0" />}
            <span className={`hidden md:block text-slate-800 font-bold text-lg truncate transition-opacity ${sidebarCollapsed ? 'opacity-0 w-0' : 'opacity-100'}`}>{branding.shopName}</span>
          </div>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="hidden md:flex w-8 h-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 transition-transform"
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <svg className="w-5 h-5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={sidebarCollapsed ? "M9 5l7 7-7 7" : "M15 19l-7-7 7-7"} />
            </svg>
          </button>
        </div>

        {/* Nav Items */}
        <div className="flex-1 py-4 space-y-1 overflow-y-auto overflow-x-hidden">
          {visibleNav.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 mx-2 rounded-xl transition-colors ${isActive ? 'bg-amber-700 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'}`}
                title={sidebarCollapsed ? item.label : undefined}
              >
                <item.Icon size={20} strokeWidth={1.75} className="shrink-0" />
                <span className={`hidden md:block font-medium transition-opacity ${sidebarCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'}`}>{item.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Logout — always visible, regardless of permissions */}
        <div className="p-3 border-t border-slate-200">
          <button
            onClick={async () => {
              await fetch('/api/auth/me', { method: 'DELETE' });
              router.push('/login');
            }}
            className="flex items-center gap-3 w-full px-4 py-3 mx-2 rounded-xl text-rose-600 hover:bg-rose-50 transition-colors"
            title="Log out"
          >
            <IconLogout size={20} strokeWidth={1.75} className="shrink-0" />
            <span className={`hidden md:block font-medium transition-opacity ${sidebarCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'}`}>Log out</span>
          </button>
        </div>

      </nav>

      {/* New Order Notifications - adjust for mobile header */}
      {notifQueue.length > 0 && (
        <div className="fixed top-16 right-4 md:top-4 z-[60] flex flex-col gap-2 max-w-sm">
          {notifQueue.map((n, i) => (
            <div
              key={`${n.orderNumber}-${i}`}
              className="bg-green-600 text-white px-5 py-3 rounded-2xl shadow-2xl animate-bounce flex items-center gap-3"
            >
              <span className="text-2xl">🔔</span>
              <div>
                <p className="font-bold text-sm">New Order: {n.orderNumber}</p>
                <p className="text-green-100 text-xs">{n.customerName}{n.tableName ? ` · ${n.tableName}` : ''}</p>
              </div>
              <button
                onClick={() => setNotifQueue(prev => prev.filter((_, idx) => idx !== i))}
                className="ml-2 text-green-200 hover:text-white text-lg"
              >✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Guest Left Notifications */}
      {guestLeftNotif.length > 0 && (
        <div className="fixed top-16 right-4 md:top-4 z-[60] flex flex-col gap-2 max-w-sm">
          {guestLeftNotif.map((n, i) => (
            <div
              key={`guest-left-${i}`}
              className="bg-red-600 text-white px-5 py-3 rounded-2xl shadow-2xl animate-bounce flex items-center gap-3"
            >
              <span className="text-2xl">👋</span>
              <div>
                <p className="font-bold text-sm">Guest Left</p>
                <p className="text-red-100 text-xs">{n.guestNames} left {n.tableName}</p>
              </div>
              <button
                onClick={() => setGuestLeftNotif(prev => prev.filter((_, idx) => idx !== i))}
                className="ml-2 text-red-200 hover:text-white text-lg"
              >✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-0 h-screen overflow-y-auto pt-14 md:pt-0">
        {children}
      </main>

    </div>
  );
}

