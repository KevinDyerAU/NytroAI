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
    await trigger(validationDetailId);
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
  validationDetailId: number;
  uploadedCount: number;
  totalCount: number;
  onSuccess?: () => void;
}

export function ValidationTriggerCard({
  validationDetailId,
  uploadedCount,
  totalCount,
  onSuccess,
}: ValidationTriggerCardProps) {
  const { trigger, isTriggering } = useValidationTrigger();
  const [isTriggered, setIsTriggered] = React.useState(false);
  const [confirmText, setConfirmText] = React.useState('');

  // Debug props
  React.useEffect(() => {
    console.log('[ValidationTriggerCard] 🎯 Props updated:', {
      validationDetailId,
      uploadedCount,
      totalCount,
      allUploaded: uploadedCount >= totalCount && totalCount > 0,
      isConfirmed: confirmText.toLowerCase().trim() === 'validate',
    });
  }, [validationDetailId, uploadedCount, totalCount, confirmText]);

  const handleTrigger = async () => {
    try {
      await trigger(validationDetailId);
      setIsTriggered(true);
      setConfirmText(''); // Clear input after success
      
      // Wait a moment to show success message, then navigate
      setTimeout(() => {
        if (onSuccess) {
          onSuccess();
        }
      }, 1500);
    } catch (error) {
      console.error('[ValidationTriggerCard] Error:', error);
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
                  ? `All ${totalCount} document${totalCount !== 1 ? 's' : ''} uploaded to Supabase. Type "validate" below to confirm.`
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
                disabled={!canValidate || isTriggering}
                className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isTriggering ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Starting...
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
