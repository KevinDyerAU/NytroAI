import React from 'react';
import { Card } from '../ui/card';
import { RotateCcw, Trash2, Clock, RefreshCw, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../ui/tooltip';
import { AcquisitionStatusBadge } from '../RequirementCompleteness';
import { useAcquisitionQueue } from '../../hooks/useAcquisitionQueue';
import { supabase } from '../../lib/supabase';

export function AcquisitionQueueMaintenance() {
  const {
    queueItems,
    isLoading,
    retryUnit,
    cancelUnit,
    refreshQueue,
  } = useAcquisitionQueue(true); // Admin mode: show all users' items

  const handleRetry = async (queueId: number, unitCode: string) => {
    const success = await retryUnit(queueId);
    if (success) {
      // Also trigger the n8n webhook
      const webhookUrl = import.meta.env.VITE_N8N_WEB_SCRAPE_URL;
      const originUrl = `https://training.gov.au/training/details/${unitCode}/unitdetails`;
      try {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ originUrl }),
        });
      } catch (err) {
        console.error('[AcquisitionQueueMaint] Retry webhook error:', err);
      }
    }
  };

  const handleCancel = async (queueId: number, unitCode: string) => {
    const success = await cancelUnit(queueId);
    if (success) {
      // Also remove incomplete UoC entry
      await supabase
        .from('UnitOfCompetency')
        .delete()
        .eq('unitCode', unitCode)
        .neq('acquisition_status', 'complete');
    }
  };

  const activeItems = queueItems.filter(item =>
    ['queued', 'in_progress', 'retry', 'failed', 'partial_success'].includes(item.status)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-poppins font-bold text-[#1e293b]">Acquisition Queue</h2>
          <p className="text-[#64748b] text-sm mt-1">
            Monitor and manage unit acquisition processing across all users
          </p>
        </div>
        <button
          onClick={refreshQueue}
          className="px-4 py-2 bg-[#3b82f6] hover:bg-[#2563eb] text-white font-semibold rounded-lg transition-colors flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="p-4 border border-[#e2e8f0]">
          <div className="text-2xl font-bold text-[#1e293b]">{activeItems.length}</div>
          <div className="text-xs text-[#64748b]">Total Active</div>
        </Card>
        <Card className="p-4 border border-[#93c5fd]">
          <div className="text-2xl font-bold text-[#3b82f6]">
            {activeItems.filter(i => i.status === 'queued' || i.status === 'in_progress').length}
          </div>
          <div className="text-xs text-[#64748b]">Processing</div>
        </Card>
        <Card className="p-4 border border-[#fcd34d]">
          <div className="text-2xl font-bold text-[#d97706]">
            {activeItems.filter(i => i.status === 'retry').length}
          </div>
          <div className="text-xs text-[#64748b]">Retrying</div>
        </Card>
        <Card className="p-4 border border-[#fca5a5]">
          <div className="text-2xl font-bold text-[#ef4444]">
            {activeItems.filter(i => i.status === 'failed' || i.status === 'partial_success').length}
          </div>
          <div className="text-xs text-[#64748b]">Failed</div>
        </Card>
      </div>

      {/* Queue Items */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-[#3b82f6] animate-spin" />
          <span className="ml-2 text-[#64748b]">Loading queue...</span>
        </div>
      ) : activeItems.length === 0 ? (
        <Card className="p-8 border border-[#e2e8f0] text-center">
          <CheckCircle2 className="w-12 h-12 text-[#22c55e] mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-[#1e293b]">Queue Clear</h3>
          <p className="text-sm text-[#64748b]">No active or failed acquisition items</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {activeItems.map(item => (
            <Card
              key={item.id}
              className="border border-[#e2e8f0] hover:border-[#93c5fd] transition-colors"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-mono text-sm font-bold text-[#3b82f6]">{item.unit_code}</span>
                  <AcquisitionStatusBadge status={item.status} lastError={item.last_error} />
                  {item.retry_count > 0 && (
                    <span className="text-xs text-[#94a3b8]">
                      Attempt {item.retry_count + 1}/{item.max_retries}
                    </span>
                  )}
                  {item.next_retry_at && item.status === 'retry' && (
                    <span className="text-xs text-[#94a3b8]">
                      Next: {new Date(item.next_retry_at).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                  <span className="text-xs text-[#94a3b8]">
                    {new Date(item.created_at).toLocaleString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {item.requested_by && (
                    <span className="text-xs text-[#94a3b8] bg-[#f1f5f9] px-2 py-0.5 rounded">
                      User: {item.requested_by.slice(0, 8)}...
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {(item.status === 'failed' || item.status === 'partial_success' || item.status === 'retry') && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => handleRetry(item.id, item.unit_code)}
                          className="p-2 rounded-lg hover:bg-[#dbeafe] text-[#3b82f6] transition-colors"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Retry now</TooltipContent>
                    </Tooltip>
                  )}
                  {(item.status === 'queued' || item.status === 'failed' || item.status === 'retry') && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => handleCancel(item.id, item.unit_code)}
                          className="p-2 rounded-lg hover:bg-[#fee2e2] text-[#94a3b8] hover:text-[#ef4444] transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Remove from queue</TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>
              {item.last_error && (
                <div className="px-4 pb-3">
                  <p className="text-xs text-[#ef4444] bg-[#fef2f2] p-2 rounded">
                    {item.last_error}
                  </p>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
