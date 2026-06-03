"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle, Loader2, XCircle } from "lucide-react";

export function DealerOnboardingReviewActions({
  onboardingId,
  status,
}: {
  onboardingId: string;
  status: string;
}) {
  const router = useRouter();
  const [loadingAction, setLoadingAction] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function review(action: "approve" | "reject") {
    setLoadingAction(action);
    setError(null);

    try {
      const response = await fetch(`/api/dealer-onboarding/${onboardingId}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result?.error?.message || `Unable to ${action} application`);
      }
      router.refresh();
    } catch (reviewError: unknown) {
      setError(reviewError instanceof Error ? reviewError.message : "Review action failed");
    } finally {
      setLoadingAction(null);
    }
  }

  const isFinal = status === "approved" || status === "rejected";

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => review("approve")}
          disabled={isFinal || Boolean(loadingAction)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loadingAction === "approve" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
          Approve
        </button>
        <button
          type="button"
          onClick={() => review("reject")}
          disabled={isFinal || Boolean(loadingAction)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loadingAction === "reject" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
          Reject
        </button>
      </div>
      {error && <p className="max-w-48 text-right text-xs text-red-600">{error}</p>}
    </div>
  );
}
