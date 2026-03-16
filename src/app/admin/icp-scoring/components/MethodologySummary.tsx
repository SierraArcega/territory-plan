"use client";

import { useState } from "react";

const SUB_SCORES = [
  {
    label: "Fit",
    weight: 30,
    color: "#403770",
    question: "Does this district look like our best customers?",
    factors: [
      { name: "Enrollment Size", points: "0-25", detail: "The #1 predictor. Penetration scales from 2.0% (<500 students) to 29.8% (50K+). Based on NCES CCD headcounts." },
      { name: "FRPL Rate", points: "0-20", detail: "Free/Reduced Price Lunch eligibility as a poverty proxy. High-FRPL districts generate 6.7x more revenue per customer ($585K vs $88K avg)." },
      { name: "Majority-Minority", points: "0-15", detail: "Districts >50% non-white have 6.7% penetration (vs 5.2%) and generate $1.0M avg revenue (vs $119K)." },
      { name: "Locale Type", points: "0-15", detail: "Suburbs lead with 9.2% penetration and $462K avg revenue. City (12pts), Town (8pts), Rural (0-5pts)." },
      { name: "Chronic Absenteeism", points: "0-10", detail: "Signals academic distress and staffing disruption. Top-10% revenue customers average 20.3% absenteeism." },
      { name: "Math Proficiency (inverse)", points: "0-10", detail: "Lower proficiency = greater need for instructional support. Top-10% revenue customers average 34.1% proficiency." },
      { name: "Grade Span", points: "0-5", detail: "K-12 districts (7.7% penetration) and HS-only (9.0%) score highest. HS districts need specialized teachers that are harder to hire." },
    ],
  },
  {
    label: "Value",
    weight: 25,
    color: "#69B34A",
    question: "How much revenue could this district generate?",
    factors: [
      { name: "District Total Revenue", points: "0-25", detail: "Quartiled within state to normalize for cost-of-living. From NCES F-33 Annual Finance Survey." },
      { name: "Enrollment (deal size)", points: "0-20", detail: "50K+ districts average $4.4M lifetime revenue vs $95K for <500 students." },
      { name: "Expenditure per Pupil", points: "0-15", detail: "Higher per-pupil spend indicates more budget capacity. >$20K/pupil scores maximum." },
      { name: "Existing Vendor Revenue", points: "0-25", detail: "Lifetime spend across all 5 vendors. Districts already spending are proven buyers." },
      { name: "Number of Schools", points: "0-15", detail: "More schools = more classrooms to staff = larger potential contract size." },
    ],
  },
  {
    label: "Readiness",
    weight: 25,
    color: "#D4A84B",
    question: "Is this district behaviorally likely to purchase?",
    factors: [
      { name: "Charter Tuition Outflow", points: "0-15", detail: "Districts paying >$1M in charter tuition have 17.3% penetration (vs 3.8%) \u2014 a 4.5x lift. Budget already flows to external providers." },
      { name: "SPED Private Placement", points: "0-10", detail: "What districts pay private special ed schools when they can't serve IEPs internally. Signals staffing gaps." },
      { name: "Existing Competitor Spend", points: "0-20", detail: "Multi-vendor districts spend 7.3x more ($772K vs $106K). The strongest behavioral signal." },
      { name: "Charter Enrollment %", points: "0-10", detail: "Moderate competition (5-30%) has 13-15% penetration. Districts losing students but still fighting." },
      { name: "Enrollment Trend (3yr)", points: "0-10", detail: "Slightly declining districts buy the most (8.0% penetration). The 'worried but not desperate' zone." },
      { name: "Staffing Trend (3yr)", points: "0-10", detail: "Moderate staff decline signals active teacher loss being replaced with virtual. $1.3M avg revenue." },
      { name: "Debt per Student", points: "0-8", detail: "Moderate debt ($5-15K) signals willingness to invest. Zero-debt districts are most resistant (2.3% penetration)." },
      { name: "Pipeline/Customer Status", points: "0-10", detail: "Existing Fullmind relationship (customer or open pipeline) is a strong expansion signal." },
      { name: "ELL Trend (3yr)", points: "0-7", detail: "ELL change in either direction creates staffing disruption. Rising ELL districts need bilingual teachers that are extremely hard to hire." },
    ],
  },
  {
    label: "State",
    weight: 20,
    color: "#6EA3BE",
    question: "Is the state environment favorable for selling?",
    factors: [
      { name: "District Consolidation", points: "0-30", detail: "States with fewer, larger districts (SC, MD, FL, GA) have 11% avg penetration. Fragmented states (CA, AZ, MT) have 1.7%." },
      { name: "Existing Penetration", points: "0-25", detail: "% of state's districts with any vendor revenue. Higher = proven sales motion and reference customers." },
      { name: "Territory Owner", points: "0-15", detail: "Assigned territory gets 15 points. SC (34.1% penetration) demonstrates what dedicated coverage achieves." },
      { name: "State Total Enrollment", points: "0-15", detail: "Larger states offer more total addressable market." },
      { name: "Existing Revenue in State", points: "0-15", detail: "Total lifetime vendor revenue in the state. Signals proven demand and referenceable customers." },
      { name: "Churn Penalty", points: "0 to -15", detail: "Blended customer churn (30%) and revenue churn (70%) from Fullmind + Elevate K12 data (FY24-25 vs FY26-27). States with high churn are penalized — e.g., SC lost $20M (78.5% revenue churn) despite retaining 14 of 30 customers. States with no FM/EK12 presence are unaffected." },
    ],
  },
];

const TIER_RULES = [
  { tier: "Tier 1", rule: "Fit \u2265 60, Value \u2265 60, Composite \u2265 60", use: "High-priority targets and strategic accounts", color: "#F37167" },
  { tier: "Tier 2", rule: "Composite \u2265 40", use: "Volume targets and secondary pipeline", color: "#D4A84B" },
  { tier: "Tier 3", rule: "Composite \u2265 25", use: "Low-priority, opportunistic only", color: "#8A80A8" },
  { tier: "Tier 4", rule: "Composite < 25", use: "Not viable for current GTM", color: "#D4CFE2" },
];

const DATA_SOURCES = [
  { name: "NCES CCD", desc: "Enrollment, locale, grade span, charter enrollment, school counts" },
  { name: "NCES F-33", desc: "Revenue, expenditure, per-pupil spend, charter/private payments, debt (FY2020)" },
  { name: "Urban Institute API", desc: "FRPL, ELL/SWD %, absenteeism, proficiency, graduation, enrollment & staffing trends" },
  { name: "VendorFinancials", desc: "Fullmind + Elevate K12 revenue by fiscal year (OpenSearch sync)" },
  { name: "CompetitorSpend", desc: "Proximity, Elevate, TBT, Educere PO data (GovSpend)" },
  { name: "Fullmind CRM", desc: "Customer status, open pipeline, territory owner (OpenSearch sync)" },
];

function SubScoreDetail({ score }: { score: typeof SUB_SCORES[number] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-[#E2DEEC] rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#F7F5FA] transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: score.color }} />
          <div>
            <span className="text-sm font-semibold text-[#403770]">{score.label}</span>
            <span className="text-xs text-[#A69DC0] ml-2">({score.weight}% weight)</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-[#8A80A8] italic hidden sm:block">{score.question}</span>
          <svg
            className={`w-4 h-4 text-[#A69DC0] transition-transform ${open ? "rotate-180" : ""}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-[#E2DEEC] bg-[#FAFAFE]">
          <div className="grid gap-2">
            {score.factors.map((f) => (
              <div key={f.name} className="flex gap-3 text-xs">
                <div className="shrink-0 w-[140px]">
                  <span className="font-semibold text-[#544A78]">{f.name}</span>
                  <span className="text-[#A69DC0] ml-1">({f.points})</span>
                </div>
                <span className="text-[#6E6390] leading-relaxed">{f.detail}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function MethodologySummary() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white rounded-lg border border-[#D4CFE2] shadow-sm">
      {/* Summary — always visible */}
      <div className="p-6">
        <h2 className="text-lg font-semibold text-[#403770]">How We Define Ideal Customer Profiles</h2>
        <div className="mt-3 text-sm text-[#6E6390] leading-relaxed space-y-3">
          <p>
            Every district in the US receives a <strong className="text-[#403770]">composite opportunity score</strong> (0-100)
            based on how closely it matches the profile of our best existing customers. We analyzed purchasing patterns
            across <strong className="text-[#403770]">1,087 customers</strong> spanning all five vendors (Fullmind, Elevate K12,
            Proximity Learning, Tutored By Teachers, and Educere) and compared them against 17,887 non-customers to
            identify the demographic, financial, and behavioral traits that most strongly predict purchasing.
          </p>
          <p>
            The composite score is a weighted blend of four sub-scores, each capturing a different dimension of opportunity:
          </p>
          <div className="flex gap-4 mt-2">
            {SUB_SCORES.map((s) => (
              <div key={s.label} className="flex-1 rounded-lg bg-[#F7F5FA] border border-[#E2DEEC] px-3 py-2">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="text-xs font-bold text-[#403770]">{s.label} ({s.weight}%)</span>
                </div>
                <p className="text-[11px] text-[#8A80A8] leading-snug">{s.question}</p>
              </div>
            ))}
          </div>
          <p>
            Districts are then classified into tiers based on their composite and sub-scores:
          </p>
          <div className="flex gap-3">
            {TIER_RULES.map((t) => (
              <div key={t.tier} className="flex-1 flex items-start gap-2">
                <div className="w-2.5 h-2.5 rounded-full mt-0.5 shrink-0" style={{ backgroundColor: t.color }} />
                <div>
                  <span className="text-xs font-bold text-[#403770]">{t.tier}</span>
                  <p className="text-[11px] text-[#8A80A8] leading-snug">{t.rule}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Toggle for full detail */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-4 text-xs font-semibold text-[#403770] hover:text-[#322a5a] flex items-center gap-1 transition-colors"
        >
          {expanded ? "Hide" : "Show"} full scoring methodology
          <svg
            className={`w-3.5 h-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Expanded detail — collapsible */}
      {expanded && (
        <div className="border-t border-[#E2DEEC] p-6 bg-[#FAFAFE]">
          <h3 className="text-sm font-bold text-[#403770] mb-3">Sub-Score Breakdown</h3>
          <p className="text-xs text-[#8A80A8] mb-4">
            Click each sub-score to see every factor, its point range, and the data source behind it.
          </p>
          <div className="flex flex-col gap-2 mb-6">
            {SUB_SCORES.map((s) => (
              <SubScoreDetail key={s.label} score={s} />
            ))}
          </div>

          <h3 className="text-sm font-bold text-[#403770] mb-3">Data Sources</h3>
          <div className="grid grid-cols-3 gap-2">
            {DATA_SOURCES.map((ds) => (
              <div key={ds.name} className="rounded-lg bg-white border border-[#E2DEEC] px-3 py-2">
                <span className="text-xs font-semibold text-[#544A78]">{ds.name}</span>
                <p className="text-[11px] text-[#8A80A8] leading-snug mt-0.5">{ds.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
