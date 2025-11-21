import React, { useState, useEffect } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Zap, Cpu, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { fetchRTOsFromSupabase, addValidationCredits, addAICredits, removeValidationCredits, removeAICredits, getAICredits, getValidationCredits } from '../../types/rto';
import { useAuth } from '../../hooks/useAuth';

interface RTOCredit {
  id: number;
  code: string;
  name: string;
  aiCredits: number;
  validationCredits: number;
}

interface CreditMaintenanceProps {
  onCreditsModified?: () => void;
}

export function CreditsMaintenance({ onCreditsModified }: CreditMaintenanceProps) {
  const { user } = useAuth();
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

  useEffect(() => {
    loadRTOs();
  }, []);

  // Auto-select user's RTO when data is loaded
  useEffect(() => {
    if (user?.rto_code && rtos.length > 0) {
      const userRTO = rtos.find(rto => rto.code === user.rto_code);
      if (userRTO) {
        console.log('[CreditsMaintenance] Auto-selecting user RTO:', user.rto_code);
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

        // Notify parent component to refresh dashboard credits
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

  const filteredRTOs = rtos.filter(rto =>
    rto.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rto.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const paginatedRTOs = filteredRTOs.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const totalPages = Math.ceil(filteredRTOs.length / pageSize);

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
                className={`flex-1 text-white font-semibold ${
                  formData.operation === 'add'
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
        <p className="text-[#64748b]">Manage AI and validation credits for each RTO</p>
      </div>

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
    </div>
  );
}
