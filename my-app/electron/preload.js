// Spec 019: the only bridge between the Pebot web app and the desktop shell.
// It exposes printing and nothing else.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pebotDesktop', {
  /** Printers installed on this PC: [{ name, displayName, isDefault }]. */
  listPrinters: () => ipcRenderer.invoke('pebot:list-printers'),
  /**
   * Print an HTML document. With a printer name it prints silently to that printer;
   * without one it shows the Windows print dialog.
   * Resolves { ok: boolean, error?: string }.
   */
  printHtml: (html, options) => ipcRenderer.invoke('pebot:print-html', String(html ?? ''), options ?? {}),
});
