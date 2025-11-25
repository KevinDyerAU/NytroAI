// Shared Gemini API client utility for Supabase Edge Functions

export interface GeminiConfig {
  apiKey: string;
  model?: string;
  supabaseClient?: any; // Optional Supabase client for progress tracking
}

export interface FileSearchStore {
  name: string;
  displayName?: string;
  createTime?: string;
}

export interface UploadOperation {
  name: string;
  done: boolean;
  metadata?: any;
  error?: any;
}

export interface GenerateContentResponse {
  text: string;
  candidates: Array<{
    content: {
      parts: Array<{ text: string }>;
    };
    groundingMetadata?: {
      groundingChunks?: Array<{
        // For web search results
        web?: { uri: string; title?: string };
        // For File Search results (PDFs, docs, etc.)
        fileSearchChunk?: {
          documentName: string;
          displayName?: string;
          pageNumbers?: number[];
          chunkText?: string;
          customMetadata?: Array<{
            key: string;
            stringValue?: string;
            numericValue?: number;
          }>;
        };
      }>;
      groundingSupports?: Array<{
        segment: { startIndex: number; endIndex: number };
        groundingChunkIndices: number[];
        confidenceScores: number[];
      }>;
    };
  }>;
}

/**
 * Create a Gemini API client
 */
export function createGeminiClient(config: GeminiConfig) {
  const apiKey = config.apiKey;
  const baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
  const model = config.model || 'gemini-2.5-flash';

  return {
    /**
     * Create a File Search store
     */
    async createFileSearchStore(displayName: string): Promise<FileSearchStore> {
      const response = await fetch(`${baseUrl}/fileSearchStores?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: displayName,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to create file search store: ${error}`);
      }

      return await response.json();
    },

    /**
     * List all File Search stores
     */
    async listFileSearchStores(): Promise<FileSearchStore[]> {
      const response = await fetch(`${baseUrl}/fileSearchStores?key=${apiKey}`);

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to list file search stores: ${error}`);
      }

      const data = await response.json();
      return data.fileSearchStores || [];
    },

    /**
     * Get a specific File Search store
     */
    async getFileSearchStore(storeName: string): Promise<FileSearchStore> {
      const response = await fetch(`${baseUrl}/${storeName}?key=${apiKey}`);

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to get file search store: ${error}`);
      }

      return await response.json();
    },

    /**
     * Delete a File Search store
     */
    async deleteFileSearchStore(storeName: string, force: boolean = true): Promise<void> {
      const response = await fetch(
        `${baseUrl}/${storeName}?force=${force}&key=${apiKey}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to delete file search store: ${error}`);
      }
    },

    /**
     * Upload file directly to File Search store (one-step method)
     */
    async uploadToFileSearchStore(
      fileContent: Uint8Array,
      fileName: string,
      fileSearchStoreName: string,
      displayName?: string,
      metadata?: Record<string, string | number>
    ): Promise<UploadOperation> {
      const uploadStartTime = new Date().toISOString();
      const fileSizeKB = (fileContent.length / 1024).toFixed(2);

      console.log('╔════════════════════════════════════════════════════════════════════');
      console.log('║ GEMINI DIRECT UPLOAD TO FILE SEARCH STORE');
      console.log('╠════════════════════════════════════════════════════════════════════');
      console.log('║ Timestamp:', uploadStartTime);
      console.log('║ File Name:', fileName);
      console.log('║ Display Name:', displayName || fileName);
      console.log('║ File Size:', fileSizeKB, 'KB');
      console.log('║ File Search Store:', fileSearchStoreName);
      console.log('║ Metadata:', JSON.stringify(metadata, null, 2));
      console.log('╚════════════════════════════════════════════════════════════════════');

      // Convert metadata to Gemini format
      console.log('[Gemini] Original metadata:', JSON.stringify(metadata));
      const customMetadata = metadata
        ? Object.entries(metadata).map(([key, value]) => ({
            key: key.replace(/_/g, '-'),
            stringValue: String(value),
          }))
        : [];
      console.log('[Gemini] Converted customMetadata for File Search:', JSON.stringify(customMetadata));

      // Create multipart form data with file + metadata
      const boundary = `----WebKitFormBoundary${Math.random().toString(36).substring(2)}`;
      const metadataJson = JSON.stringify({
        displayName: displayName || fileName,
        ...(customMetadata.length > 0 && { customMetadata }),
      });
      console.log('[Gemini] Final metadata JSON being sent to Gemini:', metadataJson);

      // Build multipart body
      const parts: Uint8Array[] = [];
      const encoder = new TextEncoder();
      
      // Metadata part
      parts.push(encoder.encode(`--${boundary}\r\n`));
      parts.push(encoder.encode('Content-Type: application/json; charset=UTF-8\r\n\r\n'));
      parts.push(encoder.encode(metadataJson));
      parts.push(encoder.encode('\r\n'));
      
      // File part with proper headers
      parts.push(encoder.encode(`--${boundary}\r\n`));
      parts.push(encoder.encode(`Content-Type: application/pdf\r\n`));
      parts.push(encoder.encode(`Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n\r\n`));
      parts.push(fileContent);
      parts.push(encoder.encode('\r\n'));
      parts.push(encoder.encode(`--${boundary}--\r\n`));

      // Combine all parts
      const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
      const body = new Uint8Array(totalLength);
      let offset = 0;
      for (const part of parts) {
        body.set(part, offset);
        offset += part.length;
      }

      console.log('║ Upload URL:', `https://generativelanguage.googleapis.com/upload/v1beta/${fileSearchStoreName}:uploadToFileSearchStore`);
      console.log('║ Metadata:', metadataJson);

      const uploadController = new AbortController();
      const uploadTimeoutId = setTimeout(() => uploadController.abort(), 120000); // 120s timeout

      let uploadResponse;
      try {
        uploadResponse = await fetch(
          `https://generativelanguage.googleapis.com/upload/v1beta/${fileSearchStoreName}:uploadToFileSearchStore?key=${apiKey}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': `multipart/related; boundary=${boundary}`,
            },
            body: body,
            signal: uploadController.signal,
          }
        );
        clearTimeout(uploadTimeoutId);
      } catch (uploadError: any) {
        clearTimeout(uploadTimeoutId);
        if (uploadError.name === 'AbortError') {
          throw new Error(`Gemini API timeout: Upload took longer than 120 seconds`);
        }
        throw uploadError;
      }

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.log('╔════════════════════════════════════════════════════════════════════');
        console.log('║ GEMINI DIRECT UPLOAD FAILED');
        console.log('╠════════════════════════════════════════════════════════════════════');
        console.log('║ File Name:', fileName);
        console.log('║ Store:', fileSearchStoreName);
        console.log('║ HTTP Status:', uploadResponse.status, uploadResponse.statusText);
        console.log('║ Error Response:', errorText);
        console.log('╚════════════════════════════════════════════════════════════════════');

        let errorMessage = errorText;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error?.message || errorJson.message || errorText;
        } catch (e) {
          // Not JSON
        }

        throw new Error(`Failed to upload to File Search store: ${errorMessage}`);
      }

      const result = await uploadResponse.json();
      console.log('║ ✓ File uploaded directly to File Search store');
      console.log('║ Operation Name:', result.name);
      console.log('╚════════════════════════════════════════════════════════════════════');
      return result;
    },

    /**
     * Check operation status with timeout
     */
    async getOperation(operationName: string): Promise<UploadOperation> {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout per request

      try {
        const response = await fetch(`${baseUrl}/${operationName}?key=${apiKey}`, {
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Failed to get operation: ${error}`);
        }

        return await response.json();
      } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          throw new Error(`Gemini API timeout: getOperation took longer than 10 seconds`);
        }
        throw error;
      }
    },

    /**
     * Wait for operation to complete with database progress tracking
     */
    async waitForOperation(
      operationName: string,
      maxWaitTime: number = 60000,
      operationId?: number
    ): Promise<UploadOperation> {
      const startTime = Date.now();
      let lastLogTime = startTime;
      let checkCount = 0;
      const supabase = config.supabaseClient;

      // Update initial status if tracking
      if (supabase && operationId) {
        await supabase
          .from('gemini_operations')
          .update({
            status: 'processing',
            updated_at: new Date().toISOString(),
          })
          .eq('id', operationId);
      }

      while (Date.now() - startTime < maxWaitTime) {
        checkCount++;
        const currentTime = Date.now();
        const elapsedMs = currentTime - startTime;
        const elapsedSeconds = Math.floor(elapsedMs / 1000);

        console.log(`[Gemini Poll #${checkCount}] Checking operation status (${elapsedSeconds}s elapsed)...`);

        const operation = await this.getOperation(operationName);

        console.log(`[Gemini Poll #${checkCount}] Status:`, {
          done: operation.done,
          hasError: !!operation.error,
          hasMetadata: !!operation.metadata,
        });

        if (operation.done) {
          if (operation.error) {
            // Update error status
            if (supabase && operationId) {
              await supabase
                .from('gemini_operations')
                .update({
                  status: 'failed',
                  error_message: JSON.stringify(operation.error),
                  completed_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                })
                .eq('id', operationId);
            }
            throw new Error(`Operation failed: ${JSON.stringify(operation.error)}`);
          }
          const totalTime = Date.now() - startTime;
          console.log(`Operation completed successfully in ${totalTime}ms after ${checkCount} status checks`);
          console.log(`[Gemini] ⚠️ DEBUG - Full operation response:`, JSON.stringify(operation, null, 2));

          // VERIFICATION: Test if file is actually searchable
          if (operation.metadata?.fileSearchStore) {
            const storeName = operation.metadata.fileSearchStore.name;
            console.log(`[Gemini Verification] Testing if file is searchable in store: ${storeName}`);
            
            try {
              // Do a simple test query to verify the file is indexed
              const geminiApiKey = (Deno as any).env.get('GEMINI_API_KEY');
              const testResponse = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiApiKey}`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    contents: [{ parts: [{ text: 'List any documents available.' }] }],
                    tools: [{
                      file_search: {
                        file_search_store_names: [storeName]
                      }
                    }]
                  })
                }
              );
              
              const testData = await testResponse.json();
              const groundingChunks = testData.candidates?.[0]?.groundingMetadata?.groundingChunks?.length || 0;
              console.log(`[Gemini Verification] Grounding chunks found: ${groundingChunks}`);
              
              if (groundingChunks === 0) {
                console.warn(`[Gemini Verification] WARNING: File uploaded but not searchable yet!`);
              } else {
                console.log(`[Gemini Verification] ✓ File is searchable`);
              }
            } catch (verifyError) {
              console.error(`[Gemini Verification] Error testing searchability:`, verifyError);
            }
          }

          // Update completion status
          if (supabase && operationId) {
            await supabase
              .from('gemini_operations')
              .update({
                status: 'completed',
                progress_percentage: 100,
                elapsed_time_ms: totalTime,
                check_count: checkCount,
                completed_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq('id', operationId);
          }

          return operation;
        }

        // Calculate progress for database update
        const progressPercentage = Math.min(95, Math.floor((elapsedMs / maxWaitTime) * 100));

        // Update progress in database every 10 seconds
        if (currentTime - lastLogTime >= 10000) {
          console.log(`[Gemini Operation] Still processing... (${elapsedSeconds}s elapsed, max wait: ${Math.floor(maxWaitTime / 1000)}s)`);

          if (supabase && operationId) {
            await supabase
              .from('gemini_operations')
              .update({
                progress_percentage: progressPercentage,
                elapsed_time_ms: elapsedMs,
                check_count: checkCount,
                last_check_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq('id', operationId);
          }

          lastLogTime = currentTime;
        }

        // Wait 2 seconds before checking again
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      const totalElapsed = Math.floor((Date.now() - startTime) / 1000);
      const errorMessage = `Operation timed out after ${totalElapsed} seconds (max: ${Math.floor(maxWaitTime / 1000)}s, checks: ${checkCount})`;

      console.error('╔══════════════════════════════════════════════════════��═════════════');
      console.error('║ GEMINI OPERATION TIMEOUT');
      console.error('╠════════════════════════════════════════════════════════════════════');
      console.error('║ Operation Name:', operationName);
      console.error('║ Total Elapsed:', totalElapsed, 'seconds');
      console.error('║ Max Wait Time:', Math.floor(maxWaitTime / 1000), 'seconds');
      console.error('║ Status Checks:', checkCount);
      console.error('║ This suggests either:');
      console.error('║  1. Gemini API is experiencing delays');
      console.error('║  2. Network connectivity issues');
      console.error('║  3. File is too large/complex for processing');
      console.error('╚════════════════════════════════════════════════════════════════════');

      // Update timeout status
      if (supabase && operationId) {
        await supabase
          .from('gemini_operations')
          .update({
            status: 'timeout',
            error_message: errorMessage,
            elapsed_time_ms: Date.now() - startTime,
            check_count: checkCount,
            updated_at: new Date().toISOString(),
          })
          .eq('id', operationId);
      }

      throw new Error(errorMessage);
    },

    /**
     * Generate content with File Search
     */
    async generateContentWithFileSearch(
      prompt: string,
      fileSearchStoreNames: string[],
      metadataFilter?: string
    ): Promise<GenerateContentResponse> {
      const requestStartTime = new Date().toISOString();

      console.log('╔════════════════════════════════════════��═══════════════════════════');
      console.log('║ GEMINI GENERATE CONTENT REQUEST');
      console.log('╠════════════════════════════════════════════════════════════════════');
      console.log('║ Timestamp:', requestStartTime);
      console.log('║ Model:', model);
      console.log('║ File Search Stores:', JSON.stringify(fileSearchStoreNames, null, 2));
      if (metadataFilter) {
        console.log('║ Metadata Filter:', metadataFilter);
      }
      console.log('║');
      console.log('║ PROMPT:');
      console.log('║', prompt.substring(0, 500) + (prompt.length > 500 ? '...' : ''));
      console.log('╚════════════════════════════════════════════════════════════════════');

      const requestBody: any = {
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        tools: [
          {
            file_search: {
              file_search_store_names: fileSearchStoreNames,
              ...(metadataFilter && { metadata_filter: metadataFilter }),
            },
          },
        ],
        generationConfig: {
          response_mime_type: "application/json",
          temperature: 0.2, // Lower temperature for more consistent JSON
        },
      };

      const response = await fetch(
        `${baseUrl}/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        console.log('╔════════════════════════════════════════════════════════════════════');
        console.log('║ GEMINI GENERATE CONTENT FAILED');
        console.log('╠════════════════════════════════════════════════════════════════════');
        console.log('║ Error:', error);
        console.log('╚═══════════════════════════════════════════════════════════��════════');
        throw new Error(`Failed to generate content: ${error}`);
      }

      const data = await response.json();

      // Extract text from response
      const text =
        data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated';

      const responseEndTime = new Date().toISOString();
      const groundingChunks = data.candidates?.[0]?.groundingMetadata?.groundingChunks?.length || 0;

      console.log('╔════════════════════════════════════════════════════════════════════');
      console.log('║ GEMINI GENERATE CONTENT RESPONSE');
      console.log('╠════════════════════��═══════════════════════════════════════════════');
      console.log('║ Timestamp:', responseEndTime);
      console.log('║ Grounding Chunks Found:', groundingChunks);
      console.log('║');
      console.log('║ RESPONSE TEXT:');
      console.log('║', text.substring(0, 1000) + (text.length > 1000 ? '...' : ''));
      console.log('║');
      if (data.candidates?.[0]?.groundingMetadata?.groundingChunks) {
        console.log('║ GROUNDING SOURCES:');
        data.candidates[0].groundingMetadata.groundingChunks.slice(0, 3).forEach((chunk: any, i: number) => {
          if (chunk.fileSearchChunk) {
            console.log(`║   [${i + 1}] Document:`, chunk.fileSearchChunk.documentName || 'Unknown');
            console.log(`║       Pages:`, chunk.fileSearchChunk.pageNumbers?.join(', ') || 'N/A');
          }
        });
      }
      console.log('║');
      console.log('║ FULL RESPONSE JSON:');
      console.log(JSON.stringify(data, null, 2));
      console.log('╚════════════════════════════════════════════════════════════════════');

      return {
        text,
        candidates: data.candidates || [],
      };
    },

    /**
     * List documents in a File Search store
     */
    async listDocuments(fileSearchStoreName: string): Promise<any[]> {
      const response = await fetch(
        `${baseUrl}/${fileSearchStoreName}/documents?key=${apiKey}`
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to list documents: ${error}`);
      }

      const data = await response.json();
      return data.documents || [];
    },

    /**
     * Delete a document from File Search store
     */
    async deleteDocument(documentName: string): Promise<void> {
      const response = await fetch(`${baseUrl}/${documentName}?key=${apiKey}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to delete document: ${error}`);
      }
    },
  };
}

/**
 * Get Gemini API key from environment
 */
export function getGeminiApiKey(): string {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable not set');
  }
  return apiKey;
}

/**
 * Create a default Gemini client with environment config
 */
export function createDefaultGeminiClient() {
  return createGeminiClient({
    apiKey: getGeminiApiKey(),
    model: Deno.env.get('GEMINI_MODEL') || 'gemini-2.5-flash',
  });
}
