"use client";
import DocTypeSelector from "./DocTypeSelector";
import PartiesContactsSection from "./PartiesContactsSection";
import QuoteSection from "./QuoteSection";
import PaymentSection from "./PaymentSection";
import SectionsToggles from "./SectionsToggles";
import { getCompleteness } from "@/features/document-generation/lib/validation";
import type { DocFormState, DocType } from "@/features/document-generation/lib/payload-types";

interface Props {
  value: DocFormState;
  onChange: (next: DocFormState) => void;
  onRender: () => void;
  bookingReference: number | null;
  busy?: boolean;
}

export default function DocumentPayloadForm({ value, onChange, onRender, bookingReference, busy }: Props) {
  const patch = (p: Partial<DocFormState>) => onChange({ ...value, ...p });
  const setDocType = (docType: DocType) =>
    onChange({
      ...value,
      docType,
      // BOCES forces type C; switching back to a contract drops the BOCES-only
      // C back to the standard default so the contract doesn't carry a BOCES payment block.
      paymentType: docType === "boces_quote" ? "C" : value.paymentType === "C" ? "A" : value.paymentType,
    });
  const { isComplete, missing } = getCompleteness(value);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <DocTypeSelector value={value.docType} onChange={setDocType} />
      </div>
      <section><h3 className="text-sm font-semibold">Parties &amp; Contacts</h3>
        <PartiesContactsSection state={value} onChange={patch} /></section>
      <section><h3 className="text-sm font-semibold">Quote</h3>
        <QuoteSection state={value} bookingReference={bookingReference} onChange={patch} /></section>
      <section><h3 className="text-sm font-semibold">Payment terms</h3>
        <PaymentSection state={value} onChange={patch} /></section>
      <section><h3 className="text-sm font-semibold">Sections to append</h3>
        <SectionsToggles state={value} onChange={patch} /></section>

      <div className="sticky bottom-0 flex flex-col gap-2 border-t border-[#E2DEEC] bg-white py-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          {isComplete ? (
            <span className="text-xs text-[#6E6390]">All required fields complete ✓</span>
          ) : (
            <div role="status" className="rounded-lg bg-[#fef1f0] px-3 py-2 text-sm">
              <span className="font-medium text-[#F37167]">Missing before render:</span>
              <span className="ml-2 inline-flex flex-wrap gap-1">
                {missing.map((m) => (
                  <span key={m} className="rounded-full bg-white px-2 py-0.5 text-xs text-[#F37167] whitespace-nowrap">{m}</span>
                ))}
              </span>
            </div>
          )}
        </div>
        <button type="button" onClick={onRender} disabled={!isComplete || busy}
          className="shrink-0 rounded-lg bg-[#403770] px-3 py-1 text-sm text-white disabled:opacity-50 whitespace-nowrap">
          {busy ? "Generating… (~15–20s)" : "Render document →"}
        </button>
      </div>
    </div>
  );
}
