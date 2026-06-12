# Doc-Gen — Optional Min/Max Purchase Amounts Table (Design)

**Date:** 2026-06-12
**Status:** Draft — pending user review
**Scope:** Contract doc type only. BOCES quotes are untouched (they have no
min/max inputs and the table exists only in the contract template).

## Problem

The contract template contains a fixed "Minimum and Maximum Purchase Amounts"
table (`<<min_amt>>` / `<<max_amt>>`). Today it always renders. The form's two
inputs (Quote section, contracts only) are optional, so a rep who leaves them
blank ships a contract with an empty min/max table — the long-standing
"blank min/max" wart. There is no way to send a contract without the table.

## Decisions (locked in brainstorm, 2026-06-12)

| Decision | Choice |
|----------|--------|
| Control placement | Checkbox directly above the two inputs in the Quote section (not the Sections toggles list) |
| Default | Included (checked) — matches today's output |
| Warning on removal | Persistent inline amber callout replacing the inputs (no confirm dialog) |
| Validation | **Required when included**: both values must be filled to render/send; excluding the table is the legitimate no-min/max path |
| Apps Script removal mechanism | Find-by-header body scan (no template edit) |

## 1. Form (QuoteSection)

- New `DocFormState` field: `includeMinMax: boolean`, default `true`
  (`emptyFormState`).
- In the existing `!isBoces` block of
  `src/features/document-generation/components/form/QuoteSection.tsx`:
  - Checkbox labeled **"Include Minimum & Maximum Purchase Amounts table"**,
    checked by default, above the two inputs.
  - Checked → the Minimum purchase / Maximum budget inputs render as today.
  - Unchecked → the inputs are hidden and replaced by a persistent amber
    callout (warning tokens: `border-[#ffd98d] bg-[#fffaf1] text-[#997c43]`,
    `role="status"`):
    > The Minimum & Maximum Purchase Amounts table will be removed from this
    > contract — it won't document a minimum commitment or a "Pay As You Need"
    > budget ceiling. Re-check to restore it.
  - `minAmt`/`maxAmt` values are **preserved in form state** while unchecked;
    re-checking restores whatever was typed.

## 2. Validation — required when included

- Contract + `includeMinMax === true` ⇒ `minAmt` and `maxAmt` are **required**:
  empty inputs get the same red-border + missing-fields alert-chip treatment as
  the other required inputs (existing mechanism from the SP5 polish wave —
  implementation plan locates the exact chip/validation seam in
  `validation.ts` / `DocumentPayloadForm`).
- Contract + `includeMinMax === false` ⇒ no min/max validation.
- This permanently retires the blank-table contract output: every rendered
  contract either has a fully populated min/max table or no table at all.

## 3. Payload

- `quote.include_min_max: boolean` added to the quote payload object
  (`payload-types.ts` + `payload.ts`).
- When `false`, `min_amt` and `max_amt` are emitted as `null` (regardless of
  preserved form state).
- BOCES payloads omit the flag entirely (amended post-implementation: the BOCES
  quote object is a separate type with no min/max fields at all; Apps Script only
  acts on explicit `false`, so absence is equivalently inert).
- No DB changes: the flag lives in the payload JSONB (registry-excluded), and
  min/max were never promoted columns. No API route changes — the payload
  passes through render/send untouched.

## 4. Apps Script (deploy @13)

- In the contract generation path (`Code.gs` / table helpers): when
  `payload.quote.include_min_max === false`, scan the document body for the
  table whose first cell text equals **"Minimum and Maximum Purchase Amounts"**
  and remove it; also remove an immediately-adjacent empty spacer paragraph if
  one exists so no gap is left.
- If the table is not found, log a warning and continue (never fail the
  render).
- **Backward compatible:** deletion happens only on explicit `false`. Old
  payloads / editor tests without the flag render the table exactly as today.
- Mechanism rationale: find-by-header needs no edit to the live template doc
  (vs. the `[MARKER]` paragraph pattern used by the payment-terms block, which
  would require template coordination and a keep-path cleanup). Header text is
  stable template copy.
- Ship: `clasp push` + `clasp deploy -i AKfycby0…oTsy` → **@13**.

## 5. Testing

- **Form tests (QuoteSection):** default checked; unchecking hides both inputs
  and shows the callout; re-checking restores preserved values; checkbox absent
  for BOCES.
- **Payload tests:** flag emitted true/false; amounts nulled when excluded;
  amounts pass through when included.
- **Validation tests:** included + blank → missing-fields chips include
  min/max and render/send is blocked; excluded + blank → no chips.
- **Apps Script (live, post-@13):** one render with `include_min_max: false`
  (table absent, no stray gap), one with the flag `true` and one with the flag
  absent (table present, amounts formatted).

## 6. Out of scope

- BOCES template/quote behavior.
- Any change to the payment-terms block or other template tables.
- Promoting `include_min_max` to a DB column (payload JSONB only).
