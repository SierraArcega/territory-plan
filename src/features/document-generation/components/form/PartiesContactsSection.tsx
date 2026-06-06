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

      <input placeholder="Billing address (required) *" value={state.billingAddress}
        onChange={(e) => onChange({ billingAddress: e.target.value })}
        className="w-full rounded border border-[#F37167] px-2 py-1 text-sm" />

      {!isBoces && (
        <input placeholder="School year (e.g. 2026 - 2027)" value={state.schoolYear}
          onChange={(e) => onChange({ schoolYear: e.target.value })}
          className="w-full rounded border border-[#C2BBD4] px-2 py-1 text-sm" />
      )}

      <div className="flex flex-wrap gap-2">
        <input placeholder="Start date" value={state.startDate}
          onChange={(e) => onChange({ startDate: e.target.value })}
          className="flex-1 rounded border border-[#EFEDF5] px-2 py-1 text-sm" />
        <input placeholder="End date" value={state.endDate}
          onChange={(e) => onChange({ endDate: e.target.value })}
          className="flex-1 rounded border border-[#EFEDF5] px-2 py-1 text-sm" />
      </div>
    </div>
  );
}
