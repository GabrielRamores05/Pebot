import Link from 'next/link';

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center text-white p-6 text-center">
      <div className="text-7xl mb-4">🔒</div>
      <h1 className="text-3xl font-bold mb-2">Access Denied</h1>
      <p className="text-gray-400 mb-8">You don&apos;t have permission to access this page.</p>
      <div className="flex gap-4">
        <Link href="/login" className="bg-amber-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-amber-500 transition-colors">
          Back to Login
        </Link>
        <Link href="/" className="bg-gray-800 text-gray-300 px-6 py-3 rounded-xl font-semibold hover:bg-gray-700 transition-colors">
          Home
        </Link>
      </div>
    </div>
  );
}
