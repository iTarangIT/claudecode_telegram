# Dealer Onboarding Architecture

```mermaid
flowchart LR
  Dealer[Dealer / Applicant] --> Form[Dealer Onboarding Form]
  Form --> SubmitAPI[POST /api/dealer-onboarding/submit]

  SubmitAPI --> Validate[Validate required fields and files]
  Validate --> Storage[Private Document Storage\nSupabase bucket: private-documents]
  Validate --> OCR[OCR + Document Parser\nGST / PAN / Bank / Address extraction]

  OCR --> Merge[Merge parsed fields with manual form data]
  Merge --> OnboardingDB[(dealer_onboardings)]
  Storage --> DocsDB[(dealer_onboarding_documents)]
  SubmitAPI --> Pending[application_status = pending_review]

  Pending --> ReviewQueue[Sales Admin Review Panel\nCEO / Sales Head dashboard]
  DocsDB --> SignedURLs[Temporary signed document URLs]
  SignedURLs --> ReviewQueue
  OnboardingDB --> ReviewQueue

  ReviewQueue --> Approve[Approve]
  ReviewQueue --> Reject[Reject]

  Approve --> AccountCreate[Create / link account]
  AccountCreate --> AccountsDB[(accounts)]
  AccountCreate --> Approved[application_status = approved]

  Reject --> Rejected[application_status = rejected\nreview_notes saved]
```

## Component Responsibilities

- **Dealer Onboarding Form**: Collects dealer business details and original documents.
- **Submit API**: Validates files, saves originals, runs OCR where supported, and creates the onboarding application.
- **Private Document Storage**: Stores uploaded documents unchanged in the existing private-document workflow.
- **OCR + Parser**: Extracts GSTIN, PAN, address, phone, email, IFSC, bank account, and related fields from image documents.
- **dealer_onboardings**: Main application record and review state.
- **dealer_onboarding_documents**: One row per uploaded document with storage path, OCR status, OCR text, and parsed fields.
- **Sales Admin Review Panel**: Review queue for CEO/Sales Head style admin users to inspect documents and OCR-populated data.
- **Review API**: Approves or rejects an application.
- **accounts**: Created/linked when Sales Admin approves the dealer.

## Status Flow

```mermaid
stateDiagram-v2
  [*] --> pending_review: Dealer submits documents
  pending_review --> approved: Sales Admin approves
  pending_review --> rejected: Sales Admin rejects
  approved --> [*]
  rejected --> [*]
```

## Notes

- Image files are OCR processed.
- PDF files are preserved in storage and can be reviewed from the panel; PDF OCR can be added as a later enhancement.
- Review document links should be generated as short-lived signed URLs from private storage.
