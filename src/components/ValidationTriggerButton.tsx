/**
 * ValidationTriggerButton Component
 * 
 * Button to trigger validation processing via n8n webhook
 * Can be used after documents are uploaded
 */

import React from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Play, Loader2, CheckCircle } from 'lucide-react';
import { useValidationTrigger } from '../hooks/useValidationTrigger';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

interface ValidationTriggerButtonProps {
  validationDetailId: number;
  disabled?: boolean;
  onSuccess?: () => void;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

export function ValidationTriggerButton({
  validationDetailId,
  disabled = false,
  onSuccess,
  variant = 'default',
  size = 'default',
  className = '',
}: ValidationTriggerButtonProps) {
  const { trigger, isTriggering } = useValidationTrigger();

  const handleTrigger = async () => {
    await trigger(validationDetailId, []);
    if (onSuccess) {
      onSuccess();
    }
  };

  return (
    <Button
      onClick={handleTrigger}
      disabled={disabled || isTriggering}
      variant={variant}
      size={size}
      className={`flex items-center gap-2 ${className}`}
    >
      {isTriggering ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          Starting...
        </>
      ) : (
        <>
          <Play className="w-4 h-4" />
          Validate
        </>
      )}
    </Button>
  );
}

interface ValidationTriggerCardProps {
  validationDetailId?: number; // Optional - will be created if not provided
  uploadedCount: number;
  totalCount: number;
  storagePaths: string[];
  onSuccess?: () => void;
  onCreditsConsumed?: () => void; // Called after credits are consumed to trigger refresh
  // Required if validationDetailId not provided
  rtoCode?: string;
  unitCode?: string;
  unitLink?: string;
  validationType?: 'unit' | 'learner_guide';
  sessionId?: string;
}

export function ValidationTriggerCard({
  validationDetailId: initialValidationDetailId,
  uploadedCount,
  totalCount,
  storagePaths,
  onSuccess,
  onCreditsConsumed,
  rtoCode,
  unitCode,
  unitLink,
  validationType = 'unit',
  sessionId
}: ValidationTriggerCardProps) {
  const { trigger, isTriggering } = useValidationTrigger();
  const [isTriggered, setIsTriggered] = React.useState(false);
  const [confirmText, setConfirmText] = React.useState('');
  const [validationDetailId, setValidationDetailId] = React.useState<number | undefined>(initialValidationDetailId);
  const [isCreatingValidation, setIsCreatingValidation] = React.useState(false);

  // Debug props
  React.useEffect(() => {
    console.log('[ValidationTriggerCard] 🎯 Props updated:', {
      validationDetailId,
      initialValidationDetailId,
      uploadedCount,
      totalCount,
      storagePathsCount: storagePaths.length,
      allUploaded: uploadedCount >= totalCount && totalCount > 0,
      isConfirmed: confirmText.toLowerCase().trim() === 'validate',
      needsValidationRecord: !validationDetailId,
      hasRequiredData: !!rtoCode && !!unitCode && !!unitLink,
    });
  }, [validationDetailId, initialValidationDetailId, uploadedCount, totalCount, storagePaths, confirmText, rtoCode, unitCode, unitLink]);

  const handleTrigger = async () => {
    try {
      let finalValidationDetailId = validationDetailId;

      // Create validation record if not provided
      if (!finalValidationDetailId) {
        if (!rtoCode || !unitCode || !unitLink) {
          toast.error('Missing required validation data. Please refresh and try again.');
          return;
        }

        setIsCreatingValidation(true);
        console.log('[ValidationTriggerCard] Creating validation record...');

        // Create session-specific namespace
        const sessionNamespace = sessionId
          ? `${rtoCode}-${unitCode}-${sessionId}`
          : `${rtoCode}-${unitCode}-${Date.now()}`;

        const { data, error } = await supabase.functions.invoke('create-validation-record', {
          body: {
            rtoCode,
            unitCode,
            unitLink,
            validationType: 'assessment',
            documentType: validationType,
            pineconeNamespace: sessionNamespace,
          },
        });

        setIsCreatingValidation(false);

        if (error || !data?.detailId) {
          const errorMsg = error?.message || 'Unknown error';
          console.error('[ValidationTriggerCard] Failed to create validation:', errorMsg);

          if (errorMsg.includes('No requirements found')) {
            toast.error(
              'Requirements not found for this unit. Please use Unit Acquisition to extract requirements first.',
              { duration: 6000 }
            );
          } else if (errorMsg.includes('Requirements not yet extracted')) {
            toast.error(
              'Requirements are still being extracted for this unit. Please wait and try again.',
              { duration: 6000 }
            );
          } else {
            toast.error(`Failed to create validation: ${errorMsg}`);
          }
          return;
        }

        finalValidationDetailId = data.detailId;
        setValidationDetailId(finalValidationDetailId);
        console.log('[ValidationTriggerCard] ✅ Validation created:', finalValidationDetailId);
      }

      // Create document records from storage paths BEFORE triggering validation
      if (storagePaths.length > 0 && finalValidationDetailId) {
        console.log('[ValidationTriggerCard] 📄 Creating document records for', storagePaths.length, 'files...');
        
        for (const storagePath of storagePaths) {
          // Extract filename from storage path
          const fileName = storagePath.split('/').pop() || 'document';
          
          const { error: docError } = await supabase
            .from('documents')
            .insert({
              validation_detail_id: finalValidationDetailId,
              file_name: fileName,
              storage_path: storagePath
            });
          
          if (docError) {
            console.error('[ValidationTriggerCard] Failed to create document record:', docError);
          } else {
            console.log('[ValidationTriggerCard] ✅ Document record created:', fileName);
          }
        }
      }

      // Now trigger the validation
      await trigger(finalValidationDetailId!, storagePaths);
      setIsTriggered(true);
      setConfirmText(''); // Clear input after success

      // Notify parent that credits were consumed
      if (onCreditsConsumed) {
        onCreditsConsumed();
      }

      // Wait a moment to show success message, then navigate
      setTimeout(() => {
        if (onSuccess) {
          onSuccess();
        }
      }, 1500);
    } catch (error) {
      console.error('[ValidationTriggerCard] Error:', error);
      setIsCreatingValidation(false);
      // Don't navigate on error
    }
  };

  const allUploaded = uploadedCount >= totalCount && totalCount > 0;
  const isConfirmed = confirmText.toLowerCase().trim() === 'validate';
  const canValidate = allUploaded && isConfirmed;

  return (
    <div className="border border-blue-200 rounded-lg p-6 bg-blue-50">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-lg bg-blue-100 border border-blue-200 flex items-center justify-center flex-shrink-0">
          {isTriggered ? (
            <CheckCircle className="w-6 h-6 text-green-600" />
          ) : (
            <Play className="w-6 h-6 text-blue-600" />
          )}
        </div>

        <div className="flex-1">
          <h3 className="font-semibold text-blue-900 mb-1">
            {isTriggered ? 'Validation Started' : 'Ready to Validate'}
          </h3>

          {isTriggered ? (
            <div className="space-y-2">
              <p className="text-sm text-blue-800">
                Processing started! Files are being uploaded to AI and will be validated automatically.
              </p>
              <div className="flex items-center gap-2 text-sm text-blue-700">
                <CheckCircle className="w-4 h-4" />
                <span className="font-medium">Processing {uploadedCount} document{uploadedCount !== 1 ? 's' : ''}</span>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-blue-800">
                {allUploaded
                  ? `All ${totalCount} document${totalCount !== 1 ? 's' : ''} uploaded successfully. Type "validate" below to confirm.`
                  : `Upload in progress: ${uploadedCount}/${totalCount} documents`}
              </p>

              {allUploaded && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-blue-800">
                    Type <span className="font-bold">"validate"</span> to confirm:
                  </label>
                  <Input
                    type="text"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="validate"
                    disabled={isTriggering}
                    className="bg-white border-blue-300 focus:ring-blue-500"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && canValidate && !isTriggering) {
                        handleTrigger();
                      }
                    }}
                  />
                </div>
              )}

              <Button
                onClick={handleTrigger}
                disabled={!canValidate || isTriggering || isCreatingValidation}
                className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isTriggering || isCreatingValidation ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {isCreatingValidation ? 'Preparing...' : 'Starting...'}
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Validate
                  </>
                )}
              </Button>

              {!allUploaded && (
                <p className="text-xs text-blue-600">
                  Complete all uploads before starting validation
                </p>
              )}

              {allUploaded && !isConfirmed && confirmText.length > 0 && (
                <p className="text-xs text-blue-600">
                  Please type "validate" exactly to enable the button
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
