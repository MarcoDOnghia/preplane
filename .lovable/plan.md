

## Remaining Security & GDPR Fixes

### 1. `research-company` Edge Function — Missing rate limiting and injection checks
**File:** `supabase/functions/research-company/index.ts`
- No `check_and_increment_usage` call — unlimited Perplexity API calls per user
- No `containsInjection` check on company/role inputs
- **Fix:** Add rate limit (5/day) and injection pattern filtering, matching the pattern used in all other edge functions

### 2. GDPR Delete — Incomplete data erasure
**File:** `supabase/functions/gdpr-delete-account/index.ts`
- Does not clear `email_send_log` rows matching the user's email
- Does not clear `suppressed_emails` rows matching the user's email
- These tables are service_role-only, so the `adminClient` already has access
- **Fix:** Add deletion of both tables by matching `recipient_email` / `email` to the user's email address in the existing deletion flow

### 3. Privacy Policy — Missing AI processor disclosure
**File:** `src/pages/Privacy.tsx`
- The app calls Google Gemini models via `ai.gateway.lovable.dev` for CV tailoring, insights, keyword bullets, outreach, etc. — this is not disclosed
- **Fix:** Add "Google (Gemini AI)" as a listed third-party processor, noting it receives CV content and job descriptions for AI-powered suggestions

### Summary
| Item | Severity | Files changed |
|------|----------|---------------|
| Rate limit + injection on `research-company` | Low | 1 edge function |
| GDPR deletion completeness | Low | 1 edge function |
| Privacy Policy processor list | Low | 1 React component |

All three changes are isolated and won't affect existing functionality.

