import React, { useState, useEffect } from 'react';
import { Card } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { CreditCard, Settings as SettingsIcon } from 'lucide-react';
import { AICreditsPage } from './AICreditsPage';

interface SettingsProps {
  selectedRTOId?: string;
  onCreditsAdded?: () => void;
}

export function Settings({ selectedRTOId, onCreditsAdded }: SettingsProps) {
  const [activeTab, setActiveTab] = useState('general');

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tab = urlParams.get('tab');
    if (tab && ['general', 'purchase'].includes(tab)) {
      setActiveTab(tab);
    }
  }, []);

  return (
    <div className="min-h-screen w-full bg-[#f8f9fb] p-4 md:p-8">
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
              Purchase Credits
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general">
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
                    New accounts receive 10 credits by default.
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
                    New accounts receive 100 credits by default.
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
            <AICreditsPage onCreditsAdded={onCreditsAdded} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
