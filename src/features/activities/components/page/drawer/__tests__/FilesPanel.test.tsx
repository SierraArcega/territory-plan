import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("@/features/activities/lib/queries", () => ({
  useActivityAttachments: vi.fn(),
  useUploadActivityAttachment: vi.fn(),
  useDeleteActivityAttachment: vi.fn(),
  useActivityAttachmentUrl: vi.fn(() => ({ data: null })),
}));

// AttachmentThumb fetches signed URLs; stub it to a plain image.
vi.mock("../../drawer/AttachmentThumb", () => ({
  default: () => null,
}));

import {
  useActivityAttachments,
  useUploadActivityAttachment,
  useDeleteActivityAttachment,
} from "@/features/activities/lib/queries";
import FilesPanel from "../FilesPanel";

const fakeFile = {
  id: "att-1",
  kind: "file" as const,
  name: "report.pdf",
  sizeBytes: 12345,
  mime: "application/pdf",
  uploadedAt: new Date(Date.now() - 60_000).toISOString(),
  uploader: { id: "user-1", fullName: "Jane Doe", email: "j@x.com", avatarUrl: null },
};

describe("FilesPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useUploadActivityAttachment as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });
    (useDeleteActivityAttachment as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: vi.fn(),
    });
  });

  it("renders a Download button per file", () => {
    (useActivityAttachments as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [fakeFile],
      isLoading: false,
    });
    render(<FilesPanel activityId="act-1" readOnly={false} />);
    expect(screen.getByRole("button", { name: /download file/i })).toBeInTheDocument();
  });

  it("renders relative-time uploadedAt next to file metadata", () => {
    (useActivityAttachments as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [fakeFile],
      isLoading: false,
    });
    render(<FilesPanel activityId="act-1" readOnly={false} />);
    expect(screen.getByText(/ago/)).toBeInTheDocument();
  });

  it("clicking Download triggers a fetch to the signed-url endpoint", async () => {
    (useActivityAttachments as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [fakeFile],
      isLoading: false,
    });
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ url: "https://x/signed" }), { status: 200 })
      );
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<FilesPanel activityId="act-1" readOnly={false} />);
    fireEvent.click(screen.getByRole("button", { name: /download file/i }));
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/activities/act-1/attachments/att-1/url"
    );
    await waitFor(() => expect(openSpy).toHaveBeenCalled());
    fetchSpy.mockRestore();
    openSpy.mockRestore();
  });

  it("calls onSaved when an upload mutation resolves", () => {
    (useActivityAttachments as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [],
      isLoading: false,
    });
    const onSaved = vi.fn();
    const uploadMutate = vi.fn((_args, opts) => opts?.onSuccess?.());
    (useUploadActivityAttachment as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: uploadMutate,
      isPending: false,
    });
    const { container } = render(
      <FilesPanel activityId="act-1" readOnly={false} onSaved={onSaved} />
    );
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["hi"], "hi.txt", { type: "text/plain" });
    Object.defineProperty(fileInput, "files", { value: [file] });
    fireEvent.change(fileInput);
    expect(uploadMutate).toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalled();
  });
});
