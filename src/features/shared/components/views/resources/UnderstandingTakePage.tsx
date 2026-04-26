"use client";

import {
  Calculator,
  Target,
  DollarSign,
  Calendar,
  BarChart3,
  AlertTriangle,
  ListChecks,
  Users,
  Shield,
  Lightbulb,
  ArrowRight,
} from "lucide-react";

// ── Data ─────────────────────────────────────────────────────────────────────

const TOC = [
  { id: "benchmarks", label: "Current benchmarks" },
  { id: "is-rates", label: "IS hourly rates" },
  { id: "ls-rates", label: "LS daily rates" },
  { id: "take-in-practice", label: "Take in practice" },
  { id: "above-fifty", label: "When pay goes above 50%" },
  { id: "set-up-success", label: "Set the team up for success" },
  { id: "recruitment-process", label: "Recruitment process" },
  { id: "guardrails", label: "Pricing guardrails" },
];

const IS_NY_RATES: Array<[string, string]> = [
  ["Science", "$36 – $38.50 / hr"],
  ["Math", "$32 – $36 / hr"],
  ["Phys Ed / Health", "$29 – $33 / hr"],
  ["Core / General", "$29 – $33 / hr"],
  ["SWD", "$33 – $37.40 / hr"],
  ["SWD (Science)", "$36 – $38.50 / hr"],
  ["Translators", "$33 / hr"],
];

const IS_OOS_RATES: Array<[string, string]> = [
  ["All subjects", "$29 – $33 / hr"],
  ["Translators", "$33 / hr"],
];

const IS_GROUP_RATES: Array<[string, string]> = [
  ["Small Group", "$33 – $36 / hr"],
  ["Whole Class Virtual Instruction", "$36 – $40 / hr"],
  ["Virtual Suspension", "$36 – $40 / hr"],
];

const LS_STATES: Array<{
  state: string;
  rows: Array<[string, string, string]>;
}> = [
  {
    state: "New York",
    rows: [
      ["Core", "$265 – $275", "$47,700 – $49,500"],
      ["SWD", "$300", "$54,000"],
      ["Spanish", "$350", "$63,000"],
    ],
  },
  {
    state: "South Carolina",
    rows: [
      ["SWD", "$250 – $260", "$45,000 – $46,800"],
      ["Core", "$240 – $250", "$43,200 – $45,000"],
    ],
  },
  {
    state: "California",
    rows: [["SWD", "$300 – $320", "$54,000 – $57,600"]],
  },
];

const CA_SWD_ROWS: Array<[string, string, string, string, string]> = [
  ["Barstow Unified", "$135,159.78", "$77,445.00", "$57,714.78", "42.70%"],
  ["Middleton Unified", "$6,188.70", "$3,150.00", "$3,038.70", "49.10%"],
  ["Middleton Unified", "$11,981.20", "$6,160.00", "$5,821.20", "48.59%"],
  ["Konocti Unified", "$32,051.32", "$19,320.00", "$12,731.32", "39.72%"],
  ["Yuba City Unified", "$92,387.13", "$48,589.26", "$43,797.87", "47.41%"],
];

const ELMSFORD_ROWS: Array<
  [string, string, string, string, string, string, string]
> = [
  ["1:1 HB", "997", "$70,707.87", "$32.29", "$32,192.31", "$38,515.56", "54.47%"],
  ["1:1 HB", "500", "$33,275.88", "$34.16", "$17,083.30", "$16,193.58", "48.66%"],
  ["Small Group", "97", "$11,154.46", "$28.71", "$2,785.16", "$8,369.30", "75.03%"],
  ["Virtual Suspension", "48", "$29,376.00", "$346.00", "$16,608.00", "$12,768.00", "43.46%"],
];

const SUCCESS_STEPS: Array<{
  title: string;
  body: React.ReactNode;
}> = [
  {
    title: "Start early with the right questions",
    body: (
      <>
        <p className="text-sm text-[#6E6390] leading-relaxed mb-3">
          Use the req form as your guide to build a checklist:
        </p>
        <ul className="space-y-2 pl-4 list-disc marker:text-[#C2BBD4]">
          <li className="text-sm text-[#6E6390] leading-relaxed">
            What&apos;s their background check process, and is it state- or school-required?
          </li>
          <li className="text-sm text-[#6E6390] leading-relaxed">
            Are they open to out-of-state educators, or educators willing to seek reciprocity?{" "}
            <span className="text-[#8A80A8] italic">
              (Can drop time-to-staff from months to two weeks.)
            </span>
          </li>
          <li className="text-sm text-[#6E6390] leading-relaxed">
            Full-time or part-time?{" "}
            <span className="text-[#8A80A8] italic">
              (Part-time is significantly harder to staff — flag it early.)
            </span>
          </li>
          <li className="text-sm text-[#6E6390] leading-relaxed">
            Is a Master&apos;s required? Niche certification? AP class? Expect a smaller
            candidate pool and higher comp.
          </li>
        </ul>
      </>
    ),
  },
  {
    title: "Log everything in the LMS Opps text box",
    body: (
      <p className="text-sm text-[#6E6390] leading-relaxed">
        Capture the full picture so anyone on Recruitment or Staffing who picks up the
        opportunity sees the same context you did.
      </p>
    ),
  },
  {
    title: "Loop in Recruitment & Staffing early",
    body: (
      <p className="text-sm text-[#6E6390] leading-relaxed">
        Ping{" "}
        <code className="text-xs font-mono text-[#403770] bg-[#F7F5FA] border border-[#E2DEEC] px-1.5 py-0.5 rounded">
          #recruiting-and-staffing
        </code>{" "}
        in Slack with position details. They can flag difficulty, suggest faster placements,
        and that insight can inform your pricing strategy from the start.
      </p>
    ),
  },
];

const RECRUITMENT_STEPS: Array<{ title: string; body: string }> = [
  {
    title: "IS / LS flags a gap",
    body: "They let Recruitment know no one in pool is interested in the assignment.",
  },
  {
    title: "Recruitment gathers JD details",
    body: "Schedule, grade level, subject, certification, pay rate — anything a candidate might ask about that we have an answer for.",
  },
  {
    title: "Urgent hiring kicks off",
    body: "JD goes up; we bypass parts of the standard funnel and aim to chat same-day. Apply in the morning → call in the afternoon.",
  },
  {
    title: "Frequent updates to Staffing",
    body: "Recruitment reports back as candidates move through conversations.",
  },
  {
    title: "Pay signal → pricing signal",
    body: "In conversations, Recruitment gauges candidate reactions to pay. If pay is a blocker, they inform Staffing and consider tiering up. When an educator becomes active and wants more, that context flows back to Staffing.",
  },
];

const GUARDRAILS: Array<{ title: string; body: React.ReactNode }> = [
  {
    title: "No Staffing Fee discount",
    body: (
      <>
        Target a list price of at least{" "}
        <strong className="text-[#403770]">$50,000</strong> for the educator budget.
        Discounts eat directly into Take.
      </>
    ),
  },
  {
    title: "SPED and specialized roles cost more",
    body: (
      <>
        Anything we haven&apos;t done before should be priced with a premium for the
        unknowns.
      </>
    ),
  },
  {
    title: "Tell us early or pay rises",
    body: (
      <>
        If Recruitment finds out late that a role is unusual, we&apos;re usually already
        urgent-hiring — which pushes pay up.
      </>
    ),
  },
  {
    title: "Returners are the first move",
    body: (
      <>
        70–80% of LS educators return year over year. Staffing always goes back to past
        educators first because they know the work.{" "}
        <span className="text-[#8A80A8] italic">
          (SC SPED returners get +3% on pay.)
        </span>
      </>
    ),
  },
];

// ── Small sub-components ─────────────────────────────────────────────────────

function RateTable({
  caption,
  rows,
}: {
  caption: string;
  rows: Array<[string, string]>;
}) {
  return (
    <div className="border border-[#E2DEEC] rounded-xl overflow-hidden">
      <div className="bg-[#F7F5FA] px-5 py-2.5 border-b border-[#E2DEEC]">
        <span className="text-xs font-semibold text-[#403770]">{caption}</span>
      </div>
      <table className="w-full text-sm">
        <tbody>
          {rows.map(([role, rate], i) => (
            <tr
              key={`${role}-${i}`}
              className={i > 0 ? "border-t border-[#E2DEEC]" : ""}
            >
              <td className="px-5 py-2.5 text-[#403770] font-medium">{role}</td>
              <td className="px-5 py-2.5 text-right text-[#6E6390] tabular-nums">
                {rate}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Page Component ───────────────────────────────────────────────────────────

export default function UnderstandingTakePage() {
  return (
    <div className="flex gap-10">
      {/* ── Sticky table of contents ──────────────────────────────────── */}
      <nav className="hidden xl:block w-44 flex-shrink-0">
        <div className="sticky top-6">
          <p className="text-[10px] font-semibold text-[#8A80A8] uppercase tracking-wider mb-3">
            On this page
          </p>
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
            <div className="w-12 h-12 rounded-2xl bg-[#FEF2F1] flex items-center justify-center">
              <Calculator className="w-6 h-6 text-[#F37167]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#403770]">
                Understanding Take
              </h1>
              <p className="text-sm text-[#8A80A8] mt-0.5">
                How Take is calculated, the comp bands we work within, and how to
                price deals so recruitment can deliver.
              </p>
            </div>
          </div>
          <div className="rounded-xl bg-gradient-to-r from-[#F7F5FA] to-[#EFEDF5] p-5 border border-[#E2DEEC]">
            <p className="text-sm text-[#6E6390] leading-relaxed">
              <strong className="text-[#403770]">Take = Revenue − COGS</strong>,
              expressed as a percentage. When calculating teacher compensation and
              Take, the Staffing Fee is included in the sale price — so waiving or
              discounting it directly reduces Take. Around 80% of opportunities
              fall inside our standard rate bands; the rest reflect harder-to-fill
              certifications, state/subject premiums, or heavier workloads.
            </p>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* CURRENT BENCHMARKS */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <section id="benchmarks" className="mb-12 scroll-mt-6">
          <h2 className="text-lg font-bold text-[#403770] mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-[#F37167]" />
            Current benchmarks
          </h2>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="rounded-xl border border-[#E2DEEC] bg-white p-5">
              <p className="text-xs font-semibold text-[#8A80A8] uppercase tracking-wider mb-2">
                2026 Take target
              </p>
              <p className="text-3xl font-bold text-[#403770] tabular-nums mb-1">
                —
              </p>
              <p className="text-xs text-[#8A80A8]">
                Add current 2026 Take target from Ops dashboard
              </p>
            </div>
            <div className="rounded-xl border border-[#E2DEEC] bg-white p-5">
              <p className="text-xs font-semibold text-[#8A80A8] uppercase tracking-wider mb-2">
                FY2025-to-date average
              </p>
              <p className="text-3xl font-bold text-[#403770] tabular-nums mb-1">
                —
              </p>
              <p className="text-xs text-[#8A80A8]">
                Add FY2025 average Take from Ops dashboard
              </p>
            </div>
          </div>

          <div className="rounded-xl border-l-4 border-[#F37167] bg-white border border-[#E2DEEC] px-5 py-4">
            <div className="flex items-start gap-2.5">
              <Lightbulb className="w-4 h-4 text-[#F37167] mt-0.5 flex-shrink-0" />
              <p className="text-sm text-[#6E6390] leading-relaxed">
                These figures come from the live Take dashboard. Update this page
                when Ops publishes new numbers.
              </p>
            </div>
          </div>
        </section>

        <div className="border-t border-[#E2DEEC] mb-12" />

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* IS HOURLY RATES */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <section id="is-rates" className="mb-12 scroll-mt-6">
          <h2 className="text-lg font-bold text-[#403770] mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-[#69B34A]" />
            Standard IS hourly rates
          </h2>
          <p className="text-sm text-[#6E6390] leading-relaxed mb-5">
            Around <strong className="text-[#403770]">80% of IS opportunities</strong>{" "}
            fall within these rate bands. Anything above typically reflects
            state/subject scarcity, heavier workloads, or hard-to-place roles.
          </p>

          <div className="grid grid-cols-1 gap-4 mb-4">
            <RateTable caption="1:1 New York" rows={IS_NY_RATES} />
            <div className="grid grid-cols-2 gap-4">
              <RateTable caption="1:1 Out of State" rows={IS_OOS_RATES} />
              <RateTable caption="Group assignments" rows={IS_GROUP_RATES} />
            </div>
          </div>

          <div className="rounded-xl bg-[#e8f1f5] border border-[#8bb5cb] px-5 py-4">
            <div className="flex items-start gap-2.5">
              <Lightbulb className="w-4 h-4 text-[#6EA3BE] mt-0.5 flex-shrink-0" />
              <p className="text-sm text-[#6E6390] leading-relaxed">
                Many NY educators return to NY IS positions because the role requires
                a NY cert — which helps keep Time to Staff low for renewals.
              </p>
            </div>
          </div>
        </section>

        <div className="border-t border-[#E2DEEC] mb-12" />

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* LS DAILY RATES */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <section id="ls-rates" className="mb-12 scroll-mt-6">
          <h2 className="text-lg font-bold text-[#403770] mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[#6EA3BE]" />
            Standard Live Staffing daily rates
          </h2>
          <p className="text-sm text-[#6E6390] leading-relaxed mb-5">
            Live Staffing rates are expressed as daily pay. Across all
            opportunities,{" "}
            <strong className="text-[#403770]">
              70–80% of LS educators return the following year.
            </strong>
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {LS_STATES.map((st) => (
              <div
                key={st.state}
                className="rounded-xl border border-[#E2DEEC] bg-white overflow-hidden flex flex-col"
              >
                <div className="bg-[#F7F5FA] px-4 py-2.5 border-b border-[#E2DEEC]">
                  <span className="text-xs font-semibold text-[#403770]">
                    {st.state}
                  </span>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[10px] font-semibold text-[#8A80A8] uppercase tracking-wider">
                      <th className="text-left px-4 py-2 font-semibold">Role</th>
                      <th className="text-right px-4 py-2 font-semibold">Daily</th>
                      <th className="text-right px-4 py-2 font-semibold">List price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {st.rows.map(([role, rate, price], i) => (
                      <tr
                        key={`${st.state}-${role}-${i}`}
                        className="border-t border-[#E2DEEC]"
                      >
                        <td className="px-4 py-2.5 text-[#403770] font-medium">
                          {role}
                        </td>
                        <td className="px-4 py-2.5 text-right text-[#6E6390] tabular-nums">
                          {rate}
                        </td>
                        <td className="px-4 py-2.5 text-right text-[#6E6390] tabular-nums">
                          {price}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </section>

        <div className="border-t border-[#E2DEEC] mb-12" />

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* TAKE IN PRACTICE */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <section id="take-in-practice" className="mb-12 scroll-mt-6">
          <h2 className="text-lg font-bold text-[#403770] mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#D4A843]" />
            Take in practice
          </h2>
          <p className="text-sm text-[#6E6390] leading-relaxed mb-6">
            Real deals, real Take percentages. Notice how the same pay rate produces
            different Take depending on sessions booked and how we structure the
            contract.
          </p>

          {/* Example A — CA SWD */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm font-semibold text-[#403770]">
                Example A — CA SWD Live Staffing
              </span>
              <span className="text-xs font-medium text-[#8A80A8] bg-[#F7F5FA] border border-[#E2DEEC] px-2 py-0.5 rounded-full">
                pay rate $300–320
              </span>
            </div>
            <div className="border border-[#E2DEEC] rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#F7F5FA] text-[10px] font-semibold text-[#8A80A8] uppercase tracking-wider">
                    <th className="text-left px-5 py-3">School</th>
                    <th className="text-right px-5 py-3">Revenue</th>
                    <th className="text-right px-5 py-3">COGS</th>
                    <th className="text-right px-5 py-3">Take</th>
                    <th className="text-right px-5 py-3 w-20">Take %</th>
                  </tr>
                </thead>
                <tbody>
                  {CA_SWD_ROWS.map(([school, revenue, cogs, take, pct], i) => (
                    <tr
                      key={`ca-${i}`}
                      className={`border-t border-[#E2DEEC] ${
                        i % 2 === 1 ? "bg-[#F7F5FA]/40" : ""
                      }`}
                    >
                      <td className="px-5 py-3 font-medium text-[#403770]">
                        {school}
                      </td>
                      <td className="px-5 py-3 text-right text-[#6E6390] tabular-nums">
                        {revenue}
                      </td>
                      <td className="px-5 py-3 text-right text-[#6E6390] tabular-nums">
                        {cogs}
                      </td>
                      <td className="px-5 py-3 text-right text-[#403770] font-semibold tabular-nums">
                        {take}
                      </td>
                      <td className="px-5 py-3 text-right text-[#403770] font-semibold tabular-nums">
                        {pct}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Example B — Elmsford */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm font-semibold text-[#403770]">
                Example B — Elmsford School District
              </span>
              <span className="text-xs font-medium text-[#8A80A8] bg-[#F7F5FA] border border-[#E2DEEC] px-2 py-0.5 rounded-full">
                by session type
              </span>
            </div>
            <div className="border border-[#E2DEEC] rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#F7F5FA] text-[10px] font-semibold text-[#8A80A8] uppercase tracking-wider">
                    <th className="text-left px-4 py-3">Session type</th>
                    <th className="text-right px-4 py-3">Sessions</th>
                    <th className="text-right px-4 py-3">Session cost</th>
                    <th className="text-right px-4 py-3">Avg educator $</th>
                    <th className="text-right px-4 py-3">Educator cost</th>
                    <th className="text-right px-4 py-3">Gross margin</th>
                    <th className="text-right px-4 py-3 w-20">Margin %</th>
                  </tr>
                </thead>
                <tbody>
                  {ELMSFORD_ROWS.map(
                    ([type, sessions, sessCost, avgEd, edCost, gm, pct], i) => (
                      <tr
                        key={`elm-${i}`}
                        className={`border-t border-[#E2DEEC] ${
                          i % 2 === 1 ? "bg-[#F7F5FA]/40" : ""
                        }`}
                      >
                        <td className="px-4 py-3 font-medium text-[#403770]">
                          {type}
                        </td>
                        <td className="px-4 py-3 text-right text-[#6E6390] tabular-nums">
                          {sessions}
                        </td>
                        <td className="px-4 py-3 text-right text-[#6E6390] tabular-nums">
                          {sessCost}
                        </td>
                        <td className="px-4 py-3 text-right text-[#6E6390] tabular-nums">
                          {avgEd}
                        </td>
                        <td className="px-4 py-3 text-right text-[#6E6390] tabular-nums">
                          {edCost}
                        </td>
                        <td className="px-4 py-3 text-right text-[#403770] font-semibold tabular-nums">
                          {gm}
                        </td>
                        <td className="px-4 py-3 text-right text-[#403770] font-semibold tabular-nums">
                          {pct}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <div className="border-t border-[#E2DEEC] mb-12" />

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* ABOVE 50% */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <section id="above-fifty" className="mb-12 scroll-mt-6">
          <h2 className="text-lg font-bold text-[#403770] mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-[#D4A843]" />
            When pay goes above 50% of sale price
          </h2>
          <p className="text-sm text-[#6E6390] leading-relaxed mb-6">
            Sometimes we pay more than half the sale price to staff a role. Two
            historical examples show why — and what we learned.
          </p>

          <div className="space-y-4">
            {/* Barstow */}
            <div className="rounded-xl bg-[#FFF8EE] border border-[#ffd98d] p-5">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-[#D4A843]" />
                <span className="text-sm font-bold text-[#403770]">
                  Barstow — LiveScan compliance gap
                </span>
                <span className="text-xs font-medium text-[#8A80A8] bg-white/60 px-2 py-0.5 rounded-full">
                  Live Staffing · June–Sept 2024
                </span>
              </div>
              <p className="text-sm text-[#6E6390] leading-relaxed mb-3">
                When Barstow became a customer in June 2024, we didn&apos;t know CA law
                required LiveScan fingerprinting before hire or placement — our IS
                assignments hadn&apos;t needed it. That created a compliance gap we
                weren&apos;t operationally ready for. We couldn&apos;t recruit, hire, or
                engage educators until LiveScan was set up in August 2024, meaning two
                months of lost revenue and educators sitting without assignments. We
                could only recruit candidates already in California, and had to raise
                pay to staff fully — achieved in September 2024, three months after the
                relationship began.
              </p>
              <div className="rounded-lg bg-white/70 border border-[#f0e2b8] px-4 py-3">
                <p className="text-xs font-semibold text-[#D4A843] uppercase tracking-wider mb-1">
                  Outcome
                </p>
                <p className="text-sm text-[#6E6390] leading-relaxed">
                  Barstow is now one of our top-performing customers. LiveScan
                  compliance is part of onboarding, and background checks are now
                  addressed in Stage 1 or 2 by the sales rep / AM / PSM.
                </p>
              </div>
            </div>

            {/* Korean */}
            <div className="rounded-xl bg-[#FFF8EE] border border-[#ffd98d] p-5">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-[#D4A843]" />
                <span className="text-sm font-bold text-[#403770]">
                  Korean IS — hard-to-recruit certification
                </span>
                <span className="text-xs font-medium text-[#8A80A8] bg-white/60 px-2 py-0.5 rounded-full">
                  Instructional Services
                </span>
              </div>
              <p className="text-sm text-[#6E6390] leading-relaxed mb-3">
                A school partner asked for a Korean-certified educator. Korean sits in
                the group of &ldquo;challenging&rdquo; world languages — one study showed 78% of
                aspiring world language educators study Spanish, with Korean barely
                represented. Sourcing turned up only 35 candidates on LinkedIn and 60
                on Indeed; just 2 applied. The educator we found started at $40 and
                came back asking for $50.
              </p>
              <div className="rounded-lg bg-white/70 border border-[#f0e2b8] px-4 py-3">
                <p className="text-xs font-semibold text-[#D4A843] uppercase tracking-wider mb-1">
                  Outcome
                </p>
                <p className="text-sm text-[#6E6390] leading-relaxed">
                  Given how hard it was to recruit, we went above the sale price to
                  keep the business and deliver for the school. The lesson: flag rare
                  certifications at the req stage so comp and pricing can reflect
                  scarcity from the start.
                </p>
              </div>
            </div>
          </div>
        </section>

        <div className="border-t border-[#E2DEEC] mb-12" />

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* SET THE TEAM UP FOR SUCCESS */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <section id="set-up-success" className="mb-12 scroll-mt-6">
          <h2 className="text-lg font-bold text-[#403770] mb-4 flex items-center gap-2">
            <ListChecks className="w-5 h-5 text-[#69B34A]" />
            Set the team up for success
          </h2>
          <p className="text-sm text-[#6E6390] leading-relaxed mb-6">
            The more information you gather up front, and the longer the assignment,
            the easier it is to staff at a competitive rate — which means more Take.{" "}
            <strong className="text-[#403770]">
              The biggest single driver of a large, qualified educator pool is a
              full-year assignment known before the school year starts.
            </strong>
          </p>

          <div className="space-y-3">
            {SUCCESS_STEPS.map((step, i) => (
              <div
                key={step.title}
                className="rounded-xl border border-[#E2DEEC] bg-white p-5 flex gap-4"
              >
                <div className="w-8 h-8 rounded-full bg-[#F37167] flex items-center justify-center flex-shrink-0 text-sm font-bold text-white">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-[#403770] mb-2">
                    {step.title}
                  </h3>
                  {step.body}
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="border-t border-[#E2DEEC] mb-12" />

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* RECRUITMENT PROCESS */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <section id="recruitment-process" className="mb-12 scroll-mt-6">
          <h2 className="text-lg font-bold text-[#403770] mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-[#403770]" />
            The recruitment process
          </h2>
          <p className="text-sm text-[#6E6390] leading-relaxed mb-4">
            Recruitment&apos;s goal is a hone-in strategy — keep our educator pool
            matched to the certifications our top accounts need, so we avoid
            last-minute recruiting and keep comp appropriate to the market. When we
            don&apos;t have an educator in pool, here&apos;s what happens.
          </p>

          <div className="rounded-xl bg-[#F7F5FA] border border-[#E2DEEC] px-5 py-4 mb-6">
            <p className="text-xs font-semibold text-[#8A80A8] uppercase tracking-wider mb-2">
              Why we sometimes lack a pool match
            </p>
            <ul className="space-y-1.5 pl-4 list-disc marker:text-[#C2BBD4]">
              <li className="text-sm text-[#6E6390] leading-relaxed">
                A hard-to-recruit certification{" "}
                <span className="text-[#8A80A8] italic">
                  (NY Earth Science, CA Mod/Sev)
                </span>
              </li>
              <li className="text-sm text-[#6E6390] leading-relaxed">
                A spring request — most educators are either placed or focused on
                next year
              </li>
              <li className="text-sm text-[#6E6390] leading-relaxed">
                A certification we&apos;ve never filled before — a good problem, it
                means serving students a new way
              </li>
            </ul>
          </div>

          <div className="relative">
            {RECRUITMENT_STEPS.map((step, i) => {
              const isLast = i === RECRUITMENT_STEPS.length - 1;
              return (
                <div key={step.title} className="flex gap-4 relative pb-5">
                  {!isLast && (
                    <div
                      className="absolute left-4 top-8 w-px bg-[#E2DEEC]"
                      style={{ bottom: 0 }}
                    />
                  )}
                  <div className="w-8 h-8 rounded-full bg-white border-2 border-[#F37167] flex items-center justify-center flex-shrink-0 text-xs font-bold text-[#F37167] relative z-10">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0 pt-1">
                    <h3 className="text-sm font-bold text-[#403770] mb-1">
                      {step.title}
                    </h3>
                    <p className="text-sm text-[#6E6390] leading-relaxed">
                      {step.body}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <div className="border-t border-[#E2DEEC] mb-12" />

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* GUARDRAILS */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <section id="guardrails" className="mb-12 scroll-mt-6">
          <h2 className="text-lg font-bold text-[#403770] mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#F37167]" />
            Pricing guardrails
          </h2>
          <p className="text-sm text-[#6E6390] leading-relaxed mb-6">
            A handful of rules that come up enough to be worth repeating.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {GUARDRAILS.map((g) => (
              <div
                key={g.title}
                className="border-l-4 border-[#F37167] bg-white border border-[#E2DEEC] rounded-xl px-5 py-4"
              >
                <div className="flex items-start gap-2 mb-1.5">
                  <ArrowRight className="w-4 h-4 text-[#F37167] mt-0.5 flex-shrink-0" />
                  <span className="text-sm font-bold text-[#403770]">
                    {g.title}
                  </span>
                </div>
                <p className="text-sm text-[#6E6390] leading-relaxed pl-6">
                  {g.body}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
