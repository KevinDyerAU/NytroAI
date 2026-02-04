import React, { useState, useEffect } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Zap, Cpu, Search, ChevronLeft, ChevronRight, Tag, Plus, Trash2, Percent, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import { fetchRTOsFromSupabase, addValidationCredits, addAICredits, removeValidationCredits, removeAICredits, getAICredits, getValidationCredits } from '../../types/rto';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';

interface RTOCredit {
  id: number;
  code: string;
  name: string;
  aiCredits: number;
  validationCredits: number;
}

interface UserCredit {
  id: string;
  email: string;
  full_name: string | null;
  rto_code: string | null;
  validationCredits: number;
  aiCredits: number;
}

interface PromoCode {
  id: number;
  code: string;
  description: string | null;
  discount_percent: number | null;
  discount_amount: number | null;
  valid_until: string | null;
  max_uses: number | null;
  current_uses: number;
  is_active: boolean;
}

interface CreditMaintenanceProps {
  onCreditsModified?: () => void;
}

export function CreditsMaintenance({ onCreditsModified }: CreditMaintenanceProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'users' | 'credits' | 'promos'>('users');
  const [rtos, setRTOs] = useState<RTOCredit[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [selectedRTO, setSelectedRTO] = useState<RTOCredit | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    operation: 'add' as 'add' | 'remove',
    type: 'validation' as 'validation' | 'ai',
    amount: '',
    reason: '',
  });

  // User credits state
  const [users, setUsers] = useState<UserCredit[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserCredit | null>(null);
  const [showUserForm, setShowUserForm] = useState(false);
  const [userFormData, setUserFormData] = useState({
    operation: 'add' as 'add' | 'remove',
    type: 'validation' as 'validation' | 'ai',
    amount: '',
    reason: '',
  });
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [userCurrentPage, setUserCurrentPage] = useState(1);

  // Promo code state
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [promoLoading, setPromoLoading] = useState(false);
  const [showPromoForm, setShowPromoForm] = useState(false);
  const [promoFormData, setPromoFormData] = useState({
    code: '',
    description: '',
    discountType: 'percent' as 'percent' | 'amount',
    discountValue: '',
    maxUses: '',
    validDays: '365',
  });

  useEffect(() => {
    loadUsers();
    loadRTOs();
    loadPromoCodes();
  }, []);

  const loadUsers = async () => {
    setUsersLoading(true);
    try {
      // Get all users with their credits
      const { data: userProfiles, error: profilesError } = await supabase
        .from('user_profiles')
        .select('id, email, full_name, rto_code');

      if (profilesError) throw profilesError;

      // Get user credits
      const { data: userCredits, error: creditsError } = await supabase
        .from('user_credits')
        .select('user_id, validation_credits, ai_credits');

      if (creditsError) throw creditsError;

      // Create a map of user credits
      const creditsMap = new Map<string, { validation: number; ai: number }>();
      (userCredits || []).forEach((uc: any) => {
        creditsMap.set(uc.user_id, {
          validation: uc.validation_credits || 0,
          ai: uc.ai_credits || 0,
        });
      });

      // Combine user profiles with credits
      const combined: UserCredit[] = (userProfiles || []).map((profile: any) => {
        const credits = creditsMap.get(profile.id) || { validation: 0, ai: 0 };
        return {
          id: profile.id,
          email: profile.email,
          full_name: profile.full_name,
          rto_code: profile.rto_code,
          validationCredits: credits.validation,
          aiCredits: credits.ai,
        };
      });

      setUsers(combined);
    } catch (error) {
      toast.error('Failed to load users');
      console.error(error);
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    if (user?.rto_code && rtos.length > 0) {
      const userRTO = rtos.find(rto => rto.code === user.rto_code);
      if (userRTO) {
        setSelectedRTO(userRTO);
        setSearchTerm(user.rto_code);
      }
    }
  }, [user?.rto_code, rtos]);

  const loadRTOs = async () => {
    setIsLoading(true);
    try {
      const rtoList = await fetchRTOsFromSupabase();

      const combined = await Promise.all(
        rtoList.map(async (rto) => {
          const aiCredits = await getAICredits(rto.code);
          const valCredits = await getValidationCredits(rto.code);

          return {
            id: Number(rto.id),
            code: rto.code,
            name: rto.name,
            aiCredits: aiCredits.current,
            validationCredits: valCredits.current,
          };
        })
      );

      setRTOs(combined);
    } catch (error) {
      toast.error('Failed to load RTOs and credits');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadPromoCodes = async () => {
    setPromoLoading(true);
    try {
      const { data, error } = await supabase
        .from('promo_codes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPromoCodes(data || []);
    } catch (error) {
      console.error('Error loading promo codes:', error);
      toast.error('Failed to load promo codes');
    } finally {
      setPromoLoading(false);
    }
  };

  const handleCreatePromoCode = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!promoFormData.code.trim()) {
      toast.error('Please enter a promo code');
      return;
    }

    if (!promoFormData.discountValue || Number(promoFormData.discountValue) <= 0) {
      toast.error('Please enter a valid discount value');
      return;
    }

    setPromoLoading(true);
    try {
      const validUntil = new Date();
      validUntil.setDate(validUntil.getDate() + Number(promoFormData.validDays || 365));

      const { error } = await supabase
        .from('promo_codes')
        .insert({
          code: promoFormData.code.trim().toUpperCase(),
          description: promoFormData.description || null,
          discount_percent: promoFormData.discountType === 'percent' ? Number(promoFormData.discountValue) : null,
          discount_amount: promoFormData.discountType === 'amount' ? Number(promoFormData.discountValue) : null,
          max_uses: promoFormData.maxUses ? Number(promoFormData.maxUses) : null,
          valid_until: validUntil.toISOString(),
          is_active: true,
        });

      if (error) {
        if (error.code === '23505') {
          toast.error('A promo code with this name already exists');
        } else {
          throw error;
        }
      } else {
        toast.success('Promo code created successfully');
        setShowPromoForm(false);
        setPromoFormData({
          code: '',
          description: '',
          discountType: 'percent',
          discountValue: '',
          maxUses: '',
          validDays: '365',
        });
        loadPromoCodes();
      }
    } catch (error) {
      console.error('Error creating promo code:', error);
      toast.error('Failed to create promo code');
    } finally {
      setPromoLoading(false);
    }
  };

  const handleTogglePromoActive = async (promo: PromoCode) => {
    try {
      const { error } = await supabase
        .from('promo_codes')
        .update({ is_active: !promo.is_active })
        .eq('id', promo.id);

      if (error) throw error;
      toast.success(`Promo code ${promo.is_active ? 'deactivated' : 'activated'}`);
      loadPromoCodes();
    } catch (error) {
      console.error('Error toggling promo code:', error);
      toast.error('Failed to update promo code');
    }
  };

  const handleDeletePromoCode = async (promo: PromoCode) => {
    if (!confirm(`Are you sure you want to delete promo code "${promo.code}"?`)) return;

    try {
      const { error } = await supabase
        .from('promo_codes')
        .delete()
        .eq('id', promo.id);

      if (error) throw error;
      toast.success('Promo code deleted');
      loadPromoCodes();
    } catch (error) {
      console.error('Error deleting promo code:', error);
      toast.error('Failed to delete promo code');
    }
  };

  const handleProcessCredits = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedRTO) {
      toast.error('No RTO selected');
      return;
    }

    if (!formData.amount || isNaN(Number(formData.amount)) || Number(formData.amount) <= 0) {
      toast.error('Please enter a valid credit amount');
      return;
    }

    setIsLoading(true);
    try {
      let result;
      const actionWord = formData.operation === 'add' ? 'allocation' : 'removal';
      const defaultReason = `Admin ${actionWord} of ${formData.amount} ${formData.type} credits`;

      if (formData.operation === 'add') {
        if (formData.type === 'validation') {
          result = await addValidationCredits(
            selectedRTO.code,
            Number(formData.amount),
            formData.reason || defaultReason
          );
        } else {
          result = await addAICredits(
            selectedRTO.code,
            Number(formData.amount),
            formData.reason || defaultReason
          );
        }
      } else {
        if (formData.type === 'validation') {
          result = await removeValidationCredits(
            selectedRTO.code,
            Number(formData.amount),
            formData.reason || defaultReason
          );
        } else {
          result = await removeAICredits(
            selectedRTO.code,
            Number(formData.amount),
            formData.reason || defaultReason
          );
        }
      }

      if (result.success) {
        toast.success(result.message);
        loadRTOs();
        setFormData({ operation: 'add', type: 'validation', amount: '', reason: '' });
        setShowForm(false);
        setSelectedRTO(null);

        if (onCreditsModified) {
          onCreditsModified();
        }
      } else {
        toast.error(result.message || `Failed to ${formData.operation} credits`);
      }
    } catch (error) {
      toast.error(`Error ${formData.operation}ing credits`);
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleProcessUserCredits = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedUser) {
      toast.error('No user selected');
      return;
    }

    if (!userFormData.amount || isNaN(Number(userFormData.amount)) || Number(userFormData.amount) <= 0) {
      toast.error('Please enter a valid credit amount');
      return;
    }

    setUsersLoading(true);
    try {
      const amount = Number(userFormData.amount);
      const actionWord = userFormData.operation === 'add' ? 'allocation' : 'removal';
      const reason = userFormData.reason || `Admin ${actionWord} of ${amount} ${userFormData.type} credits`;

      if (userFormData.operation === 'add') {
        // Use RPC function to add credits
        const { data, error } = await supabase.rpc('add_user_credits', {
          p_user_id: selectedUser.id,
          p_validation_credits: userFormData.type === 'validation' ? amount : 0,
          p_ai_credits: userFormData.type === 'ai' ? amount : 0,
          p_reason: reason,
        });

        if (error) throw error;
        toast.success(`Added ${amount} ${userFormData.type} credits to ${selectedUser.email}`);
      } else {
        // Direct update to remove credits
        const field = userFormData.type === 'validation' ? 'validation_credits' : 'ai_credits';
        const currentBalance = userFormData.type === 'validation' ? selectedUser.validationCredits : selectedUser.aiCredits;
        
        if (amount > currentBalance) {
          toast.error(`Cannot remove more credits than available (${currentBalance})`);
          return;
        }

        const { error } = await supabase
          .from('user_credits')
          .update({ [field]: currentBalance - amount })
          .eq('user_id', selectedUser.id);

        if (error) throw error;
        toast.success(`Removed ${amount} ${userFormData.type} credits from ${selectedUser.email}`);
      }

      loadUsers();
      setUserFormData({ operation: 'add', type: 'validation', amount: '', reason: '' });
      setShowUserForm(false);
      setSelectedUser(null);

      if (onCreditsModified) {
        onCreditsModified();
      }
    } catch (error) {
      toast.error(`Error ${userFormData.operation}ing user credits`);
      console.error(error);
    } finally {
      setUsersLoading(false);
    }
  };

  const filteredUsers = users.filter(u =>
    u.email.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
    (u.full_name && u.full_name.toLowerCase().includes(userSearchTerm.toLowerCase())) ||
    (u.rto_code && u.rto_code.toLowerCase().includes(userSearchTerm.toLowerCase()))
  );

  const paginatedUsers = filteredUsers.slice(
    (userCurrentPage - 1) * pageSize,
    userCurrentPage * pageSize
  );

  const totalUserPages = Math.ceil(filteredUsers.length / pageSize);

  const filteredRTOs = rtos.filter(rto =>
    rto.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rto.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const paginatedRTOs = filteredRTOs.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const totalPages = Math.ceil(filteredRTOs.length / pageSize);

  // Promo Code Create Form
  if (showPromoForm) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => setShowPromoForm(false)}
          className="px-4 py-2 bg-[#e2e8f0] hover:bg-[#cbd5e1] text-[#1e293b] font-semibold rounded transition-colors"
        >
          ← Back to Promo Codes
        </button>

        <Card className="border border-[#dbeafe] bg-white p-8">
          <h2 className="text-2xl font-poppins font-bold text-[#1e293b] mb-6">
            Create New Promo Code
          </h2>

          <form onSubmit={handleCreatePromoCode} className="space-y-6 max-w-md">
            <div>
              <Label className="text-[#1e293b] font-semibold mb-2 block">Promo Code *</Label>
              <Input
                type="text"
                value={promoFormData.code}
                onChange={(e) => setPromoFormData({ ...promoFormData, code: e.target.value.toUpperCase() })}
                placeholder="e.g., SAVE20"
                className="border border-[#dbeafe] bg-white uppercase"
              />
            </div>

            <div>
              <Label className="text-[#1e293b] font-semibold mb-2 block">Description</Label>
              <Input
                type="text"
                value={promoFormData.description}
                onChange={(e) => setPromoFormData({ ...promoFormData, description: e.target.value })}
                placeholder="e.g., 20% off for new customers"
                className="border border-[#dbeafe] bg-white"
              />
            </div>

            <div>
              <Label className="text-[#1e293b] font-semibold mb-2 block">Discount Type</Label>
              <select
                value={promoFormData.discountType}
                onChange={(e) => setPromoFormData({ ...promoFormData, discountType: e.target.value as 'percent' | 'amount' })}
                className="w-full border border-[#dbeafe] rounded px-3 py-2 bg-white text-[#1e293b]"
              >
                <option value="percent">Percentage Off (%)</option>
                <option value="amount">Fixed Amount Off ($)</option>
              </select>
            </div>

            <div>
              <Label className="text-[#1e293b] font-semibold mb-2 block">
                Discount Value ({promoFormData.discountType === 'percent' ? '%' : 'AUD'}) *
              </Label>
              <Input
                type="number"
                min="1"
                max={promoFormData.discountType === 'percent' ? '100' : undefined}
                value={promoFormData.discountValue}
                onChange={(e) => setPromoFormData({ ...promoFormData, discountValue: e.target.value })}
                placeholder={promoFormData.discountType === 'percent' ? 'e.g., 20' : 'e.g., 50'}
                className="border border-[#dbeafe] bg-white"
              />
            </div>

            <div>
              <Label className="text-[#1e293b] font-semibold mb-2 block">Max Uses (leave empty for unlimited)</Label>
              <Input
                type="number"
                min="1"
                value={promoFormData.maxUses}
                onChange={(e) => setPromoFormData({ ...promoFormData, maxUses: e.target.value })}
                placeholder="e.g., 100"
                className="border border-[#dbeafe] bg-white"
              />
            </div>

            <div>
              <Label className="text-[#1e293b] font-semibold mb-2 block">Valid for (days)</Label>
              <Input
                type="number"
                min="1"
                value={promoFormData.validDays}
                onChange={(e) => setPromoFormData({ ...promoFormData, validDays: e.target.value })}
                placeholder="e.g., 365"
                className="border border-[#dbeafe] bg-white"
              />
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                onClick={() => setShowPromoForm(false)}
                className="flex-1 bg-[#e2e8f0] hover:bg-[#cbd5e1] text-[#1e293b] font-semibold"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={promoLoading || !promoFormData.code || !promoFormData.discountValue}
                className="flex-1 bg-[#8b5cf6] hover:bg-[#7c3aed] text-white font-semibold"
              >
                {promoLoading ? 'Creating...' : 'Create Promo Code'}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    );
  }

  // Credit Form
  if (showForm && selectedRTO) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => setShowForm(false)}
          className="px-4 py-2 bg-[#e2e8f0] hover:bg-[#cbd5e1] text-[#1e293b] font-semibold rounded transition-colors"
        >
          ← Back to Credits
        </button>

        <Card className="border border-[#dbeafe] bg-white p-8">
          <h2 className="text-2xl font-poppins font-bold text-[#1e293b] mb-6">
            {formData.operation === 'add' ? 'Add' : 'Remove'} Credits for {selectedRTO.code}
          </h2>

          <form onSubmit={handleProcessCredits} className="space-y-6 max-w-md">
            <div>
              <Label className="text-[#1e293b] font-semibold mb-2 block">Operation</Label>
              <select
                value={formData.operation}
                onChange={(e) => setFormData({ ...formData, operation: e.target.value as 'add' | 'remove' })}
                className="w-full border border-[#dbeafe] rounded px-3 py-2 bg-white text-[#1e293b]"
              >
                <option value="add">Add Credits</option>
                <option value="remove">Remove Credits</option>
              </select>
            </div>

            <div>
              <Label className="text-[#1e293b] font-semibold mb-2 block">Credit Type</Label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as 'validation' | 'ai' })}
                className="w-full border border-[#dbeafe] rounded px-3 py-2 bg-white text-[#1e293b]"
              >
                <option value="validation">Validation Credits</option>
                <option value="ai">AI Credits</option>
              </select>
            </div>

            <div>
              <Label className="text-[#1e293b] font-semibold mb-2 block">Amount</Label>
              <Input
                type="number"
                min="1"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="Enter number of credits"
                className="border border-[#dbeafe] bg-white"
              />
            </div>

            <div>
              <Label className="text-[#1e293b] font-semibold mb-2 block">Reason (Optional)</Label>
              <Input
                type="text"
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                placeholder="e.g., Monthly allocation, Special request"
                className="border border-[#dbeafe] bg-white"
              />
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 bg-[#e2e8f0] hover:bg-[#cbd5e1] text-[#1e293b] font-semibold"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading || !formData.amount}
                className={`flex-1 text-white font-semibold ${formData.operation === 'add'
                    ? 'bg-[#3b82f6] hover:bg-[#2563eb]'
                    : 'bg-[#ef4444] hover:bg-[#dc2626]'
                  }`}
              >
                {isLoading ? (formData.operation === 'add' ? 'Adding...' : 'Removing...') : (formData.operation === 'add' ? 'Add Credits' : 'Remove Credits')}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-poppins font-bold text-[#1e293b] mb-2">Credits Management</h1>
        <p className="text-[#64748b]">Manage AI credits, validation credits, and promo codes</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-[#dbeafe]">
        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2 font-semibold transition-colors ${activeTab === 'users'
              ? 'text-[#8b5cf6] border-b-2 border-[#8b5cf6]'
              : 'text-[#64748b] hover:text-[#1e293b]'
            }`}
        >
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4" />
            User Credits
          </div>
        </button>
        <button
          onClick={() => setActiveTab('credits')}
          className={`px-4 py-2 font-semibold transition-colors ${activeTab === 'credits'
              ? 'text-[#8b5cf6] border-b-2 border-[#8b5cf6]'
              : 'text-[#64748b] hover:text-[#1e293b]'
            }`}
        >
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4" />
            RTO Credits (Legacy)
          </div>
        </button>
        <button
          onClick={() => setActiveTab('promos')}
          className={`px-4 py-2 font-semibold transition-colors ${activeTab === 'promos'
              ? 'text-[#8b5cf6] border-b-2 border-[#8b5cf6]'
              : 'text-[#64748b] hover:text-[#1e293b]'
            }`}
        >
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4" />
            Promo Codes
          </div>
        </button>
      </div>

      {/* Users Tab */}
      {activeTab === 'users' && (
        <Card className="border border-[#dbeafe] bg-white p-6">
          <div className="flex items-center gap-3 mb-4">
            <Search className="w-5 h-5 text-[#64748b]" />
            <Input
              placeholder="Search by email, name, or RTO code..."
              value={userSearchTerm}
              onChange={(e) => {
                setUserSearchTerm(e.target.value);
                setUserCurrentPage(1);
              }}
              className="border border-[#dbeafe] bg-white"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#dbeafe]">
                  <th className="text-left py-3 px-4 font-semibold text-[#1e293b]">Email</th>
                  <th className="text-left py-3 px-4 font-semibold text-[#1e293b]">Name</th>
                  <th className="text-left py-3 px-4 font-semibold text-[#1e293b]">RTO</th>
                  <th className="text-left py-3 px-4 font-semibold text-[#1e293b]">Validation Credits</th>
                  <th className="text-left py-3 px-4 font-semibold text-[#1e293b]">AI Credits</th>
                  <th className="text-left py-3 px-4 font-semibold text-[#1e293b]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {usersLoading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-[#64748b]">
                      Loading...
                    </td>
                  </tr>
                ) : paginatedUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-[#64748b]">
                      No users found
                    </td>
                  </tr>
                ) : (
                  paginatedUsers.map((u) => (
                    <tr key={u.id} className="border-b border-[#e2e8f0] hover:bg-[#f8f9fb]">
                      <td className="py-3 px-4 text-[#1e293b] font-semibold">{u.email}</td>
                      <td className="py-3 px-4 text-[#64748b]">{u.full_name || '-'}</td>
                      <td className="py-3 px-4 text-[#64748b]">{u.rto_code || '-'}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Zap className="w-4 h-4 text-[#3b82f6]" />
                          <span className="font-semibold text-[#1e293b]">{u.validationCredits}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Cpu className="w-4 h-4 text-[#8b5cf6]" />
                          <span className="font-semibold text-[#1e293b]">{u.aiCredits}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setSelectedUser(u);
                              setUserFormData({ operation: 'add', type: 'validation', amount: '', reason: '' });
                              setShowUserForm(true);
                            }}
                            className="px-3 py-2 bg-[#3b82f6] hover:bg-[#2563eb] text-white font-semibold rounded transition-colors text-sm"
                          >
                            Add
                          </button>
                          <button
                            onClick={() => {
                              setSelectedUser(u);
                              setUserFormData({ operation: 'remove', type: 'validation', amount: '', reason: '' });
                              setShowUserForm(true);
                            }}
                            className="px-3 py-2 bg-[#ef4444] hover:bg-[#dc2626] text-white font-semibold rounded transition-colors text-sm"
                          >
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalUserPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <p className="text-sm text-[#64748b]">
                Page {userCurrentPage} of {totalUserPages} ({filteredUsers.length} total)
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setUserCurrentPage(Math.max(1, userCurrentPage - 1))}
                  disabled={userCurrentPage === 1}
                  className="p-2 rounded border border-[#dbeafe] hover:bg-[#f8f9fb] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-5 h-5 text-[#64748b]" />
                </button>
                <button
                  onClick={() => setUserCurrentPage(Math.min(totalUserPages, userCurrentPage + 1))}
                  disabled={userCurrentPage === totalUserPages}
                  className="p-2 rounded border border-[#dbeafe] hover:bg-[#f8f9fb] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-5 h-5 text-[#64748b]" />
                </button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* User Credit Form Modal */}
      {showUserForm && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="border border-[#dbeafe] bg-white p-6 w-full max-w-md">
            <h2 className="text-xl font-poppins font-bold text-[#1e293b] mb-4">
              {userFormData.operation === 'add' ? 'Add' : 'Remove'} Credits - {selectedUser.email}
            </h2>
            <form onSubmit={handleProcessUserCredits} className="space-y-4">
              <div>
                <Label className="text-[#1e293b] font-semibold mb-2 block">Operation</Label>
                <select
                  value={userFormData.operation}
                  onChange={(e) => setUserFormData({ ...userFormData, operation: e.target.value as 'add' | 'remove' })}
                  className="w-full border border-[#dbeafe] rounded px-3 py-2 bg-white text-[#1e293b]"
                >
                  <option value="add">Add Credits</option>
                  <option value="remove">Remove Credits</option>
                </select>
              </div>
              <div>
                <Label className="text-[#1e293b] font-semibold mb-2 block">Credit Type</Label>
                <select
                  value={userFormData.type}
                  onChange={(e) => setUserFormData({ ...userFormData, type: e.target.value as 'validation' | 'ai' })}
                  className="w-full border border-[#dbeafe] rounded px-3 py-2 bg-white text-[#1e293b]"
                >
                  <option value="validation">Validation Credits</option>
                  <option value="ai">AI Credits</option>
                </select>
              </div>
              <div>
                <Label className="text-[#1e293b] font-semibold mb-2 block">Amount</Label>
                <Input
                  type="number"
                  min="1"
                  value={userFormData.amount}
                  onChange={(e) => setUserFormData({ ...userFormData, amount: e.target.value })}
                  placeholder="Enter number of credits"
                  className="border border-[#dbeafe] bg-white"
                />
              </div>
              <div>
                <Label className="text-[#1e293b] font-semibold mb-2 block">Reason (Optional)</Label>
                <Input
                  type="text"
                  value={userFormData.reason}
                  onChange={(e) => setUserFormData({ ...userFormData, reason: e.target.value })}
                  placeholder="e.g., Purchase, Promo, Adjustment"
                  className="border border-[#dbeafe] bg-white"
                />
              </div>
              <div className="flex gap-3">
                <Button
                  type="button"
                  onClick={() => { setShowUserForm(false); setSelectedUser(null); }}
                  className="flex-1 bg-[#e2e8f0] hover:bg-[#cbd5e1] text-[#1e293b] font-semibold"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={usersLoading || !userFormData.amount}
                  className={`flex-1 text-white font-semibold ${userFormData.operation === 'add'
                      ? 'bg-[#3b82f6] hover:bg-[#2563eb]'
                      : 'bg-[#ef4444] hover:bg-[#dc2626]'
                    }`}
                >
                  {usersLoading ? '...' : (userFormData.operation === 'add' ? 'Add Credits' : 'Remove Credits')}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Credits Tab */}
      {activeTab === 'credits' && (
        <Card className="border border-[#dbeafe] bg-white p-6">
          <div className="flex items-center gap-3 mb-4">
            <Search className="w-5 h-5 text-[#64748b]" />
            <Input
              placeholder="Search by RTO code or name..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="border border-[#dbeafe] bg-white"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#dbeafe]">
                  <th className="text-left py-3 px-4 font-semibold text-[#1e293b]">RTO Code</th>
                  <th className="text-left py-3 px-4 font-semibold text-[#1e293b]">RTO Name</th>
                  <th className="text-left py-3 px-4 font-semibold text-[#1e293b]">AI Credits</th>
                  <th className="text-left py-3 px-4 font-semibold text-[#1e293b]">Validation Credits</th>
                  <th className="text-left py-3 px-4 font-semibold text-[#1e293b]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-[#64748b]">
                      Loading...
                    </td>
                  </tr>
                ) : paginatedRTOs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-[#64748b]">
                      No RTOs found
                    </td>
                  </tr>
                ) : (
                  paginatedRTOs.map((rto) => (
                    <tr key={rto.id} className="border-b border-[#e2e8f0] hover:bg-[#f8f9fb]">
                      <td className="py-3 px-4 text-[#1e293b] font-semibold">{rto.code}</td>
                      <td className="py-3 px-4 text-[#64748b]">{rto.name}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Cpu className="w-4 h-4 text-[#8b5cf6]" />
                          <span className="font-semibold text-[#1e293b]">{rto.aiCredits}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Zap className="w-4 h-4 text-[#3b82f6]" />
                          <span className="font-semibold text-[#1e293b]">{rto.validationCredits}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setSelectedRTO(rto);
                              setFormData({ operation: 'add', type: 'validation', amount: '', reason: '' });
                              setShowForm(true);
                            }}
                            className="px-3 py-2 bg-[#3b82f6] hover:bg-[#2563eb] text-white font-semibold rounded transition-colors text-sm"
                          >
                            Add
                          </button>
                          <button
                            onClick={() => {
                              setSelectedRTO(rto);
                              setFormData({ operation: 'remove', type: 'validation', amount: '', reason: '' });
                              setShowForm(true);
                            }}
                            className="px-3 py-2 bg-[#ef4444] hover:bg-[#dc2626] text-white font-semibold rounded transition-colors text-sm"
                          >
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <p className="text-sm text-[#64748b]">
                Page {currentPage} of {totalPages} ({filteredRTOs.length} total)
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="p-2 hover:bg-[#dbeafe] disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 hover:bg-[#dbeafe] disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Promo Codes Tab */}
      {activeTab === 'promos' && (
        <Card className="border border-[#dbeafe] bg-white p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-poppins font-semibold text-[#1e293b]">Promo Codes</h2>
            <Button
              onClick={() => setShowPromoForm(true)}
              className="bg-[#8b5cf6] hover:bg-[#7c3aed] text-white font-semibold"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Promo Code
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#dbeafe]">
                  <th className="text-left py-3 px-4 font-semibold text-[#1e293b]">Code</th>
                  <th className="text-left py-3 px-4 font-semibold text-[#1e293b]">Description</th>
                  <th className="text-left py-3 px-4 font-semibold text-[#1e293b]">Discount</th>
                  <th className="text-left py-3 px-4 font-semibold text-[#1e293b]">Uses</th>
                  <th className="text-left py-3 px-4 font-semibold text-[#1e293b]">Valid Until</th>
                  <th className="text-left py-3 px-4 font-semibold text-[#1e293b]">Status</th>
                  <th className="text-left py-3 px-4 font-semibold text-[#1e293b]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {promoLoading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-[#64748b]">
                      Loading...
                    </td>
                  </tr>
                ) : promoCodes.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-[#64748b]">
                      No promo codes found. Create one to get started.
                    </td>
                  </tr>
                ) : (
                  promoCodes.map((promo) => (
                    <tr key={promo.id} className="border-b border-[#e2e8f0] hover:bg-[#f8f9fb]">
                      <td className="py-3 px-4">
                        <span className="font-mono font-semibold text-[#8b5cf6] bg-purple-50 px-2 py-1 rounded">
                          {promo.code}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[#64748b]">{promo.description || '-'}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1">
                          {promo.discount_percent ? (
                            <>
                              <Percent className="w-4 h-4 text-[#16a34a]" />
                              <span className="font-semibold text-[#16a34a]">{promo.discount_percent}%</span>
                            </>
                          ) : (
                            <>
                              <DollarSign className="w-4 h-4 text-[#16a34a]" />
                              <span className="font-semibold text-[#16a34a]">${promo.discount_amount}</span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-[#64748b]">
                        {promo.current_uses}{promo.max_uses ? ` / ${promo.max_uses}` : ' / ∞'}
                      </td>
                      <td className="py-3 px-4 text-[#64748b]">
                        {promo.valid_until ? new Date(promo.valid_until).toLocaleDateString() : 'No expiry'}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${promo.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                          }`}>
                          {promo.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleTogglePromoActive(promo)}
                            className={`px-3 py-1 rounded text-sm font-semibold transition-colors ${promo.is_active
                                ? 'bg-[#fef2f2] text-[#ef4444] hover:bg-[#fee2e2]'
                                : 'bg-[#dcfce7] text-[#16a34a] hover:bg-[#bbf7d0]'
                              }`}
                          >
                            {promo.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            onClick={() => handleDeletePromoCode(promo)}
                            className="p-2 text-[#ef4444] hover:bg-[#fef2f2] rounded transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
