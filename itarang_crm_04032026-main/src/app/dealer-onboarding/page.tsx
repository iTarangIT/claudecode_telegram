"use client";

import { FormEvent, useMemo, useState } from "react";
import { CheckCircle, FileText, Loader2, UploadCloud } from "lucide-react";

type DocumentKey =
  | "gst_certificate"
  | "pan_card"
  | "udyam_certificate"
  | "bank_statement"
  | "cancelled_cheque"
  | "itr_returns"
  | "address_proof";

const REQUIRED_DOCUMENTS: Array<{ key: DocumentKey; label: string; help: string }> = [
  { key: "gst_certificate", label: "GST Certificate", help: "Used to parse GSTIN, legal name, and address" },
  { key: "pan_card", label: "PAN Card", help: "Used to parse PAN and proprietor/company name" },
  { key: "udyam_certificate", label: "Udyam Certificate", help: "MSME/Udyam business verification" },
  { key: "bank_statement", label: "Bank Statement", help: "Latest 3 months PDF/image" },
  { key: "cancelled_cheque", label: "Cancelled Cheque", help: "Used to parse account number and IFSC" },
  { key: "itr_returns", label: "Company ITR", help: "Latest returns, preferably 3 years" },
  { key: "address_proof", label: "Address Proof", help: "Shop/office address document" },
];

type FormState = {
  business_name: string;
  owner_name: string;
  company_type: string;
  email: string;
  phone: string;
  gstin: string;
  pan: string;
  address: string;
  bank_name: string;
  bank_account_number: string;
  ifsc_code: string;
};

const initialForm: FormState = {
  business_name: "",
  owner_name: "",
  company_type: "Sole Proprietorship",
  email: "",
  phone: "",
  gstin: "",
  pan: "",
  address: "",
  bank_name: "",
  bank_account_number: "",
  ifsc_code: "",
};

export default function DealerOnboardingPage() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [documents, setDocuments] = useState<Record<DocumentKey, File | null>>({
    gst_certificate: null,
    pan_card: null,
    udyam_certificate: null,
    bank_statement: null,
    cancelled_cheque: null,
    itr_returns: null,
    address_proof: null,
  });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const uploadedCount = useMemo(
    () => Object.values(documents).filter(Boolean).length,
    [documents],
  );

  function updateField(key: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submitApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    setError(null);

    try {
      const payload = new FormData();
      Object.entries(form).forEach(([key, value]) => payload.append(key, value));
      Object.entries(documents).forEach(([key, file]) => {
        if (file) payload.append(`documents[${key}]`, file);
      });

      const response = await fetch("/api/dealer-onboarding/submit", {
        method: "POST",
        body: payload,
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result?.error?.message || "Unable to submit dealer onboarding application");
      }

      setMessage(`Application ${result.data.onboardingId} submitted to Sales Admin for review.`);
      setForm(initialForm);
      setDocuments({
        gst_certificate: null,
        pan_card: null,
        udyam_certificate: null,
        bank_statement: null,
        cancelled_cheque: null,
        itr_returns: null,
        address_proof: null,
      });
    } catch (submitError: unknown) {
      setError(submitError instanceof Error ? submitError.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="max-w-7xl mx-auto px-6 py-10">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <form onSubmit={submitApplication} className="lg:col-span-2 space-y-8">
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Dealer business details</h2>
              <p className="text-sm text-slate-500 mt-1">
                Fill known fields now. Uploaded documents are OCR parsed and used to auto-populate the review record.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Business / Company Name" value={form.business_name} onChange={(value) => updateField("business_name", value)} required />
              <Input label="Owner / Proprietor Name" value={form.owner_name} onChange={(value) => updateField("owner_name", value)} required />
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-slate-700">Company Type</span>
                <select
                  className="border border-slate-300 rounded-xl px-3 py-2.5 w-full bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                  value={form.company_type}
                  onChange={(event) => updateField("company_type", event.target.value)}
                >
                  <option>Sole Proprietorship</option>
                  <option>Partnership Firm</option>
                  <option>Private Limited Firm</option>
                  <option>LLP</option>
                  <option>Distributor</option>
                </select>
              </label>
              <Input label="Email" type="email" value={form.email} onChange={(value) => updateField("email", value)} required />
              <Input label="Phone" value={form.phone} onChange={(value) => updateField("phone", value)} required />
              <Input label="GSTIN" value={form.gstin} onChange={(value) => updateField("gstin", value.toUpperCase())} required />
              <Input label="PAN" value={form.pan} onChange={(value) => updateField("pan", value.toUpperCase())} required />
              <Input label="IFSC Code" value={form.ifsc_code} onChange={(value) => updateField("ifsc_code", value.toUpperCase())} />
              <Input label="Bank Name" value={form.bank_name} onChange={(value) => updateField("bank_name", value)} />
              <Input label="Bank Account Number" value={form.bank_account_number} onChange={(value) => updateField("bank_account_number", value)} />
            </div>

            <label className="space-y-1.5 block">
              <span className="text-sm font-medium text-slate-700">Registered / Billing Address</span>
              <textarea
                className="border border-slate-300 rounded-xl px-3 py-2.5 w-full min-h-24 focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={form.address}
                onChange={(event) => updateField("address", event.target.value)}
                required
              />
            </label>
          </section>

          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Dealer documents</h2>
              <p className="text-sm text-slate-500 mt-1">
                Upload original documents. They are saved unchanged in the private document bucket and linked to the Sales Admin review queue.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {REQUIRED_DOCUMENTS.map((doc) => (
                <label key={doc.key} className="border border-slate-200 rounded-2xl p-4 hover:border-brand-300 transition-colors bg-slate-50/50">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center shrink-0">
                      {documents[doc.key] ? <CheckCircle className="h-5 w-5" /> : <UploadCloud className="h-5 w-5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900">{doc.label}</p>
                      <p className="text-xs text-slate-500 mt-1">{doc.help}</p>
                      {documents[doc.key] && (
                        <p className="text-xs text-emerald-700 mt-2 truncate">{documents[doc.key]?.name}</p>
                      )}
                    </div>
                  </div>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,application/pdf"
                    className="mt-4 block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-brand-600 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-brand-700"
                    onChange={(event) => {
                      const file = event.target.files?.[0] || null;
                      setDocuments((current) => ({ ...current, [doc.key]: file }));
                    }}
                  />
                </label>
              ))}
            </div>
          </section>

          {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>}

          <button
            type="submit"
            disabled={submitting || uploadedCount === 0}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1F5C8F] px-6 py-3 font-semibold text-white shadow-sm hover:bg-[#17476f] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            Submit to Sales Admin Review
          </button>
        </form>

        <aside className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sticky top-6">
            <h3 className="font-semibold text-slate-900">Submission workflow</h3>
            <ol className="mt-4 space-y-4 text-sm text-slate-600">
              <li className="flex gap-3"><span className="font-bold text-brand-700">1.</span> Dealer uploads all original documents.</li>
              <li className="flex gap-3"><span className="font-bold text-brand-700">2.</span> Images are OCR parsed to populate GST, PAN, contact, address, and bank fields.</li>
              <li className="flex gap-3"><span className="font-bold text-brand-700">3.</span> Files are stored unchanged in the private document workflow.</li>
              <li className="flex gap-3"><span className="font-bold text-brand-700">4.</span> Sales Admin reviews, approves, or rejects the onboarding application.</li>
            </ol>
            <div className="mt-6 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
              <p className="font-medium">Documents uploaded: {uploadedCount}/{REQUIRED_DOCUMENTS.length}</p>
              <p className="text-xs text-slate-500 mt-1">At least one document is required; upload all applicable documents for faster approval.</p>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}

function Input({
  label,
  value,
  onChange,
  required,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="space-y-1.5">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        type={type}
        className="border border-slate-300 rounded-xl px-3 py-2.5 w-full focus:outline-none focus:ring-2 focus:ring-brand-500"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
      />
    </label>
  );
}
