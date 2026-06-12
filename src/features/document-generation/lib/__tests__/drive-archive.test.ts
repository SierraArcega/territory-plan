import { describe, it, expect, vi, beforeEach } from "vitest";

// drive-archive imports "server-only"; stub it so the test can import the module.
vi.mock("server-only", () => ({}));

// vi.mock factories are hoisted to the top of the file, so module-scope `const`
// declarations are not yet initialised when the factory runs. Use vi.hoisted()
// to create the mocks before hoisting so they're available inside the factory.
const { mockFilesCreate, mockFilesDelete, mockJwt } = vi.hoisted(() => ({
  mockFilesCreate: vi.fn(),
  mockFilesDelete: vi.fn(),
  mockJwt: vi.fn(),
}));

vi.mock("googleapis", () => ({
  google: {
    auth: { JWT: mockJwt },
    drive: () => ({ files: { create: mockFilesCreate, delete: mockFilesDelete } }),
  },
}));

// drive-archive re-exports buildJwt from render-apps-script, which also imports
// "server-only" and "googleapis" — both are already mocked above.
vi.mock("../render-apps-script", () => ({
  buildJwt: mockJwt,
}));

import { uploadExecutedPdf, deleteExecutedPdf } from "../drive-archive";

describe("uploadExecutedPdf", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GOOGLE_DOC_CONTRACT_EXECUTED_FOLDER_ID = "FOLDER123";
    process.env.GOOGLE_DOC_RENDER_SUBJECT = "service@fullmindlearning.com";
    process.env.GOOGLE_DOC_RENDER_SA_EMAIL = "sa@x.iam.gserviceaccount.com";
    process.env.GOOGLE_DOC_RENDER_SA_KEY = "k";
    mockFilesCreate.mockResolvedValue({ data: { id: "F1", webViewLink: "https://drive.google.com/file/d/F1/view" } });
  });

  it("uploads into the executed folder and returns id + link", async () => {
    const out = await uploadExecutedPdf(Buffer.from("%PDF"), "Acme — signed.pdf");
    expect(mockFilesCreate).toHaveBeenCalledWith(expect.objectContaining({
      supportsAllDrives: true,
      requestBody: expect.objectContaining({ name: "Acme — signed.pdf", parents: ["FOLDER123"] }),
      fields: "id, webViewLink",
    }));
    expect(out).toEqual({ fileId: "F1", url: "https://drive.google.com/file/d/F1/view" });
  });

  it("throws when the folder env var is missing", async () => {
    delete process.env.GOOGLE_DOC_CONTRACT_EXECUTED_FOLDER_ID;
    await expect(uploadExecutedPdf(Buffer.from("x"), "n.pdf")).rejects.toThrow(/GOOGLE_DOC_CONTRACT_EXECUTED_FOLDER_ID/);
  });
});

describe("deleteExecutedPdf", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GOOGLE_DOC_RENDER_SUBJECT = "service@fullmindlearning.com";
    process.env.GOOGLE_DOC_RENDER_SA_EMAIL = "sa@x.iam.gserviceaccount.com";
    process.env.GOOGLE_DOC_RENDER_SA_KEY = "k";
    mockFilesDelete.mockResolvedValue({});
  });

  it("calls drive.files.delete with the fileId and supportsAllDrives: true", async () => {
    await deleteExecutedPdf("FILE_XYZ");
    expect(mockFilesDelete).toHaveBeenCalledWith({
      fileId: "FILE_XYZ",
      supportsAllDrives: true,
    });
  });

  it("resolves without throwing even if drive.files.delete rejects", async () => {
    mockFilesDelete.mockRejectedValue(new Error("not found"));
    await expect(deleteExecutedPdf("FILE_XYZ")).resolves.toBeUndefined();
  });
});
