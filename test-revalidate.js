/**
 * Test revalidate-proxy (single requirement validation)
 * Run: node test-revalidate.js [validationResultId]
 */

const SUPABASE_URL = 'https://dfqxmjmggokneiuljkta.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmcXhtam1nZ29rbmVpdWxqa3RhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzI5NDk3NzYsImV4cCI6MjA0ODUyNTc3Nn0.73fKbCMYgjj1AYKF5GnBT_Vr8eXr0sNHp9bKxVSqEJw';

async function testRevalidate(validationResultId) {
  const url = `${SUPABASE_URL}/functions/v1/revalidate-proxy`;
  
  // Minimal payload - revalidate-proxy fetches the rest from DB
  const payload = {
    validation_result_id: validationResultId,
    validation_result: {
      id: validationResultId
    }
  };

  console.log('Testing revalidate-proxy:', url);
  console.log('Payload:', JSON.stringify(payload, null, 2));
  console.log('---');

  try {
    const start = Date.now();
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY
      },
      body: JSON.stringify(payload)
    });

    const elapsed = Date.now() - start;
    console.log('Status:', response.status, response.statusText);
    console.log('Time:', elapsed, 'ms');
    
    const text = await response.text();
    try {
      const json = JSON.parse(text);
      console.log('Response:', JSON.stringify(json, null, 2));
    } catch {
      console.log('Response (raw):', text.slice(0, 500));
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Get validationResultId from command line
const validationResultId = parseInt(process.argv[2]);
if (!validationResultId) {
  console.log('Usage: node test-revalidate.js <validationResultId>');
  console.log('Get a result ID from validation_results table');
  process.exit(1);
}
testRevalidate(validationResultId);
