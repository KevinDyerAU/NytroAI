/**
 * Error Display Component - Phase 3
 * Displays errors with categorization and retry options
 */

import React from 'react';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Button } from './ui/button';
import { AlertCircle, RefreshCw, WifiOff, Database, Clock } from 'lucide-react';

export type ErrorType = 'network' | 'database' | 'timeout' | 'validation' | 'unknown';

interface ErrorDisplayProps {
  error: Error | string | null;
  type?: ErrorType;
  onRetry?: () => void;
  retryLabel?: string;
  showDetails?: boolean;
}

function getErrorIcon(type: ErrorType) {
  switch (type) {
    case 'network':
      return <WifiOff className="h-4 w-4" />;
    case 'database':
      return <Database className="h-4 w-4" />;
    case 'timeout':
      return <Clock className="h-4 w-4" />;
    default:
      return <AlertCircle className="h-4 w-4" />;
  }
}

function getErrorTitle(type: ErrorType): string {
  switch (type) {
    case 'network':
      return 'Network Error';
    case 'database':
      return 'Database Error';
    case 'timeout':
      return 'Request Timeout';
    case 'validation':
      return 'Validation Error';
    default:
      return 'Error';
  }
}

function getErrorMessage(error: Error | string | null, type: ErrorType): string {
  const errorMessage = error instanceof Error ? error.message : error || 'An unknown error occurred';

  // Add helpful context based on error type
  switch (type) {
    case 'network':
      return `${errorMessage}. Please check your internet connection and try again.`;
    case 'database':
      return `${errorMessage}. There was a problem accessing the database. Please try again.`;
    case 'timeout':
      return `${errorMessage}. The request took too long to complete. Please try again.`;
    case 'validation':
      return errorMessage;
    default:
      return errorMessage;
  }
}

export function ErrorDisplay({ 
  error, 
  type = 'unknown', 
  onRetry, 
  retryLabel = 'Try Again',
  showDetails = false 
}: ErrorDisplayProps) {
  if (!error) return null;

  const errorMessage = getErrorMessage(error, type);
  const errorTitle = getErrorTitle(type);
  const icon = getErrorIcon(type);

  return (
    <Alert variant="destructive" className="my-4">
      {icon}
      <AlertTitle>{errorTitle}</AlertTitle>
      <AlertDescription>
        <p className="mb-2">{errorMessage}</p>
        
        {showDetails && error instanceof Error && error.stack && (
          <details className="mt-2 p-2 bg-gray-100 rounded text-sm">
            <summary className="cursor-pointer text-xs">Technical Details</summary>
            <pre className="whitespace-pre-wrap overflow-auto mt-2 text-xs">
              {error.stack}
            </pre>
          </details>
        )}

        {onRetry && (
          <Button 
            onClick={onRetry} 
            variant="outline" 
            size="sm" 
            className="mt-2"
          >
            <RefreshCw className="mr-2 h-3 w-3" />
            {retryLabel}
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}

/**
 * Categorize error based on error message
 */
export function categorizeError(error: Error | string): ErrorType {
  const message = error instanceof Error ? error.message.toLowerCase() : error.toLowerCase();

  if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
    return 'network';
  }
  if (message.includes('database') || message.includes('query') || message.includes('supabase')) {
    return 'database';
  }
  if (message.includes('timeout') || message.includes('timed out')) {
    return 'timeout';
  }
  if (message.includes('validation') || message.includes('invalid')) {
    return 'validation';
  }

  return 'unknown';
}

/**
 * Hook for error handling with retry logic
 */
export function useErrorWithRetry(retryFn: () => void | Promise<void>) {
  const [error, setError] = React.useState<Error | null>(null);
  const [errorType, setErrorType] = React.useState<ErrorType>('unknown');
  const [isRetrying, setIsRetrying] = React.useState(false);

  const handleError = React.useCallback((err: Error | string) => {
    const errorObj = err instanceof Error ? err : new Error(err);
    setError(errorObj);
    setErrorType(categorizeError(errorObj));
  }, []);

  const handleRetry = React.useCallback(async () => {
    setIsRetrying(true);
    setError(null);
    try {
      await retryFn();
    } catch (err) {
      handleError(err as Error);
    } finally {
      setIsRetrying(false);
    }
  }, [retryFn, handleError]);

  const clearError = React.useCallback(() => {
    setError(null);
    setErrorType('unknown');
  }, []);

  return {
    error,
    errorType,
    isRetrying,
    handleError,
    handleRetry,
    clearError,
  };
}
