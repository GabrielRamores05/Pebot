'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#fffaf4] px-6 text-stone-900">
      <div className="w-full max-w-md rounded-3xl border border-[#e7d7ba] bg-white p-8 text-center shadow-lg shadow-[#1f1a17]/5">
        <div className="mb-4 text-5xl">⚠️</div>
        <h2 className="text-2xl font-bold">Something went wrong</h2>
        <p className="mt-3 text-sm text-stone-600">
          The app hit an unexpected error. You can retry this action or reload the page.
        </p>
        {error?.digest && (
          <p className="mt-3 text-xs text-stone-400">Error ID: {error.digest}</p>
        )}
        <button
          onClick={() => reset()}
          className="mt-6 inline-flex items-center justify-center rounded-xl bg-[#1f1a17] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#312922]"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
