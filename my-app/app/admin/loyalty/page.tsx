'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSocket } from '@/hooks/useSocket';

interface LoyaltyCard {
  id: number;
  customerName: string;
  membershipCode?: string | null;
  memberSince?: string | null;
  categoryId: number | null;
  categoryName: string;
  coffeesCompleted: number;
  coffeesRequiredForFree: number;
  rewardsAvailable: number;
  lastRewardRedeemDate: string | null;
}


interface LoyaltyVoucher {
  id: number;
  code: string;
  status: string;
  rewardType: string;
  issuedDate: string;
  expiryDate: string | null;
  redeemedDate: string | null;
}

interface LoyaltySetting {
  id: number;
  categoryId: number | null;
  categoryName: string;
  coffeesRequiredForFree: number;
  enabled: boolean;
  cardColor: string;
  cardTitle: string;
  cardDescription: string;
  rewardType: string;
  rewardValue: number;
  isMilestoneMode: boolean;
  milestones: { target: number; rewardType: string; rewardValue: number }[];
}


const defaultSettings: LoyaltySetting = {
  id: 0,
  categoryId: null,
  categoryName: 'Global',
  coffeesRequiredForFree: 10,
  enabled: true,
  cardColor: '#8B4513',
  cardTitle: 'Loyalty Card',
  cardDescription: 'Earn rewards',
  rewardType: 'FREE',
  rewardValue: 0,
  isMilestoneMode: false,
  milestones: [],
};


interface Category {
  id: number;
  name: string;
}


export default function AdminLoyaltyManagementPage() {
  const [cards, setCards] = useState<LoyaltyCard[]>([]);
  const [selectedCard, setSelectedCard] = useState<LoyaltyCard | null>(null);
  const [vouchers, setVouchers] = useState<LoyaltyVoucher[]>([]);
  const [loadingCards, setLoadingCards] = useState(false);
  const [loadingVouchers, setLoadingVouchers] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [settingsList, setSettingsList] = useState<LoyaltySetting[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [editingSettings, setEditingSettings] = useState<LoyaltySetting | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [editingCustomerName, setEditingCustomerName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [deletingCustomer, setDeletingCustomer] = useState(false);
  const [showAddPointsModal, setShowAddPointsModal] = useState(false);
  const [addPointsQuantity, setAddPointsQuantity] = useState(1);
  const [addPointsLoading, setAddPointsLoading] = useState(false);
  const [isCreatingNewModule, setIsCreatingNewModule] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | string>('');

  
  // Milestone state
  const [newMilestoneTarget, setNewMilestoneTarget] = useState(1);
  const [newMilestoneType, setNewMilestoneType] = useState('PERCENTAGE');
  const [newMilestoneValue, setNewMilestoneValue] = useState(0);



  const fetchAllCards = useCallback(async () => {
    setLoadingCards(true);
    try {
      const res = await fetch('/api/loyalty/cards', { cache: 'no-store' });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to fetch cards: ${res.status}`);
      }
      const data = await res.json();
      if (!Array.isArray(data)) {
        throw new Error('Invalid response format');
      }
      setCards(data);
    } catch (e) {
      console.error('[LOYALTY] Error fetching cards:', e);
    } finally {
      setLoadingCards(false);
    }
  }, []);

  useEffect(() => {
    fetchAllCards();
    fetchSettings();
  }, []);

  useEffect(() => {
    if (selectedCard) {
      fetchVouchers(selectedCard.customerName);
    }
  }, [selectedCard]);

  useSocket({
    events: {
      'loyalty-update': () => { fetchAllCards(); },
    },
  });





  async function fetchSettings() {
    try {
      const res = await fetch('/api/loyalty/settings');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setSettingsList(data);
    } catch (e) {
      console.error(e);
      setSettingsMessage('Failed to load settings');
    } finally {
      setLoadingSettings(false);
    }
  }

  async function fetchCategories() {
    try {
      const res = await fetch('/api/categories');
      if (res.ok) {
        const data = await res.json();
        setCategories(data);
      }
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => {
    fetchCategories();
  }, []);


  async function saveSettings() {
    if (!editingSettings) return;

    let updatedSettings = { ...editingSettings };
    if (editingSettings.isMilestoneMode && editingSettings.milestones.length > 0) {
      const maxTarget = Math.max(...editingSettings.milestones.map(m => m.target));
      updatedSettings.coffeesRequiredForFree = maxTarget;
    }

    setSavingSettings(true);
    try {
      const categoryName = updatedSettings.categoryId 
        ? categories.find(c => c.id === updatedSettings.categoryId)?.name 
        : 'Global';

      const res = await fetch('/api/loyalty/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...updatedSettings, categoryName }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to save');
      }
      const data = await res.json();

      
      // Update list
      if (updatedSettings.id === 0) {
        setSettingsList([...settingsList, data]);
      } else {
        setSettingsList(settingsList.map(s => s.id === data.id ? data : s));
      }

      setEditingSettings(null);
      setIsCreatingNewModule(false);
      setSettingsMessage('Settings saved successfully!');
      setTimeout(() => setSettingsMessage(''), 3000);
    } catch (e) {
      console.error(e);
      setSettingsMessage('Failed to save settings');
    } finally {
      setSavingSettings(false);
    }
  }

  async function deleteModule(id: number) {
    if (!confirm('Are you sure you want to delete this loyalty module? Existing cards for this category will lose their settings reference.')) return;
    try {
      const res = await fetch(`/api/loyalty/settings?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setSettingsList(settingsList.filter(s => s.id !== id));
        setSettingsMessage('Module deleted successfully');
        setTimeout(() => setSettingsMessage(''), 3000);
      } else {
        const errorData = await res.json().catch(() => ({}));
        alert(errorData.error || 'Failed to delete module');
      }
    } catch (e) {
      console.error(e);
      alert('Network error while deleting module');
    }
  }



  function addMilestone() {
    if (!editingSettings) return;
    if (editingSettings.milestones.some(m => m.target === newMilestoneTarget)) {
      alert('A milestone for this target already exists.');
      return;
    }

    const newMilestone = {
      target: newMilestoneTarget,
      rewardType: newMilestoneType,
      rewardValue: newMilestoneType === 'FREE' ? 0 : newMilestoneValue,
    };

    const updatedMilestones = [...editingSettings.milestones, newMilestone].sort((a, b) => a.target - b.target);
    setEditingSettings({ ...editingSettings, milestones: updatedMilestones });
    
    // Reset inputs
    setNewMilestoneTarget(newMilestoneTarget + 1);
  }

  function removeMilestone(target: number) {
    if (!editingSettings) return;
    const updatedMilestones = editingSettings.milestones.filter(m => m.target !== target);
    setEditingSettings({ ...editingSettings, milestones: updatedMilestones });
  }

  async function fetchVouchers(customerName: string) {
    setLoadingVouchers(true);
    try {
      const res = await fetch(`/api/loyalty/vouchers/${encodeURIComponent(customerName)}`, { cache: 'no-store' });
      
      // 404 means no vouchers exist, which is OK
      if (res.status === 404) {
        setVouchers([]);
        return;
      }
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error('[LOYALTY] Error fetching vouchers:', errorData.error || `Failed to fetch vouchers: ${res.status}`);
        setVouchers([]);
        return;
      }
      
      const data = await res.json();
      setVouchers(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('[LOYALTY] Error fetching vouchers:', e);
      setVouchers([]);
    } finally {
      setLoadingVouchers(false);
    }
  }

  async function updateCustomerName() {
    if (!selectedCard || !editedName.trim()) return;

    setSavingCustomer(true);
    try {
      const res = await fetch(`/api/loyalty/cards/${encodeURIComponent(selectedCard.customerName)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newName: editedName.trim() }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to update customer name');
      }

      const updatedCard = await res.json();
      
      // Update selected card and list
      setSelectedCard(updatedCard);
      setCards(cards.map(c => c.id === updatedCard.id ? updatedCard : c));
      
      setEditingCustomerName(false);
      setEditedName('');
      
      // Refresh the vouchers for the updated name
      fetchVouchers(updatedCard.customerName);
    } catch (e) {
      console.error('[LOYALTY] Error updating customer name:', e);
      alert(e instanceof Error ? e.message : 'Failed to update customer name');
    } finally {
      setSavingCustomer(false);
    }
  }

  async function deleteCustomer() {
    if (!selectedCard) return;
    if (!confirm(`Are you sure you want to delete the loyalty card for ${selectedCard.customerName}? This cannot be undone.`)) return;

    setDeletingCustomer(true);
    try {
      const res = await fetch(`/api/loyalty/cards/${encodeURIComponent(selectedCard.customerName)}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to delete customer');
      }

      // Remove from list
      setCards(cards.filter(c => c.id !== selectedCard.id));
      setSelectedCard(null);
    } catch (e) {
      console.error('[LOYALTY] Error deleting customer:', e);
      alert(e instanceof Error ? e.message : 'Failed to delete customer');
    } finally {
      setDeletingCustomer(false);
    }
  }

  async function addPoints() {
    if (!selectedCard || addPointsQuantity <= 0) return;

    setAddPointsLoading(true);
    try {
      const res = await fetch(`/api/loyalty/cards/${encodeURIComponent(selectedCard.customerName)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: addPointsQuantity }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Failed to add points');
      } else {
        setShowAddPointsModal(false);
        setAddPointsQuantity(1);
        fetchAllCards();
        alert(`Added ${addPointsQuantity} point(s) to ${selectedCard.customerName}`);
      }
    } catch {
      alert('Network error');
    } finally {
      setAddPointsLoading(false);
    }
  }

  const filteredCards = cards.filter(card =>
    card?.customerName?.toLowerCase?.()?.includes(searchTerm.toLowerCase()) ?? false
  );

  // Calculate stats
  const totalCoffees = cards.reduce((sum, c) => sum + c.coffeesCompleted, 0);
  const totalRewards = cards.reduce((sum, c) => sum + c.rewardsAvailable, 0);
  const activeVouchers = vouchers.filter(v => v.status === 'ACTIVE').length;

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 min-h-screen">
      {/* Apple-inspired Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-gray-200/50 px-6 py-4 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-linear-to-br from-amber-100 to-amber-200 rounded-xl flex items-center justify-center text-xl shadow-sm">
              ☕
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900 -tracking-[0.3px]">Loyalty Program</h1>
              <p className="text-xs text-gray-500">Manage customers & rewards</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                showSettings 
                  ? 'bg-black text-white shadow-lg' 
                  : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-200'
              }`}
            >
              <span>⚙️</span>
              Settings
            </button>
            <button
              onClick={fetchAllCards}
              className="flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-xl text-sm font-medium shadow-sm border border-gray-200 transition-all hover:shadow-md"
            >
              <span>🔄</span>
              Refresh
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Settings Panel */}
        {showSettings ? (
          <div className="space-y-6">
            {!editingSettings ? (
              <div className="bg-white/80 backdrop-blur-xl rounded-3xl border border-gray-200/50 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">⚙️</span>
                    <h2 className="text-xl font-semibold text-gray-900">Loyalty Modules</h2>
                  </div>
                  <button
                    onClick={() => {
                      setEditingSettings(defaultSettings);
                      setIsCreatingNewModule(true);
                    }}
                    className="bg-black text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-800 transition-all"
                  >
                    + Add New Module
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {settingsList.length === 0 ? (
                    <div className="col-span-full py-12 text-center text-gray-400">
                      No loyalty modules created yet.
                    </div>
                  ) : (
                    settingsList.map((s) => (
                      <div key={s.id} className="bg-gray-50 rounded-2xl p-5 border border-gray-100 flex items-center justify-between">
                        <div>
                          <h3 className="font-bold text-gray-900">{s.cardTitle}</h3>
                          <p className="text-xs text-amber-600 font-medium">Target: {s.categoryName}</p>
                          <p className="text-[10px] text-gray-400 mt-1">
                            {s.isMilestoneMode ? 'Milestone Rewards' : `${s.coffeesRequiredForFree} coffees required`}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setEditingSettings(s)}
                            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                          >
                            ✎
                          </button>
                          <button
                            onClick={() => deleteModule(s.id)}
                            className="p-2 hover:bg-red-100 text-red-500 rounded-lg transition-colors"
                          >
                            🗑
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white/80 backdrop-blur-xl rounded-3xl border border-gray-200/50 p-6 shadow-sm space-y-6 animate-in fade-in slide-in-from-bottom-2">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setEditingSettings(null)} className="text-gray-400 hover:text-gray-900">← Back</button>
                    <h2 className="text-xl font-semibold text-gray-900">
                      {isCreatingNewModule ? 'New Loyalty Module' : `Edit: ${editingSettings.cardTitle}`}
                    </h2>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="col-span-full">
                    <label className="block text-gray-600 font-medium mb-2 text-sm">Target Category</label>
                    <select
                      value={editingSettings.categoryId || ''}
                      onChange={(e) => setEditingSettings({ ...editingSettings, categoryId: e.target.value ? parseInt(e.target.value) : null })}
                      className="w-full bg-gray-50 text-gray-900 px-4 py-2.5 rounded-xl border border-gray-200 focus:border-amber-400 outline-none transition-all"
                    >
                      <option value="">Global (All Categories)</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                    {!isCreatingNewModule && (
                      <p className="text-[10px] text-amber-600 mt-1 font-medium">⚠️ Changing category will reassign this module to a different set of products.</p>
                    )}
                  </div>

                  {/* Enable/Disable */}
                  <div className="col-span-full">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={editingSettings.enabled}
                          onChange={(e) => setEditingSettings({ ...editingSettings, enabled: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                      </div>
                      <span className="text-gray-700 font-medium">Module Active</span>
                    </label>
                  </div>

                  {/* Reward Mode Selection */}
                  <div className="col-span-full border-b border-gray-100 pb-4">
                    <label className="block text-gray-600 font-bold mb-3 text-sm">Reward System Type</label>
                    <div className="flex gap-4">
                      <button
                        onClick={() => setEditingSettings({ ...editingSettings, isMilestoneMode: false })}
                        className={`flex-1 py-3 px-4 rounded-2xl border-2 transition-all text-sm font-medium ${
                          !editingSettings.isMilestoneMode 
                            ? 'border-amber-400 bg-amber-50 text-amber-900 shadow-sm' 
                            : 'border-gray-100 bg-gray-50 text-gray-400 hover:border-gray-200'
                        }`}
                      >
                        Simple (Single Reward)
                      </button>
                      <button
                        onClick={() => setEditingSettings({ ...editingSettings, isMilestoneMode: true })}
                        className={`flex-1 py-3 px-4 rounded-2xl border-2 transition-all text-sm font-medium ${
                          editingSettings.isMilestoneMode 
                            ? 'border-amber-400 bg-amber-50 text-amber-900 shadow-sm' 
                            : 'border-gray-100 bg-gray-50 text-gray-400 hover:border-gray-200'
                        }`}
                      >
                        Milestone Rewards
                      </button>
                    </div>
                  </div>

                  {!editingSettings.isMilestoneMode ? (
                    <>
                      <div>
                        <label className="block text-gray-600 font-medium mb-2 text-sm">Items Required</label>
                        <input
                          type="number"
                          min="1"
                          value={editingSettings.coffeesRequiredForFree}
                          onChange={(e) => setEditingSettings({ ...editingSettings, coffeesRequiredForFree: parseInt(e.target.value) })}
                          className="w-full bg-gray-50 text-gray-900 px-4 py-2.5 rounded-xl border border-gray-200 focus:border-amber-400 outline-none transition-all"
                        />
                      </div>

                      <div>
                        <label className="block text-gray-600 font-medium mb-2 text-sm">Reward Type</label>
                        <select
                          value={editingSettings.rewardType}
                          onChange={(e) => setEditingSettings({ ...editingSettings, rewardType: e.target.value, rewardValue: e.target.value === 'FREE' ? 0 : editingSettings.rewardValue })}
                          className="w-full bg-gray-50 text-gray-900 px-4 py-2.5 rounded-xl border border-gray-200 focus:border-amber-400 outline-none transition-all"
                        >
                          <option value="FREE">Free Item</option>
                          <option value="PERCENTAGE">Percentage %</option>
                          <option value="FIXED_AMOUNT">Fixed ₱</option>
                        </select>
                      </div>

                      {editingSettings.rewardType !== 'FREE' && (
                        <div className="col-span-full md:col-span-1">
                          <label className="block text-gray-600 font-medium mb-2 text-sm">
                            {editingSettings.rewardType === 'PERCENTAGE' ? 'Discount Percentage (%)' : 'Discount Amount (₱)'}
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={editingSettings.rewardValue}
                            onChange={(e) => setEditingSettings({ ...editingSettings, rewardValue: parseFloat(e.target.value) || 0 })}
                            className="w-full bg-gray-50 text-gray-900 px-4 py-2.5 rounded-xl border border-gray-200 focus:border-amber-400 outline-none transition-all"
                          />
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="col-span-full space-y-4">
                      <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100">
                        <h3 className="text-amber-900 font-semibold text-sm mb-3 flex items-center gap-2">
                          <span>🏆</span> Milestone Configuration
                        </h3>
                        
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end mb-4 bg-white/50 p-3 rounded-xl border border-amber-200/50">
                          <div>
                            <label className="block text-gray-500 text-[10px] uppercase font-bold mb-1 ml-1">Target</label>
                            <input
                              type="number"
                              min="1"
                              value={newMilestoneTarget}
                              onChange={(e) => setNewMilestoneTarget(parseInt(e.target.value))}
                              className="w-full bg-white text-gray-900 px-3 py-2 rounded-lg border border-amber-200 text-sm focus:ring-2 focus:ring-amber-400 outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-gray-500 text-[10px] uppercase font-bold mb-1 ml-1">Type</label>
                            <select
                              value={newMilestoneType}
                              onChange={(e) => setNewMilestoneType(e.target.value)}
                              className="w-full bg-white text-gray-900 px-3 py-2 rounded-lg border border-amber-200 text-sm focus:ring-2 focus:ring-amber-400 outline-none"
                            >
                              <option value="FREE">Free Item</option>
                              <option value="PERCENTAGE">% Off</option>
                              <option value="FIXED_AMOUNT">₱ Off</option>
                            </select>
                          </div>
                          {newMilestoneType !== 'FREE' && (
                            <div>
                              <label className="block text-gray-500 text-[10px] uppercase font-bold mb-1 ml-1">Value</label>
                              <input
                                type="number"
                                min="0"
                                value={newMilestoneValue}
                                onChange={(e) => setNewMilestoneValue(parseFloat(e.target.value) || 0)}
                                className="w-full bg-white text-gray-900 px-3 py-2 rounded-lg border border-amber-200 text-sm focus:ring-2 focus:ring-amber-400 outline-none"
                              />
                            </div>
                          )}
                          <button
                            onClick={addMilestone}
                            className="bg-black text-white px-4 py-2 rounded-lg text-sm font-bold h-9.5 transition-all"
                          >
                            Add
                          </button>
                        </div>

                        <div className="space-y-2">
                          {editingSettings.milestones.map((m, idx) => (
                            <div key={idx} className="flex items-center justify-between bg-white px-4 py-3 rounded-xl border border-amber-200 shadow-sm">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center font-bold text-amber-700 text-sm">
                                  {m.target}
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-gray-900">
                                    {m.rewardType === 'FREE' ? '🎁 Free Piece' : m.rewardType === 'PERCENTAGE' ? `💰 ${m.rewardValue}% Off` : `💵 ₱${m.rewardValue} Off`}
                                  </p>
                                  <p className="text-[10px] text-gray-400">Target: {m.target}</p>
                                </div>
                              </div>
                              <button onClick={() => removeMilestone(m.target)} className="text-gray-300 hover:text-red-500 transition-colors p-1">✕</button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="col-span-full md:col-span-1">
                    <label className="block text-gray-600 font-medium mb-2 text-sm">Card Title</label>
                    <input
                      type="text"
                      value={editingSettings.cardTitle}
                      onChange={(e) => setEditingSettings({ ...editingSettings, cardTitle: e.target.value })}
                      className="w-full bg-gray-50 text-gray-900 px-4 py-2.5 rounded-xl border border-gray-200 focus:border-amber-400 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-600 font-medium mb-2 text-sm">Card Color</label>
                    <div className="flex gap-3 items-center">
                      <input
                        type="color"
                        value={editingSettings.cardColor}
                        onChange={(e) => setEditingSettings({ ...editingSettings, cardColor: e.target.value })}
                        className="w-12 h-12 rounded-xl cursor-pointer border border-gray-200"
                      />
                      <input
                        type="text"
                        value={editingSettings.cardColor}
                        onChange={(e) => setEditingSettings({ ...editingSettings, cardColor: e.target.value })}
                        className="flex-1 bg-gray-50 text-gray-900 px-4 py-2.5 rounded-xl border border-gray-200 focus:border-amber-400 outline-none font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-gray-600 font-medium mb-2 text-sm">Card Description</label>
                  <textarea
                    value={editingSettings.cardDescription}
                    onChange={(e) => setEditingSettings({ ...editingSettings, cardDescription: e.target.value })}
                    className="w-full bg-gray-50 text-gray-900 px-4 py-2.5 rounded-xl border border-gray-200 focus:border-amber-400 outline-none h-20 resize-none"
                  />
                </div>

                {/* Preview */}
                <div
                  style={{ backgroundColor: editingSettings.cardColor }}
                  className="rounded-2xl p-6 text-white shadow-lg max-w-md relative overflow-hidden mx-auto"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-full -mr-16 -mt-16"></div>
                  <h3 className="text-xl font-bold mb-2 relative z-10">{editingSettings.cardTitle}</h3>
                  <p className="text-sm opacity-90 mb-4 relative z-10">{editingSettings.cardDescription}</p>
                  
                  <div className="flex gap-2 justify-center mb-3 relative z-10 flex-wrap">
                    {Array.from({ length: Math.min(10, editingSettings.isMilestoneMode && editingSettings.milestones.length > 0 
                      ? Math.max(...editingSettings.milestones.map(m => m.target)) 
                      : editingSettings.coffeesRequiredForFree) 
                    }).map((_, i) => (
                      <div key={i} className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold border-2 ${i < 3 ? 'bg-white text-gray-900' : 'bg-transparent border-white/20'}`}>
                        {editingSettings.isMilestoneMode && editingSettings.milestones.find(m => m.target === i + 1) ? '✨' : '☕'}
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] opacity-70 text-center relative z-10">PREVIEW VERSION (Max 10 slots shown)</p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setEditingSettings(null)}
                    className="flex-1 bg-gray-100 text-gray-700 font-semibold py-3 rounded-xl transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveSettings}
                    disabled={savingSettings}
                    className="flex-2 bg-black text-white font-semibold py-3 rounded-xl transition-all hover:bg-gray-800 disabled:opacity-50 shadow-lg"
                  >
                    {savingSettings ? 'Saving...' : 'Save Module'}
                  </button>
                </div>
              </div>
            )}

            {settingsMessage && (
              <div className={`p-4 rounded-xl text-center font-medium ${settingsMessage.includes('success') ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                {settingsMessage}
              </div>
            )}
          </div>
        ) : (
          <>


            {/* Stats - Apple Card Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-5 border border-gray-200/50 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                    <span className="text-lg">👥</span>
                  </div>
                  <p className="text-gray-500 text-sm font-medium">{cards.length}</p>
                </div>
                <p className="text-2xl font-bold text-gray-900">Total Customers</p>
              </div>
              <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-5 border border-amber-200/50 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                    <span className="text-lg">☕</span>
                  </div>
                  <p className="text-gray-500 text-sm font-medium">{totalCoffees}</p>
                </div>
                <p className="text-2xl font-bold text-gray-900">Coffees Earned</p>
              </div>
              <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-5 border border-green-200/50 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                    <span className="text-lg">🎁</span>
                  </div>
                  <p className="text-gray-500 text-sm font-medium">{totalRewards}</p>
                </div>
                <p className="text-2xl font-bold text-green-600">Rewards Available</p>
              </div>
              <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-5 border border-purple-200/50 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                    <span className="text-lg">🎫</span>
                  </div>
                  <p className="text-gray-500 text-sm font-medium">{activeVouchers}</p>
                </div>
                <p className="text-2xl font-bold text-purple-600">Active Vouchers</p>
              </div>
            </div>

            {/* Search and Filter */}
            <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-4 border border-gray-200/50 shadow-sm">
              <div className="flex gap-3 items-center">
                <div className="flex-1 relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                  <input
                    type="text"
                    placeholder="Search customers..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-gray-50 text-gray-900 pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none transition-all"
                  />
                </div>
                <span className="text-sm text-gray-500 bg-gray-100 px-3 py-2 rounded-xl font-medium">
                  {filteredCards.length} customer{filteredCards.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>

            {/* Customer Cards Grid */}
            {loadingCards ? (
              <div className="flex items-center justify-center py-16">
                <div className="text-gray-400">Loading customers...</div>
              </div>
            ) : filteredCards.length === 0 ? (
              <div className="bg-white/60 backdrop-blur-xl rounded-3xl border border-gray-200/50 p-12 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">☕</span>
                </div>
                <p className="text-gray-500 font-medium">No customers found</p>
                <p className="text-gray-400 text-sm mt-1">Customers will appear here when they join the loyalty program</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredCards.map((card) => (
                  <button
                    key={card.id}
                    onClick={() => setSelectedCard(card)}
                    className={`bg-white/80 backdrop-blur-xl rounded-2xl p-5 border text-left transition-all hover:shadow-lg hover:scale-[1.02] ${
                      selectedCard?.id === card.id 
                        ? 'border-amber-400 ring-2 ring-amber-100' 
                        : 'border-gray-200/50 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold ${
                          card.rewardsAvailable > 0 
                            ? 'bg-amber-100 text-amber-700' 
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {card.customerName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{card.customerName.toUpperCase()}</p>
                          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-gray-500">
                            {card.membershipCode || 'NO CODE'}
                          </p>
                          <p className="text-xs text-gray-400">
                            {card.lastRewardRedeemDate 
                              ? `Last: ${new Date(card.lastRewardRedeemDate).toLocaleDateString()}`
                              : 'No rewards yet'
                            }
                          </p>
                        </div>
                      </div>
                      {card.rewardsAvailable > 0 && (
                        <span className="bg-amber-100 text-amber-700 text-xs px-2 py-1 rounded-full font-medium">
                          {card.rewardsAvailable} reward{card.rewardsAvailable !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-linear-to-r from-amber-400 to-amber-500 rounded-full transition-all"
                          style={{ width: `${Math.min((card.coffeesCompleted / card.coffeesRequiredForFree) * 100, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-gray-500 whitespace-nowrap">
                        {card.coffeesCompleted}/{card.coffeesRequiredForFree}
                      </span>

                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Customer Details Modal */}
            {selectedCard && !showSettings && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl">
                  {/* Modal Header */}
                  <div className="sticky top-0 bg-white rounded-t-3xl p-6 border-b border-gray-100">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold ${
                          selectedCard.rewardsAvailable > 0 
                            ? 'bg-amber-100 text-amber-700' 
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {selectedCard.customerName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          {editingCustomerName ? (
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={editedName || ''}
                                onChange={(e) => setEditedName(e.target.value)}
                                className="bg-gray-100 text-gray-900 px-3 py-1.5 rounded-lg border border-gray-200 focus:border-amber-400 outline-none"
                                autoFocus
                              />
                              <button
                                onClick={updateCustomerName}
                                disabled={savingCustomer}
                                className="bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => { setEditingCustomerName(false); setEditedName(''); }}
                                className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-medium"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <>
                              <h2 className="text-xl font-bold text-gray-900">{selectedCard.customerName}</h2>
                              <p className="text-sm text-gray-500">
                                {selectedCard.membershipCode ? `Member # ${selectedCard.membershipCode}` : 'Loyalty Member'}
                              </p>
                            </>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedCard(null)}
                        className="w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center text-gray-500 transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                    {!editingCustomerName && (
                      <>
                      <div className="flex gap-2 mt-4">
                        <button
                          onClick={() => { setEditingCustomerName(true); setEditedName(selectedCard.customerName); }}
                          className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                        >
                          ✎ Edit Name
                        </button>
                        <button
                          onClick={deleteCustomer}
                          disabled={deletingCustomer}
                          className="flex items-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                        >
                          🗑 Delete
                        </button>
                      </div>
                      <div className="mt-3">
                        <button
                          onClick={() => setShowAddPointsModal(true)}
                          className="flex items-center gap-1.5 bg-amber-100 hover:bg-amber-200 text-amber-800 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors w-full"
                        >
                          + Add Points
                        </button>
                      </div>
                      </>
                    )}
                  </div>

                  {/* Modal Content */}
                  <div className="p-6 space-y-6">
                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-gray-50 rounded-2xl p-4 text-center">
                        <p className="text-2xl font-bold text-gray-900">{selectedCard.coffeesCompleted}</p>
                        <p className="text-xs text-gray-500 mt-1">Coffees</p>
                      </div>
                      <div className="bg-amber-50 rounded-2xl p-4 text-center">
                        <p className="text-2xl font-bold text-amber-600">{selectedCard.rewardsAvailable}</p>
                        <p className="text-xs text-amber-600 mt-1">Rewards</p>
                      </div>
                      <div className="bg-gray-50 rounded-2xl p-4 text-center">
                        <p className="text-lg font-bold text-gray-900">
                          {selectedCard.lastRewardRedeemDate 
                            ? new Date(selectedCard.lastRewardRedeemDate).toLocaleDateString()
                            : '—'
                          }
                        </p>
                        <p className="text-xs text-gray-500 mt-1">Last Reward</p>
                      </div>
                    </div>

                    {/* Progress */}
                    <div className="bg-gray-50 rounded-2xl p-4">
                      <p className="text-sm font-medium text-gray-600 mb-3">Progress to next reward</p>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-linear-to-r from-amber-400 to-amber-500 rounded-full transition-all"
                            style={{ width: `${Math.min((selectedCard.coffeesCompleted / selectedCard.coffeesRequiredForFree) * 100, 100)}%` }}
                          />
                        </div>
                        <span className="text-sm font-semibold text-gray-700">
                          {selectedCard.coffeesCompleted}/{selectedCard.coffeesRequiredForFree}
                        </span>

                      </div>
                      <p className="text-xs text-gray-400 mt-2">
                        {selectedCard.coffeesRequiredForFree - selectedCard.coffeesCompleted > 0 
                          ? `${selectedCard.coffeesRequiredForFree - selectedCard.coffeesCompleted} more coffee${selectedCard.coffeesRequiredForFree - selectedCard.coffeesCompleted !== 1 ? 's' : ''} until reward`
                          : 'Reward available!'
                        }

                      </p>
                    </div>

                    {/* Vouchers */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">My Vouchers</h3>
                      {loadingVouchers ? (
                        <p className="text-gray-400">Loading...</p>
                      ) : vouchers.length === 0 ? (
                        <div className="bg-gray-50 rounded-2xl p-6 text-center">
                          <p className="text-gray-500 font-medium">No vouchers yet</p>
                          <p className="text-xs text-gray-400 mt-1">Vouchers will appear when rewards are earned</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {/* Active */}
                          {vouchers.filter(v => v.status === 'ACTIVE').length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Active</p>
                              <div className="space-y-2">
                                {vouchers.filter(v => v.status === 'ACTIVE').map((voucher) => (
                                  <div key={voucher.id} className="bg-green-50 rounded-xl p-4 border border-green-200">
                                    <div className="flex justify-between items-start">
                                      <div>
                                        <p className="font-mono font-bold text-green-700">{voucher.code}</p>
                                        <p className="text-sm text-green-600 mt-0.5">{voucher.rewardType}</p>
                                      </div>
                                      <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full font-medium">ACTIVE</span>
                                    </div>
                                    {voucher.expiryDate && (
                                      <p className="text-xs text-green-500 mt-2">Expires: {new Date(voucher.expiryDate).toLocaleDateString()}</p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Redeemed */}
                          {vouchers.filter(v => v.status === 'REDEEMED').length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Redeemed</p>
                              <div className="space-y-2">
                                {vouchers.filter(v => v.status === 'REDEEMED').slice(0, 3).map((voucher) => (
                                  <div key={voucher.id} className="bg-gray-50 rounded-xl p-3 border border-gray-200 opacity-70">
                                    <div className="flex justify-between items-center">
                                      <p className="font-mono font-bold text-gray-500">{voucher.code}</p>
                                      <span className="bg-gray-300 text-gray-600 text-xs px-2 py-0.5 rounded-full font-medium">REDEEMED</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

              {/* Add Points Modal */}
              {showAddPointsModal && selectedCard && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                  <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl">
                    <div className="p-6 border-b border-gray-100">
                      <h3 className="text-xl font-bold text-gray-900">Add Points for {selectedCard.customerName}</h3>
                    </div>
                    <div className="p-6 space-y-4">
                      <div>
                        <label className="block text-gray-600 font-medium mb-2 text-sm">Number of Points</label>
                        <input
                          type="number"
                          min="1"
                          max="99"
                          value={addPointsQuantity}
                          onChange={(e) => setAddPointsQuantity(Math.max(1, Math.min(99, parseInt(e.target.value) || 1)))}
                          className="w-full bg-gray-50 text-gray-900 px-4 py-3 rounded-xl border border-gray-200 focus:border-amber-400 outline-none transition-all text-lg text-center"
                        />
                      </div>
                      <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
                        <p className="text-xs text-amber-700">Adding points will increase the customer's coffee count. If they reach the reward threshold, a voucher will be generated automatically.</p>
                      </div>
                    </div>
                    <div className="p-6 border-t border-gray-100 flex gap-3">
                      <button
                        onClick={() => setShowAddPointsModal(false)}
                        className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={addPoints}
                        disabled={addPointsLoading || addPointsQuantity <= 0}
                        className="flex-1 bg-amber-600 text-white py-3 rounded-xl font-semibold hover:bg-amber-500 disabled:opacity-50 transition-colors"
                      >
                        {addPointsLoading ? 'Adding...' : 'Add Points'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
        )}


      </main>
    </div>
  );
}

