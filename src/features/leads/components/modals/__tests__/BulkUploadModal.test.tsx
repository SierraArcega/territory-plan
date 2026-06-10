import { describe, expect, it, beforeEach, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ToastProvider } from "@/features/shared/components/Toast";
import type { ActivityImportPlan, LeadImportPlan } from "@/features/leads/lib/import";

const leadDryRunMock = vi.fn();
const activityDryRunMock = vi.fn();
const leadImportMock = vi.fn();
const activityImportMock = vi.fn();

vi.mock("@/features/leads/lib/queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/leads/lib/queries")>();
  return {
    ...actual,
    useLeadImportDryRun: () => ({ mutateAsync: leadDryRunMock, isPending: false }),
    useActivityImportDryRun: () => ({ mutateAsync: activityDryRunMock, isPending: false }),
    useLeadImportMutation: () => ({ mutateAsync: leadImportMock, isPending: false }),
    useActivityImportMutation: () => ({ mutateAsync: activityImportMock, isPending: false }),
  };
});

vi.mock("@/features/shared/lib/queries", () => ({
  useProfile: () => ({ data: { id: "me-1", fullName: "Sierra Arcega" } }),
  useUsers: () => ({
    data: [
      { id: "me-1", fullName: "Sierra Arcega", avatarUrl: null, email: "s@x.com", jobTitle: null },
    ],
    isLoading: false,
  }),
}));

import BulkUploadModal from "../BulkUploadModal";

// ---- Fixtures -----------------------------------------------------------------

const ACTIVITY_CSV = [
  "Lead Email,Activity Type,Subject / Detail,Date,Points,School NCES",
  "kwhitfield@mvusd51.org,webinar,Attended IEP webinar,2026-05-29,40,",
  "rsantos@galena.k12.ak.us,webinar,Attended rural staffing webinar,2026-05-22,40,020009000234",
  "bad-email,email,Clicked link,2026-05-30,12,",
].join("\n");

const ACTIVITY_PLAN: ActivityImportPlan = {
  dryRun: true,
  rows: [
    {
      index: 0,
      ok: true,
      error: null,
      warnings: [],
      contact: { id: 11, name: "Karen Whitfield", email: "kwhitfield@mvusd51.org", willCreate: false },
      school: null,
      district: { leaid: "0802940", name: "Mesa Valley USD 51", willCreate: false },
      viaNces: false,
      leadId: "lead-1",
      points: 40,
    },
    {
      index: 1,
      ok: true,
      error: null,
      warnings: [],
      contact: { id: null, name: "Ramona Santos", email: "rsantos@galena.k12.ak.us", willCreate: true },
      school: { ncessch: "020009000234", name: "Galena Interior Learning Academy" },
      district: { leaid: "0200090", name: "Galena City School District", willCreate: true },
      viaNces: true,
      leadId: null,
      points: 40,
    },
    {
      index: 2,
      ok: false,
      error: "invalid_email",
      warnings: [],
      contact: null,
      school: null,
      district: null,
      viaNces: false,
      leadId: null,
      points: 12,
    },
  ],
  summary: { total: 3, toActiveLeads: 1, retained: 1, failed: 1 },
};

const LEADS_CSV = [
  "Email,First Name,Last Name,Title,District NCES ID,Lead Type,Engagement Score",
  "otran@usd313.org,Olivia,Tran,Director of Curriculum,2000360,inbound,121",
  "dupe@usd313.org,Dana,Lee,Principal,2000360,mql,99",
].join("\n");

const LEAD_PLAN: LeadImportPlan = {
  dryRun: true,
  rows: [
    {
      index: 0,
      ok: true,
      error: null,
      warnings: [],
      contact: { id: null, name: "Olivia Tran", email: "otran@usd313.org", willCreate: true },
      school: null,
      district: { leaid: "2000360", name: "Reno County USD 313", willCreate: false },
      viaNces: false,
      assignedBdrId: "me-1",
      leadType: "inbound",
    },
    {
      index: 1,
      ok: false,
      error: "contact_has_active_lead",
      warnings: [],
      contact: { id: 9, name: "Dana Lee", email: "dupe@usd313.org", willCreate: false },
      school: null,
      district: { leaid: "2000360", name: "Reno County USD 313", willCreate: false },
      viaNces: false,
      assignedBdrId: "me-1",
      leadType: "mql",
    },
  ],
  summary: { total: 2, toCreate: 1, newContacts: 1, newDistricts: 0, failed: 1 },
};

function csvFile(content: string, name: string): File {
  const file = new File([content], name, { type: "text/csv" });
  // jsdom Files lack .text() in some versions — polyfill deterministically.
  if (typeof file.text !== "function") {
    Object.defineProperty(file, "text", { value: () => Promise.resolve(content) });
  }
  return file;
}

function renderModal() {
  const onClose = vi.fn();
  render(
    <ToastProvider>
      <BulkUploadModal onClose={onClose} />
    </ToastProvider>,
  );
  return { onClose };
}

async function uploadFile(content: string, name: string) {
  const input = screen.getByLabelText("CSV file") as HTMLInputElement;
  fireEvent.change(input, { target: { files: [csvFile(content, name)] } });
  await waitFor(() => expect(screen.queryByText(/columns auto-mapped/)).toBeTruthy());
}

describe("BulkUploadModal — activity dataset", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    activityDryRunMock.mockResolvedValue(ACTIVITY_PLAN);
    activityImportMock.mockResolvedValue({
      succeeded: [0, 1],
      failed: [{ index: 2, reason: "invalid_email" }],
      warnings: [],
      summary: { imported: 2, toActiveLeads: 1, retained: 1 },
    });
  });

  it("renders the dry-run resolution preview with NEW badges and the via-NCES tag", async () => {
    renderModal();
    fireEvent.click(screen.getByRole("button", { name: /Activity & engagement/ }));
    await uploadFile(ACTIVITY_CSV, "engagement.csv");

    // Banner
    expect(screen.getByText(/engagement\.csv · 3 rows detected/)).toBeTruthy();
    // Row 0: existing contact attached to an active lead.
    expect(screen.getByText("Karen Whitfield")).toBeTruthy();
    expect(screen.getByText("To active lead")).toBeTruthy();
    // Row 1: brand-new contact + district resolved via the school NCES.
    expect(screen.getByText("Ramona Santos")).toBeTruthy();
    expect(screen.getAllByText("NEW").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("via NCES")).toBeTruthy();
    expect(screen.getByText("Retained on record")).toBeTruthy();
    // Row 2: failed resolution.
    expect(screen.getByText("Missing or invalid email")).toBeTruthy();
    // Summary copy.
    expect(screen.getByText(/attach to an active/)).toBeTruthy();
  });

  it("imports and toasts the summary counts", async () => {
    const { onClose } = renderModal();
    fireEvent.click(screen.getByRole("button", { name: /Activity & engagement/ }));
    await uploadFile(ACTIVITY_CSV, "engagement.csv");

    fireEvent.click(screen.getByRole("button", { name: "Import 2 events" }));
    await waitFor(() => expect(activityImportMock).toHaveBeenCalled());
    // The wet run reuses the rows the dry run previewed.
    expect(activityImportMock.mock.calls[0][0]).toHaveLength(3);
    expect(activityImportMock.mock.calls[0][0][0]).toMatchObject({
      email: "kwhitfield@mvusd51.org",
      kind: "webinar",
      points: 40,
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    await waitFor(() =>
      expect(
        screen.getByText("2 events imported · 1 to active leads · 1 retained on records"),
      ).toBeTruthy(),
    );
  });
});

describe("BulkUploadModal — leads dataset", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    leadDryRunMock.mockResolvedValue(LEAD_PLAN);
    leadImportMock.mockResolvedValue({
      succeeded: [0],
      failed: [{ index: 1, reason: "contact_has_active_lead" }],
      warnings: [],
      summary: { imported: 1 },
    });
  });

  it("shows the preview table with per-row errors and the creation summary", async () => {
    renderModal();
    await uploadFile(LEADS_CSV, "leads.csv");

    expect(screen.getByText("Olivia Tran")).toBeTruthy();
    expect(screen.getAllByText("Reno County USD 313").length).toBe(2);
    expect(screen.getByText("Contact already has an active lead")).toBeTruthy();
    // Footer counts only resolvable rows.
    expect(screen.getByRole("button", { name: "Import 1 leads" })).toBeTruthy();
  });

  it("imports with the assign-all BDR (defaults to the current user) and toasts", async () => {
    const { onClose } = renderModal();
    await uploadFile(LEADS_CSV, "leads.csv");

    fireEvent.click(screen.getByRole("button", { name: "Import 1 leads" }));
    await waitFor(() => expect(leadImportMock).toHaveBeenCalled());
    expect(leadImportMock.mock.calls[0][0][0]).toMatchObject({
      email: "otran@usd313.org",
      leadType: "inbound",
      score: 121,
      assignedBdrId: "me-1",
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.getByText("1 leads imported · assigned to Sierra Arcega")).toBeTruthy(),
    );
  });

  it("rejects a file missing required columns before any network call", async () => {
    renderModal();
    const input = screen.getByLabelText("CSV file") as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [csvFile("First Name,Last Name\nKaren,Whitfield\n", "bad.csv")] },
    });
    await waitFor(() =>
      expect(screen.getByText(/Missing required column: Email\./)).toBeTruthy(),
    );
    expect(leadDryRunMock).not.toHaveBeenCalled();
  });

  it("rejects files over the row cap", async () => {
    renderModal();
    const big = ["Email", ...Array.from({ length: 501 }, (_, i) => `u${i}@x.org`)].join("\n");
    const input = screen.getByLabelText("CSV file") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [csvFile(big, "big.csv")] } });
    await waitFor(() =>
      expect(screen.getByText(/Up to 500 rows per import — this file has 501/)).toBeTruthy(),
    );
    expect(leadDryRunMock).not.toHaveBeenCalled();
  });
});
