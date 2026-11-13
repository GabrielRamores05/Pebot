// Stroke-only SVG icon components for Pebot UI
// All icons use stroke, no fill. Default size 20x20, strokeWidth 1.75.

type IconProps = { size?: number; strokeWidth?: number; className?: string };
const d = (size = 20, sw = 1.75, cls = '') => ({
  width: size, height: size, viewBox: '0 0 24 24',
  fill: 'none', stroke: 'currentColor', strokeWidth: sw,
  strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  className: cls,
});

export function IconMonitor({ size, strokeWidth, className }: IconProps) {
  return (
    <svg {...d(size, strokeWidth, className)}>
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}

export function IconTerminal({ size, strokeWidth, className }: IconProps) {
  return (
    <svg {...d(size, strokeWidth, className)}>
      <rect x="2" y="3" width="20" height="18" rx="2" />
      <path d="M8 10l3 3-3 3M13 16h3" />
    </svg>
  );
}

export function IconTable({ size, strokeWidth, className }: IconProps) {
  return (
    <svg {...d(size, strokeWidth, className)}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

export function IconProducts({ size, strokeWidth, className }: IconProps) {
  return (
    <svg {...d(size, strokeWidth, className)}>
      <path d="M3 6h18M3 12h18M3 18h18" />
      <circle cx="7" cy="6" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="7" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="7" cy="18" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconAnalytics({ size, strokeWidth, className }: IconProps) {
  return (
    <svg {...d(size, strokeWidth, className)}>
      <path d="M3 3v18h18" />
      <path d="M7 16l4-5 4 3 4-6" />
    </svg>
  );
}

export function IconInventory({ size, strokeWidth, className }: IconProps) {
  return (
    <svg {...d(size, strokeWidth, className)}>
      <path d="M21 8l-9-5-9 5v8l9 5 9-5V8z" />
      <path d="M12 3v18M3 8l9 5 9-5" />
    </svg>
  );
}

export function IconKitchen({ size, strokeWidth, className }: IconProps) {
  return (
    <svg {...d(size, strokeWidth, className)}>
      <path d="M6 13.87A4 4 0 017.41 6a5.11 5.11 0 0111.18 0A4 4 0 0118 13.87V21H6v-7.13z" />
      <line x1="6" y1="17" x2="18" y2="17" />
    </svg>
  );
}

export function IconQR({ size, strokeWidth, className }: IconProps) {
  return (
    <svg {...d(size, strokeWidth, className)}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M14 14h3v3h-3zM17 17h4M17 21v-4M21 14v3" />
    </svg>
  );
}

export function IconLogout({ size, strokeWidth, className }: IconProps) {
  return (
    <svg {...d(size, strokeWidth, className)}>
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

export function IconSettings({ size, strokeWidth, className }: IconProps) {
  return (
    <svg {...d(size, strokeWidth, className)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  );
}

export function IconCoffee({ size, strokeWidth, className }: IconProps) {
  return (
    <svg {...d(size, strokeWidth, className)}>
      <path d="M17 8h1a4 4 0 010 8h-1" />
      <path d="M3 8h14v9a4 4 0 01-4 4H7a4 4 0 01-4-4V8z" />
      <line x1="6" y1="2" x2="6" y2="5" />
      <line x1="10" y1="2" x2="10" y2="5" />
      <line x1="14" y1="2" x2="14" y2="5" />
    </svg>
  );
}

export function IconDownload({ size, strokeWidth, className }: IconProps) {
  return (
    <svg {...d(size, strokeWidth, className)}>
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

export function IconUpload({ size, strokeWidth, className }: IconProps) {
  return (
    <svg {...d(size, strokeWidth, className)}>
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

export function IconHistory({ size, strokeWidth, className }: IconProps) {
  return (
    <svg {...d(size, strokeWidth, className)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  );
}

export function IconConsultant({ size, strokeWidth, className }: IconProps) {
  return (
    <svg {...d(size, strokeWidth, className)}>
      <path d="M21 15a2 2 0 01-2 2H7a2 2 0 010-4h14a2 2 0 012 2z" />
      <path d="M9 7a3 3 0 116 0 3 3 0 01-6 0z" />
      <path d="M9 7a3 3 0 016 0M9 7l3 3" />
      <circle cx="8" cy="14" r="2" fill="currentColor" stroke="none" />
      <circle cx="16" cy="14" r="2" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconAudit({ size, strokeWidth, className }: IconProps) {
  return (
    <svg {...d(size, strokeWidth, className)}>
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <path d="M8 13h8" />
      <path d="M8 17h8" />
      <circle cx="12" cy="10" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconStar({ size, strokeWidth, className }: IconProps) {
  return (
    <svg {...d(size, strokeWidth, className)}>
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.57l-6.18 3.25L7.91 14.14z" />
    </svg>
  );
}
