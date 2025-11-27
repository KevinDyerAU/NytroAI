import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UploadRequest {
  storage_path: string;
  validation_detail_id: number;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { storage_path, validation_detail_id }: UploadRequest = await req.json();

    console.log('[upload-to-gemini] Processing:', { storage_path, validation_detail_id });

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get Gemini API key
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    // Download file from Supabase Storage
    console.log('[upload-to-gemini] Downloading from Supabase Storage:', storage_path);
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(storage_path);

    if (downloadError) {
      console.error('[upload-to-gemini] Download error:', downloadError);
      throw new Error(`Failed to download file: ${downloadError.message}`);
    }

    if (!fileData) {
      throw new Error('No file data returned from storage');
    }

    console.log('[upload-to-gemini] File downloaded, size:', fileData.size);

    // Get filename from path
    const filename = storage_path.split('/').pop() || 'document.pdf';

    // Convert Blob to ArrayBuffer
    const fileBuffer = await fileData.arrayBuffer();
    const fileBytes = new Uint8Array(fileBuffer);

    // Create multipart boundary
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2, 15);

    // Build multipart body
    const encoder = new TextEncoder();
    const parts: Uint8Array[] = [];

    // Part 1: Metadata (JSON)
    const metadataPart = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="metadata"',
      'Content-Type: application/json; charset=UTF-8',
      '',
      JSON.stringify({ displayName: filename }),
      ''
    ].join('\r\n');
    parts.push(encoder.encode(metadataPart));

    // Part 2: File data
    const fileHeaderPart = [
      `--${boundary}`,
      `Content-Disposition: form-data; name="file"; filename="${filename}"`,
      'Content-Type: application/pdf',
      '',
      ''
    ].join('\r\n');
    parts.push(encoder.encode(fileHeaderPart));
    parts.push(fileBytes);

    // End boundary
    const endBoundary = `\r\n--${boundary}--\r\n`;
    parts.push(encoder.encode(endBoundary));

    // Combine all parts
    const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
    const body = new Uint8Array(totalLength);
    let offset = 0;
    for (const part of parts) {
      body.set(part, offset);
      offset += part.length;
    }

    console.log('[upload-to-gemini] Uploading to Gemini File API, size:', body.length);

    // Upload to Gemini File API
    const geminiResponse = await fetch(
      'https://generativelanguage.googleapis.com/upload/v1beta/files',
      {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/related; boundary=${boundary}`,
          'X-Goog-Upload-Protocol': 'multipart',
          'X-Goog-Api-Key': geminiApiKey,
        },
        body: body,
      }
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('[upload-to-gemini] Gemini API error:', geminiResponse.status, errorText);
      throw new Error(`Gemini upload failed: ${geminiResponse.status} - ${errorText}`);
    }

    const geminiResult = await geminiResponse.json();
    console.log('[upload-to-gemini] Upload successful:', geminiResult);

    // Calculate expiry (48 hours from now)
    const expiryDate = new Date(Date.now() + 48 * 60 * 60 * 1000);

    // Update document record with Gemini file URI
    const { error: updateError } = await supabase
      .from('documents')
      .update({
        gemini_file_uri: geminiResult.file.uri,
        gemini_file_name: geminiResult.file.name,
        gemini_upload_timestamp: new Date().toISOString(),
        gemini_expiry_timestamp: expiryDate.toISOString(),
      })
      .eq('storage_path', storage_path)
      .eq('validation_detail_id', validation_detail_id);

    if (updateError) {
      console.error('[upload-to-gemini] Database update error:', updateError);
      throw new Error(`Failed to update document record: ${updateError.message}`);
    }

    console.log('[upload-to-gemini] Document record updated successfully');

    return new Response(
      JSON.stringify({
        success: true,
        file: geminiResult.file,
        storage_path,
        gemini_file_uri: geminiResult.file.uri,
        gemini_expiry_timestamp: expiryDate.toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('[upload-to-gemini] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
