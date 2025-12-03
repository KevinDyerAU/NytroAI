/**
 * Initialize Report Storage
 * 
 * Call this function once during app initialization to ensure
 * the Supabase storage bucket exists for storing reports
 */

import { ensureReportBucketExists } from './reportStorageService';

export async function initializeReportStorage(): Promise<void> {
  try {
    console.log('[initializeReportStorage] Initializing report storage...');
    const success = await ensureReportBucketExists();
    
    if (success) {
      console.log('[initializeReportStorage] Report storage initialized successfully');
    } else {
      console.warn('[initializeReportStorage] Failed to initialize report storage bucket');
    }
  } catch (error) {
    console.error('[initializeReportStorage] Error initializing report storage:', error);
  }
}
