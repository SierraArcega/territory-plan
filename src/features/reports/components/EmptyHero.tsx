export default function EmptyHero() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 px-8 text-center">
      <div
        className="size-24 rounded-full bg-[#fdf4f2]"
        aria-hidden
        style={{
          background:
            "radial-gradient(circle at 30% 30%, #F37167 0%, #F37167 40%, #f9a69d 70%, #fdf4f2 100%)",
        }}
      />
      <div className="flex max-w-[480px] flex-col items-center gap-2">
        <h1 className="text-[22px] font-bold text-[#544A78]">
          Let&rsquo;s build your first report
        </h1>
        <p className="text-sm text-[#6E6390]">
          Ask a question in chat or click the builder to pick a source. Your
          queries will populate the builder as chips you can edit.
        </p>
      </div>
    </div>
  );
}
