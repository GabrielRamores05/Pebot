'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import LicensePanel from './license/LicensePanel';
import PrintingPanel from './PrintingPanel';
import { fetchJson, userMessage } from '@/lib/fetch-json';
import AdminToolsSection from '../AdminToolsSection';

// ── Types ────────────────────────────────────────────────────────────────────
interface AppUser {
  id: number;
  name: string;
  email: string;
  role: 'ADMIN' | 'STAFF' | 'KITCHEN';
  active: boolean;
  createdAt: string;
}

const ROLES: AppUser['role'][] = ['ADMIN', 'STAFF', 'KITCHEN'];

const ROLE_COLORS: Record<AppUser['role'], string> = {
  ADMIN: 'bg-amber-50 text-accent-text border-amber-200',
  STAFF: 'bg-blue-50 text-blue-600 border-blue-200',
  KITCHEN: 'bg-green-50 text-green-600 border-green-200',
};

const ROLE_DESC: Record<AppUser['role'], string> = {
  ADMIN: 'Full access — orders, POS, tables, products, analytics, inventory, settings',
  STAFF: 'Orders, POS Terminal, Tables, Kitchen',
  KITCHEN: 'Kitchen display only',
};

const BRANDING_UPDATED_EVENT = 'branding:updated';

// ── Settings Page ────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const [tab, setTab] = useState<'branding' | 'business' | 'printing' | 'loyalty' | 'payments' | 'ai' | 'tools' | 'license'>('business');
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  // Branding
  const [shopName, setShopName] = useState('Pebot');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [brandingSaving, setBrandingSaving] = useState(false);
  const [brandingMsg, setBrandingMsg] = useState('');
  const [usersError, setUsersError] = useState('');
  const logoInputRef = useRef<HTMLInputElement>(null);

  // BIR Business Settings
  const [businessName, setBusinessName] = useState('My Restaurant');
  const [businessAddress, setBusinessAddress] = useState('');
  const [tin, setTin] = useState('');
  const [branchCode, setBranchCode] = useState('0000');
  const [vatRate, setVatRate] = useState(12);
  const [receiptPrefix, setReceiptPrefix] = useState('INV');
  const [footerMessage, setFooterMessage] = useState('Thank you for your visit!');
  const [loyaltyEnabled, setLoyaltyEnabled] = useState(true);
  const [studentPwdDiscountRate, setStudentPwdDiscountRate] = useState(20);
  // Spec 017: VAT registration and service charge
  const [vatRegistered, setVatRegistered] = useState(true);
  const [serviceChargeRate, setServiceChargeRate] = useState(0);
  const [serviceChargeOrderTypes, setServiceChargeOrderTypes] = useState<string[]>(['DINE_IN']);
  // Payment method settings
  const [gcashAccountName, setGcashAccountName] = useState('');
  const [gcashQrImage, setGcashQrImage] = useState<string | null>(null);
  const [paymayaAccountName, setPaymayaAccountName] = useState('');
  const [paymayaQrImage, setPaymayaQrImage] = useState<string | null>(null);
  // AI Consultant settings
  const [aiApiKey, setAiApiKey] = useState('');
  const [aiModel, setAiModel] = useState('google/gemma-4-31b-it');
  const [aiSystemPrompt, setAiSystemPrompt] = useState('You are Pebot Assistant, a helpful AI consultant for restaurant management.');
  const [aiFolderAccess, setAiFolderAccess] = useState(false);
  const [aiReadBirPricing, setAiReadBirPricing] = useState(false);
  const [businessSaving, setBusinessSaving] = useState(false);
  const [businessMsg, setBusinessMsg] = useState('');

  // Users
  const [users, setUsers] = useState<AppUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<AppUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AppUser | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Create/Edit form
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'STAFF' as AppUser['role'] });
  const [formError, setFormError] = useState('');
  const [formSaving, setFormSaving] = useState(false);

  // Password change form
  const [pwForm, setPwForm] = useState({ password: '', confirm: '' });
  const [pwError, setPwError] = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  function notifyBrandingUpdate(payload: { shopName?: string; logoUrl?: string | null }) {
    window.dispatchEvent(new CustomEvent(BRANDING_UPDATED_EVENT, { detail: payload }));
  }

  async function persistLogo(logo: string | null) {
    await fetch('/api/settings/branding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ logoUrl: logo }),
    });
  }

  // ── Load branding ──────────────────────────────────────────────────────────
  useEffect(() => {
    fetchJson<{ shopName?: string; logoUrl?: string | null }>('/api/settings/branding')
      .then((d) => {
        setShopName(d.shopName ?? 'Pebot');
        setLogoUrl(d.logoUrl ?? null);
      })
      .catch((e) => {
        console.error('Failed to load branding:', e);
        setBrandingMsg(`Failed to load branding: ${userMessage(e, 'Try again.')}`);
      });
  }, []);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setCurrentUserId(d?.user?.userId ?? null))
      .catch(() => {});
  }, []);

  // ── Load BIR Business Settings ─────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/settings/business')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d) {
          setBusinessName(d.businessName || 'My Restaurant');
          setBusinessAddress(d.businessAddress || '');
          setTin(d.tin || '');
          setBranchCode(d.branchCode || '0000');
          setVatRate(d.vatRate ?? 12);
          setReceiptPrefix(d.receiptSerialPrefix || 'INV');
          setFooterMessage(d.footerMessage || 'Thank you for your visit!');
          setLoyaltyEnabled(d.loyaltyEnabled ?? true);
          setStudentPwdDiscountRate(d.studentPwdDiscountRate != null ? Number(d.studentPwdDiscountRate) : 20);
          setVatRegistered(d.vatRegistered ?? true);
          setServiceChargeRate(d.serviceChargeRate != null ? Number(d.serviceChargeRate) : 0);
          setServiceChargeOrderTypes(String(d.serviceChargeOrderTypes || 'DINE_IN').split(',').filter(Boolean));
          setGcashAccountName(d.gcashAccountName || '');
          setGcashQrImage(d.gcashQrImage || null);
          setPaymayaAccountName(d.paymayaAccountName || '');
          setPaymayaQrImage(d.paymayaQrImage || null);
          setAiApiKey(d.aiApiKey || '');
          setAiModel(d.aiModel || 'google/gemma-4-31b-it');
          setAiSystemPrompt(d.aiSystemPrompt || 'You are Pebot Assistant, a helpful AI consultant for restaurant management.');
          setAiFolderAccess(d.aiFolderAccess ?? false);
          setAiReadBirPricing(d.aiReadBirPricing ?? false);
        }
      })
      .catch(() => {});
  }, []);

  // ── Save BIR Business Settings ─────────────────────────────────────────────
  async function saveBusinessSettings() {
    setBusinessSaving(true);
    setBusinessMsg('');
    try {
      const res = await fetch('/api/settings/business', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: businessName || 'My Restaurant',
          businessAddress: businessAddress || '',
          tin: tin || '',
          branchCode: branchCode || '0000',
          vatRate: vatRate != null ? Number(vatRate) : 12,
          receiptSerialPrefix: receiptPrefix || 'INV',
          footerMessage: footerMessage || 'Thank you for your visit!',
          loyaltyEnabled,
          studentPwdDiscountRate: studentPwdDiscountRate != null ? Number(studentPwdDiscountRate) : 20,
          vatRegistered,
          serviceChargeRate: Number(serviceChargeRate) || 0,
          serviceChargeOrderTypes: serviceChargeOrderTypes.join(','),
          gcashAccountName: gcashAccountName || null,
          gcashQrImage: gcashQrImage || null,
          paymayaAccountName: paymayaAccountName || null,
          paymayaQrImage: paymayaQrImage || null,
          aiApiKey: aiApiKey || null,
          aiModel: aiModel || 'google/gemma-4-31b-it',
          aiSystemPrompt: aiSystemPrompt || null,
          aiFolderAccess: aiFolderAccess,
          aiReadBirPricing: aiReadBirPricing,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setBusinessMsg('Business settings saved!')
        setAiFolderAccess(data.aiFolderAccess ? true : false)
        setAiReadBirPricing(data.aiReadBirPricing ? true : false);
      } else {
        setBusinessMsg('Failed: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      console.error('Save error:', err);
      setBusinessMsg('Network error');
    } finally {
      setBusinessSaving(false);
    }
  }

  // ── Load users ─────────────────────────────────────────────────────────────
  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      setUsers(await fetchJson<AppUser[]>('/api/settings/users'));
      setUsersError('');
    } catch (e) {
      console.error('Failed to fetch users:', e);
      setUsersError(userMessage(e, 'Could not load users. Try again.'));
    } finally {
      setUsersLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // ── Logo upload ────────────────────────────────────────────────────────────
  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.url) {
        setLogoUrl(data.url);
        notifyBrandingUpdate({ logoUrl: data.url });
        await persistLogo(data.url);
      }
    } finally {
      setLogoUploading(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  }

  // ── Save branding ──────────────────────────────────────────────────────────
  async function saveBranding() {
    setBrandingSaving(true);
    setBrandingMsg('');
    try {
      const res = await fetch('/api/settings/branding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopName, logoUrl }),
      });
      if (res.ok) {
        setBrandingMsg('Saved!');
        notifyBrandingUpdate({ shopName, logoUrl });
      }
      else setBrandingMsg('Failed to save.');
    } finally {
      setBrandingSaving(false);
    }
  }

  // ── Create user ────────────────────────────────────────────────────────────
  async function handleCreate() {
    setFormError('');
    if (!form.name || !form.email || !form.password) {
      setFormError('All fields are required.');
      return;
    }
    setFormSaving(true);
    try {
      const res = await fetch('/api/settings/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setFormError(data.error || 'Failed to create user.'); return; }
      setShowCreate(false);
      setForm({ name: '', email: '', password: '', role: 'STAFF' });
      fetchUsers();
    } finally {
      setFormSaving(false);
    }
  }

  // ── Update role / active ───────────────────────────────────────────────────
  async function updateUser(id: number, patch: Partial<Pick<AppUser, 'role' | 'active'>>) {
    if (currentUserId === id && patch.role !== undefined) return;
    await fetch(`/api/settings/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    fetchUsers();
  }

  // ── Change password ────────────────────────────────────────────────────────
  async function handleChangePassword() {
    setPwError('');
    if (pwForm.password.length < 4) { setPwError('Minimum 4 characters.'); return; }
    if (pwForm.password !== pwForm.confirm) { setPwError('Passwords do not match.'); return; }
    if (!editUser) return;
    setPwSaving(true);
    try {
      const res = await fetch(`/api/settings/users/${editUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pwForm.password }),
      });
      if (res.ok) {
        setEditUser(null);
        setPwForm({ password: '', confirm: '' });
      } else {
        const d = await res.json();
        setPwError(d.error || 'Failed.');
      }
    } finally {
      setPwSaving(false);
    }
  }

  // ── Delete user ────────────────────────────────────────────────────────────
  function requestDeleteUser(user: AppUser) {
    if (currentUserId === user.id) return;
    setDeleteTarget(user);
    setDeleteConfirm('');
    setDeleteError('');
  }

  async function confirmDeleteUser() {
    if (!deleteTarget) return;
    if (deleteConfirm.trim() !== deleteTarget.email) {
      setDeleteError(`Type ${deleteTarget.email} exactly to confirm.`);
      return;
    }
    setDeleteLoading(true);
    setDeleteError('');
    const res = await fetch(`/api/settings/users/${deleteTarget.id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setDeleteError(data.error || 'Failed to delete user.');
      setDeleteLoading(false);
      return;
    }
    setDeleteLoading(false);
    setDeleteTarget(null);
    setDeleteConfirm('');
    fetchUsers();
  }

  // ────────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 overflow-y-auto bg-page min-h-screen p-4 md:p-6">
      <div className="max-w-5xl">

         {/* Header */}
         <div className="mb-4">
           <h1 className="c-title">Settings</h1>
           <p className="mt-1.5 text-sm text-muted">Manage branding and user accounts</p>
         </div>
         {usersError && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm p-3">{usersError}</div>}

         {/* Tabs */}
        <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 mb-4 w-fit shadow-sm">
          {(['business', 'printing', 'branding', 'loyalty', 'payments', 'ai', 'tools', 'license'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
                tab === t ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              {t === 'business' ? 'Business' : t === 'printing' ? 'Printing' : t === 'branding' ? 'Branding' : t === 'loyalty' ? 'Loyalty' : t === 'payments' ? 'Payments' : t === 'tools' ? 'Account & Data' : t === 'license' ? 'License' : 'AI Consultant'}
            </button>
          ))}
        </div>

        {/* ── BRANDING TAB ────────────────────────────────────────────────── */}
        {tab === 'branding' && (
          <div className="bg-white rounded-2xl p-5 border border-gray-200 space-y-4">

            {/* Logo */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-3">Shop Logo</label>
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center overflow-hidden shrink-0">
                  {logoUrl
                    ? <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
                    : <span className="text-xs text-faint">No logo</span>}
                </div>
                <div className="flex flex-col gap-2">
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoUpload}
                  />
                  <button
                    onClick={() => logoInputRef.current?.click()}
                    disabled={logoUploading}
                    className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
                  >
                    {logoUploading ? 'Uploading...' : 'Upload Logo'}
                  </button>
                  {logoUrl && (
                    <button
                      onClick={async () => {
                        setLogoUrl(null);
                        notifyBrandingUpdate({ logoUrl: null });
                        await persistLogo(null);
                      }}
                      className="px-4 py-2 bg-red-900/40 hover:bg-red-900/60 text-red-400 text-sm rounded-lg transition-colors"
                    >
                      Remove Logo
                    </button>
                  )}
                  <p className="text-xs text-gray-500">PNG, JPG, WEBP recommended. Square image works best.</p>
                </div>
              </div>
            </div>

            {/* Shop Name */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">Shop Name</label>
              <input
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500"
                placeholder="Your cafe name"
              />
              <p className="text-xs text-gray-500 mt-1">Shown in the admin sidebar and login page.</p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={saveBranding}
                disabled={brandingSaving}
                className="px-5 py-2.5 bg-accent hover:bg-amber-500 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
              >
                {brandingSaving ? 'Saving...' : 'Save Changes'}
              </button>
              {brandingMsg && (
                <span className={`text-sm ${brandingMsg === 'Saved!' ? 'text-green-600' : 'text-red-600'}`}>
                  {brandingMsg}
                </span>
              )}
            </div>
          </div>
        )}

        {/* ── BIR BUSINESS TAB ────────────────────────────────────────────────── */}
        {tab === 'business' && (
          <div className="bg-white rounded-2xl p-5 border border-gray-200 space-y-4">
            <div className="border-b border-gray-200 pb-4">
              <h3 className="text-lg font-bold text-gray-900">BIR Business Settings</h3>
              <p className="text-gray-500 text-sm mt-1">Business information for BIR-compliant receipts/invoices</p>
            </div>

            {/* Business Name */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">Registered Business Name</label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:border-amber-500"
                placeholder="My Restaurant"
              />
            </div>

            {/* Business Address */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">Business Address</label>
              <textarea
                value={businessAddress}
                onChange={(e) => setBusinessAddress(e.target.value)}
                rows={2}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:border-amber-500 resize-none"
                placeholder="123 Main Street, City, Province"
              />
            </div>

            {/* TIN & Branch */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">TIN (Tax Identification Number)</label>
                <input
                  type="text"
                  value={tin}
                  onChange={(e) => setTin(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:border-amber-500"
                  placeholder="123-456-789-000"
                />
                <p className="text-gray-500 text-xs mt-1">9-digit TIN</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">Branch Code</label>
                <input
                  type="text"
                  value={branchCode}
                  onChange={(e) => setBranchCode(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:border-amber-500"
                  placeholder="0000"
                  maxLength={4}
                />
                <p className="text-gray-500 text-xs mt-1">4-digit branch code</p>
              </div>
            </div>

            {/* VAT Rate */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">VAT Rate (%)</label>
              <select
                value={vatRate}
                onChange={(e) => setVatRate(parseFloat(e.target.value))}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:border-amber-500"
              >
                <option value={0}>0% (VAT Exempt)</option>
                <option value={12}>12% (Standard)</option>
              </select>
            </div>

            {/* VAT registration (spec 017) */}
            <div>
              <label className="flex items-center gap-3 text-sm font-medium text-gray-600">
                <input
                  type="checkbox"
                  checked={vatRegistered}
                  onChange={(e) => setVatRegistered(e.target.checked)}
                  className="h-4 w-4 accent-amber-600"
                />
                VAT-registered business
              </label>
              <p className="text-gray-500 text-xs mt-1">
                Turn off if you are not VAT-registered. Senior Citizen and PWD discounts then take 20% off the price without removing VAT.
              </p>
            </div>

            {/* Service charge (spec 017) */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">Service Charge (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={serviceChargeRate}
                onChange={(e) => setServiceChargeRate(parseFloat(e.target.value) || 0)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:border-amber-500"
                placeholder="0"
              />
              <div className="mt-2 flex flex-wrap gap-4 text-sm text-gray-600">
                {[['DINE_IN', 'Dine-in'], ['TAKEOUT', 'Takeout'], ['DELIVERY', 'Delivery']].map(([type, label]) => (
                  <label key={type} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={serviceChargeOrderTypes.includes(type)}
                      onChange={(e) =>
                        setServiceChargeOrderTypes((prev) =>
                          e.target.checked ? [...prev, type] : prev.filter((t) => t !== type),
                        )
                      }
                      className="h-4 w-4 accent-amber-600"
                    />
                    {label}
                  </label>
                ))}
              </div>
              <p className="text-gray-500 text-xs mt-1">0 turns it off. Added after discounts, as its own line on the bill.</p>
            </div>

            {/* Student Discount Rate (Senior/PWD is fixed at 20% by law) */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">Student Discount Rate (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                value={studentPwdDiscountRate}
                onChange={(e) => setStudentPwdDiscountRate(parseFloat(e.target.value) || 0)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:border-amber-500"
                placeholder="20"
              />
              <p className="text-gray-500 text-xs mt-1">Used by the terminal&apos;s Student button. Senior Citizen and PWD are fixed at 20% with VAT removed, as the law requires.</p>
            </div>

            {/* Receipt Prefix */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">Receipt Serial Prefix</label>
              <input
                type="text"
                value={receiptPrefix}
                onChange={(e) => setReceiptPrefix(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:border-amber-500"
                placeholder="INV"
              />
              <p className="text-gray-500 text-xs mt-1">e.g., INV, ORD, RCPT</p>
            </div>

            {/* Footer Message */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">Receipt Footer Message</label>
              <input
                type="text"
                value={footerMessage}
                onChange={(e) => setFooterMessage(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:border-amber-500"
                placeholder="Thank you for your visit!"
              />
            </div>

            {/* Save Button */}
            <div className="flex items-center gap-4 pt-4 border-t border-gray-200">
              <button
                onClick={saveBusinessSettings}
                disabled={businessSaving}
                className="bg-accent hover:bg-amber-500 disabled:bg-gray-300 text-white px-6 py-3 rounded-xl font-medium transition-colors"
              >
                {businessSaving ? 'Saving...' : 'Save Business Settings'}
              </button>
              {businessMsg && (
                <span className="text-emerald-600 text-sm font-medium">{businessMsg}</span>
              )}
            </div>
          </div>
        )}

        {/* ── LOYALTY TAB ───────────────────────────────────────────────────── */}
        {tab === 'loyalty' && (
          <div className="bg-white rounded-2xl p-5 border border-gray-200 space-y-4">
            <div className="border-b border-gray-200 pb-4">
              <h3 className="text-lg font-bold text-gray-900">Loyalty Program</h3>
              <p className="text-gray-500 text-sm mt-1">Enable or disable the loyalty program globally</p>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-900 font-medium">Loyalty Program</p>
                <p className="text-gray-500 text-sm">When disabled, cashiers cannot assign loyalty members and no points are awarded.</p>
              </div>
              <button
                onClick={() => setLoyaltyEnabled(!loyaltyEnabled)}
                className={`relative h-7 w-12 rounded-full transition-colors ${loyaltyEnabled ? 'bg-accent' : 'bg-gray-300'}`}
              >
                <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-transform ${loyaltyEnabled ? 'translate-x-6' : 'left-1'}`} />
              </button>
            </div>

            <div className="flex items-center gap-4 pt-4 border-t border-gray-200">
              <button
                onClick={saveBusinessSettings}
                disabled={businessSaving}
                className="bg-accent hover:bg-amber-500 disabled:bg-gray-300 text-white px-6 py-3 rounded-xl font-medium transition-colors"
              >
                {businessSaving ? 'Saving...' : 'Save Loyalty Settings'}
              </button>
              {businessMsg && (
                <span className="text-emerald-600 text-sm font-medium">{businessMsg}</span>
              )}
            </div>
          </div>
        )}

        {/* PAYMENTS TAB */}
        {tab === 'payments' && (
          <div className="bg-white rounded-2xl p-5 border border-gray-200 space-y-4">
            <div className="border-b border-gray-200 pb-4">
              <h3 className="text-lg font-bold text-gray-900">Payment Methods</h3>
              <p className="text-gray-500 text-sm mt-1">Configure QR codes for GCash and PayMaya</p>
            </div>

            {/* GCash */}
            <div className="border border-gray-200 rounded-xl p-4 space-y-4">
              <h4 className="text-md font-semibold text-gray-900">GCash</h4>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">Account Name</label>
                <input
                  type="text"
                  value={gcashAccountName}
                  onChange={(e) => setGcashAccountName(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:border-amber-500"
                  placeholder="Juan Dela Cruz"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">QR Image</label>
                {gcashQrImage ? (
                  <div className="flex items-center gap-3">
                    <img src={gcashQrImage} alt="GCash QR" className="w-20 h-20 rounded border border-gray-200 object-contain bg-white p-1" />
                    <button
                      onClick={() => setGcashQrImage(null)}
                      className="text-red-400 hover:text-red-300 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 py-4 text-sm font-medium text-gray-500 transition hover:bg-gray-100">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const fd = new FormData();
                        fd.append('file', file);
                        const res = await fetch('/api/upload', { method: 'POST', body: fd });
                        const data = await res.json();
                        if (data.url) setGcashQrImage(data.url);
                      }}
                    />
                    Upload GCash QR
                  </label>
                )}
              </div>
            </div>

            {/* PayMaya */}
            <div className="border border-gray-200 rounded-xl p-4 space-y-4">
              <h4 className="text-md font-semibold text-gray-900">PayMaya</h4>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">Account Name</label>
                <input
                  type="text"
                  value={paymayaAccountName}
                  onChange={(e) => setPaymayaAccountName(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:border-amber-500"
                  placeholder="Juan Dela Cruz"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">QR Image</label>
                {paymayaQrImage ? (
                  <div className="flex items-center gap-3">
                    <img src={paymayaQrImage} alt="PayMaya QR" className="w-20 h-20 rounded border border-gray-200 object-contain bg-white p-1" />
                    <button
                      onClick={() => setPaymayaQrImage(null)}
                      className="text-red-400 hover:text-red-300 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 py-4 text-sm font-medium text-gray-500 transition hover:bg-gray-100">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const fd = new FormData();
                        fd.append('file', file);
                        const res = await fetch('/api/upload', { method: 'POST', body: fd });
                        const data = await res.json();
                        if (data.url) setPaymayaQrImage(data.url);
                      }}
                    />
                    Upload PayMaya QR
                  </label>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4 pt-4 border-t border-gray-200">
              <button
                onClick={saveBusinessSettings}
                disabled={businessSaving}
                className="bg-accent hover:bg-amber-500 disabled:bg-gray-300 text-white px-6 py-3 rounded-xl font-medium transition-colors"
              >
                {businessSaving ? 'Saving...' : 'Save Payment Settings'}
              </button>
              {businessMsg && (
                <span className="text-emerald-600 text-sm font-medium">{businessMsg}</span>
              )}
            </div>
          </div>
        )}

        {/* AI CONSULTANT TAB */}
        {tab === 'ai' && (
          <div className="bg-white rounded-2xl p-5 border border-gray-200 space-y-4">
            <div className="border-b border-gray-200 pb-4">
              <h3 className="text-lg font-bold text-gray-900">AI Consultant</h3>
              <p className="text-gray-500 text-sm mt-1">Configure your AI assistant powered by OpenRouter</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">OpenRouter API Key</label>
              <input
                type="password"
                value={aiApiKey}
                onChange={(e) => setAiApiKey(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:border-amber-500 font-mono text-sm"
                placeholder="sk-or-v1-..."
              />
              <p className="text-xs text-gray-500 mt-1">Get your API key from <a href="https://openrouter.ai" target="_blank" rel="noopener noreferrer" className="text-accent-text hover:text-accent-text">openrouter.ai</a></p>
              <p className="text-xs text-gray-500 mt-1">The key is stored securely in your local database and never sent to the client.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">AI Model</label>
              <input
                type="text"
                value={aiModel}
                onChange={(e) => setAiModel(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:border-amber-500 font-mono text-sm"
                placeholder="google/gemma-4-31b-it"
              />
              <p className="text-xs text-gray-500 mt-1">Model identifier from OpenRouter. Default: google/gemma-4-31b-it</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">System Prompt</label>
              <textarea
                value={aiSystemPrompt}
                onChange={(e) => setAiSystemPrompt(e.target.value)}
                rows={4}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:border-amber-500 resize-none"
                placeholder="You are a helpful AI assistant..."
              />
              <p className="text-xs text-gray-500 mt-1">Instructions the AI sees before each conversation to set its personality and behavior.</p>
            </div>

            {/* AI Folder Access Toggle */}
            <div className="space-y-4 pt-4 border-t border-gray-200">
              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <div className="relative inline-block w-12 h-6">
                    <input
                      type="checkbox"
                      checked={aiFolderAccess}
                      onChange={(e) => setAiFolderAccess(e.target.checked)}
                      className="opacity-0 w-0 h-0"
                    />
                    <div
                      className={`absolute inset-0 rounded-full transition-colors ${
                        aiFolderAccess ? 'bg-amber-500' : 'bg-gray-600'
                      }`}
                    />
                    <div
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transform transition-transform ${
                        aiFolderAccess ? 'translate-x-6' : 'translate-x-0.5'
                      }`}
                    />
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-700">Allow AI to access business data</span>
                    <p className="text-xs text-gray-500 mt-0.5">
                      When enabled, the AI consultant can read products, inventory, orders, and settings to provide better assistance.
                    </p>
                  </div>
                </label>
              </div>

              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <div className="relative inline-block w-12 h-6">
                    <input
                      type="checkbox"
                      checked={aiReadBirPricing}
                      onChange={(e) => setAiReadBirPricing(e.target.checked)}
                      className="opacity-0 w-0 h-0"
                    />
                    <div
                      className={`absolute inset-0 rounded-full transition-colors ${
                        aiReadBirPricing ? 'bg-amber-500' : 'bg-gray-600'
                      }`}
                    />
                    <div
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transform transition-transform ${
                        aiReadBirPricing ? 'translate-x-6' : 'translate-x-0.5'
                      }`}
                    />
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-700">Include BIR pricing data</span>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Allow the AI to access capital costs, margins, and VAT data. Only available when &quot;Allow AI to access business data&quot; is enabled.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex items-center gap-4 pt-4 border-t border-gray-200">
              <button
                onClick={saveBusinessSettings}
                disabled={businessSaving}
                className="bg-accent hover:bg-amber-500 disabled:bg-gray-300 text-white px-6 py-3 rounded-xl font-medium transition-colors"
              >
                {businessSaving ? 'Saving...' : 'Save AI Settings'}
              </button>
              {businessMsg && (
                <span className="text-emerald-600 text-sm font-medium">{businessMsg}</span>
              )}
            </div>
          </div>
        )}

        {/* Users tab removed - use Staff page instead */}
      </div>

      {/* ── Delete User Modal ──────────────────────────────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setDeleteTarget(null)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-md border border-red-800/60 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-900 mb-1">Delete User</h2>
            <p className="text-sm text-gray-500 mb-4">
              This will permanently delete <span className="text-gray-900 font-medium">{deleteTarget.name}</span>.
            </p>
            <p className="text-xs text-red-300 bg-red-900/30 border border-red-700/50 rounded-lg px-3 py-2 mb-3">
              To confirm, type this email exactly: <span className="font-mono font-semibold">{deleteTarget.email}</span>
            </p>
            <input
              value={deleteConfirm}
              onChange={(e) => { setDeleteConfirm(e.target.value); setDeleteError(''); }}
              className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-red-500 mb-3"
              placeholder={deleteTarget.email}
              autoFocus
            />
            {deleteError && <p className="text-red-400 text-sm mb-3">{deleteError}</p>}

            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 rounded-xl bg-gray-50 text-gray-600 text-sm hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteUser}
                disabled={deleteLoading || deleteConfirm.trim() !== deleteTarget.email}
                className="flex-1 py-2.5 rounded-xl bg-red-700 hover:bg-red-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                {deleteLoading ? 'Deleting...' : 'Delete User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create User Modal ──────────────────────────────────────────────── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-md border border-gray-200 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-900 mb-5">New User</h2>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Full Name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500"
                  placeholder="Juan dela Cruz"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500"
                  placeholder="juan@cafe.com"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Password</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500"
                  placeholder="Minimum 4 characters"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Role</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value as AppUser['role'] })}
                  className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{r} — {ROLE_DESC[r]}</option>
                  ))}
                </select>
              </div>
            </div>

            {formError && <p className="text-red-400 text-sm mt-3">{formError}</p>}

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 py-2.5 rounded-xl bg-gray-50 text-gray-600 text-sm hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={formSaving}
                className="flex-1 py-2.5 rounded-xl bg-accent hover:bg-amber-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                {formSaving ? 'Creating...' : 'Create User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Change Password Modal ──────────────────────────────────────────── */}
      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setEditUser(null)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm border border-gray-200 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-900 mb-1">Change Password</h2>
            <p className="text-sm text-gray-500 mb-5">For <span className="text-gray-900 font-medium">{editUser.name}</span></p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">New Password</label>
                <input
                  type="password"
                  value={pwForm.password}
                  onChange={(e) => setPwForm({ ...pwForm, password: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500"
                  placeholder="Minimum 4 characters"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Confirm Password</label>
                <input
                  type="password"
                  value={pwForm.confirm}
                  onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500"
                  placeholder="Repeat password"
                />
              </div>
            </div>

            {pwError && <p className="text-red-400 text-sm mt-3">{pwError}</p>}

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setEditUser(null)}
                className="flex-1 py-2.5 rounded-xl bg-gray-50 text-gray-600 text-sm hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleChangePassword}
                disabled={pwSaving}
                className="flex-1 py-2.5 rounded-xl bg-accent hover:bg-amber-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                {pwSaving ? 'Saving...' : 'Update Password'}
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === 'license' && <LicensePanel />}
      {tab === 'printing' && <PrintingPanel />}

      {/* TOOLS TAB — account, QR codes, backup/restore */}
      {tab === 'tools' && (
        <AdminToolsSection shopName={shopName} logoUrl={logoUrl} />
      )}
    </div>
  );
}
