# Optional Min/Max Purchase Amounts Table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the contract's "Minimum and Maximum Purchase Amounts" table optional — included by default with required values, removable with a persistent inline warning, and physically deleted from the generated doc when excluded.

**Architecture:** New `includeMinMax` form flag (default true) → checkbox + amber callout in QuoteSection → `quote.include_min_max` in the payload (amounts nulled when false) → required-when-included rule in `getCompleteness` → Apps Script removes the table by header text on explicit `false` (deploy @13). No DB or API route changes.

**Tech Stack:** React 19 + Vitest/Testing Library (form), TypeScript payload lib, Google Apps Script via clasp.

**Spec:** `Docs/superpowers/specs/2026-06-12-doc-gen-optional-minmax-table-design.md`

---

## Setup (orchestrator, before any task)

- [ ] From the main checkout: `git checkout main && git pull origin main`
- [ ] `git worktree add .worktrees/feat-doc-gen-minmax -b feat/doc-gen-optional-minmax main`
- [ ] `cd .worktrees/feat-doc-gen-minmax && git merge docs/doc-gen-minmax-spec --no-edit`
- [ ] Symlinks:
  ```bash
  MAIN="/Users/astonfurious/The Laboratory/territory-plan"
  WT="$MAIN/.worktrees/feat-doc-gen-minmax"
  ln -s "$MAIN/node_modules" "$WT/node_modules"
  for f in .env .env.local; do [ -f "$MAIN/$f" ] && ln -sf "$MAIN/$f" "$WT/$f"; done
  ln -sf "$MAIN/scripts/document-generation/appsscript/.clasp.json" "$WT/scripts/document-generation/appsscript/.clasp.json"
  ```
- [ ] Verify branch before dispatching ANY implementer: `git -C "$WT" branch --show-current` → `feat/doc-gen-optional-minmax`

## File structure

| File | Responsibility |
|------|----------------|
| `src/features/document-generation/lib/payload-types.ts` | `includeMinMax` on `DocFormState` (+ default in `emptyFormState`); `include_min_max` on `ContractPayload.quote` |
| `src/features/document-generation/lib/payload.ts` | Emit `include_min_max`; null the amounts when excluded |
| `src/features/document-generation/lib/validation.ts` | Required-when-included rule in `getCompleteness` |
| `src/features/document-generation/components/form/QuoteSection.tsx` | Checkbox, conditional inputs, amber callout, red empty-borders |
| `scripts/document-generation/appsscript/Utils.gs` | `removeTableByHeaderText(body, headerText)` helper |
| `scripts/document-generation/appsscript/Code.gs` | Call the helper when `include_min_max === false` |

---

### Task 1: Form state + payload flag

**Files:**
- Modify: `src/features/document-generation/lib/payload-types.ts` (DocFormState ~line 77, ContractPayload.quote ~line 116, emptyFormState ~line 191)
- Modify: `src/features/document-generation/lib/payload.ts` (quote block ~line 102)
- Test: `src/features/document-generation/lib/__tests__/payload.test.ts` (extend existing — read its helpers first and reuse its state-builder convention)

- [ ] **Step 1: Write the failing tests.** Add to `payload.test.ts` (adapt to the file's existing `baseState`/builder helper — do not fork a new convention):

```ts
  it("emits include_min_max true with the amounts by default", () => {
    const p = assemblePayload(makeContractState({ minAmt: 1000, maxAmt: 5000 }));
    expect(p.quote).toMatchObject({ include_min_max: true, min_amt: 1000, max_amt: 5000 });
  });

  it("nulls the amounts and emits include_min_max false when excluded", () => {
    const p = assemblePayload(
      makeContractState({ includeMinMax: false, minAmt: 1000, maxAmt: 5000 }),
    );
    expect(p.quote).toMatchObject({ include_min_max: false, min_amt: null, max_amt: null });
  });
```

(If the file has no contract-state factory, follow however its existing min_amt assertions build state.)

- [ ] **Step 2: Run to verify failure:** `npx vitest run src/features/document-generation/lib/__tests__/payload.test.ts`
Expected: FAIL — `include_min_max` undefined (TS may also reject `includeMinMax` on the state literal).

- [ ] **Step 3: Add the state field.** In `payload-types.ts`:
  - `DocFormState`, next to `minAmt`/`maxAmt`:

```ts
  includeMinMax: boolean; // contract Min/Max Purchase Amounts table (default include)
```

  - `emptyFormState`, next to `minAmt: null`:

```ts
    includeMinMax: true,
```

  - `ContractPayload.quote`, next to `min_amt`:

```ts
    include_min_max: boolean;
```

  Check whether `BocesQuotePayload`'s quote type shares the same literal shape: if the quote object in `payload.ts` is built once for both doc types, add `include_min_max: boolean` to the BOCES quote type too (it will carry the inert default `true`); if BOCES builds its own quote, leave it untouched (absent flag = include, backward-compatible).

- [ ] **Step 4: Emit in `payload.ts`** (quote block, next to the existing `min_amt` line):

```ts
      include_min_max: state.includeMinMax,
      min_amt: state.includeMinMax ? state.minAmt : null,
      max_amt: state.includeMinMax ? state.maxAmt : null,
```

- [ ] **Step 5: Run to verify pass:** `npx vitest run src/features/document-generation/lib/__tests__/payload.test.ts src/features/document-generation/lib/__tests__/payload-types.test.ts`
Expected: PASS (existing emptyFormState assertions may need the new key added — that's a legitimate update, not a regression).

- [ ] **Step 6: Commit**

```bash
git add src/features/document-generation/lib/payload-types.ts src/features/document-generation/lib/payload.ts src/features/document-generation/lib/__tests__/
git commit -m "feat(doc-gen): includeMinMax form flag + include_min_max payload emission"
```

---

### Task 2: Required-when-included validation

**Files:**
- Modify: `src/features/document-generation/lib/validation.ts` (`getCompleteness`, inside the existing `if (state.docType === "contract")` block ~line 43)
- Test: `src/features/document-generation/lib/__tests__/validation.test.ts` (extend existing)

- [ ] **Step 1: Write the failing tests** (reuse the file's existing complete-state fixture; ensure it sets `includeMinMax: true, minAmt: <number>, maxAmt: <number>` so prior tests stay green):

```ts
  it("requires min and max amounts when the table is included", () => {
    const r = getCompleteness(completeContractState({ minAmt: null, maxAmt: null }));
    expect(r.missing).toContain("Minimum purchase amount");
    expect(r.missing).toContain("Maximum district budget");
    expect(r.isComplete).toBe(false);
  });

  it("does not require the amounts when the table is excluded", () => {
    const r = getCompleteness(
      completeContractState({ includeMinMax: false, minAmt: null, maxAmt: null }),
    );
    expect(r.missing).not.toContain("Minimum purchase amount");
    expect(r.missing).not.toContain("Maximum district budget");
  });
```

- [ ] **Step 2: Run to verify failure:** `npx vitest run src/features/document-generation/lib/__tests__/validation.test.ts`

- [ ] **Step 3: Implement** — inside the `if (state.docType === "contract") { ... }` block of `getCompleteness`:

```ts
    if (state.includeMinMax) {
      if (state.minAmt == null) missing.push("Minimum purchase amount");
      if (state.maxAmt == null) missing.push("Maximum district budget");
    }
```

- [ ] **Step 4: Run the full lib suite:** `npx vitest run src/features/document-generation/lib`
Expected: PASS — if pre-existing validation tests fail because their fixtures lack min/max, set `minAmt`/`maxAmt` in the shared fixture (they model a "complete" form, which now includes the amounts).

- [ ] **Step 5: Commit**

```bash
git add src/features/document-generation/lib/validation.ts src/features/document-generation/lib/__tests__/validation.test.ts
git commit -m "feat(doc-gen): min/max amounts required while the table is included"
```

---

### Task 3: QuoteSection UI

**Files:**
- Modify: `src/features/document-generation/components/form/QuoteSection.tsx` (the `!isBoces` min/max block, ~lines 150-165)
- Test: `src/features/document-generation/components/form/__tests__/QuoteSection.test.tsx` (extend existing — read its render helper/props convention first)

- [ ] **Step 1: Write the failing tests** (adapt to the file's existing render helper):

```tsx
  it("shows the include checkbox checked by default with both inputs", () => {
    renderQuote({ docType: "contract" });
    expect(
      screen.getByRole("checkbox", { name: /Include Minimum & Maximum Purchase Amounts table/ }),
    ).toBeChecked();
    expect(screen.getByLabelText("Minimum purchase")).toBeInTheDocument();
    expect(screen.getByLabelText("Maximum budget")).toBeInTheDocument();
  });

  it("hides the inputs and shows the warning when unchecked", () => {
    renderQuote({ docType: "contract", includeMinMax: false });
    expect(screen.queryByLabelText("Minimum purchase")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Maximum budget")).not.toBeInTheDocument();
    expect(screen.getByText(/will be removed from this contract/)).toBeInTheDocument();
  });

  it("toggling emits includeMinMax without clearing the stored amounts", () => {
    const onChange = renderQuote({ docType: "contract", minAmt: 1000, maxAmt: 5000 });
    fireEvent.click(
      screen.getByRole("checkbox", { name: /Include Minimum & Maximum Purchase Amounts table/ }),
    );
    expect(onChange).toHaveBeenCalledWith({ includeMinMax: false });
  });

  it("marks empty required amounts with the alert border when included", () => {
    renderQuote({ docType: "contract", minAmt: null, maxAmt: null });
    expect(screen.getByLabelText("Minimum purchase").className).toContain("border-[#F37167]");
    expect(screen.getByLabelText("Maximum budget").className).toContain("border-[#F37167]");
  });

  it("renders no min/max controls for BOCES", () => {
    renderQuote({ docType: "boces_quote" });
    expect(
      screen.queryByRole("checkbox", { name: /Include Minimum & Maximum Purchase Amounts table/ }),
    ).not.toBeInTheDocument();
  });
```

(The toggle test asserts the patch is ONLY `{ includeMinMax: false }` — values stay in state untouched.)

- [ ] **Step 2: Run to verify failure:** `npx vitest run src/features/document-generation/components/form/__tests__/QuoteSection.test.tsx`

- [ ] **Step 3: Implement.** Replace the existing `!isBoces` min/max block in `QuoteSection.tsx` with:

```tsx
      {!isBoces && (
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm whitespace-nowrap">
            <input
              type="checkbox"
              checked={state.includeMinMax}
              onChange={(e) => onChange({ includeMinMax: e.target.checked })}
            />
            Include Minimum &amp; Maximum Purchase Amounts table
          </label>
          {state.includeMinMax ? (
            <div className="flex flex-wrap gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-xs uppercase tracking-wide text-[#6E6390]">Minimum purchase ($)</span>
                <input type="number" aria-label="Minimum purchase" value={state.minAmt ?? ""}
                  onChange={(e) => onChange({ minAmt: e.target.value === "" ? null : Number(e.target.value) })}
                  className={`rounded border px-2 py-1 text-sm ${state.minAmt == null ? "border-[#F37167]" : "border-[#C2BBD4]"}`} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs uppercase tracking-wide text-[#6E6390]">Maximum budget ($)</span>
                <input type="number" aria-label="Maximum budget" value={state.maxAmt ?? ""}
                  onChange={(e) => onChange({ maxAmt: e.target.value === "" ? null : Number(e.target.value) })}
                  className={`rounded border px-2 py-1 text-sm ${state.maxAmt == null ? "border-[#F37167]" : "border-[#C2BBD4]"}`} />
              </label>
            </div>
          ) : (
            <div role="status" className="rounded-lg border border-[#ffd98d] bg-[#fffaf1] px-3 py-2 text-sm text-[#997c43]">
              The Minimum &amp; Maximum Purchase Amounts table will be removed from this contract — it won&apos;t
              document a minimum commitment or a &quot;Pay As You Need&quot; budget ceiling. Re-check to restore it.
            </div>
          )}
        </div>
      )}
```

- [ ] **Step 4: Run the form + lib suites:** `npx vitest run src/features/document-generation`
Expected: PASS (fix any pre-existing QuoteSection/DocumentPayloadForm fixtures that now need `includeMinMax`/amount values for completeness — same fixture rule as Task 2).

- [ ] **Step 5: Commit**

```bash
git add src/features/document-generation/components/form
git commit -m "feat(doc-gen): min/max include checkbox with removal warning + required borders"
```

---

### Task 4: Apps Script table removal (orchestrator-supervised — live deploy)

**Files:**
- Modify: `scripts/document-generation/appsscript/Utils.gs`
- Modify: `scripts/document-generation/appsscript/Code.gs` (after `handleQuoteSection`, ~line 53)

- [ ] **Step 1: Add the helper to `Utils.gs`** (near `deleteMarkerParagraph`):

```js
/**
 * Removes the first body TABLE whose top-left cell text equals headerText
 * (trimmed). Also removes one immediately-following empty paragraph so no
 * stray gap is left. Logs and no-ops when the table isn't found — a missing
 * table must never fail the render.
 */
function removeTableByHeaderText(body, headerText) {
  for (var i = 0; i < body.getNumChildren(); i++) {
    var child = body.getChild(i);
    if (child.getType() !== DocumentApp.ElementType.TABLE) continue;
    var table = child.asTable();
    if (table.getNumRows() === 0 || table.getRow(0).getNumCells() === 0) continue;
    if (table.getRow(0).getCell(0).getText().trim() !== headerText) continue;

    // Remove a trailing empty spacer paragraph first (index shifts on removal).
    if (i + 1 < body.getNumChildren()) {
      var next = body.getChild(i + 1);
      if (next.getType() === DocumentApp.ElementType.PARAGRAPH &&
          next.asParagraph().getText().trim() === '') {
        body.removeChild(next);
      }
    }
    body.removeChild(table);
    return true;
  }
  Logger.log('removeTableByHeaderText: no table found with header "' + headerText + '"');
  return false;
}
```

- [ ] **Step 2: Call it from `Code.gs`** — in `generateFullContract`, directly after `handleQuoteSection(body, payload.quote);`:

```js
    // Optional Min/Max table: delete only on explicit false so old payloads
    // and editor tests (no flag) keep rendering it.
    if (payload.quote && payload.quote.include_min_max === false) {
      removeTableByHeaderText(body, 'Minimum and Maximum Purchase Amounts');
    }
```

- [ ] **Step 3: Push + deploy @13** (orchestrator runs this; `.clasp.json` symlinked in Setup):

```bash
cd scripts/document-generation/appsscript
npx clasp push
npx clasp deploy -i AKfycby0oFEDEj77XpMNNZaB9WpOVsHoUBeY1Nsa2nJbvU5J3nyfnTYSmvQHJgh9DdCtoTsy -d "Optional min/max table (include_min_max)"
npx clasp deployments   # confirm @13
```

- [ ] **Step 4: Commit**

```bash
git add scripts/document-generation/appsscript/Utils.gs scripts/document-generation/appsscript/Code.gs
git commit -m "feat(appsscript): remove min/max table on include_min_max false (deploy @13)"
```

---

### Task 5: Verification + PR (PR is OPENED, never merged — the user merges on GitHub)

- [ ] **Step 1: Suites + lint:**

```bash
npx vitest run src/features/document-generation
git diff --name-only main -- '*.ts' '*.tsx' | xargs npx eslint
```

Expected: all green / no errors (full-tree eslint OOMs — changed files only).

- [ ] **Step 2: Live render check** (dev server on 3005 from the worktree; ensure the prod Admin toggle is in **Test Mode** before any send — though this task only RENDERS, which is free):
  1. Render a contract with the checkbox **on** + both amounts filled → doc shows the table with formatted amounts.
  2. Uncheck → amber warning appears in the form; render again → doc has **no** Min/Max table and no stray gap above the payment terms.
  3. Confirm the missing-fields chips block render when included + blank.
- [ ] **Step 3: Push and open the PR** against `main` (spec + plan ride along via the merged docs branch). Body: feature summary, @13 note, backward-compat note (old payloads unaffected). **Do NOT merge — end with the PR link for the user.**

---

## Self-review notes (already applied)

- Spec §1-§6 ↔ Tasks 1-5 one-to-one; warning copy and checkbox label match the spec verbatim.
- `includeMinMax` (state) vs `include_min_max` (payload) used consistently; Apps Script reads `payload.quote.include_min_max === false` only.
- Red-border uses the Error semantic token (#F37167) consistent with RequiredDateInput's empty treatment.
- Toggle patch is `{ includeMinMax: boolean }` only — amounts persist in state; payload nulls them at assembly time instead.
