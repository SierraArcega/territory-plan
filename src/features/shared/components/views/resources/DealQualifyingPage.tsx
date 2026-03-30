"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, ExternalLink, Search } from "lucide-react";

// ── Expandable Section ────────────────────────────────────────────────────────

function ExpandableSection({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-t border-[#E2DEEC]">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full py-2.5 text-left text-sm font-medium text-[#544A78] hover:text-[#403770] transition-colors duration-100"
      >
        {open ? (
          <ChevronDown className="w-3.5 h-3.5 text-[#8A80A8]" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-[#8A80A8]" />
        )}
        {title}
      </button>
      {open && <div className="pb-3 text-sm text-[#6E6390] leading-relaxed">{children}</div>}
    </div>
  );
}

// ── Pipeline Stage Data ───────────────────────────────────────────────────────

const PIPELINE_STAGES = [
  {
    stage: 0,
    pct: "0%",
    name: "Meeting Booked",
    framework: "bant" as const,
    criteria: ["Identification of leads"],
    customerActions: ["Prospect has agreed to a scheduled meeting"],
  },
  {
    stage: 1,
    pct: "10%",
    name: "Discovery",
    framework: "bant" as const,
    criteria: ["Assess lead qualification", "Research BANT criteria"],
    customerActions: [
      "Prospect has agreed to be qualified and shared BANT information",
      "Customer knows we are determining whether they are a good fit",
    ],
  },
  {
    stage: 2,
    pct: "40%",
    name: "Presentation",
    framework: "bant" as const,
    criteria: [
      "Synchronous meeting with buyer",
      "Finalize BANT criteria",
    ],
    customerActions: [
      "Prospect has invited people on their deal committee to a sales discussion",
      "Explicitly confirm BANT with attendees",
      "Almost always a synchronous meeting with more than one person",
    ],
  },
  {
    stage: 3,
    pct: "60%",
    name: "Proposal",
    framework: "medpicc" as const,
    criteria: [
      "Written quote shared with customer",
      "Teacher certifications (subject and in/out of state)",
      "Start date and end date",
      "SWD? Translators? Content needed?",
    ],
    customerActions: [
      "Prospect has asked for a written quote with a dollar figure",
      "Proposal has everything necessary to send an actual invoice",
      "Prospect has confirmed MEDPICC Questions — ideally in writing",
    ],
  },
  {
    stage: 4,
    pct: "70%",
    name: "Negotiation",
    framework: "medpicc" as const,
    criteria: [
      "Active contract negotiations",
      "Confident on knowledge of MEDPICC",
    ],
    customerActions: [
      "Prospect has confirmed receipt and discussed the quote",
      "Deadline attached to when they will respond",
      "If deadline slips, confirm relevant MEDPICC again in writing",
    ],
  },
  {
    stage: 5,
    pct: "90%",
    name: "Commitment",
    framework: "medpicc" as const,
    criteria: [
      "Negotiations have concluded",
      "Only remaining step is final signature",
    ],
    customerActions: [
      "Prospect has confirmed the contract is approved and the last step is signing",
      "Confirmed in writing that only an actual signature remains, along with who is signing",
    ],
  },
];

// ── BANT Data ─────────────────────────────────────────────────────────────────

const BANT_ELEMENTS = [
  {
    letter: "B",
    name: "Budget",
    definition: "What is the budget and how is it determined?",
    topQuestions: [
      "What is the budget and how is it determined?",
      "How much does the problem currently cost you?",
      "How do you measure ROI for investments like this?",
    ],
    questions: [
      "What is the budget?",
      "How is it determined?",
      "Why isn't it higher or lower?",
      "Is this part of a larger budget?",
      "How much does the problem/need currently cost you or will cost you in the future?",
      "Have you tried a similar product or service before? What did you pay for it?",
      "How important is cost compared to other factors such as customization, features of the service, etc.?",
      "Do you anticipate any changes to your budget in the near future that could impact this decision?",
      "How do you measure ROI or value for investments like this?",
      "Have you compared our pricing with other vendors?",
    ],
  },
  {
    letter: "A",
    name: "Authority",
    definition: "Who has the ability to say yes and make the final decision?",
    topQuestions: [
      "Who has the ability to say yes?",
      "Who makes the final decision?",
      "Do you have a formal approval process?",
    ],
    questions: [
      "Who has the ability to say yes?",
      "Who is involved in the purchasing process?",
      "What is your role in the decision-making process?",
      "Who makes the final decision?",
      "Who else should we include in this conversation?",
      "Do you have a formal approval process for making purchases like this?",
      "What information do you need from my team to help move the decision forward?",
    ],
  },
  {
    letter: "N",
    name: "Need",
    definition: "What problems are they trying to solve?",
    topQuestions: [
      "What problems are you trying to solve?",
      "What prompted you to look for a solution now?",
      "What would a successful solution look like?",
    ],
    questions: [
      "What problems are you trying to solve?",
      "What specific challenges or pain points are you trying to solve with this solution?",
      "Where are these problems on their priority list?",
      "What solutions have you tried?",
      "What prompted you to start looking for a solution now?",
      "How are you currently handling this issue or challenge?",
      "What would a successful solution look like to you?",
      "What are the most important features or capabilities you're looking for in a solution?",
      "Who will benefit most from this solution within your organization?",
      "How do you envision this solution fitting into your existing processes?",
    ],
  },
  {
    letter: "T",
    name: "Timing",
    definition:
      "When would they be ready to implement our solutions including payment?",
    topQuestions: [
      "When would you be ready to implement including payment?",
      "What determines the timeline / close date?",
      "What happens if we miss this date?",
    ],
    questions: [
      "When would you be ready to implement our solutions including payment?",
      "What determines the timeline / close date?",
      "What happens if we miss this date?",
      "What is your ideal timeline for implementing this solution?",
      "Are there any specific deadlines or events driving your need for a solution?",
      "How soon are you looking to start using the solution once it's implemented?",
      "What other factors, apart from the solution itself, might impact the timeline (e.g., budget cycles, internal reviews)?",
      "What would prevent you from making a decision within your desired timeframe?",
      "Is there any flexibility in your timeline, or is this a hard deadline?",
      "How long does your evaluation process typically take for a solution like this?",
      "If we're able to meet your needs and budget, do you see any reason why the timeline couldn't be met?",
    ],
  },
];

// ── MEDPICC Data ──────────────────────────────────────────────────────────────

const MEDPICC_ELEMENTS = [
  {
    letter: "M",
    name: "Metrics",
    definition: "The quantifiable measures of value that your solution can provide.",
    topQuestions: [
      "What criteria matter most when evaluating a purchase?",
      "How do you measure the financial impact of a new solution?",
    ],
    questions: [
      "What factors or criteria are most important to you when evaluating a potential purchase?",
      "How do you measure the financial impact of a new solution or investment?",
      "Are there any budget limitations or constraints I should be aware of?",
      "Can you walk me through the process for getting approval for a purchase like this within your company?",
    ],
    examples: [
      "Student outcomes",
      "Cost savings",
      "Return on investment",
      "Time savings",
      "Quality improvements for students, teachers, parents",
      "Satisfaction for students, teachers, parents and principals",
      "Teacher retention",
      "Risk and compliance reduction",
    ],
    strategic: [
      "Aligning with Business Goals — tailor the conversation to outcomes that matter most",
      "Demonstrating ROI — quantify potential benefits to make a stronger case",
      "Prioritizing Needs — understand what the prospect values most",
    ],
  },
  {
    letter: "E",
    name: "Economic Buyer",
    definition:
      "The person with the overall authority in the buying decision.",
    topQuestions: [
      "Who is ultimately responsible for approving this budget?",
      "Can you walk me through your approval process?",
    ],
    questions: [
      "Who in your organization is ultimately responsible for making purchasing decisions and approving budgets?",
      "How much discretion do you have in allocating budget for new projects or solutions?",
      "What factors or criteria are most important to you when evaluating a potential purchase?",
      "How do you measure the financial impact of a new solution or investment?",
      "Are there any budget limitations or constraints I should be aware of when we discuss potential pricing?",
      "Can you walk me through the process for getting approval for a purchase like this within your company?",
    ],
    strategic: [
      "Clarity on Approval — engage with the right people early",
      "Aligning Financial Goals — present the solution in terms of cost savings, ROI, improved outcomes",
      "Avoiding Bottlenecks — prevent deal stalls by connecting with the economic buyer",
    ],
  },
  {
    letter: "D",
    name: "Decision Criteria & Process",
    definition:
      "Criteria with which your solution will be judged in the buying process, and the process the buyer will follow to make a decision.",
    topQuestions: [
      "What are the most important capabilities you're looking for?",
      "Walk me through your evaluation and selection steps.",
    ],
    questions: [
      "What are the most important features or capabilities you're looking for in a solution?",
      "If you had to rank the most critical factors in this decision, what would they be?",
      "Can you walk me through the steps your team takes to evaluate and select a solution like this?",
      "Who else in your organization will be involved in reviewing and approving this solution?",
      "What steps are involved in getting final approval for this solution?",
      "Is there anything in the process that could delay a decision or make it difficult to move forward?",
    ],
    strategic: [
      "Aligning Expectations — focus on the prospect's highest priorities",
      "Managing the Sales Cycle — anticipate and plan for the next steps",
      "Customization and Tailoring — address the decision criteria directly",
      "Identifying Potential Roadblocks — navigate obstacles early",
      "Building Stronger Relationships — align on criteria to build trust",
    ],
  },
  {
    letter: "P",
    name: "Procurement Process",
    definition:
      "Steps that follow the Decision Process from Decision to signature including factors that impact the speed of deal closing.",
    topQuestions: [
      "Walk me through your procurement process start to finish.",
      "Is the budget already approved or does it need further review?",
    ],
    questions: [
      "Can you walk me through the steps involved in your procurement process from start to finish?",
      "What documents will you need from us to move forward in the procurement process?",
      "Who will be responsible for reviewing and approving the purchase internally?",
      "How long does the procurement process typically take for an investment like this?",
      "Is the budget for this solution already approved, or will it require further review?",
      "Are there specific terms or conditions that must be included in the contract?",
      "Are there any legal or compliance considerations we need to be aware of?",
    ],
    strategic: [
      "Anticipate Roadblocks — address issues proactively",
      "Ensure Compliance — all documentation and approvals in place",
      "Align Expectations — realistic timelines for when the deal can close",
      "Build Stronger Relationships — demonstrate understanding of their internal workings",
      "Streamline the Process — provide necessary documentation upfront",
    ],
  },
  {
    letter: "I",
    name: "Identified Pain",
    definition:
      "Identify the Pain your solution solves for your customer; understand what happens if no decision is made or something goes wrong.",
    topQuestions: [
      "What are the biggest challenges you're currently facing?",
      "What's the worst-case scenario if this isn't addressed?",
    ],
    questions: [
      "What are the biggest challenges you are currently facing in your business?",
      "How is this issue impacting your day-to-day operations or bottom line?",
      "What has been the financial impact of this challenge so far?",
      "If you don't address this problem, what's the worst-case scenario for your organization?",
      "What's the impact of this issue on your team or your customers?",
      "How long have you been dealing with this pain, and how has it evolved over time?",
      "How is this problem preventing you from meeting your business goals?",
      "What would resolving this pain mean for your business?",
    ],
    strategic: [
      "Understanding the pain — demonstrate the solution is a direct response to their problems",
      "Building Urgency — explore the impact and cost of inaction",
      "Establishing Trust — show you're listening and invested in solving the problem",
      "Chances of Success — the more accurately you identify pain, the more likely the solution resonates",
    ],
  },
  {
    letter: "C",
    name: "Champion",
    definition:
      "A person who has power, influence, and credibility within the customer's organization.",
    topQuestions: [
      "Who will be most affected and would benefit from this solution?",
      "How committed are you to driving this forward?",
    ],
    questions: [
      "Who in your organization will be most affected by solving this problem and would benefit from this solution?",
      "How involved are you in the decision-making process and how do you influence the final decision?",
      "What motivates you to push for this solution? How does it align with your goals or objectives?",
      "What challenges or objections do you think we might encounter from other stakeholders, and how can we overcome them together?",
      "What additional resources or information can I provide to help you advocate for this solution internally?",
      "How committed are you to helping drive this solution forward, and what would you need from us to make that happen?",
    ],
    strategic: [
      "Internal Advocacy — champions advocate for your solution, making decision-makers more likely to act",
      "Overcoming Objections — champions act as first line of defense against internal resistance",
      "Expedited Decision-Making — champions push for action and keep the deal on track",
    ],
  },
  {
    letter: "C",
    name: "Competition",
    definition:
      "Any person, vendor, or initiative competing for the same funds you are, including taking no action.",
    topQuestions: [
      "What other solutions or vendors are you considering?",
      "What do you see as our biggest advantage vs. competitors?",
    ],
    questions: [
      "What other solutions or vendors are you currently considering for this project?",
      "How do you perceive our solution in comparison to others you're evaluating?",
      "What do you think is the biggest advantage our competitors have over us?",
      "What aspects of our solution do you see as stronger or more valuable than what others offer?",
      "What are the main reasons you're hesitant to move forward with a competitor's solution?",
      "How does our pricing compare to the other solutions you're looking at?",
      "Have you had previous experience with any of these competitors, and how was that experience?",
      "What key factors will you use to compare us against other vendors in your decision-making process?",
      "Are there any new vendors or products you're keeping an eye on that we should be aware of?",
    ],
    strategic: [
      "Differentiate Your Solution — position unique benefits and advantages",
      "Overcome Objections — anticipate and proactively address competitive concerns",
      "Close Deals More Effectively — understanding the competition helps tailor your pitch",
    ],
  },
];

// ── Framework Card ────────────────────────────────────────────────────────────

function FrameworkCard({
  letter,
  name,
  definition,
  topQuestions,
  questions,
  examples,
  strategic,
}: {
  letter: string;
  name: string;
  definition: string;
  topQuestions?: string[];
  questions: string[];
  examples?: string[];
  strategic?: string[];
}) {
  return (
    <div className="bg-white rounded-xl border border-[#D4CFE2] shadow-sm p-5">
      {/* Header with letter badge */}
      <div className="flex items-start gap-4 mb-3">
        <div className="w-10 h-10 rounded-full bg-[#fef1f0] border-2 border-[#F37167] flex items-center justify-center flex-shrink-0">
          <span className="text-lg font-bold text-[#F37167]">{letter}</span>
        </div>
        <div>
          <h4 className="text-sm font-bold text-[#403770]">{name}</h4>
          <p className="text-xs text-[#6E6390] mt-0.5 leading-relaxed">
            {definition}
          </p>
        </div>
      </div>

      {/* Top questions — always visible */}
      {topQuestions && (
        <div className="mb-2">
          <p className="text-xs font-semibold text-[#544A78] mb-1.5">Start here:</p>
          <ul className="space-y-1">
            {topQuestions.map((q, i) => (
              <li
                key={i}
                className="text-xs text-[#6E6390] pl-3 border-l-2 border-[#F37167]/30 leading-relaxed"
              >
                {q}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Examples (MEDPICC Metrics only) */}
      {examples && (
        <ExpandableSection title="Examples">
          <ul className="list-disc pl-5 space-y-1">
            {examples.map((ex, i) => (
              <li key={i} className="text-xs">
                {ex}
              </li>
            ))}
          </ul>
        </ExpandableSection>
      )}

      {/* All qualifying questions */}
      <ExpandableSection title={`All Questions (${questions.length})`}>
        <ul className="list-disc pl-5 space-y-1.5">
          {questions.map((q, i) => (
            <li key={i} className="text-xs">
              {q}
            </li>
          ))}
        </ul>
      </ExpandableSection>

      {/* Strategic value */}
      {strategic && (
        <ExpandableSection title="Why It Matters">
          <ul className="space-y-1.5">
            {strategic.map((s, i) => (
              <li key={i} className="text-xs">
                <span className="font-semibold text-[#544A78]">
                  {s.split(" — ")[0]}
                </span>
                {s.includes(" — ") && (
                  <span className="text-[#6E6390]">
                    {" "}
                    — {s.split(" — ").slice(1).join(" — ")}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </ExpandableSection>
      )}
    </div>
  );
}

// ── Main Page Component ───────────────────────────────────────────────────────

// ── Section Nav ───────────────────────────────────────────────────────────────

const SECTIONS = [
  { id: "stage-finder", label: "What Stage Am I In?" },
  { id: "overview", label: "Overview" },
  { id: "pipeline", label: "Pipeline" },
  { id: "bant", label: "BANT" },
  { id: "medpicc", label: "MEDPICC" },
];

// ── Stage Finder Data ─────────────────────────────────────────────────────────

const STAGE_SIGNALS = [
  {
    signal: "Prospect has agreed to a meeting",
    stage: 0,
    name: "Meeting Booked",
    pct: "0%",
    framework: "BANT",
    nextStep: "Prepare BANT research — budget sources, decision-makers, timeline drivers.",
  },
  {
    signal: "Prospect has agreed to be qualified and shared information",
    stage: 1,
    name: "Discovery",
    pct: "10%",
    framework: "BANT",
    nextStep: "Confirm all four BANT elements. Identify the buying committee.",
  },
  {
    signal: "Prospect invited their committee to a sales discussion",
    stage: 2,
    name: "Presentation",
    pct: "40%",
    framework: "BANT",
    nextStep: "Finalize BANT with all attendees. Confirm explicitly.",
  },
  {
    signal: "Prospect asked for a written quote with a dollar figure",
    stage: 3,
    name: "Proposal",
    pct: "60%",
    framework: "BANT → MEDPICC",
    nextStep: "Ensure quote includes certifications, dates, SWD, content. Get MEDPICC confirmed in writing.",
  },
  {
    signal: "Prospect confirmed receipt and is discussing the quote",
    stage: 4,
    name: "Negotiation",
    pct: "70%",
    framework: "MEDPICC",
    nextStep: "Confirm all MEDPICC elements. Get a deadline for their response.",
  },
  {
    signal: "Prospect confirmed the contract is approved — only signature remains",
    stage: 5,
    name: "Commitment",
    pct: "90%",
    framework: "MEDPICC",
    nextStep: "Confirm who is signing and when. Follow up until ink is on paper.",
  },
];

export default function DealQualifyingPage() {
  const [selectedSignal, setSelectedSignal] = useState<number | null>(null);

  return (
    <div className="max-w-[960px] mx-auto">
      {/* Page header */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-[#403770] tracking-tight">
          Deal Qualifying
        </h1>
        <p className="text-sm text-[#8A80A8] mt-1">
          BANT and MEDPICC frameworks for qualifying deals across your pipeline.
        </p>
        <a
          href="https://docs.google.com/presentation/d/1jEZN3heIuGnXCxTnPqax0_oWwPPFDvC0u_rJaAH5CS4/edit#slide=id.g341d6806c7e_0_0"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 mt-3 text-xs font-semibold text-[#6EA3BE] hover:text-[#403770] transition-colors duration-100"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          View or download the full slide deck
        </a>
      </div>

      {/* Section jump nav */}
      <nav className="flex flex-wrap items-center gap-1.5 mb-8 pb-4 border-b border-[#E2DEEC]">
        {SECTIONS.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="px-3 py-1.5 text-xs font-medium text-[#6E6390] hover:text-[#403770] hover:bg-[#EFEDF5] rounded-lg transition-colors duration-100"
          >
            {s.label}
          </a>
        ))}
      </nav>

      {/* ── Stage Finder ────────────────────────────────────────────────── */}
      <section id="stage-finder" className="mb-10 scroll-mt-4">
        <div className="flex items-center gap-2 mb-2">
          <Search className="w-4.5 h-4.5 text-[#F37167]" />
          <h2 className="text-lg font-bold text-[#403770]">
            What Stage Am I In?
          </h2>
        </div>
        <p className="text-sm text-[#6E6390] mb-4 leading-relaxed">
          Select the customer action that best describes where your deal is
          right now.
        </p>

        <div className="space-y-2">
          {STAGE_SIGNALS.map((s) => {
            const isSelected = selectedSignal === s.stage;
            return (
              <button
                key={s.stage}
                onClick={() =>
                  setSelectedSignal(isSelected ? null : s.stage)
                }
                className={`w-full text-left rounded-xl border px-4 py-3 transition-all duration-150 ${
                  isSelected
                    ? "bg-[#fef1f0] border-[#F37167] shadow-sm"
                    : "bg-white border-[#D4CFE2] hover:border-[#C2BBD4] hover:shadow-sm"
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Radio indicator */}
                  <div
                    className={`mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                      isSelected
                        ? "border-[#F37167]"
                        : "border-[#C2BBD4]"
                    }`}
                  >
                    {isSelected && (
                      <div className="w-2 h-2 rounded-full bg-[#F37167]" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm leading-relaxed ${
                        isSelected
                          ? "font-semibold text-[#403770]"
                          : "text-[#6E6390]"
                      }`}
                    >
                      {s.signal}
                    </p>

                    {/* Result — shown when selected */}
                    {isSelected && (
                      <div className="mt-3 pt-3 border-t border-[#F37167]/20">
                        <div className="flex items-baseline gap-3 mb-2">
                          <span className="text-lg font-bold text-[#F37167]">
                            {s.pct}
                          </span>
                          <span className="text-sm font-bold text-[#403770]">
                            Stage {s.stage} — {s.name}
                          </span>
                          <span className="text-xs font-semibold text-[#8A80A8]">
                            {s.framework}
                          </span>
                        </div>
                        <div className="bg-[#F7F5FA] rounded-lg px-3 py-2">
                          <p className="text-xs font-semibold text-[#544A78] mb-0.5">
                            Next step:
                          </p>
                          <p className="text-xs text-[#6E6390] leading-relaxed">
                            {s.nextStep}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Section 1: Overview ──────────────────────────────────────────── */}
      <section id="overview" className="mb-10 scroll-mt-4">
        <h2 className="text-lg font-bold text-[#403770] mb-4">
          Why Qualifying Matters
        </h2>
        <p className="text-sm text-[#6E6390] mb-4 leading-relaxed">
          A core part of sales management and acceleration is qualifying the
          deals in your pipeline. The better your qualifying questions, the
          faster your deals close.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            {
              level: "Beginner",
              desc: "Qualifying questions ascertain whether there is a deal that can easily be made.",
            },
            {
              level: "Intermediate",
              desc: "Qualifying questions unlock hidden deals and help close the easy ones faster.",
            },
            {
              level: "Advanced",
              desc: "Qualifying questions lead to new opportunities and introductions one step up the org chart.",
            },
            {
              level: "Master",
              desc: "Qualifying questions cultivate champions, get introductions to board members, and create deals beginner salespersons would argue are not even possible.",
            },
          ].map((item) => (
            <div
              key={item.level}
              className="bg-white rounded-xl border border-[#D4CFE2] shadow-sm px-4 py-3"
            >
              <h4 className="text-sm font-bold text-[#F37167] mb-1">
                {item.level}
              </h4>
              <p className="text-xs text-[#6E6390] leading-relaxed">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Section 2: Pipeline Stages ───────────────────────────────────── */}
      <section id="pipeline" className="mb-10 scroll-mt-4">
        <h2 className="text-lg font-bold text-[#403770] mb-2">
          Pipeline Stages
        </h2>
        <p className="text-sm text-[#6E6390] mb-4 leading-relaxed">
          BANT covers early pipeline (Stages 0–3). MEDPICC takes over for late
          stage (Stages 3–5). Stages are determined by{" "}
          <span className="font-semibold text-[#544A78]">customer actions</span>
          , not your internal assessment.
        </p>

        {/* Pipeline timeline */}
        <div className="relative">
          {PIPELINE_STAGES.map((s, idx) => {
            const isBant = s.framework === "bant";
            const color = isBant ? "#6EA3BE" : "#F37167";
            const bgTint = isBant ? "#e8f1f5" : "#fef1f0";
            const isLast = idx === PIPELINE_STAGES.length - 1;

            return (
              <div key={s.stage} className="flex gap-4">
                {/* Timeline rail */}
                <div className="flex flex-col items-center flex-shrink-0 w-12">
                  {/* Percentage badge */}
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center border-2 text-xs font-bold z-10"
                    style={{
                      borderColor: color,
                      backgroundColor: bgTint,
                      color: color,
                    }}
                  >
                    {s.pct}
                  </div>
                  {/* Connector line */}
                  {!isLast && (
                    <div
                      className="w-0.5 flex-1 min-h-4"
                      style={{ backgroundColor: `${color}40` }}
                    />
                  )}
                </div>

                {/* Stage content card */}
                <div
                  className="flex-1 mb-3 bg-white rounded-xl border shadow-sm px-5 py-4"
                  style={{ borderColor: `${color}30` }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded"
                      style={{ backgroundColor: bgTint, color }}
                    >
                      {isBant ? "BANT" : "MEDPICC"}
                    </span>
                    <span className="text-sm font-bold text-[#403770]">
                      {s.stage} — {s.name}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                    <div>
                      <p className="text-xs font-semibold text-[#8A80A8] uppercase tracking-wider mb-1">
                        Criteria
                      </p>
                      <ul className="text-xs text-[#6E6390] space-y-0.5">
                        {s.criteria.map((c, i) => (
                          <li key={i}>• {c}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-[#8A80A8] uppercase tracking-wider mb-1">
                        Customer Actions
                      </p>
                      <ul className="text-xs text-[#6E6390] space-y-0.5">
                        {s.customerActions.map((a, i) => (
                          <li key={i}>• {a}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Callout */}
        <div className="mt-4 bg-[#F7F5FA] rounded-xl border border-[#E2DEEC] px-5 py-3">
          <p className="text-xs text-[#544A78] font-medium leading-relaxed">
            Once in Salesforce beats five times in different spreadsheets.{" "}
            <span className="text-[#F37167] font-semibold">
              BANT, MEDPICC, and next steps
            </span>{" "}
            accelerate deals.
          </p>
        </div>
      </section>

      {/* ── Section 3: BANT Framework ────────────────────────────────────── */}
      <section id="bant" className="mb-10 scroll-mt-4">
        <h2 className="text-lg font-bold text-[#403770] mb-1">
          BANT Framework
        </h2>
        <p className="text-sm text-[#6E6390] mb-4 leading-relaxed">
          Used for deals in early pipeline (Stage 0–3), before a contract or
          quote is sent. Identify your assumptions and confirm them — especially
          for renewals.{" "}
          <span className="font-semibold text-[#544A78]">
            Be curious. Be excited when you make discoveries!
          </span>
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {BANT_ELEMENTS.map((el) => (
            <FrameworkCard key={el.letter + el.name} {...el} />
          ))}
        </div>
      </section>

      {/* ── Section 4: MEDPICC Framework ─────────────────────────────────── */}
      <section id="medpicc" className="mb-10 scroll-mt-4">
        <h2 className="text-lg font-bold text-[#403770] mb-1">
          MEDPICC Framework
        </h2>
        <p className="text-sm text-[#6E6390] mb-4 leading-relaxed">
          Used for late stage pipeline (Stage 4–Close), after a contract or
          quote is sent. Identify your assumptions and confirm them — especially
          for renewals.{" "}
          <span className="font-semibold text-[#544A78]">
            Be curious. Be excited when you make discoveries!
          </span>
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {MEDPICC_ELEMENTS.map((el, i) => (
            <FrameworkCard key={el.letter + el.name + i} {...el} />
          ))}
        </div>
      </section>

    </div>
  );
}
