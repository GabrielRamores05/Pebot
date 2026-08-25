'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSubscriptionStore } from '@/store/subscriptionStore';
import type { SubscriptionTier } from '@/lib/subscription';

export default function SubscriptionManagementPage() {
  const router = useRouter();
  const { subscription, loading, error, refreshSubscription } = useSubscriptionStore.getState();
  const [upgrading, setUpgrading] = useState(false);
  const [upgradeTo, setUpgradeTo] = useState<'REGULAR' | 'MEDIUM' | 'PREMIUM' | null>(null);

  useEffect(() => {
    // In a real app, we would fetch the current user's subscription
    // For now, we'll simulate it with mock data
    const mockUserId = 1; // Admin user ID
    refreshSubscription(mockUserId);
  }, [refreshSubscription]);

  const handleUpgrade = async (tier: 'REGULAR' | 'MEDIUM' | 'PREMIUM') => {
    setUpgradeTo(tier);
    setUpgrading(true);
    
    try {
      // In a real app, we would call an API to upgrade subscription
      // For now, we'll simulate the upgrade
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Update local store (in real app, this would come from server response)
      useSubscriptionStore.getState().fetchSubscription(1); // Refetch
      
      alert(`Successfully upgraded to ${tier} tier!`);
      setUpgrading(false);
      setUpgradeTo(null);
      
      // Refresh the page to show updated UI
      router.refresh();
    } catch (err) {
      console.error('Upgrade failed:', err);
      alert('Upgrade failed. Please try again.');
      setUpgrading(false);
    }
  };

  const getTierDetails = (tier: 'REGULAR' | 'MEDIUM' | 'PREMIUM') => {
    switch (tier) {
      case 'REGULAR':
        return {
          label: 'Regular',
          price: '$0/month',
          features: [
            'Live Orders',
            'Terminal Mode',
            'Table Management',
            'Basic Loyalty Program'
          ],
          color: 'gray'
        };
      case 'MEDIUM':
        return {
          label: 'Medium',
          price: '$299/month',
          features: [
            'All Regular features',
            'Analytics Dashboard',
            'Inventory Management',
            'Kitchen Display System',
            'Enhanced Loyalty Program'
          ],
          color: 'amber'
        };
      case 'PREMIUM':
        return {
          label: 'Premium',
          price: '$599/month',
          features: [
            'All Medium features',
            'Staff Management',
            'Settings Configuration',
            'Advanced Analytics',
            'Priority Support',
            'Multi-location Support'
          ],
          color: 'emerald'
        };
    }
  };

  if (loading) {
    return <div className="p-8">Loading subscription information...</div>;
  }

  if (error) {
    return <div className="p-8 text-red-500">Error loading subscription: {error}</div>;
  }

  const currentTier = subscription?.tier as 'REGULAR' | 'MEDIUM' | 'PREMIUM' || 'REGULAR';

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Subscription Management</h1>
        <p className="mt-2 text-gray-600">
          View and manage your CaféOS subscription plan
        </p>
      </div>

      {/* Current Subscription */}
      <div className="bg-white rounded-xl shadow-md p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4">Current Subscription</h2>
        <div className="flex items-start">
          <div className={`w-12 h-12 rounded-full bg-${getTierDetails(currentTier).color}-100 flex items-center justify-center mr-4`}>
            <span className={`text-${getTierDetails(currentTier).color}-600 font-bold text-xl`}>
              {getTierDetails(currentTier).label.charAt(0)}
            </span>
          </div>
          <div>
            <h3 className="font-medium">{getTierDetails(currentTier).label} Tier</h3>
            <p className="text-gray-500">{getTierDetails(currentTier).price}</p>
            <p className="mt-2 text-sm text-gray-600">
              {subscription?.isActive ? 'Active' : 'Inactive'}
            </p>
          </div>
        </div>
      </div>

       {/* Subscription Comparison */}
       <div className="mb-8">
         <h2 className="text-lg font-semibold mb-6">Available Plans</h2>
           <div className="grid gap-6">
             {[
   'REGULAR',
   'MEDIUM',
   'PREMIUM'
 ].map((tier) => {
               const details = getTierDetails(tier as 'REGULAR' | 'MEDIUM' | 'PREMIUM');
             const isCurrent = tier === currentTier;
             const isUpgrading = upgrading && upgradeTo === tier;
            
            return (
              <div
                key={tier}
                className={`border rounded-xl p-6 ${isCurrent ? 'border-amber-300 bg-amber-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'} transition-all duration-200`}
              >
                <div className="flex items-start mb-4">
                  <div className={`w-10 h-10 rounded-full bg-${details.color}-100 flex items-center justify-center mr-3`}>
                    <span className={`text-${details.color}-600 font-bold text-xl`}>
                      {details.label.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-medium">{details.label} Tier</h3>
                    <p className="text-gray-500">{details.price}</p>
                  </div>
                </div>
                
                <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 mb-4">
                  {details.features.map((feature, index) => (
                    <li key={index}>{feature}</li>
                  ))}
                </ul>
                
                  {!isCurrent && !isUpgrading ? (
                    <button
                      onClick={() => handleUpgrade(tier as 'REGULAR' | 'MEDIUM' | 'PREMIUM')}
                      className={`w-full bg-${details.color}-600 hover:bg-${details.color}-700 text-white font-medium py-2 px-4 rounded-lg transition-colors`}
                    >
                      Upgrade to {details.label}
                    </button>
                 ) : isUpgrading ? (
                   <div className="w-full bg-gray-200 h-2.5 rounded-full mb-2">
                     <div className="bg-amber-600 h-2.5 rounded-full w-[33%] transition-all duration-1500"></div>
                   </div>
                 ) : (
                   <p className="text-sm text-gray-500 font-medium">Current plan</p>
                 )}
              </div>
            );
          })}
        </div>
      </div>

       {/* Features not available in current tier */}
       {(!useSubscriptionStore.getState().hasFeature('analytics') || !useSubscriptionStore.getState().hasFeature('inventory') || 
         !useSubscriptionStore.getState().hasFeature('staff') || !useSubscriptionStore.getState().hasFeature('settings')) && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-6 mb-8">
          <div className="flex">
            <div className="flex-shrink-0">
              <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center bg-yellow-400 text-yellow-100 rounded-full">
                <span className="text-xs font-medium">!</span>
              </div>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">Feature Access Notice</h3>
              <p className="mt-1 text-sm text-yellow-700">
                Some features are not available in your current {getTierDetails(currentTier).label} tier. 
                Consider upgrading to access additional functionality.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}