/**
 * Loading State Component - Phase 3
 * Displays loading states with timeout indicators
 */

import React, { useEffect, useState } from 'react';
import { Loader2, Clock } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';

interface LoadingStateProps {
  message?: string;
  timeout?: number; // milliseconds
  onTimeout?: () => void;
  showProgress?: boolean;
}

export function LoadingState({ 
  message = 'Loading...', 
  timeout,
  onTimeout,
  showProgress = false 
}: LoadingStateProps) {
  const [elapsed, setElapsed] = useState(0);
  const [hasTimedOut, setHasTimedOut] = useState(false);

  useEffect(() => {
    if (!timeout) return;

    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsedTime = Date.now() - startTime;
      setElapsed(elapsedTime);

      if (elapsedTime >= timeout) {
        setHasTimedOut(true);
        clearInterval(interval);
        if (onTimeout) {
          onTimeout();
        }
      }
    }, 100);

    return () => clearInterval(interval);
  }, [timeout, onTimeout]);

  const progress = timeout ? Math.min((elapsed / timeout) * 100, 100) : 0;

  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-4">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">{message}</p>
      
      {showProgress && timeout && (
        <div className="w-full max-w-xs">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>{(elapsed / 1000).toFixed(1)}s</span>
            <span>{(timeout / 1000).toFixed(0)}s</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-primary h-2 rounded-full transition-all duration-100"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {hasTimedOut && (
        <Alert className="max-w-md">
          <Clock className="h-4 w-4" />
          <AlertDescription>
            This is taking longer than expected. The operation may still complete successfully.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

/**
 * Inline loading spinner for smaller components
 */
export function LoadingSpinner({ size = 'md', className = '' }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
  };

  return (
    <Loader2 className={`animate-spin ${sizeClasses[size]} ${className}`} />
  );
}

/**
 * Loading overlay for full-page loading
 */
export function LoadingOverlay({ message = 'Loading...', show = true }: { message?: string; show?: boolean }) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-card p-6 rounded-lg shadow-lg">
        <LoadingState message={message} />
      </div>
    </div>
  );
}

/**
 * Hook for managing loading states with timeout
 */
export function useLoadingWithTimeout(timeoutMs: number = 30000) {
  const [isLoading, setIsLoading] = useState(false);
  const [hasTimedOut, setHasTimedOut] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);

  const startLoading = () => {
    setIsLoading(true);
    setHasTimedOut(false);
    setStartTime(Date.now());
  };

  const stopLoading = () => {
    setIsLoading(false);
    setHasTimedOut(false);
    setStartTime(null);
  };

  useEffect(() => {
    if (!isLoading || !startTime) return;

    const timeout = setTimeout(() => {
      setHasTimedOut(true);
    }, timeoutMs);

    return () => clearTimeout(timeout);
  }, [isLoading, startTime, timeoutMs]);

  const elapsed = startTime ? Date.now() - startTime : 0;

  return {
    isLoading,
    hasTimedOut,
    elapsed,
    startLoading,
    stopLoading,
  };
}
