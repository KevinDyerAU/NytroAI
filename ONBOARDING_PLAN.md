# Nytro — Seamless Onboarding Plan

> Account Creation → Email Verification → Subscription Setup

---

## Phase 1 — Pre-fill Registration from Lead Data
**Effort:** ~1 hour | **Dependencies:** None

### Steps
1. Update the success page "Create Account" button to pass `lead_id` as a query param: `/register?lead_id=123`
2. In `RegisterForm`, fetch the `validation_leads` record using the `lead_id` param
3. Auto-populate name, email, and company fields from the lead data
4. After Supabase Auth signup completes, write the new `user_id` back to the `validation_leads` row to link the lead to the account

### Files to Change
- `src/pages/ValidationSuccessPage.tsx` — pass lead_id to register link
- `src/components/auth/RegisterForm.tsx` — fetch lead data, pre-fill fields, link user_id

---

## Phase 2 — Email Verification Flow
**Effort:** ~2 hours | **Dependencies:** Supabase email template config

### Steps
1. Configure a branded Nytro verification email in Supabase Dashboard → Authentication → Email Templates
2. Set the email confirmation redirect URL to a dedicated `/onboarding` page (not `/` which is the $99 landing page)
3. Create an `/onboarding` route and page component that:
   - Confirms email has been verified
   - Shows a welcome message
   - Immediately presents the subscription setup (Phase 3)

### Files to Create/Change
- `src/pages/OnboardingPage.tsx` — new page component
- `src/App.tsx` — add `/onboarding` route
- Supabase Dashboard — email template + redirect URL config

---

## Phase 3 — Stripe Subscription (Direct Debit / Monthly)
**Effort:** ~4-6 hours | **Dependencies:** Stripe product created, DB schema (Phase 4)

### Steps
1. Create a Stripe product + recurring monthly price in Stripe Dashboard (e.g. "Nytro Platform — $X/month")
2. Create a Supabase Edge Function `create-subscription-checkout` that:
   - Receives the authenticated user's ID
   - Creates or retrieves a Stripe Customer (stores `stripe_customer_id` on the user profile)
   - Creates a Stripe Checkout Session in `subscription` mode with the monthly price
   - Enables BECS Direct Debit + card as payment methods
   - Returns the checkout session URL
3. Create a subscription success page at `/subscription/success` that:
   - Confirms the subscription is active
   - Redirects the user to the dashboard
4. Create a Stripe webhook Edge Function `stripe-subscription-webhook` that:
   - Listens for `checkout.session.completed` and `customer.subscription.updated`
   - Updates the user's subscription status in the database
   - Handles `customer.subscription.deleted` for cancellations

### Files to Create/Change
- `supabase/functions/create-subscription-checkout/index.ts` — new edge function
- `supabase/functions/stripe-subscription-webhook/index.ts` — new edge function
- `src/pages/SubscriptionSuccessPage.tsx` — new page
- `src/pages/OnboardingPage.tsx` — add "Set up subscription" button that calls the edge function
- `src/App.tsx` — add `/subscription/success` route

---

## Phase 4 — Database Schema
**Effort:** ~30 min | **Dependencies:** None

### Steps
1. Add columns to the user profile table:
   - `stripe_customer_id` (text, nullable)
   - `subscription_status` (text, default `'none'`) — values: `none`, `active`, `past_due`, `cancelled`
   - `subscription_plan` (text, nullable)
   - `subscription_current_period_end` (timestamptz, nullable)
2. Add `user_id` column to `validation_leads` table (uuid, nullable, FK to auth.users)
3. Add RLS policies so users can only read/update their own subscription data

### Migration
```sql
-- Add subscription fields to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS subscription_plan text,
  ADD COLUMN IF NOT EXISTS subscription_current_period_end timestamptz;

-- Link leads to user accounts
ALTER TABLE validation_leads
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

-- RLS: users can read their own profile subscription data
CREATE POLICY "Users can read own subscription"
  ON profiles FOR SELECT
  USING (auth.uid() = id);
```

---

## Phase 5 — Guard Rails & Dashboard Gating
**Effort:** ~2 hours | **Dependencies:** Phase 3 complete

### Steps
1. Create a `useSubscription` hook that reads the user's subscription status from their profile
2. In the dashboard, check subscription status:
   - If `active` → show full dashboard
   - If `none` or `cancelled` → show a "Set up your subscription" prompt with CTA
   - If `past_due` → show a warning banner with link to update payment
3. Optional: Add a grace/trial period (e.g. 14 days free access after signup)
4. Handle Stripe cancellation webhook → update status → show appropriate messaging

### Files to Create/Change
- `src/hooks/useSubscription.ts` — new hook
- `src/components/SubscriptionGate.tsx` — new wrapper component
- `src/pages/dashboard.tsx` — wrap content with SubscriptionGate

---

## Suggested Build Order

| Order | Phase | Effort | Notes |
|-------|-------|--------|-------|
| 1     | Phase 4 (DB schema) | 30 min | No dependencies, do first |
| 2     | Phase 1 (pre-fill registration) | 1 hour | Immediate UX win |
| 3     | Phase 2 (email verification) | 2 hours | Requires Supabase config |
| 4     | Phase 3 (Stripe subscription) | 4-6 hours | Core payment flow |
| 5     | Phase 5 (guard rails) | 2 hours | Polish & protection |

**Total estimate: ~1-2 days of dev work**

---

## Decisions Required Before Starting

- [ ] **Monthly subscription price** — What amount per month?
- [ ] **Payment methods** — BECS Direct Debit only, or card + direct debit?
- [ ] **Trial period** — Free trial days before requiring subscription? (e.g. 14 days)
- [ ] **What's gated** — Entire dashboard requires subscription, or only specific features?
- [ ] **Stripe account** — Confirm Stripe account is set up for Australian BECS payments
