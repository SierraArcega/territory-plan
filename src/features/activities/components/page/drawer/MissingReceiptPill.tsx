"use client";

export default function MissingReceiptPill({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="text-[10px] font-semibold text-[#997c43] bg-[#fffaf1] border border-[#FFCF70] px-2 py-0.5 rounded-full inline-block">
      {count} missing receipt{count === 1 ? "" : "s"}
    </span>
  );
}
