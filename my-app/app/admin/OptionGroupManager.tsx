'use client';

import { useState, useEffect, useCallback } from 'react';

// Full CRUD manager for option groups (Size / Temperature / Add-ons / custom)
// and their priced options. Rendered under Products ▸ Options.

interface OptionRow {
  id: number;
  name: string;
  priceDelta: number;
  sizeMultiplier: number;
  sortOrder: number;
  available: boolean;
}

interface GroupRow {
  id: number;
  name: string;
  selectionType: 'single' | 'multi';
  scalesRecipe: boolean;
  sortOrder: number;
  available: boolean;
  options: OptionRow[];
  _count?: { products: number };
}

export default function OptionGroupManager() {
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupType, setNewGroupType] = useState<'single' | 'multi'>('single');
  const [newGroupScales, setNewGroupScales] = useState(false);
  const [creating, setCreating] = useState(false);

  // Per-option draft edits: key `${optionId}-name|delta|mult`
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [newOptions, setNewOptions] = useState<Record<number, { name: string; priceDelta: string; sizeMultiplier: string }>>({});
  const [expanded, setExpanded] = useState<number | null>(null);

  const fetchGroups = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/option-groups');
      const data = await res.json();
      setGroups(Array.isArray(data) ? data : []);
    } catch {
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchGroups(); }, [fetchGroups]);

  async function createGroup() {
    if (!newGroupName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/option-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newGroupName.trim(),
          selectionType: newGroupType,
          scalesRecipe: newGroupScales,
          sortOrder: groups.length + 1,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Failed to create group');
      } else {
        setNewGroupName('');
        await fetchGroups();
      }
    } finally {
      setCreating(false);
    }
  }

  async function saveGroup(g: GroupRow, patch: Partial<GroupRow>) {
    const res = await fetch(`/api/option-groups/${g.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || 'Failed to update group');
    }
    fetchGroups();
  }

  async function removeGroup(g: GroupRow) {
    if (!confirm(`Delete "${g.name}" and all its options? Attached products lose these choices.`)) return;
    const res = await fetch(`/api/option-groups/${g.id}`, { method: 'DELETE' });
    if (!res.ok) alert('Failed to delete group');
    fetchGroups();
  }

  function draft(optionId: number, field: string, fallback: string | number): string {
    const k = `${optionId}-${field}`;
    return drafts[k] !== undefined ? drafts[k] : String(fallback);
  }
  function setDraft(optionId: number, field: string, value: string) {
    setDrafts((prev) => ({ ...prev, [`${optionId}-${field}`]: value }));
  }

  async function saveOption(group: GroupRow, o: OptionRow) {
    const res = await fetch(`/api/options/${o.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: draft(o.id, 'name', o.name),
        priceDelta: parseFloat(draft(o.id, 'delta', String(o.priceDelta))) || 0,
        sizeMultiplier: parseFloat(draft(o.id, 'mult', String(o.sizeMultiplier))) || 1,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || 'Failed to update option');
    }
    fetchGroups();
  }

  async function deleteOption(o: OptionRow) {
    if (!confirm(`Delete option "${o.name}"?`)) return;
    await fetch(`/api/options/${o.id}`, { method: 'DELETE' });
    fetchGroups();
  }

  async function addOption(group: GroupRow) {
    const draftNew = newOptions[group.id] ?? { name: '', priceDelta: '', sizeMultiplier: '' };
    if (!draftNew.name.trim()) { alert('Option name required'); return; }
    const res = await fetch(`/api/option-groups/${group.id}/options`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: draftNew.name.trim(),
        priceDelta: parseFloat(draftNew.priceDelta) || 0,
        ...(group.scalesRecipe && { sizeMultiplier: parseFloat(draftNew.sizeMultiplier) || 1 }),
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || 'Failed to add option');
    } else {
      setNewOptions((prev) => ({ ...prev, [group.id]: { name: '', priceDelta: '', sizeMultiplier: '' } }));
    }
    fetchGroups();
  }

  return (
    <div className="space-y-4">
      {/* New group */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold text-slate-800 mb-3">Create an option group</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            placeholder='e.g. Size, Sugar Level'
            className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
          />
          <select
            value={newGroupType}
            onChange={(e) => setNewGroupType(e.target.value as 'single' | 'multi')}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
          >
            <option value="single">Pick one</option>
            <option value="multi">Add many</option>
          </select>
          <label className="flex items-center gap-1.5 text-xs text-slate-600 whitespace-nowrap px-2">
            <input type="checkbox" checked={newGroupScales} onChange={(e) => setNewGroupScales(e.target.checked)} />
            Scales recipe
          </label>
          <button
            onClick={createGroup}
            disabled={creating || !newGroupName.trim()}
            className="rounded-xl bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50"
          >
            Create
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-2">
          “Pick one” = customer chooses one option (Size). “Add many” = extras stacked on top (Add-ons).
          “Scales recipe” multiplies ingredient usage by each option&apos;s multiplier.
        </p>
      </div>

      {/* Groups list */}
      {loading ? (
        <div className="py-12 text-center text-gray-400">Loading option groups...</div>
      ) : groups.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-gray-400">
          No option groups yet
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => {
            const isOpen = expanded === g.id;
            return (
              <div key={g.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <button
                  onClick={() => setExpanded(isOpen ? null : g.id)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className={`text-xs transition-transform ${isOpen ? 'rotate-90' : ''}`}>▶</span>
                    <span className="font-semibold text-slate-800">{g.name}</span>
                    <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                      {g.selectionType === 'single' ? 'pick one' : 'add many'}
                    </span>
                    {g.scalesRecipe && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">scales recipe</span>
                    )}
                  </div>
                  <span className="text-xs text-slate-400">{g.options.length} options · {g._count?.products ?? 0} products</span>
                </button>

                {isOpen && (
                  <div className="border-t border-slate-100 p-4 space-y-3">
                    {g.options.map((o) => (
                      <div key={o.id} className="grid grid-cols-[1fr_90px_90px_auto_auto] items-center gap-2">
                        <input
                          value={draft(o.id, 'name', o.name)}
                          onChange={(e) => setDraft(o.id, 'name', e.target.value)}
                          className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                        />
                        <input
                          type="number"
                          step="0.01"
                          value={draft(o.id, 'delta', String(o.priceDelta))}
                          onChange={(e) => setDraft(o.id, 'delta', e.target.value)}
                          placeholder="+₱"
                          className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-center"
                        />
                        <input
                          type="number"
                          step="0.1"
                          value={draft(o.id, 'mult', String(o.sizeMultiplier))}
                          onChange={(e) => setDraft(o.id, 'mult', e.target.value)}
                          disabled={!g.scalesRecipe}
                          placeholder="×"
                          title={g.scalesRecipe ? 'Recipe multiplier' : 'Only recipe-scaling groups use this'}
                          className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-center disabled:bg-gray-50 disabled:text-gray-300"
                        />
                        <button
                          onClick={() => saveOption(g, o)}
                          className="px-3 py-1.5 rounded-lg bg-black text-white text-xs font-medium hover:bg-gray-800"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => deleteOption(o)}
                          className="px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-medium hover:bg-red-100"
                        >
                          Delete
                        </button>
                      </div>
                    ))}

                    {/* New option row */}
                    <div className="grid grid-cols-[1fr_90px_90px_auto] items-center gap-2 pt-2 border-t border-dashed border-slate-200">
                      <input
                        value={newOptions[g.id]?.name ?? ''}
                        onChange={(e) =>
                          setNewOptions((prev) => ({ ...prev, [g.id]: { ...(prev[g.id] ?? { priceDelta: '', sizeMultiplier: '' }), name: e.target.value } }))
                        }
                        placeholder="New option name…"
                        className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                      />
                      <input
                        type="number"
                        step="0.01"
                        value={newOptions[g.id]?.priceDelta ?? ''}
                        onChange={(e) =>
                          setNewOptions((prev) => ({ ...prev, [g.id]: { ...(prev[g.id] ?? { name: '', sizeMultiplier: '' }), priceDelta: e.target.value } }))
                        }
                        placeholder="+₱"
                        className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-center"
                      />
                      <input
                        type="number"
                        step="0.1"
                        value={newOptions[g.id]?.sizeMultiplier ?? ''}
                        onChange={(e) =>
                          setNewOptions((prev) => ({ ...prev, [g.id]: { ...(prev[g.id] ?? { name: '', priceDelta: '' }), sizeMultiplier: e.target.value } }))
                        }
                        disabled={!g.scalesRecipe}
                        placeholder="×"
                        className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-center disabled:bg-gray-50 disabled:text-gray-300"
                      />
                      <button
                        onClick={() => addOption(g)}
                        className="justify-self-end px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-medium hover:bg-slate-200"
                      >
                        + Add
                      </button>
                    </div>

                    {/* Rename / settings row */}
                    <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                      <input
                        defaultValue={g.name}
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          if (v && v !== g.name) saveGroup(g, { name: v });
                        }}
                        className="rounded-lg border border-slate-200 px-2 py-1 text-xs w-48"
                        title="Rename group"
                      />
                      <label className="flex items-center gap-1.5 text-xs text-slate-600">
                        <input
                          type="checkbox"
                          checked={g.scalesRecipe}
                          onChange={(e) => saveGroup(g, { scalesRecipe: e.target.checked })}
                        />
                        Scales recipe
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-slate-600">
                        <input
                          type="checkbox"
                          checked={g.available}
                          onChange={(e) => saveGroup(g, { available: e.target.checked })}
                        />
                        Available
                      </label>
                      <button
                        onClick={() => removeGroup(g)}
                        className="ml-auto text-xs text-red-500 hover:text-red-700 font-medium"
                      >
                        Delete group
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
