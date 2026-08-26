'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import {
  IconQR, IconLogout, IconCoffee, IconDownload, IconUpload,
} from '@/lib/assets';

// Account & tools section — lives in Settings ▸ Tools. Everything that used
// to sit at the bottom of the sidebar, so the nav stays short.
export default function AdminToolsSection({ shopName = 'CaféOS', logoUrl }: { shopName?: string; logoUrl?: string | null }) {
  const router = useRouter();
  const [user, setUser] = useState<{ name: string; role: string } | null>(null);
  const [showQR, setShowQR] = useState(false);
  const [showExitQR, setShowExitQR] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);
  const exitQrRef = useRef<HTMLDivElement>(null);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [restoreCountdown, setRestoreCountdown] = useState(30);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const restoreFileRef = useRef<HTMLInputElement>(null);
  const restoreFile = useRef<File | null>(null);

  const [localIp, setLocalIp] = useState(
    typeof window !== 'undefined' ? window.location.origin : ''
  );

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.user?.name) setUser({ name: d.user.name, role: d.user.role }); })
      .catch(() => {});
    fetch('/api/system/ip')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.origin) setLocalIp(d.origin);
      })
      .catch(() => {});
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
            body { display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:100vh; margin:0; font-family:Arial,sans-serif; background:white; }
            .qr-container { padding:20px; border:2px solid #000; border-radius:10px; background:white; margin:20px; }
            .title { text-align:center; margin-bottom:20px; font-size:18px; font-weight:bold; }
            .url { text-align:center; margin-top:20px; font-size:12px; color:#666; word-break:break-all; }
            svg { display:block; margin:0 auto; }
          </style>
        </head>
        <body>
          <div class="title">Scan to Order - CaféOS</div>
          <div class="qr-container">${qrElement.outerHTML}</div>
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

      ctx.fillStyle = '#333';
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Scan to Order - CaféOS', canvas.width / 2, 30);

      ctx.font = '12px Arial';
      ctx.fillStyle = '#666';
      ctx.fillText(localIp + '/menu', canvas.width / 2, 380);

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
    const timer = setTimeout(() => setRestoreCountdown((c) => c - 1), 1000);
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
      window.location.href = data.redirect || '/login';
    } catch (e) {
      setRestoreError('Restore failed: ' + String(e));
      setShowRestoreConfirm(false);
      setRestoring(false);
      restoreFile.current = null;
      if (restoreFileRef.current) restoreFileRef.current.value = '';
    }
  }

  return (
    <div className="max-w-sm mx-auto space-y-4">
      {/* Account */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-800 mb-2">Account</h3>
        <div className="flex items-center gap-3">
          {logoUrl
            ? <img src={logoUrl} alt="Shop Logo" className="w-9 h-9 rounded-lg object-cover shrink-0" />
            : <IconCoffee size={20} strokeWidth={1.75} className="text-amber-400 shrink-0" />}
          <div className="min-w-0">
            <div className="text-sm text-slate-700 truncate">{user?.name ?? '…'}</div>
            <div className="text-xs text-amber-500 font-medium">{user?.role ?? ''}</div>
          </div>
          <button
            onClick={logout}
            className="ml-auto inline-flex items-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 px-3.5 py-2 rounded-xl text-xs font-medium transition-colors"
          >
            <IconLogout size={16} strokeWidth={1.9} />
            Logout
          </button>
        </div>
      </div>

      {/* QR codes */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-800 mb-0.5">Table QR codes</h3>
        <p className="text-xs text-slate-400 mb-4">Print these for tables — customers scan to order and to release their table when leaving.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={() => setShowQR(true)}
            className="flex items-center gap-3 text-amber-600 hover:bg-amber-50 transition-colors w-full bg-white border border-amber-200 p-3 rounded-xl"
          >
            <IconQR size={20} strokeWidth={1.75} className="shrink-0" />
            <span className="font-medium text-sm">Customer QR</span>
          </button>
          <button
            onClick={() => setShowExitQR(true)}
            className="flex items-center gap-3 text-green-600 hover:bg-green-50 transition-colors w-full bg-white border border-green-200 p-3 rounded-xl"
          >
            <span className="text-lg">🚪</span>
            <span className="font-medium text-sm">Exit QR</span>
          </button>
        </div>
      </div>

      {/* Backup / Restore */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-800 mb-0.5">Data backup</h3>
        <p className="text-xs text-slate-400 mb-4">Download a full snapshot of your shop data, or restore from a previous backup.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={handleSaveData}
            className="flex items-center gap-3 text-slate-700 hover:bg-slate-50 transition-colors w-full bg-white border border-slate-200 p-3 rounded-xl"
          >
            <IconDownload size={20} strokeWidth={1.75} className="shrink-0" />
            <span className="font-medium text-sm">Save Data</span>
          </button>
          <button
            onClick={() => restoreFileRef.current?.click()}
            className="flex items-center gap-3 text-slate-700 hover:bg-slate-50 transition-colors w-full bg-white border border-slate-200 p-3 rounded-xl"
          >
            <IconUpload size={20} strokeWidth={1.75} className="shrink-0" />
            <span className="font-medium text-sm">Restore Data</span>
          </button>
        </div>
        <input
          ref={restoreFileRef}
          type="file"
          accept=".zip,application/zip"
          className="hidden"
          onChange={handleRestoreFileChange}
        />
      </div>

      {/* Customer QR modal */}
      {showQR && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setShowQR(false)}>
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowQR(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
            >
              ✕
            </button>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Scan to Order</h2>
            <p className="text-gray-500 text-sm mb-6">Customers can scan this QR code to view the menu and place orders from their phones.</p>

            <div className="bg-white p-4 rounded-2xl inline-block shadow-sm border border-gray-200" ref={qrRef}>
              <QRCodeSVG value={`${localIp}/menu`} size={220} level="H" includeMargin={false} />
            </div>

            <div className="mt-6 flex gap-3 justify-center">
              <button onClick={printQR} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">Print</button>
              <button onClick={downloadQR} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">Download</button>
            </div>

            <div className="mt-6 bg-gray-50 rounded-xl p-3 border border-gray-100">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold mb-1">Direct Link</p>
              <p className="text-sm font-mono text-gray-700 break-all select-all">{localIp}/menu</p>
            </div>
          </div>
        </div>
      )}

      {/* Exit QR modal */}
      {showExitQR && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setShowExitQR(false)}>
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowExitQR(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
            >
              ✕
            </button>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">🚪 Exit QR</h2>
            <p className="text-gray-500 text-sm mb-6">Customers scan this when leaving to free up their table.</p>

            <div className="bg-white p-4 rounded-2xl inline-block shadow-sm border border-gray-200" ref={exitQrRef}>
              <QRCodeSVG value={`${localIp}/exit`} size={220} level="H" includeMargin={false} />
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

      {/* Restore confirm modal */}
      {showRestoreConfirm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-2xl relative">
            <h2 className="text-2xl font-bold text-red-600 mb-3">⚠️ Restore Backup?</h2>
            <p className="text-gray-600 mb-6">Current database will be permanently lost. Are you sure?</p>
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

      {/* Restore error modal */}
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
