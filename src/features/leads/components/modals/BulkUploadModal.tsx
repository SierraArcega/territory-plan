"use client";

// Bulk upload — segmented "Leads" vs "Activity & engagement" datasets, a drop
// step (drag or browse a CSV) and a map/preview step per LeadModals.jsx. The
// preview is the SERVER's resolution plan (`?dryRun=1` on the import routes)
// so what the user approves and what the import writes share one code path:
// activity rows show Contact · School · District chips with NEW badges and a
// "via NCES" tag; leads rows show a creation preview. Import → toast with the
// summary counts ("N events imported · X to active leads · Y retained on
// records") and the lead lists refetch.

import { useRef, useState, type DragEvent } from "react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  FileText,
  GraduationCap,
  Link2,
  MessageSquare,
  School,
  TriangleAlert,
  Upload,
  UserCheck,
  Users,
} from "lucide-react";
import { useToast } from "@/features/shared/components/Toast";
import { useProfile, useUsers } from "@/features/shared/lib/queries";
import { downloadCsv, parseCsv, type ParsedCsv } from "@/features/shared/lib/csv";
import { fmtDate } from "@/features/shared/lib/date-utils";
import {
  useActivityImportDryRun,
  useActivityImportMutation,
  useLeadImportDryRun,
  useLeadImportMutation,
} from "@/features/leads/lib/queries";
import {
  ACTIVITY_FIELD_DEFS,
  LEAD_FIELD_DEFS,
  MAX_IMPORT_ROWS,
  activityTemplateCsv,
  buildHeaderMapping,
  importErrorCopy,
  importWarningCopy,
  leadTemplateCsv,
  toActivityImportRows,
  toLeadImportRows,
  type ActivityImportPlan,
  type ActivityImportRowInput,
  type HeaderMapping,
  type LeadImportPlan,
} from "@/features/leads/lib/import";
import { leadTypeConfig } from "@/features/leads/lib/status-config";
import MicroLabel from "../bits/MicroLabel";
import ScorePill from "../bits/ScorePill";
import LeadTypeBadge from "../bits/LeadTypeBadge";
import LeadModalShell, {
  BTN_GHOST,
  BTN_PRIMARY,
  ChoiceButton,
  FieldLabel,
  SELECT_CLASS,
} from "./modal-chrome";

type Dataset = "leads" | "activity";
type Step = "drop" | "map";

const NEW_BADGE =
  "rounded-full bg-[#EFECFB] px-[5px] text-[9px] font-bold leading-[14px] text-[#5A4F9E]";

function NewBadge() {
  return <span className={NEW_BADGE}>NEW</span>;
}

/** "via NCES" / "via name" district-resolution tag in the preview rows. */
function ViaTag({ label, title }: { label: string; title: string }) {
  return (
    <span
      title={title}
      className="inline-flex items-center gap-[3px] whitespace-nowrap rounded-full bg-[#EFECFB] px-1.5 py-px text-[9px] font-bold text-[#5A4F9E]"
    >
      <Link2 size={9} aria-hidden />
      {label}
    </span>
  );
}

function ResolutionViaTags({ viaNces, viaName }: { viaNces: boolean; viaName: boolean }) {
  return (
    <>
      {viaNces && <ViaTag label="via NCES" title="District resolved from the school's NCES id" />}
      {viaName && <ViaTag label="via name" title="District matched by name and state" />}
    </>
  );
}

/** Golden non-fatal warning chips (nces_name_conflict, duplicate_email, …).
    Chips truncate to their container with the full copy on hover, so long
    warning sentences can never dictate column widths. */
function WarningChips({ warnings }: { warnings: string[] }) {
  return (
    <>
      {warnings.map((code) => {
        const copy = importWarningCopy(code);
        return (
          <span
            key={code}
            title={copy}
            className="inline-flex min-w-0 max-w-full items-center gap-[3px] rounded-full bg-[#fffaf1] px-1.5 py-px text-[9px] font-bold text-[#8A6A00]"
          >
            <TriangleAlert size={9} className="shrink-0" aria-hidden />
            <span className="truncate">{copy}</span>
          </span>
        );
      })}
    </>
  );
}

export interface BulkUploadModalProps {
  onClose: () => void;
}

export default function BulkUploadModal({ onClose }: BulkUploadModalProps) {
  const [dataset, setDataset] = useState<Dataset>("leads");
  const [step, setStep] = useState<Step>("drop");
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<ParsedCsv | null>(null);
  const [mapping, setMapping] = useState<HeaderMapping | null>(null);
  const [leadPlan, setLeadPlan] = useState<LeadImportPlan | null>(null);
  const [activityPlan, setActivityPlan] = useState<ActivityImportPlan | null>(null);
  const [activityRows, setActivityRows] = useState<ActivityImportRowInput[]>([]);
  const [dropError, setDropError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [bdr, setBdr] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: profile } = useProfile();
  const { data: users, isLoading: usersLoading } = useUsers();
  const { showToast } = useToast();
  const leadDryRun = useLeadImportDryRun();
  const activityDryRun = useActivityImportDryRun();
  const leadImport = useLeadImportMutation();
  const activityImport = useActivityImportMutation();

  const isActivity = dataset === "activity";
  // Assign-all-to default: the current user (UX rule).
  const bdrValue = bdr ?? profile?.id ?? "";

  const reset = () => {
    setStep("drop");
    setFileName("");
    setParsed(null);
    setMapping(null);
    setLeadPlan(null);
    setActivityPlan(null);
    setActivityRows([]);
    setDropError(null);
    setDragOver(false);
  };

  const setDs = (d: Dataset) => {
    setDataset(d);
    reset();
  };

  // ---- Step 1 → 2: parse, map, dry-run ----------------------------------------
  const ingestFile = async (file: File) => {
    setDropError(null);
    let text: string;
    try {
      text = await file.text();
    } catch {
      setDropError("Couldn't read that file — try again.");
      return;
    }
    const csv = parseCsv(text);
    if (csv.rows.length === 0) {
      setDropError("No data rows found — the file needs a header row plus at least one row.");
      return;
    }
    if (csv.rows.length > MAX_IMPORT_ROWS) {
      setDropError(
        `Up to ${MAX_IMPORT_ROWS} rows per import — this file has ${csv.rows.length}. Split it and retry.`,
      );
      return;
    }
    const defs = isActivity ? ACTIVITY_FIELD_DEFS : LEAD_FIELD_DEFS;
    const map = buildHeaderMapping(csv.headers, defs);
    if (map.missingRequired.length > 0) {
      setDropError(`Missing required column${map.missingRequired.length === 1 ? "" : "s"}: ${map.missingRequired.join(", ")}.`);
      return;
    }
    setFileName(file.name);
    setParsed(csv);
    setMapping(map);
    try {
      if (isActivity) {
        const rows = toActivityImportRows(csv, map);
        setActivityRows(rows);
        setActivityPlan(await activityDryRun.mutateAsync(rows));
      } else {
        setLeadPlan(
          await leadDryRun.mutateAsync(toLeadImportRows(csv, map, bdrValue || undefined)),
        );
      }
      setStep("map");
    } catch (error) {
      const message =
        error instanceof Error ? error.message.replace(/^\d{3}:\s*/, "") : "Preview failed";
      setDropError(message || "Preview failed — try again.");
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void ingestFile(file);
  };

  const downloadTemplate = () => {
    downloadCsv(
      isActivity ? "engagement-template.csv" : "leads-template.csv",
      isActivity ? activityTemplateCsv() : leadTemplateCsv(),
    );
  };

  // ---- Step 2: import -----------------------------------------------------------
  const okCount = isActivity
    ? (activityPlan?.summary.total ?? 0) - (activityPlan?.summary.failed ?? 0)
    : (leadPlan?.summary.toCreate ?? 0);
  const importing = leadImport.isPending || activityImport.isPending;

  const runImport = async () => {
    if (!parsed || !mapping || importing) return;
    try {
      if (isActivity) {
        const result = await activityImport.mutateAsync(activityRows);
        showToast(
          `${result.summary.imported} events imported · ${result.summary.toActiveLeads ?? 0} to active leads · ${result.summary.retained ?? 0} retained on records`,
          { tone: "success" },
        );
      } else {
        const result = await leadImport.mutateAsync(
          toLeadImportRows(parsed, mapping, bdrValue || undefined),
        );
        const bdrName = users?.find((u) => u.id === bdrValue)?.fullName;
        showToast(
          `${result.summary.imported} leads imported${bdrName ? ` · assigned to ${bdrName}` : ""}`,
          { tone: "success" },
        );
      }
      onClose();
    } catch (error) {
      const message =
        error instanceof Error ? error.message.replace(/^\d{3}:\s*/, "") : "Import failed";
      showToast(message || "Import failed", { tone: "alert" });
    }
  };

  // ---- Render ---------------------------------------------------------------------
  return (
    <LeadModalShell
      title="Bulk upload"
      subtitle={
        isActivity
          ? "Import engagement events and match them to leads"
          : "Import leads from a spreadsheet"
      }
      onClose={onClose}
      maxWidth="max-w-[620px]"
      footer={
        step === "map" ? (
          <>
            <button type="button" onClick={reset} className={BTN_GHOST}>
              Back
            </button>
            <button
              type="button"
              onClick={runImport}
              disabled={okCount === 0 || importing}
              className={BTN_PRIMARY}
            >
              <Upload size={15} aria-hidden />
              {isActivity ? `Import ${okCount} events` : `Import ${okCount} leads`}
            </button>
          </>
        ) : null
      }
    >
      {/* Dataset toggle */}
      <div className="mb-[18px] flex gap-2">
        <ChoiceButton active={!isActivity} onClick={() => setDs("leads")}>
          <UserCheck size={14} aria-hidden />
          Leads
        </ChoiceButton>
        <ChoiceButton active={isActivity} onClick={() => setDs("activity")}>
          <MessageSquare size={14} aria-hidden />
          Activity &amp; engagement
        </ChoiceButton>
      </div>

      {/* Stepper */}
      <div className="mb-5 flex items-center gap-2">
        {(
          [
            ["drop", "Upload file"],
            ["map", isActivity ? "Map & match" : "Map columns"],
          ] as const
        ).map(([key, label], i) => {
          const active = step === key || (step === "map" && key === "drop");
          const current = step === key;
          return (
            <span key={key} className="contents">
              <span
                className={`inline-flex items-center gap-[7px] whitespace-nowrap text-xs ${
                  current ? "font-bold" : "font-semibold"
                }`}
                style={{ color: active ? "#403770" : "#B8B0D0" }}
              >
                <span
                  className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold"
                  style={{
                    background: active ? "#F37167" : "#EFEDF5",
                    color: active ? "#fff" : "#A69DC0",
                  }}
                >
                  {i + 1}
                </span>
                {label}
              </span>
              {i === 0 && <span className="h-px w-7 shrink-0 bg-[#E2DEEC]" />}
            </span>
          );
        })}
      </div>

      {step === "drop" && (
        <div>
          <div
            role="button"
            tabIndex={0}
            aria-label="Upload CSV file"
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={`cursor-pointer rounded-xl border-2 border-dashed bg-[#FAF8FC] px-6 py-9 text-center transition-colors duration-[120ms] ${
              dragOver ? "border-[#F37167]" : "border-[#C2BBD4] hover:border-[#F37167]"
            }`}
          >
            <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#EFEDF5] text-[#6E6390]">
              <Upload size={22} aria-hidden />
            </div>
            <div className="text-sm font-semibold text-[#403770]">
              {leadDryRun.isPending || activityDryRun.isPending
                ? "Building the preview…"
                : "Drop a CSV file here"}
            </div>
            <div className="mt-1 text-xs text-[#8A80A8]">
              or click to browse · .csv up to {MAX_IMPORT_ROWS} rows
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              aria-label="CSV file"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void ingestFile(file);
                e.target.value = "";
              }}
            />
          </div>

          {dropError && (
            <div className="mt-3 rounded-[10px] border border-[#F7C9C5] bg-[#FEF1F0] px-3.5 py-2.5 text-xs font-semibold text-[#C25A52]">
              {dropError}
            </div>
          )}

          <div className="mt-3.5 flex items-center gap-2 rounded-[10px] border border-[#E2DEEC] bg-[#FFFCFA] px-3.5 py-2.5 text-xs text-[#8A80A8]">
            <FileText size={15} className="shrink-0 text-[#A69DC0]" aria-hidden />
            <span className="min-w-0">
              {isActivity
                ? "Required: Lead Email, Activity Type, Date. Events match the contact by email. For someone at a specific school, include the School NCES — the district is looked up from it."
                : "Required: Email. New contacts also need First + Last and a district — an NCES ID (district or school), or a district/company name plus State for name matching."}
            </span>
            <button
              type="button"
              onClick={downloadTemplate}
              className="ml-auto whitespace-nowrap font-semibold text-[#6EA3BE] hover:text-[#4D7285]"
            >
              Download template
            </button>
          </div>
        </div>
      )}

      {step === "map" && parsed && mapping && (
        <div>
          {/* Parse banner */}
          <div className="mb-3.5 flex items-center gap-2 rounded-[10px] bg-[#EAF8E0] px-[13px] py-[9px] text-[12.5px] font-semibold text-[#56792F]">
            <CheckCircle2 size={15} className="shrink-0" aria-hidden />
            <span className="min-w-0 truncate">
              {fileName} · {parsed.rows.length} row{parsed.rows.length === 1 ? "" : "s"} detected
              · columns auto-mapped
            </span>
          </div>

          {/* Column mapping */}
          <MicroLabel className="mb-2.5">Column mapping</MicroLabel>
          <div className="mb-[18px] grid grid-cols-1 gap-2 sm:grid-cols-2">
            {mapping.mapped.map(({ header, field }) => (
              <div
                key={field.key}
                className="flex items-center gap-2 rounded-lg border border-[#EDEAF4] bg-[#FAF8FC] px-2.5 py-[7px] text-[12.5px]"
              >
                <span className="min-w-0 truncate text-[#8A80A8]">{header}</span>
                <ArrowRight size={13} className="shrink-0 text-[#C2BBD4]" aria-hidden />
                <span className="ml-auto whitespace-nowrap font-semibold text-[#403770]">
                  {field.label}
                </span>
                <Check size={13} className="shrink-0 text-[#69B34A]" aria-hidden />
              </div>
            ))}
          </div>
          {mapping.unmapped.length > 0 && (
            <div className="-mt-3 mb-[18px] text-[11px] text-[#9A7B3F]">
              Ignored column{mapping.unmapped.length === 1 ? "" : "s"}:{" "}
              {mapping.unmapped.join(", ")}
            </div>
          )}

          {/* Resolution preview */}
          <MicroLabel className="mb-2">
            {isActivity
              ? `Resolution · ${parsed.rows.length} events → contact + district`
              : `Preview · ${parsed.rows.length} rows`}
          </MicroLabel>
          {isActivity && activityPlan ? (
            <ActivityResolutionList plan={activityPlan} rows={activityRows} />
          ) : leadPlan ? (
            <LeadPreviewList plan={leadPlan} parsed={parsed} mapping={mapping} />
          ) : null}

          {/* Summary / assignment */}
          {isActivity && activityPlan ? (
            <div className="mt-[18px] flex items-start gap-2 rounded-[10px] border border-[#E2DEEC] bg-[#FFFCFA] px-3.5 py-[11px] text-[11.5px] leading-[1.5] text-[#8A80A8]">
              <MessageSquare size={15} className="mt-px shrink-0 text-[#A69DC0]" aria-hidden />
              <span>
                <strong className="font-bold text-[#403770]">
                  {activityPlan.summary.toActiveLeads}
                </strong>{" "}
                event{activityPlan.summary.toActiveLeads === 1 ? "" : "s"} attach to an active
                lead and add to its engagement score.{" "}
                <strong className="font-bold text-[#56792F]">
                  {activityPlan.summary.retained}
                </strong>{" "}
                attach to a contact with no active lead — retained on the records. Each event
                lives on the contact, their school, and the district (resolved by NCES), so it
                survives a disqualification or sales-qualification.
              </span>
            </div>
          ) : !isActivity && leadPlan ? (
            <div className="mt-[18px] flex flex-wrap items-end gap-3.5">
              <div className="min-w-[200px] flex-1">
                <FieldLabel>Assign all to BDR</FieldLabel>
                {/* Wait for the profile too — rendering the select while
                    bdrValue is "" makes the browser display the first user
                    alphabetically as if selected (real imports went to the
                    wrong BDR this way). */}
                {usersLoading || !users || !profile ? (
                  <select
                    disabled
                    aria-label="Assign all to BDR"
                    className={`${SELECT_CLASS} text-[#A69DC0]`}
                  >
                    <option>Loading…</option>
                  </select>
                ) : (
                  <select
                    value={bdrValue}
                    onChange={(e) => setBdr(e.target.value)}
                    aria-label="Assign all to BDR"
                    className={SELECT_CLASS}
                  >
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.fullName ?? u.email}
                        {u.id === profile?.id ? " (You)" : ""}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="min-w-[200px] flex-1 pb-[9px] text-[11.5px] leading-[1.5] text-[#8A80A8]">
                <strong className="font-bold text-[#403770]">{leadPlan.summary.toCreate}</strong>{" "}
                row{leadPlan.summary.toCreate === 1 ? "" : "s"} import as{" "}
                <strong className="font-bold text-[#403770]">New</strong> with their mapped lead
                type
                {leadPlan.summary.newContacts > 0 && (
                  <>
                    {" "}
                    · <strong className="font-bold text-[#5A4F9E]">
                      {leadPlan.summary.newContacts}
                    </strong>{" "}
                    new contact{leadPlan.summary.newContacts === 1 ? "" : "s"}
                  </>
                )}
                {leadPlan.summary.failed > 0 && (
                  <>
                    {" "}
                    · <strong className="font-bold text-[#C25A52]">
                      {leadPlan.summary.failed}
                    </strong>{" "}
                    skipped
                  </>
                )}
                .
              </div>
            </div>
          ) : null}
        </div>
      )}
    </LeadModalShell>
  );
}

// ---- Activity resolution list -------------------------------------------------------

const ACT_KIND_LABEL: Record<string, string> = {
  email: "Mixmax Campaign",
  call: "Discovery Call",
  meeting: "Meeting",
  webinar: "Webinar",
  form: "Form Fill",
  web: "Web Activity",
  note: "Note",
};

function ActivityResolutionList({
  plan,
  rows,
}: {
  plan: ActivityImportPlan;
  rows: ActivityImportRowInput[];
}) {
  return (
    <div className="flex max-h-72 flex-col gap-2 overflow-y-auto pr-0.5">
      {plan.rows.map((res) => {
        const row = rows[res.index];
        const chip = !res.ok
          ? { bg: "#FEF1F0", fg: "#C25A52", label: importErrorCopy(res.error ?? "failed") }
          : res.leadId
            ? { bg: "#FEF2F1", fg: "#C25A52", label: "To active lead" }
            : { bg: "#EAF8E0", fg: "#56792F", label: "Retained on record" };
        return (
          <div
            key={res.index}
            className={`rounded-[10px] border bg-white px-[11px] py-[9px] ${
              res.ok ? "border-[#E2DEEC]" : "border-[#F7C9C5]"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="shrink-0 whitespace-nowrap text-[9.5px] font-bold uppercase tracking-[0.05em] text-[#A69DC0]">
                {ACT_KIND_LABEL[row?.kind ?? ""] ?? row?.kind ?? "Event"}
              </span>
              <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-[#403770]">
                {row?.title ?? "Imported engagement"}
              </span>
              {row?.occurredAt && (
                <span className="shrink-0 whitespace-nowrap text-[11px] text-[#9E97B8]">
                  {fmtDate(row.occurredAt)}
                </span>
              )}
              {(res.points ?? 0) > 0 && (
                <span className="shrink-0 whitespace-nowrap text-[11px] font-bold tabular-nums text-[#56792F]">
                  +{res.points}
                </span>
              )}
            </div>
            <div className="mt-[7px] flex flex-wrap items-center gap-[7px]">
              <ArrowRight size={12} className="shrink-0 text-[#C2BBD4]" aria-hidden />
              <span className="inline-flex items-center gap-1 whitespace-nowrap text-[11.5px] font-semibold text-[#403770]">
                <Users size={12} className="text-[#7A6FD0]" aria-hidden />
                {res.contact?.name ?? "—"}
                {res.contact?.willCreate && <NewBadge />}
              </span>
              {res.school && (
                <>
                  <span className="text-[#D4CFE2]">·</span>
                  <span className="inline-flex items-center gap-1 whitespace-nowrap text-[11.5px] text-[#5C5277]">
                    <GraduationCap size={12} className="text-[#6EA3BE]" aria-hidden />
                    {res.school.name ?? res.school.ncessch}
                  </span>
                </>
              )}
              <span className="text-[#D4CFE2]">·</span>
              <span className="inline-flex items-center gap-1 whitespace-nowrap text-[11.5px] text-[#5C5277]">
                <School size={12} className="text-[#6EA3BE]" aria-hidden />
                {res.district?.name ?? (res.district ? `NCES ${res.district.leaid}` : "—")}
                {res.district?.willCreate && (
                  <span className="rounded-full bg-[#E8F1F5] px-[5px] text-[9px] font-bold leading-[14px] text-[#4D7285]">
                    NEW
                  </span>
                )}
              </span>
              <ResolutionViaTags viaNces={res.viaNces} viaName={res.viaName} />
              <WarningChips warnings={res.warnings} />
              <span
                className="ml-auto whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold"
                style={{ background: chip.bg, color: chip.fg }}
              >
                {chip.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---- Leads preview table --------------------------------------------------------------

function LeadPreviewList({
  plan,
  parsed,
  mapping,
}: {
  plan: LeadImportPlan;
  parsed: ParsedCsv;
  mapping: HeaderMapping;
}) {
  const cell = (index: number, key: string): string => {
    const header = mapping.byField[key];
    return header !== undefined ? (parsed.rows[index]?.[header] ?? "") : "";
  };
  const name = (index: number, res: LeadImportPlan["rows"][number]): string =>
    res.contact?.name ??
    cell(index, "name") ??
    [cell(index, "first"), cell(index, "last")].filter(Boolean).join(" ");

  return (
    <div className="max-h-72 overflow-y-auto overflow-x-auto rounded-lg border border-[#E2DEEC]">
      {/* Fixed layout — long names/warnings truncate inside their columns
          instead of dictating widths (narrow-width resilience). */}
      <table className="w-full min-w-[560px] table-fixed border-collapse text-[11.5px]">
        <colgroup>
          <col className="w-[24%]" />
          <col className="w-[40%]" />
          <col className="w-[13%]" />
          <col className="w-[9%]" />
          <col className="w-[14%]" />
        </colgroup>
        <thead>
          <tr className="bg-[#F7F5FA]">
            {["Name", "District", "Type", "Score", ""].map((h, i) => (
              <th
                key={i}
                className={`whitespace-nowrap px-2.5 py-[7px] text-[10px] font-bold uppercase tracking-[0.05em] text-[#6E6390] ${
                  h === "Score" ? "text-right" : "text-left"
                }`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {plan.rows.map((res) => {
            const scoreRaw = Number(cell(res.index, "score"));
            return (
              <tr key={res.index} className="border-t border-[#EFEDF5]">
                <td className="px-2.5 py-[7px] font-semibold text-[#403770]">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate" title={name(res.index, res) || undefined}>
                      {name(res.index, res) || "—"}
                    </span>
                    {res.contact?.willCreate && <NewBadge />}
                  </span>
                </td>
                <td className="px-2.5 py-[7px] text-[#5C5277]">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span
                        className="truncate"
                        title={res.district?.name ?? undefined}
                      >
                        {res.district?.name ??
                          (res.district ? `NCES ${res.district.leaid}` : "—")}
                      </span>
                      <ResolutionViaTags viaNces={res.viaNces} viaName={res.viaName} />
                    </span>
                    {res.ok && res.warnings.length > 0 && (
                      <span className="flex min-w-0 flex-wrap gap-1">
                        <WarningChips warnings={res.warnings} />
                      </span>
                    )}
                  </div>
                </td>
                <td className="whitespace-nowrap px-2.5 py-[7px]">
                  <LeadTypeBadge
                    type={res.leadType ?? leadTypeConfig(cell(res.index, "leadType")).key}
                    size="sm"
                  />
                </td>
                <td className="whitespace-nowrap px-2.5 py-[7px] text-right">
                  <ScorePill score={Number.isFinite(scoreRaw) ? scoreRaw : 0} />
                </td>
                <td className="px-2.5 py-[7px] text-right">
                  {!res.ok && (
                    <span
                      title={importErrorCopy(res.error ?? "failed")}
                      className="inline-flex min-w-0 max-w-full rounded-full bg-[#FEF1F0] px-2 py-0.5 text-[10px] font-bold text-[#C25A52]"
                    >
                      <span className="truncate">{importErrorCopy(res.error ?? "failed")}</span>
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
