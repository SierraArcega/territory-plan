"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Target,
  TrendingUp,
  DollarSign,
  Trophy,
  Zap,
  HelpCircle,
  Lightbulb,
  ArrowRight,
} from "lucide-react";

// ── FAQ Item ─────────────────────────────────────────────────────────────────

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <button
      onClick={() => setOpen(!open)}
      className="w-full text-left"
    >
      <div className="flex items-start gap-2.5 py-3 border-b border-[#E2DEEC]">
        <HelpCircle className="w-4 h-4 text-[#6EA3BE] mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-[#403770]">{question}</span>
            {open ? (
              <ChevronDown className="w-3.5 h-3.5 text-[#8A80A8] flex-shrink-0" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-[#8A80A8] flex-shrink-0" />
            )}
          </div>
          {open && (
            <p className="mt-2 text-sm text-[#6E6390] leading-relaxed">{answer}</p>
          )}
        </div>
      </div>
    </button>
  );
}

// ── Tier Data ────────────────────────────────────────────────────────────────

const TIERS = [
  { name: "Freshman", minPts: "0+", color: "#8A80A8", bg: "#F7F5FA", desc: "Starting tier for all reps — begin earning points to advance" },
  { name: "Honor Roll", minPts: "300+", color: "#F37167", bg: "#FEF2F1", desc: "Consistent engagement — regular activity and plan development" },
  { name: "Dean's List", minPts: "500+", color: "#5B8FAF", bg: "#EEF4F9", desc: "Strong performer — deep engagement across multiple tracked actions" },
  { name: "Valedictorian", minPts: "1000+", color: "#D4A843", bg: "#FFF8EE", desc: "Top tier — sustained high performance across all initiative metrics" },
];

const TOC = [
  { id: "how-it-works", label: "How It Works" },
  { id: "initiative-points", label: "Initiative Points" },
  { id: "combined-score", label: "Combined Score" },
  { id: "leaderboard-tabs", label: "Leaderboard Tabs" },
  { id: "tiers", label: "Tiers & Rankings" },
  { id: "tips", label: "Tips for Reps" },
  { id: "faq", label: "FAQ" },
];

// ── Page Component ───────────────────────────────────────────────────────────

export default function UnderstandingLeaderboardPage() {
  return (
    <div className="flex gap-10">
      {/* ── Sticky table of contents ──────────────────────────────────── */}
      <nav className="hidden xl:block w-44 flex-shrink-0">
        <div className="sticky top-6">
          <p className="text-[10px] font-semibold text-[#8A80A8] uppercase tracking-wider mb-3">On this page</p>
          <div className="space-y-0.5">
            {TOC.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="block text-xs text-[#6E6390] hover:text-[#403770] py-1.5 border-l-2 border-transparent hover:border-[#F37167] pl-3 transition-colors duration-100"
              >
                {item.label}
              </a>
            ))}
          </div>
        </div>
      </nav>

      {/* ── Main content ──────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 max-w-4xl">
        {/* Hero */}
        <div className="mb-10">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-[#FFF8EE] flex items-center justify-center">
              <Trophy className="w-6 h-6 text-[#D4A843]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#403770]">Understanding the Leaderboard</h1>
              <p className="text-sm text-[#8A80A8] mt-0.5">How initiatives, points, and rankings work</p>
            </div>
          </div>
          <div className="rounded-xl bg-gradient-to-r from-[#F7F5FA] to-[#EFEDF5] p-5 border border-[#E2DEEC]">
            <p className="text-sm text-[#6E6390] leading-relaxed">
              The leaderboard ranks reps using a configurable scoring system built
              around <strong className="text-[#403770]">Initiatives</strong> — focused scoring
              periods that your admin defines. Each initiative can emphasize different behaviors
              and metrics depending on business priorities. Your score blends in-platform activity
              with real opportunity data to give a full picture of performance.
            </p>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* HOW IT WORKS */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <section id="how-it-works" className="mb-12 scroll-mt-6">
          <h2 className="text-lg font-bold text-[#403770] mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-[#D4A843]" />
            How It Works
          </h2>
          <p className="text-sm text-[#6E6390] leading-relaxed mb-4">
            An initiative is a defined scoring period with its own metrics, point values, and
            weights. Your admin creates initiatives to align the leaderboard with current
            priorities — whether that&apos;s territory planning, pipeline generation, closing
            deals, or something else entirely. When one initiative ends, a new one can start —
            either with a fresh slate or carrying over historical scores.
          </p>

          <p className="text-sm text-[#6E6390] leading-relaxed mb-4">
            Your leaderboard rank comes from two things:
          </p>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="rounded-xl border border-[#E2DEEC] p-5 bg-white">
              <div className="w-9 h-9 rounded-lg bg-[#F7F5FA] flex items-center justify-center mb-3">
                <Target className="w-4.5 h-4.5 text-[#403770]" />
              </div>
              <h3 className="text-sm font-semibold text-[#403770] mb-1">Initiative Points</h3>
              <p className="text-xs text-[#8A80A8] leading-relaxed">
                Earned by taking tracked actions in the platform — the specific actions and point
                values are configured per initiative by your admin.
              </p>
            </div>
            <div className="rounded-xl border border-[#E2DEEC] p-5 bg-white">
              <div className="w-9 h-9 rounded-lg bg-[#F7F5FA] flex items-center justify-center mb-3">
                <Zap className="w-4.5 h-4.5 text-[#403770]" />
              </div>
              <h3 className="text-sm font-semibold text-[#403770] mb-1">Combined Score</h3>
              <p className="text-xs text-[#8A80A8] leading-relaxed">
                A weighted blend of your initiative points plus real opportunity data — open pipeline,
                take, revenue, and revenue targeted from your territory plans.
              </p>
            </div>
          </div>

          {/* Visual flow */}
          <div className="flex items-center justify-center gap-2 py-3">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F7F5FA] text-xs font-medium text-[#403770]">
              <Target className="w-3.5 h-3.5" /> Build plans
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-[#A69DC0]" />
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F7F5FA] text-xs font-medium text-[#403770]">
              <Lightbulb className="w-3.5 h-3.5" /> Log outreach
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-[#A69DC0]" />
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F7F5FA] text-xs font-medium text-[#403770]">
              <DollarSign className="w-3.5 h-3.5" /> Set targets
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-[#A69DC0]" />
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FFF8EE] text-xs font-semibold text-[#D4A843] border border-[#ffd98d]">
              <Trophy className="w-3.5 h-3.5" /> Earn points
            </div>
          </div>
        </section>

        <div className="border-t border-[#E2DEEC] mb-12" />

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* INITIATIVE POINTS */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <section id="initiative-points" className="mb-12 scroll-mt-6">
          <h2 className="text-lg font-bold text-[#403770] mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-[#403770]" />
            Initiative Points — How You Earn
          </h2>
          <p className="text-sm text-[#6E6390] leading-relaxed mb-5">
            Points are earned automatically when you take actions in the platform. Your admin
            configures which actions are tracked and how many points each is worth — these can
            change between initiatives. Here are some common scoring actions:
          </p>

          <div className="border border-[#E2DEEC] rounded-xl overflow-hidden mb-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F7F5FA] text-[10px] font-semibold text-[#8A80A8] uppercase tracking-wider">
                  <th className="text-left px-5 py-3 w-36">Action</th>
                  <th className="text-left px-5 py-3">Example</th>
                  <th className="text-right px-5 py-3 w-28">Pts</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Plan Created", "You create a new territory plan", "5–10"],
                  ["Activity Logged", "You log a call, email, meeting, visit, or any tracked outreach", "2–5"],
                  ["Revenue Targeted", "You set revenue targets (renewal, expansion, new business) on plan districts", "1–5 per $10K"],
                  ["District Added", "You add a district to one of your territory plans", "1–3"],
                ].map(([action, trigger, pts], i) => (
                  <tr
                    key={action}
                    className={`border-t border-[#E2DEEC] ${i % 2 === 1 ? "bg-[#F7F5FA]/40" : ""}`}
                  >
                    <td className="px-5 py-3 font-medium text-[#403770] align-top">{action}</td>
                    <td className="px-5 py-3 text-[#6E6390]">{trigger}</td>
                    <td className="px-5 py-3 text-right text-[#403770] font-semibold align-top">{pts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-xl bg-[#FFF8EE] border border-[#ffd98d] px-5 py-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-[#D4A843]" />
              <p className="text-sm font-semibold text-[#D4A843]">How Revenue Targeted works</p>
            </div>
            <p className="text-sm text-[#6E6390] leading-relaxed">
              Instead of counting individual actions, it converts your total targeted revenue
              into units of $10K. For example, if you&apos;ve set $400K in targets across your
              plan districts and the metric is worth 5 pts per $10K, that&apos;s
              40 units &times; 5 pts = <strong className="text-[#403770]">200 points</strong>.
              This means a single well-scoped plan with revenue targets can be one of the
              fastest ways to earn points.
            </p>
          </div>
        </section>

        <div className="border-t border-[#E2DEEC] mb-12" />

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* COMBINED SCORE */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <section id="combined-score" className="mb-12 scroll-mt-6">
          <h2 className="text-lg font-bold text-[#403770] mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-[#6EA3BE]" />
            Combined Score — The Full Picture
          </h2>
          <p className="text-sm text-[#6E6390] leading-relaxed mb-5">
            The Combined Score blends multiple data sources, each with a configurable weight that
            must total 100%. Your admin sets these weights:
          </p>

          <div className="grid grid-cols-1 gap-3 mb-5">
            {[
              { icon: Target, label: "Initiative Points", pct: "40%", desc: "Your action-based score from tracked platform activity", color: "#403770" },
              { icon: TrendingUp, label: "Pipeline", pct: "15%", desc: "Open pipeline value (stages 0–5) — opportunities you're actively working", color: "#6EA3BE" },
              { icon: DollarSign, label: "Take", pct: "15%", desc: "Net revenue after costs from closed-won opportunities", color: "#69B34A" },
              { icon: Trophy, label: "Revenue", pct: "15%", desc: "Total revenue from closed opportunities", color: "#D4A843" },
              { icon: Target, label: "Revenue Targeted", pct: "15%", desc: "Total revenue you've targeted across your territory plan districts", color: "#F37167" },
            ].map(({ icon: Ic, label, pct, desc, color }) => (
              <div key={label} className="flex items-center gap-4 px-5 py-3.5 rounded-xl bg-white border border-[#E2DEEC]">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${color}12` }}
                >
                  <Ic className="w-5 h-5" style={{ color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-semibold text-[#403770]">{label}</span>
                  <p className="text-xs text-[#8A80A8] mt-0.5">{desc}</p>
                </div>
                <span className="text-lg font-bold text-[#403770] flex-shrink-0">{pct}</span>
              </div>
            ))}
          </div>

          <p className="text-sm text-[#6E6390] leading-relaxed mb-5">
            Each metric can pull from a <strong className="text-[#403770]">different fiscal year</strong>.
            This lets your admin balance current-year results with forward-looking activity.
            For example, Take might track this year while Pipeline tracks next year — rewarding
            both closing and planning simultaneously.
          </p>

          <div className="rounded-xl bg-[#e8f1f5] border border-[#8bb5cb] px-5 py-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-[#6EA3BE]" />
              <p className="text-sm font-semibold text-[#6EA3BE]">How normalization works</p>
            </div>
            <p className="text-sm text-[#6E6390] leading-relaxed">
              Your raw values are compared against the best performer on the team. If the
              top rep has $3M pipeline and you have $1.5M, your normalized pipeline score is 50.
              That&apos;s then multiplied by the weight (e.g., 50 &times; 15% = 7.5 combined
              points). The combined score is always <strong className="text-[#403770]">relative</strong> —
              it measures how you compare to your peers, not an absolute target. Everyone&apos;s
              scores shift as the team&apos;s numbers change.
            </p>
          </div>
        </section>

        <div className="border-t border-[#E2DEEC] mb-12" />

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* TABS */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <section id="leaderboard-tabs" className="mb-12 scroll-mt-6">
          <h2 className="text-lg font-bold text-[#403770] mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-[#F37167]" />
            Leaderboard Tabs
          </h2>
          <p className="text-sm text-[#6E6390] leading-relaxed mb-5">
            The leaderboard has tabs that let you view rankings different ways. Click any
            rep&apos;s row to expand and see exactly how their score breaks down.
          </p>

          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: Zap, label: "Combined", desc: "Weighted blend of everything — default view", color: "#403770" },
              { icon: Target, label: "Initiative", desc: "Ranked by initiative points earned from tracked actions", color: "#403770" },
              { icon: TrendingUp, label: "Pipeline", desc: "Ranked by open pipeline value (stages 0–5)", color: "#6EA3BE" },
              { icon: DollarSign, label: "Take", desc: "Ranked by net revenue from closed opportunities", color: "#69B34A" },
              { icon: Trophy, label: "Revenue", desc: "Ranked by total opportunity revenue", color: "#D4A843" },
              { icon: Target, label: "Targeted", desc: "Ranked by total revenue targeted in plans", color: "#F37167" },
            ].map(({ icon: Ic, label, desc, color }) => (
              <div key={label} className="rounded-xl border border-[#E2DEEC] p-4 bg-white">
                <div className="flex items-center gap-2 mb-2">
                  <Ic className="w-4 h-4" style={{ color }} />
                  <span className="text-sm font-semibold text-[#403770]">{label}</span>
                </div>
                <p className="text-xs text-[#8A80A8] leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="border-t border-[#E2DEEC] mb-12" />

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* TIERS */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <section id="tiers" className="mb-12 scroll-mt-6">
          <h2 className="text-lg font-bold text-[#403770] mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-[#D4A843]" />
            Tiers &amp; How to Advance
          </h2>
          <p className="text-sm text-[#6E6390] leading-relaxed mb-6">
            Every rep starts at Freshman and advances through four tiers based on
            initiative points. Tiers are determined by your initiative points, not your combined score.
          </p>

          {/* Tier visual progression */}
          <div className="rounded-xl border border-[#E2DEEC] overflow-hidden mb-4">
            {TIERS.map((tier, i) => (
              <div
                key={tier.name}
                className={`flex items-center gap-4 px-5 py-4 ${i > 0 ? "border-t border-[#E2DEEC]" : ""}`}
                style={{ backgroundColor: `${tier.bg}` }}
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                  style={{ backgroundColor: `${tier.color}20`, color: tier.color }}
                >
                  {tier.name[0]}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold" style={{ color: tier.color }}>{tier.name}</span>
                    <span className="text-xs font-medium text-[#8A80A8] bg-white/60 px-2 py-0.5 rounded-full">{tier.minPts} pts</span>
                  </div>
                  <p className="text-xs text-[#6E6390] mt-0.5">{tier.desc}</p>
                </div>
                {i < TIERS.length - 1 && (
                  <ArrowRight className="w-4 h-4 text-[#A69DC0] flex-shrink-0 rotate-90 xl:rotate-0" />
                )}
              </div>
            ))}
          </div>

          <p className="text-xs text-[#8A80A8] italic">
            Tier thresholds are set by your admin and may change between initiatives.
          </p>
        </section>

        <div className="border-t border-[#E2DEEC] mb-12" />

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* TIPS */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <section id="tips" className="mb-12 scroll-mt-6">
          <h2 className="text-lg font-bold text-[#403770] mb-5 flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-[#F37167]" />
            Tips for Reps
          </h2>

          <div className="space-y-4">
            {[
              {
                tip: "Log activity consistently",
                detail: "Every tracked action earns points — calls, emails, meetings, visits. Even early-stage outreach counts. A quick conference follow-up email or an introductory call both earn initiative points before any pipeline exists.",
              },
              {
                tip: "Set revenue targets on your plan districts",
                detail: "Revenue targeting is often the highest point-per-effort action because it counts total dollars. Even rough estimates count — a single well-scoped plan with targets can earn more points than a week of logged activity.",
              },
              {
                tip: "Add districts to plans early",
                detail: "You earn points for adding districts, and you can set revenue targets before an opportunity even exists in the CRM. Don't wait for pipeline — if you're working a district, put it in your plan.",
              },
              {
                tip: "Check which fiscal year each metric is tracking",
                detail: "Pipeline, Take, Revenue, and Revenue Targeted can each pull from a different fiscal year. If Pipeline is set to next year, focus on building forward-looking opportunities to boost your combined score.",
              },
              {
                tip: "Expand other reps' rows to learn what works",
                detail: "Click any rep's row to see their score breakdown. Are they earning more from revenue targeting? Do they have more logged activities? Use the breakdown to understand what actions are driving rankings in the current initiative.",
              },
              {
                tip: "Points get you on the board — opportunity data keeps you at the top",
                detail: "Initiative points reward effort and planning. But the combined score also weights real data — pipeline, take, and revenue. The reps who rank highest pair consistent platform activity with strong business outcomes.",
              },
            ].map(({ tip, detail }) => (
              <div key={tip} className="flex gap-4 rounded-xl border-l-4 border-[#F37167] bg-white border border-l-4 border-l-[#F37167] border-[#E2DEEC] px-5 py-4">
                <div>
                  <p className="text-sm font-semibold text-[#403770] mb-1">{tip}</p>
                  <p className="text-xs text-[#6E6390] leading-relaxed">{detail}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="border-t border-[#E2DEEC] mb-12" />

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* FAQ */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <section id="faq" className="mb-12 scroll-mt-6">
          <h2 className="text-lg font-bold text-[#403770] mb-5 flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-[#6EA3BE]" />
            Frequently Asked Questions
          </h2>

          <div className="rounded-xl border border-[#E2DEEC] bg-white px-5">
            <FaqItem
              question="Why is my score 0?"
              answer="You're likely on a new initiative that started with a fresh slate. Start taking tracked actions — create plans, log activities, set revenue targets — to earn points."
            />
            <FaqItem
              question='What does "normalized" mean?'
              answer="Your raw value is divided by the best performer's value, then scaled to 100. The top rep always scores 100 on each metric. If they have $3M pipeline and you have $1.5M, your pipeline score is 50."
            />
            <FaqItem
              question="How often do scores update?"
              answer="Initiative points update immediately when you take tracked actions. Pipeline, Take, and Revenue data syncs from your CRM periodically — usually within a few hours of an opportunity change."
            />
            <FaqItem
              question="What happens when a new initiative starts?"
              answer="Your admin chooses: Fresh Start (everyone at 0) or Historical Backfill (base scores calculated from existing data). Previous initiative data is preserved and can be exported."
            />
            <FaqItem
              question="Does pre-pipeline outreach count?"
              answer="Yes — any tracked action earns initiative points. You don't need an active opportunity. Logging an introductory meeting or a conference follow-up is exactly the kind of early-stage activity the leaderboard rewards."
            />
            <FaqItem
              question="Why did my rank change without me doing anything?"
              answer="The combined score is normalized against the team. If another rep's numbers change — closing a deal, building pipeline — the relative rankings shift even if your own numbers haven't."
            />
            <FaqItem
              question="Which actions are tracked in this initiative?"
              answer="Check the leaderboard modal — the Initiative tab shows your point breakdown by action. Your admin configures which actions count and how many points each is worth, and these can change between initiatives."
            />
          </div>
        </section>
      </div>
    </div>
  );
}
