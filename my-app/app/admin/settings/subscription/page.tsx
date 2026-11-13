import { redirect } from 'next/navigation';

// Subscription tiers were replaced by the one-time Pebot license (spec 015).
export default function SubscriptionPage() {
  redirect('/admin/settings/license');
}
