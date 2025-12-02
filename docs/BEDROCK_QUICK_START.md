# Bedrock Migration Quick Start Guide

**Date:** December 2, 2025  
**Estimated Time:** 4-6 hours for initial setup  
**Difficulty:** Intermediate

## Overview

This quick start guide provides a streamlined path to get Amazon Bedrock running in parallel with your existing Gemini setup. Follow these steps in order for a smooth migration.

---

## Prerequisites

- [ ] AWS account with access to Bedrock in Sydney region (ap-southeast-2)
- [ ] Supabase project with Postgres database
- [ ] n8n instance (self-hosted or cloud)
- [ ] Access to your NytroAI repository

---

## Phase 1: AWS Setup (30 minutes)

### Step 1.1: Create IAM User for Bedrock

1. Log in to AWS Console
2. Navigate to IAM → Users → Create User
3. User name: `nytroai-bedrock`
4. Attach policies:
   - `AmazonBedrockFullAccess`
   - Create custom policy for Titan Embeddings:
     ```json
     {
       "Version": "2012-10-17",
       "Statement": [
         {
           "Effect": "Allow",
           "Action": [
             "bedrock:InvokeModel",
             "bedrock:InvokeModelWithResponseStream"
           ],
           "Resource": [
             "arn:aws:bedrock:ap-southeast-2::foundation-model/anthropic.claude-3-5-sonnet-20250219-v1:0",
             "arn:aws:bedrock:ap-southeast-2::foundation-model/amazon.titan-embed-text-v1"
           ]
         }
       ]
     }
     ```
5. Create access key → Save `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`

### Step 1.2: Enable Bedrock Models

1. Navigate to Bedrock → Model Access
2. Request access to:
   - **Claude 3.5 Sonnet** (anthropic.claude-3-5-sonnet-20250219-v1:0)
   - **Titan Embeddings** (amazon.titan-embed-text-v1)
3. Wait for approval (usually instant)

### Step 1.3: Verify Data Residency

1. Contact AWS Support or your account manager
2. Ask: "Does Amazon Bedrock in ap-southeast-2 (Sydney) keep all data and model inference within Australia?"
3. Request written confirmation for compliance purposes

---

## Phase 2: Database Setup (30 minutes)

### Step 2.1: Enable pgvector Extension

1. Log in to Supabase Dashboard
2. Navigate to Database → Extensions
3. Search for "vector"
4. Enable `pgvector` extension

### Step 2.2: Apply Database Migration

1. Download the migration script:
   ```bash
   cd /home/ubuntu/NytroAI
   cat supabase/migrations/20251202_bedrock_setup.sql
   ```

2. Apply the migration:
   ```bash
   psql $DATABASE_URL -f supabase/migrations/20251202_bedrock_setup.sql
   ```

3. Verify the migration:
   ```sql
   -- Check if pgvector is enabled
   SELECT * FROM pg_extension WHERE extname = 'vector';
   
   -- Check if document_chunks table exists
   SELECT * FROM information_schema.tables WHERE table_name = 'document_chunks';
   
   -- Check if match_document_chunks function exists
   SELECT * FROM pg_proc WHERE proname = 'match_document_chunks';
   ```

### Step 2.3: Test Vector Search

1. Insert a test chunk:
   ```sql
   INSERT INTO document_chunks (document_id, validation_detail_id, chunk_text, chunk_index, embedding)
   VALUES (1, 1, 'Test chunk', 0, array_fill(0.1, ARRAY[1536])::vector);
   ```

2. Test similarity search:
   ```sql
   SELECT * FROM match_document_chunks(
     array_fill(0.1, ARRAY[1536])::vector,
     0.5,
     5,
     1
   );
   ```

3. Clean up:
   ```sql
   DELETE FROM document_chunks WHERE chunk_text = 'Test chunk';
   ```

---

## Phase 3: n8n Configuration (1 hour)

### Step 3.1: Add AWS Credentials to n8n

1. Open n8n
2. Navigate to Settings → Credentials → New Credential
3. Select "AWS" credential type
4. Enter:
   - **Access Key ID:** Your `AWS_ACCESS_KEY_ID`
   - **Secret Access Key:** Your `AWS_SECRET_ACCESS_KEY`
   - **Region:** `ap-southeast-2`
5. Test the connection
6. Save as "AWS Bedrock"

### Step 3.2: Update Environment Variables

Add these to your n8n environment (`.env` file or environment settings):

```bash
# AWS Credentials (if not using n8n credentials)
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here
AWS_REGION=ap-southeast-2

# Bedrock Model IDs
BEDROCK_CLAUDE_MODEL_ID=anthropic.claude-3-5-sonnet-20250219-v1:0
BEDROCK_EMBEDDING_MODEL_ID=amazon.titan-embed-text-v1

# Feature Flags
DEFAULT_AI_PROVIDER=gemini
ENABLE_BEDROCK=true
```

Restart n8n to apply the changes.

### Step 3.3: Install Required npm Packages

If you're self-hosting n8n, install these packages:

```bash
npm install pdf-parse
npm install @aws-sdk/client-bedrock-runtime
```

---

## Phase 4: Build Bedrock Workflow (2-3 hours)

### Step 4.1: Duplicate Existing Workflow

1. Open your existing "AI Validation Flow - Enhanced" workflow
2. Save a copy as "AI Validation Flow - Bedrock Test"
3. This gives you a working baseline to modify

### Step 4.2: Add Router Node

1. After the "Fetch Validation Context" node, add a **Switch** node
2. Name it "Route by AI Provider"
3. Configure the rules (see template in `n8n-flows/AIValidationFlow_Bedrock_Template.md`)
4. Connect:
   - Output 0 → New Bedrock flow (to be built)
   - Output 1 → Existing Gemini flow
   - Fallback → Existing Gemini flow

### Step 4.3: Build Bedrock Flow

Follow the detailed node-by-node instructions in:
- `docs/BEDROCK_PARALLEL_OPERATION_STRATEGY.md`
- `n8n-flows/AIValidationFlow_Bedrock_Template.md`

**Key nodes to build:**
1. Fetch Documents (Bedrock)
2. Check Chunking Status
3. Extract & Chunk Documents (if needed)
4. Generate Embeddings
5. Store Chunks in pgvector
6. Fetch Requirements
7. Loop Through Requirements
8. Generate Query Embedding
9. Retrieve Relevant Chunks
10. Build Prompt
11. Call Bedrock API
12. Parse Response
13. Save Results

### Step 4.4: Test Individual Nodes

Test each node independently before connecting the full flow:

1. **Test Bedrock Titan Embeddings:**
   - Create a standalone HTTP Request node
   - Call Titan Embeddings with a sample text
   - Verify you get a 1536-dimensional vector

2. **Test Claude 3.5 Sonnet:**
   - Create a standalone HTTP Request node
   - Send a simple prompt to Claude
   - Verify you get a valid response

3. **Test pgvector Storage:**
   - Manually insert a chunk with an embedding
   - Query it back using `match_document_chunks`

---

## Phase 5: Testing (1-2 hours)

### Step 5.1: Create Test Validation

1. In your application, create a new validation
2. Manually set `ai_provider = 'bedrock'` in the database:
   ```sql
   UPDATE validation_detail 
   SET ai_provider = 'bedrock' 
   WHERE id = YOUR_TEST_VALIDATION_ID;
   ```

### Step 5.2: Run End-to-End Test

1. Trigger the validation from your application
2. Monitor the n8n workflow execution
3. Check for errors in each node
4. Verify the results are saved correctly

### Step 5.3: Compare with Gemini

1. Create an identical validation using Gemini
2. Compare the results:
   - Status (Met/Partially Met/Not Met)
   - Reasoning quality
   - Citation accuracy
   - Smart questions

### Step 5.4: Performance Testing

1. Measure the time taken for each phase:
   - Document chunking and embedding: Should be <2 minutes
   - Validation (50 requirements): Should be <5 minutes
   - Total: Should be <7 minutes for first run, <5 minutes for subsequent runs

2. Check costs:
   - Embedding: ~$0.0001 per 1000 tokens
   - Claude 3.5 Sonnet: ~$0.003 per 1000 input tokens, ~$0.015 per 1000 output tokens
   - Total per validation: Should be <$0.05

---

## Phase 6: Gradual Rollout (Ongoing)

### Week 1: 10% Traffic

1. Update your application to set `ai_provider = 'bedrock'` for 10% of new validations
2. Monitor for issues
3. Collect user feedback

### Week 2: 25% Traffic

1. Increase to 25%
2. Continue monitoring

### Week 3: 50% Traffic

1. Increase to 50%
2. Compare costs and performance

### Week 4: 75% Traffic

1. Increase to 75%
2. Prepare for full migration

### Week 5: 100% Traffic

1. Set `DEFAULT_AI_PROVIDER = 'bedrock'`
2. All new validations now use Bedrock
3. Keep Gemini as fallback for 1 week

### Week 6+: Deprecation

1. Remove Gemini flow from n8n
2. Archive Gemini credentials
3. Celebrate the successful migration! 🎉

---

## Troubleshooting

### Issue: pgvector extension not available

**Solution:** Ensure you're on a Supabase plan that supports extensions. Contact Supabase support if needed.

### Issue: AWS credentials not working

**Solution:** 
1. Verify the access key and secret key are correct
2. Check that the IAM user has the required permissions
3. Ensure the region is set to `ap-southeast-2`

### Issue: Bedrock model not available

**Solution:** 
1. Check that you've requested access to the models in the Bedrock console
2. Verify you're using the correct model IDs
3. Ensure you're in the Sydney region (ap-southeast-2)

### Issue: Document chunking is slow

**Solution:**
1. Consider using a more efficient PDF parsing library
2. Batch embedding generation for multiple chunks
3. Use a faster embedding model (e.g., Cohere Embed)

### Issue: Vector search returns no results

**Solution:**
1. Check that chunks are being stored with embeddings
2. Verify the similarity threshold (try lowering it to 0.5)
3. Ensure you're using the correct embedding model for both indexing and querying

### Issue: Bedrock API rate limits

**Solution:**
1. Add retry logic with exponential backoff
2. Consider batching requests
3. Contact AWS to increase your rate limits

---

## Success Criteria

- [ ] pgvector enabled and working
- [ ] AWS credentials configured
- [ ] Bedrock flow runs end-to-end
- [ ] Validation results match Gemini quality
- [ ] Cost per validation <$0.05
- [ ] Validation time <5 minutes
- [ ] No major errors or issues

---

## Rollback Plan

If you encounter issues:

1. **Immediate rollback:**
   ```sql
   UPDATE validation_detail SET ai_provider = 'gemini' WHERE ai_provider = 'bedrock';
   ```

2. **Disable Bedrock in n8n:**
   - Set `ENABLE_BEDROCK=false`
   - Restart n8n

3. **Full rollback (if needed):**
   - Remove Bedrock flow from n8n
   - Keep database tables (no harm in leaving them)

---

## Next Steps

1. Complete Phase 1-5 setup and testing
2. Begin gradual rollout (Phase 6)
3. Monitor performance and costs
4. Iterate and optimize

**Estimated total time:** 4-6 hours for initial setup, then 5-6 weeks for gradual rollout.

**Good luck with your migration! You're making a great choice for cost savings and data sovereignty.**
