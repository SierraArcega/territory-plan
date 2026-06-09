import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ getUser: vi.fn() }));
vi.mock("@/features/document-generation/lib/render-apps-script", () => ({
  renderViaAppsScript: vi.fn(),
}));

import { POST } from "../route";
import { getUser } from "@/lib/supabase/server";
import { renderViaAppsScript } from "@/features/document-generation/lib/render-apps-script";

const mockGetUser = vi.mocked(getUser);
const mockRenderViaAppsScript = vi.mocked(renderViaAppsScript);

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
});
