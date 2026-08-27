'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchJson, userMessage } from '@/lib/fetch-json';

// Option groups manager: groups -> attach products -> per-product options
// with ingredient delta rows (grams/ml per option).

interface IngredientDelta {
  ingredientId: number;
  ingredientName: string;
  baseUnit: string;
  deltaQty: number;
}

interface ProductOption {
  id: number;
  name: string;
  priceDelta: number;
  sortOrder: number;
  available: boolean;
  ingredients: IngredientDelta[];
}

interface Product {
  id: number;
  name: string;
  price: number;
}

interface AttachedProductGroup {
  group: { id: number };
  options: ProductOption[];
}

interface GroupRow {
  id: number;
  name: string;
  selectionType: 'single' | 'multi';
  sortOrder: number;
  available: boolean;
  _count: { products: number; productOptions: number };
}

export default function OptionGroupManager() {
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);

  // New group form
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<'single' | 'multi'>('single');
  const [creating, setCreating] = useState(false);

  // Expanded group data
  const [products, setProducts] = useState<Product[]>([]);
  const [attachedIds, setAttachedIds] = useState<Set<number>>(new Set());
  const [options, setOptions] = useState<ProductOption[]>([]);
  const [ingredients, setIngredients] = useState<{ id: number; name: string; baseUnit: string }[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Per-product option editing: key = `${productId}:${optionId}`
  const [drafts, setDrafts] = useState<Record<string, Partial<ProductOption>>>({});

  // Per-product new option forms: key = productId
  const [newOption, setNewOption] = useState<Record<number, { name: string; priceDelta: string }>>({});

  // ── Fetch helpers ────────────────────────────────────────────────────────
  const fetchGroups = useCallback(async () => {
    setLoading(true);
    try {
      setGroups(await fetchJson<GroupRow[]>('/api/option-groups'));
      setError('');
    } catch (e) {
      console.error('Failed to load option groups:', e);
      setError(userMessage(e, 'Could not load option groups. Try again.'));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchIngredients = useCallback(async () => {
    try {
      setIngredients(await fetchJson<{ id: number; name: string; baseUnit: string }[]>('/api/ingredients'));
    } catch (e) {
      console.error('Failed to load ingredients:', e);
    }
  }, []);

  useEffect(() => { fetchGroups(); fetchIngredients(); }, [fetchGroups, fetchIngredients]);

  const fetchProducts = useCallback(async () => {
    try {
      const data = await fetchJson<Product[]>('/api/products');
      setProducts(data.map((p) => ({ id: p.id, name: p.name, price: p.price })));
    } catch (e) {
      console.error('Failed to load products:', e);
    }
  }, []);

  const fetchGroupDetail = useCallback(async (groupId: number) => {
    setLoadingDetail(true);
    try {
      // Fetch attached product IDs
      const attachRes = await fetch(`/api/products?groupId=${groupId}`);
      // Simpler: just fetch all products and check which are attached
      // We already have products from fetchProducts; use option-groups endpoint instead

      // Fetch per-product options for each product
      // This is a placeholder — in practice we fetch from the admin endpoint
      setAttachedIds(new Set());
      setOptions([]);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  // ── Group CRUD ───────────────────────────────────────────────────────────
  async function createGroup() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await fetchJson('/api/option-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          selectionType: newType,
          sortOrder: groups.length + 1,
        }),
      });
      setNewName('');
      await fetchGroups();
    } catch (e) {
      console.error('Failed to create option group:', e);
      alert(userMessage(e, 'Failed to create group'));
    } finally {
      setCreating(false);
    }
  }

  async function removeGroup(g: GroupRow) {
    if (!confirm(`Delete "${g.name}" and all its options? This cannot be undone.`)) return;
    try {
      await fetchJson(`/api/option-groups/${g.id}`, { method: 'DELETE' });
      if (expanded === g.id) setExpanded(null);
      await fetchGroups();
    } catch (e) {
      console.error('Failed to delete option group:', e);
      alert(userMessage(e, 'Failed to delete group'));
    }
  }

  async function toggleGroupAvailable(g: GroupRow) {
    try {
      await fetchJson(`/api/option-groups/${g.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ available: !g.available }),
      });
      await fetchGroups();
    } catch (e) {
      console.error('Failed to update option group:', e);
      alert(userMessage(e, 'Failed to update group'));
    }
  }

  // ── Product attachment ────────────────────────────────────────────────────
  async function toggleAttach(productId: number, groupId: number) {
    try {
      if (attachedIds.has(productId)) {
        await fetchJson(`/api/products/${productId}/option-groups?groupId=${groupId}`, { method: 'DELETE' });
        attachedIds.delete(productId);
      } else {
        await fetchJson(`/api/products/${productId}/option-groups`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ groupId }),
        });
        attachedIds.add(productId);
      }
      setAttachedIds(new Set(attachedIds));
      await fetchGroups();
    } catch (e) {
      console.error('Failed to update product option group:', e);
      alert(userMessage(e, 'Failed to update product attachment'));
    }
  }

  // ── Per-product option CRUD ──────────────────────────────────────────────
  async function addOption(productId: number, groupId: number) {
    const draft = newOption[productId];
    if (!draft?.name.trim()) { alert('Option name required'); return false; }
    try {
      await fetchJson(`/api/products/${productId}/options?groupId=${groupId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: draft.name.trim(),
          priceDelta: parseFloat(draft.priceDelta) || 0,
        }),
      });
      setNewOption((prev) => ({ ...prev, [productId]: { name: '', priceDelta: '' } }));
      return true;
    } catch (e) {
      console.error('Failed to add option:', e);
      alert(userMessage(e, 'Failed to add option'));
      return false;
    }
  }

  async function saveOption(optId: number) {
    const patch = drafts[`opt-${optId}`] ?? {};
    try {
      await fetchJson(`/api/product-options/${optId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      return true;
    } catch (e) {
      console.error('Failed to save option:', e);
      alert(userMessage(e, 'Failed to save option'));
      return false;
    }
  }

  async function deleteOption(optId: number) {
    if (!confirm('Delete this option?')) return;
    try {
      await fetchJson(`/api/product-options/${optId}`, { method: 'DELETE' });
    } catch (e) {
      console.error('Failed to delete option:', e);
      alert(userMessage(e, 'Failed to delete option'));
    }
  }

  // ── Option drafts ────────────────────────────────────────────────────────
  function draftVal(optId: number, field: string, fallback: string | number) {
    const k = `opt-${optId}`;
    return (drafts[k]?.[field as keyof ProductOption] as string | number | undefined) ?? String(fallback ?? '');
  }

  function setDraftVal(optId: number, field: string, value: string | number) {
    setDrafts((prev) => ({ ...prev, [`opt-${optId}`]: { ...prev[`opt-${optId}`], [field]: value } }));
  }

  return (
    <div className="space-y-4">
      {error && <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm p-3">{error}</div>}
      {/* Create group */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold text-slate-800 mb-3">Create an option group</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Size, Sugar Level"
            className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
          />
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value as 'single' | 'multi')}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
          >
            <option value="single">Pick one</option>
            <option value="multi">Add many</option>
          </select>
          <button
            type="button"
            onClick={createGroup}
            disabled={creating || !newName.trim()}
            className="rounded-xl bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50"
          >
            Create
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-2">
          Pick one = customer chooses one (Size). Add many = extras stacked (Add-ons).
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
                {/* Group header */}
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : g.id)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className={`text-xs transition-transform ${isOpen ? 'rotate-90' : ''}`}>&#9654;</span>
                    <span className="font-semibold text-slate-800">{g.name}</span>
                    <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                      {g.selectionType === 'single' ? 'pick one' : 'add many'}
                    </span>
                    {!g.available && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-50 text-red-500">hidden</span>
                    )}
                  </div>
                  <span className="text-xs text-slate-400">
                    {g._count.products} products &middot; {g._count.productOptions} options
                  </span>
                </button>

                {/* Expanded detail */}
                {isOpen && <GroupDetail group={g} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // ── Inline group detail sub-component ──────────────────────────────────────
  function GroupDetail({ group }: { group: GroupRow }) {
    const [detailProducts, setDetailProducts] = useState<Product[]>([]);
    const [attached, setAttached] = useState<Set<number>>(new Set());
    const [productOptions, setProductOptions] = useState<Record<number, ProductOption[]>>({});
    const [detailLoading, setDetailLoading] = useState(true);
    const [selectedProduct, setSelectedProduct] = useState<number | null>(null);
    const [deltaDrafts, setDeltaDrafts] = useState<Record<string, Record<number, string>>>({});
    const [deltaSaveStates, setDeltaSaveStates] = useState<Record<string, 'saving' | 'saved' | 'error'>>({});
    const [detailError, setDetailError] = useState('');

    useEffect(() => {
      let cancelled = false;
      (async () => {
        setDetailLoading(true);
        try {
          const allProds = await fetchJson<Product[]>('/api/products');
          if (cancelled) return;
          setDetailProducts(allProds.map((p) => ({ id: p.id, name: p.name, price: p.price })));

          // Determine which products have this group attached
          // by trying to fetch options for each product
          const attachedSet = new Set<number>();
          const optsMap: Record<number, ProductOption[]> = {};
          await Promise.all(
            allProds.map(async (p) => {
              try {
                const groups = await fetchJson<AttachedProductGroup[]>(`/api/products/${p.id}/option-groups`);
                const match = groups.find((g) => g.group.id === group.id);
                if (match) {
                  attachedSet.add(p.id);
                  optsMap[p.id] = match.options ?? [];
                }
              } catch (e) {
                console.error(`Failed to load option groups for product ${p.id}:`, e);
                setDetailError(userMessage(e, 'Could not load group details. Try again.'));
              }
            })
          );
          if (cancelled) return;
          setAttached(attachedSet);
          setProductOptions(optsMap);
        } catch (e) {
          console.error(`Failed to load the products for option group ${group.id}:`, e);
          setDetailError(userMessage(e, 'Could not load group details. Try again.'));
        } finally {
          if (!cancelled) setDetailLoading(false);
        }
      })();
      return () => { cancelled = true; };
    }, [group.id]);

    async function toggleProduct(productId: number) {
      try {
        if (attached.has(productId)) {
          await fetchJson(`/api/products/${productId}/option-groups?groupId=${group.id}`, { method: 'DELETE' });
          attached.delete(productId);
          const newOpts = { ...productOptions };
          delete newOpts[productId];
          setProductOptions(newOpts);
        } else {
          await fetchJson(`/api/products/${productId}/option-groups`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ groupId: group.id }),
          });
          attached.add(productId);
          setProductOptions((prev) => ({ ...prev, [productId]: [] }));
        }
      } catch (e) {
        console.error(`Failed to change option group ${group.id} on product ${productId}:`, e);
        alert(userMessage(e, 'That change was not saved. Try again.'));
        return;
      }
      setAttached(new Set(attached));
      await fetchGroups();
    }

    async function refreshProductOptions(productId: number) {
      try {
        const groups = await fetchJson<AttachedProductGroup[]>(`/api/products/${productId}/option-groups`);
        const match = groups.find((g) => g.group.id === group.id);
        setProductOptions((prev) => ({ ...prev, [productId]: match?.options ?? [] }));
      } catch (e) {
        console.error(`Failed to refresh the options for product ${productId}:`, e);
      }
    }

    async function saveDelta(productId: number, optId: number, ingredientId: number) {
      const saveKey = `${optId}:${ingredientId}`;
      const val = parseFloat(deltaDrafts[`opt-${optId}`]?.[ingredientId] ?? '0') || 0;
      setDeltaSaveStates((prev) => ({ ...prev, [saveKey]: 'saving' }));
      try {
        await fetchJson(`/api/product-options/${optId}/ingredients`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ingredientId, deltaQty: val }),
        });
        setDeltaSaveStates((prev) => ({ ...prev, [saveKey]: 'saved' }));
        await refreshProductOptions(productId);
        setDeltaDrafts((prev) => {
          const key = `opt-${optId}`;
          if (!prev[key]) return prev;
          const next = { ...prev };
          delete next[key][ingredientId];
          if (Object.keys(next[key]).length === 0) delete next[key];
          return next;
        });
        window.setTimeout(() => {
          setDeltaSaveStates((prev) => {
            const next = { ...prev };
            delete next[saveKey];
            return next;
          });
        }, 1800);
      } catch (error) {
        setDeltaSaveStates((prev) => ({ ...prev, [saveKey]: 'error' }));
        alert(error instanceof Error ? error.message : 'Failed to save ingredient quantity');
      }
    }

    function deltaVal(optId: number, ingredientId: number, fallback: number) {
      return deltaDrafts[`opt-${optId}`]?.[ingredientId] ?? String(fallback);
    }

    function setDeltaVal(optId: number, ingredientId: number, value: string) {
      setDeltaDrafts((prev) => ({
        ...prev,
        [`opt-${optId}`]: { ...prev[`opt-${optId}`], [ingredientId]: value },
      }));
    }

    if (detailLoading) {
      return <div className="p-4 text-sm text-gray-400">Loading...</div>;
    }

    return (
      <div className="border-t border-slate-100 p-4 space-y-4">
        {detailError && <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm p-3">{detailError}</div>}
        {/* Attached products */}
        <div>
          <p className="text-xs font-semibold text-slate-600 mb-2">Attached products</p>
          <div className="flex flex-wrap gap-2">
            {detailProducts.map((p) => (
              <button
                type="button"
                key={p.id}
                onClick={() => toggleProduct(p.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  attached.has(p.id)
                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                    : 'bg-slate-100 text-slate-500 border border-transparent hover:bg-slate-200'
                }`}
              >
                {p.name} ({p.price})
              </button>
            ))}
          </div>
        </div>

        {/* Per-product options */}
        {attached.size > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-slate-600">Options per product</p>
            {detailProducts.filter((p) => attached.has(p.id)).map((p) => (
              <div key={p.id} className="rounded-xl border border-slate-100 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-700">{p.name}</span>
                  <span className="text-xs text-slate-400">{productOptions[p.id]?.length ?? 0} options</span>
                </div>

                {/* Existing options */}
                {(productOptions[p.id] ?? []).map((opt) => (
                  <div key={opt.id} className="space-y-1">
                    <div className="grid grid-cols-[1fr_80px_auto_auto] items-center gap-2">
                      <input
                        value={draftVal(opt.id, 'name', opt.name)}
                        onChange={(e) => setDraftVal(opt.id, 'name', e.target.value)}
                        className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                      />
                      <input
                        type="number"
                        step="0.01"
                        value={draftVal(opt.id, 'priceDelta', opt.priceDelta)}
                        onChange={(e) => setDraftVal(opt.id, 'priceDelta', parseFloat(e.target.value) || 0)}
                        placeholder="+P"
                        className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-center"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          if (await saveOption(opt.id)) {
                            await refreshProductOptions(p.id);
                            setDrafts((prev) => {
                              const next = { ...prev };
                              delete next[`opt-${opt.id}`];
                              return next;
                            });
                          }
                        }}
                        className="px-2 py-1.5 rounded-lg bg-black text-white text-xs font-medium hover:bg-gray-800"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteOption(opt.id)}
                        className="px-2 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-medium hover:bg-red-100"
                      >
                        Del
                      </button>
                    </div>

                    {/* Ingredient delta row */}
                    <div className="flex flex-wrap gap-2 pl-2">
                      {ingredients.map((ing) => {
                        const existing = opt.ingredients?.find((d) => d.ingredientId === ing.id);
                        const currentDelta = existing?.deltaQty ?? 0;
                        return (
                          <div key={ing.id} className="flex items-center gap-1 text-xs">
                            <span className="text-slate-500 whitespace-nowrap">{ing.name}:</span>
                            <input
                              type="number"
                              step="0.1"
                              value={deltaVal(opt.id, ing.id, currentDelta)}
                              onChange={(e) => setDeltaVal(opt.id, ing.id, e.target.value)}
                              onBlur={() => saveDelta(p.id, opt.id, ing.id)}
                              className="w-16 rounded border border-slate-200 px-1.5 py-1 text-xs text-center"
                              placeholder={`+${ing.baseUnit}`}
                            />
                            <span className="text-slate-400">{ing.baseUnit}</span>
                            <span
                              className={`min-w-12 text-[10px] transition-opacity ${
                                deltaSaveStates[`${opt.id}:${ing.id}`] === 'saved'
                                  ? 'animate-pulse text-emerald-600 opacity-100'
                                  : deltaSaveStates[`${opt.id}:${ing.id}`] === 'saving'
                                    ? 'text-slate-400 opacity-100'
                                    : deltaSaveStates[`${opt.id}:${ing.id}`] === 'error'
                                      ? 'text-red-600 opacity-100'
                                      : 'opacity-0'
                              }`}
                            >
                              {deltaSaveStates[`${opt.id}:${ing.id}`] === 'saved'
                                ? 'Saved'
                                : deltaSaveStates[`${opt.id}:${ing.id}`] === 'saving'
                                  ? 'Saving...'
                                  : deltaSaveStates[`${opt.id}:${ing.id}`] === 'error'
                                    ? 'Failed'
                                    : 'Saved'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {/* New option form */}
                <div className="grid grid-cols-[1fr_80px_auto] items-center gap-2 pt-2 border-t border-dashed border-slate-200">
                  <input
                    value={newOption[p.id]?.name ?? ''}
                    onChange={(e) =>
                      setNewOption((prev) => ({
                        ...prev,
                        [p.id]: { ...(prev[p.id] ?? { priceDelta: '' }), name: e.target.value },
                      }))
                    }
                    placeholder="New option..."
                    className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={newOption[p.id]?.priceDelta ?? ''}
                    onChange={(e) =>
                      setNewOption((prev) => ({
                        ...prev,
                        [p.id]: { ...(prev[p.id] ?? { name: '' }), priceDelta: e.target.value },
                      }))
                    }
                    placeholder="+P"
                    className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-center"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      if (await addOption(p.id, group.id)) {
                        await refreshProductOptions(p.id);
                      }
                    }}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-medium hover:bg-slate-200"
                  >
                    + Add
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Group settings */}
        <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={group.available}
              onChange={async () => {
                try {
                  await fetchJson(`/api/option-groups/${group.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ available: !group.available }),
                  });
                  await fetchGroups();
                } catch (e) {
                  console.error('Failed to update option group availability:', e);
                  alert(userMessage(e, 'Failed to update group availability'));
                }
              }}
            />
            Available
          </label>
           <button
            type="button"
            onClick={() => {
              if (confirm(`Delete "${group.name}" and all its options?`)) {
                fetchJson(`/api/option-groups/${group.id}`, { method: 'DELETE' })
                  .then(async () => {
                    setExpanded(null);
                    await fetchGroups();
                  })
                  .catch((e) => {
                    console.error('Failed to delete option group:', e);
                    alert(userMessage(e, 'Failed to delete group'));
                  });
              }
            }}
            className="ml-auto text-xs text-red-500 hover:text-red-700 font-medium"
          >
            Delete group
          </button>
        </div>
      </div>
    );
  }
}
