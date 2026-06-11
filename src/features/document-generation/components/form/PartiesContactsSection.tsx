"use client";
import ContactRolePicker from "./ContactRolePicker";
import type { DocFormState, ContactRef } from "@/features/document-generation/lib/payload-types";

interface Props {
  state: DocFormState;
  onChange: (patch: Partial<DocFormState>) => void;
}

export default function PartiesContactsSection({ state, onChange }: Props) {
  const isBoces = state.docType === "boces_quote";
  return (
    <div className="space-y-3">
      <ContactRolePicker label="Client contact" leaid={state.districtLeaId}
        value={state.clientContact} onChange={(c: ContactRef) => onChange({ clientContact: c })} />

      {!isBoces && (
        <label className="flex items-center gap-2 text-sm whitespace-nowrap">
          <input type="checkbox" checked={state.signerSameAsClient}
            onChange={(e) => onChange({ signerSameAsClient: e.target.checked })} />
          Signer is the same person
        </label>
      )}
      {!isBoces && !state.signerSameAsClient && (
        <ContactRolePicker label="Signer" leaid={state.districtLeaId}
          value={state.signerContact} onChange={(c) => onChange({ signerContact: c })} />
      )}

      <label className="flex items-center gap-2 text-sm whitespace-nowrap">
        <input type="checkbox" checked={state.billingSameAsClient}
          onChange={(e) => onChange({ billingSameAsClient: e.target.checked })} />
        Billing contact is the same person
      </label>
      {!state.billingSameAsClient && (
        <ContactRolePicker label="Billing contact" leaid={state.districtLeaId}
          value={state.billingContact} onChange={(c) => onChange({ billingContact: c })} />
      )}

      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-[#6E6390]">Billing address</span>
        <input placeholder="Billing address (required) *" value={state.billingAddress}
          onChange={(e) => onChange({ billingAddress: e.target.value })}
          className={`w-full rounded border px-2 py-1 text-sm ${state.billingAddress.trim() ? "border-[#C2BBD4]" : "border-[#F37167]"}`} />
      </label>

      {!isBoces && (
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-[#6E6390]">School year</span>
          <input placeholder="School year (e.g. 2026 - 2027)" aria-label="School year" value={state.schoolYear}
            onChange={(e) => onChange({ schoolYear: e.target.value })}
            className="w-full rounded border border-[#C2BBD4] px-2 py-1 text-sm" />
        </label>
      )}

      {!isBoces && (
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-[#6E6390]">CC executed copy to</span>
          <input aria-label="CC executed copy to"
            placeholder="CC executed copy to (comma-separated emails)"
            value={state.ccEmails}
            onChange={(e) => onChange({ ccEmails: e.target.value })}
            className="w-full rounded border border-[#C2BBD4] px-2 py-1 text-sm" />
        </label>
      )}

      <div className="flex flex-wrap gap-2">
        <label className="flex flex-1 flex-col text-xs uppercase tracking-wide text-[#6E6390]">
          Start date
          <input aria-label="Start date" type="date" value={state.startDate}
            onChange={(e) => onChange({ startDate: e.target.value })}
            className="mt-0.5 rounded border border-[#C2BBD4] px-2 py-1 text-sm text-[#403770]" />
        </label>
        <label className="flex flex-1 flex-col text-xs uppercase tracking-wide text-[#6E6390]">
          End date
          <input aria-label="End date" type="date" value={state.endDate}
            onChange={(e) => onChange({ endDate: e.target.value })}
            className="mt-0.5 rounded border border-[#C2BBD4] px-2 py-1 text-sm text-[#403770]" />
        </label>
      </div>
    </div>
  );
}
