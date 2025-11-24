/**
 * TriggerValidation - Manual Validation Trigger Tool
 * 
 * Allows admins to manually trigger validation for a validation_detail_id.
 * Useful for debugging, re-running failed validations, or manual intervention.
 */

import React, { useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { PlayCircle, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';

export function TriggerValidation() {
  const [validationDetailId, setValidationDetailId] = useState('');
  const [isTriggering, setIsTriggering] = useState(false);
  const [lastResult, setLastResult] = useState<{
    success: boolean;
    message: string;
    timestamp: string;
  } | null>(null);

  const handleTrigger = async () => {
    const detailId = parseInt(validationDetailId);
    
    if (isNaN(detailId) || detailId <= 0) {
      toast.error('Please enter a valid validation detail ID');
      return;
    }

    setIsTriggering(true);
    const startTime = Date.now();

    try {
      console.log('[TriggerValidation] Triggering validation for detail:', detailId);

      // Call trigger-validation edge function
      const { data, error } = await supabase.functions.invoke('trigger-validation', {
        body: {
          validationDetailId: detailId,
        },
      });

      const duration = Date.now() - startTime;

      if (error) {
        console.error('[TriggerValidation] Error:', error);
        setLastResult({
          success: false,
          message: `Error: ${error.message || 'Unknown error'}`,
          timestamp: new Date().toISOString(),
        });
        toast.error(`Validation trigger failed: ${error.message}`);
        return;
      }

      console.log('[TriggerValidation] Success:', data);
      setLastResult({
        success: true,
        message: `Validation triggered successfully in ${duration}ms`,
        timestamp: new Date().toISOString(),
      });
      toast.success(`Validation triggered successfully for detail #${detailId}`);

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error('[TriggerValidation] Exception:', err);
      setLastResult({
        success: false,
        message: `Exception: ${errorMsg}`,
        timestamp: new Date().toISOString(),
      });
      toast.error(`Failed to trigger validation: ${errorMsg}`);
    } finally {
      setIsTriggering(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Manual Validation Trigger</h2>
        <p className="text-gray-600 mt-1">
          Manually trigger validation for a specific validation_detail record.
          Use this for debugging, re-running failed validations, or manual intervention.
        </p>
      </div>

      <Card className="p-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Validation Detail ID
            </label>
            <Input
              type="number"
              value={validationDetailId}
              onChange={(e) => setValidationDetailId(e.target.value)}
              placeholder="e.g., 123"
              className="max-w-xs"
              disabled={isTriggering}
            />
            <p className="text-xs text-gray-500 mt-1">
              Enter the validation_detail.id to trigger validation
            </p>
          </div>

          <Button
            onClick={handleTrigger}
            disabled={isTriggering || !validationDetailId}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isTriggering ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Triggering...
              </>
            ) : (
              <>
                <PlayCircle className="w-4 h-4 mr-2" />
                Trigger Validation
              </>
            )}
          </Button>
        </div>
      </Card>

      {lastResult && (
        <Card className={`p-6 ${lastResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-start gap-3">
            {lastResult.success ? (
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
            )}
            <div className="flex-1">
              <h3 className={`font-semibold ${lastResult.success ? 'text-green-900' : 'text-red-900'}`}>
                {lastResult.success ? 'Success' : 'Failed'}
              </h3>
              <p className={`text-sm mt-1 ${lastResult.success ? 'text-green-700' : 'text-red-700'}`}>
                {lastResult.message}
              </p>
              <p className="text-xs text-gray-500 mt-2">
                {new Date(lastResult.timestamp).toLocaleString()}
              </p>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-6 bg-blue-50 border-blue-200">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-blue-900">Usage Notes</h3>
            <ul className="text-sm text-blue-700 mt-2 space-y-1">
              <li>• This manually calls the <code className="bg-blue-100 px-1 rounded">trigger-validation</code> edge function</li>
              <li>• Use this only when the automatic background processor fails</li>
              <li>• Check Supabase logs for detailed error messages</li>
              <li>• Ensure all documents for the validation are fully indexed first</li>
            </ul>
          </div>
        </div>
      </Card>

      <Card className="p-6 bg-gray-50">
        <h3 className="font-semibold text-gray-900 mb-3">How to Find Validation Detail ID</h3>
        <div className="text-sm text-gray-700 space-y-2">
          <p>Run this SQL query in Supabase SQL Editor:</p>
          <pre className="bg-gray-800 text-gray-100 p-3 rounded text-xs overflow-x-auto">
{`SELECT 
  vd.id as detail_id,
  vs.unitCode,
  vd.extractStatus,
  COUNT(d.id) as document_count
FROM validation_detail vd
JOIN validation_summary vs ON vs.id = vd.summary_id
LEFT JOIN documents d ON d.validation_detail_id = vd.id
WHERE vd.created_at > NOW() - INTERVAL '7 days'
GROUP BY vd.id, vs.unitCode, vd.extractStatus
ORDER BY vd.created_at DESC
LIMIT 20;`}
          </pre>
        </div>
      </Card>
    </div>
  );
}
