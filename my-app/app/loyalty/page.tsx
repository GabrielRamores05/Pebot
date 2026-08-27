import { redirect } from 'next/navigation';

export default function LoyaltyPage() {
  redirect('/menu?loyalty=1');
}
