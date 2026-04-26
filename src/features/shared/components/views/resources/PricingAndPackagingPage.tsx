"use client";

import {
  DollarSign,
  Target,
  Layers,
  Calculator,
  ArrowRightLeft,
  Scale,
  Percent,
  TrendingDown,
  PlayCircle,
  FileText,
  LayoutGrid,
  ClipboardCheck,
  Check,
  Lightbulb,
  ExternalLink,
} from "lucide-react";

// ── Table of contents ────────────────────────────────────────────────────────

const TOC = [
  { id: "overview", label: "Overview" },
  { id: "services", label: "Services We Offer" },
  { id: "take", label: "How Take is Calculated" },
  { id: "mapping", label: "Elevate → Fullmind" },
  { id: "model-comparison", label: "Pricing Model Comparison" },
  { id: "discounting", label: "Discounting Guidelines" },
  { id: "vs-in-person", label: "Fullmind vs. In-Person" },
  { id: "videos", label: "Videos & Deep Dives" },
];

// ── Rate card data ───────────────────────────────────────────────────────────

const LIVE_STAFFING = [
  {
    role: "Standard Educator — Standard Subject — Full Time",
    perDay: "$500.23",
    year180: "$90,040.70",
    year190: "$95,042.96",
    desc: "General education instructor for core subjects (math, science, social studies, ELA, elementary). Works 4+ hours per billable day, including prep time (standard day is 6.5 hours).",
  },
  {
    role: "Premium Educator — Standard Subject — Full Time",
    perDay: "$515.23",
    year180: "$92,741.92",
    year190: "$97,894.26",
    desc: "Instructor with dual certification and/or master's degree. Teaches core subjects. Works 4+ hours per billable day, including prep time.",
  },
  {
    role: "Premium Educator — Premium Subject — Full Time",
    perDay: "$500.23",
    year180: "$90,040.70",
    year190: "$95,042.96",
    desc: "Instructor with dual certification and/or master's degree. Teaches specialized subjects beyond the four core areas (specific sciences, electives).",
  },
  {
    role: "Specialized Educator — Standard Subject — Full Time",
    perDay: "$546.36",
    year180: "$98,345.43",
    year190: "$103,809.07",
    desc: "Instructor certified to support SWD, MLL/Bilingual, and AP programs. Teaches core subjects.",
  },
  {
    role: "Specialized Educator — Premium Subject — Full Time",
    perDay: "$560.93",
    year180: "$100,967.97",
    year190: "$106,577.30",
    desc: "Instructor certified to support SWD, MLL/Bilingual, and AP programs. Teaches specialized subjects.",
  },
  {
    role: "Full Time — School Psychologist",
    perDay: "$595.11",
    year180: "$107,120.00",
    year190: "$113,071.11",
    desc: "Mental health services tailored to student needs/IEP. Includes individual or group counseling and social work.",
  },
];

const INSTRUCTIONAL = [
  { service: "Homebound + Homebased", oneOne: "$73.16", oneTen: "—", oneThirty: "—", desc: "First-time instruction in specific subject areas for seat-time credit; minimum 10 hours per subject, per student." },
  { service: "Credit Recovery", oneOne: "$73.16", oneTen: "$157.57", oneThirty: "$281.38", desc: "Instruction for earning credit for seat time. Hours determined by school personnel." },
  { service: "Tutoring", oneOne: "$73.16", oneTen: "$140.69", oneThirty: "$225.10", desc: "Supplemental remedial or enrichment instruction, during or after school." },
  { service: "Resource Room", oneOne: "$73.16", oneTen: "$140.69", oneThirty: "$225.10", desc: "Mandated academic support for students with disabilities by a certified special educator." },
  { service: "Test Prep", oneOne: "$106.92", oneTen: "$168.83", oneThirty: "$230.73", desc: "Individualized synchronous instruction for standardized test prep." },
  { service: "Homework Help", oneOne: "$73.16", oneTen: "$140.69", oneThirty: "$225.10", desc: "Drop-in help for assignments brought to the session." },
  { service: "Whole Class Virtual Instruction", oneOne: "—", oneTen: "$168.83", oneThirty: "$281.38", desc: "Structured small-group or whole-class instruction in specific subject areas, potentially for seat-time credit." },
  { service: "Suspension Alternatives", oneOne: "—", oneTen: "—", oneThirty: "$281.38", desc: "Safe, supportive virtual solution for short-term suspensions (up to 10 school days, up to 15 students per class)." },
  { service: "Virtual Medical Classroom", oneOne: "—", oneTen: "—", oneThirty: "$281.38", desc: "Virtual instruction for students with medical needs (up to 15 students per class)." },
];

const ADD_ONS = [
  { name: "Content", fee: "$11.15", when: "Partner requests Fullmind educator provide content and curriculum for instruction." },
  { name: "Advanced Placement, College Level, IB", fee: "$22.29", when: "Session delivering AP, college-level, or IB instruction." },
  { name: "Assessments", fee: "$44.58", when: "Additional pre- or post-testing; recommended for 12+ week programs." },
  { name: "Co-Teaching", fee: "$78.02", when: "Fullmind educator co-teaches virtually with a district educator." },
  { name: "Educator Prep", fee: "$83.59", when: "Additional prep time (lesson planning, grading, data analysis). Billed as one hour per four hours of instruction." },
  { name: "Multilingual Learners", fee: "$55.73", when: "Supporting multilingual learners in Instructional Services." },
  { name: "Students with Disabilities", fee: "$22.29", when: "Supporting students with disabilities in Instructional Services." },
];

// ── Elevate mapping data ─────────────────────────────────────────────────────

// Plum chips = main Fullmind services. Coral chips = add-ons / specialty modifiers.
type ChipKind = "service" | "addOn";
type Mapping = { elevate: string; fullmind: Array<{ label: string; kind: ChipKind }> };
type Bucket = { id: string; name: string; items: Mapping[] };

const BUCKETS: Bucket[] = [
  {
    id: "whole-class-standard",
    name: "Whole Class Instruction (Standard Pricing)",
    items: [
      {
        elevate: "Core Subjects, World Languages, Gifted and Talented",
        fullmind: [
          { label: "Live Staffing", kind: "service" },
          { label: "Homebound", kind: "service" },
          { label: "Whole Class Instruction", kind: "service" },
          { label: "Credit Recovery", kind: "service" },
        ],
      },
    ],
  },
  {
    id: "whole-class-specialized",
    name: "Whole Class or Supplemental Instruction — Specialized Credentials",
    items: [
      {
        elevate: "Diverse Learning (SPED + ELL + Bilingual CORE)",
        fullmind: [
          { label: "Live Staffing", kind: "service" },
          { label: "Homebound", kind: "service" },
          { label: "Whole Class Instruction", kind: "service" },
          { label: "Credit Recovery", kind: "service" },
          { label: "Multilingual Learners", kind: "addOn" },
          { label: "Students with Disabilities", kind: "addOn" },
        ],
      },
      {
        elevate: "SDI",
        fullmind: [
          { label: "Content Add On", kind: "addOn" },
          { label: "Homebound + Content", kind: "addOn" },
          { label: "Whole Class + Content", kind: "addOn" },
          { label: "Students with Disabilities + Content", kind: "addOn" },
        ],
      },
      {
        elevate: "Case Management",
        fullmind: [
          { label: "Live Staffing", kind: "service" },
          { label: "Homebound", kind: "service" },
          { label: "Whole Class Instruction", kind: "service" },
          { label: "Credit Recovery", kind: "service" },
          { label: "Multilingual Learners", kind: "addOn" },
        ],
      },
      {
        elevate: "Self Contained",
        fullmind: [
          { label: "Live Staffing", kind: "service" },
          { label: "Homebound", kind: "service" },
          { label: "Whole Class Instruction", kind: "service" },
          { label: "Credit Recovery", kind: "service" },
          { label: "Students with Disabilities", kind: "addOn" },
        ],
      },
    ],
  },
  {
    id: "diverse-learning",
    name: "Diverse Learning",
    items: [
      {
        elevate: "Resource Room",
        fullmind: [
          { label: "Live Staffing", kind: "service" },
          { label: "Students with Disabilities", kind: "addOn" },
          { label: "Resource Room", kind: "service" },
        ],
      },
    ],
  },
  {
    id: "supplemental",
    name: "Supplemental",
    items: [
      {
        elevate: "SG Core Subjects",
        fullmind: [
          { label: "Live Staffing", kind: "service" },
          { label: "Tutoring", kind: "service" },
        ],
      },
      {
        elevate: "Core Subject Intervention",
        fullmind: [
          { label: "Live Staffing", kind: "service" },
          { label: "Students with Disabilities", kind: "addOn" },
          { label: "Tutoring", kind: "service" },
        ],
      },
      {
        elevate: "World Language",
        fullmind: [
          { label: "Live Staffing", kind: "service" },
          { label: "Multilingual Learners", kind: "addOn" },
          { label: "Tutoring", kind: "service" },
        ],
      },
      {
        elevate: "Core Enrichment",
        fullmind: [
          { label: "Live Staffing", kind: "service" },
          { label: "Tutoring", kind: "service" },
        ],
      },
      {
        elevate: "Tailor Made",
        fullmind: [
          { label: "Live Staffing", kind: "service" },
          { label: "Whole Class Instruction", kind: "service" },
          { label: "Tutoring", kind: "service" },
        ],
      },
    ],
  },
  {
    id: "enrichment",
    name: "Enrichment",
    items: [
      {
        elevate: "College, Career, & Technology",
        fullmind: [
          { label: "Live Staffing", kind: "service" },
          { label: "Whole Class Instruction", kind: "service" },
          { label: "Tutoring", kind: "service" },
          { label: "State Test Prep", kind: "service" },
        ],
      },
    ],
  },
  {
    id: "summer",
    name: "Summer",
    items: [
      {
        elevate: "Summer Core",
        fullmind: [
          { label: "Live Staffing", kind: "service" },
          { label: "Homebound", kind: "service" },
          { label: "Whole Class Instruction", kind: "service" },
          { label: "Credit Recovery", kind: "service" },
        ],
      },
      {
        elevate: "Summer Enrichment",
        fullmind: [
          { label: "Live Staffing", kind: "service" },
          { label: "Whole Class Instruction", kind: "service" },
          { label: "Tutoring", kind: "service" },
        ],
      },
    ],
  },
  {
    id: "professional-learning",
    name: "Professional Learning",
    items: [
      {
        elevate: "Co-Teaching",
        fullmind: [
          { label: "Live Staffing", kind: "service" },
          { label: "Students with Disabilities", kind: "addOn" },
          { label: "Paramentoring", kind: "service" },
        ],
      },
      {
        elevate: "Mentorship",
        fullmind: [{ label: "Paramentoring", kind: "service" }],
      },
    ],
  },
];

// ── Pricing model matrix ─────────────────────────────────────────────────────

const MODEL_BENEFITS: Array<{ label: string; elevate: boolean; wci: boolean; staffing: boolean }> = [
  { label: "Consistent high-quality, trained, experienced educators", elevate: true, wci: true, staffing: true },
  { label: "Teachers enter grades, lesson plan, and differentiate instruction", elevate: true, wci: true, staffing: true },
  { label: "Pay only for the instruction you need", elevate: true, wci: true, staffing: false },
  { label: "Teacher participates in PLCs at no extra cost, provides additional intervention services, homework help, etc.", elevate: false, wci: false, staffing: true },
  { label: "School/district can easily change how the teacher is utilized", elevate: false, wci: false, staffing: true },
  { label: "Maximize instructional time and resources", elevate: false, wci: false, staffing: true },
];

// ── Discount tiers ───────────────────────────────────────────────────────────

const DISCOUNT_TIERS = [
  { length: "30–44 Days", discount: "−0%", color: "#8A80A8", bg: "#F7F5FA" },
  { length: "45–59 Days", discount: "−5%", color: "#6EA3BE", bg: "#EEF4F9" },
  { length: "60–89 Days", discount: "−10%", color: "#5B8FAF", bg: "#e8f1f5" },
  { length: "90–149 Days", discount: "−15%", color: "#F37167", bg: "#FEF2F1" },
  { length: "150+ Days", discount: "−20%", color: "#D4A843", bg: "#FFF8EE" },
];

// ── In-person cost comparison ────────────────────────────────────────────────

const COST_COMPARE = [
  { bucket: "Teacher Salary (13 years avg experience in GA)", inPerson: "$69,196", fullmind: "$95,043.70" },
  { bucket: "Benefits (pension/retirement, benefits)", inPerson: "$27,354", fullmind: "—" },
  { bucket: "Class Coverage Stipend (.2 extra pay for planning period/incentives)", inPerson: "$8,000", fullmind: "—" },
  { bucket: "Substitutes (assuming ~10 days absence)", inPerson: "$1,267", fullmind: "—" },
  { bucket: "Recruitment, Onboarding & Professional Development", inPerson: "$15,000", fullmind: "—" },
];

// ── Component ────────────────────────────────────────────────────────────────

export default function PricingAndPackagingPage() {
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
            <div className="w-12 h-12 rounded-2xl bg-[#F7F5FA] flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-[#403770]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#403770]">Pricing &amp; Packaging at Fullmind</h1>
              <p className="text-sm text-[#8A80A8] mt-0.5">
                How we price services, calculate Take, and position against alternatives
              </p>
              <p className="text-[10px] text-[#A69DC0] uppercase tracking-wider mt-1">Updated April 21, 2026</p>
            </div>
          </div>
          <div className="rounded-xl bg-gradient-to-r from-[#F7F5FA] to-[#EFEDF5] p-5 border border-[#E2DEEC]">
            <p className="text-sm text-[#6E6390] leading-relaxed">
              Fullmind offers certified, live educators to schools and districts. Pricing is a lever
              that keeps the business healthy, the market accessible, and educators paid
              competitively — so every role at Fullmind has a stake in how it works. After this page
              you should know <strong className="text-[#403770]">what services we sell</strong>,{" "}
              <strong className="text-[#403770]">how they&apos;re priced</strong>,{" "}
              <strong className="text-[#403770]">how Take is calculated</strong>, and how to position
              all of this with partners.
            </p>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* OVERVIEW */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <section id="overview" className="mb-12 scroll-mt-6">
          <h2 className="text-lg font-bold text-[#403770] mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-[#403770]" />
            Why Pricing Matters to You
          </h2>
          <p className="text-sm text-[#6E6390] leading-relaxed mb-4">
            Pricing is a key lever for the health of our business. Ensuring pricing is competitive
            in the market but accessible for our customers allows us to support students and pay
            educators competitive rates.
          </p>
          <p className="text-sm text-[#6E6390] leading-relaxed mb-6">
            Everyone at Fullmind is responsible for their role&apos;s ROI. As you read this page,
            think about how your workstreams touch the pieces covered below.
          </p>

          <div className="grid grid-cols-3 gap-4">
            {[
              { icon: Layers, title: "Know the services", desc: "What Fullmind offers and how each is priced." },
              { icon: Calculator, title: "Understand Take", desc: "How Take is calculated and why it's the business metric we run on." },
              { icon: Target, title: "Position with partners", desc: "How to message pricing to new prospects and current Elevate customers." },
            ].map(({ icon: Ic, title, desc }) => (
              <div key={title} className="rounded-xl border border-[#E2DEEC] p-5 bg-white">
                <div className="w-9 h-9 rounded-lg bg-[#F7F5FA] flex items-center justify-center mb-3">
                  <Ic className="w-4 h-4 text-[#403770]" />
                </div>
                <h3 className="text-sm font-semibold text-[#403770] mb-1">{title}</h3>
                <p className="text-xs text-[#8A80A8] leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="border-t border-[#E2DEEC] mb-12" />

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* SERVICES */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <section id="services" className="mb-12 scroll-mt-6">
          <h2 className="text-lg font-bold text-[#403770] mb-4 flex items-center gap-2">
            <Layers className="w-5 h-5 text-[#403770]" />
            Services We Offer
          </h2>
          <p className="text-sm text-[#6E6390] leading-relaxed mb-8">
            Fullmind services fall into three categories:{" "}
            <strong className="text-[#403770]">Live Staffing</strong>,{" "}
            <strong className="text-[#403770]">Instructional Services</strong>, and{" "}
            <strong className="text-[#403770]">Per-Session Add-Ons</strong>. All services are
            customizable to meet the unique needs of each school and its students.
          </p>

          {/* Live Staffing */}
          <h3 className="text-sm font-bold text-[#403770] mb-1">Live Staffing</h3>
          <p className="text-xs text-[#8A80A8] italic mb-4">
            Full-time or part-time placements (part-time is a 0.6 multiplier).
          </p>

          <div className="border border-[#E2DEEC] rounded-xl overflow-hidden mb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F7F5FA] text-[10px] font-semibold text-[#8A80A8] uppercase tracking-wider">
                  <th className="text-left px-4 py-3">Role</th>
                  <th className="text-right px-4 py-3 w-24">Price/Day</th>
                  <th className="text-right px-4 py-3 w-28">180-Day Year</th>
                  <th className="text-right px-4 py-3 w-28">190-Day Year</th>
                </tr>
              </thead>
              <tbody>
                {LIVE_STAFFING.map((row, i) => (
                  <tr
                    key={row.role}
                    className={`border-t border-[#E2DEEC] ${i % 2 === 1 ? "bg-[#F7F5FA]/40" : ""}`}
                  >
                    <td className="px-4 py-3 align-top">
                      <div className="font-medium text-[#403770] mb-0.5">{row.role}</div>
                      <div className="text-xs text-[#8A80A8] leading-relaxed">{row.desc}</div>
                    </td>
                    <td className="px-4 py-3 text-right align-top font-semibold text-[#403770] tabular-nums">
                      {row.perDay}
                    </td>
                    <td className="px-4 py-3 text-right align-top font-semibold text-[#403770] tabular-nums">
                      {row.year180}
                    </td>
                    <td className="px-4 py-3 text-right align-top font-semibold text-[#403770] tabular-nums">
                      {row.year190}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Staffing fee tiles */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            {[
              { label: "Staffing Fee", fee: "$5,627.54", desc: "One-time fee added per teacher, invoiceable up front." },
              { label: "Return Educator Fee", fee: "$2,813.77", desc: "One-time fee added per teacher, invoiceable up front." },
            ].map((t) => (
              <div key={t.label} className="rounded-xl border border-[#E2DEEC] bg-white px-5 py-4">
                <div className="flex items-baseline justify-between mb-1">
                  <span className="text-sm font-semibold text-[#403770]">{t.label}</span>
                  <span className="text-sm font-bold text-[#F37167] tabular-nums">{t.fee}</span>
                </div>
                <p className="text-xs text-[#8A80A8] leading-relaxed">{t.desc}</p>
              </div>
            ))}
          </div>

          {/* Instructional Services */}
          <h3 className="text-sm font-bold text-[#403770] mb-1">Instructional Services</h3>
          <p className="text-xs text-[#8A80A8] italic mb-4">
            Hourly rates, priced by group size (1:1, 1:10, 1:30+).
          </p>

          <div className="border border-[#E2DEEC] rounded-xl overflow-hidden mb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F7F5FA] text-[10px] font-semibold text-[#8A80A8] uppercase tracking-wider">
                  <th className="text-left px-4 py-3">Service</th>
                  <th className="text-right px-4 py-3 w-20">1:1</th>
                  <th className="text-right px-4 py-3 w-20">1:10</th>
                  <th className="text-right px-4 py-3 w-20">1:30+</th>
                </tr>
              </thead>
              <tbody>
                {INSTRUCTIONAL.map((row, i) => (
                  <tr
                    key={row.service}
                    className={`border-t border-[#E2DEEC] ${i % 2 === 1 ? "bg-[#F7F5FA]/40" : ""}`}
                  >
                    <td className="px-4 py-3 align-top">
                      <div className="font-medium text-[#403770] mb-0.5">{row.service}</div>
                      <div className="text-xs text-[#8A80A8] leading-relaxed">{row.desc}</div>
                    </td>
                    <td className="px-4 py-3 text-right align-top font-semibold text-[#403770] tabular-nums">
                      {row.oneOne}
                    </td>
                    <td className="px-4 py-3 text-right align-top font-semibold text-[#403770] tabular-nums">
                      {row.oneTen}
                    </td>
                    <td className="px-4 py-3 text-right align-top font-semibold text-[#403770] tabular-nums">
                      {row.oneThirty}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Group size callout */}
          <div className="rounded-xl bg-[#e8f1f5] border border-[#8bb5cb] px-5 py-4 mb-10">
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb className="w-4 h-4 text-[#6EA3BE]" />
              <p className="text-sm font-semibold text-[#6EA3BE]">Why prices change by group size</p>
            </div>
            <p className="text-sm text-[#6E6390] leading-relaxed">
              The more students in the group, the more differentiation and data collection the
              educator has to do. We pay educators more for larger groups to reflect the higher
              demands — and our pricing reflects that.
            </p>
          </div>

          {/* Add-ons */}
          <h3 className="text-sm font-bold text-[#403770] mb-1">Per-Session Add-Ons</h3>
          <p className="text-xs text-[#8A80A8] italic mb-4">
            Fees that stack onto a base service to cover specialized situations.
          </p>

          <div className="grid grid-cols-2 gap-3">
            {ADD_ONS.map((a) => (
              <div key={a.name} className="rounded-xl border border-[#E2DEEC] bg-white px-5 py-4">
                <div className="flex items-baseline justify-between gap-3 mb-1">
                  <span className="text-sm font-semibold text-[#403770]">{a.name}</span>
                  <span className="text-sm font-bold text-[#F37167] tabular-nums flex-shrink-0">{a.fee}</span>
                </div>
                <p className="text-xs text-[#8A80A8] leading-relaxed">{a.when}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="border-t border-[#E2DEEC] mb-12" />

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* TAKE */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <section id="take" className="mb-12 scroll-mt-6">
          <h2 className="text-lg font-bold text-[#403770] mb-4 flex items-center gap-2">
            <Calculator className="w-5 h-5 text-[#403770]" />
            How Take is Calculated
          </h2>

          {/* Formula tile */}
          <div className="rounded-xl bg-gradient-to-r from-[#F7F5FA] to-[#EFEDF5] border border-[#E2DEEC] py-6 px-5 mb-6 flex items-center justify-center">
            <div className="flex items-center gap-3 flex-wrap justify-center">
              <span className="text-lg font-bold text-[#403770]">Take</span>
              <span className="text-lg font-bold text-[#A69DC0]">=</span>
              <span className="text-lg font-bold text-[#403770]">Revenue</span>
              <span className="text-lg font-bold text-[#A69DC0]">−</span>
              <span className="text-lg font-bold text-[#403770]">Educator Compensation</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-5">
            <div className="rounded-xl border border-[#E2DEEC] p-5 bg-white">
              <h3 className="text-sm font-semibold text-[#403770] mb-2">Live Staffing</h3>
              <p className="text-sm text-[#6E6390] leading-relaxed">
                Operations targets <strong className="text-[#403770]">40–50%</strong> of sale price
                for educator compensation, aiming for the bottom of that band and flexing up when a
                position is hard to staff. In one-off situations, pay can flex up to{" "}
                <strong className="text-[#403770]">60%</strong> of sale price.
              </p>
            </div>
            <div className="rounded-xl border border-[#E2DEEC] p-5 bg-white">
              <h3 className="text-sm font-semibold text-[#403770] mb-2">Instructional Services</h3>
              <p className="text-sm text-[#6E6390] leading-relaxed">
                Operations maintains pay bands per subject, calculated monthly based on service- and
                setting-specific margins plus demand/educator pool per certification. Pay bands are
                revisited monthly and may shift seasonally with student enrollment.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-[#E2DEEC] border-l-4 border-l-[#F37167] bg-white px-5 py-4">
            <p className="text-sm text-[#6E6390] leading-relaxed">
              Want a deeper dive with real examples? See the{" "}
              <a
                href="https://docs.google.com/document/d/1Uua3gNggqBWprK-LMzk4RE3wkHpUS1puyL0Wm43WgR8/edit?usp=sharing"
                target="_blank"
                rel="noreferrer"
                className="text-[#F37167] underline hover:text-[#cc5d54]"
              >
                historic Take calculations deep-dive
              </a>
              .
            </p>
          </div>
        </section>

        <div className="border-t border-[#E2DEEC] mb-12" />

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* ELEVATE MAPPING */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <section id="mapping" className="mb-12 scroll-mt-6">
          <h2 className="text-lg font-bold text-[#403770] mb-4 flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-[#403770]" />
            Elevate → Fullmind Mapping
          </h2>
          <p className="text-sm text-[#6E6390] leading-relaxed mb-6">
            Every Elevate K-12 product offering is covered by Fullmind — usually with additional
            options and flexibility. Here&apos;s how Elevate offerings map to the Fullmind services
            and add-ons that replace or extend them.
          </p>

          <div className="space-y-6">
            {BUCKETS.map((bucket) => (
              <div key={bucket.id}>
                <p className="text-[10px] font-semibold text-[#8A80A8] uppercase tracking-wider mb-3">
                  {bucket.name}
                </p>
                <div className={`grid gap-3 ${bucket.items.length >= 2 ? "grid-cols-2" : "grid-cols-1"}`}>
                  {bucket.items.map((item) => (
                    <div key={item.elevate} className="rounded-xl border border-[#E2DEEC] bg-white px-5 py-4">
                      <h3 className="text-sm font-semibold text-[#403770] mb-3">{item.elevate}</h3>
                      <div className="flex flex-wrap gap-1.5">
                        {item.fullmind.map((chip) => (
                          <span
                            key={chip.label}
                            className={`rounded-full px-3 py-1 text-xs font-medium ${
                              chip.kind === "service"
                                ? "bg-[#F7F5FA] text-[#403770] border border-[#E2DEEC]"
                                : "bg-[#FEF2F1] text-[#F37167] border border-[#f58d85]/40"
                            }`}
                          >
                            {chip.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex items-center gap-3 px-4 py-3 text-xs text-[#8A80A8]">
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-full bg-[#F7F5FA] border border-[#E2DEEC]" />
              <span>Main service</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-full bg-[#FEF2F1] border border-[#f58d85]/40" />
              <span>Add-on / specialty modifier</span>
            </div>
          </div>

          <div className="rounded-xl border border-[#E2DEEC] border-l-4 border-l-[#F37167] bg-white px-5 py-4 mt-4">
            <p className="text-sm text-[#6E6390] leading-relaxed">
              Want the full side-by-side breakdown with the problems each service solves? See the{" "}
              <a
                href="https://docs.google.com/document/d/1nvPMCzhx4YUxOsq2R_XhomtA9w3nAe491WpNzAcMxPQ/edit?usp=sharing"
                target="_blank"
                rel="noreferrer"
                className="text-[#F37167] underline hover:text-[#cc5d54]"
              >
                detailed service breakdown
              </a>
              .
            </p>
          </div>
        </section>

        <div className="border-t border-[#E2DEEC] mb-12" />

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* MODEL COMPARISON */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <section id="model-comparison" className="mb-12 scroll-mt-6">
          <h2 className="text-lg font-bold text-[#403770] mb-4 flex items-center gap-2">
            <Scale className="w-5 h-5 text-[#403770]" />
            Pricing Model Comparison
          </h2>
          <p className="text-sm text-[#6E6390] leading-relaxed mb-5">
            Elevate billed per period. Fullmind offers both per-period{" "}
            <strong className="text-[#403770]">Whole Class Virtual Instruction</strong> and
            full-time / part-time <strong className="text-[#403770]">Live Staffing</strong>. Each
            has a different value proposition for the customer.
          </p>

          <div className="border border-[#E2DEEC] rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F7F5FA] text-[10px] font-semibold text-[#8A80A8] uppercase tracking-wider">
                  <th className="text-left px-4 py-3">Benefit to the Customer</th>
                  <th className="text-center px-4 py-3 w-36">Elevate Per Period</th>
                  <th className="text-center px-4 py-3 w-40">Whole Class Instruction</th>
                  <th className="text-center px-4 py-3 w-32 bg-[#fef1f0] text-[#F37167]">Live Staffing</th>
                </tr>
              </thead>
              <tbody>
                {MODEL_BENEFITS.map((row, i) => (
                  <tr
                    key={row.label}
                    className={`border-t border-[#E2DEEC] ${i % 2 === 1 ? "bg-[#F7F5FA]/40" : ""}`}
                  >
                    <td className="px-4 py-3 text-[#6E6390]">{row.label}</td>
                    <td className="px-4 py-3 text-center">
                      {row.elevate ? (
                        <Check className="w-4 h-4 text-[#69B34A] inline-block" />
                      ) : (
                        <span className="text-[#C2BBD4]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {row.wci ? (
                        <Check className="w-4 h-4 text-[#69B34A] inline-block" />
                      ) : (
                        <span className="text-[#C2BBD4]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center bg-[#fef1f0]/40">
                      {row.staffing ? (
                        <Check className="w-4 h-4 text-[#69B34A] inline-block" />
                      ) : (
                        <span className="text-[#C2BBD4]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="border-t border-[#E2DEEC] mb-12" />

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* DISCOUNTING */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <section id="discounting" className="mb-12 scroll-mt-6">
          <h2 className="text-lg font-bold text-[#403770] mb-4 flex items-center gap-2">
            <Percent className="w-5 h-5 text-[#403770]" />
            Discounting Guidelines
          </h2>
          <p className="text-sm text-[#6E6390] leading-relaxed mb-8">
            Sales reps use two types of discounting to move deals forward.
          </p>

          {/* Placement length discounts */}
          <h3 className="text-sm font-bold text-[#403770] mb-1">Placement-Length Discounts</h3>
          <p className="text-sm text-[#6E6390] leading-relaxed mb-5">
            We incentivize longer placements because they correlate with higher teacher and student
            satisfaction, and greater consistency for everyone involved.
          </p>

          <div className="rounded-xl border border-[#E2DEEC] overflow-hidden mb-10">
            {DISCOUNT_TIERS.map((tier, i) => (
              <div
                key={tier.length}
                className={`flex items-center gap-4 px-5 py-4 ${i > 0 ? "border-t border-[#E2DEEC]" : ""}`}
                style={{ backgroundColor: tier.bg }}
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ backgroundColor: `${tier.color}20`, color: tier.color }}
                >
                  {tier.discount.replace("−", "-")}
                </div>
                <div className="flex-1">
                  <span className="text-sm font-semibold text-[#403770]">{tier.length}</span>
                </div>
                <span className="text-sm font-bold tabular-nums" style={{ color: tier.color }}>
                  {tier.discount}
                </span>
              </div>
            ))}
          </div>

          {/* Discretionary */}
          <h3 className="text-sm font-bold text-[#403770] mb-1">Discretionary Discounting</h3>
          <p className="text-sm text-[#6E6390] leading-relaxed mb-5">
            For all customers and quotes, sales reps have freedom to use discounting as a
            regionalization and/or negotiation lever. Our business runs on Take — with an average{" "}
            <strong className="text-[#403770]">50%</strong> Take on products and services,
            forecasting Take from sale price is straightforward for everyone.
          </p>

          <div className="rounded-xl border border-[#E2DEEC] border-l-4 border-l-[#F37167] bg-white px-5 py-4">
            <p className="text-sm text-[#6E6390] leading-relaxed">
              <a
                href="https://go.screenpal.com/watch/cOf2YRnOQRG"
                target="_blank"
                rel="noreferrer"
                className="text-[#F37167] underline hover:text-[#cc5d54]"
              >
                Tony Skauge walks through how Take and discretionary discounts connect
              </a>{" "}
              and how he uses discretionary discounts when building a proposal.
            </p>
          </div>
        </section>

        <div className="border-t border-[#E2DEEC] mb-12" />

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* VS IN-PERSON */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <section id="vs-in-person" className="mb-12 scroll-mt-6">
          <h2 className="text-lg font-bold text-[#403770] mb-4 flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-[#403770]" />
            Fullmind vs. In-Person Teacher
          </h2>
          <p className="text-sm text-[#6E6390] leading-relaxed mb-5">
            Here&apos;s how a full-time experienced in-person teacher compares to Fullmind&apos;s
            pricing. (Example: 13 years of average teaching experience in Georgia.)
          </p>

          <div className="border border-[#E2DEEC] rounded-xl overflow-hidden mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F7F5FA] text-[10px] font-semibold text-[#8A80A8] uppercase tracking-wider">
                  <th className="text-left px-4 py-3">Cost Bucket</th>
                  <th className="text-right px-4 py-3 w-44">Full-Time In-Person Hire</th>
                  <th className="text-right px-4 py-3 w-36">Fullmind Pricing</th>
                </tr>
              </thead>
              <tbody>
                {COST_COMPARE.map((row, i) => (
                  <tr
                    key={row.bucket}
                    className={`border-t border-[#E2DEEC] ${i % 2 === 1 ? "bg-[#F7F5FA]/40" : ""}`}
                  >
                    <td className="px-4 py-3 text-[#6E6390]">{row.bucket}</td>
                    <td className="px-4 py-3 text-right font-semibold text-[#403770] tabular-nums">
                      {row.inPerson}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-[#403770] tabular-nums">
                      {row.fullmind}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-[#403770] bg-[#EFEDF5]">
                  <td className="px-4 py-3 font-bold text-[#403770]">TOTAL</td>
                  <td className="px-4 py-3 text-right font-bold text-[#403770] tabular-nums">$120,817</td>
                  <td className="px-4 py-3 text-right font-bold text-[#F37167] tabular-nums">$95,043.70</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Savings callout */}
          <div className="rounded-xl bg-[#fef1f0] border border-[#f58d85] px-6 py-5 text-center">
            <p className="text-2xl font-bold text-[#F37167] tabular-nums mb-1">
              ~$25,774 savings per full-time hire
            </p>
            <p className="text-sm text-[#6E6390]">
              And Fullmind handles recruitment, PD, absences, and benefits.
            </p>
          </div>
        </section>

        <div className="border-t border-[#E2DEEC] mb-12" />

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* VIDEOS & DEEP DIVES */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <section id="videos" className="mb-12 scroll-mt-6">
          <h2 className="text-lg font-bold text-[#403770] mb-4 flex items-center gap-2">
            <PlayCircle className="w-5 h-5 text-[#403770]" />
            Videos &amp; Deep Dives
          </h2>
          <p className="text-sm text-[#6E6390] leading-relaxed mb-6">
            Hear how your teammates position this with customers, then dive deeper with the linked
            resources.
          </p>

          {/* Video 1 */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <PlayCircle className="w-4 h-4 text-[#F37167]" />
              <span className="text-sm font-semibold text-[#403770]">Jenn Russart — Pricing Positioning</span>
            </div>
            <p className="text-xs text-[#8A80A8] mb-3">
              Jenn&apos;s initial reaction to Fullmind&apos;s pricing and how she positions it with customers.
            </p>
            <div className="aspect-[9/16] max-w-xs mx-auto rounded-xl overflow-hidden border border-[#E2DEEC] bg-[#F7F5FA]">
              <iframe
                src="https://drive.google.com/file/d/1b2zIzoU6bYkPSeh_BqTWj4kTKbyfWLSD/preview"
                className="w-full h-full"
                allow="autoplay"
                allowFullScreen
                loading="lazy"
                title="Jenn Russart on Pricing Positioning"
              />
            </div>
          </div>

          {/* Video 2 */}
          <div className="mb-10">
            <div className="flex items-center gap-2 mb-2">
              <PlayCircle className="w-4 h-4 text-[#F37167]" />
              <span className="text-sm font-semibold text-[#403770]">Tony Skauge — Discounting in Proposals</span>
            </div>
            <p className="text-xs text-[#8A80A8] mb-3">
              How Take and discretionary discounts connect, and how Tony uses discretionary discounts when creating a proposal.
            </p>
            <div className="aspect-video rounded-xl overflow-hidden border border-[#E2DEEC] bg-[#F7F5FA]">
              <iframe
                src="https://go.screenpal.com/player/cOf2YRnOQRG?ff=1&title=0"
                className="w-full h-full"
                allow="autoplay; fullscreen"
                allowFullScreen
                loading="lazy"
                title="Tony Skauge on Discounting"
              />
            </div>
          </div>

          <p className="text-[10px] font-semibold text-[#8A80A8] uppercase tracking-wider mb-3">Deep Dives</p>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <a
              href="https://docs.google.com/document/d/1Uua3gNggqBWprK-LMzk4RE3wkHpUS1puyL0Wm43WgR8/edit?usp=sharing"
              target="_blank"
              rel="noreferrer"
              className="group rounded-xl border border-[#E2DEEC] bg-white px-5 py-4 hover:border-[#F37167] transition-colors duration-100"
            >
              <div className="flex items-center gap-2 mb-2">
                <Calculator className="w-4 h-4 text-[#403770]" />
                <span className="text-sm font-semibold text-[#403770]">Historic Take Calculations</span>
                <ExternalLink className="w-3.5 h-3.5 text-[#A69DC0] ml-auto group-hover:text-[#F37167]" />
              </div>
              <p className="text-xs text-[#8A80A8] leading-relaxed">
                Deep dive into Take with real examples.
              </p>
            </a>

            <a
              href="https://docs.google.com/document/d/1nvPMCzhx4YUxOsq2R_XhomtA9w3nAe491WpNzAcMxPQ/edit?usp=sharing"
              target="_blank"
              rel="noreferrer"
              className="group rounded-xl border border-[#E2DEEC] bg-white px-5 py-4 hover:border-[#F37167] transition-colors duration-100"
            >
              <div className="flex items-center gap-2 mb-2">
                <LayoutGrid className="w-4 h-4 text-[#403770]" />
                <span className="text-sm font-semibold text-[#403770]">Detailed Service Breakdown</span>
                <ExternalLink className="w-3.5 h-3.5 text-[#A69DC0] ml-auto group-hover:text-[#F37167]" />
              </div>
              <p className="text-xs text-[#8A80A8] leading-relaxed">
                What common problems each service solves, side-by-side.
              </p>
            </a>
          </div>

          <a
            href="https://docs.google.com/forms/d/e/1FAIpQLScSEHwePTtEGweVkJJhM_PYz0sjZIdaLO2qjjiB-n-TCdZdAw/viewform?usp=publish-editor"
            target="_blank"
            rel="noreferrer"
            className="group block rounded-xl border border-[#E2DEEC] border-l-4 border-l-[#F37167] bg-white px-5 py-4 hover:border-[#F37167] transition-colors duration-100"
          >
            <div className="flex items-center gap-2 mb-2">
              <ClipboardCheck className="w-4 h-4 text-[#F37167]" />
              <span className="text-sm font-semibold text-[#403770]">Training Check</span>
              <ExternalLink className="w-3.5 h-3.5 text-[#A69DC0] ml-auto group-hover:text-[#F37167]" />
            </div>
            <p className="text-xs text-[#8A80A8] leading-relaxed">
              Complete the form to review your understanding of this training.
            </p>
          </a>
        </section>
      </div>
    </div>
  );
}
