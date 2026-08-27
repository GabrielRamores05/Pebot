'use client';

import { useEffect, useRef, useState, use } from 'react';
import Link from 'next/link';
import { useSocket } from '@/hooks/useSocket';
import { playPreparingSound, playCompletedSound, fetchVoiceSettings } from '@/lib/sounds';
import { ticketCode } from '@/lib/ticket';
import { selectionsLabelFromJson } from '@/lib/product-options';
import { fetchJson, userMessage } from '@/lib/fetch-json';

interface OrderMessage {
  id: number;
  type: string;
  content: string;
  sender: string;
  createdAt: string;
}

interface BusinessSettings {
  gcashAccountName?: string | null;
  gcashQrImage?: string | null;
  paymayaAccountName?: string | null;
  paymayaQrImage?: string | null;
}

interface BrandingState {
  shopName: string;
  logoUrl: string | null;
}

interface OrderItem {
  id: number;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  selections?: string | null;
  product: { name: string };
}

interface Order {
  id: number;
  orderNumber: string;
  customerName: string;
  status: 'PENDING' | 'PREPARING' | 'COMPLETED' | 'CANCELLED';
  totalAmount: number;
  barcodeValue: string;
  queueNumber: number | null;
  createdAt: string;
  loyaltyPromo?: boolean;
  paymentMethod?: string;
  orderType?: string;
  deliveryAddress?: string | null;
  table?: { name: string };
  items: OrderItem[];
}

const STATUS_CONFIG = {
  PENDING:    { label: 'Pending',    color: 'bg-yellow-100 text-yellow-800 border-yellow-300', icon: '⏳', step: 0 },
  PREPARING:  { label: 'Preparing',  color: 'bg-blue-100 text-blue-800 border-blue-300',       icon: '👨‍🍳', step: 1 },
  COMPLETED:  { label: 'Completed',  color: 'bg-green-100 text-green-800 border-green-300',    icon: '✅', step: 2 },
  CANCELLED:  { label: 'Cancelled',  color: 'bg-red-100 text-red-800 border-red-300',          icon: '❌', step: -1 },
};

function BarcodeDisplay({ value }: { value: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    import('jsbarcode').then((JsBarcode) => {
      const svg = containerRef.current?.querySelector('svg');
      if (svg) {
        JsBarcode.default(svg, value, {
          format: 'CODE128',
          width: 2,
          height: 60,
          displayValue: true,
          fontSize: 12,
          margin: 8,
        });
      }
    }).catch((e) => console.error('Failed to render order barcode:', e));
  }, [value]);

  const downloadBarcode = async () => {
    if (!containerRef.current) return;
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(containerRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
      });
      const link = document.createElement('a');
      link.download = `order-${value}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Failed to download barcode:', error);
    }
  };

  const printBarcode = () => {
    if (!containerRef.current) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const svgElement = containerRef.current.querySelector('svg');
    if (!svgElement) return;

    const svgData = svgElement.outerHTML;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Order Barcode - ${value}</title>
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
            .barcode-container {
              text-align: center;
              padding: 20px;
            }
            .order-number {
              font-size: 18px;
              font-weight: bold;
              margin-bottom: 20px;
              color: #333;
            }
            svg {
              max-width: 100%;
              height: auto;
            }
            @media print {
              body { margin: 0; }
              .barcode-container { page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <div class="barcode-container">
            <div class="order-number">Order: ${ticketCode(value)}</div>
            ${svgData}
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

  return (
    <div className="flex flex-col items-center space-y-3">
      <div ref={containerRef} className="flex justify-center">
        <svg className="w-full max-w-xs" />
      </div>
      <div className="flex gap-2">
        <button
          onClick={downloadBarcode}
          className="bg-black hover:bg-gray-800 text-white text-sm font-medium px-4 py-2 rounded-full transition-colors flex items-center gap-1"
        >
          📥 Download
        </button>
        <button
          onClick={printBarcode}
          className="bg-gray-600 hover:bg-gray-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-1"
        >
          🖨️ Print
        </button>
      </div>
    </div>
  );
}

export default function OrderStatusPage({ params }: { params: { orderNumber: string } }) {
  const { orderNumber } = params;
  const [branding, setBranding] = useState<BrandingState>({ shopName: 'CaféOS', logoUrl: null });
  const [businessSettings, setBusinessSettings] = useState<BusinessSettings | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [statusFlash, setStatusFlash] = useState(false);

  // Follow-up cooldown state
  const [followUpCooldown, setFollowUpCooldown] = useState(0);
  const [followUpSending, setFollowUpSending] = useState(false);

  // Wait time state
  const [tick, setTick] = useState(0)
  const [waitData, setWaitData] = useState<{ estimatedTimes: Record<string, number>; estimatedWait: number; queuePosition: number } | null>(null);

  // Follow-up messages state
  const [messages, setMessages] = useState<OrderMessage[]>([]);
  const [msgText, setMsgText] = useState('');
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioFileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    fetchJson<{ shopName?: string; logoUrl?: string | null }>('/api/settings/branding')
      .then((d) => setBranding({ shopName: d.shopName ?? 'CaféOS', logoUrl: d.logoUrl ?? null }))
      .catch((e) => console.error('Failed to load branding, using defaults:', e));
    // Pre-fetch voice settings so customer hears admin's custom messages
    fetchVoiceSettings();
    // Fetch business settings for payment QR display
    fetchJson<BusinessSettings>('/api/settings/business')
      .then((data) => setBusinessSettings(data))
      .catch((e) => console.error('Failed to load business settings:', e));
  }, []);

  // Tick for countdown timer
  useEffect(function() { const id = setInterval(function() { setTick(function(t) { return t + 1 }) }, 1000); return function() { clearInterval(id) } }, [])

  // Fetch estimated wait time
  useEffect(() => {
    if (!order || order.status === 'COMPLETED' || order.status === 'CANCELLED') return;
    fetchJson<{ estimatedTimes: Record<string, number>; estimatedWait: number; queuePosition: number }>(`/api/orders/${orderNumber}/wait-time`)
      .then((data) => { setWaitData(data); setTick(0); })
      .catch((e) => console.error('Failed to load estimated wait time:', e));
  }, [order?.id, order?.status, orderNumber]);

  // Fetch follow-up messages
  useEffect(() => {
    if (!order) return;
    fetchJson<OrderMessage[]>(`/api/orders/${orderNumber}/messages`)
      .then(setMessages)
      .catch((e) => console.error('Failed to load follow-up messages:', e));
  }, [order?.id, orderNumber]);

  // Poll messages every 10s. A failed poll keeps the messages already shown
  // rather than blanking the thread.
  useEffect(() => {
    const interval = setInterval(() => {
      fetchJson<OrderMessage[]>(`/api/orders/${orderNumber}/messages`)
        .then(setMessages)
        .catch((e) => console.error('Failed to refresh follow-up messages:', e));
    }, 10000);
    return () => clearInterval(interval);
  }, [orderNumber]);

  async function sendTextMessage() {
    if (!msgText.trim() || sending) return;
    setSending(true);
    try {
      const msg = await fetchJson<OrderMessage>(`/api/orders/${orderNumber}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'text', content: msgText.trim(), sender: order?.customerName || 'customer' }),
      });
      setMessages((prev) => [...prev, msg]);
      setMsgText('');
      showToast('Message sent!');
    } catch (e) {
      console.error('Failed to send message:', e);
      showToast(userMessage(e, 'Your message did not send. Try again.'));
    }
    setSending(false);
  }

  async function uploadVoiceBlob(audioBlob: Blob, fileName: string) {
    setSending(true);
    try {
      const formData = new FormData();
      formData.append('file', audioBlob, fileName);
      const { url } = await fetchJson<{ url: string }>('/api/upload', { method: 'POST', body: formData });
      const msg = await fetchJson<OrderMessage>(`/api/orders/${orderNumber}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'voice', content: url, sender: order?.customerName || 'customer' }),
      });
      setMessages((prev) => [...prev, msg]);
      showToast('Voice message sent!');
    } catch (e) {
      console.error('Failed to send voice message:', e);
      showToast(userMessage(e, 'Your voice message did not send. Try again.'));
    }
    setSending(false);
  }

  async function handleAudioFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadVoiceBlob(file, `voice-${Date.now()}-${file.name}`);
    if (audioFileRef.current) audioFileRef.current.value = '';
  }

  async function startRecording() {
    // Check if mic recording is available (requires HTTPS or localhost)
    if (!navigator.mediaDevices?.getUserMedia) {
      audioFileRef.current?.click();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
        setRecordingTime(0);

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (audioBlob.size < 1000) return; // too short

        await uploadVoiceBlob(audioBlob, `voice-${Date.now()}.webm`);
      };

      mediaRecorder.start();
      setRecording(true);
      setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime((t) => t + 1);
      }, 1000);
    } catch {
      // Mic access denied or not available (e.g. HTTP on LAN) — fall back to file picker
      audioFileRef.current?.click();
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
  }

  function playStatusSound(status: string) {
    if (status === 'PREPARING') playPreparingSound();
    else if (status === 'COMPLETED') playCompletedSound();
  }

  function showToast(msg: string) {
    setToast(msg);
    setStatusFlash(true);
    setTimeout(() => setStatusFlash(false), 1000);
    setTimeout(() => setToast(null), 4000);
  }

  async function cancelOrder() {
    if (!order) return;
    setCancelling(true);
    const res = await fetch(`/api/orders/${order.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CANCELLED' }),
    });
    if (res.ok) {
      const updated: Order = await res.json();
      setOrder(updated);
    }
    setCancelling(false);
    setShowCancelConfirm(false);
  }

  useEffect(() => {
    fetch(`/api/orders/${orderNumber}`)
      .then((r) => {
        if (r.status === 404) { setNotFound(true); setLoading(false); return null; }
        return r.json();
      })
      .then((data) => {
        if (data) { setOrder(data); setLoading(false); }
      })
      .catch(() => setLoading(false));
  }, [orderNumber]);

  // Cleanup: restore body scroll on unmount (prevents stuck black overlay)
  useEffect(() => {
    const handleRouteChange = () => { document.body.style.overflow = ''; };
    window.addEventListener('beforeunload', handleRouteChange);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('beforeunload', handleRouteChange);
    };
  }, []);

  // Polling fallback every 10s in case socket misses the event
  useEffect(() => {
    const interval = setInterval(() => {
      fetch(`/api/orders/${orderNumber}`)
        .then((r) => r.ok ? r.json() : null)
        .then((data) => {
          if (data) {
            setOrder((prev) => {
              if (prev && prev.status !== data.status) {
                const messages: Record<string, string> = {
                  PREPARING: '👨‍🍳 Your order is being prepared!',
                  COMPLETED: '✅ Your order is ready! Please collect it.',
                  CANCELLED: '❌ Your order has been cancelled.',
                };
                if (messages[data.status]) {
                  showToast(messages[data.status]);
                  playStatusSound(data.status);
                }
              }
              return data;
            });
          }
        })
        .catch(() => {});
    }, 10000);
    return () => clearInterval(interval);
  }, [orderNumber]);

  // Real-time updates — join order-specific room
  useSocket({
    room: `order-${orderNumber}`,
    events: {
      'order-status-update': (data: unknown) => {
        const updated = data as Order;
        if (updated.orderNumber === orderNumber) {
          setOrder((prev) => {
            if (prev && prev.status !== updated.status) {
              const messages: Record<string, string> = {
                PREPARING: '👨‍🍳 Your order is being prepared!',
                COMPLETED: '✅ Your order is ready! Please collect it.',
                CANCELLED: '❌ Your order has been cancelled.',
              };
              if (messages[updated.status]) {
                showToast(messages[updated.status]);
                playStatusSound(updated.status);
              }
            }
            return updated;
          });
        }
      },
      'order-message': (data: unknown) => {
        const msg = data as { id: number; type: string; content: string; sender: string; createdAt: string };
        if (msg.sender !== order?.customerName) {
          setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
        }
      },
      'queue-update': (data: unknown) => {
        const update = data as { type: string; queueNumber?: number };
        if (update.type === 'resequenced') {
          // Re-fetch order to get updated queueNumber
          fetch(`/api/orders/${orderNumber}`)
            .then((r) => r.ok ? r.json() : null)
            .then((data) => { if (data) setOrder(data); })
            .catch(() => {});
        }
      },
    },
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-bounce">☕</div>
          <p className="text-amber-800 font-medium">Loading your order...</p>
        </div>
      </div>
    );
  }

  if (notFound || !order) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <span className="text-4xl">😕</span>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Order not found</h2>
        <Link href="/menu" className="mt-4 bg-black text-white px-8 py-3 rounded-full font-semibold hover:bg-gray-800 transition-colors">
          Back to Menu
        </Link>
      </div>
    );
  }

  const statusInfo = STATUS_CONFIG[order.status];
  const steps = ['PENDING', 'PREPARING', 'COMPLETED'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Toast notification */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white px-6 py-3 rounded-2xl shadow-2xl text-sm font-semibold animate-bounce max-w-xs text-center">
          {toast}
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-gray-200 shadow-sm">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3 justify-between">
          <Link href="/menu" className="text-gray-600 hover:text-gray-900 transition-colors">← Menu</Link>
          <div className="flex items-center gap-2 flex-1 ml-2">
            {branding.logoUrl && (
              <img src={branding.logoUrl} alt="Shop Logo" className="w-8 h-8 rounded object-cover" />
            )}
            <h1 className="text-lg font-bold">{branding.shopName}</h1>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {/* Status Card */}
        <div className={`bg-white rounded-2xl shadow-lg shadow-gray-200/50 p-6 text-center transition-all duration-500 border border-gray-100 ${
          statusFlash ? 'ring-4 ring-amber-400 scale-105' : ''
        }`}>
          <div className={`text-5xl mb-3 ${statusFlash ? 'animate-bounce' : ''}`}>{statusInfo.icon}</div>
          <span className={`inline-flex items-center px-4 py-2 rounded-full border text-lg font-bold ${statusInfo.color}`}>
            {statusInfo.label}
          </span>
          {order.queueNumber && (order.status === 'PENDING' || order.status === 'PREPARING') && (
            <div className="mt-2 mb-1 flex items-center justify-center gap-2">
              <span className="bg-amber-100 text-amber-800 text-xs font-semibold px-2.5 py-1 rounded-full">
                Queue #{order.queueNumber}
              </span>
            </div>
          )}
          <p className="text-gray-500 mt-2 text-sm">
            {order.status === 'PENDING' && 'Your order has been received. Please wait.'}
            {order.status === 'PREPARING' && 'The kitchen is preparing your order!'}
            {order.status === 'COMPLETED' && 'Your order is ready! Please collect it.'}
            {order.status === 'CANCELLED' && 'This order has been cancelled.'}
          </p>
        </div>

        {/* Estimated Wait Time */}
        {waitData && (order.status === 'PENDING' || order.status === 'PREPARING') && (
          <div className="bg-white rounded-2xl shadow-lg shadow-gray-200/50 p-5 space-y-3 border border-gray-100">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <span className="text-xl">⏱️</span> Estimated Preparation Time
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(waitData.estimatedTimes).map(([station, minutes]) => {
                const labels: Record<string, { icon: string; label: string }> = {
                  coffee: { icon: '☕', label: 'Drinks' },
                  kitchen: { icon: '🍳', label: 'Food' },
                  bar: { icon: '🥤', label: 'Beverages' },
                  pastry: { icon: '🧁', label: 'Pastry' },
                  general: { icon: '📦', label: 'Other' },
                };
                const meta = labels[station] || { icon: '📦', label: station };
                return (
                  <div key={station} className="bg-gray-50 border border-gray-200 rounded-2xl p-3 text-center">
                    <span className="text-2xl">{meta.icon}</span>
                    <p className="text-xs text-amber-700 font-medium mt-1">{meta.label}</p>
                    <p className="text-lg font-bold text-amber-900">{tick < minutes * 60 ? minutes - Math.floor(tick / 60) : 0} min</p>
                  </div>
                );
              })}
            </div>
            {waitData.queuePosition > 0 && (
              <p className="text-center text-sm text-gray-500">
                📋 Queue position: <span className="font-bold text-gray-700">#{waitData.queuePosition}</span>
              </p>
            )}
          </div>
        )}

        {/* Loyalty Reward Badge */}
        {order.loyaltyPromo && (
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-400 rounded-2xl p-4 flex items-center gap-3 shadow-sm">
            <span className="text-3xl">🎁</span>
            <div className="flex-1">
              <p className="text-green-900 font-bold">Loyalty Reward Applied</p>
              <p className="text-green-700 text-xs mt-0.5">This order was completed with a free reward!</p>
            </div>
          </div>
        )}

        {/* Cashier Payment Notice */}
        {order.status === 'PENDING' && order.paymentMethod === 'CASH' && (
          <div className="bg-gray-50 border-2 border-gray-200 rounded-3xl p-5 flex items-start gap-4 shadow-sm">
            <div className="text-4xl">💵</div>
            <div>
              <p className="text-amber-900 font-bold text-base">Payment Required</p>
              <p className="text-amber-800 text-sm mt-1">
                Please pay at the <span className="font-bold">counter</span> so we can start preparing your order.
              </p>
            </div>
          </div>
        )}

        {order.status === 'PENDING' && order.paymentMethod === 'GCASH' && businessSettings && (
          <div className="bg-gray-50 border-2 border-gray-200 rounded-3xl p-5 flex items-start gap-4 shadow-sm">
            <div className="text-4xl">📱</div>
            <div className="flex-1">
              <p className="text-amber-900 font-bold text-base">GCash Payment</p>
              {businessSettings.gcashAccountName && (
                <p className="text-amber-800 text-sm mt-1">Account: <span className="font-medium">{businessSettings.gcashAccountName}</span></p>
              )}
              {businessSettings.gcashQrImage && (
                <div className="mt-2">
                  <img src={businessSettings.gcashQrImage} alt="GCash QR Code" className="max-w-24 max-h-24 rounded border border-gray-200 object-contain" />
                </div>
              )}
            </div>
          </div>
        )}

        {order.status === 'PENDING' && order.paymentMethod === 'PAYMAYA' && businessSettings && (
          <div className="bg-gray-50 border-2 border-gray-200 rounded-3xl p-5 flex items-start gap-4 shadow-sm">
            <div className="text-4xl">📱</div>
            <div className="flex-1">
              <p className="text-amber-900 font-bold text-base">PayMaya Payment</p>
              {businessSettings.paymayaAccountName && (
                <p className="text-amber-800 text-sm mt-1">Account: <span className="font-medium">{businessSettings.paymayaAccountName}</span></p>
              )}
              {businessSettings.paymayaQrImage && (
                <div className="mt-2">
                  <img src={businessSettings.paymayaQrImage} alt="PayMaya QR Code" className="max-w-24 max-h-24 rounded border border-gray-200 object-contain" />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Cancel button — only when PENDING */}
        {order.status === 'PENDING' && (
          <button
            onClick={() => setShowCancelConfirm(true)}
            className="w-full border-2 border-red-300 text-red-600 bg-red-50 font-bold py-3 rounded-2xl hover:bg-red-100 transition-colors"
          >
            ✕ Cancel Order
          </button>
        )}

        {/* Follow Up Order button — only when PENDING or PREPARING */}
        {(order.status === 'PENDING' || order.status === 'PREPARING') && (
          <button
            onClick={async () => {
              if (followUpCooldown > 0 || followUpSending) return;
              setFollowUpSending(true);
              try {
                const res = await fetch(`/api/orders/${orderNumber}/follow-up`, { method: 'POST' });
                if (res.ok) {
                  showToast('✅ Follow-up sent to staff!');
                  setFollowUpCooldown(180);
                  const timer = setInterval(() => {
                    setFollowUpCooldown((prev) => {
                      if (prev <= 1) { clearInterval(timer); return 0; }
                      return prev - 1;
                    });
                  }, 1000);
                } else {
                  showToast('❌ Could not send follow-up');
                }
              } catch {
                showToast('❌ Network error');
              }
              setFollowUpSending(false);
            }}
            disabled={followUpCooldown > 0 || followUpSending}
            className={`w-full font-bold py-3 rounded-2xl transition-colors ${
              followUpCooldown > 0
                ? 'border-2 border-gray-200 text-gray-400 bg-gray-50 cursor-not-allowed'
                : 'border-2 border-black text-black bg-white hover:bg-gray-50'
            }`}
          >
            {followUpSending
              ? 'Sending...'
              : followUpCooldown > 0
                ? `⏳ Follow up again in ${Math.floor(followUpCooldown / 60)}:${String(followUpCooldown % 60).padStart(2, '0')}`
                : '📣 Follow Up Order'}
          </button>
        )}

        {/* Cancel confirmation modal */}
        {showCancelConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowCancelConfirm(false)}>
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4">
              <div className="text-center">
                <div className="text-5xl mb-3">⚠️</div>
                <h3 className="text-gray-800 font-bold text-lg">Cancel this order?</h3>
                <p className="text-gray-500 text-sm mt-1">This cannot be undone.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setShowCancelConfirm(false)}
                  className="bg-gray-100 text-gray-700 font-semibold py-3 rounded-xl hover:bg-gray-200 transition-colors"
                >
                  Keep Order
                </button>
                <button
                  onClick={cancelOrder}
                  disabled={cancelling}
                  className="bg-red-600 text-white font-bold py-3 rounded-xl hover:bg-red-500 transition-colors disabled:opacity-50"
                >
                  {cancelling ? 'Cancelling...' : 'Yes, Cancel'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Progress Steps */}
        {order.status !== 'CANCELLED' && (
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <div className="flex items-center">
              {steps.map((step, idx) => {
                const currentStep = statusInfo.step;
                const isCompleted = idx < currentStep;
                const isCurrent = idx === currentStep;
                const stepInfo = STATUS_CONFIG[step as keyof typeof STATUS_CONFIG];

                return (
                  <div key={step} className="flex items-center flex-1">
                    <div className="flex flex-col items-center flex-1">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg border-2 ${
                        isCompleted ? 'bg-green-500 border-green-500' :
                        isCurrent   ? 'bg-black border-black animate-pulse' :
                                      'bg-gray-100 border-gray-200'
                      }`}>
                        {isCompleted ? '✓' : stepInfo.icon}
                      </div>
                      <p className={`text-xs mt-1 font-medium ${isCurrent ? 'text-amber-700' : isCompleted ? 'text-green-600' : 'text-gray-400'}`}>
                        {stepInfo.label}
                      </p>
                    </div>
                    {idx < steps.length - 1 && (
                      <div className={`h-0.5 flex-1 mx-1 ${idx < currentStep ? 'bg-green-400' : 'bg-gray-200'}`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Order Info */}
        <div className="bg-white rounded-2xl shadow-sm p-5 space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-gray-800">Order Details</h3>
            <span className="text-amber-700 font-mono font-bold text-sm">{ticketCode(order.orderNumber)}</span>
          </div>
          <div className="text-sm text-gray-600 space-y-1">
            <div className="flex justify-between"><span>Customer</span><span className="font-medium text-gray-800">{order.customerName}</span></div>
            {order.orderType && (
              <div className="flex justify-between">
                <span>Order type</span>
                <span className="font-medium text-gray-800">
                  {order.orderType === 'DINE_IN' ? '🍽️ Dine-in' :
                   order.orderType === 'TAKEOUT' ? '🥡 Takeout' : '🛵 Delivery'}
                </span>
              </div>
            )}
            {order.table && <div className="flex justify-between"><span>Table</span><span className="font-medium text-gray-800">{order.table.name}</span></div>}
            {order.orderType === 'DELIVERY' && order.deliveryAddress && (
              <div className="flex justify-between gap-2"><span>Deliver to</span><span className="font-medium text-gray-800 text-right">{order.deliveryAddress}</span></div>
            )}
            <div className="flex justify-between"><span>Ordered at</span><span className="font-medium text-gray-800">{new Date(order.createdAt).toLocaleTimeString()}</span></div>
            {order.paymentMethod && (
              <div className="flex justify-between">
                <span>Payment</span>
                <span className={`font-medium ${
                  order.paymentMethod === 'CASH' ? 'text-green-700' :
                  order.paymentMethod === 'GCASH' ? 'text-blue-700' : 'text-blue-700'
                }`}>
                {order.paymentMethod === 'CASH' ? '💵 Cash' :
                   order.paymentMethod === 'GCASH' ? '📱 GCash' :
                   order.paymentMethod === 'PAYMAYA' ? '📱 PayMaya' : order.paymentMethod}
                </span>
              </div>
            )}
          </div>

          <div className="border-t border-gray-100 pt-3 space-y-1">
            {order.items.map((item) => (
              <div key={item.id} className="text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>{item.product.name} × {item.quantity}</span>
                  <span>₱{item.subtotal.toFixed(2)}</span>
                </div>
                {item.selections && (
                  <p className="text-xs text-amber-700 pl-3">{selectionsLabelFromJson(item.selections)}</p>
                )}
              </div>
            ))}
            <div className="flex justify-between font-bold text-base text-gray-800 pt-2 border-t border-gray-100 mt-2">
              <span>Total</span>
              <span>₱{order.totalAmount.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Barcode */}
        <div className="bg-white rounded-2xl shadow-sm p-5 flex flex-col items-center">
          <h3 className="font-bold text-gray-800 mb-3">Order Barcode</h3>
          <BarcodeDisplay value={order.barcodeValue} />
          <p className="text-gray-400 text-xs mt-2 text-center">Show this to the staff when collecting your order</p>
        </div>

        {/* Follow Up / Messages */}
        {order.status !== 'CANCELLED' && order.status !== 'COMPLETED' && (
          <div className="bg-white rounded-2xl shadow-sm p-5 space-y-3">
            <h3 className="font-bold text-gray-800">💬 Follow Up</h3>
            <p className="text-xs text-gray-500">Send a message or voice note to the staff about your order</p>

            {/* Messages list */}
            {messages.length > 0 && (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`p-2.5 rounded-xl text-sm ${
                      m.sender === order?.customerName
                        ? 'bg-gray-100 border border-gray-200 ml-4'
                        : 'bg-blue-50 border border-blue-200 mr-4'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-xs font-semibold text-gray-500">
                        {m.sender === order?.customerName ? `🙋 ${m.sender}` : `🍳 ${m.sender}`}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(m.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                    {m.type === 'voice' ? (
                      <audio src={m.content} controls className="w-full h-8" />
                    ) : (
                      <p className="text-gray-700">{m.content}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Text input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={msgText}
                onChange={(e) => setMsgText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendTextMessage()}
                placeholder="Type a follow-up message..."
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                disabled={sending}
              />
              <button
                onClick={sendTextMessage}
                disabled={!msgText.trim() || sending}
                className="bg-black text-white px-4 rounded-full font-semibold text-sm hover:bg-gray-800 transition disabled:opacity-40"
              >
                Send
              </button>
            </div>

            {/* Voice recorder */}
            <input
              ref={audioFileRef}
              type="file"
              accept="audio/*"
              capture="environment"
              className="hidden"
              onChange={handleAudioFile}
            />
            <div className="flex items-center gap-3">
              {recording ? (
                <>
                  <button
                    onClick={stopRecording}
                    className="flex items-center gap-2 bg-red-600 text-white px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-red-500 transition animate-pulse"
                  >
                    ⏹ Stop ({recordingTime}s)
                  </button>
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-red-500 rounded-full animate-ping" />
                    <span className="text-xs text-red-600 font-medium">Recording...</span>
                  </div>
                </>
              ) : (
                <button
                  onClick={startRecording}
                  disabled={sending}
                  className="flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-gray-200 transition border border-gray-200 disabled:opacity-40"
                >
                  🎙️ Voice Message
                </button>
              )}
              {sending && <span className="text-xs text-gray-400">Sending...</span>}
            </div>
          </div>
        )}

        <Link href="/menu" className="block bg-black text-white text-center font-semibold py-4 rounded-full hover:bg-gray-800 transition-colors shadow-xl">
          Order More Items
        </Link>
      </main>
    </div>
  );
}
