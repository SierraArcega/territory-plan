"use client";

import { useRef, useState, type DragEvent } from "react";
import { Camera, FileIcon, Trash2, Upload } from "lucide-react";
import {
  useActivityAttachments,
  useUploadActivityAttachment,
  useDeleteActivityAttachment,
} from "@/features/activities/lib/queries";
import AttachmentThumb from "./AttachmentThumb";

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export default function FilesPanel({
  activityId,
  readOnly,
}: {
  activityId: string;
  readOnly: boolean;
}) {
  const { data: attachments = [], isLoading } = useActivityAttachments(activityId);
  const upload = useUploadActivityAttachment();
  const remove = useDeleteActivityAttachment();
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const photos = attachments.filter((a) => a.kind === "photo");
  const files = attachments.filter((a) => a.kind === "file");

  function uploadFiles(list: FileList | File[]) {
    setUploadError(null);
    Array.from(list).forEach((file) => {
      upload.mutate(
        { activityId, file },
        { onError: (err) => setUploadError(err instanceof Error ? err.message : "Upload failed") }
      );
    });
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    if (readOnly) return;
    if (e.dataTransfer.files.length > 0) uploadFiles(e.dataTransfer.files);
  }

  return (
    <div className="flex flex-col h-full">
      {!readOnly && (
        <div className="px-5 py-4">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={`flex flex-col items-center justify-center gap-2 px-4 py-6 border-2 border-dashed rounded-xl transition-colors ${
              dragOver
                ? "border-[#F37167] bg-[#FEF2F1]"
                : "border-[#C2BBD4] bg-[#FFFCFA] hover:bg-[#F7F5FA]"
            }`}
          >
            <Upload className="w-6 h-6 text-[#A69DC0]" />
            <p className="text-xs text-[#6E6390]">
              Drop files here or
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="px-2.5 py-1 text-xs font-medium text-[#403770] bg-white border border-[#C2BBD4] rounded-md hover:bg-[#F7F5FA]"
              >
                Browse
              </button>
              <button
                type="button"
                onClick={() => cameraInput.current?.click()}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-[#403770] bg-white border border-[#C2BBD4] rounded-md hover:bg-[#F7F5FA]"
              >
                <Camera className="w-3.5 h-3.5" />
                Take photo
              </button>
            </div>
            <input
              ref={fileInput}
              type="file"
              multiple
              hidden
              onChange={(e) => e.target.files && uploadFiles(e.target.files)}
            />
            <input
              ref={cameraInput}
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              onChange={(e) => e.target.files && uploadFiles(e.target.files)}
            />
          </div>
          {uploadError && (
            <div className="mt-2 px-3 py-1.5 text-xs text-[#c25a52] bg-[#fef1f0] border border-[#f58d85] rounded-md">
              {uploadError}
            </div>
          )}
          {upload.isPending && (
            <div className="mt-2 text-xs text-[#8A80A8]">Uploading…</div>
          )}
        </div>
      )}

      <div className="flex-1 overflow-auto px-5 pb-5 space-y-5">
        {isLoading ? (
          <div className="text-xs text-[#A69DC0]">Loading attachments…</div>
        ) : attachments.length === 0 ? (
          <div className="text-xs text-[#A69DC0]">No attachments yet.</div>
        ) : (
          <>
            {photos.length > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-wider font-bold text-[#8A80A8] mb-1.5">
                  Photos
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {photos.map((p) => (
                    <div key={p.id} className="relative group aspect-square rounded-lg overflow-hidden bg-[#F0EDF7]">
                      <AttachmentThumb
                        activityId={activityId}
                        attachmentId={p.id}
                        alt={p.name}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-1.5 py-1">
                        <div className="text-[10px] text-white truncate">{p.name}</div>
                      </div>
                      {!readOnly && (
                        <button
                          type="button"
                          aria-label="Remove photo"
                          onClick={() =>
                            remove.mutate({ activityId, attachmentId: p.id })
                          }
                          className="absolute top-1 right-1 w-6 h-6 rounded-full bg-white/90 text-[#F37167] opacity-0 group-hover:opacity-100 inline-flex items-center justify-center transition-opacity"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {files.length > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-wider font-bold text-[#8A80A8] mb-1.5">
                  Files
                </div>
                <ul className="divide-y divide-[#F0EDF7]">
                  {files.map((f) => (
                    <li key={f.id} className="flex items-center gap-3 py-2">
                      <span className="w-8 h-8 rounded-md bg-[#EEEAF5] text-[#403770] inline-flex items-center justify-center flex-shrink-0">
                        <FileIcon className="w-4 h-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm text-[#403770] truncate">{f.name}</div>
                        <div className="text-[11px] text-[#8A80A8]">
                          {fmtBytes(f.sizeBytes)} · {f.uploader.fullName || f.uploader.email}
                        </div>
                      </div>
                      {!readOnly && (
                        <button
                          type="button"
                          aria-label="Remove file"
                          onClick={() =>
                            remove.mutate({ activityId, attachmentId: f.id })
                          }
                          className="text-[#A69DC0] hover:text-[#F37167]"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
