# District Opportunity Score — Methodology

**Date:** 2026-03-15
**Status:** Proposal
**Author:** Sierra + Claude analysis session

## Overview

A composite scoring system that ranks all 17,910 districts in the database by their fit, revenue potential, purchase readiness, and state-level environment. Designed to support prospecting prioritization, portfolio health assessment, and territory planning.

## Architecture

Four sub-scores (0-100 each) combine into a weighted composite:

| Sub-Score | Weight | What It Measures |
|---|---|---|
| **Fit** | 30% | Demographic/structural match to our best customers |
| **Value** | 25% | Revenue capacity and deal-size potential |
| **Readiness** | 25% | Behavioral signals the district is likely to buy |
| **State** | 20% | State-level environment favorability |

**Composite = (Fit × 0.30) + (Value × 0.25) + (Readiness × 0.25) + (State × 0.20)**

## Tier Classification

| Tier | Criteria | Expected Count | Use Case |
|---|---|---|---|
| **Tier 1** | Fit ≥ 60, Value ≥ 60, Composite ≥ 60 | ~304 | High-priority targets and strategic accounts |
| **Tier 2** | Composite ≥ 40 | ~4,544 | Volume targets and secondary pipeline |
| **Tier 3** | Composite ≥ 25 | ~9,072 | Low-priority, opportunistic only |
| **Tier 4** | Composite < 25 | ~3,990 | Not viable for current GTM |

---

## Fit Score (0-100)

*"Does this district look like our best customers?"*

Based on analysis of 1,087 existing customers vs 17,887 non-customers, the strongest demographic predictors of purchase are enrollment size (3.3x lift), majority-minority status (1.23x), and locale type.

| Factor | Points | Logic | Data Source |
|---|---|---|---|
| **Enrollment** | 0-25 | <500→0, 500-1K→5, 1K-2.5K→10, 2.5K-5K→15, 5K-10K→18, 10K-25K→22, 25K+→25 | NCES CCD. Total student headcount. The #1 predictor — penetration scales from 2.0% (<500) to 29.8% (50K+). |
| **FRPL Rate** | 0-20 | <25%→3, 25-50%→8, 50-75%→15, 75-100%→20 | NCES CCD via Urban Institute. Free/Reduced Price Lunch eligibility as % of enrollment. Primary poverty proxy. High-FRPL districts generate 6.7x more revenue per customer ($585K vs $88K avg). |
| **Majority-Minority** | 0-15 | >50% non-white→15, 30-50%→8, <30%→0 | NCES CCD enrollment by race. Calculated as `enrollment_white / enrollment`. Majority-minority districts have 6.7% penetration (vs 5.2%) and generate $1.0M avg revenue (vs $119K). |
| **Locale** | 0-15 | Suburb→15, City→12, Town→8, Rural-Fringe→5, Rural-Distant/Remote→0 | NCES CCD urban-centric locale code (11-43). Suburbs have 9.2% penetration and $462K avg revenue — the highest combination. |
| **Chronic Absenteeism** | 0-10 | >20%→10, 15-20%→7, 10-15%→4, <10%→0 | NCES Civil Rights Data Collection. % of students absent 15+ days. Signals district-level academic distress and potential staffing disruption. Top-10% revenue customers average 20.3% absenteeism. |
| **Math Proficiency (inverse)** | 0-10 | <30%→10, 30-40%→7, 40-50%→4, >50%→0 | State assessments via Urban Institute. % of students meeting grade-level proficiency. Lower proficiency signals greater need for instructional support. Top-10% revenue customers average 34.1% math proficiency. |
| **Grade Span** | 0-5 | Full K-12→5, HS-only→4, Elementary→1, Other→0 | NCES CCD lowest/highest grade offered. K-12 districts have 7.7% penetration; high-school-only 9.0%. HS districts need specialized subject teachers that are harder to hire. |

## Value Score (0-100)

*"How much revenue could this district generate?"*

| Factor | Points | Logic | Data Source |
|---|---|---|---|
| **District Total Revenue** | 0-25 | Quartiled within state: Q4→25, Q3→18, Q2→10, Q1→3 | NCES F-33 Annual Survey of School System Finances (FY2020). Total revenue from all sources (federal + state + local). Quartiled by state to normalize for cost-of-living differences. |
| **Enrollment (deal size)** | 0-20 | <1K→2, 1K-5K→8, 5K-10K→13, 10K-25K→17, 25K+→20 | NCES CCD. Larger districts buy larger contracts — 50K+ districts average $4.4M lifetime revenue vs $95K for <500. |
| **Expenditure/Pupil** | 0-15 | >$20K→15, $15-20K→10, $10-15K→6, <$10K→2 | NCES F-33 (FY2020). Total expenditure divided by enrollment. Higher per-pupil spend indicates more budget capacity for supplemental services. |
| **Existing Vendor Revenue** | 0-25 | $0→0, <$50K→8, $50-200K→14, $200K-$1M→20, $1M+→25 | VendorFinancials table (Fullmind, Elevate, Proximity, TBT) + CompetitorSpend table (Educere, Elevate, Proximity, TBT). Lifetime sum of total_revenue/total_spend across all fiscal years and vendors. Districts already spending are proven buyers. |
| **Number of Schools** | 0-15 | >30→15, 20-30→12, 10-20→8, 5-10→4, <5→1 | NCES CCD. More schools = more classrooms to staff = larger potential contract. |

## Readiness Score (0-100)

*"Is this district behaviorally likely to purchase?"*

Based on analysis of "wild card" factors — behavioral signals that aren't demographic but strongly predict purchasing.

| Factor | Points | Logic | Data Source |
|---|---|---|---|
| **Charter Tuition Outflow** | 0-15 | ≥10% of exp→15, 5-10%→12, 1-5%→8, <1%→4, $0→0 | NCES F-33 (FY2020). `payments_to_charter_schools` field. This is the dollar amount a traditional public school district **transfers to charter schools** when students leave for charters. Per-pupil funding follows the student. Districts spending >$1M on charter tuition had **17.3% penetration** (vs 3.8% for non-outsourcers) — a 4.5x lift. This signals: (a) the district is losing students to alternatives, (b) budget is already flowing to external instructional providers, (c) they have institutional experience purchasing instruction from outside entities. Note: FY2020 data is 6 years old; scored as % of total expenditure rather than absolute dollars to reduce staleness. |
| **SPED Private Placement** | 0-10 | ≥5% of exp→10, 2-5%→7, 0.5-2%→4, <0.5%→2, $0→0 | NCES F-33 (FY2020). `payments_to_private_schools` field. This is what districts pay **private special education schools** when they can't serve a student's IEP needs internally. High spend signals: (a) the district has specialized staffing gaps it can't fill, (b) it has budget mechanisms for outsourcing instruction, (c) it may be open to virtual SPED services as a lower-cost alternative to private placements. States like CT, VT, ME, NJ dominate this field due to traditions of tuition-based private SPED placements. |
| **Existing Competitor Spend** | 0-20 | 3+ vendors→20, 2→16, 1→10, 0→0 | CompetitorSpend table (GovSpend PO data) + VendorFinancials table. Count of distinct vendors with revenue > $0 across Fullmind, Elevate K12, Proximity Learning, Tutored By Teachers, and Educere. Multi-vendor districts spend **7.3x more** on average ($772K vs $106K). The single strongest behavioral signal — if they're already buying virtual instruction from anyone, they are a proven market participant. |
| **Charter Enrollment %** | 0-10 | 5-30%→10, 1-5%→7, 0% or >30%→3, no data→3 | NCES CCD. `charter_enrollment / enrollment`. Districts with **moderate** charter competition (5-30%) have 13-15% penetration — they're losing students but still fighting. Above 30%, the district itself is often hollowed out. Zero charter = not penalized (score 3). |
| **Enrollment Trend (3yr)** | 0-10 | Decline 0-2%→10, 2-5%→8, >5%→5, Stable 0-2%→4, Growing→0 | Urban Institute API. 3-year % change in total enrollment. **Slightly declining** districts buy the most (8.0% penetration). Sharp decline has bigger deals ($852K avg) but slightly lower penetration. Growing districts barely buy (2.7%). The "worried but not desperate" zone is the sweet spot. |
| **Staffing Trend (3yr)** | 0-10 | Moderate decline (2-5%)→10, Sharp decline→7, Moderate growth→6, Stable→3, Rapid growth→0 | Urban Institute API. 3-year % change in staff FTE. Moderate staff decline signals active teacher loss being replaced with virtual. $1.3M avg revenue for moderate-decline districts. Interestingly, moderate growth also scores well — these districts are hiring AND buying virtual to fill gaps during recruitment. |
| **Debt per Student** | 0-8 | $5-15K→8, $15-30K→6, <$5K→3, $0→0, >$30K→2 | NCES F-33 (FY2020). `debt_outstanding / enrollment`. Moderate debt signals willingness to invest and comfort with financial instruments. Zero-debt districts are the most resistant buyers (2.3% penetration vs 8.9% for moderate debt). Very high debt (>$30K) starts declining — these districts may be in fiscal crisis. |
| **Pipeline/Customer Status** | 0-10 | Customer→10, Pipeline→7, Neither→0 | Fullmind CRM (synced via OpenSearch). `is_customer` and `has_open_pipeline` flags. Existing relationship is a strong signal for expansion and retention. |
| **ELL Trend (3yr)** | 0-7 | Slight decline or rising (2-5%)→5, Surging/sharp decline→3, Stable→1, No data→0 | Urban Institute API. 3-year change in ELL %. ELL population change **in either direction** creates staffing disruption. Slight-decline districts have 11.6% penetration and $2.2M avg revenue. Rising ELL districts (10.7% penetration) need bilingual teachers that are extremely hard to hire. |

## State Score (0-100)

*"Is the state environment favorable for selling?"*

Based on analysis showing that state-level district consolidation structure predicts penetration 6-7x better than state demographics.

| Factor | Points | Logic | Data Source |
|---|---|---|---|
| **District Consolidation** | 0-30 | Median enrollment >5K→30, 1.5-5K→25, 500-1.5K→12, <500→0 | Computed from NCES CCD. Median district enrollment in the state. States with fewer, larger districts (SC, MD, FL, GA) have 11% avg penetration. Fragmented states (CA, AZ, MT) have 1.7%. This reflects: larger budgets per district, centralized decision-making, and more staffing complexity. |
| **Existing Penetration** | 0-25 | >15%→25, 10-15%→20, 5-10%→14, 2-5%→7, <2%→0 | Computed from VendorFinancials + CompetitorSpend. % of districts in the state with any vendor revenue. Higher penetration means proven sales motion, reference customers, and market awareness. SC leads at 34.1%. |
| **Territory Owner** | 0-15 | Assigned→15, Unassigned→0 | States table. `territory_owner` field. Only SC (Melodie Blackwood) and IA/MN/ND/WI (Tony Skauge) are currently assigned. SC's 34.1% penetration demonstrates what dedicated coverage achieves. |
| **State Total Enrollment** | 0-15 | >2M→15, 1-2M→12, 500K-1M→8, <500K→3 | NCES CCD. Total student enrollment across all districts in the state. Larger states offer more total addressable market. |
| **Existing Revenue in State** | 0-15 | >$20M→15, $5-20M→12, $1-5M→8, <$1M→3, $0→0 | VendorFinancials + CompetitorSpend. Total lifetime vendor revenue from all districts in the state. Higher existing revenue signals proven demand and referenceable customers. |

---

## Results Summary (2026-03-15 Run)

| Tier | Districts | % of Total | Customers | Prospects | Vendor Revenue | Avg Enrollment |
|---|---|---|---|---|---|---|
| **Tier 1** | 304 | 1.7% | 35 | 269 | $412.4M | 33,601 |
| **Tier 2** | 4,544 | 25.4% | 129 | 4,415 | $103.0M | 6,323 |
| **Tier 3** | 9,072 | 50.7% | 16 | 9,056 | $11.7M | 1,058 |
| **Tier 4** | 3,990 | 22.3% | 1 | 3,989 | $385K | 303 |

### Key Findings

- **304 Tier 1 districts** contain **$412.4M** (78%) of all existing vendor revenue
- Only **35 of 304** Tier 1 districts are current customers — **269 are untouched prospects**
- Tier 1 districts average **33,601 enrollment** — 5x larger than Tier 2
- SC has the most Tier 1 districts per capita (27/82 = 33% of state)
- NJ (47), TX (38), NY (32) have the most Tier 1 districts by raw count
- CA has 441 Tier 2 districts but only 8 Tier 1 (fragmented state structure depresses State Score)

### Top Prospect States by Untapped Tier 1

| State | Tier 1 | Already Customers | Prospects | Current Revenue |
|---|---|---|---|---|
| NJ | 47 | 0 | 47 | $39.0M |
| TX | 38 | 3 | 35 | $70.6M |
| NY | 32 | 12 | 20 | $18.7M |
| SC | 27 | 15 | 12 | $59.3M |
| FL | 21 | 0 | 21 | $1.0M |
| IL | 22 | 4 | 18 | $41.4M |
| GA | 17 | 1 | 16 | $47.1M |
| PA | 14 | 0 | 14 | $5.8M |

---

## Data Sources Reference

| Source | Freshness | Coverage | Fields Used |
|---|---|---|---|
| **NCES CCD** (Common Core of Data) | Current year | 18,974 districts | Enrollment, locale, grade span, charter enrollment, school counts |
| **NCES F-33** (School District Finance Survey) | FY2020 | 17,047 districts | Total revenue/expenditure, exp/pupil, charter payments, private payments, debt outstanding, federal/state/local revenue |
| **Urban Institute Education Data API** | Varies by metric | 16,000-17,000 districts | FRPL rate, ELL/SWD %, absenteeism, proficiency, graduation rate, enrollment trends, staffing trends |
| **VendorFinancials** (OpenSearch sync) | Current | 832 districts with revenue | Fullmind + Elevate revenue by fiscal year |
| **CompetitorSpend** (GovSpend PO data) | Current | 930 districts with spend | Proximity, Elevate, TBT, Educere PO amounts |
| **Fullmind CRM** (OpenSearch sync) | Current | All districts | is_customer, has_open_pipeline, owner |
| **States table** | Manual | 58 states/territories | territory_owner |

## Explore the Data

Interactive exploration page: `/admin/icp-scoring`

Full scored dataset: `.tmp/district_scores.csv`
