interface Props {
  /** Number of faux columns to render. */
  columns: number;
  /** Optional row-background variant — the DataTable alternates row bg. */
  striped?: boolean;
}

export default function SkeletonRow({ columns, striped = false }: Props) {
  return (
    <div
      className={`flex items-center h-[44px] border-b border-[#E2DEEC] ${striped ? "bg-[#F7F5FA]" : "bg-white"}`}
      aria-hidden
    >
      {Array.from({ length: columns }).map((_, i) => (
        <div key={i} className="flex-1 px-4">
          <div className="h-3 rounded-full bg-[#EFEDF5] animate-pulse" />
        </div>
      ))}
    </div>
  );
}
