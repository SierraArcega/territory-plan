"use client";
import { useEffect, useMemo, useRef } from "react";
import ContactRolePicker from "./ContactRolePicker";
import type { DocFormState, ContactRef } from "@/features/document-generation/lib/payload-types";
import {
  schoolYearFromDate,
  defaultSchoolYear,
  schoolYearOptions,
} from "@/features/document-generation/lib/school-year";

interface Props {
  state: DocFormState;
  onChange: (patch: Partial<DocFormState>) => void;
}

export default function PartiesContactsSection({ state, onChange }: Props) {
  const isBoces = state.docType === "boces_quote";

  const syOptions = useMemo(() => {
    const opts = schoolYearOptions();
    // A draft/legacy value outside the window must stay visible and selected.
    return state.schoolYear && !opts.includes(state.schoolYear)
      ? [state.schoolYear, ...opts]
      : opts;
  }, [state.schoolYear]);

  // Start-date sync: derive until the rep takes over. A loaded draft whose SY
  // already disagrees with its derived value counts as taken-over.
  const syTouched = useRef(
    state.schoolYearManual ||
      (state.schoolYear !== "" &&
        schoolYearFromDate(state.startDate) !== null &&
        state.schoolYear !== schoolYearFromDate(state.startDate)),
  );
  useEffect(() => {
    if (isBoces || state.schoolYearManual || syTouched.current) return;
    const derived = schoolYearFromDate(state.startDate);
    if (derived && derived !== state.schoolYear) onChange({ schoolYear: derived });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.startDate]);
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
        <span className="text-xs uppercase tracking-wide text-[#6E6390]">Billing address *</span>
        <input placeholder="Street, City, State ZIP" value={state.billingAddress}
          onChange={(e) => onChange({ billingAddress: e.target.value })}
          className={`w-full rounded border px-2 py-1 text-sm ${state.billingAddress.trim() ? "border-[#C2BBD4]" : "border-[#F37167]"}`} />
      </label>

      {!isBoces && (
        <label className="flex flex-col gap-1">
          <span className="flex items-center justify-between text-xs uppercase tracking-wide text-[#6E6390]">
            School year *
            <button type="button"
              className="text-[10px] normal-case tracking-normal text-[#6E6390] underline hover:text-[#403770]"
              onClick={() => {
                if (state.schoolYearManual) {
                  // Back to the selector: re-derive (or default) and resume syncing.
                  syTouched.current = false;
                  onChange({
                    schoolYearManual: false,
                    schoolYear: schoolYearFromDate(state.startDate) ?? defaultSchoolYear(),
                  });
                } else {
                  onChange({ schoolYearManual: true });
                }
              }}>
              {state.schoolYearManual ? "Use selector" : "Type manually"}
            </button>
          </span>
          {state.schoolYearManual ? (
            <input placeholder="e.g. 2026 - 2027" value={state.schoolYear}
              onChange={(e) => onChange({ schoolYear: e.target.value })}
              className={`w-full rounded border px-2 py-1 text-sm ${state.schoolYear.trim() ? "border-[#C2BBD4]" : "border-[#F37167]"}`} />
          ) : (
            <select aria-label="School year" value={state.schoolYear}
              onChange={(e) => { syTouched.current = true; onChange({ schoolYear: e.target.value }); }}
              className={`w-full rounded border px-2 py-1 text-sm ${state.schoolYear.trim() ? "border-[#C2BBD4]" : "border-[#F37167]"}`}>
              {syOptions.map((sy) => (<option key={sy} value={sy}>{sy}</option>))}
            </select>
          )}
        </label>
      )}

      {!isBoces && (
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-[#6E6390]">CC executed copy to</span>
          <input placeholder="ap@district.org, billing@district.org"
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
