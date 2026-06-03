ALTER TABLE dealer_onboardings
  ADD COLUMN IF NOT EXISTS company_type varchar(100),
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS bank_account_number text,
  ADD COLUMN IF NOT EXISTS ifsc_code varchar(11),
  ADD COLUMN IF NOT EXISTS extracted_data jsonb,
  ADD COLUMN IF NOT EXISTS application_status varchar(30) NOT NULL DEFAULT 'pending_review',
  ADD COLUMN IF NOT EXISTS review_notes text,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS dealer_onboarding_documents (
  id varchar(255) PRIMARY KEY,
  onboarding_id varchar(255) NOT NULL REFERENCES dealer_onboardings(id) ON DELETE CASCADE,
  document_type varchar(100) NOT NULL,
  file_name text NOT NULL,
  file_size integer,
  mime_type varchar(100),
  storage_bucket varchar(100) NOT NULL DEFAULT 'private-documents',
  storage_path text NOT NULL,
  ocr_status varchar(30) NOT NULL DEFAULT 'not_processed',
  ocr_text text,
  parsed_fields jsonb,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dealer_onboarding_documents_onboarding_idx
  ON dealer_onboarding_documents(onboarding_id);
CREATE INDEX IF NOT EXISTS dealer_onboarding_documents_type_idx
  ON dealer_onboarding_documents(document_type);
CREATE INDEX IF NOT EXISTS dealer_onboardings_status_idx
  ON dealer_onboardings(application_status);
