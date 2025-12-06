/**
 * Loading State Component - Phase 3
 * Displays loading states with timeout indicators and skeleton loaders
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
 * Skeleton line for text content
 */
export function SkeletonLine({ width = 'full', className = '' }: { width?: 'full' | '3/4' | '1/2' | '1/4' | '1/3'; className?: string }) {
  const widthClasses = {
    full: 'w-full',
    '3/4': 'w-3/4',
    '1/2': 'w-1/2',
    '1/4': 'w-1/4',
    '1/3': 'w-1/3',
  };

  return (
    <div className={`h-4 bg-slate-200 rounded animate-pulse ${widthClasses[width]} ${className}`} />
  );
}

/**
 * Skeleton card for content cards
 */
export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`p-4 border border-slate-200 rounded-lg bg-white space-y-3 ${className}`}>
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 bg-slate-200 rounded-lg animate-pulse" />
        <div className="flex-1 space-y-2">
          <SkeletonLine width="3/4" />
          <SkeletonLine width="1/2" />
        </div>
      </div>
      <SkeletonLine width="full" />
      <SkeletonLine width="3/4" />
    </div>
  );
}

/**
 * Skeleton for KPI widgets
 */
export function SkeletonKPI({ className = '' }: { className?: string }) {
  return (
    <div className={`p-4 border border-slate-200 rounded-lg bg-white ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <SkeletonLine width="1/2" className="h-3" />
        <div className="h-8 w-8 bg-slate-200 rounded animate-pulse" />
      </div>
      <div className="h-8 bg-slate-200 rounded animate-pulse w-1/3 mb-2" />
      <SkeletonLine width="3/4" className="h-3" />
    </div>
  );
}

/**
 * Skeleton table rows
 */
export function SkeletonTable({ rows = 5, className = '' }: { rows?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {/* Header */}
      <div className="flex gap-4 p-3 bg-slate-100 rounded-lg">
        <SkeletonLine width="1/4" className="h-3" />
        <SkeletonLine width="1/3" className="h-3" />
        <SkeletonLine width="1/4" className="h-3" />
        <SkeletonLine width="1/4" className="h-3" />
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 p-3 border border-slate-100 rounded-lg">
          <SkeletonLine width="1/4" />
          <SkeletonLine width="1/3" />
          <SkeletonLine width="1/4" />
          <SkeletonLine width="1/4" />
        </div>
      ))}
    </div>
  );
}

/**
 * Dashboard skeleton loader
 */
export function SkeletonDashboard() {
  return (
    <div className="space-y-6 p-8">
      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <SkeletonKPI />
        <SkeletonKPI />
        <SkeletonKPI />
        <SkeletonKPI />
      </div>
      {/* Progress bars */}
      <div className="grid grid-cols-2 gap-6">
        <SkeletonCard />
        <SkeletonCard />
      </div>
      {/* Validation list */}
      <div className="border border-slate-200 rounded-lg bg-white p-6">
        <SkeletonLine width="1/4" className="h-6 mb-4" />
        <div className="space-y-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    </div>
  );
}

/**
 * Results explorer skeleton loader
 */
export function SkeletonResults() {
  return (
    <div className="space-y-4 p-6">
      {/* Header with filters */}
      <div className="flex gap-4 items-center mb-6">
        <div className="h-10 w-64 bg-slate-200 rounded animate-pulse" />
        <div className="h-10 w-32 bg-slate-200 rounded animate-pulse" />
        <div className="h-10 w-32 bg-slate-200 rounded animate-pulse" />
      </div>
      {/* Results table */}
      <SkeletonTable rows={8} />
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
