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
}

export default function DocumentPayloadForm({ value, onChange, onRender, bookingReference }: Props) {
  const patch = (p: Partial<DocFormState>) => onChange({ ...value, ...p });
  const setDocType = (docType: DocType) =>
    onChange({ ...value, docType, paymentType: docType === "boces_quote" ? "C" : value.paymentType });
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
        <span className="text-xs text-[#6E6390]">
          {isComplete ? "All required fields complete ✓" : `Missing: ${missing.join(", ")}`}
        </span>
        <button type="button" onClick={onRender} disabled={!isComplete}
          className="shrink-0 rounded-lg bg-[#403770] px-3 py-1 text-sm text-white disabled:opacity-50 whitespace-nowrap">
          Render document →
        </button>
      </div>
    </div>
  );
}
