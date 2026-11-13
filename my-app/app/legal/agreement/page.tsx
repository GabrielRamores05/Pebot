import Link from 'next/link';
import AgreementReader from './AgreementReader';

export const metadata = { title: 'Pebot license agreement' };

export default function AgreementPage() {
  return (
    <main className="min-h-screen bg-page px-5 py-10 text-ink sm:px-8">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm text-muted hover:text-ink">
          ← Back
        </Link>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">Pebot license agreement</h1>
        <p className="mt-1 mb-6 text-sm text-muted">The terms you accepted when you installed Pebot.</p>
        <AgreementReader />
      </div>
    </main>
  );
}
