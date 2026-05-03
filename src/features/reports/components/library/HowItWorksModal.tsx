"use client";

import { useEffect } from "react";
import { Sparkles, X } from "lucide-react";

interface Props {
  onClose: () => void;
}

export function HowItWorksModal({ onClose }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="How Reports works"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#403770]/30 p-6"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-[#E2DEEC] p-5">
          <div className="flex min-w-0 items-center gap-2">
            <div className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-md bg-[#FEF2F1] text-[#F37167]">
              <Sparkles size={14} />
            </div>
            <h2 className="truncate text-base font-semibold text-[#403770]">How Reports works</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-[#8A80A8] transition-colors duration-100 hover:bg-[#EFEDF5] hover:text-[#403770]"
          >
            <X size={16} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-auto p-6 text-[13.5px] leading-relaxed text-[#544A78]">
          <section className="mb-5">
            <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#8A80A8]">
              What it does
            </h3>
            <p>
              Type a question in plain English about your pipeline, districts, activities, or news.
              Claude reads your data, writes the query, and shows you the result as a table — no SQL
              required. The chips above the table show exactly which filters, columns, and sort
              order Claude used so you can trust the answer.
            </p>
          </section>

          <section className="mb-5">
            <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#8A80A8]">
              Tips for good answers
            </h3>
            <ul className="ml-4 list-disc space-y-1.5">
              <li>
                Be specific about timeframes and ownership — &ldquo;my open opps&rdquo; beats &ldquo;open
                opps,&rdquo; &ldquo;this fiscal year&rdquo; beats &ldquo;recently.&rdquo;
              </li>
              <li>
                If a result looks off, just say so in the chat. Claude will adjust filters or
                rerun with different criteria.
              </li>
              <li>
                Save reports you&rsquo;ll come back to. Saved reports rerun instantly without going
                through Claude — faster, cheaper, and you can share them with the team.
              </li>
            </ul>
          </section>

          <section>
            <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#8A80A8]">
              What&rsquo;s in scope
            </h3>
            <ul className="ml-4 list-disc space-y-1.5">
              <li>
                <strong className="font-semibold text-[#403770]">Pipeline</strong> — opportunities,
                subscription line items, session delivery records, historical wins by district
              </li>
              <li>
                <strong className="font-semibold text-[#403770]">Districts &amp; schools</strong> —
                demographics, enrollment (overall and by grade), finances, locale, graduation rates,
                staffing ratios, year-over-year trends
              </li>
              <li>
                <strong className="font-semibold text-[#403770]">Contacts</strong> at districts and
                schools
              </li>
              <li>
                <strong className="font-semibold text-[#403770]">Your activities, tasks, and
                territory plans</strong> (and teammates&rsquo; where you collaborate)
              </li>
              <li>
                <strong className="font-semibold text-[#403770]">News articles</strong> linked to
                districts, schools, or contacts
              </li>
              <li>
                <strong className="font-semibold text-[#403770]">Job vacancies</strong> scraped
                from district job boards (a hiring-signal proxy — categorized as SPED, ELL,
                Admin, etc.)
              </li>
            </ul>
            <p className="mt-3">
              Reports is read-only — it pulls data, it doesn&rsquo;t change it.
            </p>
          </section>
        </div>

        <footer className="flex shrink-0 justify-end border-t border-[#E2DEEC] bg-[#FFFCFA] px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#403770] px-4 py-2 text-[13px] font-medium text-white shadow-[0_1px_2px_rgba(64,55,112,0.15)] transition-colors hover:bg-[#322a5a]"
          >
            <span className="whitespace-nowrap">Got it</span>
          </button>
        </footer>
      </div>
    </div>
  );
}
