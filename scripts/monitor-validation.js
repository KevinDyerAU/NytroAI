/**
 * Monitor a validation in real-time to check if it's using the new schema
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://dfqxmjmggokneiuljkta.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmcXhtam1nZ29rbmVpdWxqa3RhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTYwODQ2MiwiZXhwIjoyMDc3MTg0NDYyfQ.1GoQ-Q90MI5pS-RRUxLayIBfz_fkCr2eAK1TycwzqGY';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

console.log('\n📊 Real-time Validation Monitor');
console.log('Watching for new validation results...\n');
console.log('💡 Trigger a validation in the UI, and this will show the results.\n');

let recordCount = 0;
const startTime = Date.now();

// Subscribe to new validation results
const subscription = supabase
  .channel('validation_monitor')
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'validation_results',
    },
    (payload) => {
      recordCount++;
      const record = payload.new;
      
      console.log(`\n✅ New Record #${recordCount} Detected!`);
      console.log('━'.repeat(80));
      console.log(`📋 ID: ${record.id}`);
      console.log(`📝 Type: ${record.requirement_type} (${getTypeName(record.requirement_type)})`);
      console.log(`📊 Status: ${record.status}`);
      console.log(`🔧 Validation Method: ${record.validation_method || 'N/A'}`);
      console.log(`🎯 Requirement: ${record.requirement_number || 'N/A'}`);
      console.log(`📅 Created: ${new Date(record.created_at).toLocaleString()}`);
      
      // Check for smart questions
      if (record.smart_questions && Array.isArray(record.smart_questions)) {
        console.log(`❓ Smart Questions: ${record.smart_questions.length}`);
      }
      
      // Check metadata
      if (record.metadata && Object.keys(record.metadata).length > 0) {
        console.log(`📦 Metadata: ${JSON.stringify(record.metadata).substring(0, 100)}...`);
      }
      
      console.log('━'.repeat(80));
      
      // Show summary every 10 records
      if (recordCount % 10 === 0) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`\n📊 Progress: ${recordCount} records in ${elapsed}s\n`);
      }
    }
  )
  .subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      console.log('✅ Connected! Monitoring for new validation results...');
      console.log('⏳ Waiting for validation to start...\n');
    }
  });

function getTypeName(type) {
  const typeMap = {
    ke: 'Knowledge Evidence',
    pe: 'Performance Evidence',
    fs: 'Foundation Skills',
    epc: 'Elements & Performance Criteria',
    ac: 'Assessment Conditions',
    ai: 'Assessment Instructions',
    learner: 'Learner Guide',
  };
  return typeMap[type] || type;
}

// Handle exit gracefully
process.on('SIGINT', () => {
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('\n\n━'.repeat(80));
  console.log('📊 FINAL SUMMARY');
  console.log('━'.repeat(80));
  console.log(`✅ Total Records Captured: ${recordCount}`);
  console.log(`⏱️  Total Time: ${elapsed}s`);
  if (recordCount > 0) {
    console.log(`📈 Rate: ${(recordCount / (elapsed / 60)).toFixed(1)} records/minute`);
    console.log('\n✅ Validation is using NEW schema!');
  } else {
    console.log('\n⚠️  No records captured - validation may not have started');
  }
  console.log('━'.repeat(80) + '\n');
  
  subscription.unsubscribe();
  process.exit(0);
});

// Keep the script running
console.log('Press Ctrl+C to stop monitoring\n');
