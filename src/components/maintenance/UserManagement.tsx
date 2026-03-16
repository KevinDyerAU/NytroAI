import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import { Card } from '../ui/card';
import { Search, UserPlus, Building2, X, Shield, User as UserIcon } from 'lucide-react';

interface UserProfile {
  id: string;
  full_name: string;
  email: string | null;
  role: string;
  is_admin: boolean;
  rto_id: number | null;
  rto_code: string | null;
  created_at: string | null;
  _rto_name?: string | null;
}

interface RTO {
  id: number;
  code: string;
  legalname: string | null;
}

export function UserManagement() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [rtos, setRtos] = useState<RTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRTO, setFilterRTO] = useState<string>('all'); // 'all', 'none', or rto_id
  const [assigningUserId, setAssigningUserId] = useState<string | null>(null);
  const [selectedRtoId, setSelectedRtoId] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  // Create user form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserRtoId, setNewUserRtoId] = useState<string>('');
  const [newUserIsAdmin, setNewUserIsAdmin] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [usersRes, rtosRes] = await Promise.all([
        supabase.from('user_profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('RTO').select('id, code, legalname').order('legalname', { ascending: true }),
      ]);

      if (usersRes.error) throw usersRes.error;
      if (rtosRes.error) throw rtosRes.error;

      const rtoMap: Record<number, string> = {};
      (rtosRes.data || []).forEach((r: any) => {
        rtoMap[r.id] = r.legalname || r.code;
      });

      const enrichedUsers = (usersRes.data || []).map((u: any) => ({
        ...u,
        _rto_name: u.rto_id ? rtoMap[u.rto_id] || null : null,
      }));

      setUsers(enrichedUsers);
      setRtos(rtosRes.data || []);
    } catch (err) {
      console.error('Error loading data:', err);
      toast.error('Failed to load users');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAssignRTO = async (userId: string) => {
    if (!selectedRtoId) {
      toast.error('Please select an RTO');
      return;
    }

    setIsSaving(true);
    try {
      const rto = rtos.find((r) => r.id === Number(selectedRtoId));
      if (!rto) throw new Error('RTO not found');

      const { error } = await supabase
        .from('user_profiles')
        .update({
          rto_id: rto.id,
          rto_code: rto.code,
        })
        .eq('id', userId);

      if (error) throw error;

      toast.success(`User assigned to ${rto.legalname || rto.code}`);
      setAssigningUserId(null);
      setSelectedRtoId('');
      await loadData();
    } catch (err: any) {
      console.error('Error assigning RTO:', err);
      toast.error(err.message || 'Failed to assign RTO');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveRTO = async (userId: string) => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          rto_id: null,
          rto_code: null,
        })
        .eq('id', userId);

      if (error) throw error;

      toast.success('User removed from RTO');
      await loadData();
    } catch (err: any) {
      console.error('Error removing RTO:', err);
      toast.error(err.message || 'Failed to remove user from RTO');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleAdmin = async (userId: string, currentIsAdmin: boolean) => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ is_admin: !currentIsAdmin })
        .eq('id', userId);

      if (error) throw error;

      toast.success(currentIsAdmin ? 'Admin access removed' : 'Admin access granted');
      await loadData();
    } catch (err: any) {
      console.error('Error toggling admin:', err);
      toast.error(err.message || 'Failed to update admin status');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateUser = async () => {
    if (!newUserEmail.trim()) {
      toast.error('Email is required');
      return;
    }
    if (!newUserName.trim()) {
      toast.error('Full name is required');
      return;
    }

    setIsCreating(true);
    try {
      const rto = newUserRtoId ? rtos.find((r) => r.id === Number(newUserRtoId)) : null;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error('Not authenticated');
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-create-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            email: newUserEmail.trim(),
            fullName: newUserName.trim(),
            rtoId: rto?.id || null,
            rtoCode: rto?.code || null,
            isAdmin: newUserIsAdmin,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create user');
      }

      if (result.warning) {
        toast.warning(result.warning);
      } else {
        toast.success(`User created! An invite email has been sent to ${newUserEmail.trim()}`);
      }

      setShowCreateForm(false);
      setNewUserEmail('');
      setNewUserName('');
      setNewUserRtoId('');
      setNewUserIsAdmin(false);
      await loadData();
    } catch (err: any) {
      console.error('Error creating user:', err);
      toast.error(err.message || 'Failed to create user');
    } finally {
      setIsCreating(false);
    }
  };

  const filteredUsers = users.filter((user) => {
    // Text search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        user.full_name?.toLowerCase().includes(term) ||
        user.email?.toLowerCase().includes(term) ||
        user.rto_code?.toLowerCase().includes(term);
      if (!matchesSearch) return false;
    }

    // RTO filter
    if (filterRTO === 'none') return !user.rto_id;
    if (filterRTO !== 'all') return user.rto_id === Number(filterRTO);

    return true;
  });

  const unassignedCount = users.filter((u) => !u.rto_id).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-poppins font-bold text-[#1e293b]">User Management</h2>
          <p className="text-[#64748b] text-sm mt-1">
            Manage users and assign them to RTOs. {unassignedCount > 0 && (
              <span className="text-amber-600 font-medium">{unassignedCount} unassigned {unassignedCount === 1 ? 'user' : 'users'}</span>
            )}
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#3b82f6] hover:bg-[#2563eb] text-white font-semibold rounded-lg transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          Create User
        </button>
      </div>

      {/* Create User Form */}
      {showCreateForm && (
        <Card className="border border-[#dbeafe] bg-white p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-[#1e293b]">Create New User</h3>
            <button onClick={() => setShowCreateForm(false)} className="text-[#94a3b8] hover:text-[#64748b]">
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-xs text-[#64748b] mb-4">
            An invite email will be sent to the user with a link to set their password.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#64748b] mb-1">Full Name *</label>
              <input
                type="text"
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                className="w-full px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6]"
                placeholder="John Doe"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#64748b] mb-1">Email *</label>
              <input
                type="email"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                className="w-full px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6]"
                placeholder="user@company.com.au"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#64748b] mb-1">Assign to RTO</label>
              <select
                value={newUserRtoId}
                onChange={(e) => setNewUserRtoId(e.target.value)}
                className="w-full px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6]"
              >
                <option value="">No RTO (independent user)</option>
                {rtos.map((rto) => (
                  <option key={rto.id} value={rto.id}>
                    {rto.legalname || rto.code} ({rto.code})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newUserIsAdmin}
                  onChange={(e) => setNewUserIsAdmin(e.target.checked)}
                  className="w-4 h-4 rounded border-[#e2e8f0] accent-[#3b82f6]"
                />
                <span className="text-sm text-[#64748b]">Grant admin access</span>
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={() => setShowCreateForm(false)}
              className="px-4 py-2 border border-[#e2e8f0] rounded-lg text-sm font-semibold text-[#64748b] hover:bg-[#f1f5f9] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateUser}
              disabled={isCreating}
              className="px-4 py-2 bg-[#3b82f6] hover:bg-[#2563eb] text-white font-semibold rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              {isCreating ? 'Creating...' : 'Create & Send Invite'}
            </button>
          </div>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
          <input
            type="text"
            placeholder="Search by name, email, or RTO code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-[#e2e8f0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6] focus:border-transparent"
          />
        </div>
        <select
          value={filterRTO}
          onChange={(e) => setFilterRTO(e.target.value)}
          className="px-3 py-2.5 border border-[#e2e8f0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6] min-w-[200px]"
        >
          <option value="all">All Users ({users.length})</option>
          <option value="none">Unassigned ({unassignedCount})</option>
          {rtos.map((rto) => {
            const count = users.filter((u) => u.rto_id === rto.id).length;
            return (
              <option key={rto.id} value={rto.id}>
                {rto.legalname || rto.code} ({count})
              </option>
            );
          })}
        </select>
      </div>

      {/* User List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3b82f6]"></div>
        </div>
      ) : filteredUsers.length === 0 ? (
        <Card className="border border-[#e2e8f0] p-8 text-center">
          <UserIcon className="w-12 h-12 text-[#cbd5e1] mx-auto mb-3" />
          <p className="text-[#64748b]">
            {searchTerm || filterRTO !== 'all' ? 'No users match your filters' : 'No users found'}
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredUsers.map((user) => (
            <Card key={user.id} className="border border-[#e2e8f0] p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between gap-4">
                {/* User info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h4 className="font-semibold text-[#1e293b] truncate">{user.full_name}</h4>
                    {user.is_admin && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 font-medium">
                        Admin
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-[#64748b] truncate">{user.email || 'No email'}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {user.rto_id ? (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                        <Building2 className="w-3 h-3" />
                        {user._rto_name || user.rto_code}
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                        No RTO
                      </span>
                    )}
                    <span className="text-xs text-[#cbd5e1]">
                      Joined {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'Unknown'}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Assign/Change RTO */}
                  {assigningUserId === user.id ? (
                    <div className="flex items-center gap-2">
                      <select
                        value={selectedRtoId}
                        onChange={(e) => setSelectedRtoId(e.target.value)}
                        className="px-2 py-1.5 border border-[#e2e8f0] rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#3b82f6]"
                      >
                        <option value="">Select RTO...</option>
                        {rtos.map((rto) => (
                          <option key={rto.id} value={rto.id}>
                            {rto.legalname || rto.code} ({rto.code})
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleAssignRTO(user.id)}
                        disabled={isSaving || !selectedRtoId}
                        className="px-2 py-1.5 bg-[#3b82f6] text-white text-xs rounded-lg hover:bg-[#2563eb] disabled:opacity-50 transition-colors"
                      >
                        {isSaving ? '...' : 'Save'}
                      </button>
                      <button
                        onClick={() => { setAssigningUserId(null); setSelectedRtoId(''); }}
                        className="text-[#94a3b8] hover:text-[#64748b]"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          setAssigningUserId(user.id);
                          setSelectedRtoId(user.rto_id ? String(user.rto_id) : '');
                        }}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-[#3b82f6] hover:bg-[#eff6ff] rounded-lg transition-colors"
                      >
                        <Building2 className="w-3 h-3" />
                        {user.rto_id ? 'Change RTO' : 'Assign RTO'}
                      </button>
                      {user.rto_id && (
                        <button
                          onClick={() => handleRemoveRTO(user.id)}
                          disabled={isSaving}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                        >
                          <X className="w-3 h-3" />
                          Remove
                        </button>
                      )}
                      <button
                        onClick={() => handleToggleAdmin(user.id, user.is_admin)}
                        disabled={isSaving}
                        className={`flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg transition-colors disabled:opacity-50 ${
                          user.is_admin
                            ? 'text-purple-600 hover:bg-purple-50'
                            : 'text-[#94a3b8] hover:bg-[#f1f5f9]'
                        }`}
                        title={user.is_admin ? 'Remove admin access' : 'Grant admin access'}
                      >
                        <Shield className="w-3 h-3" />
                        {user.is_admin ? 'Revoke Admin' : 'Make Admin'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
