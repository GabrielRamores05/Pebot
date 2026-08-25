'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="bg-[#fffaf4] text-stone-900 antialiased">
        <div className="flex min-h-screen items-center justify-center px-6">
          <div className="w-full max-w-md rounded-3xl border border-[#e7d7ba] bg-white p-8 text-center shadow-lg shadow-[#1f1a17]/5">
            <div className="mb-4 text-5xl">🚨</div>
            <h2 className="text-2xl font-bold">Critical app error</h2>
            <p className="mt-3 text-sm text-stone-600">
              The application encountered a fatal error and needs to reload.
            </p>
            {error?.digest && (
              <p className="mt-3 text-xs text-stone-400">Error ID: {error.digest}</p>
            )}
            <button
              onClick={() => reset()}
              className="mt-6 inline-flex items-center justify-center rounded-xl bg-[#1f1a17] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#312922]"
            >
              Reload app
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
