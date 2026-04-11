"use client";

import { useState } from "react";

const SUB_SCORES = [
  {
    label: "Fit",
    weight: 30,
    color: "#403770",
    question: "Does this district look like our best customers?",
    factors: [
      { name: "Enrollment Size", points: "0-25", metric: "Total student headcount from NCES CCD.", finding: "The #1 predictor. Penetration scales from 2.0% (<500 students) to 29.8% (50K+)." },
      { name: "FRPL Rate", points: "0-20", metric: "Free/Reduced Price Lunch eligibility as % of enrollment. Primary poverty proxy from NCES CCD via Urban Institute.", finding: "High-FRPL districts generate 6.7x more revenue per customer ($585K vs $88K avg)." },
      { name: "Majority-Minority", points: "0-15", metric: "% non-white enrollment, calculated from NCES CCD enrollment by race.", finding: "Districts >50% non-white have 6.7% penetration (vs 5.2%) and generate $1.0M avg revenue (vs $119K)." },
      { name: "Locale Type", points: "0-15", metric: "NCES CCD urban-centric locale code (City, Suburb, Town, Rural).", finding: "Suburbs lead with 9.2% penetration and $462K avg revenue \u2014 the highest combination." },
      { name: "Chronic Absenteeism", points: "0-10", metric: "% of students absent 15+ days per year, from NCES Civil Rights Data Collection.", finding: "Signals academic distress and staffing disruption. Top-10% revenue customers average 20.3% absenteeism." },
      { name: "Math Proficiency (inverse)", points: "0-10", metric: "% of students meeting grade-level math proficiency from state assessments via Urban Institute.", finding: "Lower proficiency = greater need for instructional support. Top-10% revenue customers average 34.1% proficiency." },
      { name: "Grade Span", points: "0-5", metric: "Lowest/highest grade offered from NCES CCD (K-12, HS-only, Elementary, etc.).", finding: "K-12 districts have 7.7% penetration; HS-only 9.0%. HS districts need specialized subject teachers that are harder to hire." },
    ],
  },
  {
    label: "Value",
    weight: 25,
    color: "#69B34A",
    question: "How much revenue could this district generate?",
    factors: [
      { name: "District Total Revenue", points: "0-25", metric: "Total revenue from all sources (federal + state + local) from NCES F-33 Annual Finance Survey. Quartiled within state to normalize for cost-of-living.", finding: "Q4 districts (top quartile in their state) have the largest budgets and highest deal potential." },
      { name: "Enrollment (deal size)", points: "0-20", metric: "Total student headcount from NCES CCD.", finding: "Larger districts buy larger contracts. 50K+ districts average $4.4M lifetime revenue vs $95K for <500." },
      { name: "Expenditure per Pupil", points: "0-15", metric: "Total expenditure divided by enrollment from NCES F-33.", finding: "Higher per-pupil spend indicates more budget capacity for supplemental services. >$20K/pupil scores maximum." },
      { name: "Existing Vendor Revenue", points: "0-25", metric: "Lifetime total revenue across all 5 vendors (Fullmind, Elevate, Proximity, TBT, Educere) from DistrictFinancials table (all vendors).", finding: "Districts already spending on virtual instruction are proven buyers with established procurement paths." },
      { name: "Number of Schools", points: "0-15", metric: "Count of schools in the district from NCES CCD.", finding: "More schools = more classrooms to staff = larger potential contract size." },
    ],
  },
  {
    label: "Readiness",
    weight: 25,
    color: "#D4A84B",
    question: "Is this district behaviorally likely to purchase?",
    factors: [
      { name: "Charter Tuition Outflow", points: "0-15", metric: "Dollar amount the district transfers to charter schools when students leave. Per-pupil funding (~$8-15K/student) follows the student. From NCES F-33 (FY2020); scored as % of total expenditure to reduce staleness.", finding: "Districts transferring >$1M have 17.3% penetration (vs 3.8%) \u2014 a 4.5x lift. They're losing students to alternatives and already have budget flowing to external instructional providers." },
      { name: "SPED Private Placement", points: "0-10", metric: "What districts pay private special ed schools when they can't serve a student's IEP needs internally. From NCES F-33 (FY2020).", finding: "High spend signals staffing gaps the district can't fill internally, plus existing budget mechanisms for outsourcing instruction." },
      { name: "Existing Competitor Spend", points: "0-20", metric: "Count of distinct vendors with revenue > $0 across all 5 vendors, from DistrictFinancials (GovSpend PO data).", finding: "The strongest behavioral signal. Multi-vendor districts spend 7.3x more on average ($772K vs $106K). If they're buying virtual instruction from anyone, they're a proven market participant." },
      { name: "Charter Enrollment %", points: "0-10", metric: "Charter school enrollment as % of total district enrollment from NCES CCD.", finding: "Moderate charter competition (5-30%) has 13-15% penetration \u2014 these districts are losing students but still fighting. Above 30%, the district itself is often hollowed out." },
      { name: "Enrollment Trend (3yr)", points: "0-10", metric: "3-year % change in total enrollment from Urban Institute API.", finding: "Slightly declining districts buy the most (8.0% penetration). The 'worried but not desperate' sweet spot. Growing districts barely buy (2.7%)." },
      { name: "Staffing Trend (3yr)", points: "0-10", metric: "3-year % change in staff FTE from Urban Institute API.", finding: "Moderate staff decline signals active teacher loss being replaced with virtual. $1.3M avg revenue for moderate-decline districts." },
      { name: "Debt per Student", points: "0-8", metric: "Total debt outstanding divided by enrollment from NCES F-33 (FY2020).", finding: "Moderate debt ($5-15K) signals willingness to invest. Zero-debt districts are the most resistant buyers (2.3% penetration vs 8.9% for moderate debt)." },
      { name: "Pipeline/Customer Status", points: "0-10", metric: "Whether the district is a current Fullmind customer or has an open pipeline opportunity, from Fullmind CRM (OpenSearch sync).", finding: "Existing relationship is a strong signal for expansion and retention." },
      { name: "ELL Trend (3yr)", points: "0-7", metric: "3-year change in English Language Learner % from Urban Institute API.", finding: "ELL change in either direction creates staffing disruption. Rising ELL districts need bilingual teachers that are extremely hard to hire (10.7% penetration)." },
    ],
  },
  {
    label: "State",
    weight: 20,
    color: "#6EA3BE",
    question: "Is the state environment favorable for selling?",
    factors: [
      { name: "District Consolidation", points: "0-30", metric: "Median district enrollment in the state, computed from NCES CCD. Measures whether the state has fewer large districts or many small ones.", finding: "Consolidated states (SC, MD, FL, GA) have 11% avg penetration. Fragmented states (CA, AZ, MT) have 1.7%. Larger districts = bigger budgets, centralized decisions, more staffing complexity." },
      { name: "Existing Penetration", points: "0-25", metric: "% of districts in the state with any vendor revenue, computed from DistrictFinancials.", finding: "Higher penetration means a proven sales motion, reference customers, and market awareness. SC leads at 34.1%." },
      { name: "Existing Revenue in State", points: "0-15", metric: "Total lifetime vendor revenue from all districts in the state, from DistrictFinancials.", finding: "Higher existing revenue signals proven demand and referenceable customers." },
      { name: "Churn Penalty", points: "0 to -15", metric: "Blended customer churn (30% weight) and revenue churn (70% weight) computed from Fullmind + Elevate K12 district_financials, comparing FY24-25 customers to FY26-27 retention.", finding: "Penalizes states where the sales motion may be broken despite historical success. E.g., SC lost $20M in revenue (78.5% rev churn) despite retaining 14 of 30 customers. States with no FM/EK12 presence are unaffected." },
    ],
  },
];

const TIER_RULES = [
  { tier: "Tier 1", rule: "Fit \u2265 60, Value \u2265 60, Composite \u2265 60", use: "High-priority targets and strategic accounts", color: "#69B34A" },
  { tier: "Tier 2", rule: "Composite \u2265 40", use: "Volume targets and secondary pipeline", color: "#6EA3BE" },
  { tier: "Tier 3", rule: "Composite \u2265 25", use: "Low-priority, opportunistic only", color: "#A69DC0" },
  { tier: "Tier 4", rule: "Composite < 25", use: "Not viable for current GTM", color: "#D4CFE2" },
];

const DATA_SOURCES = [
  { name: "NCES CCD", desc: "Enrollment, locale, grade span, charter enrollment, school counts" },
  { name: "NCES F-33", desc: "Revenue, expenditure, per-pupil spend, charter/private payments, debt (FY2020)" },
  { name: "Urban Institute API", desc: "FRPL, ELL/SWD %, absenteeism, proficiency, graduation, enrollment & staffing trends" },
  { name: "DistrictFinancials", desc: "Fullmind + Elevate K12 revenue by fiscal year (OpenSearch sync)" },
  { name: "DistrictFinancials (competitors)", desc: "Proximity, Elevate, TBT, Educere PO data (GovSpend) — merged into DistrictFinancials" },
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
          <div className="grid gap-3">
            {score.factors.map((f) => (
              <div key={f.name} className="border-b border-[#E2DEEC] last:border-0 pb-3 last:pb-0">
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-xs font-semibold text-[#544A78]">{f.name}</span>
                  <span className="text-[10px] text-[#A69DC0]">({f.points} pts)</span>
                </div>
                <p className="text-xs text-[#6E6390] leading-relaxed">{f.metric}</p>
                <p className="text-xs text-[#403770] leading-relaxed mt-1 font-medium">{f.finding}</p>
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
