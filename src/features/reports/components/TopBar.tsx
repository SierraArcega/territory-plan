"use client";

interface Props {
  title: string;
  badge: "Draft" | "Saved" | null;
  breadcrumbSuffix?: string;
  onMore?: () => void;
  onSaveClick: () => void;
  saveDisabled?: boolean;
  backToLibrary?: () => void;
}

export default function TopBar({
  title,
  badge,
  onMore,
  onSaveClick,
  saveDisabled,
  backToLibrary,
}: Props) {
  return (
    <header className="flex items-center justify-between border-b border-[#E2DEEC] bg-white px-8 py-5">
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={backToLibrary}
          className="text-[13px] font-medium text-[#A69DC0] hover:underline"
        >
          Reports
        </button>
        <span className="text-[13px] text-[#A69DC0]">/</span>
        <p className="text-[15px] font-semibold text-[#544A78]">{title}</p>
        {badge && (
          <span
            className={`inline-flex items-center rounded-full px-2 py-[3px] text-[10px] font-semibold tracking-wider ${
              badge === "Saved"
                ? "bg-[#F7FFF2] text-[#69B34A]"
                : "bg-[#EFEDF5] text-[#8A80A8]"
            }`}
          >
            {badge}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {onMore && (
          <button
            type="button"
            onClick={onMore}
            className="rounded-lg border border-[#D4CFE2] bg-white px-3.5 py-2 text-[13px] font-medium text-[#544A78] hover:bg-[#F7F5FA] transition-colors"
          >
            More
          </button>
        )}
        <button
          type="button"
          onClick={onSaveClick}
          disabled={saveDisabled}
          className={`inline-flex items-center rounded-lg px-4 py-2.5 text-[13px] font-semibold transition-colors ${
            saveDisabled
              ? "bg-[#EFEDF5] text-[#A69DC0]"
              : "bg-plum text-white hover:bg-[#322a5a]"
          }`}
        >
          Save as Report
        </button>
      </div>
    </header>
  );
}
