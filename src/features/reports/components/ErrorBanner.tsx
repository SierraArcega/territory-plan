interface Props {
  title: string;
  detail?: string;
  onRetry?: () => void;
}

export default function ErrorBanner({ title, detail, onRetry }: Props) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-[#f58d85] bg-[#fef1f0] px-4 py-3 text-[13px]">
      <div className="flex flex-col gap-0.5">
        <p className="font-semibold text-[#b84135]">{title}</p>
        {detail && <p className="text-[#8a5049]">{detail}</p>}
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-lg border border-[#b84135] px-3 py-1.5 text-xs font-semibold text-[#b84135] hover:bg-white transition-colors"
        >
          Retry
        </button>
      )}
    </div>
  );
}
