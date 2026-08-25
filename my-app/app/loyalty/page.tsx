'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useSocket } from '@/hooks/useSocket';
import { useRouter } from 'next/navigation';

interface BrandingState {
  shopName: string;
  logoUrl: string | null;
}

interface LoyaltyCard {
  customerName: string;
  progress: number;
  coffeesUntilFree: number;
  hasUnclaimedVoucher: boolean;
  coffeesRequiredForFree: number;
  activeVoucherCount: number;
  coffeesCompleted?: number; // alias for progress in legacy admin view
  rewardsAvailable?: number; // alias for activeVoucherCount in legacy admin view
  message: string;
  isMilestoneMode?: boolean;
  milestones?: { target: number; rewardType: string; rewardValue: number }[];
  claimedMilestones?: number[];
  rewardAvailable?: boolean;
}


interface LoyaltyVoucher {
  id: number;
  code: string;
  status: string;
  rewardType: string;
  discountType: string;
  discountValue: number;
  rewardName: string;
  minPurchase: number;
  validDays: string | null;
  targetType: string;
  issuedDate: string;
  expiryDate: string | null;
  redeemedDate: string | null;
}

interface LoyaltySetting {
  cardColor: string;
  cardTitle: string;
  cardDescription: string;
  rewardDescription: string;
  isMilestoneMode: boolean;
  milestones: { target: number; rewardType: string; rewardValue: number }[];
}

export default function LoyaltyCardPage() {
  const router = useRouter();
  const [branding, setBranding] = useState<BrandingState>({ shopName: 'CaféOS', logoUrl: null });
  const [customerName, setCustomerName] = useState('');
  const [card, setCard] = useState<LoyaltyCard | null>(null);
  const [vouchers, setVouchers] = useState<LoyaltyVoucher[]>([]);
  const [settings, setSettings] = useState<LoyaltySetting | null>(null);
  const [loading, setLoading] = useState(false);
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [notificationType, setNotificationType] = useState<'success' | 'info'>('info');
  const [showRedemption, setShowRedemption] = useState(false);
  const [selectedVoucher, setSelectedVoucher] = useState<LoyaltyVoucher | null>(null);
  const socketInitialized = useRef(false);

  // Fetch branding
  useEffect(() => {
    fetch('/api/settings/branding')
      .then((r) => r.json())
      .then((d) => setBranding({ shopName: d.shopName ?? 'CaféOS', logoUrl: d.logoUrl ?? null }))
      .catch(() => {});
  }, []);

  // Initialize customer name from localStorage or query params
  useEffect(() => {
    const stored = localStorage.getItem('loyaltyCustomerName');
    if (stored) {
      setCustomerName(stored);
      // Auto-fetch card
      setTimeout(() => fetchCardData(stored), 100);
    }
  }, []);

  // Socket events for real-time updates
  const socketEvents = {
    'loyalty-card-updated': (data: any) => {
      if (data.customerName === customerName) {
        fetchCardData();
        const remaining = data.coffeesRequiredForFree - (data.coffeesCompleted % data.coffeesRequiredForFree);
        setNotificationMessage(`☕ ${data.coffeesCompleted}/${data.coffeesRequiredForFree} coffees – ${remaining} more for reward!`);
        setNotificationType('info');
        setShowNotification(true);
        setTimeout(() => setShowNotification(false), 3000);
      }
    },
    'loyalty-reward-earned': (data: any) => {
      if (data.customerName === customerName) {
        fetchCardData();
        fetchVouchers();
        setNotificationMessage(`🎉 Reward earned! You can now claim your free coffee!`);
        setNotificationType('success');
        setShowNotification(true);
        setTimeout(() => setShowNotification(false), 5000);
      }
    },
  };

  useSocket({ events: socketEvents });

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    try {
      const res = await fetch('/api/loyalty/settings');
      if (!res.ok) throw new Error('Failed to fetch settings');
      const data = await res.json();
      setSettings(data);
    } catch (e) {
      console.error(e);
    }
  }

  async function fetchCardData(name?: string) {
    const targetName = name || customerName;
    if (!targetName) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/loyalty/cards/${encodeURIComponent(targetName)}`, { cache: 'no-store' });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to fetch card: ${res.status}`);
      }
      const data = await res.json();
      setCard(data);
      if (name) setCustomerName(name);
    } catch (e) {
      console.error('[LOYALTY] Error fetching card:', e);
      setCard(null);
    } finally {
      setLoading(false);
    }
  }

  async function fetchVouchers() {
    if (!customerName) return;
    try {
      const res = await fetch(`/api/loyalty/vouchers/${encodeURIComponent(customerName)}`, { cache: 'no-store' });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to fetch vouchers: ${res.status}`);
      }
      const data = await res.json();
      setVouchers(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('[LOYALTY] Error fetching vouchers:', e);
      setVouchers([]);
    }
  }

  // Get reward display text based on discount type
  function getRewardDisplay(voucher: LoyaltyVoucher): string {
    if (voucher.rewardName) return voucher.rewardName;
    
    switch (voucher.discountType) {
      case 'PERCENTAGE':
        return `${voucher.discountValue}% Off`;
      case 'FIXED_AMOUNT':
        return `₱${voucher.discountValue} Off`;
      case 'FREE':
      default:
        return 'Free Item';
    }
  }

  async function handleClaimReward(voucher: LoyaltyVoucher) {
    try {
      // Store selected voucher in localStorage for use in cart
      localStorage.setItem('selectedLoyaltyVoucher', JSON.stringify({
        customerName,
        code: voucher.code,
        voucherId: voucher.id,
      }));
      
      const rewardText = getRewardDisplay(voucher);
      setNotificationMessage(`✅ ${rewardText} selected! It will be applied when you order.`);
      setNotificationType('success');
      setShowNotification(true);
      setTimeout(() => setShowNotification(false), 3000);
      
      // Redirect to menu/cart
      setTimeout(() => {
        router.push('/menu');
      }, 1500);
    } catch (e) {
      console.error('[LOYALTY] Error claiming reward:', e);
      setNotificationMessage('Failed to claim reward');
      setShowNotification(true);
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    fetchCardData();
    fetchVouchers();
  }

  if (!settings) {
    return <div className="p-8 text-gray-400">Loading...</div>;
  }

  const progressPercentage = card ? (card.progress / card.coffeesRequiredForFree) * 100 : 0;
  const activeVouchers = vouchers.filter(v => v.status === 'ACTIVE');
  const redeemedVouchers = vouchers.filter(v => v.status === 'REDEEMED');

  return (
    <div className="min-h-screen bg-gray-950 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header with Branding */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {branding.logoUrl && (
              <img src={branding.logoUrl} alt="Shop Logo" className="w-12 h-12 rounded-lg object-cover" />
            )}
            <div>
              <p className="text-white/60 text-sm font-medium">{branding.shopName}</p>
              <h1 className="text-3xl font-semibold text-white">Loyalty Card</h1>
            </div>
          </div>
          <Link href="/menu" className="text-white/60 hover:text-white text-sm font-medium">
            ← Back to Menu
          </Link>
        </div>

        {/* Search Form */}
        <form onSubmit={handleSearch} className="mb-8">
          <div className="flex gap-2">
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Enter your name..."
              className="flex-1 bg-gray-900 text-white px-4 py-3 rounded-xl border border-gray-700 focus:border-white focus:outline-none transition"
            />
            <button
              type="submit"
              disabled={loading || !customerName}
              className="bg-white hover:bg-gray-100 text-black font-semibold px-6 py-3 rounded-full disabled:opacity-50 transition"
            >
              {loading ? 'Loading...' : 'View Card'}
            </button>
          </div>
        </form>

        {/* Notification */}
        {showNotification && (
          <div className={`mb-6 p-4 rounded-lg animate-pulse ${
            notificationType === 'success' 
              ? 'bg-green-900 text-green-200' 
              : 'bg-blue-900 text-blue-200'
          }`}>
            {notificationMessage}
          </div>
        )}

        {/* Loyalty Card */}
        {card && (
          <div className="space-y-6">
            {/* Main Wallet Card */}
            <div
              style={{ backgroundColor: settings.cardColor }}
              className="rounded-2xl p-8 text-white shadow-2xl relative overflow-hidden"
            >
              {/* Decorative background */}
              <div className="absolute top-0 right-0 w-40 h-40 bg-white opacity-5 rounded-full -mr-20 -mt-20"></div>
              
              <div className="relative z-10">
                <h2 className="text-2xl font-bold mb-2">{settings.cardTitle}</h2>
                <p className="opacity-90 mb-8">{settings.cardDescription}</p>

                {/* Progress Status */}
                <div className="mb-8">
                  <div className="flex justify-between items-center mb-4">
                    <span className="font-semibold">{card.message ? card.message : `Coffees to ${settings.rewardDescription}`}</span>
                    <span className="text-sm opacity-80 font-bold">
                      {card.progress} / {card.coffeesRequiredForFree}
                    </span>
                  </div>
                  <div className="w-full bg-white bg-opacity-20 rounded-full h-5 overflow-hidden relative">
                    <div
                      className="bg-gradient-to-r from-white to-gray-300 h-full transition-all duration-500 rounded-full"
                      style={{ width: `${progressPercentage}%` }}
                    ></div>
                    {/* Render milestone markers on progress bar if in milestone mode */}
                    {card.isMilestoneMode && card.milestones && card.milestones.map(m => (
                      <div 
                        key={m.target}
                        className="absolute top-0 bottom-0 w-1 bg-black opacity-20"
                        style={{ left: `${(m.target / card.coffeesRequiredForFree!) * 100}%` }}
                      ></div>
                    ))}
                  </div>
                </div>

                {/* Coffee Cups Visual */}
                <div className="mb-8">
                  <div className="flex gap-2 justify-center flex-wrap">
                    {Array.from({ length: card.coffeesRequiredForFree }).map((_, i) => {
                      const milestone = card.isMilestoneMode && card.milestones ? card.milestones.find(m => m.target === i + 1) : null;
                      const isClaimed = milestone && card.claimedMilestones?.includes(milestone.target);
                      const isEarned = i < card.progress;

                      return (
                        <div
                          key={i}
                          className={`w-12 h-12 rounded-full flex flex-col items-center justify-center font-bold text-xs transition-all ${
                            isEarned && !milestone
                              ? 'bg-white text-black scale-110 shadow-lg'
                              : isEarned && milestone
                              ? 'bg-amber-400 text-black scale-110 shadow-lg ring-2 ring-white'
                              : !isEarned && milestone
                              ? 'bg-white/40 text-black ring-2 ring-white/50'
                              : 'bg-white bg-opacity-20 text-white'
                          }`}
                        >
                          {milestone ? (
                            <>
                              <span className="leading-none text-[10px]">
                                {milestone.rewardType === 'FREE' ? 'FREE' : milestone.rewardType === 'PERCENTAGE' ? `${milestone.rewardValue}%` : `₱${milestone.rewardValue}`}
                              </span>
                              {isEarned && !isClaimed && <span className="text-[8px] opacity-80 uppercase leading-none mt-1 text-center">Reward</span>}
                            </>
                          ) : (
                            <span className="text-lg">☕</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Reward Status */}
                {card.hasUnclaimedVoucher ? (
                  <div className="bg-white bg-opacity-20 border-2 border-white rounded-lg p-4 text-center cursor-pointer hover:bg-white hover:text-black transition-all" onClick={() => {
                    const activeVoucher = vouchers.find(v => v.status === 'ACTIVE');
                    if (activeVoucher) handleClaimReward(activeVoucher);
                  }}>
                    <p className="text-2xl font-bold">🎉 Reward Ready!</p>
                    <p className="text-sm opacity-90 mt-1">You have {card.activeVoucherCount} reward(s) available. Click here or select from below to claim.</p>
                  </div>
                ) : (
                  <div className="text-center text-sm opacity-80">
                    <p>{card.message}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-900 p-6 rounded-xl border border-gray-800">
                <p className="text-gray-400 text-sm mb-2">Total Coffees</p>
                <p className="text-4xl font-bold text-white">☕ {card.coffeesCompleted}</p>
              </div>
              <div className="bg-gray-900 p-6 rounded-xl border border-gray-800">
                <p className="text-gray-400 text-sm mb-2">Rewards Earned</p>
                <p className="text-4xl font-bold text-white">{card.rewardsAvailable}</p>
              </div>
            </div>

            {/* Active Vouchers - Claim Section */}
            {activeVouchers.length > 0 && (
              <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
                <h3 className="text-lg font-bold text-white mb-4">🎁 Available Rewards ({activeVouchers.length})</h3>
                <div className="space-y-3">
                  {activeVouchers.map((voucher) => (
                    <div key={voucher.id} className="bg-gray-800 rounded-xl p-4 border-l-4 border-white flex justify-between items-center hover:bg-gray-700 transition">
                      <div>
                        <p className="font-mono text-sm font-bold text-white">{voucher.code}</p>
                        <p className="text-xs text-gray-400 mt-1">Expires: {voucher.expiryDate ? new Date(voucher.expiryDate).toLocaleDateString() : 'Never'}</p>
                      </div>
                      <button
                        onClick={() => handleClaimReward(voucher)}
                        className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white text-sm font-bold px-6 py-2 rounded-lg transition shadow-lg"
                      >
                        Claim & Order
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Redeemed Vouchers */}
            {redeemedVouchers.length > 0 && (
              <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
                <h3 className="text-lg font-bold text-white mb-4">✅ Used Rewards ({redeemedVouchers.length})</h3>
                <div className="space-y-2">
                  {redeemedVouchers.map((voucher) => (
                    <div key={voucher.id} className="bg-gray-800 rounded-lg p-3 opacity-60 flex justify-between items-center">
                      <div>
                        <p className="font-mono text-xs text-gray-500">{voucher.code}</p>
                        <p className="text-xs text-gray-500 mt-1">Used {new Date(voucher.redeemedDate || '').toLocaleDateString()}</p>
                      </div>
                      <span className="text-xs px-2 py-1 rounded bg-gray-700 text-gray-400">Redeemed</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Empty States */}
        {!card && customerName && !loading && (
          <div className="bg-gray-900 p-8 rounded-lg text-center border border-gray-800">
            <p className="text-gray-400 text-lg">No loyalty card found</p>
            <p className="text-gray-500 text-sm mt-2">Start placing orders to earn your first reward!</p>
          </div>
        )}

        {!customerName && !card && (
          <div className="bg-gray-900 p-12 rounded-lg text-center border border-gray-800">
            <p className="text-gray-400 text-lg">👆 Enter your name above to view your loyalty card</p>
            <p className="text-gray-500 text-sm mt-2">Every coffee brings you closer to a free reward!</p>
          </div>
        )}
      </div>
    </div>
  );
}
