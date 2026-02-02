/**
 * Simple test client for trigger-validation-unified edge function
 * Run: node test-edge-function.js [validationDetailId]
 */

const SUPABASE_URL = 'https://dfqxmjmggokneiuljkta.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmcXhtam1nZ29rbmVpdWxqa3RhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzI5NDk3NzYsImV4cCI6MjA0ODUyNTc3Nn0.73fKbCMYgjj1AYKF5GnBT_Vr8eXr0sNHp9bKxVSqEJw';

async function testEdgeFunction(validationDetailId) {
  const url = `${SUPABASE_URL}/functions/v1/trigger-validation-unified`;
  
  console.log('Testing:', url);
  console.log('Payload:', { validationDetailId });
  console.log('---');

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY
      },
      body: JSON.stringify({ validationDetailId })
    });

    console.log('Status:', response.status, response.statusText);
    
    const text = await response.text();
    try {
      const json = JSON.parse(text);
      console.log('Response:', JSON.stringify(json, null, 2));
    } catch {
      console.log('Response (raw):', text);
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Get validationDetailId from command line or use default
const validationDetailId = parseInt(process.argv[2]) || 880;
testEdgeFunction(validationDetailId);
