/**
 * ValidationStatusMessage Component - Phase 3.2
 * Displays appropriate messages for different validation states
 */

import React, { useEffect } from 'react';
import { 
  Loader2, 
  XCircle, 
  AlertCircle, 
  FileText, 
  RefreshCw,
  Clock,
  CheckCircle,
  Zap
} from 'lucide-react';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import type { ValidationResultsError } from '../lib/validationResults';
import wizardLogo from '../assets/wizard-logo.png';

interface ValidationStatusMessageProps {
  type: 'loading' | 'processing' | 'error' | 'empty' | 'no-results';
  error?: ValidationResultsError;
  onRetry?: () => void;
  onBack?: () => void;
  onRefresh?: () => void;
  validationProgress?: {
    completed: number;
    total: number;
    status: string;
  };
}

export function ValidationStatusMessage({
  type,
  error,
  onRetry,
  onBack,
  onRefresh,
  validationProgress,
}: ValidationStatusMessageProps) {
  
  // Loading state
  if (type === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center h-96 bg-white rounded-lg border border-gray-200 p-8">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Loading Validation Results
        </h3>
        <p className="text-sm text-gray-600 text-center">
          Please wait while we fetch your validation data...
        </p>
      </div>
    );
  }

  // Processing state (validation not ready yet)
  if (type === 'processing') {
    const hasProgress = validationProgress && validationProgress.total > 0;
    const progressPercent = hasProgress 
      ? Math.round((validationProgress.completed / validationProgress.total) * 100)
      : 0;

    return (
      <div className="flex flex-col items-center justify-center h-96 bg-blue-50 rounded-lg border border-blue-200 p-8">
        <div className="relative mb-4">
          <Zap className="w-12 h-12 text-blue-600" />
          <Loader2 className="w-6 h-6 text-blue-600 animate-spin absolute -top-1 -right-1" />
        </div>
        <h3 className="text-lg font-semibold text-blue-900 mb-2">
          🤖 Validation In Progress
        </h3>
        
        {hasProgress ? (
          <>
            <p className="text-sm text-blue-700 text-center mb-3">
              {error?.message || 'AI is validating your requirements against the evidence...'}
            </p>
            
            <div className="w-full max-w-md mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-blue-900">
                  Progress: {validationProgress.completed} / {validationProgress.total} requirements
                </span>
                <span className="text-sm font-semibold text-blue-900">
                  {progressPercent}%
                </span>
              </div>
              <Progress value={progressPercent} className="h-2" />
            </div>
            
            <p className="text-xs text-blue-600 text-center mb-2">
              Status: <span className="font-semibold">{validationProgress.status}</span>
            </p>
            <p className="text-xs text-blue-600 text-center mb-4">
              Estimated time: {Math.max(1, Math.ceil((validationProgress.total - validationProgress.completed) * 2 / 60))} minute(s)
            </p>
          </>
        ) : (
          <>
            <p className="text-sm text-blue-700 text-center mb-1">
              {error?.message || 'AI is currently processing your documents and generating validation results.'}
            </p>
            <p className="text-xs text-blue-600 text-center mb-4">
              This typically takes 30-90 seconds depending on document size.
            </p>
          </>
        )}
        
        {onRefresh && (
          <Button onClick={onRefresh} variant="outline" size="sm" className="mt-2">
            <RefreshCw className="w-4 h-4 mr-2" />
            Check Status
          </Button>
        )}
      </div>
    );
  }

  // Error state
  if (type === 'error' && error) {
    const isNetworkError = error.code === 'NETWORK_ERROR';
    const isDatabaseError = error.code === 'DATABASE_ERROR';
    
    return (
      <div className="flex flex-col items-center justify-center h-96 bg-red-50 rounded-lg border border-red-200 p-8">
        <XCircle className="w-12 h-12 text-red-600 mb-4" />
        <h3 className="text-lg font-semibold text-red-900 mb-2">
          {isNetworkError ? 'Connection Error' : 
           isDatabaseError ? 'Database Error' : 
           'Error Loading Results'}
        </h3>
        <p className="text-sm text-red-700 text-center mb-1">
          {error.message}
        </p>
        {error.retryable && (
          <p className="text-xs text-red-600 text-center mb-4">
            This error may be temporary. Please try again.
          </p>
        )}
        <div className="flex gap-2 mt-4">
          {error.retryable && onRetry && (
            <Button onClick={onRetry} variant="default" size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          )}
          {onBack && (
            <Button onClick={onBack} variant="outline" size="sm">
              Back to Dashboard
            </Button>
          )}
        </div>
        {!error.retryable && (
          <p className="text-xs text-gray-500 text-center mt-4">
            If this problem persists, please contact support.
          </p>
        )}
      </div>
    );
  }

  // No results state (validation complete but no data)
  if (type === 'no-results') {
    // Auto-refresh every 15 seconds when still processing
    useEffect(() => {
      if (onRefresh) {
        const intervalId = setInterval(() => {
          console.log('[ValidationStatusMessage] Auto-refreshing validation status...');
          onRefresh();
        }, 15000); // 15 seconds

        return () => clearInterval(intervalId);
      }
    }, [onRefresh]);

    const hasProgress = validationProgress && validationProgress.total > 0;
    
    return (
      <div className="flex flex-col items-center justify-center h-96 bg-white rounded-lg border border-[#dbeafe] p-8">
        {/* Wizard logo like smart question modal */}
        <div className="mb-6 w-32">
          <img
            src={wizardLogo}
            alt="Nytro Wizard"
            className="w-full h-auto object-contain"
          />
        </div>
        
        <h3 className="font-poppins text-lg font-semibold text-[#1e293b] mb-3">
          Nytro is still processing...
        </h3>
        
        {/* Bouncing dots like AI chat */}
        <div className="flex items-center gap-2 mb-4">
          <div className="flex gap-1">
            <span className="w-2 h-2 bg-[#3b82f6] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
            <span className="w-2 h-2 bg-[#3b82f6] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
            <span className="w-2 h-2 bg-[#3b82f6] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
          </div>
        </div>
        
        <p className="text-sm text-[#64748b] text-center mb-4">
          Your validation is being processed. Results will appear here as they become available.
        </p>
        
        {hasProgress && (
          <div className="bg-[#f8f9fb] rounded-lg p-4 border border-[#dbeafe] mb-4 w-full max-w-md">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-[#1e293b]">
                Progress:
              </span>
              <span className="text-sm font-semibold text-[#1e293b]">
                {validationProgress.completed} / {validationProgress.total} requirements
              </span>
            </div>
            <Progress 
              value={(validationProgress.completed / validationProgress.total) * 100} 
              className="h-2 mb-2" 
            />
            <p className="text-xs text-[#64748b] text-center">
              Status: <span className="font-medium">{validationProgress.status}</span>
            </p>
          </div>
        )}
        
        <p className="text-xs text-[#94a3b8] text-center mb-4">
          Auto-refreshing every 15 seconds...
        </p>
        
        {onRefresh && (
          <Button onClick={onRefresh} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh Now
          </Button>
        )}
      </div>
    );
  }

  // Empty state (no validation selected)
  if (type === 'empty') {
    return (
      <div className="flex flex-col items-center justify-center h-96 bg-gray-50 rounded-lg border border-gray-200 p-8">
        <AlertCircle className="w-12 h-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          No Validation Selected
        </h3>
        <p className="text-sm text-gray-600 text-center mb-4">
          Select a validation from the list to view its results.
        </p>
      </div>
    );
  }

  return null;
}

/**
 * Inline status indicator for compact display
 */
export function ValidationStatusIndicator({ 
  status 
}: { 
  status: 'loading' | 'processing' | 'error' | 'success' | 'empty' 
}) {
  const config = {
    loading: {
      icon: Loader2,
      text: 'Loading...',
      className: 'text-blue-600 animate-spin',
    },
    processing: {
      icon: Clock,
      text: 'Processing...',
      className: 'text-yellow-600',
    },
    error: {
      icon: XCircle,
      text: 'Error',
      className: 'text-red-600',
    },
    success: {
      icon: CheckCircle,
      text: 'Ready',
      className: 'text-green-600',
    },
    empty: {
      icon: AlertCircle,
      text: 'No data',
      className: 'text-gray-400',
    },
  };

  const { icon: Icon, text, className } = config[status];

  return (
    <div className="flex items-center gap-2 text-sm">
      <Icon className={`w-4 h-4 ${className}`} />
      <span className={className}>{text}</span>
    </div>
  );
}

/**
 * Compact error message for inline display
 */
export function InlineErrorMessage({
  error,
  onRetry,
}: {
  error: ValidationResultsError;
  onRetry?: () => void;
}) {
  return (
    <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
      <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-red-900">{error.message}</p>
        {error.retryable && (
          <p className="text-xs text-red-700 mt-1">Click retry to try again</p>
        )}
      </div>
      {error.retryable && onRetry && (
        <Button onClick={onRetry} variant="ghost" size="sm" className="flex-shrink-0">
          <RefreshCw className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
}
