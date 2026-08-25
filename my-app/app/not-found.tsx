import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#fffaf4] px-6 text-stone-900">
      <div className="w-full max-w-md rounded-3xl border border-[#e7d7ba] bg-white p-8 text-center shadow-lg shadow-[#1f1a17]/5">
        <div className="mb-4 text-5xl">📍</div>
        <h2 className="text-2xl font-bold">Page not found</h2>
        <p className="mt-3 text-sm text-stone-600">
          The page you requested does not exist or is no longer available.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center justify-center rounded-xl bg-[#1f1a17] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#312922]"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
