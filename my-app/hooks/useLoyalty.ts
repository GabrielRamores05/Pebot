'use client';

import { useState, useEffect, useCallback } from 'react';
import { useCartStore } from '@/store/cartStore';

interface LoyaltyCard {
  rewardsAvailable: number;
  hasUnclaimedVoucher: boolean;
  // Add other properties as needed
}

interface LoyaltySettings {
  // Add settings properties as needed
}

interface SelectedLoyaltyVoucher {
  customerName: string;
  codes: string[];
  voucherIds: number[];
}

interface UseLoyaltyReturn {
  loyaltyCard: LoyaltyCard | null;
  loyaltySettings: LoyaltySettings | null;
  availableFreeCoffees: number;
  claimingFreeCoffee: boolean;
  loyaltyVouchers: SelectedLoyaltyVoucher | null;
  isNameFromLoyalty: boolean;
  coffeeProductPrice: number | null;
  removeLoyaltyVouchers: () => void;
  removeAndRestoreRewards: () => void;
  calculateLoyaltyDiscount: () => number;
  setClaimingFreeCoffee: (value: boolean) => void;
}

export function useLoyalty(): UseLoyaltyReturn {
  const cartStore = useCartStore();
  const [loyaltyCard, setLoyaltyCard] = useState<LoyaltyCard | null>(null);
  const [loyaltySettings, setLoyaltySettings] = useState<LoyaltySettings | null>(null);
  const [availableFreeCoffees, setAvailableFreeCoffees] = useState(0);
  const [claimingFreeCoffee, setClaimingFreeCoffee] = useState(false);
  const [loyaltyVouchers, setLoyaltyVouchers] = useState<SelectedLoyaltyVoucher | null>(null);
  const [isNameFromLoyalty, setIsNameFromLoyalty] = useState(false);
  const [coffeeProductPrice, setCoffeeProductPrice] = useState<number | null>(null);

  // Fetch coffee product price for loyalty discount calculations
  useEffect(() => {
    fetch('/api/products')
      .then((r) => r.json())
      .then((products) => {
        const coffeeProduct = products.find((p: any) => 
          p.category?.name?.toLowerCase() === 'coffee' && p.available
        );
        if (coffeeProduct) {
          setCoffeeProductPrice(coffeeProduct.price);
        }
      })
      .catch(() => {});
  }, []);

  // Auto-fill customer name from loyalty registration if available
  useEffect(() => {
    try {
      const storedLoyaltyName = localStorage.getItem('loyaltyCustomerName');
      if (storedLoyaltyName) {
        // If loyalty name exists in storage, mark it as from loyalty
        if (!cartStore.customerName) {
          cartStore.setCustomerName(storedLoyaltyName);
        }
        setIsNameFromLoyalty(true);
      } else {
        setIsNameFromLoyalty(false);
      }
    } catch {}
  }, [cartStore]);

  // Fetch loyalty card and settings to calculate free coffees
  useEffect(() => {
    if (!isNameFromLoyalty || !cartStore.customerName) {
      setLoyaltyCard(null);
      setAvailableFreeCoffees(0);
      return;
    }

    // Fetch loyalty data
    Promise.all([
      fetch(`/api/loyalty/cards/${encodeURIComponent(cartStore.customerName)}`).then(r => r.json()),
      fetch('/api/loyalty/settings').then(r => r.json()),
    ])
      .then(([card, settings]) => {
        setLoyaltyCard(card);
        setLoyaltySettings(settings);
        
        // In sequential system, activeVoucherCount is the number of ready-to-claim vouchers
        setAvailableFreeCoffees(card.hasUnclaimedVoucher ? 1 : 0);
      })
      .catch((err) => {
        console.error('Error fetching loyalty data:', err);
      });
  }, [isNameFromLoyalty, cartStore.customerName]);

  // Load selected loyalty vouchers from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('selectedLoyaltyVouchers');
      if (stored) {
        setLoyaltyVouchers(JSON.parse(stored));
      }
    } catch {}
  }, []);

  // Real-time sync: Watch for localStorage changes (when voucher is claimed from menu page)
  useEffect(() => {
    function handleStorageChange() {
      try {
        const stored = localStorage.getItem('selectedLoyaltyVouchers');
        if (stored) {
          setLoyaltyVouchers(JSON.parse(stored));
        } else {
          setLoyaltyVouchers(null);
        }
      } catch {}
    }

    // Listen for storage changes from other tabs/windows
    window.addEventListener('storage', handleStorageChange);

    // Also poll every 500ms for in-same-window changes (menu modal)
    const interval = setInterval(handleStorageChange, 500);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  function removeLoyaltyVouchers() {
    setLoyaltyVouchers(null);
    localStorage.removeItem('selectedLoyaltyVouchers');
  }

  function removeAndRestoreRewards() {
    // When removing claimed rewards, restore them to available count
    removeLoyaltyVouchers();
    
    // Reset available free coffees to what the card shows
    if (loyaltyCard) {
      setAvailableFreeCoffees(loyaltyCard.rewardsAvailable || 0);
    }
  }

  // Calculate loyalty discount based on coffee product price
  const calculateLoyaltyDiscount = useCallback((): number => {
    if (!loyaltyVouchers || loyaltyVouchers.codes.length === 0) return 0;
    if (coffeeProductPrice === null) return 0;
    
    // Discount = coffee price × number of vouchers redeemed
    return coffeeProductPrice * loyaltyVouchers.codes.length;
  }, [loyaltyVouchers, coffeeProductPrice]);

  return {
    loyaltyCard,
    loyaltySettings,
    availableFreeCoffees,
    claimingFreeCoffee,
    loyaltyVouchers,
    isNameFromLoyalty,
    coffeeProductPrice,
    removeLoyaltyVouchers,
    removeAndRestoreRewards,
    calculateLoyaltyDiscount,
    setClaimingFreeCoffee
  };
}