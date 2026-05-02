"use client";

import {
  Compass,
  Users,
  MessageSquare,
  TrendingUp,
  Target,
  Shield,
  Calculator,
  Lightbulb,
  ArrowRight,
  Quote,
  Check,
  AlertTriangle,
} from "lucide-react";

// ── Data ─────────────────────────────────────────────────────────────────────

const TOC = [
  { id: "leadership", label: "Everyone Drives" },
  { id: "feedback", label: "Feedback as a Gift" },
  { id: "company-roi", label: "How Fullmind Tracks ROI" },
  { id: "personal-roi", label: "ROI in Your Own Role" },
  { id: "i9-example", label: "Worked Example: I-9" },
  { id: "build-roi", label: "Building Your Own Case" },
];

const FEEDBACK_POINTERS: Array<{ title: string; body: string }> = [
  {
    title: "Ask questions first",
    body: "Make sure you understand the situation before offering a take. The right question is often more useful than the right answer.",
  },
  {
    title: "Give it quickly, succinctly",
    body: "Normalize giving feedback in the moment, regardless of your level. Waiting dilutes the signal.",
  },
  {
    title: "Sit with the discomfort",
    body: "Be comfortable feeling uncomfortable. In a healthy environment, you'll start to associate that feeling with growth.",
  },
];

const COMPANY_FORMULAS: Array<{ formula: string; gloss: string }> = [
  {
    formula: "Revenue − Teacher Costs = Take",
    gloss: "What's left after paying the educators delivering the work.",
  },
  {
    formula: "Take − Operating Costs = Profit",
    gloss: "What's left after running the business — tools, salaries, overhead.",
  },
  {
    formula: "Profit / Revenue ≥ 15%",
    gloss: "The minimum margin we hold ourselves to.",
  },
];

const REFLECTIONS: Array<{ name: string; body: string }> = [
  {
    name: "Amy",
    body: "When I first heard about creating a case for ROI in my position, I felt scared. I didn't know where to start and it made me wonder if my role produced ROI for the company. When I understood how this and other priorities on my to-do list could be ROI positive, this became way less intimidating. Now it's fun and I feel more energized about my work at Fullmind.",
  },
  {
    name: "James",
    body: "Using an ROI framework gives me clarity about what success does (and does not) look like. When I focus on priorities that lead to positive ROI, it gives me personal peace of mind and satisfaction with my work.",
  },
];

const BUILD_STEPS: Array<{ title: string; body: React.ReactNode }> = [
  {
    title: "Pick a task",
    body: (
      <p className="text-sm text-[#6E6390] leading-relaxed">
        Anything on today&apos;s schedule will do. Don&apos;t overthink the choice —
        the framework works whether the task is large or small.
      </p>
    ),
  },
  {
    title: "Estimate what it saves or earns",
    body: (
      <p className="text-sm text-[#6E6390] leading-relaxed">
        Ask: what&apos;s the cost of <em>not</em> doing this? Or what revenue does
        it unlock?{" "}
        <strong className="text-[#403770]">Round conservatively</strong> — down
        if it&apos;s a gain, up if it&apos;s a cost. Same approach Fullmind takes
        with its own books.
      </p>
    ),
  },
  {
    title: "Estimate what it costs",
    body: (
      <p className="text-sm text-[#6E6390] leading-relaxed">
        Your time × salary, plus any tools or spend involved.{" "}
        <strong className="text-[#403770]">Round up</strong> here too — the goal
        is a worst-case picture that still pencils out.
      </p>
    ),
  },
  {
    title: "Compare",
    body: (
      <p className="text-sm text-[#6E6390] leading-relaxed">
        <span className="font-mono text-[#403770]">($ Saved or Earned) / $ Spent</span>
        . Is the result clearly positive? Borderline? Negative? That&apos;s your
        signal for whether the task earns its place.
      </p>
    ),
  },
  {
    title: "When in doubt, guess",
    body: (
      <p className="text-sm text-[#6E6390] leading-relaxed">
        A stretch number beats no number. You can refine the estimate next time —
        but you can&apos;t prioritize what you haven&apos;t measured at all.
      </p>
    ),
  },
];

// ── Page Component ───────────────────────────────────────────────────────────

export default function SelfManagementPage() {
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
              <Compass className="w-6 h-6 text-[#F37167]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#403770]">
                Self-Management at Fullmind
              </h1>
              <p className="text-sm text-[#8A80A8] mt-0.5">
                How we lead, how we give feedback, and how to think about ROI in
                your own role.
              </p>
            </div>
          </div>
          <div className="rounded-xl bg-gradient-to-r from-[#F7F5FA] to-[#EFEDF5] p-5 border border-[#E2DEEC]">
            <p className="text-sm text-[#6E6390] leading-relaxed">
              Welcome to the latest training resource for Fullmind team members.
              Take 15 minutes to review the topics below, then{" "}
              <a
                href="https://forms.gle/2x25JrUkw8JQLKbU8"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#F37167] font-semibold hover:underline"
              >
                complete this form to confirm your understanding
              </a>
              . As you have ideas and questions, share them — we want to grow
              together.
            </p>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* LEADERSHIP */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <section id="leadership" className="mb-12 scroll-mt-6">
          <h2 className="text-lg font-bold text-[#403770] mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-[#F37167]" />
            Leadership: Everyone Drives
          </h2>

          {/* Blakely quote */}
          <div className="rounded-xl border-l-4 border-[#F37167] bg-white border border-[#E2DEEC] px-5 py-4 mb-5">
            <div className="flex items-start gap-3">
              <Quote className="w-4 h-4 text-[#F37167] mt-1 flex-shrink-0" />
              <div>
                <p className="text-sm text-[#6E6390] leading-relaxed italic mb-2">
                  &ldquo;My dad encouraged us to fail. Growing up, he would ask
                  us what we failed at that week. If we didn&apos;t have
                  something, he would be disappointed. It changed my mindset at
                  an early age that failure is not the outcome, failure is{" "}
                  <strong className="text-[#403770] not-italic">
                    not trying.
                  </strong>{" "}
                  Don&apos;t be afraid to fail.&rdquo;
                </p>
                <p className="text-xs font-semibold text-[#8A80A8]">
                  — Sara Blakely
                </p>
              </div>
            </div>
          </div>

          <p className="text-sm text-[#6E6390] leading-relaxed mb-5">
            At Fullmind, <strong className="text-[#403770]">everybody</strong>{" "}
            is on the leadership team. For real. So what does that mean?
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
            <div className="rounded-xl border border-[#E2DEEC] bg-white p-5">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-full bg-[#FEF2F1] flex items-center justify-center text-sm font-bold text-[#F37167]">
                  1
                </div>
                <span className="text-sm font-bold text-[#403770]">
                  Drive the company forward
                </span>
              </div>
              <p className="text-sm text-[#6E6390] leading-relaxed pl-9">
                You are expected to push us forward — not just execute against a
                ticket queue.
              </p>
            </div>
            <div className="rounded-xl border border-[#E2DEEC] bg-white p-5">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-full bg-[#FEF2F1] flex items-center justify-center text-sm font-bold text-[#F37167]">
                  2
                </div>
                <span className="text-sm font-bold text-[#403770]">
                  Take bold risks
                </span>
              </div>
              <p className="text-sm text-[#6E6390] leading-relaxed pl-9">
                Playing it safe is its own mistake. As long as your intentions
                are aligned with our goals,{" "}
                <strong className="text-[#403770]">we trust you</strong>.
              </p>
            </div>
          </div>
        </section>

        <div className="border-t border-[#E2DEEC] mb-12" />

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* FEEDBACK */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <section id="feedback" className="mb-12 scroll-mt-6">
          <h2 className="text-lg font-bold text-[#403770] mb-4 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-[#6EA3BE]" />
            Feedback as a Gift
          </h2>
          <p className="text-sm text-[#6E6390] leading-relaxed mb-6">
            Being a leader means being comfortable sharing — and receiving —
            ideas on how to improve. We are all growing, no matter where we are
            in our careers. When you spot an opportunity for improvement with a
            teammate,{" "}
            <strong className="text-[#403770]">
              share it with them in real time.
            </strong>
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
            {FEEDBACK_POINTERS.map((p) => (
              <div
                key={p.title}
                className="rounded-xl border border-[#E2DEEC] bg-white p-5"
              >
                <h3 className="text-sm font-bold text-[#403770] mb-2">
                  {p.title}
                </h3>
                <p className="text-sm text-[#6E6390] leading-relaxed">
                  {p.body}
                </p>
              </div>
            ))}
          </div>

          <div className="rounded-xl bg-[#e8f1f5] border border-[#8bb5cb] px-5 py-4">
            <div className="flex items-start gap-2.5">
              <Lightbulb className="w-4 h-4 text-[#6EA3BE] mt-0.5 flex-shrink-0" />
              <p className="text-sm text-[#6E6390] leading-relaxed">
                <strong className="text-[#403770]">
                  When given with the intention of helping others succeed,
                  feedback is a gift.
                </strong>
              </p>
            </div>
          </div>
        </section>

        <div className="border-t border-[#E2DEEC] mb-12" />

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* COMPANY ROI */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <section id="company-roi" className="mb-12 scroll-mt-6">
          <h2 className="text-lg font-bold text-[#403770] mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#69B34A]" />
            How Fullmind Tracks ROI
          </h2>

          {/* Drucker quote */}
          <div className="rounded-xl border-l-4 border-[#F37167] bg-white border border-[#E2DEEC] px-5 py-4 mb-5">
            <div className="flex items-start gap-3">
              <Quote className="w-4 h-4 text-[#F37167] mt-1 flex-shrink-0" />
              <div>
                <p className="text-sm text-[#6E6390] leading-relaxed italic mb-2">
                  &ldquo;Whatever we measure, improves.&rdquo;
                </p>
                <p className="text-xs font-semibold text-[#8A80A8]">
                  — Peter Drucker
                </p>
              </div>
            </div>
          </div>

          <p className="text-sm text-[#6E6390] leading-relaxed mb-5">
            As a service provider, our financial model is built on a simple
            chain of formulas:
          </p>

          {/* Formula stack */}
          <div className="space-y-3 mb-5">
            {COMPANY_FORMULAS.map((f, i) => (
              <div
                key={i}
                className="rounded-xl border border-[#E2DEEC] bg-white overflow-hidden"
              >
                <div className="bg-[#F7F5FA] px-5 py-3 border-b border-[#E2DEEC]">
                  <span className="text-base font-bold text-[#403770] tabular-nums">
                    {f.formula}
                  </span>
                </div>
                <p className="px-5 py-3 text-sm text-[#6E6390] leading-relaxed">
                  {f.gloss}
                </p>
              </div>
            ))}
          </div>

          <div className="rounded-xl bg-[#FFF8EE] border border-[#ffd98d] px-5 py-4">
            <div className="flex items-start gap-2.5">
              <Shield className="w-4 h-4 text-[#D4A843] mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-bold text-[#403770] mb-1">
                  Conservative accounting
                </p>
                <p className="text-sm text-[#6E6390] leading-relaxed">
                  We round revenue figures down and costs up. Even with
                  worst-case math, we want to see ROI stay consistently positive
                  — that buffer means we can be wrong about a few things and
                  still come out ahead.
                </p>
              </div>
            </div>
          </div>
        </section>

        <div className="border-t border-[#E2DEEC] mb-12" />

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* PERSONAL ROI */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <section id="personal-roi" className="mb-12 scroll-mt-6">
          <h2 className="text-lg font-bold text-[#403770] mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-[#F37167]" />
            ROI in Your Own Role
          </h2>
          <p className="text-sm text-[#6E6390] leading-relaxed mb-5">
            Analyzing ROI in your own work can feel intimidating at first —
            especially in roles that don&apos;t obviously touch revenue. Done
            well, it gives you clarity about what success actually looks like
            for you. The formula is the same shape as the company&apos;s, just
            scoped to a single task:
          </p>

          {/* Personal formula display */}
          <div className="rounded-xl border border-[#E2DEEC] bg-gradient-to-r from-[#F7F5FA] to-[#EFEDF5] px-6 py-6 mb-6 text-center">
            <p className="text-xs font-semibold text-[#8A80A8] uppercase tracking-wider mb-3">
              Employee ROI on any given task
            </p>
            <p className="text-xl font-bold text-[#403770] tabular-nums">
              ($ Take Increased + $ Saved) / $ Spent
            </p>
          </div>

          {/* Reflections */}
          <p className="text-sm text-[#8A80A8] uppercase tracking-wider text-xs font-semibold mb-3">
            Reflections from the team
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {REFLECTIONS.map((r) => (
              <div
                key={r.name}
                className="rounded-xl border border-[#E2DEEC] bg-white p-5"
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-full bg-[#FEF2F1] flex items-center justify-center text-sm font-bold text-[#F37167]">
                    {r.name[0]}
                  </div>
                  <span className="text-sm font-bold text-[#403770]">
                    {r.name}
                  </span>
                </div>
                <p className="text-sm text-[#6E6390] leading-relaxed italic">
                  &ldquo;{r.body}&rdquo;
                </p>
              </div>
            ))}
          </div>
        </section>

        <div className="border-t border-[#E2DEEC] mb-12" />

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* I-9 EXAMPLE */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <section id="i9-example" className="mb-12 scroll-mt-6">
          <h2 className="text-lg font-bold text-[#403770] mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#6EA3BE]" />
            Worked Example: I-9 Compliance
          </h2>
          <p className="text-sm text-[#6E6390] leading-relaxed mb-6">
            Here&apos;s a real example Amy and James walked through together
            from HR work. Every new employee has to complete an I-9 employment
            verification form after they start. It seems like routine paperwork
            — but the ROI math is striking.
          </p>

          {/* Side-by-side cost comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
            {/* Cost of missing */}
            <div className="rounded-xl bg-[#FFF8EE] border border-[#ffd98d] p-5">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-[#D4A843]" />
                <span className="text-sm font-bold text-[#403770]">
                  Cost of missing the form
                </span>
              </div>
              <p className="text-3xl font-bold text-[#403770] tabular-nums mb-1">
                ~$1,500
              </p>
              <p className="text-sm text-[#6E6390] leading-relaxed">
                Per-person penalty during a potential audit.
              </p>
            </div>

            {/* Cost of doing */}
            <div className="rounded-xl bg-[#F7FFF2] border border-[#8AC670] p-5">
              <div className="flex items-center gap-2 mb-3">
                <Check className="w-4 h-4 text-[#69B34A]" />
                <span className="text-sm font-bold text-[#403770]">
                  Cost of doing it right
                </span>
              </div>
              <p className="text-3xl font-bold text-[#403770] tabular-nums mb-1">
                ~$25
              </p>
              <p className="text-sm text-[#6E6390] leading-relaxed">
                15 minutes of employee salary —{" "}
                <strong className="text-[#403770]">round up to ~$100</strong>{" "}
                to be conservative.
              </p>
            </div>
          </div>

          {/* Verdict */}
          <div className="rounded-xl border-l-4 border-[#69B34A] bg-white border border-[#E2DEEC] px-5 py-4">
            <div className="flex items-start gap-2.5">
              <ArrowRight className="w-4 h-4 text-[#69B34A] mt-0.5 flex-shrink-0" />
              <p className="text-sm text-[#6E6390] leading-relaxed">
                <strong className="text-[#403770]">$1,500 &gt; $100.</strong>{" "}
                Clearly positive ROI — a 15-minute task that decreases operating
                costs by an order of magnitude. Even with conservative rounding,
                the case is overwhelming.
              </p>
            </div>
          </div>
        </section>

        <div className="border-t border-[#E2DEEC] mb-12" />

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* BUILD YOUR OWN */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <section id="build-roi" className="mb-12 scroll-mt-6">
          <h2 className="text-lg font-bold text-[#403770] mb-4 flex items-center gap-2">
            <Calculator className="w-5 h-5 text-[#403770]" />
            Building Your Own ROI Case
          </h2>
          <p className="text-sm text-[#6E6390] leading-relaxed mb-6">
            A practical sequence for framing any task with the formula. Don&apos;t
            try to be precise on the first pass — try to be{" "}
            <em>directionally</em> right.
          </p>

          <div className="space-y-3 mb-5">
            {BUILD_STEPS.map((step, i) => (
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

          <div className="rounded-xl border-l-4 border-[#F37167] bg-white border border-[#E2DEEC] px-5 py-4">
            <div className="flex items-start gap-2.5">
              <Lightbulb className="w-4 h-4 text-[#F37167] mt-0.5 flex-shrink-0" />
              <p className="text-sm text-[#6E6390] leading-relaxed">
                If you&apos;re having trouble — that&apos;s okay. Take a few
                guesses.{" "}
                <strong className="text-[#403770]">
                  A bad measurement, or one that&apos;s a stretch, is still
                  better than no measurement.
                </strong>
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
