# Document Generator Placeholder — Design / Handoff

**Date:** 2026-06-04 (updated same day)
**Status:** Design spec for the **form** (not yet built). Its one real dependency —
the **pricebook import — is now DONE** (see Pricebook section). BOCES Quote support has
been **moved into scope** now that the BOCES doc type shipped (PR #261).

---

## Purpose

A **placeholder** UI in the Territory Planner where a user can enter all the payload
information required for a successful **Project Sea Monkey** document generation (the
Apps Script → Google Doc → Dropbox Sign / eSign pipeline).

This is explicitly **not** the permanent home for this functionality. Its job is to
**prove the input model is complete** — that a rep can supply every field the generator
needs — and to be structured so it drops cleanly onto a future **Opportunity detail**
view once opportunities are formally surfaced in the Territory Planner.

> **"Set up for success" intent:** opportunities are currently read-only, synced from
> OpenSearch every ~30 min (`Opportunity` model in `prisma/schema.prisma`). They are not
> yet a first-class, navigable entity with a detail view. This placeholder lets us build
> and validate the payload capture *now*, independent of that, and relocate it later with
> minimal rework.

---

## Decisions locked during brainstorming (2026-06-04)

| # | Decision | Choice |
|---|---|---|
| 1 | **Functional scope** | **Form + payload assembly only.** On submit: nothing wired yet — the form assembles + previews the payload and stops. No API route, no Apps Script call, no eSign. |
| 2 | **Home / location** | **Standalone now, opportunity-ready later.** Build a standalone route; design the field model + data flow to drop onto Opportunity detail later. |
| 3 | **Document type(s)** | **Both — Full Contract (`doc_type: "contract"`) + BOCES Quote (`doc_type: "boces_quote"`)**, in **one form with a document-type selector** that morphs the sections. *(Updated 2026-06-04: BOCES moved up from "out of scope" now that PR #261 shipped.)* |
| 4 | **Pricebook / SKU source** | **DONE.** Imported into the repo on branch `feat/document-generation-pricebook` (commit `fed36094`). The form is built against the real dataset. |
| 5 | **UI organization** | **Approach A** — stacked labeled sections on a standalone page + a live payload preview panel (completeness-focused). |

---

## Authoritative payload schemas (reference, do not duplicate)

Two `doc_type`s, two payloads. Treat these as the source of truth for field names/types:

- **Full Contract** (`doc_type: "contract"`):
  `Docs/superpowers/specs/2026-05-29-project-sea-monkey-contract-generator-design.md`
  § "JSON Payload Schema" (~L119–155). Includes the `payment.type` A/B/C structure, the
  `auto_send` post-generation paths, and the `SampleData.gs` fixtures.
- **BOCES Quote** (`doc_type: "boces_quote"`):
  `Docs/superpowers/specs/2026-06-04-boces-quote-document-type-design.md`
  § "Payload Schema" (~L122–157). Leaner `deal`, a `quote` with `fee_pct` + simple line
  items, its **own fixed `payment` block** (no A/B/C), and BOCES `sections`. No signature.

Apps Script side (merged): `scripts/document-generation/appsscript/` — `Code.gs`
(`doPost` → `generateDocument` routes by `doc_type`), `MergeFields.gs`, `QuoteTable.gs`,
`PaymentTerms.gs`, `BocesQuote.gs`, `AppendedSections.gs`.

This handoff covers the **Territory Planner front-end form** that *produces* those payloads.

---

## Placement & architecture

- **Route:** a standalone page, e.g. `/documents` (or `/quotes`), nav label
  **"Document Generator (placeholder)"**. Not wired to opportunities.
- **Feature folder:** `src/features/document-generation/` (already exists — the pricebook
  `lib/` + `data/` landed there). Add `components/` and optional `hooks/`. Mirror the form
  patterns in `src/features/activities/` (`ActivityFormModal.tsx` + the per-field
  components under `components/event-fields/`).
- **Core component:** a self-contained **`DocumentPayloadForm`** with a controlled
  interface — `<DocumentPayloadForm value={payload} onChange={setPayload} />`. A
  **document-type selector** at the top (`Full Contract | BOCES Quote`) morphs which
  sections render and which payload shape is assembled. The component is built so the
  standalone page hosts it now and an Opportunity-detail panel can host it later **with no
  logic moved** — relocatability is a hard requirement.

### Page layout (Approach A)

Two-column on desktop, vertical stack on mobile (< 640px):

- **Left — the form:** a doc-type selector, then labeled sections top-to-bottom.
- **Right — sticky live payload preview:** renders the assembled JSON (for the selected
  `doc_type`) as the user types, plus a **completeness indicator** of still-empty required
  fields. This is the point of the placeholder: it makes "is the payload complete?" obvious.

**Brand / resilience constraints (CLAUDE.md + tokens.md):**
- Plum-derived neutrals only (`#F7F5FA`, `#EFEDF5`) — never raw Tailwind grays.
- Lucide icons, `currentColor`, semantic sizing.
- Every chrome flex/grid with text needs `whitespace-nowrap` + a planned overflow
  behavior. The line-item table needs `overflow-x-auto` — it is wide.
- Sender/owner field **defaults to current user via `useProfile()`** (UX default rule).

---

## Form sections & field inventory

A **document-type selector** at the top switches the form between the two modes below.
Field *names* are the payload keys; see the authoritative schemas for the exact contract.

### Mode A — Full Contract (`doc_type: "contract"`)

**1. Parties & Dates → `deal`**
- **Sender (Fullmind rep):** `sender_first/last/title/email` — **auto-filled via
  `useProfile()`**, editable.
- **Client contact:** `client_first/last/title/company/email`.
- **Signer:** `signer_first/last/salut/title`. Defaults to the client contact; a
  **"Signer differs from contact"** toggle reveals separate fields.
- **Term:** `start_date`, `end_date`. `today` auto-stamped at generation (read-only in preview).

**2. Quote → `quote`**
- **`include`** toggle ("Include quote section") and **`show_pricing`** toggle
  ("Show List Rate & Discount columns").
- **Line-items table** (`line_items[]`): **SKU · Service · Description · Qty · Unit ·
  List Rate · Disc % · Net Rate · Total**.
  - SKU picker (typeahead) reads the pricebook (FY27 by default — see Pricebook section)
    and maps a product into the row: `sku←sku`, `service←name`, `description←description`,
    `list_rate←listRate`, `unit←unit`.
  - Rep enters `qty` + `discount_pct`; **auto-calc** `net_rate = list_rate × (1 −
    discount_pct/100)`, `total = net_rate × qty`. (Confirm rounding vs `QuoteTable.gs`.)
  - **"Add custom line item"** action — adds a fully editable row (rep types service,
    description, rate, qty) with **no SKU**. This is the home for the former "Allocation"
    ad-hoc item (excluded from the pricebook on purpose — see Pricebook decisions).
  - "Add line item" / remove-row controls.
- **`min_amt`**, **`max_amt`** — manual now; later pre-fillable from opportunity.
- **`order_total`** — auto-sums line `total`s.

**3. Payment Terms → `payment`**
- **`type`** selector: **A — Upon Receipt · B — Installment · C — BOCES**.
- Always shown: `pay_terms`, `invoice_date`, `contract_end`, `unused_funds`,
  `billing_name/add/email/phone`, `po_yn`.
- Type **B** reveals `add_terms`, `imp_detail`. Type **C** reveals `pay_prepost`,
  `boces_name`, `po_number`.
- Conditional fields **hide and clear from the payload** when their type isn't selected.

**4. Sections & Pricing Sheets → `sections`**
- **`sow_type`** radio: Live Streaming · Instructional Services.
- **`staffing_include`** toggle.
- Pricing-sheet toggles: `pricing_ek12`, `pricing_livestaff`, `pricing_hourly`, `pricing_boces`.

**5. Delivery → `auto_send`**
- Single "Auto-send for signature" toggle — present in the model, de-emphasized (submit is
  out of scope this build).

### Mode B — BOCES Quote (`doc_type: "boces_quote"`)

Leaner; **no signature, no SOW/MSA, no A/B/C, no `auto_send`/eSign**.

**1. Quote Header → `deal` (subset)**
- `client_company`, `quote_number`, `start_date`, `end_date`. `today` auto. (No sender/signer.)

**2. Quote → `quote`**
- **`fee_pct`** — default **10.6**, fixed FY27–FY29 by the BOCES agreement (editable but flagged).
- **Line-items table**: **Product · Hourly Rate (`rate`) · Hours (`qty`) · Total** — **no
  discount column, no list-rate/net-rate**. SKU is tracked but the displayed columns are
  these four.
  - SKU picker restricted to **FY27 BOCES SKUs** via `getBocesProducts()`; maps
    `product←name`, `rate←listRate`, `sku←sku`.
  - **"Add custom line item"** action — same ad-hoc editable row idea (Allocation home).
  - **Computed, not in payload:** `subtotal = Σ(rate×qty)`; `fee = fee_pct% × subtotal`;
    `total = subtotal + fee`. Shown live; the table builder is authoritative on the doc.
- Line item shape sent: `{ sku, product, rate, qty }`.

**3. Payment Terms → `payment` (BOCES fixed block, no A/B/C)**
- `pay_terms`, `contract_end`, `unused_funds`, `billing_name/add/email/phone`, `po_yn`,
  `pay_prepost`, `boces_name`, `po_number`. All optional; missing → empty string.
- ⚠️ This is a **different shape** from the contract's A/B/C block — the shared Payment
  Terms sub-form must support both. Do **not** assume a quote-only doc lacks payment fields
  (this was the late catch fixed in PR #261).

**4. Sections → `sections`**
- `staffing_include`, `pricing_boces`, `boces_agreement` (the last returns an
  `agreementUrl` in the generator response).

---

## Pricebook — DONE (imported)

The SKU picker's data dependency is **complete**, on branch
`feat/document-generation-pricebook` (commit `fed36094`):

- **Generator (re-runnable):** `scripts/document-generation/pricebook/build-pricebook.ts`
  + `README.md`. Reads the PandaDoc CSV exports from a path arg (raw CSVs **not** committed
  — they carry an internal `Cost`/margin column) → writes the dataset.
- **Pure transforms (tested):** `src/features/document-generation/lib/pricebook-transform.ts`
  (CSV parse, HTML strip, `fiscalYear` tagging, unit heuristic, exclusions).
- **Typed loader + selectors:** `src/features/document-generation/lib/pricebook.ts` —
  `getProducts({fiscalYear})` (**defaults to FY27**), `getBocesProducts()`,
  `getVolumeProducts()`, `findBySku()`, `getCategories()`.
- **Dataset:** `src/features/document-generation/data/pricebook.json` — **173 flat**
  products (92 FY27 + 81 FY26) + **1 volume SKU** (`EK12-T1-SUPP-30-44`, 5 qty tiers).
- **20 unit/data tests** pass.

**Product shape** (note camelCase; the picker bridges to the payload's snake_case fields):
`{ sku, name, category, fiscalYear, listRate, description, unit, pricePerHour, chargedPer,
fullYear190, fullYear180 }`. Volume: `{ sku, name, category, fiscalYear, description,
tiers: [{ minQty, price }] }`.

**Import decisions (intentional — see the generator README):**
- **FY26 + FY27 both imported**, tagged `fiscalYear`; the picker **defaults to FY27** so
  reps don't quote last year's book (`{ fiscalYear: "all" }` opts into everything).
- **`Cost` dropped** (internal margin; app doesn't need it).
- **`Allocation` excluded** — it's the rep's custom/ad-hoc item, handled by the form's
  **"Add custom line item"** action, not the SKU picker.
- **$0 non-custom rows kept** (e.g. `PGC-2027`) — $0 = rep-enters-price placeholder.
- Numeric/PandaDoc-internal SKUs kept (several are real products); descriptions
  HTML-stripped; `unit` is a best-effort heuristic and **non-authoritative** (rep can override).
- Volume-priced products keep their full quantity-tier ladder.

**Refresh path (FY27→FY28):** drop next year's CSV export, re-run the generator, commit the
new `pricebook.json`, update the count snapshot in `pricebook.test.ts`.

---

## Opportunity-readiness (design constraints, not built now)

So the later drop-in is mechanical, each form field declares its future pre-fill source:

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

(Verify availability/format against `prisma/schema.prisma` `Opportunity` at build time.)

**Component contract:** `DocumentPayloadForm` accepts an optional `prefill` so the
standalone page passes `{}` and a future Opportunity-detail host passes a mapped
opportunity. No internal logic differs.

---

## Out of scope (do NOT build)

- **Submit behavior** — no API route, no Apps Script POST, no eSign / `auto_send`
  execution, no `PLAYWRIGHT_TRIGGER_URL` wiring. The form assembles + previews and stops.
- **Persistence** — payload is ephemeral; no `Quote` / `LineItem` Prisma model.
- **Auth / secrets** for the generator endpoint.
- **Physical BOCES agreement PDF merge** — generator returns `agreementUrl` only; merging
  is deferred server-side (per the BOCES spec).

---

## Suggested task sequence for the future session

1. ✅ **DONE — Pricebook imported** (`feat/document-generation-pricebook`, `fed36094`).
2. Scaffold the standalone route + nav entry + **`DocumentPayloadForm` shell**: doc-type
   selector, live JSON preview, completeness indicator, controlled `value`/`onChange`
   (+ optional `prefill`).
3. **Quote-table engine** (shared): a row model + auto-calc that both modes reuse, with
   per-mode columns (contract: SKU/Service/…/Net Rate/Total; BOCES: Product/Rate/Hours/Total),
   the SKU picker (`getProducts` FY27 default; `getBocesProducts` in BOCES mode), and the
   **"Add custom line item"** action.
4. **Full Contract mode** sections: Parties & Dates (sender via `useProfile()`), Quote,
   Payment Terms (A/B/C conditional + clear-on-hide), Sections & Pricing, Delivery.
5. **BOCES Quote mode** sections: Quote Header, Quote (fee_pct + computed fee/total),
   Payment Terms (fixed block), Sections.
6. Mobile pass (`/mobile-design`) + tokens compliance + Vitest: line-item/fee calc, and
   **per-`doc_type` payload assembly** (active payment shape only, `quote.include=false`
   omits line items, BOCES omits `auto_send`/signer, etc.).

---

## Key references

| What | Where |
|---|---|
| Full-Contract payload schema | `Docs/superpowers/specs/2026-05-29-project-sea-monkey-contract-generator-design.md` § JSON Payload Schema (~L119–155) |
| BOCES Quote payload schema (in scope) | `Docs/superpowers/specs/2026-06-04-boces-quote-document-type-design.md` § Payload Schema (~L122–157) — incl. its own `payment` block |
| Apps Script generator (PRs #254 + #261, merged) | `scripts/document-generation/appsscript/` |
| **Pricebook dataset (DONE)** | `feat/document-generation-pricebook` (`fed36094`): `src/features/document-generation/lib/pricebook.ts`, `…/data/pricebook.json`, `scripts/document-generation/pricebook/` |
| Opportunity data model | `prisma/schema.prisma` (`Opportunity`, `Session`) |
| Form pattern to mirror | `src/features/activities/components/ActivityFormModal.tsx` + `components/event-fields/` |
| UI tokens / brand | `Documentation/UI Framework/tokens.md` |

---

## Notes for the next Claude session

- **Branches in play:** this spec lives on `docs/document-generator-placeholder-spec`; the
  pricebook dataset on `feat/document-generation-pricebook` (`fed36094`). The form build
  should branch off `main` after the pricebook lands on `main`.
- The **pricebook is already imported** — Task 1 is done. Start the build at Task 2.
- Repo tracks the **capital `Docs/`** directory; a lowercase `docs/` path silently aliases
  on case-insensitive macOS — always use the capital path when adding/committing.
