"use client";

export function LibrarySkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-[#D4CFE2] bg-white">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className={`flex items-center gap-3 px-4 py-3.5 ${i === rows - 1 ? "" : "border-b border-[#E2DEEC]"}`}
        >
          <SkeletonBar w="16px" h="16px" rounded="9999px" />
          <div className="min-w-0 flex-1">
            <SkeletonBar w="55%" h="11px" />
            <div className="h-1.5" />
            <SkeletonBar w="80%" h="9px" />
          </div>
        </div>
      ))}
    </div>
  );
}

function SkeletonBar({ w, h, rounded = "4px" }: { w: string; h: string; rounded?: string }) {
  return (
    <div
      className="fm-shimmer"
      style={{
        width: w,
        height: h,
        borderRadius: rounded,
        background:
          "linear-gradient(90deg, #EFEDF5 0%, #F7F5FA 50%, #EFEDF5 100%)",
        backgroundSize: "200% 100%",
        animation: "fm-shimmer 1.4s linear infinite",
      }}
    />
  );
}
