'use client';

import { useState, useEffect, useCallback } from 'react';

interface StaffMember {
  id: number;
  name: string;
  email: string;
  permissions: Record<string, boolean>;
  active: boolean;
  createdAt: string;
}

interface StaffFormData {
  name: string;
  email: string;
  password: string;
  permissions: Record<string, boolean>;
}

const PERMISSIONS = [
  { key: 'liveOrders', label: '📺 Live Orders', desc: 'View order dashboard' },
  { key: 'terminal', label: '💻 POS Terminal', desc: 'Create & manage orders' },
  { key: 'tables', label: '🪑 Tables', desc: 'Manage restaurant tables' },
  { key: 'analytics', label: '📊 Analytics', desc: 'View reports & metrics' },
  { key: 'products', label: '🛍️ Products', desc: 'Manage product catalog' },
  { key: 'inventory', label: '📦 Inventory', desc: 'Manage stock levels' },
  { key: 'kitchen', label: '🍳 Kitchen', desc: 'View & prepare orders' },
  { key: 'loyalty', label: '🏆 Loyalty', desc: 'Manage loyalty program' },
  { key: 'staff', label: '👥 Staff', desc: 'Manage staff & users' },
  { key: 'settings', label: '⚙️ Settings', desc: 'System configuration' },
];

const DEFAULT_PERMISSIONS = PERMISSIONS.reduce((acc, p) => ({ ...acc, [p.key]: false }), {});

function getPermissionCount(perms: Record<string, boolean>) {
  return Object.values(perms).filter(Boolean).length;
}


export default function StaffManagement() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState<StaffFormData>({
    name: '',
    email: '',
    password: '',
    permissions: { ...DEFAULT_PERMISSIONS },
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/staff');
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(`Failed to fetch staff: ${errorData.details || 'HTTP ' + res.status}`);
      }
      const data = await res.json();
      setStaff(data);
    } catch (e) {
      console.error('Failed to load staff:', e);
      setError(e instanceof Error ? e.message : 'Failed to load staff members');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.name || !formData.email) {
      setError('Please fill in name and email');
      return;
    }

    if (!editingId && !formData.password) {
      setError('Password is required for new staff');
      return;
    }

    // Check if at least one permission is enabled
    const hasPermission = Object.values(formData.permissions).some(p => p);
    if (!hasPermission) {
      setError('Please grant at least one permission');
      return;
    }

    try {
      const url = editingId ? `/api/staff/${editingId}` : '/api/staff';
      const method = editingId ? 'PUT' : 'POST';

      const payload: any = {
        name: formData.name,
        email: formData.email,
        permissions: formData.permissions,
      };

      // Only include password if provided
      if (formData.password) {
        payload.password = formData.password;
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to save staff member');
      }

      setSuccess(editingId ? 'Staff member updated successfully' : 'Staff member added successfully');
      setFormData({
        name: '',
        email: '',
        password: '',
        permissions: { ...DEFAULT_PERMISSIONS },
      });
      setShowForm(false);
      setEditingId(null);
      fetchStaff();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error saving staff member');
    }
  };

  const handleEditStaff = (member: StaffMember) => {
    setEditingId(member.id);
    setFormData({
      name: member.name,
      email: member.email,
      password: '',
      permissions: member.permissions,
    });
    setShowForm(true);
  };

  const handleDeleteStaff = async (id: number) => {
    if (!confirm('Are you sure you want to delete this staff member?')) return;

    try {
      const res = await fetch(`/api/staff/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete staff member');
      setSuccess('Staff member deleted');
      fetchStaff();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error deleting staff member');
    }
  };

  const handleToggleActive = async (id: number, active: boolean) => {
    try {
      const res = await fetch(`/api/staff/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !active }),
      });
      if (!res.ok) throw new Error('Failed to update staff member');
      fetchStaff();
    } catch (e) {
      setError('Error updating staff member');
    }
  };

  const handlePermissionChange = (permissionKey: string) => {
    setFormData(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [permissionKey]: !prev.permissions[permissionKey],
      },
    }));
  };

  const handleSelectAll = () => {
    const allEnabled = Object.values(formData.permissions).every(p => p);
    const newPermissions = PERMISSIONS.reduce((acc, p) => ({
      ...acc,
      [p.key]: !allEnabled,
    }), {});
    setFormData(prev => ({
      ...prev,
      permissions: newPermissions,
    }));
  };

  const filteredStaff = staff.filter(
    s => s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
         s.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const enabledCount = getPermissionCount(formData.permissions);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 min-h-screen">
        <div className="text-gray-500 font-medium">Loading staff members...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#F5F5F7] text-gray-900">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200/60 px-8 py-5">
        <div className="flex items-center justify-between gap-4 max-w-7xl mx-auto">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Staff Management</h1>
            <p className="text-gray-500 text-sm mt-1">Manage staff and assign granular permissions</p>
          </div>
          <button
            onClick={() => {
              setEditingId(null);
              setFormData({
                name: '',
                email: '',
                password: '',
                permissions: { ...DEFAULT_PERMISSIONS },
              });
              setShowForm(!showForm);
              setError('');
            }}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors"
          >
            {showForm ? '✕ Cancel' : '+ Add Staff Member'}
          </button>
        </div>
      </div>

      <div className="p-8 space-y-8">
        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600 text-sm font-medium">
            {error}
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-green-600 text-sm font-medium">
            {success}
          </div>
        )}

        {/* Add/Edit Form */}
        {showForm && (
          <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-8 border border-gray-100/50 shadow-xl shadow-gray-200/50 space-y-8">
            <h3 className="text-2xl font-semibold text-gray-900">{editingId ? 'Edit Staff Member' : 'Add New Staff Member'}</h3>
            <form onSubmit={handleSaveStaff} className="space-y-6">
              {/* Basic Info Section */}
              <div className="space-y-5">
                <h4 className="text-lg font-medium text-gray-800">Basic Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-base font-medium text-gray-600 mb-3">Full Name *</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full bg-slate-50 border border-gray-200/60 rounded-2xl px-5 py-3.5 text-gray-900 text-lg focus:outline-none focus:ring-2 focus:ring-amber-100/80 focus:border-amber-300 transition-all"
                      placeholder="John Doe"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-base font-medium text-gray-600 mb-3">Email *</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full bg-white border border-gray-200/60 rounded-2xl px-5 py-3.5 text-gray-900 text-lg focus:outline-none focus:ring-2 focus:ring-blue-100/80 focus:border-blue-300 transition-all"
                      placeholder="john@example.com"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-base font-medium text-gray-600 mb-3">
                    {editingId ? 'Password (leave blank to keep current)' : 'Password *'}
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full bg-slate-50 border border-gray-200/60 rounded-2xl px-5 py-3.5 text-gray-900 text-lg focus:outline-none focus:ring-2 focus:ring-amber-100/80 focus:border-amber-300 transition-all"
                    placeholder="••••••••"
                    required={!editingId}
                  />
                </div>
              </div>

              {/* Permissions Section */}
              <div className="space-y-5 border-t border-gray-100 pt-6">
                <div className="flex items-center justify-between">
                  <h4 className="text-lg font-medium text-gray-800">Feature Permissions ({enabledCount}/10)</h4>
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="text-sm px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-amber-600 font-medium transition-all"
                  >
                    {enabledCount === 10 ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
                <p className="text-base text-gray-500">Check the features this staff member can access:</p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {PERMISSIONS.map(perm => (
                    <label
                      key={perm.key}
                      className={`flex items-start gap-4 p-5 border-2 rounded-2xl cursor-pointer transition-all ${
                        formData.permissions[perm.key]
                          ? 'bg-gradient-to-br from-amber-50 to-amber-100/50 border-amber-300 shadow-md shadow-amber-100'
                          : 'bg-white border-gray-100 hover:border-gray-200 hover:shadow-lg hover:shadow-gray-100'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={formData.permissions[perm.key] || false}
                        onChange={() => handlePermissionChange(perm.key)}
                        className="w-6 h-6 rounded-lg accent-amber-500 mt-0.5 cursor-pointer shadow-sm"
                      />
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900 text-lg">{perm.label}</div>
                        <div className="text-sm text-gray-500 mt-1">{perm.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-4 pt-6">
                <button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-500 text-white font-semibold py-4 rounded-2xl transition-all shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 text-lg"
                >
                  {editingId ? 'Update Staff Member' : 'Add Staff Member'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Search Bar */}
        {!showForm && (
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white/80 backdrop-blur-sm border border-gray-200/60 rounded-2xl pl-12 pr-4 py-4 text-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-100/80 focus:border-amber-300 shadow-lg shadow-gray-100/50 transition-all"
            />
          </div>
        )}

        {/* Staff List */}
        {filteredStaff.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredStaff.map(member => (
              <div key={member.id} className="bg-white/80 backdrop-blur-xl rounded-3xl p-6 border border-gray-100/50 hover:border-gray-200 hover:shadow-2xl hover:shadow-gray-200/50 transition-all group">
                <div className="space-y-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center text-2xl font-semibold text-amber-700 shadow-inner">
                        {member.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900 text-xl">{member.name}</h3>
                        <p className="text-base text-gray-500">{member.email}</p>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={() => handleToggleActive(member.id, member.active)}
                        className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                          member.active
                            ? 'bg-gradient-to-r from-green-100 to-green-50 text-green-700 shadow-md shadow-green-100 hover:shadow-lg hover:shadow-green-100'
                            : 'bg-gradient-to-r from-gray-100 to-gray-50 text-gray-500 shadow-md shadow-gray-100 hover:shadow-lg hover:shadow-gray-100'
                        }`}
                      >
                        {member.active ? '✓ Active' : '○ Inactive'}
                      </button>
                      <button
                        onClick={() => handleEditStaff(member)}
                        className="px-4 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-blue-100 to-blue-50 text-blue-600 shadow-md shadow-blue-100 hover:shadow-lg hover:shadow-blue-100 transition-all"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteStaff(member.id)}
                        className="px-4 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-red-100 to-red-50 text-red-600 shadow-md shadow-red-100 hover:shadow-lg hover:shadow-red-100 transition-all"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {/* Permissions Display */}
                  <div className="pt-4 border-t border-gray-100">
                    <p className="text-sm text-gray-500 mb-3 font-medium">Access: {getPermissionCount(member.permissions)}/10 features</p>
                    <div className="flex flex-wrap gap-2">
                      {PERMISSIONS
                        .filter(p => member.permissions[p.key])
                        .map(p => (
                          <span
                            key={p.key}
                            className="px-3 py-1.5 text-sm bg-gradient-to-r from-amber-100 to-amber-50 text-amber-700 rounded-xl font-medium shadow-sm"
                          >
                            {p.label}
                          </span>
                        ))}
                      {getPermissionCount(member.permissions) === 0 && (
                        <span className="text-xs text-gray-400 italic">No permissions granted</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="text-gray-500 mb-4">
              {searchTerm ? 'No staff members found matching your search' : 'No staff members yet'}
            </p>
            <p className="text-gray-500 text-sm">
              {!showForm && !searchTerm && 'Click "Add Staff Member" to get started'}
            </p>
          </div>
        )}

        {/* Statistics */}
        {staff.length > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mt-10 pt-8 border-t border-gray-200/60">
            <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-6 border border-gray-100/50 shadow-xl shadow-gray-200/50 hover:shadow-2xl hover:shadow-gray-200/60 transition-all group">
              <div className="text-gray-400 text-sm font-semibold uppercase tracking-wider">Total Staff</div>
              <div className="text-5xl font-bold mt-3 text-gray-900">{staff.length}</div>
              <div className="mt-3 h-1 w-16 bg-gradient-to-r from-gray-300 to-gray-400 rounded-full"></div>
            </div>

            <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-6 border border-gray-100/50 shadow-xl shadow-green-100/50 hover:shadow-2xl hover:shadow-green-200/60 transition-all group">
              <div className="text-green-500 text-sm font-semibold uppercase tracking-wider">Active</div>
              <div className="text-5xl font-bold mt-3 text-green-600">
                {staff.filter(s => s.active).length}
              </div>
              <div className="mt-3 h-1 w-16 bg-gradient-to-r from-green-300 to-green-500 rounded-full"></div>
            </div>

            <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-6 border border-gray-100/50 shadow-xl shadow-purple-100/50 hover:shadow-2xl hover:shadow-purple-200/60 transition-all group">
              <div className="text-purple-500 text-sm font-semibold uppercase tracking-wider">Full Access</div>
              <div className="text-5xl font-bold mt-3 text-purple-600">
                {staff.filter(s => getPermissionCount(s.permissions) === 10).length}
              </div>
              <div className="mt-3 h-1 w-16 bg-gradient-to-r from-purple-300 to-purple-500 rounded-full"></div>
            </div>

            <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-6 border border-gray-100/50 shadow-xl shadow-blue-100/50 hover:shadow-2xl hover:shadow-blue-200/60 transition-all group">
              <div className="text-blue-500 text-sm font-semibold uppercase tracking-wider">Limited Access</div>
              <div className="text-5xl font-bold mt-3 text-blue-600">
                {staff.filter(s => {
                  const count = getPermissionCount(s.permissions);
                  return count > 0 && count < 10;
                }).length}
              </div>
              <div className="mt-3 h-1 w-16 bg-gradient-to-r from-blue-300 to-blue-500 rounded-full"></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
