import { supabase } from '../lib/supabase';

/**
 * Check if the storage bucket is accessible and configured
 */
export async function checkStorageBucket(): Promise<{
  accessible: boolean;
  error?: string;
  details?: any;
}> {
  try {
    // Check authentication first
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return {
        accessible: false,
        error: 'Not authenticated',
      };
    }

    // Try to list buckets
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      return {
        accessible: false,
        error: `Failed to list buckets: ${bucketsError.message}`,
        details: bucketsError,
      };
    }

    // Check if 'documents' bucket exists
    const documentsBucket = buckets?.find(b => b.name === 'documents');
    if (!documentsBucket) {
      return {
        accessible: false,
        error: 'Storage bucket "documents" not found. Please create it in Supabase Dashboard.',
        details: { availableBuckets: buckets?.map(b => b.name) },
      };
    }

    // Try to list files in the bucket (test access)
    const { error: listError } = await supabase.storage
      .from('documents')
      .list('', { limit: 1 });

    if (listError) {
      return {
        accessible: false,
        error: `Cannot access documents bucket: ${listError.message}. Check RLS policies.`,
        details: listError,
      };
    }

    return {
      accessible: true,
      details: {
        bucketName: documentsBucket.name,
        bucketId: documentsBucket.id,
        public: documentsBucket.public,
      },
    };
  } catch (error) {
    return {
      accessible: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error,
    };
  }
}

/**
 * Test a small file upload to verify upload capability
 */
export async function testStorageUpload(): Promise<{
  success: boolean;
  error?: string;
  details?: any;
}> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { success: false, error: 'Not authenticated' };
    }

    // Create a tiny test file
    const testContent = new Blob(['test'], { type: 'text/plain' });
    const testPath = `test/${Date.now()}.txt`;

    console.log('[Storage Test] Attempting test upload to:', testPath);

    const { data, error } = await supabase.storage
      .from('documents')
      .upload(testPath, testContent, {
        cacheControl: '3600',
        upsert: true,
      });

    if (error) {
      console.error('[Storage Test] Upload failed:', error);
      return {
        success: false,
        error: `Test upload failed: ${error.message}`,
        details: error,
      };
    }

    console.log('[Storage Test] Upload successful, cleaning up...');

    // Clean up test file
    await supabase.storage.from('documents').remove([testPath]);

    return {
      success: true,
      details: { path: data.path },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error,
    };
  }
}
