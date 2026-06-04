# Document Generator Placeholder — Design / Handoff

**Date:** 2026-06-04
**Status:** Design spec only — handoff for a future implementation session. **Not implemented.**
**Scope this session:** This document is the *sole* deliverable. No code, no branch, no commit was made producing it.

---

## Purpose

A **placeholder** UI in the Territory Planner where a user can enter all the payload
information required for a successful **Project Sea Monkey** document generation (the
Apps Script → Google Doc → Dropbox Sign / eSign contract pipeline).

This is explicitly **not** the permanent home for this functionality. Its job is to
**prove the input model is complete** — that a rep can supply every field the generator
needs — and to be structured so it drops cleanly onto a future **Opportunity detail**
view once opportunities are formally surfaced in the Territory Planner.

> **"Set up for success" intent:** opportunities are currently read-only, synced from
> OpenSearch every ~30 min (`Opportunity` model in `prisma/schema.prisma`). They are not
> yet a first-class, navigable entity with a detail view. This placeholder lets us build
> and validate the contract-payload capture *now*, independent of that, and relocate it
> later with minimal rework.

---

## Decisions locked during brainstorming (2026-06-04)

| # | Decision | Choice |
|---|---|---|
| 1 | **Functional scope** | **Design spec only.** On submit: nothing wired yet — the form assembles + previews the payload and stops. No API route, no Apps Script call, no eSign. |
| 2 | **Home / location** | **Standalone now, opportunity-ready later.** Build a standalone route; design the field model + data flow to drop onto Opportunity detail later. |
| 3 | **Document type(s)** | **Full Contract only** (`doc_type: "contract"`). BOCES Quote is a separate, already-specced doc type and is out of scope here. |
| 4 | **Pricebook / SKU source** | End goal = **import the pricebook into the repo**, but that is **Task 1 of the future build session** — done first, no stub, no free-text fallback. The form is built against the real in-repo pricebook from day one. |
| 5 | **UI organization** | **Approach A** — stacked labeled sections on a standalone page + a live payload preview panel (completeness-focused). |

---

## Authoritative payload schema (reference, do not duplicate)

The canonical Full-Contract JSON payload is defined in:

- **`Docs/superpowers/specs/2026-05-29-project-sea-monkey-contract-generator-design.md`**, **§ "JSON Payload Schema" (lines ~119–155).**

The implementing session must treat that block as the source of truth for field names,
types, and the `payment.type` A/B/C structure. Related context in the same spec:
the two post-generation paths (`auto_send`), the template marker system, and the
`SampleData.gs` fixtures (`PAYLOAD_FULL`, `PAYLOAD_NO_QUOTE`, `PAYLOAD_BOCES_ONLY`).

Apps Script side (already merged, PR #254): `scripts/document-generation/appsscript/`
— `Code.gs` (`doPost`), `MergeFields.gs`, `QuoteTable.gs`, `PaymentTerms.gs`,
`AppendedSections.gs`.

This handoff covers the **Territory Planner front-end form** that *produces* that payload.

---

## Placement & architecture

- **Route:** a standalone page, e.g. `/documents` (or `/quotes`), nav label
  **"Document Generator (placeholder)"**. Not wired to opportunities.
- **Feature folder:** `src/features/document-generation/` following the repo's
  feature convention (`components/`, `lib/`, optional `hooks/`). Mirror the form
  patterns in `src/features/activities/` (e.g. `ActivityFormModal.tsx` and the
  per-field components under `components/event-fields/`).
- **Core component:** a self-contained **`ContractPayloadForm`** with a controlled
  interface — `<ContractPayloadForm value={payload} onChange={setPayload} />` — so the
  standalone page hosts it now and an Opportunity-detail panel can host it later **with
  no logic moved**. This relocatability is a hard design requirement, not a nicety.

### Page layout (Approach A)

Two-column on desktop, vertical stack on mobile (< 640px):

- **Left — the form:** labeled sections, top to bottom, one per payload group.
- **Right — sticky live payload preview:** renders the assembled `contract` JSON as the
  user types, plus a **completeness indicator** listing which required fields are still
  empty. This panel is the point of the placeholder: it makes "is the payload complete?"
  visually obvious.

**Brand / resilience constraints (from CLAUDE.md + tokens.md):**
- Plum-derived neutrals only (`#F7F5FA`, `#EFEDF5`) — never raw Tailwind grays.
- Lucide icons, `currentColor`, semantic sizing.
- Every chrome flex/grid containing text needs `whitespace-nowrap` on text spans + a
  planned overflow behavior. The line-item table especially needs an overflow plan
  (`overflow-x-auto`) — it is wide.
- Sender/owner field **defaults to current user via `useProfile()`** (UX default rule).

---

## Form sections & field inventory

Each section maps to one payload group. Field *names* below are the payload keys; see the
authoritative schema (referenced above) for the exact contract.

### 1. Parties & Dates → `deal`
- **Sender (Fullmind rep):** `sender_first`, `sender_last`, `sender_title`, `sender_email`
  — **auto-filled from `useProfile()`**, editable.
- **Client contact:** `client_first`, `client_last`, `client_title`, `client_company`,
  `client_email`.
- **Signer:** `signer_first`, `signer_last`, `signer_salut`, `signer_title`. Defaults to
  the client contact; a **"Signer differs from contact"** toggle reveals the separate
  signer fields.
- **Term:** `start_date`, `end_date` (date pickers). `today` is **auto-stamped at
  generation**, not user-entered — shown read-only in the preview.

### 2. Quote → `quote`
- **`include`** toggle — "Include quote section."
- **`show_pricing`** toggle — "Show List Rate & Discount columns."
- **Line-items table** (`line_items[]`), columns:
  **SKU · Service · Description · Qty · Unit · List Rate · Disc % · Net Rate · Total**
  - SKU picker (typeahead) → fills `service`, `description`, `list_rate`, `unit` from the
    pricebook (see Pricebook section).
  - User enters `qty` and `discount_pct`.
  - **Auto-calc:** `net_rate = list_rate × (1 − discount_pct/100)`;
    `total = net_rate × qty`. (Confirm exact rounding against `QuoteTable.gs`.)
  - "Add line item" / remove-row controls.
- **`min_amt`**, **`max_amt`** — manual now; later pre-fillable from opportunity.
- **`order_total`** — auto-sums line `total`s.

### 3. Payment Terms → `payment`
- **`type`** selector: **A — Upon Receipt · B — Installment · C — BOCES**.
- **Always shown:** `pay_terms`, `invoice_date`, `contract_end`, `unused_funds`,
  `billing_name`, `billing_add`, `billing_email`, `billing_phone`, `po_yn` (PO required?).
- **Type B reveals:** `add_terms`, `imp_detail`.
- **Type C reveals:** `pay_prepost` (pre/post-pay), `boces_name`, `po_number`.
- Conditional fields **hide and clear from the payload** when their type isn't selected
  (so the assembled JSON only carries the active type's fields).

### 4. Sections & Pricing Sheets → `sections`
- **`sow_type`** radio: Live Streaming (`live_streaming`) · Instructional Services
  (`instructional_services`).
- **`staffing_include`** toggle.
- Pricing-sheet toggles: **`pricing_ek12`**, **`pricing_livestaff`**, **`pricing_hourly`**,
  **`pricing_boces`**.

### 5. Delivery → `auto_send`
- Single **"Auto-send for signature"** toggle. Present in the payload model but visually
  de-emphasized — submit behavior is out of scope for this build (see Out of Scope).

---

## Pricebook — the one real dependency (Task 1)

The SKU picker reads from an **in-repo pricebook dataset that does not exist yet**.
Importing it is the **first task of the future build session** — no stub, no free-text
fallback, no "pending" placeholder. The form is built against the real pricebook.

- **Source CSVs:** `flat_priced_products.csv` and `volume_priced_products.csv`, currently
  external at
  `~/Desktop/Work Documents/Project Sea Monkey/Fullmind Pricebook - PandaDoc Export May 2026/`.
- **Target:** a committed static dataset, e.g.
  `src/features/document-generation/lib/pricebook.ts` (or a generated JSON + a typed
  loader), shape roughly:
  `{ sku: string; service: string; description: string; list_rate: number; unit: string }`.
- **Volume-priced entries** should be flagged in the dataset so the picker can later apply
  tiered rates. (Tiered-pricing UI itself can be a follow-up; the data shape should not
  preclude it.)
- The picker does **rate lookup only on the TP side** — by the time the payload reaches
  Apps Script, `list_rate`/`net_rate`/`total` are already calculated (confirmed in the
  Sea Monkey spec, § Project Structure note).

---

## Opportunity-readiness (design constraints, not built now)

So the later drop-in is mechanical rather than a rewrite, the spec records the pre-fill
mapping from the `Opportunity` model. Each form field declares its future source:

| Form field | Future opportunity source (`Opportunity`) |
|---|---|
| `deal.client_company` | district / opportunity name |
| `quote.min_amt` | `minimumPurchaseAmount` |
| `quote.max_amt` | `maximumBudget` |
| `quote.order_total` | `netBookingAmount` |
| `payment.type` | `paymentType` (if synced as A/B/C) |
| `payment.pay_terms` | `paymentTerms` |
| `payment.contract_end` | `contractThrough` |
| `deal.start_date` | `startDate` |

(Verify field availability/format against `prisma/schema.prisma` `Opportunity` at build
time; some may need normalization.)

**Component contract:** `ContractPayloadForm` accepts an optional `initialValue` /
`prefill` so the standalone page passes `{}` (rep fills manually) and a future
Opportunity-detail host passes a mapped opportunity. No internal logic differs.

---

## Out of scope (do NOT build)

- **Submit behavior** — no API route, no Apps Script POST, no eSign / `auto_send`
  execution, no `PLAYWRIGHT_TRIGGER_URL` wiring. The form assembles + previews the
  payload and stops.
- **BOCES Quote** doc type (separate spec:
  `Docs/superpowers/specs/2026-06-04-boces-quote-document-type-design.md`, shipped in PR #261).
  **Note for when BOCES support is later added to this placeholder:** the BOCES
  Quote payload now carries its **own `payment` block** (added in PR #261 after the
  block's deal-specific values were found hardcoded) — 11 per-deal variables:
  `pay_terms`, `contract_end`, `unused_funds`, `billing_name/add/email/phone`,
  `po_yn`, `pay_prepost`, `boces_name`, `po_number`. Unlike the Full Contract it is
  a **single fixed block with no A/B/C `type` choice**, and it omits `invoice_date`,
  `add_terms`, `imp_detail`. So the eventual shared Payment Terms sub-form must
  support two shapes — the contract's A/B/C conditional block and BOCES's fixed
  subset — and must **not** assume a quote-only doc has no payment fields. See the
  BOCES spec § Payload Schema (~L122–157).
- **Persistence** — payload is ephemeral; no `Quote` / `LineItem` Prisma model.
- **Auth / secrets** for the generator endpoint.

---

## Suggested task sequence for the future session

1. **Import pricebook** CSVs → committed dataset + TypeScript types (Task 1, no stub).
2. Scaffold `src/features/document-generation/` + standalone route + nav entry.
3. `ContractPayloadForm` shell: section scaffolding + live JSON preview panel +
   completeness indicator + controlled `value`/`onChange` (+ optional `prefill`).
4. **Parties & Dates** section (sender auto-fill via `useProfile()`).
5. **Quote** section + SKU-driven line-item table with auto-calc.
6. **Payment Terms** section (A/B/C conditional reveal + clear-on-hide).
7. **Sections & Pricing** + **Delivery** toggles.
8. Mobile pass (`/mobile-design`) + tokens compliance + Vitest coverage for the
   line-item calc logic and the conditional payload assembly (active payment type only,
   `quote.include=false` omits line items, etc.).

---

## Key references

| What | Where |
|---|---|
| Authoritative payload schema | `Docs/superpowers/specs/2026-05-29-project-sea-monkey-contract-generator-design.md` § JSON Payload Schema (~L119–155) |
| BOCES Quote (out of scope here; shipped PR #261) | `Docs/superpowers/specs/2026-06-04-boces-quote-document-type-design.md` § Payload Schema (~L122–157) — incl. its own `payment` block |
| Apps Script generator (PR #254, merged) | `scripts/document-generation/appsscript/` |
| Opportunity data model | `prisma/schema.prisma` (`Opportunity`, `Session`) |
| Form pattern to mirror | `src/features/activities/components/ActivityFormModal.tsx` + `components/event-fields/` |
| UI tokens / brand | `Documentation/UI Framework/tokens.md` |
| Pricebook source CSVs (external) | `~/Desktop/Work Documents/Project Sea Monkey/Fullmind Pricebook - PandaDoc Export May 2026/` |

---

## Notes for the next Claude session

- This was produced as a **design-only** session with strict constraints: no branch
  change, no commit, no implementation — to avoid merge conflicts / interference with a
  parallel session. If you pick this up, start by confirming the current branch and the
  pricebook CSV location before Task 1.
- Repo tracks the **capital `Docs/`** directory; a lowercase `docs/` path silently
  aliases on case-insensitive macOS — always use the capital path when adding/committing.
