'use client';

// Spec 019: print a document from any screen.
// In the Pebot desktop app: silent printing to the chosen printer (electron/preload.js).
// In a browser (tablets, phones, another PC on the LAN): the normal print dialog.

export interface DesktopPrinter {
  name: string;
  displayName: string;
  isDefault: boolean;
}

interface PebotDesktop {
  listPrinters: () => Promise<DesktopPrinter[]>;
  printHtml: (html: string, options: { printer?: string | null }) => Promise<{ ok: boolean; error?: string }>;
}

function desktop(): PebotDesktop | null {
  if (typeof window === 'undefined') return null;
  return (window as unknown as { pebotDesktop?: PebotDesktop }).pebotDesktop ?? null;
}

export function isDesktopApp(): boolean {
  return desktop() !== null;
}

export async function listPrinters(): Promise<DesktopPrinter[]> {
  const d = desktop();
  return d ? d.listPrinters() : [];
}

/** Print an HTML document. Resolves when it was handed to the printer (or dialog). */
export async function printHtml(html: string, options: { printer?: string | null } = {}): Promise<{ ok: boolean; error?: string }> {
  const d = desktop();
  if (d) return d.printHtml(html, { printer: options.printer ?? null });

  // Browser: render in a hidden frame and open the print dialog for it.
  return new Promise((resolve) => {
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    frame.srcdoc = html;
    frame.onload = () => {
      try {
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
        resolve({ ok: true });
      } catch (e) {
        resolve({ ok: false, error: e instanceof Error ? e.message : 'Print failed' });
      } finally {
        window.setTimeout(() => frame.remove(), 60_000);
      }
    };
    document.body.appendChild(frame);
  });
}
