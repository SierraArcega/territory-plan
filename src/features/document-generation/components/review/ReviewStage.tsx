"use client";
import { formatCurrency } from "@/features/shared/lib/format";
import type { RenderResult } from "@/features/document-generation/lib/payload-types";

interface Props {
  result: RenderResult;
  orderTotal: number;
  onSend: () => void;   // Dropbox Sign (default) — placeholder until delivery sub-project
  onManual: () => void; // re-render tag-free + open doc
  onBack: () => void;
}

export default function ReviewStage({ result, orderTotal, onSend, onManual, onBack }: Props) {
  return (
    <div className="space-y-3">
      <a href={result.docUrl} target="_blank" rel="noreferrer"
        className="text-[#403770] underline whitespace-nowrap">Open the rendered document ↗</a>
      <div className="text-sm">Order total: {formatCurrency(orderTotal)}</div>
      {result.agreementUrl && (
        <a href={result.agreementUrl} target="_blank" rel="noreferrer" className="block text-sm text-[#403770] underline">
          BOCES agreement (MLSA) ↗
        </a>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onSend}
          className="rounded-lg bg-[#403770] px-3 py-1 text-sm text-white whitespace-nowrap">Send for signature</button>
        <button type="button" onClick={onManual}
          className="rounded-lg bg-[#EFEDF5] px-3 py-1 text-sm whitespace-nowrap">Open Google Doc (manual)</button>
        <button type="button" onClick={onBack}
          className="rounded-lg border border-[#C2BBD4] px-3 py-1 text-sm whitespace-nowrap">← Back to edit</button>
      </div>
    </div>
  );
}
