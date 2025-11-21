import React, { useState, useEffect } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Zap, TrendingUp, Cpu, CreditCard, Settings as SettingsIcon } from 'lucide-react';
import { getRTOById, addValidationCredits, addAICredits, fetchRTOById, type RTOFromDB } from '../types/rto';
import { AICreditsPage } from './AICreditsPage';
import { toast } from 'sonner';

interface SettingsProps {
  selectedRTOId: string;
  onCreditsAdded?: () => void;
}

interface RTO {
  id: string | number;
  code: string;
  name: string;
  legalname?: string;
}

export function Settings({ selectedRTOId, onCreditsAdded }: SettingsProps) {
  const [validationAmount, setValidationAmount] = useState('');
  const [validationReason, setValidationReason] = useState('');
  const [aiAmount, setAIAmount] = useState('');
  const [aiReason, setAIReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [validationSuccessMessage, setValidationSuccessMessage] = useState('');
  const [aiSuccessMessage, setAISuccessMessage] = useState('');
  const [activeTab, setActiveTab] = useState('general');
  const [currentRTO, setCurrentRTO] = useState<RTO | null>(null);
  const [isLoadingRTO, setIsLoadingRTO] = useState(false);

  // Fetch RTO details from database
  useEffect(() => {
    const loadRTODetails = async () => {
      if (!selectedRTOId) {
        console.log('[Settings] No RTO ID provided');
        setCurrentRTO(null);
        return;
      }

      setIsLoadingRTO(true);
      try {
        console.log('[Settings] Fetching RTO details for ID:', selectedRTOId);
        const rtoData = await fetchRTOById(selectedRTOId);
        if (rtoData) {
          console.log('[Settings] RTO details loaded:', { code: rtoData.code, legalname: rtoData.legalname });
          setCurrentRTO({
            id: rtoData.id,
            code: rtoData.code,
            name: rtoData.legalname || rtoData.code,
            legalname: rtoData.legalname,
          });
        } else {
          console.warn('[Settings] No RTO data found for ID:', selectedRTOId);
          setCurrentRTO(null);
        }
      } catch (error) {
        console.error('[Settings] Error loading RTO details:', error instanceof Error ? error.message : String(error));
        setCurrentRTO(null);
      } finally {
        setIsLoadingRTO(false);
      }
    };

    loadRTODetails();
  }, [selectedRTOId]);

  // Check for tab parameter in URL
  React.useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tab = urlParams.get('tab');
    if (tab && ['general', 'credits', 'purchase'].includes(tab)) {
      setActiveTab(tab);
    }
  }, []);

  const handleAddValidationCredits = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validationAmount || isNaN(Number(validationAmount)) || Number(validationAmount) <= 0) {
      toast.error('Please enter a valid credit amount');
      return;
    }

    if (!currentRTO?.code) {
      toast.error('RTO not selected');
      return;
    }

    setIsLoading(true);
    setValidationSuccessMessage('');

    try {
      const result = await addValidationCredits(
        currentRTO.code,
        Number(validationAmount),
        validationReason || `Manual allocation of ${validationAmount} validation credits`
      );

      if (result.success) {
        toast.success(result.message || 'Validation credits added successfully');
        setValidationSuccessMessage(`Added ${validationAmount} validation credits. New balance: ${result.newBalance}`);
        setValidationAmount('');
        setValidationReason('');
        onCreditsAdded?.();
      } else {
        toast.error(result.message || 'Failed to add validation credits');
      }
    } catch (error) {
      console.error('Error adding validation credits:', error instanceof Error ? error.message : JSON.stringify(error));
      toast.error('An error occurred while adding validation credits');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddAICredits = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!aiAmount || isNaN(Number(aiAmount)) || Number(aiAmount) <= 0) {
      toast.error('Please enter a valid credit amount');
      return;
    }

    if (!currentRTO?.code) {
      toast.error('RTO not selected');
      return;
    }

    setIsLoading(true);
    setAISuccessMessage('');

    try {
      const result = await addAICredits(
        currentRTO.code,
        Number(aiAmount),
        aiReason || `Manual allocation of ${aiAmount} AI credits`
      );

      if (result.success) {
        toast.success(result.message || 'AI credits added successfully');
        setAISuccessMessage(`Added ${aiAmount} AI credits. New balance: ${result.newBalance}`);
        setAIAmount('');
        setAIReason('');
        onCreditsAdded?.();
      } else {
        toast.error(result.message || 'Failed to add AI credits');
      }
    } catch (error) {
      console.error('Error adding AI credits:', error instanceof Error ? error.message : JSON.stringify(error));
      toast.error('An error occurred while adding AI credits');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#f8f9fb] p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-poppins font-bold text-[#1e293b] mb-8">Settings</h1>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger value="general" className="flex items-center gap-2">
              <SettingsIcon className="w-4 h-4" />
              General Settings
            </TabsTrigger>
            <TabsTrigger value="credits" className="flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Manage Credits
            </TabsTrigger>
            <TabsTrigger value="purchase" className="flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              Purchase AI Credits
            </TabsTrigger>
          </TabsList>

          {/* General Settings Tab */}
          <TabsContent value="general">
            {/* Selected RTO Info */}
            <Card className="border border-[#dbeafe] bg-white p-6 shadow-soft mb-8">
              <h2 className="text-lg font-poppins font-semibold text-[#1e293b] mb-4">
                Current RTO
              </h2>
              {isLoadingRTO ? (
                <p className="text-[#64748b] animate-pulse">Loading RTO details...</p>
              ) : currentRTO ? (
                <div className="space-y-2">
                  <p className="text-[#64748b]">
                    <span className="font-semibold">Code:</span> {currentRTO.code}
                  </p>
                  <p className="text-[#64748b]">
                    <span className="font-semibold">Name:</span> {currentRTO.name}
                  </p>
                </div>
              ) : (
                <p className="text-[#ef4444]">No RTO selected</p>
              )}
            </Card>

            {/* Information */}
            <Card className="border border-[#dbeafe] bg-white p-6 shadow-soft">
              <h3 className="text-lg font-poppins font-semibold text-[#1e293b] mb-6">
                About Credits
              </h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-3 text-[#64748b] text-sm">
                  <h4 className="font-semibold text-[#1e293b] text-base mb-3">Validation Credits</h4>
                  <p>
                    <span className="font-semibold text-[#1e293b]">What are they?</span>
                    <br />
                    Validation credits are used to create validation records. Each validation detail record consumes 1 credit.
                  </p>
                  <p>
                    <span className="font-semibold text-[#1e293b]">Default Allocation:</span>
                    <br />
                    New RTOs receive 10 credits by default.
                  </p>
                  <p>
                    <span className="font-semibold text-[#1e293b]">Usage:</span>
                    <br />
                    Automatically consumed when you start a validation in the Document Upload section.
                  </p>
                </div>

                <div className="space-y-3 text-[#64748b] text-sm">
                  <h4 className="font-semibold text-[#1e293b] text-base mb-3">AI Credits</h4>
                  <p>
                    <span className="font-semibold text-[#1e293b]">What are they?</span>
                    <br />
                    AI credits are used for AI operations like generating smart questions and redoing validations.
                  </p>
                  <p>
                    <span className="font-semibold text-[#1e293b]">Default Allocation:</span>
                    <br />
                    New RTOs receive 100 credits by default.
                  </p>
                  <p>
                    <span className="font-semibold text-[#1e293b]">Usage:</span>
                    <br />
                    Automatically consumed when you generate smart questions or redo validations on the Results page.
                  </p>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-[#dbeafe]">
                <p className="text-[#64748b] text-sm">
                  <span className="font-semibold text-[#1e293b]">Tracking:</span> All credit transactions (allocation and consumption) are automatically tracked and can be audited.
                </p>
              </div>
            </Card>
          </TabsContent>

          {/* Manage Credits Tab */}
          <TabsContent value="credits">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Add Validation Credits */}
              <Card className="border border-[#dbeafe] bg-white p-6 shadow-soft h-fit">
                <div className="flex items-center gap-3 mb-6">
                  <TrendingUp className="w-6 h-6 text-[#3b82f6]" />
                  <h2 className="text-lg font-poppins font-semibold text-[#1e293b]">
                    Add Validation Credits
                  </h2>
                </div>

                <form onSubmit={handleAddValidationCredits}>
                  <div className="space-y-4 mb-6">
                    <div>
                      <Label htmlFor="validation-amount" className="text-[#1e293b] font-semibold mb-2 block">
                        Credit Amount
                      </Label>
                      <Input
                        id="validation-amount"
                        type="number"
                        min="1"
                        value={validationAmount}
                        onChange={(e) => setValidationAmount(e.target.value)}
                        placeholder="Enter number of credits"
                        className="border border-[#dbeafe] bg-white"
                        disabled={!currentRTO || isLoading}
                      />
                      <p className="text-xs text-[#64748b] mt-2">
                        Number of validation credits to add (1 credit = 1 validation)
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="validation-reason" className="text-[#1e293b] font-semibold mb-2 block">
                        Reason (Optional)
                      </Label>
                      <Input
                        id="validation-reason"
                        type="text"
                        value={validationReason}
                        onChange={(e) => setValidationReason(e.target.value)}
                        placeholder="e.g., Monthly allocation, Special request"
                        className="border border-[#dbeafe] bg-white"
                        disabled={!currentRTO || isLoading}
                      />
                    </div>
                  </div>

                  {validationSuccessMessage && (
                    <div className="bg-[#dcfce7] border border-[#86efac] rounded-lg p-4 mb-6">
                      <p className="text-[#166534] text-sm font-semibold">
                        ✓ {validationSuccessMessage}
                      </p>
                    </div>
                  )}

                  <div className="mt-6">
                    <Button
                      type="submit"
                      disabled={!currentRTO || isLoading || !validationAmount}
                      className="w-full bg-[#60a5fa] hover:bg-[#3b82f6] text-black font-poppins font-semibold shadow-md"
                    >
                      {isLoading ? 'Adding Credits...' : 'Add Validation Credits'}
                    </Button>
                  </div>
                </form>
              </Card>

              {/* Add AI Credits */}
              <Card className="border border-[#dbeafe] bg-white p-6 shadow-soft h-fit">
                <div className="flex items-center gap-3 mb-6">
                  <Cpu className="w-6 h-6 text-[#8b5cf6]" />
                  <h2 className="text-lg font-poppins font-semibold text-[#1e293b]">
                    Add AI Credits
                  </h2>
                </div>

                <form onSubmit={handleAddAICredits}>
                  <div className="space-y-4 mb-6">
                    <div>
                      <Label htmlFor="ai-amount" className="text-[#1e293b] font-semibold mb-2 block">
                        Credit Amount
                      </Label>
                      <Input
                        id="ai-amount"
                        type="number"
                        min="1"
                        value={aiAmount}
                        onChange={(e) => setAIAmount(e.target.value)}
                        placeholder="Enter number of credits"
                        className="border border-[#dbeafe] bg-white"
                        disabled={!currentRTO || isLoading}
                      />
                      <p className="text-xs text-[#64748b] mt-2">
                        Number of AI credits to add (1 credit = 1 AI operation)
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="ai-reason" className="text-[#1e293b] font-semibold mb-2 block">
                        Reason (Optional)
                      </Label>
                      <Input
                        id="ai-reason"
                        type="text"
                        value={aiReason}
                        onChange={(e) => setAIReason(e.target.value)}
                        placeholder="e.g., Monthly allocation, Special request"
                        className="border border-[#dbeafe] bg-white"
                        disabled={!currentRTO || isLoading}
                      />
                    </div>
                  </div>

                  {aiSuccessMessage && (
                    <div className="bg-[#dcfce7] border border-[#86efac] rounded-lg p-4 mb-6">
                      <p className="text-[#166534] text-sm font-semibold">
                        ✓ {aiSuccessMessage}
                      </p>
                    </div>
                  )}

                  <div className="mt-6">
                    <Button
                      type="submit"
                      disabled={!currentRTO || isLoading || !aiAmount}
                      className="w-full bg-[#a78bfa] hover:bg-[#8b5cf6] text-black font-poppins font-semibold shadow-md"
                    >
                      {isLoading ? 'Adding Credits...' : 'Add AI Credits'}
                    </Button>
                  </div>
                </form>
              </Card>
            </div>
          </TabsContent>

          {/* Purchase AI Credits Tab */}
          <TabsContent value="purchase">
            <AICreditsPage selectedRTOId={selectedRTOId} onCreditsAdded={onCreditsAdded} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
