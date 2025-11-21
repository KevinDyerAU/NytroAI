import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';

export function TestEdgeFunction() {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const testEdgeFunction = async () => {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('TESTING UPLOAD-DOCUMENT EDGE FUNCTION DIRECTLY');
    console.log('═══════════════════════════════════════════════════════════════');
    
    setTesting(true);
    setResult(null);
    setError(null);

    try {
      // Test payload
      const testPayload = {
        rtoCode: '7148',
        unitCode: 'TLIF0025',
        documentType: 'assessment',
        fileName: 'test-document.pdf',
        storagePath: '7148/TLIF0025/UnitOfCompetency/test-path/test.pdf', // This path may not exist - just testing connectivity
        displayName: 'Test Document',
        metadata: {
          validation_detail_id: '999',
          validation_type: 'UnitOfCompetency',
          uploaded_at: new Date().toISOString(),
          test: true,
        },
      };

      console.log('[Test] Payload:', JSON.stringify(testPayload, null, 2));
      console.log('[Test] Calling supabase.functions.invoke()...');
      console.log('[Test] URL:', `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-document`);
      
      const startTime = Date.now();
      
      const { data, error: invokeError } = await supabase.functions.invoke(
        'upload-document',
        { body: testPayload }
      );

      const duration = Date.now() - startTime;
      
      console.log(`[Test] Response received after ${duration}ms`);
      console.log('[Test] Data:', data);
      console.log('[Test] Error:', invokeError);

      if (invokeError) {
        console.error('[Test] ❌ Edge Function error:', invokeError);
        setError(JSON.stringify(invokeError, null, 2));
      } else {
        console.log('[Test] ✓ Edge Function response:', data);
        setResult(data);
      }
    } catch (err: any) {
      console.error('[Test] ❌ Exception during test:', err);
      setError(err.message || 'Unknown error');
    } finally {
      setTesting(false);
      console.log('═══════════════════════════════════════════════════════════════');
    }
  };

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>🧪 Edge Function Test</CardTitle>
        <CardDescription>
          Test the upload-document Edge Function directly with mock data
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={testEdgeFunction} 
          disabled={testing}
          variant="outline"
        >
          {testing ? 'Testing...' : 'Test Edge Function'}
        </Button>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>
              <div className="font-mono text-xs whitespace-pre-wrap">
                {error}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {result && (
          <Alert>
            <AlertDescription>
              <div className="font-mono text-xs whitespace-pre-wrap">
                {JSON.stringify(result, null, 2)}
              </div>
            </AlertDescription>
          </Alert>
        )}

        <div className="text-xs text-muted-foreground">
          <p>This test will:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Call the upload-document Edge Function directly</li>
            <li>Use mock data (no real file upload)</li>
            <li>Show response time and data/errors</li>
            <li>Log everything to browser console</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
