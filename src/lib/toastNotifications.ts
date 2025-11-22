/**
 * Toast Notification Utilities - Phase 3.4
 * Standardized toast notifications for common scenarios
 */

import { toast } from 'sonner';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

/**
 * Show success toast for validation completion
 */
export function showValidationCompleteToast(validationName: string, onView?: () => void) {
  toast.success('Validation Complete', {
    description: `${validationName} has been validated successfully`,
    action: onView
      ? {
          label: 'View Results',
          onClick: onView,
        }
      : undefined,
    duration: 5000,
  });
}

/**
 * Show error toast for validation failure
 */
export function showValidationErrorToast(error: string, onRetry?: () => void) {
  toast.error('Validation Failed', {
    description: error,
    action: onRetry
      ? {
          label: 'Retry',
          onClick: onRetry,
        }
      : undefined,
    duration: 10000,
  });
}

/**
 * Show toast when validation is deleted
 */
export function showValidationDeletedToast(onGoToDashboard?: () => void) {
  toast.error('Validation Deleted', {
    description: 'This validation has been removed from the database',
    action: onGoToDashboard
      ? {
          label: 'Go to Dashboard',
          onClick: onGoToDashboard,
        }
      : undefined,
    cancel: {
      label: 'Dismiss',
      onClick: () => {},
    },
    duration: 10000,
  });
}

/**
 * Show toast for network connection restored
 */
export function showConnectionRestoredToast() {
  toast.success('Connection Restored', {
    description: 'Dashboard is now syncing with the server',
    duration: 3000,
  });
}

/**
 * Show toast for network connection lost
 */
export function showConnectionLostToast() {
  toast.error('Connection Lost', {
    description: 'Unable to reach the server. Retrying...',
    duration: 5000,
  });
}

/**
 * Show toast for background sync
 */
export function showSyncingToast() {
  return toast.info('Syncing...', {
    description: 'Updating validation statuses',
    duration: 2000,
  });
}

/**
 * Show toast for batch operations
 */
export function showBatchUpdateToast(count: number, operation: string) {
  toast.success(`${count} ${operation}`, {
    description: 'All changes have been saved',
    duration: 3000,
  });
}

/**
 * Show toast for document upload progress
 */
export function showUploadProgressToast(fileName: string, progress: number) {
  return toast.loading(`Uploading ${fileName}...`, {
    description: `${progress}% complete`,
  });
}

/**
 * Show toast for document upload success
 */
export function showUploadSuccessToast(fileName: string) {
  toast.success('Upload Complete', {
    description: `${fileName} has been uploaded successfully`,
    duration: 3000,
  });
}

/**
 * Show toast for document upload error
 */
export function showUploadErrorToast(fileName: string, error: string, onRetry?: () => void) {
  toast.error('Upload Failed', {
    description: `Failed to upload ${fileName}: ${error}`,
    action: onRetry
      ? {
          label: 'Retry',
          onClick: onRetry,
        }
      : undefined,
    duration: 10000,
  });
}

/**
 * Show toast for timeout errors
 */
export function showTimeoutErrorToast(operation: string, onRetry?: () => void, onCheckStatus?: () => void) {
  toast.error(`${operation} Timed Out`, {
    description: 'The request took too long to complete. The server may be slow or the edge function may not be deployed.',
    action: onRetry
      ? {
          label: 'Retry',
          onClick: onRetry,
        }
      : undefined,
    cancel: onCheckStatus
      ? {
          label: 'Check Status',
          onClick: onCheckStatus,
        }
      : undefined,
    duration: 15000,
  });
}

/**
 * Show toast for edge function deployment issues
 */
export function showEdgeFunctionErrorToast(functionName: string, onCheckFunctions?: () => void) {
  toast.error('Edge Function Error', {
    description: `The ${functionName} function may not be deployed or is not responding`,
    action: onCheckFunctions
      ? {
          label: 'Check Functions',
          onClick: onCheckFunctions,
        }
      : undefined,
    cancel: {
      label: 'Dismiss',
      onClick: () => {},
    },
    duration: 15000,
  });
}

/**
 * Show toast for database errors
 */
export function showDatabaseErrorToast(error: string, onRetry?: () => void) {
  toast.error('Database Error', {
    description: error,
    action: onRetry
      ? {
          label: 'Retry',
          onClick: onRetry,
        }
      : undefined,
    duration: 10000,
  });
}

/**
 * Show toast for permission errors
 */
export function showPermissionErrorToast(resource: string) {
  toast.error('Permission Denied', {
    description: `You don't have permission to access ${resource}`,
    duration: 5000,
  });
}

/**
 * Show toast for validation in progress
 */
export function showValidationInProgressToast(validationName: string) {
  return toast.loading('Validation In Progress', {
    description: `${validationName} is being validated...`,
  });
}

/**
 * Dismiss a toast by ID
 */
export function dismissToast(toastId: string | number) {
  toast.dismiss(toastId);
}

/**
 * Dismiss all toasts
 */
export function dismissAllToasts() {
  toast.dismiss();
}

/**
 * Show custom toast with full control
 */
export function showCustomToast(
  type: 'success' | 'error' | 'info' | 'warning' | 'loading',
  title: string,
  options?: {
    description?: string;
    action?: ToastAction;
    cancel?: ToastAction;
    duration?: number;
  }
) {
  const toastFn = toast[type];
  return toastFn(title, {
    description: options?.description,
    action: options?.action,
    cancel: options?.cancel,
    duration: options?.duration,
  });
}
