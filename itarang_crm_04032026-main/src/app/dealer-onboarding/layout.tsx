import type { ReactNode } from "react";

export default function DealerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      <header className="bg-white border-b border-[#E3E8EF]">
        <div className="max-w-7xl mx-auto px-8 py-4 flex justify-between">
          <div>
            <h1 className="text-lg font-semibold text-[#173F63]">Dealer Onboarding</h1>
            <p className="text-sm text-gray-500">Complete business verification</p>
          </div>
          <div className="text-sm text-gray-500">Documents + OCR + Sales Admin Review</div>
        </div>
      </header>
      {children}
    </div>
  );
}
