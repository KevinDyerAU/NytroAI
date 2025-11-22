/**
 * Retry utility with exponential backoff
 * Phase 3.4 - Dashboard Performance Improvements
 */

export interface RetryOptions {
  /**
   * Maximum number of retry attempts
   * @default 3
   */
  maxAttempts?: number;

  /**
   * Initial delay in milliseconds before first retry
   * @default 1000
   */
  initialDelay?: number;

  /**
   * Maximum delay in milliseconds between retries
   * @default 10000
   */
  maxDelay?: number;

  /**
   * Multiplier for exponential backoff
   * @default 2
   */
  backoffMultiplier?: number;

  /**
   * Callback function called before each retry attempt
   * @param attempt - Current attempt number (1-indexed)
   * @param error - Error that caused the retry
   */
  onRetry?: (attempt: number, error: Error) => void;

  /**
   * Function to determine if an error should trigger a retry
   * @param error - Error to check
   * @returns true if should retry, false otherwise
   * @default () => true (retry all errors)
   */
  shouldRetry?: (error: Error) => boolean;
}

/**
 * Executes a function with automatic retry on failure using exponential backoff
 * 
 * @param fn - Async function to execute
 * @param options - Retry configuration options
 * @returns Promise that resolves with the function result or rejects after all retries exhausted
 * 
 * @example
 * ```typescript
 * const data = await retryWithBackoff(
 *   async () => {
 *     const response = await fetch('/api/data');
 *     if (!response.ok) throw new Error('Failed to fetch');
 *     return response.json();
 *   },
 *   {
 *     maxAttempts: 3,
 *     initialDelay: 1000,
 *     onRetry: (attempt, error) => {
 *       console.log(`Retry attempt ${attempt}:`, error.message);
 *     }
 *   }
 * );
 * ```
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffMultiplier = 2,
    onRetry,
    shouldRetry = () => true,
  } = options;

  let lastError: Error;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Check if we should retry this error
      if (!shouldRetry(lastError)) {
        throw lastError;
      }

      // If this was the last attempt, throw the error
      if (attempt === maxAttempts) {
        throw lastError;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        initialDelay * Math.pow(backoffMultiplier, attempt - 1),
        maxDelay
      );

      // Call onRetry callback if provided
      if (onRetry) {
        onRetry(attempt, lastError);
      }

      console.log(
        `[RetryWithBackoff] Attempt ${attempt}/${maxAttempts} failed, retrying in ${delay}ms...`,
        lastError.message
      );

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError!;
}

/**
 * Common retry strategies for different error types
 */
export const RetryStrategies = {
  /**
   * Retry all errors (default behavior)
   */
  retryAll: () => true,

  /**
   * Only retry network errors (connection issues, timeouts)
   */
  retryNetworkErrors: (error: Error): boolean => {
    const message = error.message.toLowerCase();
    return (
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('connection') ||
      message.includes('fetch')
    );
  },

  /**
   * Only retry server errors (5xx status codes)
   */
  retryServerErrors: (error: Error): boolean => {
    const message = error.message.toLowerCase();
    return (
      message.includes('500') ||
      message.includes('502') ||
      message.includes('503') ||
      message.includes('504') ||
      message.includes('server error')
    );
  },

  /**
   * Retry network and server errors, but not client errors (4xx)
   */
  retryTransientErrors: (error: Error): boolean => {
    const message = error.message.toLowerCase();
    
    // Don't retry client errors
    if (
      message.includes('400') ||
      message.includes('401') ||
      message.includes('403') ||
      message.includes('404') ||
      message.includes('unauthorized') ||
      message.includes('forbidden') ||
      message.includes('not found')
    ) {
      return false;
    }

    // Retry everything else (network, server, timeout errors)
    return true;
  },
};

/**
 * Preset retry configurations for common scenarios
 */
export const RetryPresets = {
  /**
   * Quick retry for fast operations (3 attempts, 500ms initial delay)
   */
  quick: {
    maxAttempts: 3,
    initialDelay: 500,
    maxDelay: 2000,
    backoffMultiplier: 2,
  } as RetryOptions,

  /**
   * Standard retry for normal operations (3 attempts, 1s initial delay)
   */
  standard: {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 5000,
    backoffMultiplier: 2,
  } as RetryOptions,

  /**
   * Aggressive retry for critical operations (5 attempts, 1s initial delay)
   */
  aggressive: {
    maxAttempts: 5,
    initialDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
  } as RetryOptions,

  /**
   * Patient retry for long-running operations (3 attempts, 2s initial delay)
   */
  patient: {
    maxAttempts: 3,
    initialDelay: 2000,
    maxDelay: 15000,
    backoffMultiplier: 2,
  } as RetryOptions,
};

/**
 * Helper function to create a retry wrapper for a function
 * 
 * @example
 * ```typescript
 * const fetchWithRetry = createRetryWrapper(
 *   async (url: string) => {
 *     const response = await fetch(url);
 *     return response.json();
 *   },
 *   RetryPresets.standard
 * );
 * 
 * const data = await fetchWithRetry('/api/data');
 * ```
 */
export function createRetryWrapper<TArgs extends any[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  options: RetryOptions = {}
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs) => {
    return retryWithBackoff(() => fn(...args), options);
  };
}
