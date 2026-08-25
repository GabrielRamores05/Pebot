'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect, useRef, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  IconMonitor, IconProducts,
  IconAnalytics, IconInventory, IconQR,
  IconLogout, IconCoffee, IconSettings, IconDownload, IconUpload,
   IconTerminal, IconHistory, IconConsultant, IconAudit, IconStar,

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
  const [showQR, setShowQR] = useState(false);
  const [showExitQR, setShowExitQR] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);
  const exitQrRef = useRef<HTMLDivElement>(null);
  const [notifQueue, setNotifQueue] = useState<Array<{ orderNumber: string; customerName: string; tableName?: string; id: number }>>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [guestLeftNotif, setGuestLeftNotif] = useState<Array<{ guestNames: string; tableName: string; id: number }>>([]);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [restoreCountdown, setRestoreCountdown] = useState(30);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const restoreFileRef = useRef<HTMLInputElement>(null);
  const restoreFile = useRef<File | null>(null);

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
  const [localIp, setLocalIp] = useState(
    typeof window !== 'undefined' ? window.location.origin : ''
  );

  useEffect(() => {
    fetch('/api/system/ip')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.origin) setLocalIp(d.origin);
      })
      .catch(() => {});
  }, []);

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

  async function logout() {
    await fetch('/api/auth/me', { method: 'DELETE' });
    router.push('/login');
  }

  function printQR() {
    if (!qrRef.current) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const qrElement = qrRef.current.querySelector('svg');
    if (!qrElement) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Customer QR Code - CaféOS</title>
          <style>
            body {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              font-family: Arial, sans-serif;
              background: white;
            }
            .qr-container {
              padding: 20px;
              border: 2px solid #000;
              border-radius: 10px;
              background: white;
              margin: 20px;
            }
            .title {
              text-align: center;
              margin-bottom: 20px;
              font-size: 18px;
              font-weight: bold;
            }
            .url {
              text-align: center;
              margin-top: 20px;
              font-size: 12px;
              color: #666;
              word-break: break-all;
            }
            svg {
              display: block;
              margin: 0 auto;
            }
          </style>
        </head>
        <body>
          <div class="title">Scan to Order - CaféOS</div>
          <div class="qr-container">
            ${qrElement.outerHTML}
          </div>
          <div class="url">${localIp}/menu</div>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  }

  async function downloadQR() {
    if (!qrRef.current) return;

    const qrElement = qrRef.current.querySelector('svg');
    if (!qrElement) return;

    // Convert SVG to canvas
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const svgData = new XMLSerializer().serializeToString(qrElement);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      canvas.width = 400;
      canvas.height = 400;
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 50, 50, 300, 300);

      // Add text
      ctx.fillStyle = '#333';
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Scan to Order - CaféOS', canvas.width / 2, 30);

      ctx.font = '12px Arial';
      ctx.fillStyle = '#666';
      ctx.fillText(localIp + '/menu', canvas.width / 2, 380);

      // Download
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'cafe-qr-code.png';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
      }, 'image/png');

      URL.revokeObjectURL(svgUrl);
    };

    img.src = svgUrl;
  }

  async function handleSaveData() {
    try {
      const res = await fetch('/api/backup');
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Backup failed');
        return;
      }
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') || '';
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match ? match[1] : `cafeos-backup-${Date.now()}.zip`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('Backup failed: ' + String(e));
    }
  }

  function handleRestoreFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    restoreFile.current = file;
    setRestoreError(null);
    setRestoreCountdown(30);
    setShowRestoreConfirm(true);
  }

  function cancelRestore() {
    setShowRestoreConfirm(false);
    restoreFile.current = null;
    if (restoreFileRef.current) restoreFileRef.current.value = '';
  }

  useEffect(() => {
    if (!showRestoreConfirm || restoreCountdown <= 0) return;
    const timer = setTimeout(() => setRestoreCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [showRestoreConfirm, restoreCountdown]);

  async function confirmRestore() {
    const file = restoreFile.current;
    if (!file) return;
    setRestoring(true);
    try {
      const form = new FormData();
      form.append('backup', file);
      const res = await fetch('/api/restore', { method: 'POST', body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRestoreError(data.error || 'Restore failed');
        setShowRestoreConfirm(false);
        setRestoring(false);
        restoreFile.current = null;
        if (restoreFileRef.current) restoreFileRef.current.value = '';
        return;
      }
      // Success: redirect to login per spec
      window.location.href = data.redirect || '/login';
    } catch (e) {
      setRestoreError('Restore failed: ' + String(e));
      setShowRestoreConfirm(false);
      setRestoring(false);
      restoreFile.current = null;
      if (restoreFileRef.current) restoreFileRef.current.value = '';
    }
  }

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

        {/* User / Logout */}
        {user && (
          <div className="p-4 border-t border-slate-200">
            <button
              onClick={() => setShowQR(true)}
              className="flex items-center gap-3 text-amber-500 hover:text-amber-600 transition-colors w-full mb-3 bg-slate-100 p-2.5 rounded-lg"
              title={sidebarCollapsed ? 'Customer QR' : undefined}
            >
              <IconQR size={20} strokeWidth={1.75} className="shrink-0" />
              <span className={`hidden md:block font-medium text-sm transition-opacity ${sidebarCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'}`}>Customer QR</span>
            </button>

            <button
              onClick={() => setShowExitQR(true)}
              className="flex items-center gap-3 text-green-500 hover:text-green-600 transition-colors w-full mb-5 bg-slate-100 p-2.5 rounded-lg"
              title={sidebarCollapsed ? 'Exit QR' : undefined}
            >
              <span className="text-lg">🚪</span>
              <span className={`hidden md:block font-medium text-sm transition-opacity ${sidebarCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'}`}>Exit QR</span>
            </button>

            {user.role === 'ADMIN' && (
              <>
                <button
                  onClick={handleSaveData}
                  className="flex items-center gap-3 text-slate-600 hover:text-slate-800 transition-colors w-full mb-3 bg-slate-100 p-2.5 rounded-lg"
                  title={sidebarCollapsed ? 'Save Data' : undefined}
                >
                  <IconDownload size={20} strokeWidth={1.75} className="shrink-0" />
                  <span className={`hidden md:block font-medium text-sm transition-opacity ${sidebarCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'}`}>Save Data</span>
                </button>

                <button
                  onClick={() => restoreFileRef.current?.click()}
                  className="flex items-center gap-3 text-slate-600 hover:text-slate-800 transition-colors w-full mb-5 bg-slate-100 p-2.5 rounded-lg"
                  title={sidebarCollapsed ? 'Restore Data' : undefined}
                >
                  <IconUpload size={20} strokeWidth={1.75} className="shrink-0" />
                  <span className={`hidden md:block font-medium text-sm transition-opacity ${sidebarCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'}`}>Restore Data</span>
                </button>

                <input
                  ref={restoreFileRef}
                  type="file"
                  accept=".zip,application/zip"
                  className="hidden"
                  onChange={handleRestoreFileChange}
                />
              </>
            )}

            <div className="flex items-center gap-2 mb-3">
              {branding.logoUrl
                ? <img src={branding.logoUrl} alt="Shop Logo" className="w-7 h-7 rounded-md object-cover shrink-0" />
                : <IconCoffee size={16} strokeWidth={1.75} className="text-amber-400 shrink-0" />}
              <div className={`hidden md:block min-w-0 transition-opacity ${sidebarCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'}`}>
                <div className="text-xs text-slate-500 truncate">{user.name}</div>
                <div className="text-xs text-amber-500 font-medium">{user.role}</div>
              </div>
              <button
                onClick={logout}
                title="Logout"
                aria-label="Logout"
                className="ml-auto w-9 h-9 rounded-lg bg-slate-100 text-slate-500 hover:text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500/60 transition-colors flex items-center justify-center"
              >
                <IconLogout size={18} strokeWidth={1.9} className="shrink-0" />
              </button>
            </div>
            
          </div>
        )}
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
      <main className="flex-1 flex flex-col h-screen pt-14 md:pt-0">
        {children}
      </main>

      {/* QR Code Modal for Customer Ordering */}
      {showQR && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setShowQR(false)}>
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl relative" onClick={e => e.stopPropagation()}>
            <button 
              onClick={() => setShowQR(false)} 
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
            >
              ✕
            </button>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Scan to Order</h2>
            <p className="text-gray-500 text-sm mb-6">Customers can scan this QR code to view the menu and place orders from their phones.</p>
            
            <div className="bg-white p-4 rounded-2xl inline-block shadow-sm border border-gray-200" ref={qrRef}>
              <QRCodeSVG 
                value={`${localIp}/menu`}
                size={220}
                level="H"
                includeMargin={false}
              />
            </div>
            
            <div className="mt-6 flex gap-3 justify-center">
              <button
                onClick={printQR}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Print
              </button>
              <button
                onClick={downloadQR}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Download
              </button>
            </div>
            
            <div className="mt-6 bg-gray-50 rounded-xl p-3 border border-gray-100">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold mb-1">Direct Link</p>
              <p className="text-sm font-mono text-gray-700 break-all select-all">{localIp}/menu</p>
            </div>
          </div>
        </div>
      )}

      {/* Exit QR Code Modal - Single QR for whole system */}
      {showExitQR && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setShowExitQR(false)}>
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl relative" onClick={e => e.stopPropagation()}>
            <button 
              onClick={() => setShowExitQR(false)} 
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
            >
              ✕
            </button>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">🚪 Exit QR</h2>
            <p className="text-gray-500 text-sm mb-6">Customers scan this when leaving to free up their table.</p>
            
            <div className="bg-white p-4 rounded-2xl inline-block shadow-sm border border-gray-200" ref={exitQrRef}>
              <QRCodeSVG 
                value={`${localIp}/exit`}
                size={220}
                level="H"
                includeMargin={false}
              />
            </div>
            
            <div className="mt-6 flex gap-3 justify-center">
              <button
                onClick={() => {
                  if (!exitQrRef.current) return;
                  const qrElement = exitQrRef.current.querySelector('svg');
                  if (!qrElement) return;
                  const win = window.open('', '_blank', 'width=500,height=600');
                  if (!win) return;
                  win.document.write(`
                    <html><head><title>Exit QR Code - CaféOS</title>
                    <style>body{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;margin:0}img{width:300px;height:300px}h2{margin-bottom:8px}p{color:#666;margin-top:4px;font-size:14px}</style>
                    </head><body>
                    <h2>🚪 Exit QR</h2>
                    <p>Scan when leaving</p>
                    ${qrElement.outerHTML}
                    <script>window.onload=function(){window.print();window.close()}</script>
                    </body></html>
                  `);
                  win.document.close();
                }}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Print
              </button>
              <button
                onClick={() => {
                  if (!exitQrRef.current) return;
                  const qrElement = exitQrRef.current.querySelector('svg');
                  if (!qrElement) return;
                  const svgData = new XMLSerializer().serializeToString(qrElement);
                  const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
                  const url = URL.createObjectURL(svgBlob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'exit-qr-code.png';
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                }}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Download
              </button>
            </div>
            
            <div className="mt-6 bg-gray-50 rounded-xl p-3 border border-gray-100">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold mb-1">Direct Link</p>
              <p className="text-sm font-mono text-gray-700 break-all select-all">{localIp}/exit</p>
            </div>
          </div>
        </div>
      )}

      {/* Restore Confirm Modal - 30 second countdown */}
      {showRestoreConfirm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-2xl relative">
            <h2 className="text-2xl font-bold text-red-600 mb-3">⚠️ Restore Backup?</h2>
            <p className="text-gray-600 mb-6">
              Current database will be permanently lost. Are you sure?
            </p>
            <p className="text-5xl font-bold text-slate-800 mb-6">{restoreCountdown}s</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={cancelRestore}
                disabled={restoring}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmRestore}
                disabled={restoring || restoreCountdown > 0}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {restoring ? 'Restoring…' : 'Confirm Restore'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restore Error Modal */}
      {restoreError && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-2xl relative">
            <h2 className="text-2xl font-bold text-red-600 mb-3">❌ Restore Failed</h2>
            <p className="text-gray-600 mb-6">{restoreError}</p>
            <button
              onClick={() => setRestoreError(null)}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

