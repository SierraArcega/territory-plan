# Generate Document — Form & Review Flow (design)

**Date:** 2026-06-05
**Status:** Approved (brainstorm) — pending implementation plan
**Feature area:** `src/features/document-generation/` (Project Sea Monkey)

## Context

Project Sea Monkey is Fullmind's contract-generation pipeline: a deployed Google
Apps Script renders a Google Doc from a JSON payload, with eSignature via the
Dropbox Sign API using text-tags (`\s1\`, `\d1\`) embedded in the doc. Two
document types exist today (`doc_type`: `contract` | `boces_quote`), and the
FY27 pricebook has been imported (`src/features/document-generation/`).

This spec covers the **next phase: surfacing document generation inside the
Territory Planner**, driven by opportunity data. It defines the **form that
assembles a payload, renders the real document, and routes it** — the
"good home for entering this data."

### Prior art (read these)
- `Docs/superpowers/specs/2026-05-29-project-sea-monkey-contract-generator-design.md` — contract payload schema.
- `Docs/superpowers/specs/2026-06-04-boces-quote-document-type-design.md` — BOCES quote payload schema.
- `Docs/superpowers/specs/2026-06-04-document-generator-placeholder-design.md` — the prior standalone-form design + pricebook + the opportunity pre-fill mapping table. This spec **supersedes its UX direction** (opportunity-hosted, not standalone; render+review flow added) and **reuses** its pricebook/payload-assembly groundwork.

### Opportunity data reality (drives the design)
- Opportunities sync **one-way** from the Fullmind LMS (CRM) → OpenSearch → Postgres, roughly every 30–60 min. The app is **read-only** w.r.t. opportunities; **there is no write-back path to the LMS**.
- An opportunity supplies only ~8 of the ~40 document fields (district/company name, start date, contract-through, payment terms text, min/max amounts, net booking amount). It has **no line items** (only an aggregate `netBookingAmount` + a `serviceTypes` array) and **no contact FK**.
- District contacts live in the `contacts` table (keyed by `leaid`), with a full create/edit path already built (`ContactsList.tsx`, `useCreateContact` → `POST /api/contacts`, dedupes by email).

**Implication:** this is overwhelmingly a **form-building** effort. Opportunity pre-fill is a thin convenience layer; the rep supplies contacts (pick or create), line items (pricebook), billing address, PO details, and payment specifics.

## Goal

Let a rep, starting from an opportunity, assemble a valid document payload,
render the **real** Google Doc, review it, and route it for signature (default)
or to manual finishing — without leaving the Territory Planner, and without ever
maintaining a second document renderer.

## Decomposition & where this spec fits

The overall feature is split into sub-projects, brainstormed/spec'd one at a time:

1. **Renderer service** *(foundational, separate spec)* — single Apps Script engine with a `tags: on/off` render mode; payload in → real Google Doc URL out.
2. **Generate Document form & review flow** — **THIS SPEC**.
3. **Entry points** *(separate, thin spec)* — surface "Generate Document" from the two opportunity views (add a District column + row action to the plan-detail **Opps tab**; row action on the plan-modal **Opportunities tab**); both open the same modal.
4. **Delivery** *(separate spec)* — actual Dropbox Sign auto-send + branch-c re-fire.

This spec depends on (1) at the **interface** level only (see *Renderer interface*), and stubs (4) behind the review-stage branch buttons.

## Core architectural principle: one renderer

Rendering produces the **real Google Doc** — there is no separate "preview" vs
"final" artifact. The "preview" is simply that rendered doc shown before the rep
decides what to do with it. We never build a second (browser) renderer that
mimics the doc, because:

- The signed Google Doc is the legal artifact; a browser clone is advisory. Drift between them manufactures false confidence (the tool shows X, sends Y).
- The doc layout changes often (legal wording, new sections, BOCES divergence); two renderers in two languages drift silently.
- Google Docs fidelity (pagination, appended PDFs, fonts, text-tags) can't be reproduced in HTML anyway.
- The Google Doc is **load-bearing for eSign** (text-tags live in it), so the renderer correctly stays in Apps Script.

Instant feedback during editing is provided by a **data recap** (totals, names,
toggles) rendered from the payload — which *is* the single source of truth, so it
cannot drift. True document fidelity comes from an **on-demand render** (a few
seconds), not per-keystroke. Nothing renders live as the rep types.

## Flow

```
Opportunity (plan modal / Opps tab)
  → ① Define payload (the form, pre-filled from opp + profile)
  → ② Render (one Apps Script engine → real Google Doc, eSign tags baked in)
  → ③ Review (rendered doc + terms recap)
       ├─ Send for signature (Dropbox Sign)         ← DEFAULT
       ├─ Open Google Doc (manual finish)           → tag-free re-render (branch a)
       └─ Back to edit                              → re-render new version
  (separate later entry) Re-fire an existing doc URL → verify tags intact → Dropbox Sign (branch c)
```

The **tags-on/off** decision is made **after** render: the canonical render bakes
in eSign text-tags (invisible white text, so review still looks clean) and the
default action sends for signature. Choosing **Open Google Doc** (manual) is the
deviation that triggers a **tag-free re-render**.

## Form design

**Layout (B):** single modal, single-scrolling sectioned form with a sticky
section-nav. A persistent footer shows a completeness indicator and the primary
**Render document** action. No side-by-side live preview.

**Doc-type selector (top):** `Contract | BOCES Quote`. Selecting BOCES Quote
reshapes the form: drops the signer role, adds the `fee_pct` field, switches the
quote table to BOCES columns, and forces payment type C.

**Pre-fill provenance** is shown inline on fields: 📥 opportunity · 👤 profile
(sender, via `useProfile()`) · ✎ rep-entered.

### Section 1 — Parties & Contacts
A contract has up to three contact roles: **client**, **signer**, **billing**.

- **Primary contact**: searchable dropdown of the district's existing contacts (scoped by the opp's `districtLeaId` → `contacts.leaid`), plus **"＋ Add new"** which expands an inline create form (salutation, name, title, email, phone) and persists via the existing `useCreateContact` path (dedupes by email). A newly created contact **auto-selects into the role being filled**.
- **Signer** and **billing** default to "same person as primary" via checkboxes; their dedicated pickers appear **only when unchecked** (progressive disclosure — fewest clicks for the common single-person case).
- **Billing address**: always shown and **required**. It is an **ad-hoc, ephemeral field** entered per generation — the schema has no home for it (`contacts` stores no address). Not persisted.
- Dates (`start_date`, contract end) pre-fill from the opportunity where available.

### Section 2 — Quote
- The line-item table **starts empty** — the opportunity has no line items. The rep builds rows via the **SKU picker** (pricebook `getProducts`, **FY27 default**; `getBocesProducts()` in BOCES mode) plus **"＋ Custom row"** (the rep's ad-hoc/Allocation item).
- **Contract columns:** Service / Qty / Unit / List rate / Disc % / Net rate / Total (Net and Total auto-calc; `show_pricing` toggle controls List/Disc columns).
- **BOCES columns:** Product / Hourly rate / Hours / Total, plus a `fee_pct` field (default 10.6) producing a computed fee + grand total.
- **Booking reference:** the opportunity's `netBookingAmount` is displayed next to the live order total as a **non-blocking reference with a mismatch warning** — reps catch when their built total is far from the deal size (mismatch is often legitimate, so it never blocks render).

> **Implemented enhancements (post-preview review, 2026-06-08):** the SKU picker is a **combobox** (collapsed input + ▾ to browse / type to filter), not an always-visible list. Quote rows are **inline-editable** — quantity and discount % per row, plus service name + rate on custom rows — with a per-row remove (×). A **pricebook fiscal-year selector** (Auto / FY27 / FY26) replaced the hardcoded FY27: **Auto** derives the year from the contract start/end dates (`lib/fiscal-year.ts::resolveFiscalYear`, reusing the canonical `getCurrentFY`), falling back to FY27. `showPricing` toggle, min/max inputs, and a `sowType` selector remain deferred (safe defaults).

### Section 3 — Payment terms
- `A — Standard` | `B — Customized` | `C — BOCES Standardized`.
- Defaults to **A** (the opp's `paymentType` is free-text, not reliably mappable to A/B/C). Selecting the **BOCES Quote** doc-type forces **C**.
- A/B/C conditional fields follow the Apps Script contract schema, with clear-on-hide so inactive-type fields never render as stray tokens.
- `pay_terms` pre-fills from the opp's `paymentTerms` where present; billing contact fields come from the chosen billing contact; PO fields are rep-entered.

### Section 4 — Sections to append
Toggles for the optional appended documents (staffing descriptions, EK12 /
hourly / live-staffing / BOCES pricing sheets, SOW type for contracts; staffing +
BOCES pricing + agreement for BOCES). Mirrors the `sections` object of each
doc-type's payload.

## Render & review stage
- **Render document** assembles the typed payload and calls the renderer service (see interface) with `tags: on`. Returns the real Google Doc URL.
- **Review** displays the rendered doc (Google Doc link/embed) alongside the terms recap (parties, dates, quote table with totals, payment summary, appended sections).
- **Branch actions:**
  - **Send for signature** *(default)* — hand the tagged doc to Dropbox Sign *(delivery spec)*.
  - **Open Google Doc** — secondary; triggers a **tag-free re-render** and opens the doc for manual edit/print/send (branch a).
  - **Back to edit** — return to the form; a subsequent render is a new version.
- Branch c (re-fire a previously-rendered doc URL after verifying its text-tags are intact) is a **separate later entry point**, not part of this modal's primary flow.

## Renderer interface (dependency — not built here)
This spec assumes the renderer service exposes:

```
renderDocument({ doc_type, deal, quote, payment, sections, tags }) → { docUrl, agreementUrl? }
```

- `tags: boolean` — bake eSign text-tags (default `true`); `false` for the manual branch.
- Payload shapes are the existing Apps Script `contract` / `boces_quote` schemas.
- The renderer's implementation (Apps Script `tags` mode, temp-folder handling) is specified separately (sub-project 1).

## Data sources / pre-fill mapping
| Form field | Source |
|---|---|
| `deal.client_company` | opp district / name (📥) |
| `deal.start_date` / contract end | opp `startDate` / `contractThrough` (📥) |
| `payment.pay_terms` | opp `paymentTerms` (📥) |
| `quote.min_amt` / `max_amt` | opp `minimumPurchaseAmount` / `maximumBudget` (📥) |
| booking reference | opp `netBookingAmount` (📥, reference only) |
| sender_* | `useProfile()` (👤) |
| client/signer/billing identity | district `contacts` (pick) or inline create |
| billing address | rep-entered, required, ephemeral (✎) |
| line items | pricebook SKU picker + custom rows (✎) |
| payment type, PO fields, quote_number, fee_pct | rep-entered (✎) |

## Validation & completeness
Render is enabled only when required fields are present: primary contact (+ signer
& billing resolved), billing address, ≥1 line item, dates, and a payment type.
The footer shows a live completeness indicator. The booking-amount mismatch is a
**warning, not a blocker**.

## Component contract
- `DocumentPayloadForm` (extends the placeholder-spec component) accepts a
  controlled `value`/`onChange` and an optional **`prefill`** object. The
  opportunity-hosted modal passes a mapped opportunity; a standalone host could
  pass `{}`. No internal logic differs by host.
- A `useContacts(leaid)` selector feeds the contact pickers; `useCreateContact`
  handles inline creation.

## Mobile
The single-scroll form is mobile-friendly by construction. The review stage opens
the Google Doc URL (native Google Docs handles mobile) rather than embedding a
fixed iframe. Follow `/mobile-design` for the modal chrome and the quote table
(responsive columns / horizontal scroll).

## Out of scope (separate specs / not built here)
- Renderer implementation (Apps Script `tags`/temp modes) — sub-project 1.
- Dropbox Sign auto-send and branch-c re-fire — delivery spec (sub-project 4).
- Entry points (Opps-tab District column + row actions) — entry-points spec (sub-project 3).
- **Persistence:** the payload and billing address are ephemeral. No `Quote`/
  `LineItem` Prisma model. (Branch c will need *some* record of generated doc URLs
  — that data-model question belongs to the delivery spec.)
- Any write-back to the LMS (no path exists).

## Open questions / future
- Should generated doc URLs be recorded (for branch c / an audit trail)? — deferred to the delivery spec.
- SKU-picker interaction detail (search, category grouping) reuses the placeholder-spec design; revisit only if usability testing flags it.
- Whether `paymentType` could be made reliably A/B/C-mappable upstream (would let us pre-fill payment type) — out of our control (LMS-owned).

## Key references
- Opportunity model: `prisma/schema.prisma` `Opportunity` (~line 1520).
- Contacts: `prisma/schema.prisma` `Contact` (~line 355); `src/features/districts/components/ContactsList.tsx`; `useCreateContact` in `src/features/shared/lib/queries.ts`; `POST /api/contacts`.
- Opp views: `src/features/map/components/SearchResults/PlanOpportunitiesTab.tsx` (has District col); `src/features/views/components/views/OppsView.tsx` + `views/lib/columns.ts` (`SOURCE_COLUMNS.opps`, no District col).
- Pricebook: `src/features/document-generation/lib/pricebook.ts`, `data/pricebook.json`.
- Apps Script payloads: `scripts/document-generation/appsscript/` (`Code.gs`, `BocesQuote.gs`, `SampleData.gs`).
