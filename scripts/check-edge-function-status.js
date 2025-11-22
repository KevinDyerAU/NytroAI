/**
 * Check if edge functions are using new validation_results table
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://dfqxmjmggokneiuljkta.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmcXhtam1nZ29rbmVpdWxqa3RhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTYwODQ2MiwiZXhwIjoyMDc3MTg0NDYyfQ.1GoQ-Q90MI5pS-RRUxLayIBfz_fkCr2eAK1TycwzqGY';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

console.log('\n🔍 Checking Edge Function Deployment Status...\n');

async function checkDeploymentStatus() {
  try {
    // Check if validation_results table has recent records
    const { data: newRecords, error: newError } = await supabase
      .from('validation_results')
      .select('id, created_at, validation_method')
      .order('created_at', { ascending: false })
      .limit(5);

    console.log('📊 New Schema (validation_results table):');
    if (newError) {
      console.log('   ❌ Error:', newError.message);
    } else if (!newRecords || newRecords.length === 0) {
      console.log('   ⚠️  Table exists but no records yet');
      console.log('   💡 This means edge functions have NOT been deployed yet');
    } else {
      console.log(`   ✅ Found ${newRecords.length} recent records`);
      console.log(`   📅 Latest record: ${newRecords[0].created_at}`);
      console.log(`   🔧 Validation method: ${newRecords[0].validation_method || 'N/A'}`);
      
      // Check if recent (within last 24 hours)
      const latestDate = new Date(newRecords[0].created_at);
      const now = new Date();
      const hoursSinceLatest = (now - latestDate) / (1000 * 60 * 60);
      
      if (hoursSinceLatest < 24) {
        console.log('   ✅ Edge functions ARE using new schema (records from last 24h)');
      } else {
        console.log(`   ⚠️  Latest record is ${Math.round(hoursSinceLatest)}h old`);
        console.log('   💡 Edge functions may need deployment');
      }
    }

    // Check old tables for comparison
    console.log('\n📊 Old Schema (knowledge_evidence_validations table):');
    const { data: oldRecords, error: oldError } = await supabase
      .from('knowledge_evidence_validations')
      .select('id, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    if (oldError) {
      console.log('   ❌ Error:', oldError.message);
    } else if (!oldRecords || oldRecords.length === 0) {
      console.log('   ℹ️  No records in old table');
    } else {
      console.log(`   ℹ️  Found ${oldRecords.length} records`);
      console.log(`   📅 Latest record: ${oldRecords[0].created_at}`);
      
      const oldLatestDate = new Date(oldRecords[0].created_at);
      const newLatestDate = newRecords && newRecords[0] ? new Date(newRecords[0].created_at) : new Date(0);
      
      if (oldLatestDate > newLatestDate) {
        console.log('   ⚠️  Old table has MORE RECENT records than new table!');
        console.log('   💡 This confirms edge functions are STILL USING OLD SCHEMA');
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('📋 SUMMARY');
    console.log('='.repeat(80));
    
    if (!newRecords || newRecords.length === 0) {
      console.log('❌ STATUS: Edge functions NOT deployed yet');
      console.log('\n💡 ACTION REQUIRED:');
      console.log('   1. Install Supabase CLI');
      console.log('   2. Deploy edge functions');
      console.log('   3. Run a test validation');
    } else {
      const latestDate = new Date(newRecords[0].created_at);
      const now = new Date();
      const hoursSinceLatest = (now - latestDate) / (1000 * 60 * 60);
      
      if (hoursSinceLatest < 24) {
        console.log('✅ STATUS: Edge functions ARE using new schema');
        console.log('\n✅ ALL GOOD - No action required');
      } else {
        console.log('⚠️  STATUS: Unclear - no recent validation data');
        console.log('\n💡 RECOMMENDATION:');
        console.log('   Run a test validation to verify deployment');
      }
    }
    
    console.log('\n');

  } catch (error) {
    console.error('❌ Error checking deployment status:', error.message);
  }
}

checkDeploymentStatus();
