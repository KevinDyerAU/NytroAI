/**
 * Azure Document Intelligence Client for Supabase Edge Functions
 * 
 * This module provides document extraction using Azure Document Intelligence
 * as an alternative to Google Gemini File API.
 * 
 * Environment Variables:
 * - AZURE_DOC_INTEL_ENDPOINT: Azure Document Intelligence endpoint URL
 * - AZURE_DOC_INTEL_KEY: Azure Document Intelligence API key
 */

export interface AzureDocIntelConfig {
  endpoint: string;
  apiKey: string;
  apiVersion?: string;
}

export interface ExtractedDocument {
  content: string;
  pages: ExtractedPage[];
  tables?: ExtractedTable[];
  paragraphs?: ExtractedParagraph[];
}

export interface ExtractedPage {
  pageNumber: number;
  content: string;
  width?: number;
  height?: number;
}

export interface ExtractedTable {
  rowCount: number;
  columnCount: number;
  cells: TableCell[];
  pageNumber?: number;
}

export interface TableCell {
  rowIndex: number;
  columnIndex: number;
  content: string;
  isHeader?: boolean;
}

export interface ExtractedParagraph {
  content: string;
  pageNumber?: number;
  role?: string;
}

export interface AnalyzeOperation {
  operationId: string;
  status: 'notStarted' | 'running' | 'succeeded' | 'failed';
  result?: ExtractedDocument;
  error?: string;
}

/**
 * Create an Azure Document Intelligence client
 */
export function createAzureDocIntelClient(config: AzureDocIntelConfig) {
  const { endpoint, apiKey, apiVersion = '2024-11-30' } = config;

  // Ensure endpoint doesn't have trailing slash
  const baseUrl = endpoint.replace(/\/$/, '');

  return {
    /**
     * Analyze a document from a URL
     */
    async analyzeDocumentFromUrl(
      documentUrl: string,
      modelId: string = 'prebuilt-layout'
    ): Promise<AnalyzeOperation> {
      const url = `${baseUrl}/documentintelligence/documentModels/${modelId}:analyze?api-version=${apiVersion}`;

      console.log('[Azure Doc Intel] Starting analysis:', {
        modelId,
        documentUrl: documentUrl.substring(0, 100) + '...'
      });

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Ocp-Apim-Subscription-Key': apiKey,
        },
        body: JSON.stringify({
          urlSource: documentUrl
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Azure Doc Intel] Analysis failed:', {
          status: response.status,
          error: errorText
        });
        throw new Error(`Document analysis failed (${response.status}): ${errorText}`);
      }

      // Get operation location from header
      const operationLocation = response.headers.get('Operation-Location');
      if (!operationLocation) {
        throw new Error('No operation location returned from Document Intelligence');
      }

      // Extract operation ID from URL
      const operationId = operationLocation.split('/').pop()?.split('?')[0] || '';

      console.log('[Azure Doc Intel] Analysis started:', { operationId });

      return {
        operationId,
        status: 'running'
      };
    },

    /**
     * Analyze a document from binary content
     */
    async analyzeDocumentFromBytes(
      documentContent: Uint8Array,
      contentType: string = 'application/pdf',
      modelId: string = 'prebuilt-layout'
    ): Promise<AnalyzeOperation> {
      const url = `${baseUrl}/documentintelligence/documentModels/${modelId}:analyze?api-version=${apiVersion}`;

      console.log('[Azure Doc Intel] Starting analysis from bytes:', {
        modelId,
        contentType,
        sizeKB: (documentContent.length / 1024).toFixed(2)
      });

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': contentType,
          'Ocp-Apim-Subscription-Key': apiKey,
        },
        body: documentContent as any,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Azure Doc Intel] Analysis failed:', {
          status: response.status,
          error: errorText
        });
        throw new Error(`Document analysis failed (${response.status}): ${errorText}`);
      }

      // Get operation location from header
      const operationLocation = response.headers.get('Operation-Location');
      if (!operationLocation) {
        throw new Error('No operation location returned from Document Intelligence');
      }

      // Extract operation ID from URL
      const operationId = operationLocation.split('/').pop()?.split('?')[0] || '';

      console.log('[Azure Doc Intel] Analysis started:', { operationId });

      return {
        operationId,
        status: 'running'
      };
    },

    /**
     * Get the status and result of an analysis operation
     */
    async getAnalysisResult(
      operationId: string,
      modelId: string = 'prebuilt-layout'
    ): Promise<AnalyzeOperation> {
      const url = `${baseUrl}/documentintelligence/documentModels/${modelId}/analyzeResults/${operationId}?api-version=${apiVersion}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Ocp-Apim-Subscription-Key': apiKey,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get analysis result (${response.status}): ${errorText}`);
      }

      const data = await response.json();

      if (data.status === 'succeeded') {
        const result = this.parseAnalyzeResult(data.analyzeResult);
        return {
          operationId,
          status: 'succeeded',
          result
        };
      } else if (data.status === 'failed') {
        return {
          operationId,
          status: 'failed',
          error: data.error?.message || 'Analysis failed'
        };
      }

      return {
        operationId,
        status: data.status
      };
    },

    /**
     * Wait for analysis to complete with polling
     */
    async waitForAnalysis(
      operationId: string,
      modelId: string = 'prebuilt-layout',
      maxWaitMs: number = 120000,
      pollIntervalMs: number = 2000
    ): Promise<ExtractedDocument> {
      const startTime = Date.now();

      while (Date.now() - startTime < maxWaitMs) {
        const result = await this.getAnalysisResult(operationId, modelId);

        if (result.status === 'succeeded' && result.result) {
          console.log('[Azure Doc Intel] Analysis completed:', {
            operationId,
            pageCount: result.result.pages.length,
            contentLength: result.result.content.length
          });
          return result.result;
        }

        if (result.status === 'failed') {
          throw new Error(`Document analysis failed: ${result.error}`);
        }

        console.log('[Azure Doc Intel] Analysis in progress...', {
          operationId,
          status: result.status,
          elapsedMs: Date.now() - startTime
        });

        await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
      }

      throw new Error(`Document analysis timed out after ${maxWaitMs}ms`);
    },

    /**
     * Parse the analyze result into our format
     */
    parseAnalyzeResult(analyzeResult: any): ExtractedDocument {
      const pages: ExtractedPage[] = (analyzeResult.pages || []).map((page: any) => ({
        pageNumber: page.pageNumber,
        content: page.lines?.map((line: any) => line.content).join('\n') || '',
        width: page.width,
        height: page.height
      }));

      const tables: ExtractedTable[] = (analyzeResult.tables || []).map((table: any) => ({
        rowCount: table.rowCount,
        columnCount: table.columnCount,
        cells: (table.cells || []).map((cell: any) => ({
          rowIndex: cell.rowIndex,
          columnIndex: cell.columnIndex,
          content: cell.content || '',
          isHeader: cell.kind === 'columnHeader' || cell.kind === 'rowHeader'
        })),
        pageNumber: table.boundingRegions?.[0]?.pageNumber
      }));

      const paragraphs: ExtractedParagraph[] = (analyzeResult.paragraphs || []).map((para: any) => ({
        content: para.content || '',
        pageNumber: para.boundingRegions?.[0]?.pageNumber,
        role: para.role
      }));

      return {
        content: analyzeResult.content || '',
        pages,
        tables,
        paragraphs
      };
    },

    /**
     * Analyze a document and wait for completion (convenience method)
     */
    async extractDocument(
      documentContent: Uint8Array,
      contentType: string = 'application/pdf'
    ): Promise<ExtractedDocument> {
      const operation = await this.analyzeDocumentFromBytes(documentContent, contentType);
      return await this.waitForAnalysis(operation.operationId);
    }
  };
}

/**
 * Create a default Azure Document Intelligence client from environment variables
 */
export function createDefaultAzureDocIntelClient() {
  const endpoint = Deno.env.get('AZURE_DOC_INTEL_ENDPOINT');
  const apiKey = Deno.env.get('AZURE_DOC_INTEL_KEY');

  if (!endpoint || !apiKey) {
    throw new Error('Missing Azure Document Intelligence configuration. Set AZURE_DOC_INTEL_ENDPOINT and AZURE_DOC_INTEL_KEY environment variables.');
  }

  return createAzureDocIntelClient({
    endpoint,
    apiKey
  });
}
