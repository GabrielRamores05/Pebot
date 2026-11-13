import LicensePanel from './LicensePanel';

export default function LicenseSettingsPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight text-ink">License</h1>
      <p className="mb-6 text-sm text-muted">Your Pebot license for this location.</p>
      <LicensePanel />
    </div>
  );
}
