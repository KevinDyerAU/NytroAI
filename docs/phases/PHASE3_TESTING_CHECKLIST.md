# Phase 3 Testing Checklist

## Edge Function Testing

### validate-assessment Function
- [ ] Test Knowledge Evidence validation
  - [ ] Verify results are stored in `validation_results` table
  - [ ] Check `requirement_type` is 'ke'
  - [ ] Verify `requirement_number` and `requirement_text` are populated
  - [ ] Check status mapping (pass → met, fail → not-met)

- [ ] Test Performance Evidence validation
  - [ ] Verify results are stored correctly
  - [ ] Check `requirement_type` is 'pe'
  - [ ] Verify all fields are populated

- [ ] Test Foundation Skills validation
  - [ ] Verify results are stored correctly
  - [ ] Check `requirement_type` is 'fs'

- [ ] Test Elements & Performance Criteria validation
  - [ ] Verify results are stored correctly
  - [ ] Check `requirement_type` is 'epc'
  - [ ] Verify `requirement_number` format (e.g., "1.1")

- [ ] Test Assessment Conditions validation
  - [ ] Verify results are stored correctly
  - [ ] Check `requirement_type` is 'ac'

- [ ] Test Full Validation
  - [ ] Verify all requirement types are validated
  - [ ] Check all results are stored in single table

- [ ] Test Learner Guide Validation
  - [ ] Verify results are stored correctly
  - [ ] Check `requirement_type` is 'learner'
  - [ ] Verify metadata includes `is_learner_guide: true`

### Error Handling
- [ ] Test with missing `validation_detail_id`
  - [ ] Verify error response format
  - [ ] Check error code is 'VALIDATION_ERROR'

- [ ] Test with invalid `document_id`
  - [ ] Verify error response format
  - [ ] Check error code is 'NOT_FOUND'

- [ ] Test with database connection failure
  - [ ] Verify error response format
  - [ ] Check error code is 'DATABASE_ERROR'

- [ ] Test with timeout scenario
  - [ ] Verify timeout handling works
  - [ ] Check error code is 'TIMEOUT_ERROR'

## Frontend Hook Testing

### useValidationProgress_v2 Hook
- [ ] Test data fetching
  - [ ] Hook fetches from `validation_results` table
  - [ ] Data structure matches expected format
  - [ ] All requirement types are fetched

- [ ] Test status normalization
  - [ ] 'met' status displays correctly
  - [ ] 'not-met' status displays correctly
  - [ ] 'partial' status displays correctly
  - [ ] Invalid statuses default to 'partial'

- [ ] Test smart questions parsing
  - [ ] JSONB array is parsed correctly
  - [ ] Question and answer are extracted
  - [ ] Empty array returns empty strings

- [ ] Test document references parsing
  - [ ] JSON string is parsed correctly
  - [ ] Array format is handled
  - [ ] String format is handled
  - [ ] Invalid JSON returns original string

- [ ] Test type name mapping
  - [ ] 'ke' → 'Knowledge Evidence'
  - [ ] 'pe' → 'Performance Evidence'
  - [ ] 'fs' → 'Foundation Skills'
  - [ ] 'epc' → 'Elements & Performance Criteria'
  - [ ] 'ac' → 'Assessment Conditions'
  - [ ] 'learner' → 'Learner Guide'

- [ ] Test real-time subscriptions
  - [ ] Hook subscribes to `validation_results` table
  - [ ] Updates are received when data changes
  - [ ] Subscription is cleaned up on unmount

- [ ] Test loading states
  - [ ] `isLoading` is true initially
  - [ ] `isLoading` is false after data loads
  - [ ] Loading state persists during fetch

- [ ] Test error handling
  - [ ] Error is set when fetch fails
  - [ ] Error message is descriptive
  - [ ] Error is cleared on retry

## UI Component Testing

### ErrorBoundary Component
- [ ] Catches errors in child components
- [ ] Displays error message
- [ ] Shows "Try Again" button
- [ ] Shows "Reload Page" button
- [ ] Resets error state on "Try Again"
- [ ] Reloads page on "Reload Page"
- [ ] Shows error details in development mode
- [ ] Hides error details in production

### ErrorDisplay Component
- [ ] Displays network errors correctly
  - [ ] Shows WiFi icon
  - [ ] Shows helpful message
  - [ ] Shows retry button

- [ ] Displays database errors correctly
  - [ ] Shows database icon
  - [ ] Shows helpful message

- [ ] Displays timeout errors correctly
  - [ ] Shows clock icon
  - [ ] Shows helpful message

- [ ] Displays validation errors correctly
  - [ ] Shows alert icon
  - [ ] Shows error message

- [ ] Retry functionality works
  - [ ] Retry button calls `onRetry` callback
  - [ ] Loading state during retry

- [ ] Error categorization works
  - [ ] Network errors are categorized correctly
  - [ ] Database errors are categorized correctly
  - [ ] Timeout errors are categorized correctly
  - [ ] Validation errors are categorized correctly

### LoadingState Component
- [ ] Displays loading spinner
- [ ] Shows loading message
- [ ] Shows progress bar (if timeout set)
- [ ] Shows elapsed time
- [ ] Shows timeout warning
- [ ] Calls `onTimeout` callback when timeout reached

### LoadingSpinner Component
- [ ] Small size works
- [ ] Medium size works
- [ ] Large size works
- [ ] Custom className works

### LoadingOverlay Component
- [ ] Shows overlay when `show` is true
- [ ] Hides overlay when `show` is false
- [ ] Displays loading message
- [ ] Backdrop blur works

## Integration Testing

### End-to-End Validation Flow
- [ ] Upload document
- [ ] Trigger validation
- [ ] Validation results appear in UI
- [ ] All requirement types display correctly
- [ ] Status badges show correct colors
- [ ] Smart questions display correctly
- [ ] Document references display correctly
- [ ] Real-time updates work

### Error Recovery Flow
- [ ] Network error occurs
- [ ] Error is displayed to user
- [ ] User clicks retry
- [ ] Operation succeeds on retry
- [ ] Error is cleared

### Loading State Flow
- [ ] Operation starts
- [ ] Loading state displays
- [ ] Progress indicator shows (if applicable)
- [ ] Operation completes
- [ ] Loading state clears
- [ ] Results display

## Performance Testing

### Query Performance
- [ ] Single validation detail query < 100ms
- [ ] Validation results query < 200ms
- [ ] Real-time subscription latency < 500ms

### UI Responsiveness
- [ ] No UI freezing during data fetch
- [ ] Smooth transitions between states
- [ ] No memory leaks from subscriptions

## Browser Compatibility

- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile Chrome
- [ ] Mobile Safari

## Accessibility Testing

- [ ] Error messages are announced by screen readers
- [ ] Loading states are announced
- [ ] Retry buttons are keyboard accessible
- [ ] Focus management works correctly

## Regression Testing

- [ ] Existing validation flows still work
- [ ] Dashboard displays correctly
- [ ] Reports generate correctly
- [ ] User authentication works
- [ ] File upload works

## Sign-off

- [ ] All edge function tests passing
- [ ] All frontend hook tests passing
- [ ] All UI component tests passing
- [ ] All integration tests passing
- [ ] Performance acceptable
- [ ] No regressions found

**Tested By:** _______________
**Date:** _______________
**Result:** ☐ PASS ☐ FAIL ☐ PARTIAL

**Notes:**
```
[Add any issues or observations here]
```
