'use client';

import { useState, useEffect, useCallback } from 'react';

interface Station {
  id: number;
  stationType: string;
  emoji?: string;
  staffCount: number;
  updatedAt: string;
}

const STATION_META: Record<string, { icon: string; label: string; color: string }> = {
  coffee:  { icon: '☕', label: 'Coffee Bar',  color: 'amber' },
  kitchen: { icon: '🍳', label: 'Kitchen',     color: 'red' },
  bar:     { icon: '🥤', label: 'Drinks Bar',  color: 'blue' },
  pastry:  { icon: '🧁', label: 'Pastry',      color: 'pink' },
  general: { icon: '📦', label: 'General',     color: 'gray' },
};

function getMeta(type: string, emoji?: string) {
  // If emoji is provided (from database), use it
  if (emoji) {
    return { icon: emoji, label: type.charAt(0).toUpperCase() + type.slice(1), color: 'gray' };
  }
  return STATION_META[type] || { icon: '🏷️', label: type.charAt(0).toUpperCase() + type.slice(1), color: 'gray' };
}

export default function StationsPage() {
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  // Add station
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newStaff, setNewStaff] = useState(1);
  const [addError, setAddError] = useState('');

  // Emoji options for station
  const stationEmojis = ['☕', '🍳', '🥤', '🧁', '🍔', '🍕', '🍜', '🥗', '🍰', '🍦', '🍹', '🍺', '🏪', '📦', '🔧', '👨‍🍳'];
  const [newEmoji, setNewEmoji] = useState('📦');

  // Edit station
  const [editing, setEditing] = useState<Station | null>(null);
  const [editName, setEditName] = useState('');

  // Edit emoji
  const [editingEmoji, setEditingEmoji] = useState<Station | null>(null);

  // Delete confirm
  const [deleting, setDeleting] = useState<Station | null>(null);

  function notif(msg: string) {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  }

  const fetchStations = useCallback(async () => {
    try {
      const res = await fetch('/api/stations');
      const data = await res.json();
      setStations(data);
    } catch (e) {
      console.error('Failed to load stations:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStations(); }, [fetchStations]);

  async function updateStaffCount(station: Station, delta: number) {
    const newCount = Math.max(0, station.staffCount + delta);
    if (newCount === station.staffCount) return;

    setSaving(station.id);
    try {
      const res = await fetch('/api/stations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: station.id, staffCount: newCount }),
      });
      if (res.ok) {
        setStations((prev) =>
          prev.map((s) => s.id === station.id ? { ...s, staffCount: newCount } : s)
        );
        const meta = getMeta(station.stationType, station.emoji);
        notif(`${meta.icon} ${meta.label} → ${newCount} staff`);
      }
    } catch {}
    setSaving(null);
  }

  async function addStation() {
    setAddError('');
    const name = newName.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (name.length < 2) { setAddError('Name must be at least 2 characters'); return; }

    setSaving(-1);
    try {
      const res = await fetch('/api/stations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stationType: name, staffCount: Math.max(0, newStaff), emoji: newEmoji }),
      });
      if (res.ok) {
        const created = await res.json();
        setStations((prev) => [...prev, created]);
        setShowAdd(false);
        setNewName('');
        setNewStaff(1);
        setNewEmoji('📦');
        notif(`✅ Station "${name}" created`);
      } else {
        const err = await res.json();
        setAddError(err.error || 'Failed to create');
      }
    } catch {
      setAddError('Network error');
    }
    setSaving(null);
  }

  async function renameStation() {
    if (!editing) return;
    const name = editName.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (name.length < 2 || name === editing.stationType) { setEditing(null); return; }

    setSaving(editing.id);
    try {
      const res = await fetch('/api/stations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editing.id, stationType: name }),
      });
      if (res.ok) {
        const updated = await res.json();
        setStations((prev) => prev.map((s) => s.id === updated.id ? updated : s));
        notif(`✏️ Renamed to "${name}"`);
      }
    } catch {}
    setEditing(null);
    setSaving(null);
  }

  async function deleteStation(station: Station) {
    setSaving(station.id);
    try {
      const res = await fetch('/api/stations', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: station.id }),
      });
      if (res.ok) {
        setStations((prev) => prev.filter((s) => s.id !== station.id));
        notif(`🗑️ Station "${station.stationType}" deleted`);
      }
    } catch {}
    setSaving(null);
  }

  async function updateEmoji() {
    if (!editingEmoji) return;
    
    setSaving(editingEmoji.id);
    try {
      const res = await fetch('/api/stations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingEmoji.id, emoji: newEmoji }),
      });
      if (res.ok) {
        const updated = await res.json();
        setStations((prev) => prev.map((s) => s.id === updated.id ? updated : s));
        notif(`😊 Icon updated to "${newEmoji}"`);
      }
    } catch {}
    setEditingEmoji(null);
    setSaving(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50 min-h-screen">
        <div className="text-gray-500 text-sm font-medium">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 text-gray-900 min-h-screen p-6">
      {/* Header */}
      <div className="mb-5">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-1">🏭 Station Staff</h1>
            <p className="text-sm text-gray-500">Manage stations and staff counts.</p>
          </div>
          <button
            onClick={() => { setShowAdd(true); setAddError(''); }}
            className="bg-gray-900 text-white font-medium px-4 py-2 rounded-xl hover:bg-gray-800 text-sm"
          >
            + Add Station
          </button>
        </div>
      </div>

      {/* Notification */}
      {notification && (
        <div className="mb-4 bg-green-50 text-green-700 px-4 py-2 rounded-xl text-sm font-medium">
          {notification}
        </div>
      )}

      {/* Station Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {stations.map((station) => {
          const meta = getMeta(station.stationType, station.emoji);
          const isSaving = saving === station.id;

          return (
            <div
              key={station.id}
              className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow"
            >
              {/* Station header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{meta.icon}</span>
                  <div>
                    <h3 className="text-gray-900 font-semibold text-base">{meta.label}</h3>
                    <p className="text-gray-400 text-xs">{station.stationType}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => { setEditingEmoji(station); setNewEmoji(station.emoji || '📦'); }}
                    className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center text-xs"
                    title="Change Icon"
                  >
                    {station.emoji || '📦'}
                  </button>
                  <button
                    onClick={() => { setEditing(station); setEditName(station.stationType); }}
                    className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center text-xs"
                    title="Rename"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => setDeleting(station)}
                    className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-red-50 text-gray-400 hover:text-red-500 flex items-center justify-center text-xs"
                    title="Delete"
                  >
                    🗑️
                  </button>
                </div>
              </div>

              {/* Staff count controls */}
              <div className="flex items-center justify-between bg-gray-50 rounded-lg p-2.5 mb-2">
                <span className="text-gray-500 text-xs font-medium">Staff</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateStaffCount(station, -1)}
                    disabled={isSaving || station.staffCount <= 0}
                    className="w-8 h-8 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold text-base flex items-center justify-center disabled:opacity-30"
                  >
                    −
                  </button>
                  <span className={`text-xl font-semibold min-w-[2ch] text-center ${
                    station.staffCount === 0 ? 'text-red-500' : 'text-gray-900'
                  }`}>
                    {station.staffCount}
                  </span>
                  <button
                    onClick={() => updateStaffCount(station, 1)}
                    disabled={isSaving}
                    className="w-8 h-8 rounded-lg bg-gray-900 hover:bg-gray-800 text-white font-bold text-base flex items-center justify-center disabled:opacity-30"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Status indicator */}
              {station.staffCount === 0 && (
                <div className="bg-red-50 text-red-600 text-xs px-2 py-1.5 rounded-lg text-center font-medium mb-2">
                  ⚠️ No staff
                </div>
              )}

              <p className="text-gray-400 text-xs">
                {new Date(station.updatedAt).toLocaleString()}
              </p>
            </div>
          );
        })}
      </div>

      {/* Add Station Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-5 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="text-gray-900 font-semibold text-lg mb-4">Add Station</h3>
            <div className="space-y-3">
              <div>
                <label className="text-gray-500 text-xs font-medium block mb-1">Station Name</label>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. grill, dessert"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
                  autoFocus
                />
                <p className="text-gray-400 text-xs mt-1">Lowercase letters, numbers, dashes</p>
              </div>
              <div>
                <label className="text-gray-500 text-xs font-medium block mb-1">Emoji Icon</label>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-2 bg-gray-50 border border-gray-200 rounded-lg">
                  {stationEmojis.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setNewEmoji(emoji)}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg transition-all ${
                        newEmoji === emoji ? 'bg-gray-900 text-white' : 'bg-white hover:bg-gray-100'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-gray-500 text-xs font-medium block mb-1">Staff Count</label>
                <input
                  type="number"
                  value={newStaff}
                  onChange={(e) => setNewStaff(Number(e.target.value))}
                  min={0}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
                />
              </div>
              {addError && <p className="text-red-500 text-xs">{addError}</p>}
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowAdd(false)} className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-200">
                Cancel
              </button>
              <button
                onClick={addStation}
                disabled={saving === -1}
                className="flex-1 bg-gray-900 text-white py-2 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
              >
                {saving === -1 ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-5 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="text-gray-900 font-semibold text-lg mb-4">Rename Station</h3>
            <div>
              <label className="text-gray-500 text-xs font-medium block mb-1">Station Name</label>
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
                autoFocus
              />
              <p className="text-gray-400 text-xs mt-1">Current: {editing.stationType}</p>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setEditing(null)} className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-200">
                Cancel
              </button>
              <button
                onClick={renameStation}
                className="flex-1 bg-gray-900 text-white py-2 rounded-lg text-sm font-medium hover:bg-gray-800"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Emoji Modal */}
      {editingEmoji && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-5 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="text-gray-900 font-semibold text-lg mb-4">Change Icon</h3>
            <div>
              <label className="text-gray-500 text-xs font-medium block mb-1">Select Icon</label>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 bg-gray-50 border border-gray-200 rounded-lg">
                {stationEmojis.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setNewEmoji(emoji)}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg transition-all ${
                      newEmoji === emoji ? 'bg-gray-900 text-white' : 'bg-white hover:bg-gray-100'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <p className="text-gray-400 text-xs mt-1">Current: {editingEmoji.emoji || '📦'}</p>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setEditingEmoji(null)} className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-200">
                Cancel
              </button>
              <button
                onClick={updateEmoji}
                className="flex-1 bg-gray-900 text-white py-2 rounded-lg text-sm font-medium hover:bg-gray-800"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleting && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-5 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="text-gray-900 font-semibold text-lg mb-2">Delete Station?</h3>
            <p className="text-gray-500 text-sm mb-4">
              Remove <strong className="text-gray-900">{getMeta(deleting.stationType, deleting.emoji).icon} {getMeta(deleting.stationType, deleting.emoji).label}</strong>?
            </p>
            <div className="flex gap-2">
              <button onClick={() => setDeleting(null)} className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-200">
                Cancel
              </button>
              <button
                onClick={() => deleteStation(deleting)}
                className="flex-1 bg-red-500 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-600"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
