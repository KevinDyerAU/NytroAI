/**
 * ValidationStatusMessage Component - Phase 3.2
 * Displays appropriate messages for different validation states
 */

import React from 'react';
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
    const hasProgress = validationProgress && validationProgress.total > 0;
    const isStillProcessing = validationProgress && 
      (validationProgress.status === 'ProcessingInBackground' || 
       validationProgress.status === 'DocumentProcessing');

    return (
      <div className="flex flex-col items-center justify-center h-96 bg-gray-50 rounded-lg border border-gray-200 p-8">
        {isStillProcessing ? (
          <Clock className="w-12 h-12 text-blue-500 mb-4" />
        ) : (
          <FileText className="w-12 h-12 text-gray-400 mb-4" />
        )}
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          {isStillProcessing ? '⏳ Validation In Progress' : 'No Results Available'}
        </h3>
        
        {hasProgress ? (
          <>
            <p className="text-sm text-gray-600 text-center mb-3">
              {isStillProcessing 
                ? 'Your validation is being processed. Results will appear here as they become available.'
                : error?.message || 'This validation has no results yet.'}
            </p>
            
            <div className="bg-white rounded-lg p-4 border border-gray-200 mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">
                  Progress:
                </span>
                <span className="text-sm font-semibold text-gray-900">
                  {validationProgress.completed} / {validationProgress.total} requirements
                </span>
              </div>
              <Progress 
                value={(validationProgress.completed / validationProgress.total) * 100} 
                className="h-2 mb-2" 
              />
              <p className="text-xs text-gray-500 text-center">
                Status: <span className="font-medium">{validationProgress.status}</span>
              </p>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-600 text-center mb-1">
              {error?.message || 'This validation has no results yet.'}
            </p>
            <p className="text-xs text-gray-500 text-center mb-4">
              The validation may still be processing, or there may have been an issue during validation.
            </p>
          </>
        )}
        
        {onRefresh && (
          <Button onClick={onRefresh} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh Status
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
