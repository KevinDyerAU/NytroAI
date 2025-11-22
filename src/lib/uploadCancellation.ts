/**
 * Upload Cancellation Management
 * Centralized AbortController management for upload operations
 */

export interface CancellableOperation {
  id: string;
  controller: AbortController;
  type: 'upload' | 'indexing' | 'polling';
  fileName?: string;
  startedAt: number;
}

/**
 * Manages AbortControllers for cancellable operations
 */
export class UploadCancellationManager {
  private operations = new Map<string, CancellableOperation>();

  /**
   * Create a new cancellable operation
   */
  create(id: string, type: CancellableOperation['type'], fileName?: string): AbortController {
    // Cancel existing operation with same ID if it exists
    this.cancel(id);

    const controller = new AbortController();
    this.operations.set(id, {
      id,
      controller,
      type,
      fileName,
      startedAt: Date.now(),
    });

    return controller;
  }

  /**
   * Cancel an operation by ID
   */
  cancel(id: string): boolean {
    const operation = this.operations.get(id);
    if (!operation) {
      return false;
    }

    console.log(`[UploadCancellation] Cancelling ${operation.type} operation:`, id);
    operation.controller.abort();
    this.operations.delete(id);
    return true;
  }

  /**
   * Cancel all operations
   */
  cancelAll(): number {
    const count = this.operations.size;
    console.log(`[UploadCancellation] Cancelling all ${count} operations`);
    
    for (const operation of this.operations.values()) {
      operation.controller.abort();
    }
    
    this.operations.clear();
    return count;
  }

  /**
   * Cancel all operations of a specific type
   */
  cancelByType(type: CancellableOperation['type']): number {
    let count = 0;
    
    for (const [id, operation] of this.operations.entries()) {
      if (operation.type === type) {
        operation.controller.abort();
        this.operations.delete(id);
        count++;
      }
    }
    
    console.log(`[UploadCancellation] Cancelled ${count} ${type} operations`);
    return count;
  }

  /**
   * Cancel all operations for a specific file
   */
  cancelByFileName(fileName: string): number {
    let count = 0;
    
    for (const [id, operation] of this.operations.entries()) {
      if (operation.fileName === fileName) {
        operation.controller.abort();
        this.operations.delete(id);
        count++;
      }
    }
    
    console.log(`[UploadCancellation] Cancelled ${count} operations for file:`, fileName);
    return count;
  }

  /**
   * Get active operation by ID
   */
  get(id: string): CancellableOperation | undefined {
    return this.operations.get(id);
  }

  /**
   * Check if operation is active
   */
  isActive(id: string): boolean {
    return this.operations.has(id);
  }

  /**
   * Get all active operations
   */
  getAll(): CancellableOperation[] {
    return Array.from(this.operations.values());
  }

  /**
   * Get count of active operations
   */
  count(): number {
    return this.operations.size;
  }

  /**
   * Clean up completed operation
   */
  complete(id: string): void {
    this.operations.delete(id);
  }

  /**
   * Get operation duration in milliseconds
   */
  getDuration(id: string): number | null {
    const operation = this.operations.get(id);
    if (!operation) {
      return null;
    }
    return Date.now() - operation.startedAt;
  }
}

// Global singleton instance
export const uploadCancellationManager = new UploadCancellationManager();

/**
 * Create a fetch request with abort signal
 */
export async function fetchWithCancellation(
  url: string,
  options: RequestInit,
  operationId: string,
  type: CancellableOperation['type'],
  fileName?: string
): Promise<Response> {
  const controller = uploadCancellationManager.create(operationId, type, fileName);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    uploadCancellationManager.complete(operationId);
    return response;
  } catch (error) {
    uploadCancellationManager.complete(operationId);
    
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Operation cancelled: ${type}`);
    }
    
    throw error;
  }
}

/**
 * Create a Supabase function invocation with abort signal
 */
export async function invokeFunctionWithCancellation<T = any>(
  functionName: string,
  body: any,
  operationId: string,
  type: CancellableOperation['type'],
  fileName?: string
): Promise<T> {
  const controller = uploadCancellationManager.create(operationId, type, fileName);

  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    uploadCancellationManager.complete(operationId);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `Function ${functionName} failed`);
    }

    return await response.json();
  } catch (error) {
    uploadCancellationManager.complete(operationId);
    
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Operation cancelled: ${type}`);
    }
    
    throw error;
  }
}

/**
 * Poll with cancellation support
 */
export async function pollWithCancellation<T>(
  pollFn: () => Promise<T>,
  checkFn: (result: T) => boolean,
  operationId: string,
  options: {
    interval?: number;
    maxAttempts?: number;
    fileName?: string;
    onProgress?: (attempt: number, result: T) => void;
  } = {}
): Promise<T> {
  const {
    interval = 2000,
    maxAttempts = 150,
    fileName,
    onProgress,
  } = options;

  const controller = uploadCancellationManager.create(operationId, 'polling', fileName);

  try {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      // Check if cancelled
      if (controller.signal.aborted) {
        throw new Error('Polling cancelled');
      }

      const result = await pollFn();
      
      if (onProgress) {
        onProgress(attempt, result);
      }

      if (checkFn(result)) {
        uploadCancellationManager.complete(operationId);
        return result;
      }

      // Wait before next poll (with cancellation check)
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(resolve, interval);
        
        controller.signal.addEventListener('abort', () => {
          clearTimeout(timeout);
          reject(new Error('Polling cancelled'));
        });
      });
    }

    uploadCancellationManager.complete(operationId);
    throw new Error(`Polling timed out after ${maxAttempts} attempts`);
  } catch (error) {
    uploadCancellationManager.complete(operationId);
    throw error;
  }
}

/**
 * Sleep with cancellation support
 */
export async function sleepWithCancellation(
  ms: number,
  operationId: string
): Promise<void> {
  const operation = uploadCancellationManager.get(operationId);
  if (!operation) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(resolve, ms);
    
    operation.controller.signal.addEventListener('abort', () => {
      clearTimeout(timeout);
      reject(new Error('Sleep cancelled'));
    });
  });
}
