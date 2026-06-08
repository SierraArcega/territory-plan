"use client";
import { useState } from "react";
import GenerateDocumentModal from "@/features/document-generation/components/GenerateDocumentModal";
import { useProfile } from "@/features/shared/lib/queries";
import type { PrefillResult } from "@/features/document-generation/lib/prefill";

export default function DocumentGeneratorDevPage() {
  const { data: profile } = useProfile();
  const [open, setOpen] = useState(false);

  // Sample prefill for dev; real prefill comes from the opportunity in the entry-points sub-project.
  const prefill: PrefillResult = {
    docType: "contract", districtLeaId: "0612345", companyName: "Sample USD",
    startDate: "2026-07-01", endDate: "2027-06-30", payTerms: "Net 30",
    minAmt: null, maxAmt: null, bookingReference: 188000,
    sender: { first: (profile?.fullName ?? "Rep").split(" ")[0], last: "", title: profile?.jobTitle ?? "", email: profile?.email ?? "" },
  };

  return (
    <div className="p-6">
      <button onClick={() => setOpen(true)} className="rounded-lg bg-[#403770] px-4 py-2 text-white">
        Open Generate Document
      </button>
      {open && <GenerateDocumentModal prefill={prefill} onClose={() => setOpen(false)} />}
    </div>
  );
}
