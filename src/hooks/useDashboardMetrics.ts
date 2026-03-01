import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface DashboardMetrics {
  totalValidations: {
    count: number;
    monthlyChange: number;
    monthlyGrowth: string;
  };
  successRate: {
    rate: number;
    change: number;
    changeText: string;
  };
  activeUnits: {
    count: number;
    status: string;
  };
  aiQueries: {
    count: number;
    period: string;
  };
}

export interface ValidationCredits {
  current: number;
  total: number;
  percentage: number;
  percentageText: string;
}

export interface AICredits {
  current: number;
  total: number;
  percentage: number;
  percentageText: string;
}

export function useDashboardMetrics(
  rtoId: string | null, 
  rtoCode: string | null,
  userId?: string | null,
  isAdmin?: boolean
) {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [consecutiveErrors, setConsecutiveErrors] = useState(0);

  useEffect(() => {
    // For user-based filtering, we need userId (unless admin)
    if (!userId && !isAdmin && !rtoId && !rtoCode) {
      setLoading(false);
      setMetrics(getDefaultMetrics());
      return;
    }

    const fetchMetrics = async () => {
      try {
        setLoading(true);
        setError(null);

        console.log('[useDashboardMetrics] Calling edge function with:', { rtoId, rtoCode, userId, isAdmin });
        
        const { data, error: functionError } = await supabase.functions.invoke('get-dashboard-metrics', {
          body: { rtoId, rtoCode, userId, isAdmin },
        });

        if (functionError) {
          // Only log detailed errors on first failure
          if (consecutiveErrors === 0) {
            console.error('[useDashboardMetrics] Edge function error:', functionError);
          } else {
            console.warn(`[useDashboardMetrics] Metrics unavailable (${consecutiveErrors + 1} consecutive errors)`);
          }
          
          setConsecutiveErrors(prev => prev + 1);
          throw functionError;
        }

        console.log('[useDashboardMetrics] Response:', { data });
        console.log('[useDashboardMetrics] Success Rate:', data?.successRate);
        
        // Validate response has metrics
        if (!data || typeof data !== 'object') {
          console.error('[useDashboardMetrics] Invalid response - no data object');
          throw new Error('Invalid response from dashboard metrics');
        }
        
        setMetrics(data);
        setConsecutiveErrors(0); // Reset error counter on success
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        
        // Only log full error details once
        if (consecutiveErrors === 0) {
          console.error('[useDashboardMetrics] Error fetching dashboard metrics:', errorMsg);
          setError(errorMsg);
        }

        // Only set default values if we don't have any metrics yet
        // This preserves previous data on transient errors
        setMetrics(prev => prev || getDefaultMetrics());
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();

    // Stop polling after 3 consecutive errors
    if (consecutiveErrors >= 3) {
      console.warn('[useDashboardMetrics] Stopped polling due to persistent errors');
      return;
    }

    // Refresh every 30 seconds
    const interval = setInterval(fetchMetrics, 30000);

    return () => clearInterval(interval);
  }, [rtoId, rtoCode, userId, isAdmin, consecutiveErrors]);

  return { metrics, loading, error };
}

function getDefaultMetrics(): DashboardMetrics {
  return {
    totalValidations: {
      count: 0,
      monthlyChange: 0,
      monthlyGrowth: '0 this month',
    },
    successRate: {
      rate: 0,
      change: 0,
      changeText: '0% from last month',
    },
    activeUnits: {
      count: 0,
      status: 'No active validations',
    },
    aiQueries: {
      count: 0,
      period: 'This month',
    },
  };
}

export function useValidationCredits(
  rtoId: string | null, 
  refreshTrigger: number = 0,
  userId?: string | null
) {
  const [credits, setCredits] = useState<ValidationCredits>({
    current: 0,
    total: 0,
    percentage: 0,
    percentageText: '0% Remaining',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorLogged, setErrorLogged] = useState(false);

  useEffect(() => {
    // MUST have userId for user-based credits (preferred) or rtoId for legacy
    // Wait for user to be loaded before making API calls
    if (!userId && !rtoId) {
      console.log('[useValidationCredits] Waiting for userId or rtoId...');
      setLoading(false);
      return;
    }

    const fetchCredits = async () => {
      try {
        setLoading(true);
        setError(null);

        // Prioritize userId over rtoId - only pass rtoId if userId is not available
        const requestBody = userId 
          ? { userId } 
          : { rtoId };

        console.log('[useValidationCredits] Fetching credits with:', requestBody);

        const { data, error: functionError } = await supabase.functions.invoke('get-validation-credits', {
          body: requestBody,
        });

        if (functionError) {
          console.error('[useValidationCredits] Error:', functionError.message || 'Failed to fetch credits');
          throw functionError;
        }

        console.log('[useValidationCredits] Success:', data);
        setCredits(data);
        setError(null);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        setError(errorMsg);
        // Keep loading false but don't clear credits
      } finally {
        setLoading(false);
      }
    };

    fetchCredits();

    // Refresh every 30 seconds
    const interval = setInterval(fetchCredits, 30000);

    return () => clearInterval(interval);
  }, [rtoId, refreshTrigger, userId]);

  return { credits, loading, error };
}

export function useAICredits(
  rtoId: string | null, 
  refreshTrigger: number = 0,
  userId?: string | null
) {
  const [credits, setCredits] = useState<AICredits>({
    current: 0,
    total: 0,
    percentage: 0,
    percentageText: 'Depleted',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorLogged, setErrorLogged] = useState(false);

  useEffect(() => {
    // MUST have userId for user-based credits (preferred) or rtoId for legacy
    // Wait for user to be loaded before making API calls
    if (!userId && !rtoId) {
      console.log('[useAICredits] Waiting for userId or rtoId...');
      setLoading(false);
      return;
    }

    const fetchCredits = async () => {
      try {
        setLoading(true);
        setError(null);

        // Prioritize userId over rtoId - only pass rtoId if userId is not available
        const requestBody = userId 
          ? { userId } 
          : { rtoId };

        console.log('[useAICredits] Fetching credits with:', requestBody);

        const { data, error: functionError } = await supabase.functions.invoke('get-ai-credits', {
          body: requestBody,
        });

        if (functionError) {
          console.error('[useAICredits] Error:', functionError.message || 'Failed to fetch credits');
          throw functionError;
        }

        console.log('[useAICredits] Success:', data);
        setCredits(data);
        setError(null);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        setError(errorMsg);
        // Keep loading false but don't clear credits
      } finally {
        setLoading(false);
      }
    };

    fetchCredits();

    // Refresh every 30 seconds
    const interval = setInterval(fetchCredits, 30000);

    return () => clearInterval(interval);
  }, [rtoId, refreshTrigger, userId]);

  return { credits, loading, error };
}
