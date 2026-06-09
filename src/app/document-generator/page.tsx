"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchJson, API_BASE } from "@/features/shared/lib/api-client";
import GenerateDocumentModal from "@/features/document-generation/components/GenerateDocumentModal";
import { useProfile } from "@/features/shared/lib/queries";
import { useDistrictDetail } from "@/features/districts/lib/queries";
import { formatDistrictAddress, type PrefillResult } from "@/features/document-generation/lib/prefill";
import { appsScriptRenderClient } from "@/features/document-generation/lib/render-client";
import DistrictPickerCombobox from "@/features/document-generation/components/DistrictPickerCombobox";

interface DistrictsResp {
  districts: { leaid: string; name: string }[];
}

export default function DocumentGeneratorDevPage() {
  const { data: profile } = useProfile();
  // Dev harness: pull a real district so contact lookup/create works (contacts FK
  // to an existing district). In production the entry point passes the opportunity's
  // real districtLeaId. You can paste a specific LEA ID below to target your own data.
  const { data } = useQuery({
    queryKey: ["dev-doc-gen-district"],
    queryFn: () => fetchJson<DistrictsResp>(`${API_BASE}/districts?limit=1`),
    staleTime: 5 * 60 * 1000,
  });
  const sampleDistrict = data?.districts?.[0];
  const [leaidOverride, setLeaidOverride] = useState("");
  const [open, setOpen] = useState(false);

  const leaid = (leaidOverride.trim() || sampleDistrict?.leaid || "").trim();
  // District detail gives us the name + address to pre-fill billing. Gate the modal
  // on this resolving so the prefill is complete before the form seeds its state
  // (the modal seeds once on open). Production entry points should likewise build a
  // complete prefill before opening.
  const { data: detail, isFetching: detailLoading } = useDistrictDetail(leaid || null);
  const companyName = detail?.district?.name ?? (leaidOverride.trim() ? "" : sampleDistrict?.name ?? "");
  const billingAddress = detail?.district ? formatDistrictAddress(detail.district) : "";

  const prefill: PrefillResult = {
    docType: "contract",
    districtLeaId: leaid,
    companyName: companyName || "Sample District",
    billingAddress,
    startDate: "2026-07-01",
    endDate: "2027-06-30",
    payTerms: "Net 30",
    minAmt: null,
    maxAmt: null,
    bookingReference: 188000,
    sender: {
      first: (profile?.fullName ?? "Rep").trim().split(/\s+/)[0],
      last: (profile?.fullName ?? "").trim().split(/\s+/).slice(1).join(" "),
      title: profile?.jobTitle ?? "",
      email: profile?.email ?? "",
    },
  };

  return (
    <div className="space-y-3 p-6">
      <p className="text-sm text-[#6E6390]">
        Dev harness. Contacts attach to a real district —{" "}
        {sampleDistrict ? (
          <>using <strong className="text-[#403770]">{sampleDistrict.name} ({sampleDistrict.leaid})</strong> by default.</>
        ) : (
          "loading a district…"
        )}
      </p>
      <div className="max-w-md space-y-1">
        <span className="block text-xs uppercase tracking-wide text-[#6E6390]">Find a district by name</span>
        <DistrictPickerCombobox onSelect={(d) => setLeaidOverride(d.leaid)} />
        {leaidOverride.trim() && (
          <p className="text-xs text-[#6E6390]">
            Selected LEA ID <strong className="text-[#403770]">{leaidOverride.trim()}</strong>
            {detailLoading ? " — loading…" : detail?.district ? ` — ${detail.district.name}` : ""}
          </p>
        )}
      </div>
      <button
        onClick={() => setOpen(true)}
        disabled={!leaid || detailLoading || !detail}
        className="rounded-lg bg-[#403770] px-4 py-2 text-white disabled:opacity-50"
      >
        {leaid && (detailLoading || !detail) ? "Loading district…" : "Open Generate Document"}
      </button>
      {open && detail && (
        <GenerateDocumentModal prefill={prefill} onClose={() => setOpen(false)} renderClient={appsScriptRenderClient} />
      )}
    </div>
  );
}
