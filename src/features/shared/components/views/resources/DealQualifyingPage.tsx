"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

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
  questions,
  examples,
  strategic,
}: {
  letter: string;
  name: string;
  definition: string;
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

      {/* Qualifying questions */}
      <ExpandableSection title="Qualifying Questions">
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

export default function DealQualifyingPage() {
  return (
    <div className="max-w-[960px] mx-auto">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#403770] tracking-tight">
          Deal Qualifying
        </h1>
        <p className="text-sm text-[#8A80A8] mt-1">
          BANT and MEDPICC frameworks for qualifying deals across your pipeline.
        </p>
      </div>

      {/* ── Section 1: Overview ──────────────────────────────────────────── */}
      <section className="mb-10">
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
      <section className="mb-10">
        <h2 className="text-lg font-bold text-[#403770] mb-2">
          Pipeline Stages
        </h2>
        <p className="text-sm text-[#6E6390] mb-4 leading-relaxed">
          BANT covers early pipeline (Stages 0–3). MEDPICC takes over for late
          stage (Stages 3–5). Stages are determined by{" "}
          <span className="font-semibold text-[#544A78]">customer actions</span>
          , not your internal assessment.
        </p>

        {/* Framework range indicator */}
        <div className="flex items-center gap-2 mb-4 text-xs font-semibold">
          <span className="px-2.5 py-1 rounded-lg bg-[#e8f1f5] text-[#6EA3BE]">
            BANT — Stages 0–3
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-[#fef1f0] text-[#F37167]">
            MEDPICC — Stages 3–5
          </span>
        </div>

        {/* Stage cards */}
        <div className="space-y-3">
          {PIPELINE_STAGES.map((s) => (
            <div
              key={s.stage}
              className={`bg-white rounded-xl border shadow-sm px-5 py-4 ${
                s.framework === "bant"
                  ? "border-[#6EA3BE]/30"
                  : "border-[#F37167]/30"
              }`}
            >
              <div className="flex items-baseline gap-3 mb-2">
                <span
                  className={`text-lg font-bold ${
                    s.framework === "bant"
                      ? "text-[#6EA3BE]"
                      : "text-[#F37167]"
                  }`}
                >
                  {s.pct}
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
          ))}
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
      <section className="mb-10">
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
      <section className="mb-10">
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

      {/* ── Section 5: Quick Reference ───────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="text-lg font-bold text-[#403770] mb-4">
          Quick Reference
        </h2>
        <div className="bg-white rounded-xl border border-[#D4CFE2] shadow-sm overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#F7F5FA]">
                <th className="text-left px-4 py-2.5 font-semibold text-[#544A78]">
                  Stage
                </th>
                <th className="text-left px-4 py-2.5 font-semibold text-[#544A78]">
                  Framework
                </th>
                <th className="text-left px-4 py-2.5 font-semibold text-[#544A78]">
                  Key Question
                </th>
              </tr>
            </thead>
            <tbody>
              {[
                {
                  stage: "0 — Meeting Booked",
                  fw: "BANT",
                  q: "Is there a real meeting on the calendar?",
                },
                {
                  stage: "1 — Discovery",
                  fw: "BANT",
                  q: "Have we confirmed Budget, Authority, Need, Timing?",
                },
                {
                  stage: "2 — Presentation",
                  fw: "BANT",
                  q: "Did we meet with the committee and finalize BANT?",
                },
                {
                  stage: "3 — Proposal",
                  fw: "BANT → MEDPICC",
                  q: "Have they asked for a written quote with a dollar figure?",
                },
                {
                  stage: "4 — Negotiation",
                  fw: "MEDPICC",
                  q: "Are we confident on all MEDPICC elements?",
                },
                {
                  stage: "5 — Commitment",
                  fw: "MEDPICC",
                  q: "Is the only remaining step a signature?",
                },
              ].map((row, i) => (
                <tr
                  key={i}
                  className="border-t border-[#E2DEEC] hover:bg-[#EFEDF5] transition-colors duration-100"
                >
                  <td className="px-4 py-2.5 font-medium text-[#403770]">
                    {row.stage}
                  </td>
                  <td className="px-4 py-2.5 text-[#6E6390]">{row.fw}</td>
                  <td className="px-4 py-2.5 text-[#6E6390]">{row.q}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
