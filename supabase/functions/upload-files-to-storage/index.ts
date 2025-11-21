import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const {
      rtoCode,
      unitCode,
      validationType,
      files, // Array of { name, base64Content }
    } = await req.json();

    if (!rtoCode || !unitCode || !validationType || !files || !Array.isArray(files)) {
      throw new Error('Missing required parameters: rtoCode, unitCode, validationType, or files');
    }

    console.log(`[upload-files-to-storage] Uploading ${files.length} files for RTO: ${rtoCode}, Unit: ${unitCode}`);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const folderPath = `${rtoCode}/${unitCode}/${validationType}/${timestamp}`;
    const uploadedFiles: Array<{ name: string; path: string; url: string }> = [];

    for (const { name, base64Content } of files) {
      const filePath = `${folderPath}/${name}`;
      
      console.log(`[upload-files-to-storage] Uploading ${name} to ${filePath}...`);

      // Convert base64 to bytes
      const binaryString = atob(base64Content);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const { data, error } = await supabase.storage
        .from('documents')
        .upload(filePath, bytes, {
          contentType: getMimeType(name),
          cacheControl: '3600',
          upsert: false,
        });

      if (error) {
        console.error(`[upload-files-to-storage] Error uploading ${name}:`, error);
        throw new Error(`Failed to upload ${name}: ${error.message}`);
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      console.log(`[upload-files-to-storage] ${name} uploaded successfully to ${publicUrl}`);

      uploadedFiles.push({
        name,
        path: filePath,
        url: publicUrl,
      });
    }

    console.log(`[upload-files-to-storage] All ${uploadedFiles.length} files uploaded successfully`);

    return new Response(
      JSON.stringify({
        success: true,
        uploadedFiles,
        folderPath,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('[upload-files-to-storage] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Unknown error',
        uploadedFiles: [],
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

function getMimeType(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop();
  const mimeTypes: { [key: string]: string } = {
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'txt': 'text/plain',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
  };
  return mimeTypes[ext || ''] || 'application/octet-stream';
}
