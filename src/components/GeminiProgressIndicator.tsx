import React from 'react';
import { Progress } from './ui/progress';
import { Loader2, CheckCircle, XCircle, Clock } from 'lucide-react';
import { GeminiOperationStatus } from '../hooks/useGeminiOperationStatus';

interface GeminiProgressIndicatorProps {
  operation: GeminiOperationStatus | null;
  isLoading?: boolean;
  showDetails?: boolean;
}

export function GeminiProgressIndicator({ 
  operation, 
  isLoading = false,
  showDetails = true 
}: GeminiProgressIndicatorProps) {
  if (!operation && !isLoading) {
    return null;
  }

  if (isLoading && !operation) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Checking AI processing status...</span>
      </div>
    );
  }

  if (!operation) {
    return null;
  }

  const getStatusIcon = () => {
    if (operation.isComplete) {
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    }
    if (operation.isFailed) {
      return <XCircle className="h-5 w-5 text-red-500" />;
    }
    return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />;
  };

  const getStatusText = () => {
    if (operation.isComplete) {
      return 'AI processing complete';
    }
    if (operation.isFailed) {
      return `Processing failed${operation.errorMessage ? `: ${operation.errorMessage}` : ''}`;
    }
    if (operation.status === 'pending') {
      return 'Preparing AI analysis...';
    }
    return 'AI is learning from your documents...';
  };

  const getStatusColor = () => {
    if (operation.isComplete) return 'text-green-700';
    if (operation.isFailed) return 'text-red-700';
    return 'text-blue-700';
  };

  const formatTime = (seconds: number) => {
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="space-y-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
      <div className="flex items-start gap-3">
        {getStatusIcon()}
        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between">
            <p className={`font-medium ${getStatusColor()}`}>
              {getStatusText()}
            </p>
            {operation.isProcessing && operation.estimatedTimeRemaining !== null && (
              <div className="flex items-center gap-1 text-xs text-gray-600">
                <Clock className="h-3 w-3" />
                <span>~{formatTime(operation.estimatedTimeRemaining)} remaining</span>
              </div>
            )}
          </div>

          {operation.isProcessing && (
            <>
              <Progress value={operation.progressPercentage} className="h-2" />
              {showDetails && (
                <div className="flex items-center justify-between text-xs text-gray-600">
                  <span>
                    {operation.progressPercentage}% complete
                  </span>
                  <span>
                    Elapsed: {formatTime(operation.elapsedSeconds)}
                  </span>
                </div>
              )}
            </>
          )}

          {showDetails && operation.isProcessing && (
            <p className="text-xs text-gray-600">
              Small PDFs (under 1MB) typically process in seconds. The AI is analyzing content,
              creating embeddings, and preparing for intelligent validation.
            </p>
          )}

          {operation.isComplete && showDetails && (
            <p className="text-xs text-green-700">
              ✓ Documents successfully indexed and ready for AI-powered validation
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
