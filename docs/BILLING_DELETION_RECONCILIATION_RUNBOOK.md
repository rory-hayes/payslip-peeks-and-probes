# Deletion-time billing reconciliation

`account_deletion_billing_reviews` is a service-role-only support ledger for a
verified Stripe event that arrives after an account has entered deletion. It is
not an entitlement source and must never be exposed to the browser or mobile
client.

The row contains a stable account subject ID and Stripe object identifiers
(Checkout Session, PaymentIntent, Subscription, and, when available, customer
ID). Treat those as linkable financial identifiers. It deliberately stores no
payslip image, extracted payslip content, Stripe payload, email address, or
payment-card data.

## What happens automatically

1. A verified paid lifetime event or a billable subscription event is checked
   against the app catalogue and server-written Stripe metadata.
2. If the account is deleting or Auth has already cascaded its normal billing
   rows, the event upserts exactly one review record keyed by environment plus
   checkout intent.
3. The account-deletion receipt becomes `manual_review` and cannot pass its
   final billing guard. No new entitlement is granted.
4. A later duplicate Stripe delivery updates the same review record. It does
   not create another entitlement or another review.

## Support procedure

Only an authorised operator using the service role may inspect this ledger.
For every `review_required` record:

1. Verify the Stripe event and the current remote Checkout Session,
   PaymentIntent, and/or Subscription in the matching Stripe environment.
2. Apply the business decision that has been approved for that plan: for
   example, refund a one-time charge, cancel a subscription, or confirm that a
   payment did not settle. Do not invent a refund, cancellation, or access rule
   from the database row alone.
3. Record the decision using
   `resolve_account_deletion_billing_review(review_id, resolution_code, resolved_by)`.
   Use a short internal code and operator identifier; never put a payslip,
   email address, card data, or raw Stripe payload in either field.
4. Confirm there are no remaining `review_required` rows for that subject.
5. Make the separate deletion decision with
   `approve_and_resume_account_deletion_after_billing_review(job_id, approval_code, approved_by)`.
   This writes an append-only, service-role-only approval receipt and never
   calls Stripe, Storage, or Auth itself.

   - `queued` means Auth still exists and the protected deletion worker has
     been explicitly allowed to resume.
   - `completed` means the same worker had already recorded a lease-bound
     successful Auth removal, or it reached that boundary and lost only the
     follow-up receipt after Auth confirmed deletion. It seals only the durable
     deletion receipt.
   - `auth_deleted_recovery_required` is an unknown out-of-band Auth deletion.
     Do not update tables to force completion; use the documented incident
     recovery process to confirm Storage and billing cleanup first.

A new verified event may reopen review after an approval. That is intentional:
the approval transaction and reconciliation path share the account lifecycle
lock, and the final deletion boundary checks the ledger again.

When the protected worker has already passed its final Auth confirmation, a
new verified event is recorded for reconciliation rather than cancelling the
user's already-confirmed deletion. If it lands before that confirmation, it
returns the job to `manual_review` and Auth is not called.

The deployed worker's maximum post-confirmation runtime must be shorter than
the 300-second reserved lease (or the lease must be reduced to the platform
limit). Treat that runtime bound as a release setting to verify, not an
assumption made by the client.

## Retention and access decision required before paid launch

The product owner must publish and implement all of the following before
accepting real paid customers:

- the retention or anonymisation period for deletion receipts and this ledger;
- the support roles allowed to access it and the audit-log location for access;
- the approved refund/cancellation rules for lifetime and subscription plans;
- the deletion follow-up process when a review arrives after Auth is removed;
- the exact Privacy Policy provider and retention disclosures.

Until those are decided, leave the paid-release preflight blocked.

## Staging evidence required

- Start account deletion between Stripe Checkout Session creation and binding:
  neither new nor resumed checkout may disclose a client secret.
- Deliver a paid lifetime event after Auth deletion and confirm one review row,
  no `subscriptions` entitlement, a manual-review deletion receipt, then a
  recorded Auth-removal receipt. Resolve and approve the review and confirm the
  receipt seals without rerunning Auth deletion.
- Repeat for an active subscription event and a replayed Stripe event.
- Seed a review before the final deletion guard and confirm `deleteUser` is not
  called.
- Race the final guard against a webhook and confirm neither transaction
  deadlocks.
