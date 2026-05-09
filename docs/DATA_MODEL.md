# Data Model

## Current Inferred Data Model
The app uses a single-user ownership model. Most rows have `user_id` and are scoped by Supabase RLS or explicit function checks. There is no organization, team, or workspace model.

## Tables
- `profiles`: one profile per auth user. Stores onboarding state, name, country, currency, salary, employer, payroll email, pay frequency, deduction flags, anomaly threshold, sub-region, and filing status.
- `employers`: user-owned employer records with name and payroll email.
- `payslips`: uploaded payslip metadata, storage path, country, dates, employer link, and processing status.
- `payslip_extractions`: extracted gross/net/tax/deduction values, confidence, raw AI JSON, normalized JSON, and year-to-date JSON.
- `anomaly_results`: anomaly type, severity, confidence, status, title, description, and suggested action for a payslip.
- `issue_drafts`: draft payroll query subject/body/status tied to a user and optionally a payslip/employer.
- `user_notes`: user notes tied to payslips or anomalies.
- `billing_subscriptions`: legacy billing table.
- `subscriptions`: current Stripe subscription/payment entitlement table.
- `audit_events`: user-owned audit log rows.
- `rate_limits`: service-role-managed rate-limit counters for Edge Functions.

## Actual Schema Files
- Migrations: `supabase/migrations/*.sql`
- Generated Supabase types: `src/integrations/supabase/types.ts`
- Browser Supabase client: `src/integrations/supabase/client.ts`

## Mock And Demo Data
- Demo dashboard data: `src/lib/demo-data.ts`
- Anonymous demo extraction function: `supabase/functions/demo-extract-payslip/index.ts`
- Unused Lovable placeholder page: `src/pages/Index.tsx`

## Missing Or Incomplete Persistence
- No organization/workspace tables.
- No admin/support notes table.
- No durable job table for extraction retries/status history.
- No explicit file retention/deletion schedule beyond account deletion logic.
- No email delivery records because payroll drafts are copied/opened via mailto rather than sent.
- No analytics event table; analytics is currently a consent-aware no-op.

## User, Org, And Workspace Model
Current model: one Supabase auth user owns all data. Employers are user-owned records, not tenant entities. Multi-tenancy is not implemented and should not be implied in UI or docs.

## Row-Level Security And Security Assumptions
- User-owned tables generally enable RLS and use `auth.uid() = user_id`.
- Child tables like `payslip_extractions` and `anomaly_results` use policies through their parent payslip.
- Storage object policies require the first storage path segment to match `auth.uid()`.
- `rate_limits` is intended for service-role access only.
- Edge Functions use service-role clients after authenticating or otherwise validating requests.

Security risks to verify:
- Existing local `.env*` files are tracked in repo history.
- Some Edge Functions are configured with JWT verification disabled.
- Webhook environment is selected by query string and should be checked against deployment routing.
- AI responses are trusted after JSON parse but without strict schema validation.

## Migration Requirements
- Verify all migrations apply cleanly in a fresh Supabase project.
- Regenerate `src/integrations/supabase/types.ts` after migration verification.
- Decide whether `billing_subscriptions` is legacy and can be migrated away.
- Align country constraints with actual supported countries, especially US.
- Add missing indexes if query plans show slow dashboard or anomaly queries at scale.

## Data Lifecycle
- Upload: file stored in `payslips` bucket under `user_id/timestamp_filename`.
- Processing: `payslips` starts as `processing`, `payslip_extractions` starts as `pending`.
- Extraction: Edge Function updates extraction and marks payslip `completed` or `needs_review`.
- Review: user can confirm values, moving payslip to `completed`.
- Anomaly handling: statuses move across `new`, `reviewed`, `raised`, and `resolved`.
- Export: settings builds a browser-side JSON export from user-owned rows.
- Deletion: settings calls `deleteUserAccountData`, removes storage files and rows, then signs out.

## Open Questions
- Should US payslips be supported in MVP or removed from MVP marketing until backend support exists?
- Should payslip extraction be a background job instead of a synchronous function call?
- What is the retention policy for raw files and raw AI extraction JSON?
- Should audit events be writable by the client or only service-side?
- Should payroll drafts count usage on creation, copy, or save?
- Should legacy `billing_subscriptions` remain after Stripe subscription migration?
