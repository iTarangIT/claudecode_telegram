import type { ReactNode } from 'react';
import { db } from '@/lib/db';
import { dealerOnboardingDocuments, dealerOnboardings } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import { AlertCircle, Building, CheckCircle, ExternalLink, Mail, MapPin, Phone, ShieldCheck, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { createAdminClient } from '@/lib/supabase/admin';
import { DealerOnboardingReviewActions } from '@/components/onboarding/DealerOnboardingReviewActions';

type DocumentRow = typeof dealerOnboardingDocuments.$inferSelect & { signedUrl?: string | null };

function statusBadge(status: string) {
  if (status === 'approved') {
    return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200"><CheckCircle className="w-3 h-3" />Approved</span>;
  }
  if (status === 'rejected') {
    return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200"><XCircle className="w-3 h-3" />Rejected</span>;
  }
  return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200"><AlertCircle className="w-3 h-3" />Pending Review</span>;
}

function ocrBadge(status: string) {
  const normalized = status || 'not_processed';
  const color = normalized === 'success'
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : normalized === 'failed'
      ? 'bg-red-50 text-red-700 border-red-200'
      : 'bg-slate-50 text-slate-600 border-slate-200';
  return <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${color}`}>{normalized.replace(/_/g, ' ')}</span>;
}

async function withSignedUrls(documents: DocumentRow[]): Promise<DocumentRow[]> {
  try {
    const adminSupabase = createAdminClient();
    return await Promise.all(documents.map(async (doc) => {
      const { data } = await adminSupabase.storage
        .from(doc.storage_bucket || 'private-documents')
        .createSignedUrl(doc.storage_path, 60 * 15);
      return { ...doc, signedUrl: data?.signedUrl || null };
    }));
  } catch (error) {
    console.warn('Unable to create dealer onboarding signed URLs', error);
    return documents.map((doc) => ({ ...doc, signedUrl: null }));
  }
}

export default async function DealerOnboardingPage() {
  const [applications, rawDocuments] = await Promise.all([
    db.select().from(dealerOnboardings).orderBy(desc(dealerOnboardings.created_at)),
    db.select().from(dealerOnboardingDocuments).orderBy(desc(dealerOnboardingDocuments.uploaded_at)),
  ]);

  const documents = await withSignedUrls(rawDocuments);
  const documentsByApplication = documents.reduce<Record<string, DocumentRow[]>>((acc, doc) => {
    acc[doc.onboarding_id] = acc[doc.onboarding_id] || [];
    acc[doc.onboarding_id].push(doc);
    return acc;
  }, {});

  const pendingCount = applications.filter((app) => app.application_status === 'pending_review').length;
  const approvedCount = applications.filter((app) => app.application_status === 'approved').length;
  const rejectedCount = applications.filter((app) => app.application_status === 'rejected').length;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Dealer Onboarding Applications</h1>
          <p className="text-sm text-slate-500 mt-1">
            Sales Admin review queue for dealer documents, OCR populated fields, and account approval.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <MetricCard icon={<Building className="w-6 h-6 text-blue-100" />} label="Total Applications" value={applications.length} className="from-blue-500 to-indigo-600 shadow-blue-200/50" />
        <MetricCard icon={<AlertCircle className="w-6 h-6 text-orange-100" />} label="Pending Review" value={pendingCount} className="from-amber-500 to-orange-500 shadow-orange-200/50" />
        <MetricCard icon={<CheckCircle className="w-6 h-6 text-emerald-100" />} label="Approved" value={approvedCount} className="from-emerald-500 to-teal-500 shadow-emerald-200/50" />
        <MetricCard icon={<XCircle className="w-6 h-6 text-red-100" />} label="Rejected" value={rejectedCount} className="from-red-500 to-rose-500 shadow-red-200/50" />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-800">Applications for Review</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 uppercase font-medium text-xs">
              <tr>
                <th className="px-6 py-4 rounded-tl-xl whitespace-nowrap">Business Details</th>
                <th className="px-6 py-4">Contact / Tax</th>
                <th className="px-6 py-4">Documents</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right rounded-tr-xl">Review</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {applications.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    <div className="flex justify-center bg-slate-50 w-16 h-16 rounded-full items-center mx-auto mb-3">
                      <Building className="w-8 h-8 text-slate-400" />
                    </div>
                    <p className="text-base font-semibold text-slate-700">No applications found</p>
                    <p className="text-sm mt-1">Dealer onboarding applications will appear here after submission.</p>
                  </td>
                </tr>
              ) : (
                applications.map((app) => {
                  const appDocuments = documentsByApplication[app.id] || [];
                  return (
                    <tr key={app.id} className="hover:bg-slate-50/50 transition-colors align-top">
                      <td className="px-6 py-4 min-w-[260px]">
                        <div className="font-semibold text-slate-900 text-base">{app.business_name}</div>
                        <div className="text-sm text-slate-500 mt-1 flex items-center gap-1.5">
                          <div className="w-5 h-5 bg-slate-100 rounded-full flex items-center justify-center text-xs font-bold text-slate-600">
                            {app.owner_name?.[0] || 'O'}
                          </div>
                          {app.owner_name}
                        </div>
                        <div className="text-xs text-slate-400 mt-1.5 flex items-start gap-1">
                          <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
                          <span className="max-w-[220px] inline-block">{app.address}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-2">Submitted {format(app.created_at, 'dd MMM yyyy, p')}</p>
                      </td>

                      <td className="px-6 py-4 min-w-[230px]">
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-2 text-slate-600 text-sm">
                            <Mail className="w-4 h-4 text-slate-400" />
                            <a href={`mailto:${app.email}`} className="hover:text-brand-600 transition-colors">{app.email}</a>
                          </div>
                          <div className="flex items-center gap-2 text-slate-600 text-sm">
                            <Phone className="w-4 h-4 text-slate-400" />
                            <a href={`tel:${app.phone}`} className="hover:text-brand-600 transition-colors">{app.phone}</a>
                          </div>
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 text-xs">GST {app.gstin}</span>
                            <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 text-xs">PAN {app.pan}</span>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 min-w-[280px]">
                        {appDocuments.length === 0 ? (
                          <p className="text-xs text-slate-400">No documents linked.</p>
                        ) : (
                          <div className="space-y-2">
                            {appDocuments.map((doc) => (
                              <div key={doc.id} className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className="text-xs font-semibold text-slate-800 capitalize">{doc.document_type.replace(/_/g, ' ')}</p>
                                    <p className="text-[11px] text-slate-500 truncate max-w-[180px]">{doc.file_name}</p>
                                  </div>
                                  {doc.signedUrl ? (
                                    <a href={doc.signedUrl} target="_blank" className="inline-flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-[11px] font-medium text-brand-700 border border-brand-100 hover:bg-brand-50">
                                      View <ExternalLink className="w-3 h-3" />
                                    </a>
                                  ) : (
                                    <span className="text-[10px] text-slate-400">stored</span>
                                  )}
                                </div>
                                <div className="mt-2 flex items-center gap-2">
                                  {ocrBadge(doc.ocr_status)}
                                  {doc.parsed_fields ? <span className="text-[10px] text-slate-400">fields parsed</span> : null}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>

                      <td className="px-6 py-4 min-w-[160px]">
                        <div className="space-y-2">
                          {statusBadge(app.application_status || 'pending_review')}
                          {app.account_id && (
                            <div className="inline-flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 rounded-lg px-2 py-1">
                              <ShieldCheck className="w-3 h-3" /> Account {app.account_id}
                            </div>
                          )}
                          {app.review_notes && <p className="text-xs text-slate-500">{app.review_notes}</p>}
                        </div>
                      </td>

                      <td className="px-6 py-4 text-right min-w-[190px]">
                        <DealerOnboardingReviewActions onboardingId={app.id} status={app.application_status || 'pending_review'} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value, className }: { icon: ReactNode; label: string; value: number; className: string }) {
  return (
    <div className={`bg-gradient-to-br p-6 rounded-2xl text-white shadow-lg ${className}`}>
      <div className="flex items-center justify-between mb-4">
        {icon}
        <span className="bg-white/20 text-xs font-semibold px-2 py-1 rounded-full">{label}</span>
      </div>
      <p className="text-3xl font-bold tracking-tight">{value}</p>
      <p className="text-white/80 text-sm mt-1">Dealer onboarding</p>
    </div>
  );
}
