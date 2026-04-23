"use client";

import {
  GraduationCap,
  Sparkles,
  BookOpen,
  BookMarked,
  HelpCircle,
  LayoutGrid,
  Check,
  House,
  Users,
  PauseCircle,
  UsersRound,
  Accessibility,
  ClipboardCheck,
  Info,
  FileText,
  BarChart3,
  NotebookPen,
  GitBranch,
  UserCheck,
} from "lucide-react";
import type { ComponentType, SVGProps } from "react";

// ── Table of contents ────────────────────────────────────────────────────────

const TOC = [
  { id: "overview", label: "Overview" },
  { id: "core-credit-bearing", label: "Core Credit-Bearing" },
  { id: "supplemental", label: "Supplemental" },
  { id: "supports-glossary", label: "What Supports Mean" },
  { id: "comparison-matrix", label: "Comparison Matrix" },
];

// ── Service data ─────────────────────────────────────────────────────────────

type LucideIcon = ComponentType<SVGProps<SVGSVGElement>>;
type Tri = "yes" | "no" | "note";
type TofR = "Required" | "Optional";

type Service = {
  name: string;
  icon: LucideIcon;
  delivery: string[]; // e.g. ["1:1", "SG", "WC"]
  challenge: string;
  solution: string;
  tofr: TofR;
  lms: Tri;
  exitTickets: Tri;
  miniLesson: Tri;
  swdProgress: Tri;
  gradebooks: Tri;
  gradebooksNote?: string;
  instructionType: "Core Credit-Bearing" | "Supplemental";
};

const CORE_SERVICES: Service[] = [
  {
    name: "Homebound",
    icon: House,
    delivery: ["1:1"],
    challenge:
      "Mental and physical health challenges, as well as long-term suspension, can prevent students from attending school in a traditional setting. As a result, students often fall behind and require personalized, student-centered instruction.",
    solution:
      "Our educators collaborate directly with the teacher of record to deliver instruction fully aligned with the school's curriculum, ensuring students stay on track. When needed, we also provide customized, state-standards-aligned curriculum to meet students at their current level. Our educator pool includes certified teachers experienced in supporting students with disabilities and other specialized needs.",
    tofr: "Required",
    lms: "yes",
    exitTickets: "yes",
    miniLesson: "yes",
    swdProgress: "yes",
    gradebooks: "yes",
    instructionType: "Core Credit-Bearing",
  },
  {
    name: "Whole Class Virtual Instruction",
    icon: Users,
    delivery: ["SG", "WC"],
    challenge:
      "Staffing shortages can leave schools unable to offer certain courses or reliant on uncertified educators.",
    solution:
      "Fullmind ensures every course is led by a certified educator through high-quality virtual instruction. We specialize in supporting hard-to-staff subject areas so schools can maintain full course offerings.",
    tofr: "Optional",
    lms: "yes",
    exitTickets: "yes",
    miniLesson: "yes",
    swdProgress: "yes",
    gradebooks: "yes",
    instructionType: "Core Credit-Bearing",
  },
  {
    name: "Credit Recovery",
    icon: GraduationCap,
    delivery: ["1:1", "SG", "WC"],
    challenge:
      "Dropout rates and academic underperformance increase when students struggle with coursework, absenteeism, or behavioral challenges.",
    solution:
      "Our flexible credit recovery program helps students earn missed credits and regain academic progress. Live, state-certified educators provide real-time instruction aligned with the school's curriculum. We track attendance, participation, and progress, keeping schools informed every step of the way.",
    tofr: "Required",
    lms: "yes",
    exitTickets: "yes",
    miniLesson: "yes",
    swdProgress: "no",
    gradebooks: "yes",
    instructionType: "Core Credit-Bearing",
  },
  {
    name: "Suspension Alternative",
    icon: PauseCircle,
    delivery: ["WC", "SG"],
    challenge:
      "Rising suspension rates disrupt learning, negatively impact academic progress, and raise concerns around students' mental and emotional wellbeing.",
    solution:
      "Our carefully selected educators partner with classroom teachers to ensure students remain on track academically during suspension periods. We also incorporate social-emotional learning supports to promote a smooth and successful transition back into the classroom.",
    tofr: "Optional",
    lms: "yes",
    exitTickets: "yes",
    miniLesson: "yes",
    swdProgress: "no",
    gradebooks: "yes",
    instructionType: "Core Credit-Bearing",
  },
  {
    name: "Hybrid Staffing",
    icon: UsersRound,
    delivery: ["1:1", "SG", "WC"],
    challenge:
      "Staffing shortages can prevent schools from fully supporting specialized programs, including services for students with disabilities, resource rooms, and self-contained classrooms.",
    solution:
      "Our hybrid educators collaborate closely with school leaders and in-person facilitators, integrating seamlessly into the school team. Together, we ensure students receive consistent, high-quality instruction and support.",
    tofr: "Optional",
    lms: "no",
    exitTickets: "no",
    miniLesson: "no",
    swdProgress: "no",
    gradebooks: "note",
    gradebooksNote: "School's platform",
    instructionType: "Core Credit-Bearing",
  },
];

const SUPPLEMENTAL_SERVICES: Service[] = [
  {
    name: "Tutoring",
    icon: BookOpen,
    delivery: ["1:1", "SG", "WC"],
    challenge:
      "Some students require additional support or acceleration beyond what classroom teachers can provide within the school day.",
    solution:
      "We deliver high-dosage, K–12 tutoring through frequent, data-driven sessions led by certified educators. Programs are customized to each school's goals and designed to accelerate student growth.",
    tofr: "Optional",
    lms: "yes",
    exitTickets: "yes",
    miniLesson: "yes",
    swdProgress: "no",
    gradebooks: "no",
    instructionType: "Supplemental",
  },
  {
    name: "Resource Room",
    icon: Accessibility,
    delivery: ["1:1", "SG", "WC"],
    challenge:
      "Shortages of certified special-education teachers make it challenging for schools to meet IEP requirements and ensure FAPE compliance.",
    solution:
      "Our educators design instruction aligned to each student's unique IEP goals, providing required accommodations and targeted support. We share regular progress-monitoring updates to ensure transparency and alignment with school teams and families.",
    tofr: "Optional",
    lms: "yes",
    exitTickets: "yes",
    miniLesson: "yes",
    swdProgress: "yes",
    gradebooks: "no",
    instructionType: "Supplemental",
  },
  {
    name: "Test Prep",
    icon: ClipboardCheck,
    delivery: ["1:1", "SG", "WC"],
    challenge:
      "Students may struggle on high-stakes assessments due to content gaps, limited familiarity with test structure, or testing anxiety.",
    solution:
      "Our educators deliver data-driven instruction to close academic gaps, build confidence, and prepare students for success on high-stakes assessments.",
    tofr: "Optional",
    lms: "yes",
    exitTickets: "yes",
    miniLesson: "yes",
    swdProgress: "no",
    gradebooks: "no",
    instructionType: "Supplemental",
  },
  {
    name: "Homework Help",
    icon: HelpCircle,
    delivery: ["1:1", "SG", "WC"],
    challenge:
      "Students may need additional guidance to complete assignments successfully or benefit from extra practice with a certified teacher.",
    solution:
      "We provide virtual after-school homework support, where certified educators offer real-time assistance tailored to students' immediate needs.",
    tofr: "Optional",
    lms: "yes",
    exitTickets: "yes",
    miniLesson: "yes",
    swdProgress: "no",
    gradebooks: "no",
    instructionType: "Supplemental",
  },
  {
    name: "iTutor",
    icon: Sparkles,
    delivery: ["1:1"],
    challenge:
      "Families often seek supplemental instruction to support students who need additional academic growth or enrichment.",
    solution:
      "Our educators create fully customized instruction plans based on each student's needs, helping them build skills, confidence, and measurable academic progress.",
    tofr: "Optional",
    lms: "no",
    exitTickets: "no",
    miniLesson: "no",
    swdProgress: "no",
    gradebooks: "no",
    instructionType: "Supplemental",
  },
];

// ── Shared bits ──────────────────────────────────────────────────────────────

function DeliveryChip({ label }: { label: string }) {
  return (
    <span className="inline-block rounded-full bg-[#F7F5FA] text-[#403770] text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 border border-[#E2DEEC]">
      {label}
    </span>
  );
}

function TofRPill({ value }: { value: TofR }) {
  return value === "Required" ? (
    <span className="inline-flex items-center rounded-full bg-[#403770] text-white text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5">
      Required
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-[#F7F5FA] text-[#8A80A8] text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 border border-[#E2DEEC]">
      Optional
    </span>
  );
}

function TriCell({ value, note }: { value: Tri; note?: string }) {
  if (value === "yes") return <Check className="w-4 h-4 text-[#69B34A] inline-block" />;
  if (value === "note")
    return <span className="text-[11px] italic text-[#8A80A8]">{note ?? "—"}</span>;
  return <span className="text-[#A69DC0]">—</span>;
}

function FeatureStripItem({
  icon: Ic,
  label,
  value,
  note,
}: {
  icon: LucideIcon;
  label: string;
  value: Tri;
  note?: string;
}) {
  const active = value === "yes";
  const isNote = value === "note";
  return (
    <div
      className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 ${
        active
          ? "bg-[#F7FFF2] border border-[#8AC670]/50"
          : "bg-[#F7F5FA] border border-[#E2DEEC]"
      }`}
    >
      <Ic className={`w-3.5 h-3.5 ${active ? "text-[#69B34A]" : "text-[#A69DC0]"}`} />
      <span className={`text-[11px] font-medium ${active ? "text-[#403770]" : "text-[#8A80A8]"}`}>
        {label}
      </span>
      {isNote ? (
        <span className="text-[10px] italic text-[#8A80A8]">({note})</span>
      ) : active ? (
        <Check className="w-3 h-3 text-[#69B34A]" />
      ) : (
        <span className="text-[#A69DC0] text-xs leading-none">—</span>
      )}
    </div>
  );
}

function ServiceCard({ service }: { service: Service }) {
  const Icon = service.icon;
  return (
    <div className="rounded-xl border border-[#E2DEEC] bg-white px-6 py-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#F7F5FA] flex items-center justify-center flex-shrink-0">
            <Icon className="w-4 h-4 text-[#403770]" />
          </div>
          <h3 className="text-base font-bold text-[#403770]">{service.name}</h3>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {service.delivery.map((d) => (
            <DeliveryChip key={d} label={d} />
          ))}
        </div>
      </div>

      {/* Challenge */}
      <p className="text-[10px] font-semibold text-[#8A80A8] uppercase tracking-wider mb-1.5">
        The Challenge
      </p>
      <p className="text-sm text-[#6E6390] leading-relaxed mb-4">{service.challenge}</p>

      {/* Solution */}
      <p className="text-[10px] font-semibold text-[#8A80A8] uppercase tracking-wider mb-1.5">
        How We Solve It
      </p>
      <p className="text-sm text-[#6E6390] leading-relaxed mb-5">{service.solution}</p>

      {/* Feature strip */}
      <div className="border-t border-[#E2DEEC] pt-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] font-semibold text-[#8A80A8] uppercase tracking-wider">
            Teacher of Record
          </span>
          <TofRPill value={service.tofr} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <FeatureStripItem icon={FileText} label="LMS" value={service.lms} />
          <FeatureStripItem icon={ClipboardCheck} label="Exit Tickets" value={service.exitTickets} />
          <FeatureStripItem icon={NotebookPen} label="Mini Lesson" value={service.miniLesson} />
          <FeatureStripItem icon={BarChart3} label="SWD Progress" value={service.swdProgress} />
          <FeatureStripItem
            icon={GraduationCap}
            label="Gradebooks"
            value={service.gradebooks}
            note={service.gradebooksNote}
          />
        </div>
      </div>
    </div>
  );
}

// ── Glossary ─────────────────────────────────────────────────────────────────

const GLOSSARY: Array<{ icon: LucideIcon; label: string; desc: string }> = [
  {
    icon: Users,
    label: "Delivery Type",
    desc: "How students are grouped during instruction: 1:1 (one student with one educator), SG (small group), WC (whole class).",
  },
  {
    icon: GitBranch,
    label: "Instruction Type",
    desc: "Either Core Credit-Bearing (earns credit for seat time in a course) or Supplemental (supports the student's existing schedule without granting credit).",
  },
  {
    icon: UserCheck,
    label: "Teacher of Record",
    desc: "Whether the service requires a school-side teacher of record to co-own instruction. Required for credit-bearing services; optional for most supplemental services.",
  },
  {
    icon: FileText,
    label: "LMS",
    desc: "Fullmind's learning management system. Where lessons, assignments, and materials live for the student and educator.",
  },
  {
    icon: ClipboardCheck,
    label: "Exit Tickets",
    desc: "Short end-of-session checks for understanding. Captured in the LMS and used to inform the next session.",
  },
  {
    icon: NotebookPen,
    label: "Mini Lesson",
    desc: "A focused, short-form lesson embedded in each session to address a specific skill or standard.",
  },
  {
    icon: BarChart3,
    label: "SWD Progress Monitoring",
    desc: "Regular tracking of progress toward IEP goals for students with disabilities, shared with school teams.",
  },
  {
    icon: GraduationCap,
    label: "Fullmind Gradebooks",
    desc: "Fullmind-hosted gradebooks for services where grading happens in our platform. For Hybrid Staffing, grading happens on the school's platform instead.",
  },
];

// ── Component ────────────────────────────────────────────────────────────────

export default function OurServiceModelPage() {
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
            <div className="w-12 h-12 rounded-2xl bg-[#F7F5FA] flex items-center justify-center">
              <GraduationCap className="w-6 h-6 text-[#403770]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#403770]">Our Service Model</h1>
              <p className="text-sm text-[#8A80A8] mt-0.5">
                How we structure services, what each one solves, and the supports that come with them
              </p>
            </div>
          </div>
          <div className="rounded-xl bg-gradient-to-r from-[#F7F5FA] to-[#EFEDF5] p-5 border border-[#E2DEEC]">
            <p className="text-sm text-[#6E6390] leading-relaxed">
              This page outlines our current service model — the core structures and supports that
              guide our work. While this reflects our standard approach,{" "}
              <strong className="text-[#403770]">
                flexibility remains a cornerstone of our partnerships
              </strong>
              . We collaborate closely with each school to adapt processes, tools, and roles so they
              align with the school&apos;s specific goals, context, and priorities.
            </p>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* OVERVIEW */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <section id="overview" className="mb-12 scroll-mt-6">
          <h2 className="text-lg font-bold text-[#403770] mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#403770]" />
            Built to Adapt to Each School
          </h2>
          <p className="text-sm text-[#6E6390] leading-relaxed mb-5">
            Fullmind organizes services into two high-level buckets:{" "}
            <strong className="text-[#403770]">Core Credit-Bearing Instruction</strong> (earning
            credit for seat time and full courses) and{" "}
            <strong className="text-[#403770]">Supplemental Instruction</strong> (additional
            support, intervention, and enrichment alongside the student&apos;s normal schedule).
            Each service has a default model with built-in supports. Each service is also
            customizable.
          </p>

          {/* Adaptability callout */}
          <div className="rounded-xl bg-[#fef1f0] border border-[#f58d85] border-l-4 border-l-[#F37167] px-6 py-5 mb-6">
            <div className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-[#F37167] flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-base font-bold text-[#F37167] mb-1">
                  Adaptability is central to how we work.
                </p>
                <p className="text-sm text-[#6E6390] leading-relaxed">
                  The structures below are our default. We tailor tools, roles, and
                  responsibilities to align with each school&apos;s unique needs and priorities.
                </p>
              </div>
            </div>
          </div>

          {/* Two-bucket intro grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl border border-[#E2DEEC] p-5 bg-white">
              <div className="w-9 h-9 rounded-lg bg-[#F7F5FA] flex items-center justify-center mb-3">
                <BookOpen className="w-4 h-4 text-[#403770]" />
              </div>
              <h3 className="text-sm font-semibold text-[#403770] mb-1">
                Core Credit-Bearing Instruction
              </h3>
              <p className="text-xs text-[#8A80A8] leading-relaxed mb-3">
                Services that grant credit for seat time in a course. Usually require a teacher of
                record partnership.
              </p>
              <p className="text-[10px] font-semibold text-[#8A80A8] uppercase tracking-wider mb-1">
                Includes
              </p>
              <p className="text-xs text-[#6E6390]">
                Homebound · Whole Class Virtual Instruction · Credit Recovery · Suspension
                Alternative · Hybrid Staffing
              </p>
            </div>
            <div className="rounded-xl border border-[#E2DEEC] p-5 bg-white">
              <div className="w-9 h-9 rounded-lg bg-[#F7F5FA] flex items-center justify-center mb-3">
                <BookMarked className="w-4 h-4 text-[#403770]" />
              </div>
              <h3 className="text-sm font-semibold text-[#403770] mb-1">
                Supplemental Instruction
              </h3>
              <p className="text-xs text-[#8A80A8] leading-relaxed mb-3">
                Services that support or accelerate the student&apos;s existing schedule — not
                replacing courses.
              </p>
              <p className="text-[10px] font-semibold text-[#8A80A8] uppercase tracking-wider mb-1">
                Includes
              </p>
              <p className="text-xs text-[#6E6390]">
                Tutoring · Resource Room · Test Prep · Homework Help · iTutor
              </p>
            </div>
          </div>
        </section>

        <div className="border-t border-[#E2DEEC] mb-12" />

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* CORE CREDIT-BEARING */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <section id="core-credit-bearing" className="mb-12 scroll-mt-6">
          <h2 className="text-lg font-bold text-[#403770] mb-4 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[#403770]" />
            Core Credit-Bearing Services
          </h2>
          <p className="text-sm text-[#6E6390] leading-relaxed mb-6">
            Services that deliver full courses and count toward seat-time credit. Each is led by a
            certified educator.
          </p>

          <div className="space-y-4">
            {CORE_SERVICES.map((s) => (
              <ServiceCard key={s.name} service={s} />
            ))}
          </div>
        </section>

        <div className="border-t border-[#E2DEEC] mb-12" />

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* SUPPLEMENTAL */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <section id="supplemental" className="mb-12 scroll-mt-6">
          <h2 className="text-lg font-bold text-[#403770] mb-4 flex items-center gap-2">
            <BookMarked className="w-5 h-5 text-[#403770]" />
            Supplemental Services
          </h2>
          <p className="text-sm text-[#6E6390] leading-relaxed mb-6">
            Services that support or accelerate students alongside their regular schedule. Not
            credit-bearing.
          </p>

          <div className="space-y-4">
            {SUPPLEMENTAL_SERVICES.map((s) => (
              <ServiceCard key={s.name} service={s} />
            ))}
          </div>
        </section>

        <div className="border-t border-[#E2DEEC] mb-12" />

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* GLOSSARY */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <section id="supports-glossary" className="mb-12 scroll-mt-6">
          <h2 className="text-lg font-bold text-[#403770] mb-4 flex items-center gap-2">
            <Info className="w-5 h-5 text-[#403770]" />
            What These Supports Mean
          </h2>
          <p className="text-sm text-[#6E6390] leading-relaxed mb-6">
            A quick reference for the features and supports called out on each service.
          </p>

          <div className="grid grid-cols-2 gap-3">
            {GLOSSARY.map(({ icon: Ic, label, desc }) => (
              <div key={label} className="rounded-xl border border-[#E2DEEC] bg-white p-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-7 h-7 rounded-lg bg-[#F7F5FA] flex items-center justify-center flex-shrink-0">
                    <Ic className="w-3.5 h-3.5 text-[#403770]" />
                  </div>
                  <span className="text-sm font-semibold text-[#403770]">{label}</span>
                </div>
                <p className="text-xs text-[#8A80A8] leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="border-t border-[#E2DEEC] mb-12" />

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* COMPARISON MATRIX */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <section id="comparison-matrix" className="mb-12 scroll-mt-6">
          <h2 className="text-lg font-bold text-[#403770] mb-4 flex items-center gap-2">
            <LayoutGrid className="w-5 h-5 text-[#403770]" />
            Service Comparison Matrix
          </h2>
          <p className="text-sm text-[#6E6390] leading-relaxed mb-5">
            Quick at-a-glance comparison across all services and supports.
          </p>

          <div className="border border-[#E2DEEC] rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F7F5FA] text-[10px] font-semibold text-[#8A80A8] uppercase tracking-wider">
                  <th className="text-left px-3 py-3">Service</th>
                  <th className="text-left px-3 py-3 w-28">Delivery</th>
                  <th className="text-left px-3 py-3 w-24">TofR</th>
                  <th className="text-center px-3 py-3 w-14">LMS</th>
                  <th className="text-center px-3 py-3 w-16">Exit</th>
                  <th className="text-center px-3 py-3 w-16">Mini</th>
                  <th className="text-center px-3 py-3 w-16">SWD</th>
                  <th className="text-center px-3 py-3 w-28">Gradebooks</th>
                </tr>
              </thead>
              <tbody>
                {/* Core group header */}
                <tr className="bg-[#fef1f0]">
                  <td
                    colSpan={8}
                    className="px-3 py-2 text-[10px] font-bold text-[#F37167] uppercase tracking-wider"
                  >
                    Core Credit-Bearing
                  </td>
                </tr>
                {CORE_SERVICES.map((s, i) => (
                  <tr
                    key={s.name}
                    className={`border-t border-[#E2DEEC] ${i % 2 === 1 ? "bg-[#F7F5FA]/40" : ""}`}
                  >
                    <td className="px-3 py-3 font-medium text-[#403770]">
                      {s.name === "Suspension Alternative" ? (
                        <>
                          Suspension Alternative
                          <span className="text-xs text-[#8A80A8] font-normal">
                            {" "}
                            (Virtual Classroom)
                          </span>
                        </>
                      ) : (
                        s.name
                      )}
                    </td>
                    <td className="px-3 py-3 text-xs text-[#6E6390]">{s.delivery.join(", ")}</td>
                    <td className="px-3 py-3">
                      <TofRPill value={s.tofr} />
                    </td>
                    <td className="px-3 py-3 text-center">
                      <TriCell value={s.lms} />
                    </td>
                    <td className="px-3 py-3 text-center">
                      <TriCell value={s.exitTickets} />
                    </td>
                    <td className="px-3 py-3 text-center">
                      <TriCell value={s.miniLesson} />
                    </td>
                    <td className="px-3 py-3 text-center">
                      <TriCell value={s.swdProgress} />
                    </td>
                    <td className="px-3 py-3 text-center">
                      <TriCell value={s.gradebooks} note={s.gradebooksNote} />
                    </td>
                  </tr>
                ))}

                {/* Supplemental group header */}
                <tr className="bg-[#fef1f0] border-t border-[#E2DEEC]">
                  <td
                    colSpan={8}
                    className="px-3 py-2 text-[10px] font-bold text-[#F37167] uppercase tracking-wider"
                  >
                    Supplemental
                  </td>
                </tr>
                {SUPPLEMENTAL_SERVICES.map((s, i) => (
                  <tr
                    key={s.name}
                    className={`border-t border-[#E2DEEC] ${i % 2 === 1 ? "bg-[#F7F5FA]/40" : ""}`}
                  >
                    <td className="px-3 py-3 font-medium text-[#403770]">{s.name}</td>
                    <td className="px-3 py-3 text-xs text-[#6E6390]">{s.delivery.join(", ")}</td>
                    <td className="px-3 py-3">
                      <TofRPill value={s.tofr} />
                    </td>
                    <td className="px-3 py-3 text-center">
                      <TriCell value={s.lms} />
                    </td>
                    <td className="px-3 py-3 text-center">
                      <TriCell value={s.exitTickets} />
                    </td>
                    <td className="px-3 py-3 text-center">
                      <TriCell value={s.miniLesson} />
                    </td>
                    <td className="px-3 py-3 text-center">
                      <TriCell value={s.swdProgress} />
                    </td>
                    <td className="px-3 py-3 text-center">
                      <TriCell value={s.gradebooks} note={s.gradebooksNote} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="mt-3 flex items-center gap-4 text-xs text-[#8A80A8]">
            <div className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-[#69B34A]" />
              <span>Included</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[#A69DC0]">—</span>
              <span>Not included</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs italic text-[#8A80A8]">italic</span>
              <span>Special note</span>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
