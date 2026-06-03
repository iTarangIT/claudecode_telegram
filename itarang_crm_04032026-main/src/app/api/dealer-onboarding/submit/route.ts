import { randomUUID } from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { db } from '@/lib/db';
import { dealerOnboardingDocuments, dealerOnboardings } from '@/lib/db/schema';
import { errorResponse, generateId, successResponse, withErrorHandler } from '@/lib/api-utils';
import { extractTextFromImageBuffer } from '@/lib/ocr/tesseractOcr';
import { mergeParsedFields, parseDealerOnboardingDocumentText, type DealerDocumentParsedFields } from '@/lib/onboarding/document-parser';

const BUCKET_NAME = 'private-documents';
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'application/pdf',
]);

function field(formData: FormData, ...names: string[]): string | undefined {
  for (const name of names) {
    const value = formData.get(name);
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

function sanitize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'document';
}

function documentTypeFromKey(key: string) {
  const bracket = key.match(/^documents\[([^\]]+)\]$/)?.[1];
  const colon = key.match(/^document:([A-Za-z0-9_-]+)$/)?.[1];
  return sanitize(bracket || colon || key.replace(/^file_?/, '') || 'document');
}

function isImage(mimeType: string) {
  return mimeType.startsWith('image/');
}

async function ensureBucket() {
  const adminSupabase = createAdminClient();
  const { data: buckets, error } = await adminSupabase.storage.listBuckets();
  if (error) throw new Error(`Storage bucket check failed: ${error.message}`);

  if (!buckets?.some((bucket) => bucket.name === BUCKET_NAME)) {
    const { error: createError } = await adminSupabase.storage.createBucket(BUCKET_NAME, {
      public: false,
      fileSizeLimit: MAX_FILE_SIZE,
      allowedMimeTypes: Array.from(ALLOWED_MIME_TYPES),
    });
    if (createError) throw new Error(`Storage bucket create failed: ${createError.message}`);
  }

  return adminSupabase;
}

async function extractOcr(file: File, buffer: Buffer) {
  if (!isImage(file.type)) {
    return { ocr_status: 'skipped_pdf', ocr_text: '', parsed_fields: {} as DealerDocumentParsedFields };
  }

  try {
    const ocrText = await extractTextFromImageBuffer(buffer);
    const parsed = parseDealerOnboardingDocumentText(ocrText);
    return {
      ocr_status: ocrText.trim() ? 'success' : 'empty',
      ocr_text: ocrText,
      parsed_fields: parsed,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'OCR failed';
    return {
      ocr_status: 'failed',
      ocr_text: `OCR failed: ${message}`,
      parsed_fields: {} as DealerDocumentParsedFields,
    };
  }
}

export const POST = withErrorHandler(async (req: Request) => {
  const formData = await req.formData();
  const uploadedFiles = Array.from(formData.entries()).filter(
    ([, value]) => value instanceof File && value.size > 0,
  ) as Array<[string, File]>;

  if (uploadedFiles.length === 0) {
    return errorResponse('Please upload at least one dealer document.', 400);
  }

  for (const [, file] of uploadedFiles) {
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return errorResponse(`Invalid file type for ${file.name}. Allowed: PNG, JPEG, WEBP, PDF.`, 400);
    }
    if (file.size > MAX_FILE_SIZE) {
      return errorResponse(`${file.name} is too large. Max size is 10MB.`, 400);
    }
  }

  const adminSupabase = await ensureBucket();
  const onboardingId = await generateId('REG', dealerOnboardings);
  const documentRows = [];
  const parsedDocuments: DealerDocumentParsedFields[] = [];

  for (const [key, file] of uploadedFiles) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const documentType = documentTypeFromKey(key);
    const ext = sanitize(file.name.split('.').pop() || (file.type.includes('pdf') ? 'pdf' : 'bin'));
    const storagePath = `dealer-onboarding/${onboardingId}/${documentType}-${Date.now()}-${randomUUID()}.${ext}`;

    const { error: uploadError } = await adminSupabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) throw new Error(`Upload failed for ${file.name}: ${uploadError.message}`);

    const ocr = await extractOcr(file, buffer);
    parsedDocuments.push(ocr.parsed_fields);

    documentRows.push({
      id: `DLRDOC-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
      onboarding_id: onboardingId,
      document_type: documentType,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type,
      storage_bucket: BUCKET_NAME,
      storage_path: storagePath,
      ocr_status: ocr.ocr_status,
      ocr_text: ocr.ocr_text,
      parsed_fields: ocr.parsed_fields,
    });
  }

  const extracted = mergeParsedFields(parsedDocuments);
  const application = {
    business_name: field(formData, 'business_name', 'businessName', 'companyName') || extracted.business_name,
    owner_name: field(formData, 'owner_name', 'ownerName', 'proprietorName') || extracted.owner_name || extracted.business_name,
    email: field(formData, 'email', 'owner_email', 'ownerEmail') || extracted.email,
    phone: field(formData, 'phone', 'mobile', 'owner_phone', 'ownerPhone') || extracted.phone,
    gstin: (field(formData, 'gstin', 'gstNumber', 'gst_number') || extracted.gstin)?.toUpperCase(),
    pan: (field(formData, 'pan', 'panNumber', 'pan_number') || extracted.pan)?.toUpperCase(),
    address: field(formData, 'address', 'billing_address', 'registeredAddress') || extracted.address,
    company_type: field(formData, 'company_type', 'companyType'),
    bank_name: field(formData, 'bank_name', 'bankName') || extracted.bank_name,
    bank_account_number: field(formData, 'bank_account_number', 'bankAccountNumber') || extracted.bank_account_number,
    ifsc_code: (field(formData, 'ifsc_code', 'ifscCode') || extracted.ifsc_code)?.toUpperCase(),
  };

  const missing = Object.entries({
    business_name: application.business_name,
    owner_name: application.owner_name,
    email: application.email,
    phone: application.phone,
    gstin: application.gstin,
    pan: application.pan,
    address: application.address,
  }).filter(([, value]) => !value).map(([key]) => key);

  if (missing.length) {
    return errorResponse(
      `Could not populate required fields from form/OCR: ${missing.join(', ')}. Please fill them manually and submit again.`,
      400,
    );
  }

  await db.insert(dealerOnboardings).values({
    id: onboardingId,
    business_name: application.business_name!,
    owner_name: application.owner_name!,
    email: application.email!,
    phone: application.phone!,
    gstin: application.gstin!,
    pan: application.pan!,
    address: application.address!,
    company_type: application.company_type,
    bank_name: application.bank_name,
    bank_account_number: application.bank_account_number,
    ifsc_code: application.ifsc_code,
    extracted_data: {
      merged: extracted,
      documents: documentRows.map((doc) => ({
        document_type: doc.document_type,
        ocr_status: doc.ocr_status,
        parsed_fields: doc.parsed_fields,
      })),
    },
    application_status: 'pending_review',
    signzy_status: 'pending',
    submitted_at: new Date(),
    created_at: new Date(),
    updated_at: new Date(),
  });

  await db.insert(dealerOnboardingDocuments).values(documentRows);

  return successResponse({
    onboardingId,
    status: 'pending_review',
    populatedFields: application,
    documentsUploaded: documentRows.length,
    message: 'Dealer onboarding application submitted for Sales Admin review.',
  }, 201);
});
