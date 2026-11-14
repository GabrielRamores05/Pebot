'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { fetchJson, userMessage } from '@/lib/fetch-json';

type TableStatus = 'AVAILABLE' | 'OCCUPIED' | 'NEEDS_CLEANING';

type TableSection = 'Indoor' | 'Patio' | 'Bar';

interface TableGuest {
  id: number;
  displayName: string;
  moodEmoji?: string | null;
  moodNote?: string | null;
}

interface VisitOrder {
  id: number;
  orderNumber: string;
  customerName: string;
  status: string;
  totalAmount: number;
  createdAt: string;
  orderType?: string | null;
}

interface TableVisit {
  id: number;
  occupants: number;
  entryTime: string;
  orders?: VisitOrder[];
}

interface Table {
  id: number;
  name: string;
  capacity: number;
  status: TableStatus;
  assignedOrderId?: number;
  section: TableSection;
  positionX: number; // 0-100 (percent)
  positionY: number; // 0-100 (percent)
  occupiedSince?: string | null; // ISO datetime or null
  currentOccupants?: number;
  guests?: TableGuest[];
  sessions?: TableVisit[];
}

const STATUS_CONFIG: Record<TableStatus, { label: string; color: string; dot: string }> = {
  AVAILABLE:      { label: 'Available',      color: 'bg-green-500/20  border-green-500  text-green-400', dot: 'bg-green-400' },
  OCCUPIED:       { label: 'Occupied',       color: 'bg-yellow-500/20 border-yellow-500 text-yellow-400', dot: 'bg-yellow-400' },
  NEEDS_CLEANING: { label: 'Needs Cleaning', color: 'bg-red-500/20    border-red-500    text-red-400', dot: 'bg-red-400' },
};

const NEXT_STATUS: Record<TableStatus, TableStatus> = {
  AVAILABLE: 'OCCUPIED',
  OCCUPIED: 'NEEDS_CLEANING',
  NEEDS_CLEANING: 'AVAILABLE',
};

const SECTIONS: Array<{ key: TableSection; label: string; color: string }> = [
  { key: 'Indoor', label: 'Indoor', color: 'bg-blue-500/15 border-blue-500 text-blue-200' },
  { key: 'Patio', label: 'Patio', color: 'bg-emerald-500/15 border-emerald-500 text-emerald-200' },
  { key: 'Bar', label: 'Bar', color: 'bg-amber-500/15 border-amber-500 text-amber-200' },
];

// ─── Timer Helpers ───────────────────────────────────────────────────────────
function getOccupancyDuration(occupiedSince: string | null | undefined): { minutes: number; hours: number } | null {
  if (!occupiedSince) return null;
  const start = new Date(occupiedSince);
  const now = new Date();
  const diffMs = now.getTime() - start.getTime();
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(minutes / 60);
  return { minutes: minutes % 60, hours };
}

function formatOccupancyTime(occupiedSince: string | null | undefined): string | null {
  if (!occupiedSince) return null;
  const start = new Date(occupiedSince);
  const now = new Date();
  
  const startHour = start.getHours().toString().padStart(2, '0');
  const startMin = start.getMinutes().toString().padStart(2, '0');
  const endHour = now.getHours().toString().padStart(2, '0');
  const endMin = now.getMinutes().toString().padStart(2, '0');
  
  const duration = getOccupancyDuration(occupiedSince);
  if (!duration) return null;
  
  const durationStr = duration.hours > 0 
    ? `${duration.hours}h ${duration.minutes}m`
    : `${duration.minutes}m`;
  
  return `${startHour}:${startMin} - ${endHour}:${endMin} (${durationStr})`;
}

function getOccupancyAlertLevel(
  occupiedSince: string | null | undefined,
  warningMinutes: number = 60,
  criticalMinutes: number = 90
): 'none' | 'warning' | 'critical' {
  const duration = getOccupancyDuration(occupiedSince);
  if (!duration) return 'none';
  
  const totalMinutes = duration.hours * 60 + duration.minutes;
  if (totalMinutes >= criticalMinutes) return 'critical';
  if (totalMinutes >= warningMinutes) return 'warning';
  return 'none';
}

export default function TablesPage() {
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTableName, setNewTableName] = useState('');
  const [adding, setAdding] = useState(false);
  const [editTable, setEditTable] = useState<Table | null>(null);
  const [editName, setEditName] = useState('');
  const [editCap, setEditCap] = useState(4);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [qrTable, setQrTable] = useState<Table | null>(null);
  const [qrData, setQrData] = useState<{ qrDataUrl: string; menuUrl: string } | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);

  const [sectionFilter, setSectionFilter] = useState<'ALL' | TableSection>('ALL');
  const [tick, setTick] = useState(0); // Force re-render for timer updates
  const [warningMinutes, setWarningMinutes] = useState(60);
  const [criticalMinutes, setCriticalMinutes] = useState(90);

  const fetchTables = useCallback(async () => {
    try {
      const res = await fetch('/api/tables', { cache: 'no-store' });
      const data = await res.json();

      // Ensure all tables have valid position values
      const validTables = Array.isArray(data) ? data.map((t: any) => ({
        ...t,
        positionX: typeof t.positionX === 'number' && !isNaN(t.positionX) ? t.positionX : Math.random() * 80 + 10,
        positionY: typeof t.positionY === 'number' && !isNaN(t.positionY) ? t.positionY : Math.random() * 80 + 10,
        section: t.section || 'Indoor',
        guests: Array.isArray(t.guests) ? t.guests : [],
        sessions: Array.isArray(t.sessions) ? t.sessions : [],
      })) : [];
      setTables(validTables);
    } catch (err) {
      console.error('Failed to fetch tables:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTables(); }, [fetchTables]);

  // Load saved thresholds from localStorage on mount
  useEffect(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem('tableOccupancyThresholds') : null;
      if (!raw) return;
      const parsed = JSON.parse(raw) as { warningMinutes?: number; criticalMinutes?: number };
      if (parsed.warningMinutes && !Number.isNaN(parsed.warningMinutes)) {
        setWarningMinutes(parsed.warningMinutes);
      }
      if (parsed.criticalMinutes && !Number.isNaN(parsed.criticalMinutes)) {
        setCriticalMinutes(parsed.criticalMinutes);
      }
    } catch (e) {
      console.error('Could not read the saved occupancy thresholds, using defaults:', e);
    }
  }, []);

  // Persist thresholds when changed
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const payload = {
      warningMinutes,
      criticalMinutes,
    };
    try {
      localStorage.setItem('tableOccupancyThresholds', JSON.stringify(payload));
    } catch (e) {
      console.error('Could not save the occupancy thresholds on this device:', e);
    }
  }, [warningMinutes, criticalMinutes]);

  // Timer refresh - update display every second
  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useSocket({
    room: 'tables',
    events: {
      'table-update': () => { fetchTables(); },
      'table-guest-joined': () => { fetchTables(); },
      'table-guest-updated': () => { fetchTables(); },
      'table-guest-left': () => { fetchTables(); },
      'table-clean-request': () => { fetchTables(); },
    },
  });

  async function patchTable(update: Partial<Table> & { id: number }) {
    try {
      // Validate and round position values
      if (update.positionX !== undefined) {
        const x = Number(update.positionX);
        if (isNaN(x)) {
          throw new Error(`Invalid positionX: ${update.positionX}`);
        }
        update.positionX = Math.round(x * 100) / 100; // Round to 2 decimals
      }
      if (update.positionY !== undefined) {
        const y = Number(update.positionY);
        if (isNaN(y)) {
          throw new Error(`Invalid positionY: ${update.positionY}`);
        }
        update.positionY = Math.round(y * 100) / 100; // Round to 2 decimals
      }
      const res = await fetch('/api/tables', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(`API error: ${res.status} - ${data.error || data.details || 'Unknown error'}`);
      }
      return data;
    } catch (err) {
      console.error('Failed to patch table:', err);
      throw err;
    }
  }

  async function cycleStatus(table: Table) {
    const nextStatus = NEXT_STATUS[table.status];
    await patchTable({ id: table.id, status: nextStatus });
    fetchTables();
  }

  async function adjustOccupants(tableId: number, action: 'add' | 'remove') {
    try {
      const res = await fetch('/api/tables', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: tableId, action })
      });
      
      if (!res.ok) {
        const text = await res.text();
        try {
          const data = JSON.parse(text);
          alert(data.error || 'Failed to adjust occupants');
        } catch {
          alert('Failed to adjust occupants: ' + text);
        }
        return;
      }
      
      fetchTables();
    } catch (err) {
      console.error('Failed to adjust occupants:', err);
      alert('Failed to adjust occupants');
    }
  }

  async function clearAllGuests(tableId: number, tableName: string) {
    if (!confirm(`Clear all guests from ${tableName}? This will remove all guest names and reset the table.`)) {
      return;
    }
    
    try {
      const res = await fetch('/api/tables', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: tableId, action: 'clear' })
      });
      
      if (!res.ok) {
        const text = await res.text();
        try {
          const data = JSON.parse(text);
          alert(data.error || 'Failed to clear guests');
        } catch {
          alert('Failed to clear guests: ' + text);
        }
        return;
      }
      
      fetchTables();
    } catch (err) {
      console.error('Failed to clear guests:', err);
      alert('Failed to clear guests');
    }
  }

  async function addTable() {
    const name = newTableName.trim();
    if (!name) {
      alert('Please enter a table name before adding.');
      return;
    }

    setAdding(true);
    try {
      const res = await fetch('/api/tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, capacity: 4 }),
      });

      const rawText = await res.text();
      let data: any = null;
      try {
        data = rawText ? JSON.parse(rawText) : null;
      } catch {
        // non‑JSON response
      }

      if (!res.ok) {
        console.error('Failed to create table:', { status: res.status, statusText: res.statusText, rawText, data });
        const serverMessage =
          (data && (data.error || data.details)) ||
          rawText ||
          `Request failed with status ${res.status} ${res.statusText}`;
        alert(`Failed to create table: ${serverMessage}`);
        return;
      }

      setNewTableName('');
      fetchTables();
    } catch (err) {
      console.error('Network error while creating table:', err);
      alert('Network error while creating table. Please check your connection.');
    } finally {
      setAdding(false);
    }
  }

  function openEdit(table: Table) {
    setEditTable(table);
    setEditName(table.name);
    setEditCap(table.capacity);
  }

  async function saveEdit() {
    if (!editTable) return;
    setSaving(true);
    await patchTable({ id: editTable.id, name: editName.trim() || editTable.name, capacity: editCap });
    setSaving(false);
    setEditTable(null);
    fetchTables();
  }

  async function deleteTable(force: boolean = false) {
    if (!editTable) return;
    const res = await fetch('/api/tables', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editTable.id, force }),
    });
    if (!res.ok) {
      const text = await res.text();
      try {
        const d = JSON.parse(text);
        // If not forced and error is about occupied table, try again with force
        if (d.error?.includes('occupied') && !force) {
          if (confirm('Table is occupied. Force delete (clear table first)?')) {
            await deleteTable(true);
            return;
          }
        } else {
          alert(d.error);
        }
      } catch {
        alert('Failed to delete table: ' + text);
      }
    }
    setDeleteConfirm(false);
    setEditTable(null);
    fetchTables();
  }

  async function showQr(table: Table) {
    setQrTable(table);
    setQrData(null);
    setQrLoading(true);
    setQrError(null);
    try {
      const data = await fetchJson<{ qrDataUrl: string; menuUrl: string }>(`/api/tables/qr?tableId=${table.id}`);
      setQrData({ qrDataUrl: data.qrDataUrl, menuUrl: data.menuUrl });
    } catch (e) {
      console.error(`Failed to generate the QR code for table ${table.id}:`, e);
      setQrError(userMessage(e, 'The QR code could not be generated. Try again.'));
    } finally {
      setQrLoading(false);
    }
  }

  function downloadQr() {
    if (!qrData || !qrTable) return;
    const link = document.createElement('a');
    link.download = `QR-${qrTable.name}.png`;
    link.href = qrData.qrDataUrl;
    link.click();
  }

  function printQr() {
    if (!qrData || !qrTable) return;
    const win = window.open('', '_blank', 'width=500,height=600');
    if (!win) return;
    win.document.write(`
      <html><head><title>QR - ${qrTable.name}</title>
      <style>body{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;margin:0}img{width:300px;height:300px}h2{margin-bottom:8px}p{color:#666;margin-top:4px;font-size:14px}</style>
      </head><body>
      <h2>${qrTable.name}</h2>
      <img src="${qrData.qrDataUrl}" />
      <p>Scan to view menu & order</p>
      <script>window.onload=function(){window.print();window.close()}<\/script>
      </body></html>
    `);
    win.document.close();
  }

  const byStatus = (s: TableStatus) => tables.filter((t) => t.status === s);
  const filteredTables = tables.filter((t) => sectionFilter === 'ALL' ? true : t.section === sectionFilter);

  return (
    <div className="flex-1 overflow-y-auto bg-page text-ink min-h-screen p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
          <div>
            <h1 className="c-title">Table Management</h1>
            <p className="mt-1.5 text-sm text-muted">Manage all tables, track occupancy time, and monitor alerts.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value as 'ALL' | TableSection)}
              className="bg-white text-gray-900 rounded-xl px-3 py-2 text-sm font-medium border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-200"
            >
              <option value="ALL">All Sections</option>
              {SECTIONS.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>

            <input
              id="new-table-name"
              name="tableName"
              type="text"
              value={newTableName}
              onChange={(e) => setNewTableName(e.target.value)}
              placeholder="New table name..."
              className="bg-white text-gray-900 rounded-xl px-3 py-2 text-sm font-medium border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-200 placeholder-gray-400"
            />
            <button
              onClick={addTable}
              disabled={adding}
              className="bg-gray-900 text-white px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-50 hover:bg-gray-800 transition-colors"
            >
              + Add Table
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {Object.entries(STATUS_CONFIG).map(([status, cfg]) => (
          <div key={status} className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-2xl font-semibold text-gray-900">{byStatus(status as TableStatus).length}</p>
            <p className="text-xs font-medium text-gray-500 mt-0.5">{cfg.label}</p>
          </div>
        ))}
      </div>

      {/* Threshold controls */}
      <div className="mb-5 flex flex-wrap items-center gap-2 text-xs bg-white rounded-xl px-4 py-2.5 shadow-sm">
        <span className="uppercase tracking-wide text-[10px] text-gray-400 font-medium">Long-occupied thresholds</span>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-xl">
            <span className="text-gray-500 font-medium">Warning</span>
            <input
              type="number"
              min={1}
              max={480}
              value={warningMinutes}
              onChange={(e) => {
                const v = parseInt(e.target.value || '0', 10);
                if (Number.isNaN(v)) return;
                setWarningMinutes(Math.max(1, Math.min(v, criticalMinutes)));
              }}
              className="w-16 bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-700 font-medium"
            />
            <span className="text-gray-400">min</span>
          </label>
          <label className="flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-xl">
            <span className="text-gray-500 font-medium">Critical</span>
            <input
              type="number"
              min={1}
              max={720}
              value={criticalMinutes}
              onChange={(e) => {
                const v = parseInt(e.target.value || '0', 10);
                if (Number.isNaN(v)) return;
                setCriticalMinutes(Math.max(v, warningMinutes));
              }}
              className="w-16 bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-700 font-medium"
            />
            <span className="text-gray-500">min</span>
          </label>
        </div>
      </div>

      {/* Long Tables Alert */}
      {tick && (
        (() => {
          const longTables = tables.filter(
            (t) => t.status === 'OCCUPIED' && getOccupancyAlertLevel(t.occupiedSince, warningMinutes, criticalMinutes) !== 'none'
          );
          return longTables.length > 0 ? (
            <div className="mb-5 bg-yellow-50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">⏱️</span>
                <p className="text-sm font-medium text-gray-900">Long-Occupied Tables ({longTables.length})</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {longTables.map((t) => {
                  const alert = getOccupancyAlertLevel(t.occupiedSince, warningMinutes, criticalMinutes);
                  const alertColor = alert === 'critical' ? 'bg-red-100' : 'bg-yellow-100';
                  return (
                    <div key={t.id} className={`rounded-lg p-2 text-xs ${alertColor}`}>
                      <p className="font-medium text-gray-900">{t.name}</p>
                      <p className="text-gray-500">{formatOccupancyTime(t.occupiedSince)}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null;
        })()
      )}

      {/* Table Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {filteredTables.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center h-32 bg-white rounded-xl">
            <p className="text-3xl mb-2">🪑</p>
            <p className="text-sm text-gray-500">No tables found</p>
          </div>
        ) : (
          filteredTables.map((table) => {
            const cfg = STATUS_CONFIG[table.status];
            const alertLevel =
              table.status === 'OCCUPIED'
                ? getOccupancyAlertLevel(table.occupiedSince, warningMinutes, criticalMinutes)
                : 'none';
            const alertBorder = alertLevel === 'critical' ? 'border-red-400' : alertLevel === 'warning' ? 'border-yellow-400' : '';
            const occupancyText = table.status === 'OCCUPIED' ? formatOccupancyTime(table.occupiedSince) : null;
            
            return (
              <div key={table.id} className={`bg-white rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer ${alertBorder}`}
                   onClick={() => cycleStatus(table)}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-gray-900 font-semibold text-sm">{table.name}</p>
                    <p className="text-[11px] text-gray-500 flex items-center gap-1 mt-0.5">
                      {(table.currentOccupants ?? 0)}/{table.capacity}
                      {typeof table.currentOccupants === 'number' && table.currentOccupants > 0 && (
                        <>
                           <button
                             onClick={(e) => {
                               e.stopPropagation();
                               adjustOccupants(table.id, 'remove');
                             }}
                             disabled={table.currentOccupants <= 0}
                             className="ml-1 w-5 h-5 rounded-full bg-gray-100 hover:bg-gray-200 disabled:opacity-30 text-gray-700 font-bold text-[10px] flex items-center justify-center"
                           >−</button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              adjustOccupants(table.id, 'add');
                            }}
                            disabled={table.currentOccupants >= table.capacity}
                            className="w-5 h-5 rounded-full bg-gray-100 hover:bg-gray-200 disabled:opacity-30 text-gray-700 font-bold text-[10px] flex items-center justify-center"
                          >+</button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              clearAllGuests(table.id, table.name);
                            }}
                            className="ml-1 px-1.5 py-0.5 rounded-full bg-red-50 hover:bg-red-100 text-red-600 font-medium text-[10px]"
                            title="Clear all guests"
                          >✕</button>
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        showQr(table);
                      }}
                      className="bg-gray-100 hover:bg-gray-200 text-gray-700 w-10 h-10 rounded-2xl flex items-center justify-center text-lg transition-colors shadow-sm"
                      title="Show QR code"
                    >
                      📱
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openEdit(table);
                      }}
                      className="bg-gray-100 hover:bg-gray-200 text-gray-700 w-10 h-10 rounded-2xl flex items-center justify-center text-lg transition-colors shadow-sm"
                      title="Edit table"
                    >
                      ⚙️
                    </button>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 mb-3">
                  <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                  <span className="text-sm font-medium text-gray-600">{cfg.label}</span>
                  {occupancyText && (
                    <span className="text-xs text-gray-400 ml-auto">{occupancyText}</span>
                  )}
                </div>

                {table.guests && table.guests.length > 0 && (
                  <div className="mb-3 bg-gray-50 rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-medium text-gray-600">Guest Moods</span>
                    </div>
                    <div className="space-y-1">
                      {table.guests.map((g, idx) => (
                        <div key={idx} className="flex items-center gap-2 bg-white rounded-lg px-2 py-1.5">
                          <span className="text-sm">{g.moodEmoji || '😐'}</span>
                          <span className="text-sm font-medium text-gray-800 flex-1">{g.displayName}</span>
                          {g.moodNote && (
                            <span className="text-xs text-gray-400 truncate max-w-[80px]" title={g.moodNote}>
                              &quot;{g.moodNote}&quot;
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {table.sessions && table.sessions.length > 0 && (
                  <div className="mb-3 bg-blue-50 rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-medium text-gray-600">This Visit&apos;s Orders</span>
                      {table.sessions[0].orders && table.sessions[0].orders.length > 0 && (
                        <span className="ml-auto text-[10px] font-medium text-blue-600 bg-blue-100 rounded-full px-2 py-0.5">
                          {table.sessions[0].orders.length} order{table.sessions[0].orders.length > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    {table.sessions[0].orders && table.sessions[0].orders.length > 0 ? (
                      <div className="space-y-1">
                        {table.sessions[0].orders.map((o) => (
                          <div key={o.id} className="flex items-center gap-2 bg-white rounded-lg px-2 py-1.5">
                            <span className="text-xs font-medium text-gray-800 flex-1">{o.orderNumber}</span>
                            <span className="text-[10px] text-gray-400">{new Date(o.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            <span className="text-xs font-semibold text-gray-800">₱{Number(o.totalAmount).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 italic">No orders yet for this visit</p>
                    )}
                  </div>
                )}

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    cycleStatus(table);
                  }}
                  className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-xl text-sm font-medium transition-colors"
                >
                  Change Status
                </button>
              </div>
            );
          })
        )}
      </div>

      <p className="text-gray-400 text-xs mt-4 text-center">
        Click a table to cycle status: Available → Occupied → Needs Cleaning → Available
      </p>

      {/* Edit Modal - Apple Style */}
      {editTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-md p-4" onClick={() => { setEditTable(null); setDeleteConfirm(false); }}>
          <div className="bg-white rounded-xl p-5 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-gray-900 font-semibold text-lg mb-4">Edit Table</h3>

            <div className="space-y-4">
              <div>
                <label className="text-gray-500 text-xs font-medium block mb-1.5">Table Name</label>
                <input
                  id="edit-table-name"
                  name="editTableName"
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full bg-gray-50 text-gray-900 px-3 py-2 rounded-lg text-sm border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-200"
                />
              </div>

              <div>
                <label className="text-gray-500 text-xs font-medium block mb-1.5">Capacity (seats)</label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setEditCap(c => Math.max(1, c - 1))}
                    className="w-10 h-10 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-lg flex items-center justify-center"
                  >−</button>
                  <span className="text-gray-900 font-semibold text-2xl flex-1 text-center">{editCap}</span>
                  <button
                    onClick={() => setEditCap(c => Math.min(20, c + 1))}
                    className="w-10 h-10 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-lg flex items-center justify-center"
                  >+</button>
                </div>
                <p className="text-gray-400 text-xs mt-1 text-center">Max 20 seats</p>
              </div>

              <div>
                <label className="text-gray-500 text-xs font-medium block mb-1.5">Section</label>
                <select
                  id="edit-table-section"
                  name="tableSection"
                  value={editTable.section}
                  onChange={(e) => setEditTable((t) => t ? { ...t, section: e.target.value as TableSection } : null)}
                  className="w-full bg-gray-50 text-gray-900 px-3 py-2 rounded-lg text-sm border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-200"
                >
                  {SECTIONS.map((s) => (
                    <option key={s.key} value={s.key}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <button
                onClick={() => { setEditTable(null); setDeleteConfirm(false); }}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 rounded-lg text-sm"
              >Cancel</button>
              <button
                onClick={saveEdit}
                disabled={saving}
                className="flex-1 bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white font-medium py-2 rounded-lg text-sm"
              >{saving ? 'Saving...' : 'Save'}</button>
            </div>

            {/* Delete */}
            {!deleteConfirm ? (
              <button
                onClick={() => setDeleteConfirm(true)}
                className="w-full mt-4 text-red-500 hover:text-red-400 text-sm font-medium py-3 rounded-2xl hover:bg-red-50 transition-colors"
              >
                Delete Table
              </button>
            ) : (
              <div className="mt-4 bg-red-50 border border-red-100 rounded-2xl p-4 text-center">
                <p className="text-red-600 text-sm font-semibold mb-3">Delete &quot;{editTable.name}&quot;?</p>
                <div className="flex gap-3">
                  <button onClick={() => setDeleteConfirm(false)} className="flex-1 bg-gray-100 text-gray-600 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors">Cancel</button>
                  <button onClick={() => deleteTable()} className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-2.5 rounded-xl text-sm transition-colors shadow-sm">Yes, Delete</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* QR Code Modal - Apple Style */}
      {qrTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-md p-4" onClick={() => setQrTable(null)}>
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl text-center" onClick={e => e.stopPropagation()}>
            <h3 className="text-gray-900 font-bold text-xl mb-1">QR Code</h3>
            <p className="text-gray-500 text-sm mb-5">{qrTable.name}</p>

            {qrLoading ? (
              <div className="py-12 text-gray-400">Generating QR code...</div>
            ) : qrError ? (
              <div className="py-12 text-red-600 text-sm">{qrError}</div>
            ) : qrData ? (
              <>
                <div className="bg-white rounded-3xl p-5 inline-block mb-4 shadow-lg">
                  <img src={qrData.qrDataUrl} alt={`QR for ${qrTable.name}`} className="w-56 h-56" />
                </div>
                <p className="text-gray-400 text-xs mb-4 break-all px-2">{qrData.menuUrl}</p>
                <div className="flex gap-3">
                  <button
                    onClick={downloadQr}
                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-2xl transition-all text-sm shadow-lg hover:shadow-xl"
                  >⬇️ Download</button>
                  <button
                    onClick={printQr}
                    className="flex-1 bg-black hover:bg-gray-800 text-white font-semibold py-3 rounded-2xl transition-all text-sm shadow-lg hover:shadow-xl"
                  >Print</button>
                </div>
              </>
            ) : (
              <div className="py-12 text-red-500">Failed to generate QR code</div>
            )}

            <button
              onClick={() => setQrTable(null)}
              className="w-full mt-5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 rounded-2xl transition-colors"
            >Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
