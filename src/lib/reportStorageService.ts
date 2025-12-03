/**
 * Report Storage Service
 * 
 * Handles uploading generated reports to Supabase storage
 * alongside uploaded unit/learner guide documents
 */

import { supabase } from './supabase';
import { toast } from 'sonner';

export interface StoredReport {
  id: string;
  filename: string;
  url: string;
  type: 'assessment' | 'learner-guide';
  uploadedAt: string;
  validationDetailId: number;
}

/**
 * Upload report to Supabase storage
 * 
 * Storage structure:
 * validation-reports/
 *   {rtoCode}/
 *     {validationDetailId}/
 *       {unitCode}_Assessment_Report_{date}.xlsx
 *       {unitCode}_Learner-Guide_Report_{date}.xlsx
 */
export async function uploadReportToStorage(
  blob: Blob,
  filename: string,
  rtoCode: string,
  validationDetailId: number,
  unitCode: string
): Promise<StoredReport | null> {
  try {
    // Create storage path
    const bucketName = 'validation-reports';
    const storagePath = `${rtoCode}/${validationDetailId}/${filename}`;

    console.log('[reportStorageService] Uploading report:', {
      bucketName,
      storagePath,
      fileSize: blob.size,
    });

    // Upload to Supabase storage
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(storagePath, blob, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error('[reportStorageService] Upload error:', error);
      throw error;
    }

    if (!data) {
      throw new Error('No data returned from upload');
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(storagePath);

    const publicUrl = publicUrlData?.publicUrl;

    if (!publicUrl) {
      throw new Error('Failed to get public URL for uploaded file');
    }

    console.log('[reportStorageService] Report uploaded successfully:', publicUrl);

    // Determine report type from filename
    let reportType: 'assessment' | 'learner-guide' = 'assessment';
    if (filename.includes('Learner-Guide')) {
      reportType = 'learner-guide';
    }

    return {
      id: data.path,
      filename: filename,
      url: publicUrl,
      type: reportType,
      uploadedAt: new Date().toISOString(),
      validationDetailId,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[reportStorageService] Failed to upload report:', errorMsg);
    toast.error('Failed to store report', {
      description: errorMsg,
    });
    return null;
  }
}

/**
 * Get all reports for a validation detail
 */
export async function getReportsForValidation(
  rtoCode: string,
  validationDetailId: number
): Promise<StoredReport[]> {
  try {
    const bucketName = 'validation-reports';
    const folderPath = `${rtoCode}/${validationDetailId}`;

    const { data, error } = await supabase.storage
      .from(bucketName)
      .list(folderPath);

    if (error) {
      console.error('[reportStorageService] Error listing reports:', error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Filter for Excel files only
    const reports: StoredReport[] = data
      .filter(file => file.name.endsWith('.xlsx'))
      .map(file => {
        const { data: publicUrlData } = supabase.storage
          .from(bucketName)
          .getPublicUrl(`${folderPath}/${file.name}`);

        let reportType: 'assessment' | 'learner-guide' = 'assessment';
        if (file.name.includes('Learner-Guide')) {
          reportType = 'learner-guide';
        }

        return {
          id: `${folderPath}/${file.name}`,
          filename: file.name,
          url: publicUrlData?.publicUrl || '',
          type: reportType,
          uploadedAt: file.updated_at || new Date().toISOString(),
          validationDetailId,
        };
      });

    return reports;
  } catch (error) {
    console.error('[reportStorageService] Failed to get reports:', error);
    return [];
  }
}

/**
 * Delete a report from storage
 */
export async function deleteReportFromStorage(
  rtoCode: string,
  validationDetailId: number,
  filename: string
): Promise<boolean> {
  try {
    const bucketName = 'validation-reports';
    const storagePath = `${rtoCode}/${validationDetailId}/${filename}`;

    const { error } = await supabase.storage
      .from(bucketName)
      .remove([storagePath]);

    if (error) {
      console.error('[reportStorageService] Delete error:', error);
      throw error;
    }

    console.log('[reportStorageService] Report deleted:', storagePath);
    return true;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[reportStorageService] Failed to delete report:', errorMsg);
    toast.error('Failed to delete report', {
      description: errorMsg,
    });
    return false;
  }
}

/**
 * Download report from storage
 */
export function downloadReportFromStorage(url: string, filename: string) {
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    console.log('[reportStorageService] Report downloaded:', filename);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[reportStorageService] Failed to download report:', errorMsg);
    toast.error('Failed to download report', {
      description: errorMsg,
    });
  }
}

/**
 * Create Supabase bucket for reports if it doesn't exist
 * This should be called once during app initialization
 */
export async function ensureReportBucketExists(): Promise<boolean> {
  try {
    const bucketName = 'validation-reports';

    // Check if bucket exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();

    if (listError) {
      console.error('[reportStorageService] Error listing buckets:', listError);
      return false;
    }

    const bucketExists = buckets?.some(b => b.name === bucketName);

    if (bucketExists) {
      console.log('[reportStorageService] Report bucket already exists');
      return true;
    }

    // Create bucket
    const { data, error: createError } = await supabase.storage.createBucket(bucketName, {
      public: true,
      fileSizeLimit: 52428800, // 50MB
    });

    if (createError) {
      console.error('[reportStorageService] Error creating bucket:', createError);
      return false;
    }

    console.log('[reportStorageService] Report bucket created successfully');
    return true;
  } catch (error) {
    console.error('[reportStorageService] Unexpected error ensuring bucket:', error);
    return false;
  }
}
