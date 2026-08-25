'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoyaltySettingsPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to loyalty management page
    router.push('/admin/loyalty');
  }, [router]);

  return (
    <div className="flex items-center justify-center h-screen text-gray-400">
      <p>Redirecting to Loyalty Management...</p>
    </div>
  );
}
