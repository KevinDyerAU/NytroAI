# Phase 2 Testing Checklist

## Pre-Migration Testing

### Database Backup
- [ ] Create full database backup before migration
- [ ] Verify backup can be restored
- [ ] Document backup location and timestamp

### Environment Setup
- [ ] Set up test/staging database
- [ ] Copy production data to test database
- [ ] Verify test environment matches production

## Migration Testing

### Schema Creation
- [ ] Run `20250122_create_validation_results_v2.sql` on test database
- [ ] Verify table `validation_results` exists
- [ ] Verify all indexes are created
- [ ] Verify RLS policies are enabled
- [ ] Verify triggers are created
- [ ] Verify legacy view `validation_results_legacy` exists

### Data Migration
- [ ] Run `20250122_migrate_validation_data_v2.sql` on test database
- [ ] Review migration summary output
- [ ] Verify record counts match (old tables vs new table)
- [ ] Spot-check 10-20 random records for data accuracy
- [ ] Verify JSONB `smart_questions` format is correct
- [ ] Verify `requirement_type` values are correct ('ke', 'pe', 'fs', 'epc', 'ac', 'learner')
- [ ] Verify status values are lowercase ('met', 'not-met', 'partial', 'pending')

### Data Integrity
- [ ] Check for NULL values in required fields
- [ ] Verify foreign key relationships are intact
- [ ] Verify timestamps are preserved from old tables
- [ ] Check for duplicate records
- [ ] Verify all requirement types are represented

## Functional Testing

### Shared Utilities
- [ ] Test `insertValidationResult()` function
- [ ] Test `insertValidationResults()` bulk insert
- [ ] Test `getValidationResults()` retrieval
- [ ] Test `getValidationResultsByType()` filtering
- [ ] Test `updateValidationResult()` updates
- [ ] Test `addSmartQuestions()` JSONB updates
- [ ] Test `getValidationSummary()` statistics
- [ ] Test `deleteValidationResults()` deletion

### Edge Functions
- [ ] Test validate-assessment-v2 with Knowledge Evidence
- [ ] Test validate-assessment-v2 with Performance Evidence
- [ ] Test validate-assessment-v2 with Foundation Skills
- [ ] Test validate-assessment-v2 with Elements & Performance Criteria
- [ ] Test validate-assessment-v2 with Assessment Conditions
- [ ] Verify validation results are inserted correctly
- [ ] Verify error handling works properly
- [ ] Verify timeout handling works

### Frontend Integration
- [ ] Update `useValidationProgress` hook to query new table
- [ ] Test validation results display
- [ ] Test filtering by requirement type
- [ ] Test status updates
- [ ] Test real-time subscriptions
- [ ] Verify error messages display correctly

## Performance Testing

### Query Performance
- [ ] Test SELECT performance on validation_results
- [ ] Compare query speed: old tables vs new table
- [ ] Test queries with large datasets (1000+ records)
- [ ] Verify indexes are being used (EXPLAIN ANALYZE)
- [ ] Test concurrent queries

### Insert Performance
- [ ] Test single insert performance
- [ ] Test bulk insert performance (50+ records)
- [ ] Compare insert speed: old tables vs new table
- [ ] Test concurrent inserts

## Naming Convention Verification

### Column Names
- [ ] All columns use snake_case (no camelCase)
- [ ] Foreign keys end with `_id`
- [ ] Timestamps end with `_at`
- [ ] JSONB arrays use plural names
- [ ] No abbreviated names (except standard abbreviations)

### Data Consistency
- [ ] `validation_detail_id` matches old `valDetail_id`
- [ ] `requirement_id` matches old `requirementId`
- [ ] `requirement_number` contains correct values for all types
- [ ] `requirement_text` contains correct text for all types
- [ ] `mapped_content` contains correct content
- [ ] `unmapped_content` contains correct content
- [ ] `recommendations` contains correct recommendations
- [ ] `doc_references` contains correct references

## Backward Compatibility Testing

### Legacy View
- [ ] Test SELECT from `validation_results_legacy`
- [ ] Verify column names match old format (camelCase)
- [ ] Test existing queries against legacy view
- [ ] Verify results match old table queries

## Error Handling Testing

### Edge Function Errors
- [ ] Test with missing required fields
- [ ] Test with invalid validation_detail_id
- [ ] Test with invalid requirement_type
- [ ] Test with database connection failure
- [ ] Test with timeout scenarios
- [ ] Verify error responses follow standard format

### Database Errors
- [ ] Test foreign key constraint violations
- [ ] Test CHECK constraint violations
- [ ] Test RLS policy enforcement
- [ ] Test trigger failures

## Security Testing

### RLS Policies
- [ ] Test authenticated user can SELECT
- [ ] Test authenticated user can INSERT
- [ ] Test authenticated user can UPDATE
- [ ] Test service role has full access
- [ ] Test unauthenticated user is blocked

## Documentation Review

- [ ] Review NAMING_CONVENTIONS.md for accuracy
- [ ] Review PHASE2_SCHEMA_CONSOLIDATION.md for completeness
- [ ] Verify migration scripts have comments
- [ ] Verify shared utilities have JSDoc comments
- [ ] Update API documentation if needed

## Rollback Testing

### Rollback Procedure
- [ ] Document rollback steps
- [ ] Test restoring from backup
- [ ] Verify application works with restored database
- [ ] Time the rollback process

## Production Readiness

### Pre-Production Checklist
- [ ] All tests passing
- [ ] Performance acceptable
- [ ] Error handling verified
- [ ] Documentation complete
- [ ] Rollback plan tested
- [ ] Team trained on new schema
- [ ] Monitoring alerts configured

### Deployment Plan
- [ ] Schedule maintenance window
- [ ] Notify users of downtime
- [ ] Prepare rollback plan
- [ ] Assign roles and responsibilities
- [ ] Plan post-deployment verification

## Post-Migration Verification

### Immediate Checks (Within 1 hour)
- [ ] Verify application is accessible
- [ ] Test critical user flows
- [ ] Check error logs for issues
- [ ] Verify data is being written correctly
- [ ] Monitor database performance

### Short-term Checks (Within 24 hours)
- [ ] Review all error logs
- [ ] Check validation success rates
- [ ] Monitor query performance
- [ ] Gather user feedback
- [ ] Verify no data loss

### Long-term Checks (Within 1 week)
- [ ] Analyze performance trends
- [ ] Review user feedback
- [ ] Identify optimization opportunities
- [ ] Plan for dropping old tables (if applicable)

## Sign-off

- [ ] Database Administrator approval
- [ ] Backend Developer approval
- [ ] Frontend Developer approval
- [ ] QA Team approval
- [ ] Product Owner approval

## Notes

Use this space to document any issues found during testing:

```
Issue 1: [Description]
Resolution: [How it was fixed]

Issue 2: [Description]
Resolution: [How it was fixed]
```

## Test Results Summary

**Date Tested:** _______________
**Tested By:** _______________
**Environment:** _______________
**Result:** ☐ PASS ☐ FAIL ☐ PARTIAL

**Comments:**
```
[Add any additional comments here]
```
