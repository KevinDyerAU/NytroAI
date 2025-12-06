import React, { useState, useEffect } from 'react';
import { Card } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { CreditCard, Settings as SettingsIcon } from 'lucide-react';
import { fetchRTOById } from '../types/rto';
import { AICreditsPage } from './AICreditsPage';

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
  const [activeTab, setActiveTab] = useState('general');
  const [currentRTO, setCurrentRTO] = useState<RTO | null>(null);
  const [isLoadingRTO, setIsLoadingRTO] = useState(false);

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

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tab = urlParams.get('tab');
    if (tab && ['general', 'purchase'].includes(tab)) {
      setActiveTab(tab);
    }
  }, []);

  return (
    <div className="min-h-screen w-full bg-[#f8f9fb] p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-poppins font-bold text-[#1e293b] mb-8">Settings</h1>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-8">
            <TabsTrigger value="general" className="flex items-center gap-2">
              <SettingsIcon className="w-4 h-4" />
              General Settings
            </TabsTrigger>
            <TabsTrigger value="purchase" className="flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              Purchase AI Credits
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general">
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
                    AI credits are consumed for: running document validations, regenerating smart questions, revalidating requirements, and AI chat queries. Each operation uses 1 credit.
                  </p>
                  <p>
                    <span className="font-semibold text-[#1e293b]">Default Allocation:</span>
                    <br />
                    New RTOs receive 100 credits by default.
                  </p>
                  <p>
                    <span className="font-semibold text-[#1e293b]">Usage:</span>
                    <br />
                    Consumed when: validating documents (1 per validation), regenerating smart questions (1 per requirement), revalidating requirements (1 per requirement), or using AI chat (1 per message).
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

          <TabsContent value="purchase">
            <AICreditsPage selectedRTOId={selectedRTOId} onCreditsAdded={onCreditsAdded} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
