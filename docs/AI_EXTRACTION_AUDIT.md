# AI extraction audit

## Current implementation

The payslip processor now sends a private document request from the
`process-payslip` Supabase Edge Function through Vercel AI Gateway. The gateway
request uses `openai/gpt-5.4`, a strict JSON Schema response, PDF file parts,
and high-detail image parts. The browser never receives the gateway key.

The server still treats the model as an untrusted transcription service:

- numeric fields are type-checked and bounded;
- dates, country, and currency are allowlisted or nullable;
- line items are capped at 60 rows and source snippets at 300 characters;
- malformed output fails closed instead of being saved;
- the original document is not included in logs;
- automatic results remain in review until the owner confirms headline figures.

The structured result now includes:

- headline pay and deduction totals;
- year-to-date gross, tax, NI/PRSI, and pension values;
- distinct earning, deduction, employer-contribution, and informational rows;
- non-identifying payroll context printed on the document, including tax code,
  NI category/PRSI class, pay frequency, and pay basis where visible;
- short source snippets for line items and headline fields;
- a bounded confidence value for the extraction and each row.

The upload review, sample preview, and detail screen surface these values as
transcription evidence. They do not present confidence as proof, and they
continue to show the private original-payslip link, the review boundary, and
the payroll/tax disclaimer before a user relies on the figures.

## What this proves

The local contract proves request shape, MIME-specific document parts, schema
validation, bounded parsing, safe client hydration, and rendered display of
line items/evidence. It does not prove that a model reads every real payslip
correctly.

## Remaining quality gates

1. Build a redacted, owner-approved fixture set covering UK and Ireland PDFs,
   photos, multi-page documents, low contrast, rotated pages, unusual fonts,
   bonuses, overtime, student loans, pension variants, and missing fields.
2. Compare extracted values against human-labelled ground truth at field and
   line-item level. Track false positives, missed deductions, wrong signs,
   wrong currency, and unsupported-country classification.
3. Require a live redacted fixture run after `AI_GATEWAY_API_KEY` is configured
   in the target Supabase project. Confirm both PDF and image requests, a
   provider error, malformed output, retry behavior, and account isolation.
4. Decide whether the provider’s data-processing terms, region, retention,
   deletion, and subprocessor disclosures are acceptable before real customer
   payslips are accepted.
5. Add a deliberate follow-up workflow for users who want to correct a line
   item itself. The current confirmation RPC confirms headline figures; the
   detailed line-item transcript remains source evidence rather than a second
   independently confirmed ledger.
6. Keep the extraction assistant scoped to transcription and comparison until
   a separate, reviewed question-answering workflow has its own privacy,
   citation, and hallucination tests.

## Current verdict

The extraction path is materially stronger and safer as a first-pass assistant,
but it is not yet a verified accuracy product or a basis for making payroll or
tax decisions without human review. Production acceptance requires the live
fixture and provider/legal gates above.
