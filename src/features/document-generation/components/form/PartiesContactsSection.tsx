"use client";
import { useEffect, useMemo, useRef } from "react";
import ContactRolePicker from "./ContactRolePicker";
import type { DocFormState, ContactRef } from "@/features/document-generation/lib/payload-types";
import {
  schoolYearFromDate,
  defaultSchoolYear,
  splitSchoolYear,
  joinSchoolYear,
  startYearOptions,
} from "@/features/document-generation/lib/school-year";

interface Props {
  state: DocFormState;
  onChange: (patch: Partial<DocFormState>) => void;
}

/** Native date inputs can't show a placeholder — browsers paint MM/DD/YYYY (or
 *  today's date on Safari) in an EMPTY box, which reads as filled. While empty
 *  and unfocused, the ghost text is made transparent and a real hint overlays
 *  it; focus reveals the segments for typing. */
function RequiredDateInput({ label, value, onValue }: { label: string; value: string; onValue: (v: string) => void }) {
  const empty = value.trim() === "";
  return (
    <div className="relative mt-0.5">
      <input aria-label={label} type="date" value={value}
        onChange={(e) => onValue(e.target.value)}
        className={`peer w-full rounded border px-2 py-1 text-sm focus:text-[#403770] ${
          empty ? "border-[#F37167] text-transparent" : "border-[#C2BBD4] text-[#403770]"
        }`} />
      {empty && (
        <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-sm normal-case tracking-normal text-[#6E6390] peer-focus:hidden">
          Select date
        </span>
      )}
    </div>
  );
}

export default function PartiesContactsSection({ state, onChange }: Props) {
  const isBoces = state.docType === "boces_quote";

  // Derive the current start/end from the canonical string; fall back to the
  // default SY for display ONLY (no write) when the value is unparseable in
  // selector mode (only possible via odd manual-mode leftovers).
  const syParsed = useMemo(() => {
    const parsed = splitSchoolYear(state.schoolYear);
    if (parsed) return parsed;
    // Fall back to default for display without writing state
    return splitSchoolYear(defaultSchoolYear())!;
  }, [state.schoolYear]);

  const syStartOptions = useMemo(() => {
    const window = startYearOptions();
    // Inject out-of-window start year so saved drafts stay visible.
    return window.includes(syParsed.start) ? window : [syParsed.start, ...window];
  }, [syParsed.start]);

  const syEndOptions = useMemo(() => {
    const base = [syParsed.start + 1, syParsed.start + 2, syParsed.start + 3];
    // Inject out-of-window end year so saved drafts stay visible.
    return base.includes(syParsed.end) ? base : [syParsed.end, ...base];
  }, [syParsed.start, syParsed.end]);

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
        // div, NOT label: a label-wrapped button becomes the label's activation
        // target, so clicking anywhere on the header row would toggle manual mode.
        <div className="flex flex-col gap-1">
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
            <div className="flex gap-2">
              <select
                aria-label="School year start"
                value={syParsed.start}
                onChange={(e) => {
                  syTouched.current = true;
                  const newStart = Number(e.target.value);
                  onChange({ schoolYear: joinSchoolYear(newStart, newStart + 1) });
                }}
                className={`flex-1 rounded border px-2 py-1 text-sm ${state.schoolYear.trim() ? "border-[#C2BBD4]" : "border-[#F37167]"}`}>
                {syStartOptions.map((yr) => (
                  <option key={yr} value={yr}>{yr}</option>
                ))}
              </select>
              <select
                aria-label="School year end"
                value={syParsed.end}
                onChange={(e) => {
                  syTouched.current = true;
                  const newEnd = Number(e.target.value);
                  onChange({ schoolYear: joinSchoolYear(syParsed.start, newEnd) });
                }}
                className={`flex-1 rounded border px-2 py-1 text-sm ${state.schoolYear.trim() ? "border-[#C2BBD4]" : "border-[#F37167]"}`}>
                {syEndOptions.map((yr) => (
                  <option key={yr} value={yr}>{yr}</option>
                ))}
              </select>
            </div>
          )}
        </div>
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
          <RequiredDateInput label="Start date" value={state.startDate}
            onValue={(v) => onChange({ startDate: v })} />
        </label>
        <label className="flex flex-1 flex-col text-xs uppercase tracking-wide text-[#6E6390]">
          End date
          <RequiredDateInput label="End date" value={state.endDate}
            onValue={(v) => onChange({ endDate: v })} />
        </label>
      </div>
    </div>
  );
}
