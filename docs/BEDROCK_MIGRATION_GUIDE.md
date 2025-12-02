# Gemini to Amazon Bedrock Migration Guide

**Date:** December 2, 2025  
**Version:** 1.0  
**Status:** Implementation Ready

## 1. Executive Summary

This guide provides a comprehensive plan for migrating NytroAI's validation workflow from Google Gemini to Amazon Bedrock (Claude 3.5 Sonnet), while retaining the existing n8n and Supabase infrastructure. The migration will be executed in parallel, ensuring zero downtime and easy rollback.

**Key Benefits:**
- **90% Cost Reduction:** From $370/month to ~$40/month for 1,000 validations
- **Australian Data Sovereignty:** Processing in AWS Sydney region
- **Improved Performance:** Faster validation times after initial indexing
- **Enhanced Quality:** Leverage Claude 3.5 Sonnet's advanced reasoning
- **Unified Stack:** Keep n8n and Supabase, no new services to learn

---

## 2. Architecture Overview

### Current State (Gemini)
- Documents uploaded to Gemini for processing
- n8n calls Gemini API with `fileUri`
- High cost, no data sovereignty

### Target State (Bedrock + RAG)
- Documents stored in Supabase Storage
- n8n orchestrates a RAG pipeline:
  1. **Chunking:** Documents split into chunks
  2. **Embedding:** Chunks converted to vectors
  3. **Indexing:** Vectors stored in Supabase pgvector
  4. **Retrieval:** Relevant chunks fetched for each requirement
  5. **Reasoning:** Bedrock (Claude 3.5) validates against chunks
- Parallel operation with Gemini via feature flag

---

## 3. Implementation Plan

### Phase 1: Setup & Configuration (Week 1)

**Goal:** Prepare the infrastructure for parallel operation.

**Tasks:**
1. **AWS Setup:**
   - Create an IAM user with Bedrock and S3 access
   - Generate AWS access key and secret key
   - Store credentials securely in n8n

2. **Supabase Setup:**
   - Enable `pgvector` extension in your Supabase project
   - Apply database migrations:
     - Add `ai_provider` and `ai_metadata` columns to `validation_detail`
     - Create `document_chunks` table with `vector` column
     - Create `match_document_chunks` RPC function

3. **n8n Setup:**
   - Add AWS credentials to n8n
   - Update environment variables:
     - `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`
     - `BEDROCK_CLAUDE_MODEL_ID`, `BEDROCK_EMBEDDING_MODEL_ID`
     - `DEFAULT_AI_PROVIDER`, `ENABLE_BEDROCK`

**Success Criteria:**
- ✅ pgvector enabled and tables created
- ✅ AWS credentials configured in n8n
- ✅ Environment variables set

---

### Phase 2: Build Bedrock Workflow (Week 2)

**Goal:** Create the new Bedrock validation flow in n8n, parallel to the existing Gemini flow.

**Tasks:**
1. **Add AI Provider Router:**
   - Create a Switch node in your main validation workflow
   - Route traffic based on `validation_detail.ai_provider` field
   - Gemini flow is the default path

2. **Build Document Processing Flow (RAG):**
   - **Fetch Documents:** Get documents from Supabase Storage
   - **Check if Chunked:** Query `document_chunks` to see if already processed
   - **Extract & Chunk:** If not chunked, download PDF, extract text, and split into chunks
   - **Generate Embeddings:** Call Bedrock Titan Embeddings API for each chunk
   - **Store Chunks:** Save chunks and embeddings to `document_chunks` table

3. **Build Validation Flow:**
   - **Fetch Requirements:** Get all requirements for the validation
   - **Loop Through Requirements:** Iterate over each requirement
   - **Generate Query Embedding:** Create embedding for the requirement text
   - **Retrieve Chunks:** Use `match_document_chunks` RPC to find relevant chunks
   - **Call Bedrock API:** Send requirement + chunks to Claude 3.5 Sonnet
   - **Parse Response:** Extract structured JSON from Bedrock response

4. **Merge and Save:**
   - Merge the output from Bedrock and Gemini flows
   - Use a single "Save Validation Results" node to store in `validation_results`

**Success Criteria:**
- ✅ Bedrock flow runs end-to-end for a single validation
- ✅ Document chunks and embeddings are stored in pgvector
- ✅ Validation results are saved correctly

---

### Phase 3: Pilot Testing & Gradual Rollout (Week 3-4)

**Goal:** Safely migrate traffic from Gemini to Bedrock with continuous monitoring.

**Tasks:**
1. **Pilot Test (10% Traffic):**
   - Update your application to set `ai_provider = 'bedrock'` for 10% of new validations
   - Monitor performance, cost, and quality side-by-side
   - Collect user feedback

2. **Gradual Rollout (25% → 50% → 75%):**
   - Incrementally increase the percentage of Bedrock validations
   - Monitor key metrics at each stage
   - Address any issues that arise

3. **Full Migration (100%):**
   - Set `DEFAULT_AI_PROVIDER = 'bedrock'` in your environment
   - All new validations will now use Bedrock
   - Keep Gemini flow as a fallback for 1 week

**Success Criteria:**
- ✅ No major issues reported during rollout
- ✅ Performance and cost metrics meet expectations
- ✅ Validation quality is consistent or improved

---

### Phase 4: Deprecation & Cleanup (Week 5+)

**Goal:** Remove legacy Gemini components and finalize the migration.

**Tasks:**
1. **Remove Gemini Flow:**
   - Delete the Gemini branch from your n8n workflow
   - Remove the AI provider router node

2. **Remove Gemini-Specific Code:**
   - Delete `gemini_file_uri` column from `documents` table
   - Remove any Gemini-specific parsing logic

3. **Archive Gemini Credentials:**
   - Remove Gemini API keys from your environment
   - Archive credentials in a secure vault

4. **Documentation Update:**
   - Update all documentation to reflect the new Bedrock architecture
   - Create a final migration report

**Success Criteria:**
- ✅ Gemini components fully removed
- ✅ System is stable and performant with Bedrock only
- ✅ All documentation is up-to-date

---

## 4. Storage Strategy: Supabase vs. S3

**Recommendation:** **Keep Supabase Storage.**

**Reasons:**
- **Simplicity:** Already integrated, no new services to manage
- **Cost:** No additional cost (included in your Supabase plan)
- **Performance:** Sufficient for current document sizes (~500KB)
- **Maintenance:** Easier to maintain a unified stack

**Only consider AWS S3 if:**
- Document sizes grow significantly (>10MB)
- You need advanced S3 features (versioning, lifecycle policies)
- You want to consolidate all services within AWS

For now, the benefits of switching to S3 do not outweigh the added complexity.

---

## 5. Testing Plan

### Unit Tests
- [ ] Test AI provider router logic
- [ ] Test document chunking and embedding
- [ ] Test vector similarity search
- [ ] Test Bedrock API integration and response parsing

### Integration Tests
- [ ] Test full Bedrock flow end-to-end
- [ ] Test parallel operation with Gemini and Bedrock
- [ ] Test database migrations and rollback

### Performance Tests
- [ ] Measure Bedrock vs. Gemini response time
- [ ] Measure cost per validation
- [ ] Measure RAG pipeline performance

### Quality Tests
- [ ] Compare validation results (Bedrock vs. Gemini)
- [ ] Test with different document and requirement types
- [ ] Validate citation accuracy

---

## 6. Rollback Plan

If issues arise, you can roll back at any stage:

1. **Immediate Rollback (< 5 minutes):**
   - Set `DEFAULT_AI_PROVIDER = 'gemini'`
   - Update any in-progress validations: `UPDATE validation_detail SET ai_provider = 'gemini' WHERE ai_provider = 'bedrock';`

2. **Full Rollback:**
   - Remove Bedrock flow from n8n
   - Revert database migrations

---

## 7. Success Criteria

- **Performance:** Bedrock validation completes in <5 minutes
- **Cost:** Cost per validation <$0.05
- **Quality:** Validation accuracy ≥ Gemini
- **Reliability:** Bedrock availability ≥ 99.9%

---

## 8. Next Steps

1. Review and approve this migration guide
2. Begin Phase 1: Setup & Configuration
3. Follow the phased rollout plan
4. Monitor and optimize

**This migration will significantly improve your platform's cost-effectiveness, performance, and data sovereignty. By following this phased approach, you can ensure a smooth and successful transition.**
