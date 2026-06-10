import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockUpsertBocesRender } = vi.hoisted(() => ({
  mockUpsertBocesRender: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ getUser: vi.fn() }));
vi.mock("@/features/document-generation/lib/render-apps-script", () => ({
  renderViaAppsScript: vi.fn(),
}));
vi.mock("@/features/document-generation/lib/persist", () => ({
  upsertBocesRender: mockUpsertBocesRender,
}));

import { POST } from "../route";
import { getUser } from "@/lib/supabase/server";
import { renderViaAppsScript } from "@/features/document-generation/lib/render-apps-script";

const mockGetUser = vi.mocked(getUser);
const mockRenderViaAppsScript = vi.mocked(renderViaAppsScript);

const BOCES_PAYLOAD = {
  doc_type: "boces_quote" as const,
  deal: { client_company: "Erie 2 BOCES", quote_number: "Q-1042" },
  quote: { fee_pct: 10.6, order_total: 4200, line_items: [], billable_days: 0, billable_hours: 0, adjustments: [], savings: 0, gross_subtotal: 0 },
  payment: { type: "C" },
  sections: {},
};

function req(body: unknown) {
  return new Request("http://localhost/api/document-generation/render", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/document-generation/render", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("401s when unauthenticated", async () => {
    mockGetUser.mockResolvedValue(null);
    const res = await POST(req({ payload: { doc_type: "contract" }, tags: true }));
    expect(res.status).toBe(401);
  });

  it("returns the rendered doc url for an authed rep", async () => {
    mockGetUser.mockResolvedValue({ id: "u1" } as never);
    mockRenderViaAppsScript.mockResolvedValue({ docUrl: "https://docs.google.com/document/d/REAL/edit" });
    const res = await POST(req({ payload: { doc_type: "contract" }, tags: false }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ docUrl: "https://docs.google.com/document/d/REAL/edit" });
    expect(mockRenderViaAppsScript).toHaveBeenCalledWith({ doc_type: "contract" }, false);
  });

  it("400s when payload is missing", async () => {
    mockGetUser.mockResolvedValue({ id: "u1" } as never);
    const res = await POST(req({ tags: true }));
    expect(res.status).toBe(400);
  });

  it("defaults tags to true when omitted", async () => {
    mockGetUser.mockResolvedValue({ id: "u1" } as never);
    mockRenderViaAppsScript.mockResolvedValue({ docUrl: "https://docs.google.com/document/d/REAL/edit" });
    await POST(req({ payload: { doc_type: "contract" } }));
    expect(mockRenderViaAppsScript).toHaveBeenCalledWith({ doc_type: "contract" }, true);
  });

  it("500s when the renderer throws", async () => {
    mockGetUser.mockResolvedValue({ id: "u1" } as never);
    mockRenderViaAppsScript.mockRejectedValue(new Error("boom"));
    const res = await POST(req({ payload: { doc_type: "contract" }, tags: true }));
    expect(res.status).toBe(500);
  });

  it("calls upsertBocesRender after a successful BOCES render", async () => {
    mockGetUser.mockResolvedValue({ id: "u1" } as never);
    mockRenderViaAppsScript.mockResolvedValue({ docUrl: "https://docs.google.com/document/d/D1/edit" });
    mockUpsertBocesRender.mockResolvedValue(undefined);
    const res = await POST(req({ payload: BOCES_PAYLOAD, tags: false, districtLeaId: "0601234" }));
    expect(res.status).toBe(200);
    expect(mockUpsertBocesRender).toHaveBeenCalledWith(expect.objectContaining({
      payload: BOCES_PAYLOAD,
      docUrl: "https://docs.google.com/document/d/D1/edit",
      docId: "D1",
      districtLeaId: "0601234",
      ownerProfileId: "u1",
    }));
  });

  it("does NOT call upsertBocesRender for a contract render", async () => {
    mockGetUser.mockResolvedValue({ id: "u1" } as never);
    mockRenderViaAppsScript.mockResolvedValue({ docUrl: "https://docs.google.com/document/d/REAL/edit" });
    const res = await POST(req({ payload: { doc_type: "contract" }, tags: false }));
    expect(res.status).toBe(200);
    expect(mockUpsertBocesRender).not.toHaveBeenCalled();
  });

  it("still returns 200 when upsertBocesRender throws", async () => {
    mockGetUser.mockResolvedValue({ id: "u1" } as never);
    mockRenderViaAppsScript.mockResolvedValue({ docUrl: "https://docs.google.com/document/d/D1/edit" });
    mockUpsertBocesRender.mockRejectedValue(new Error("db failure"));
    const res = await POST(req({ payload: BOCES_PAYLOAD, tags: false }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ docUrl: "https://docs.google.com/document/d/D1/edit" });
  });
});
