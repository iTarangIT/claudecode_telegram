# Dealer WhatsApp Onboarding Architecture

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task after this architecture is approved.

**Goal:** Move dealer onboarding from a manual web-wizard-first process to a WhatsApp-first conversational onboarding flow where the dealer sends documents to the iTarang WhatsApp number, iTarang extracts/verifies data, asks the dealer to confirm/submit, and then routes the application into the existing Sales Admin/Sales Head dealer verification process.

**Architecture:** Add an inbound WhatsApp orchestration layer in front of the existing dealer onboarding tables and admin review flow. WhatsApp messages/documents are ingested through a provider webhook, normalized into onboarding sessions, stored as immutable original files in the existing `dealer-documents` bucket, processed by OCR/API verification workers, then merged into `dealer_onboarding_applications` and `dealer_onboarding_documents`. Final submission happens only after a WhatsApp confirmation from the dealer, and the existing `/admin/dealer-verification` flow remains the system of record for approval/rejection/corrections.

**Tech Stack:** Next.js 16 App Router, PostgreSQL via Drizzle ORM, Supabase Storage/Auth, Gupshup WhatsApp Messaging API, Decentro verification APIs, Tesseract/Google Vision-capable OCR, existing Sales Head auth guard and admin review pages.

---

## Source grounding

This architecture is based on the correct repository and the WhatsApp-first requirement clarified by Apoorv.

- Repo: `git@github.com:iTarangIT/itarang-software.git`
- Local path: `/opt/data/repos/itarang-software`
- Branch: `dealer-onboarding-document-extraction`
- Base commit inspected: `fe514b2`

I searched the current session history and repo for the separately shared report, but did not find an attached report artifact in the accessible context. Related repo material inspected instead:

- `scripts/generate-work-report.ts` — existing report generator documenting KYC document upload, Decentro PAN/bank verification, WhatsApp/SMS links, and admin review patterns.
- `src/docs/PROJECT_STRUCTURE.MD` — existing admin OCR/API verification and dealer onboarding flow.
- Current onboarding/admin code and schema listed below.

If there is another report file outside this repo/session, attach it and this architecture can be reconciled against it.

---

## Current repo capabilities to reuse

### WhatsApp outbound

- `src/lib/gupshup.ts`
  - Existing Gupshup wrapper supports `channel = "whatsapp"`.
  - Supports session/free-text messages and approved template mode.
  - Env already modeled around:
    - `GUPSHUP_SMS_ENABLED`
    - `GUPSHUP_API_KEY`
    - `GUPSHUP_APP_NAME`
    - `GUPSHUP_SOURCE`
    - `GUPSHUP_CHANNEL`
    - `GUPSHUP_TEMPLATE_ID`

### Dealer onboarding persistence

- `src/lib/db/schema.ts`
  - `dealerOnboardingApplications` maps to `dealer_onboarding_applications`.
  - `dealerOnboardingDocuments` maps to `dealer_onboarding_documents`.
- Existing application columns cover company, GST/PAN, owner, bank, agreement, onboarding status, review status, approval/rejection/correction, and source metadata.
- Existing document columns already cover storage metadata plus:
  - `extracted_data`
  - `api_verification_results`
  - `metadata`
  - `admin_comment`

### Existing web onboarding process to merge with

- Wizard page: `src/app/dealer-onboarding/page.tsx`
- Store: `src/store/onboardingStore.ts`
- Submit route: `src/app/api/dealer/onboarding/submit/route.ts`
- Draft/save route: `src/app/api/dealer-onboarding/save/route.ts`
- Upload route: `src/app/api/uploads/dealer-documents/route.ts`
- Bucket: `dealer-documents`

### Existing admin process to keep

- List page: `src/app/(dashboard)/admin/dealer-verification/page.tsx`
- Detail page: `src/app/(dashboard)/admin/dealer-verification/[dealerId]/page.tsx`
- List API: `src/app/api/admin/dealer-verifications/route.ts`
- Detail API: `src/app/api/admin/dealer-verifications/[dealerId]/route.ts`
- Approve/reject/correction APIs under `src/app/api/admin/dealer-verifications/[dealerId]/...`

### Existing verification/OCR primitives

- `src/lib/decentro.ts`
  - PAN/GST/public registry validation via `validateDocument`.
  - Bank verification via `verifyBankAccount`.
  - Other KYC/forensics helpers.
- `src/lib/ocr/tesseractOcr.ts`
  - Image OCR.
- `src/lib/ocr/bankDocParser.ts`
  - IFSC/account/bank/branch parsing from OCR text.
- Dependencies include `@google-cloud/vision`, `@google/generative-ai`, `tesseract.js`, and `sharp`, so a better OCR/vision provider can be added behind an adapter without changing the onboarding flow.

---

## Target user experience

### Dealer side on WhatsApp

1. Dealer sends `Hi`, `Start onboarding`, or is messaged from iTarang using an approved WhatsApp template.
2. Bot identifies the dealer by phone number or creates a new onboarding session.
3. Bot asks for the required documents one by one.
4. Dealer uploads documents directly in WhatsApp.
5. System stores every original document unchanged in Supabase Storage under `dealer-documents`.
6. System extracts fields from each document and runs verification APIs.
7. Bot asks follow-up questions only for missing/uncertain fields.
8. Bot sends a summary of extracted information:
   - Company name/type/address
   - GST number
   - PAN number
   - Owner/contact details
   - Bank account/IFSC/beneficiary
   - Finance enablement/agreement-related fields
   - Document checklist and verification status
9. Dealer replies `CONFIRM` / `SUBMIT` or sends corrections.
10. System creates or updates `dealer_onboarding_applications`, writes all `dealer_onboarding_documents`, sets:
    - `onboarding_status = 'submitted'`
    - `review_status = 'pending_admin_review'`
11. Bot replies that the application has gone to Sales Admin for review.

### Sales Admin side

1. Application appears in existing `/admin/dealer-verification` queue.
2. Admin opens existing detail page.
3. Admin sees:
   - Submitted table fields
   - Original WhatsApp-uploaded documents
   - Extracted fields per document
   - API verification results
   - Conversation/submission summary
4. Admin approves/rejects/requests correction using existing buttons.
5. Correction request can be sent back to dealer over WhatsApp and/or existing correction link flow.

---

## High-level architecture

```mermaid
flowchart TD
  Dealer[Dealer WhatsApp] --> Gupshup[Gupshup WhatsApp]
  Gupshup --> Inbound[POST /api/webhooks/gupshup/whatsapp]
  Inbound --> Verify[Signature / App / Source Validation]
  Verify --> Normalize[Normalize text/media/event payload]
  Normalize --> Session[Resolve or create whatsapp_onboarding_sessions]
  Session --> StateMachine[Dealer onboarding conversation state machine]

  StateMachine --> NeedDoc{Need document?}
  NeedDoc -->|yes| PromptDoc[Send WhatsApp prompt]
  PromptDoc --> Dealer
  StateMachine -->|media received| MediaFetch[Fetch media from Gupshup]
  MediaFetch --> Storage[(Supabase Storage dealer-documents)]
  Storage --> DocRow[(dealer_onboarding_documents draft row)]
  DocRow --> ExtractQueue[Extraction/Verification job]
  ExtractQueue --> OCR[OCR / Vision parser]
  OCR --> Decentro[Decentro APIs]
  Decentro --> DocExtract[(extracted_data + api_verification_results)]
  DocExtract --> FieldMerge[Merge high-confidence fields into application draft]
  FieldMerge --> MissingFields{Missing / uncertain data?}
  MissingFields -->|yes| AskFollowup[Ask targeted WhatsApp question]
  AskFollowup --> Dealer
  MissingFields -->|no| Summary[Send review summary]
  Summary --> Dealer
  Dealer --> Confirm{CONFIRM / SUBMIT?}
  Confirm -->|correction| StateMachine
  Confirm -->|submit| Submit[Mark submitted + pending_admin_review]
  Submit --> AdminQueue[/admin/dealer-verification]
  AdminQueue --> AdminDecision[Approve / Reject / Request Correction]
```

---

## Recommended new modules

### 1. WhatsApp webhook route

Create:

- `src/app/api/webhooks/gupshup/whatsapp/route.ts`

Responsibilities:

- Accept Gupshup inbound webhook payloads.
- Verify request authenticity using provider headers/shared secret.
- Normalize inbound payloads into internal events:
  - `text_message`
  - `document_message`
  - `image_message`
  - `button_reply`
  - `delivery_status`
- Return HTTP 200 quickly after persisting event.
- Do not run OCR synchronously in the webhook request.

### 2. WhatsApp provider adapter

Create:

- `src/lib/whatsapp/gupshup-inbound.ts`
- `src/lib/whatsapp/gupshup-outbound.ts`

Responsibilities:

- Parse Gupshup payloads.
- Fetch media bytes from Gupshup media URLs using configured credentials.
- Send text/template/list/button messages.
- Mask phone numbers in logs.
- Keep provider-specific fields out of core onboarding logic.

Reuse/extend:

- `src/lib/gupshup.ts`

### 3. Conversation state machine

Create:

- `src/lib/onboarding/whatsapp/state-machine.ts`
- `src/lib/onboarding/whatsapp/document-checklist.ts`
- `src/lib/onboarding/whatsapp/prompts.ts`

Responsibilities:

- Determine next question/document.
- Maintain the checklist state.
- Decide whether the dealer can submit.
- Avoid overwriting confirmed user data silently.
- Support commands:
  - `START`
  - `STATUS`
  - `HELP`
  - `RESET` / admin-only reset
  - `CONFIRM`
  - `SUBMIT`
  - `CHANGE <field>`

### 4. Document ingestion service

Create:

- `src/lib/onboarding/whatsapp/document-ingestion.ts`

Responsibilities:

- Accept normalized WhatsApp media.
- Download bytes.
- Detect MIME type and file name.
- Store original file in Supabase Storage bucket `dealer-documents`.
- Create/update a draft `dealer_onboarding_documents` row with:
  - `application_id`
  - `document_type`
  - `bucket_name`
  - `storage_path`
  - `file_name`
  - `file_url`
  - `mime_type`
  - `file_size`
  - `doc_status = 'uploaded'`
  - `verification_status = 'processing'`
  - `metadata.source = 'whatsapp'`
  - `metadata.whatsappMessageId`
  - `metadata.sessionId`

### 5. Extraction and verification service

Create:

- `src/lib/onboarding/dealer-document-extraction.ts`
- `src/lib/onboarding/dealer-document-verification.ts`

Responsibilities:

- Run OCR/vision extraction.
- Normalize fields per document type.
- Run Decentro/API validations.
- Write outputs into document JSON columns.
- Return structured field suggestions.

Document-specific behavior:

- GST certificate:
  - Extract GSTIN, legal name, trade name, address.
  - Verify GSTIN via Decentro/public registry where available.
  - Map to `gst_number`, `company_name`, `business_address` suggestions.
- Company PAN:
  - Extract PAN, name.
  - Verify PAN via Decentro where required parameters are available.
  - Map to `pan_number` and legal name suggestions.
- Bank statement / cancelled cheque / undated cheques:
  - Extract account number, IFSC, bank name, branch, beneficiary/name.
  - Verify bank account with Decentro `verifyBankAccount` when account + IFSC are present.
  - Map to `account_number`, `ifsc_code`, `bank_name`, `beneficiary_name`.
- Udyam certificate:
  - Extract Udyam number, entity name, address.
  - Store in `extracted_data`; if no application column exists, store under `provider_raw_response.whatsappExtraction.udyam` or document JSON.
- ITR / partnership deed / MoU / AoA / photographs:
  - Store original and OCR metadata initially.
  - Extract only safe high-level metadata unless a business rule requires more.

### 6. Field merge service

Create:

- `src/lib/onboarding/whatsapp/application-draft.ts`

Responsibilities:

- Create or update `dealer_onboarding_applications` draft row for the WhatsApp session.
- Merge high-confidence extracted fields only into empty fields, unless the dealer explicitly confirms a replacement.
- Track field provenance in JSON, preferably under `provider_raw_response.whatsappOnboarding`:

```json
{
  "source": "whatsapp",
  "sessionId": "...",
  "fieldConfidence": {
    "gst_number": { "sourceDocumentType": "gst_certificate", "confidence": 0.98 },
    "account_number": { "sourceDocumentType": "bank_statement_3_months", "confidence": 0.91 }
  },
  "dealerConfirmedAt": "..."
}
```

### 7. Job processing/backstop

Recommended minimal first implementation:

- Persist inbound event.
- Process extraction through an internal API route called by QStash/cron or a safe server-side job endpoint.

Create:

- `src/app/api/internal/dealer-whatsapp/process-next/route.ts`
- `src/app/api/cron/dealer-whatsapp-retry/route.ts`

Later scalable implementation:

- Use BullMQ/Redis because dependencies already include `bullmq` and `ioredis`, but do not introduce it unless deployment Redis is confirmed.

### 8. Admin review enrichment

Modify:

- `src/app/api/admin/dealer-verifications/[dealerId]/route.ts`
- `src/app/(dashboard)/admin/dealer-verification/[dealerId]/page.tsx`

Add to admin detail response:

- Document `extractedData`
- Document `apiVerificationResults`
- Document `metadata.source = whatsapp`
- WhatsApp session summary and dealer confirmation timestamp
- Verification status per document

Admin page additions:

- Show “Source: WhatsApp onboarding” badge.
- Show extracted fields below each document.
- Show mismatch alerts:
  - submitted GST vs GST certificate GST
  - submitted PAN vs PAN document PAN
  - submitted account/IFSC vs bank verification result
- Keep existing approve/reject/correction process unchanged.

---

## Data model additions

Existing tables can store the final application/document state, but WhatsApp needs conversation/session/audit persistence. Add new tables via Drizzle migration.

### `dealer_whatsapp_onboarding_sessions`

Purpose: one onboarding conversation/session per dealer phone/application.

Suggested columns:

- `id uuid primary key`
- `application_id uuid null` → `dealer_onboarding_applications.id`
- `phone varchar(20) not null`
- `dealer_name text null`
- `language varchar(20) default 'en'`
- `status varchar(40) not null default 'active'`
  - `active`
  - `collecting_documents`
  - `extracting`
  - `awaiting_missing_info`
  - `awaiting_dealer_confirmation`
  - `submitted_for_admin_review`
  - `admin_correction_requested`
  - `closed`
- `current_step varchar(80) null`
- `required_documents jsonb default []`
- `collected_documents jsonb default []`
- `missing_fields jsonb default []`
- `extracted_snapshot jsonb default {}`
- `confirmed_snapshot jsonb default {}`
- `last_inbound_message_id text null`
- `last_outbound_message_id text null`
- `last_message_at timestamp with time zone null`
- `dealer_confirmed_at timestamp with time zone null`
- `submitted_at timestamp with time zone null`
- `created_at timestamp with time zone default now()`
- `updated_at timestamp with time zone default now()`

Indexes:

- unique active session per phone, or `(phone, status)` partial index for open statuses.
- index on `application_id`.

### `dealer_whatsapp_messages`

Purpose: audit trail and idempotency for inbound/outbound WhatsApp events.

Suggested columns:

- `id uuid primary key`
- `session_id uuid null`
- `application_id uuid null`
- `provider varchar(30) default 'gupshup'`
- `provider_message_id text not null`
- `direction varchar(10) not null` — inbound/outbound
- `message_type varchar(30) not null` — text/image/document/button/status
- `from_phone varchar(20) null`
- `to_phone varchar(20) null`
- `text text null`
- `media_url text null`
- `media_mime_type varchar(100) null`
- `media_file_name text null`
- `document_id uuid null` → `dealer_onboarding_documents.id`
- `payload jsonb default {}`
- `processing_status varchar(30) default 'received'`
  - `received`
  - `processed`
  - `failed`
  - `ignored_duplicate`
- `error_message text null`
- `created_at timestamp with time zone default now()`

Indexes:

- unique `provider_message_id` for idempotency.
- index on `session_id`.
- index on `application_id`.

### Optional `dealer_whatsapp_field_confirmations`

Purpose: field-level audit for dealer corrections before final submission.

Columns:

- `id uuid primary key`
- `session_id uuid not null`
- `application_id uuid not null`
- `field_key varchar(100) not null`
- `old_value text null`
- `new_value text null`
- `source varchar(30)` — extracted/manual/admin_correction
- `source_document_id uuid null`
- `confirmed_by_phone varchar(20)`
- `confirmed_at timestamp with time zone default now()`

---

## Document checklist for WhatsApp bot

Use the existing onboarding wizard slots as the first version of the checklist.

### Company documents

- GST Certificate
- Company PAN

### Compliance documents

- Last 3 years company ITR
- Last 3 months company bank statement
- 4 undated cheques / cancelled cheque equivalent if business accepts it
- Passport size photograph
- Udyam registration certificate

### Ownership/banking documents

- Owner photograph
- Partnership deed for partnership/LLP
- MoU if required
- AoA for company type where applicable
- Partner/director photographs when partner/director rows are collected

### Conditional questions

Ask over WhatsApp when not extractable:

- Company type
- Owner/contact name, phone, email
- Whether finance enablement is required
- Branch dealer flag if applicable
- Sales manager details if not known from internal assignment
- Agreement language
- Authorized signatory details

---

## State machine

### States

- `new_session`
- `collect_company_identity`
- `collect_gst_certificate`
- `collect_company_pan`
- `collect_compliance_documents`
- `collect_ownership_documents`
- `collect_missing_fields`
- `run_verifications`
- `awaiting_dealer_confirmation`
- `submitted_for_admin_review`
- `admin_correction_requested`
- `closed_approved`
- `closed_rejected`

### Transitions

- `START` → create session/application draft.
- Text answer → update field or command state.
- Media upload → store original document, classify, extract, verify, update checklist.
- All required docs + required fields present → send summary.
- Dealer `CONFIRM` → lock dealer-confirmed snapshot.
- Dealer `SUBMIT` → set existing application status/review status for admin queue.
- Admin correction → reopen session with correction checklist.

### Idempotency rules

- Ignore duplicate provider message IDs.
- If dealer uploads the same document type again before submit, mark previous document row as `superseded` or keep latest per type and preserve the prior document in storage.
- Never delete original storage objects automatically.
- Do not overwrite manually corrected fields unless dealer explicitly confirms replacement.

---

## Submission into existing main process

When the WhatsApp session is ready and dealer confirms:

1. Ensure `dealer_onboarding_applications` row exists.
2. Populate application fields from confirmed snapshot:
   - `company_name`
   - `company_type`
   - `gst_number`
   - `pan_number`
   - `business_address`
   - `owner_name`
   - `owner_phone`
   - `owner_email`
   - `bank_name`
   - `account_number`
   - `beneficiary_name`
   - `ifsc_code`
   - `finance_enabled`
   - agreement-related fields as available
3. Ensure all document rows point to the application.
4. Set document statuses:
   - `doc_status = 'uploaded'`
   - `verification_status = 'verified' | 'partial' | 'failed' | 'pending_admin_review'` based on API results.
5. Store WhatsApp source metadata.
6. Set application:
   - `onboarding_status = 'submitted'`
   - `review_status = 'pending_admin_review'`
   - `submitted_at = now()`
   - `provider_raw_response.whatsappOnboarding = ...`
7. Admin sees it in existing dealer verification queue.

---

## API verification matrix

### GST

- Input: GSTIN extracted from certificate or dealer text.
- API: Decentro public registry GSTIN/GSTIN_DETAILED if configured.
- Store:
  - `dealer_onboarding_documents.api_verification_results.gst`
  - normalized result fields in `extracted_data`.
- Flag mismatch if legal name differs materially from company name.

### PAN

- Input: PAN extracted from PAN card/document or dealer text.
- API: Decentro PAN/PAN detailed if configured.
- Store:
  - PAN status
  - legal name
  - name match score where available.
- Flag mismatch if PAN name differs from company/owner depending company type.

### Bank

- Input: account number + IFSC + beneficiary/company name.
- API: `verifyBankAccount` from `src/lib/decentro.ts`.
- Store:
  - account status
  - returned account holder name
  - IFSC/bank details
  - name match result if API returns it.
- Flag mismatch if beneficiary name differs from company/owner.

### Udyam

- Input: Udyam number extracted from certificate.
- API: Decentro `UDYOG_AADHAAR`/Udyam where available.
- Store result under document JSON even if no dedicated application column exists.

---

## Admin review changes

Admin detail page should show:

- Header badge: `Source: WhatsApp Onboarding`.
- Dealer phone/session ID.
- Dealer confirmation timestamp.
- Checklist completion status.
- Document rows with:
  - Original file link
  - Upload source and WhatsApp message ID
  - Extracted fields
  - API verification result
  - Mismatch warnings
- Conversation summary:
  - Not raw full chat by default.
  - Show latest important prompts/answers and confirmation text.

Admin actions remain unchanged:

- Approve → existing approve API creates/links user/account/dealer.
- Reject → existing reject API.
- Request correction → existing correction API plus WhatsApp notification to dealer.

---

## Security, compliance, and operational rules

- Verify inbound webhook authenticity before processing.
- Store raw provider payloads in DB, not logs.
- Mask phone/PAN/account numbers in logs.
- Do not send full PAN/account numbers back over WhatsApp; mask sensitive values in summaries.
- Store original documents exactly as received.
- Extraction is advisory until dealer confirms and admin approves.
- Admin approval remains mandatory.
- Maintain idempotency by provider message ID.
- Return webhook response quickly; use async processing/backstop for slow OCR/API calls.
- Use approved WhatsApp templates outside the 24-hour session window.

---

## Implementation phases

### Phase 1 — Foundation

- Add DB tables for WhatsApp sessions/messages.
- Add inbound Gupshup webhook route.
- Add provider parser and idempotency.
- Add outbound WhatsApp helper using existing Gupshup wrapper.
- Add basic state machine: start/status/help.

### Phase 2 — Document collection

- Add document checklist.
- Add media download and storage to `dealer-documents`.
- Create draft `dealer_onboarding_applications` and document rows.
- Ask for missing required documents over WhatsApp.

### Phase 3 — Extraction and verification

- Add dealer document extraction service.
- Add Decentro verification service for GST/PAN/bank.
- Persist `extracted_data` and `api_verification_results`.
- Merge high-confidence fields into application draft.

### Phase 4 — Dealer confirmation/submission

- Generate masked WhatsApp summary.
- Accept corrections and update fields.
- Accept `CONFIRM`/`SUBMIT`.
- Submit into existing admin review queue.

### Phase 5 — Admin review integration

- Add WhatsApp source/extraction panels to admin detail page.
- Add mismatch badges.
- Send correction/rejection/approval updates to dealer over WhatsApp where configured.

### Phase 6 — Testing and hardening

- Unit tests for payload parser, state machine, document type inference, field merge.
- Integration tests for webhook idempotency and application submission.
- Manual sandbox test with real Gupshup media payload.
- Type-check and lint.

---

## Acceptance criteria

- Dealer can complete onboarding using only WhatsApp until final admin review.
- All original WhatsApp documents are stored in `dealer-documents`.
- All documents are represented in `dealer_onboarding_documents`.
- Required table fields are populated in `dealer_onboarding_applications` from extracted/confirmed data.
- GST/PAN/bank verification results are stored and visible to admin.
- Dealer receives a WhatsApp summary and must confirm before admin submission.
- Confirmed application appears in existing `/admin/dealer-verification` queue.
- Admin review/approve/reject/correction remains the same main process.
- Duplicate WhatsApp webhook deliveries do not duplicate documents/applications.

---

## Open decisions

- WhatsApp provider: assume Gupshup because existing repo has Gupshup outbound; confirm if production iTarang WhatsApp uses Gupshup or another BSP.
- OCR provider: start with existing Tesseract/Google Vision adapter; decide whether to use Google Vision/Gemini for PDFs and low-quality WhatsApp images.
- Job runner: start with internal retry/cron endpoints unless Redis/BullMQ deployment is confirmed.
- Correction channel: use existing correction link plus WhatsApp notification, or allow full correction inside WhatsApp.
- Agreement/eSign: confirm whether dealer agreement is initiated only after admin review or during WhatsApp pre-submission for finance-enabled dealers.
