# Project Sea Monkey — Contract Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Google Apps Script web app (via CLASP) that generates fully-populated Fullmind contract Google Docs from a JSON payload, with six incremental build phases ending in a deployable web app endpoint.

**Architecture:** A standalone Apps Script project in `scripts/document-generation/appsscript/`, version-controlled with CLASP. The script copies a base template Google Doc, replaces `<<merge_fields>>`, builds a dynamic quote table from scratch, selects one of three payment term blocks, and appends sub-template docs from Google Drive. Returns `{ success, url, docId }`. An `auto_send` flag optionally POSTs to a Playwright trigger URL for immediate eSign dispatch.

**Tech Stack:** Google Apps Script (V8 runtime), CLASP CLI (`@google/clasp`), Google Docs Service, Google Drive Service, GmailApp

**Reference files — read before implementing:**
- `Fullmind_AppScript_Build_Reference.md` in Desktop/Work Documents/Project Sea Monkey/ — complete function specs
- `docs/superpowers/specs/2026-05-29-project-sea-monkey-contract-generator-design.md` — design decisions

**Branch:** `feat/document-generation-poc` — all commits go here

---

## File Map

| File | Responsibility |
|---|---|
| `appsscript.json` | Manifest: OAuth scopes, timezone, webapp config |
| `.clasp.json` | Links local folder to Drive script project (gitignored) |
| `Code.gs` | Entry points: `doPost(e)` and `generateContract(payload)` |
| `Config.gs` | Script property key constants + `initScriptProperties()` setup |
| `Utils.gs` | Shared helpers: `findParagraphIndex`, `deleteMarkerParagraph`, `deleteBetweenMarkers`, `appendDocContent`, `formatCurrency`, `escapeRegex` |
| `MergeFields.gs` | `replaceMergeFields(body, payload)` — all `<<FIELD>>` token replacement |
| `PaymentTerms.gs` | `handlePaymentTerms(body, payment)` — keeps one of A/B/C, deletes others |
| `QuoteTable.gs` | `handleQuoteSection(body, quote)` + `buildQuoteTableFromScratch(body, quote)` |
| `AppendedSections.gs` | `handleAppendedSections(doc, sections, props)` — SOW, staffing, pricing, MSA |
| `SampleData.gs` | Three test payloads: `PAYLOAD_FULL`, `PAYLOAD_NO_QUOTE`, `PAYLOAD_BOCES_ONLY` |
| `Tests.gs` | Test runner for pure utility functions |

---

## Task 1: CLASP Setup + Project Scaffolding

**Files:**
- Create: `scripts/document-generation/appsscript/` (new folder)
- Create: `scripts/document-generation/appsscript/appsscript.json`
- Modify: `.gitignore` (add `.clasp.json`)

- [ ] **Step 1: Check out the PoC branch**

```bash
git checkout feat/document-generation-poc
```

- [ ] **Step 2: Install CLASP globally**

```bash
npm install -g @google/clasp
```

Expected: `added N packages` — no errors.

- [ ] **Step 3: Authenticate CLASP**

```bash
clasp login
```

Expected: browser opens → log in with your Fullmind Google account → terminal shows "Logged in!"

- [ ] **Step 4: Create the appsscript folder**

```bash
mkdir -p "/Users/astonfurious/The Laboratory/territory-plan/scripts/document-generation/appsscript"
cd "/Users/astonfurious/The Laboratory/territory-plan/scripts/document-generation/appsscript"
```

- [ ] **Step 5: Create a new Apps Script project in Google Drive**

Go to https://script.google.com → click **New project** → name it `Fullmind Contract Generator`.

Copy the project ID from the URL:
`https://script.google.com/home/projects/{PROJECT_ID}/edit`

- [ ] **Step 6: Create `.clasp.json`**

Create `scripts/document-generation/appsscript/.clasp.json` with your actual project ID:

```json
{
  "scriptId": "YOUR_PROJECT_ID_HERE",
  "rootDir": "."
}
```

- [ ] **Step 7: Create `appsscript.json`**

Create `scripts/document-generation/appsscript/appsscript.json`:

```json
{
  "timeZone": "America/New_York",
  "dependencies": {},
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "webapp": {
    "executeAs": "USER_DEPLOYING",
    "access": "ANYONE"
  },
  "oauthScopes": [
    "https://www.googleapis.com/auth/documents",
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/gmail.send"
  ]
}
```

- [ ] **Step 8: Add `.clasp.json` to `.gitignore`**

Open `/Users/astonfurious/The Laboratory/territory-plan/.gitignore` and add:

```
# Apps Script CLASP project link (contains personal script ID)
scripts/document-generation/appsscript/.clasp.json
```

- [ ] **Step 9: Create stub `.gs` files**

Create each file with just a comment:

`Code.gs`:
```javascript
// Entry points: doPost(e) and generateContract(payload)
```

`Config.gs`:
```javascript
// Script property key constants and initScriptProperties()
```

`Utils.gs`:
```javascript
// Shared document manipulation helpers
```

`MergeFields.gs`:
```javascript
// replaceMergeFields(body, payload)
```

`PaymentTerms.gs`:
```javascript
// handlePaymentTerms(body, payment)
```

`QuoteTable.gs`:
```javascript
// handleQuoteSection(body, quote) + buildQuoteTableFromScratch(body, quote)
```

`AppendedSections.gs`:
```javascript
// handleAppendedSections(doc, sections, props)
```

`SampleData.gs`:
```javascript
// Test payloads: PAYLOAD_FULL, PAYLOAD_NO_QUOTE, PAYLOAD_BOCES_ONLY
```

`Tests.gs`:
```javascript
// Test runner for pure utility functions
```

- [ ] **Step 10: Push to Google Drive**

```bash
cd "/Users/astonfurious/The Laboratory/territory-plan/scripts/document-generation/appsscript"
clasp push
```

Expected output:
```
└─ appsscript.json
└─ Code.gs
└─ Config.gs
...
Pushed 9 files.
```

Open the script project at script.google.com and confirm all files appear.

- [ ] **Step 11: Commit**

```bash
git add scripts/document-generation/appsscript/ .gitignore
git commit -m "feat(sea-monkey): scaffold CLASP project + appsscript.json"
```

---

## Task 2: Google Drive Folder Structure

This task is manual — no code. You are creating folders in Google Drive and recording their IDs.

- [ ] **Step 1: Create the folder tree**

In Google Drive, create this structure (each indented item is a subfolder):

```
Fullmind Templates/
  base/
  sow/
  staffing/
  pricing/
  msa/
  _output/
```

- [ ] **Step 2: Record each folder ID**

For each folder, open it in Drive and copy the ID from the URL:
`https://drive.google.com/drive/folders/{FOLDER_ID}`

Record these — you will need them in Task 5:

| Folder | ID |
|---|---|
| `base/` | _(copy from URL)_ |
| `sow/` | _(copy from URL)_ |
| `staffing/` | _(copy from URL)_ |
| `pricing/` | _(copy from URL)_ |
| `msa/` | _(copy from URL)_ |
| `_output/` | _(copy from URL)_ |

No commit for this task — Drive folder IDs are recorded in script properties (Task 5).

---

## Task 3: Utils.gs — Pure Utility Functions (TDD)

**Files:**
- Modify: `scripts/document-generation/appsscript/Tests.gs`
- Modify: `scripts/document-generation/appsscript/Utils.gs`

- [ ] **Step 1: Write failing tests in `Tests.gs`**

```javascript
function runUtilTests() {
  testFormatCurrency();
  testEscapeRegex();
  Logger.log('✅ All util tests passed.');
}

function testFormatCurrency() {
  var cases = [
    { input: 1234.5,   expected: '$1,234.50' },
    { input: 0,        expected: '$0.00'     },
    { input: 99999.99, expected: '$99,999.99'},
    { input: null,     expected: ''          },
  ];
  cases.forEach(function(c) {
    var result = formatCurrency(c.input);
    if (result !== c.expected) {
      throw new Error('formatCurrency(' + c.input + '): expected "' + c.expected + '", got "' + result + '"');
    }
  });
  Logger.log('  ✅ testFormatCurrency passed');
}

function testEscapeRegex() {
  var cases = [
    { input: '<<Client_First>>', expected: '\\<\\<Client_First\\>\\>' },
    { input: '{{MARKER}}',       expected: '\\{\\{MARKER\\}\\}'       },
    { input: 'plain text',       expected: 'plain text'               },
  ];
  cases.forEach(function(c) {
    var result = escapeRegex(c.input);
    if (result !== c.expected) {
      throw new Error('escapeRegex("' + c.input + '"): expected "' + c.expected + '", got "' + result + '"');
    }
  });
  Logger.log('  ✅ testEscapeRegex passed');
}
```

- [ ] **Step 2: Push and run to verify tests fail**

```bash
clasp push
```

In the script editor: select `runUtilTests` from the function dropdown → click **Run**.

Expected: execution log shows `ReferenceError: formatCurrency is not defined`

- [ ] **Step 3: Implement pure utility functions in `Utils.gs`**

```javascript
/**
 * Formats a number as USD currency string. Returns '' for null/undefined.
 * @param {number|null} amount
 * @returns {string}
 */
function formatCurrency(amount) {
  if (amount == null) return '';
  return '$' + Number(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/**
 * Escapes regex special characters so a string can be safely passed
 * to body.replaceText() as the search pattern.
 * @param {string} str
 * @returns {string}
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
```

- [ ] **Step 4: Push and run tests to verify they pass**

```bash
clasp push
```

Select `runUtilTests` → **Run**.

Expected execution log:
```
  ✅ testFormatCurrency passed
  ✅ testEscapeRegex passed
✅ All util tests passed.
```

- [ ] **Step 5: Commit**

```bash
git add scripts/document-generation/appsscript/
git commit -m "feat(sea-monkey): Utils.gs pure utility functions + tests"
```

---

## Task 4: Utils.gs — Document Manipulation Helpers

**Files:**
- Modify: `scripts/document-generation/appsscript/Utils.gs`

These functions operate on a live Google Doc body and are verified through integration testing (visual doc inspection) in later tasks. Add them to `Utils.gs` now.

- [ ] **Step 1: Add document helpers to `Utils.gs`**

Append to the existing `Utils.gs` content:

```javascript
/**
 * Returns the body child index of the first paragraph containing searchText.
 * Only searches direct body children — markers inside tables are not found
 * (intentional: all {{MARKERS}} must be standalone paragraphs, not in cells).
 * Returns -1 if not found.
 * @param {GoogleAppsScript.Document.Body} body
 * @param {string} searchText
 * @returns {number}
 */
function findParagraphIndex(body, searchText) {
  var n = body.getNumChildren();
  for (var i = 0; i < n; i++) {
    var child = body.getChild(i);
    if (child.getType() === DocumentApp.ElementType.PARAGRAPH) {
      if (child.asText().getText().indexOf(searchText) !== -1) {
        return i;
      }
    }
  }
  return -1;
}

/**
 * Removes the paragraph containing markerText. Safe to call if not found.
 * @param {GoogleAppsScript.Document.Body} body
 * @param {string} markerText
 */
function deleteMarkerParagraph(body, markerText) {
  var idx = findParagraphIndex(body, markerText);
  if (idx >= 0) {
    body.getChild(idx).removeFromParent();
  }
}

/**
 * Deletes all body children from startMarker paragraph through endMarker
 * paragraph (inclusive). Deletes from end backwards to preserve indices.
 * Logs a warning if either marker is not found.
 * @param {GoogleAppsScript.Document.Body} body
 * @param {string} startMarker
 * @param {string} endMarker
 */
function deleteBetweenMarkers(body, startMarker, endMarker) {
  var startIdx = findParagraphIndex(body, startMarker);
  var endIdx   = findParagraphIndex(body, endMarker);

  if (startIdx === -1 || endIdx === -1) {
    Logger.log('Warning: markers not found — start:' + startMarker + ' (' + startIdx + '), end:' + endMarker + ' (' + endIdx + ')');
    return;
  }
  if (startIdx > endIdx) {
    Logger.log('Warning: start marker (' + startIdx + ') appears after end marker (' + endIdx + ')');
    return;
  }
  for (var i = endIdx; i >= startIdx; i--) {
    body.getChild(i).removeFromParent();
  }
}

/**
 * Appends the full content of sourceDocId into targetDoc,
 * replacing the paragraph that contains placeholderText.
 * Adds a page break before the appended content.
 * @param {GoogleAppsScript.Document.Document} targetDoc
 * @param {string} sourceDocId
 * @param {string} placeholderText
 */
function appendDocContent(targetDoc, sourceDocId, placeholderText) {
  var targetBody = targetDoc.getBody();
  var sourceDoc  = DocumentApp.openById(sourceDocId);
  var sourceBody = sourceDoc.getBody();

  var placeholderIdx = findParagraphIndex(targetBody, placeholderText);
  if (placeholderIdx >= 0) {
    targetBody.getChild(placeholderIdx).removeFromParent();
  }

  targetBody.appendPageBreak();

  var n = sourceBody.getNumChildren();
  for (var i = 0; i < n; i++) {
    var child = sourceBody.getChild(i);
    var type  = child.getType();

    if (type === DocumentApp.ElementType.PARAGRAPH) {
      var para    = child.asParagraph();
      var newPara = targetBody.appendParagraph(para.copy());
      newPara.setHeading(para.getHeading());
    } else if (type === DocumentApp.ElementType.TABLE) {
      targetBody.appendTable(child.asTable().copy());
    } else if (type === DocumentApp.ElementType.LIST_ITEM) {
      var item    = child.asListItem();
      var newItem = targetBody.appendListItem(item.copy());
      newItem.setGlyphType(item.getGlyphType());
      newItem.setNestingLevel(item.getNestingLevel());
    }
  }
}
```

- [ ] **Step 2: Push**

```bash
clasp push
```

Expected: `Pushed N files.` with no errors.

- [ ] **Step 3: Commit**

```bash
git add scripts/document-generation/appsscript/Utils.gs
git commit -m "feat(sea-monkey): Utils.gs document manipulation helpers"
```

---

## Task 5: Config.gs + Script Properties Setup

**Files:**
- Modify: `scripts/document-generation/appsscript/Config.gs`

- [ ] **Step 1: Write `Config.gs`**

```javascript
// ─── Script property keys ────────────────────────────────────────────────────
// All Drive file IDs and config values live in PropertiesService, never
// hardcoded. Run initScriptProperties() once after creating Drive assets.
// ─────────────────────────────────────────────────────────────────────────────

var PROP = {
  TEMPLATE_BASE_ID:      'TEMPLATE_BASE_ID',
  SOW_LIVESTREAM_ID:     'SOW_LIVESTREAM_ID',
  SOW_INSTRUCTION_ID:    'SOW_INSTRUCTION_ID',
  STAFFING_ID:           'STAFFING_ID',
  PRICING_EK12_ID:       'PRICING_EK12_ID',
  PRICING_LIVESTAFF_ID:  'PRICING_LIVESTAFF_ID',
  PRICING_HOURLY_ID:     'PRICING_HOURLY_ID',
  PRICING_BOCES_ID:      'PRICING_BOCES_ID',
  MSA_ID:                'MSA_ID',
  OUTPUT_FOLDER_ID:      'OUTPUT_FOLDER_ID',
  PLAYWRIGHT_TRIGGER_URL: 'PLAYWRIGHT_TRIGGER_URL',
};

/**
 * One-time setup: stores all Drive file IDs as script properties.
 * Run this manually in the editor after uploading all Drive assets.
 * Re-run anytime a file ID changes. Safe to run multiple times.
 */
function initScriptProperties() {
  PropertiesService.getScriptProperties().setProperties({
    // ── Fill in these IDs after uploading files to Drive ──────────────────
    [PROP.TEMPLATE_BASE_ID]:      '',  // base/Fullmind_Contract_Template_v1
    [PROP.SOW_LIVESTREAM_ID]:     '',  // sow/SOW_LiveStreaming
    [PROP.SOW_INSTRUCTION_ID]:    '',  // sow/SOW_InstructionalServices
    [PROP.STAFFING_ID]:           '',  // staffing/StaffingTypeDescriptions
    [PROP.PRICING_EK12_ID]:       '',  // pricing/PricingSheet_EK12
    [PROP.PRICING_LIVESTAFF_ID]:  '',  // pricing/PricingSheet_LiveStaffing
    [PROP.PRICING_HOURLY_ID]:     '',  // pricing/PricingSheet_Hourly
    [PROP.PRICING_BOCES_ID]:      '',  // pricing/PricingSheet_BOCES
    [PROP.MSA_ID]:                '',  // msa/MasterServicesAgreement
    [PROP.OUTPUT_FOLDER_ID]:      '',  // _output/
    [PROP.PLAYWRIGHT_TRIGGER_URL]: '', // leave blank until TP endpoint exists
  });
  Logger.log('Script properties set. Verify with: PropertiesService.getScriptProperties().getProperties()');
}

/**
 * Helper to read all properties — run in editor to verify IDs are set.
 */
function logScriptProperties() {
  var props = PropertiesService.getScriptProperties().getProperties();
  Object.keys(props).sort().forEach(function(key) {
    Logger.log(key + ': ' + (props[key] || '(empty)'));
  });
}
```

- [ ] **Step 2: Push**

```bash
clasp push
```

- [ ] **Step 3: Commit**

```bash
git add scripts/document-generation/appsscript/Config.gs
git commit -m "feat(sea-monkey): Config.gs with script property keys and setup"
```

---

## Task 6: Prepare the Base Template Google Doc (Manual)

This task is entirely manual work in Google Docs. Take your time — getting the template right is the foundation everything else depends on.

**Source file:** `Fullmind_Contract_Template_v1.docx`

- [ ] **Step 1: Upload and convert**

1. Go to Google Drive → `Fullmind Templates/base/` folder
2. Upload `Fullmind_Contract_Template_v1.docx`
3. Right-click the uploaded file → **Open with Google Docs** (this creates a Google Doc copy)
4. Rename it to `Fullmind_Contract_Template_v1`
5. Record its file ID from the URL bar

- [ ] **Step 2: Replace variable text with merge fields**

Find and replace each piece of variable text with the corresponding `<<FIELD>>` token. Use **Edit → Find and replace** (⌘H) for each:

| Replace this text | With this token |
|---|---|
| Sender's first name | `<<Sender_First>>` |
| Sender's last name | `<<Sender_Last>>` |
| Sender's title | `<<Sender_Title>>` |
| Sender's email | `<<Sender_Email>>` |
| Client's first name | `<<Client_First>>` |
| Client's last name | `<<Client_Last>>` |
| Client's title | `<<Client_Title>>` |
| District/company name | `<<Client_Company>>` |
| Client's email | `<<Client_Email>>` |
| Contract start date | `<<start_date>>` |
| Contract end date | `<<end_date>>` |
| Signer's salutation | `<<Signer_Salut>>` |
| Signer's first name | `<<Signer_First>>` |
| Signer's last name | `<<Signer_Last>>` |
| Signer's title | `<<Signer_Title>>` |
| Today's date | `<<today>>` |
| Minimum purchase amount | `<<min_amt>>` |
| Maximum district budget | `<<max_amt>>` |
| Payment terms value | `<<pay_terms>>` |
| Invoice date value | `<<invoice_date>>` |
| Contract end date (in payment block) | `<<contract_end>>` |
| Unused funds behavior | `<<unused_funds>>` |
| Billing contact name | `<<billing_name>>` |
| Billing address | `<<billing_add>>` |
| Billing email | `<<billing_email>>` |
| Billing phone | `<<billing_phone>>` |

- [ ] **Step 3: Add the PO checkbox field**

Find the purchase order checkbox area. Replace the checkbox symbol with `<<po_yn>>` — the script will replace it with `☑` or `☐` at runtime.

- [ ] **Step 4: Add conditional payment term fields**

In the Payment Type B block, find the fields for additional terms and replace:
- Additional payment terms text → `<<add_terms>>`
- Program implementation details → `<<imp_detail>>`

In the Payment Type C / BOCES block:
- Pre/post pay type → `<<pay_prepost>>`
- BOCES name → `<<boces_name>>`
- PO number → `<<po_number>>`

- [ ] **Step 5: Add the quote section markers + placeholder table**

At the position where the quote table should appear, insert a new paragraph before the quote content:

```
{{QUOTE_SECTION_START}}
```

After the quote content, insert:
```
{{QUOTE_SECTION_END}}
```

Inside the section (between the two markers), insert a simple 1-row, 1-column table containing only the text:
```
[QUOTE_ROW_1_SERVICE]
```

This placeholder table is what `buildQuoteTableFromScratch()` locates and replaces.

**To format all marker paragraphs as invisible (white 1pt text):**
1. Select the marker text (e.g. `{{QUOTE_SECTION_START}}`)
2. Font size → type `1` → Enter
3. Text color → White (`#FFFFFF`)

Repeat for every `{{MARKER}}` paragraph throughout the document.

- [ ] **Step 6: Add all three payment term block markers**

The template must contain ALL THREE payment term blocks. If only one variant exists in the .docx, create the other two by copying the first and editing the content.

Wrap each block:

```
{{PAY_A_START}}
[... Payment Type A content — Upon Receipt, no additional fields ...]
{{PAY_A_END}}

{{PAY_B_START}}
[... Payment Type B content — with <<add_terms>> and <<imp_detail>> ...]
{{PAY_B_END}}

{{PAY_C_START}}
[... Payment Type C / BOCES content — with <<pay_prepost>>, <<boces_name>>, <<po_number>> ...]
{{PAY_C_END}}
```

Format all marker paragraphs as white 1pt (same as Step 5).

- [ ] **Step 7: Add the signature block with `[GSIGN_SIG]`**

In the signature section, find the customer signature line. Replace the signature line placeholder with:
```
[GSIGN_SIG]
```

This text is preserved by the script (not replaced) — Playwright uses it as the anchor to position the eSign field.

The Fullmind signature side should have Ysiad Ferreiras / CEO pre-filled.

- [ ] **Step 8: Add appended section markers**

At the end of the document (after the signature block), add marker pairs for each appendable section. Each pair wraps a short placeholder paragraph (normal text, not white):

```
{{SOW_SECTION_START}}
[SOW content will be appended here]
{{SOW_SECTION_END}}

{{STAFFING_SECTION_START}}
[Staffing descriptions will be appended here]
{{STAFFING_SECTION_END}}

{{PRICING_SECTION_START}}

{{PRICING_EK12_START}}
[EK12 pricing sheet]
{{PRICING_EK12_END}}

{{PRICING_LIVESTAFF_START}}
[Live Staffing pricing sheet]
{{PRICING_LIVESTAFF_END}}

{{PRICING_HOURLY_START}}
[Hourly pricing sheet]
{{PRICING_HOURLY_END}}

{{PRICING_BOCES_START}}
[BOCES pricing sheet]
{{PRICING_BOCES_END}}

{{PRICING_SECTION_END}}

{{MSA_START}}
[Master Services Agreement]
{{MSA_END}}
```

Format all `{{MARKER}}` paragraphs as white 1pt. Leave the `[placeholder]` paragraphs as normal text.

- [ ] **Step 9: Store the template file ID in script properties**

Copy the template doc ID from the URL. In the Apps Script editor, run `initScriptProperties()` after filling in `TEMPLATE_BASE_ID` in Config.gs, or set it directly:

In the script editor console:
```javascript
PropertiesService.getScriptProperties().setProperty('TEMPLATE_BASE_ID', 'YOUR_DOC_ID');
```

Also set `OUTPUT_FOLDER_ID`:
```javascript
PropertiesService.getScriptProperties().setProperty('OUTPUT_FOLDER_ID', 'YOUR_FOLDER_ID');
```

Run `logScriptProperties()` to confirm both are set.

---

## Task 7: SampleData.gs — Phase 2 Test Payload

**Files:**
- Modify: `scripts/document-generation/appsscript/SampleData.gs`

- [ ] **Step 1: Write Phase 2 payload (deal + payment only — no quote/sections yet)**

```javascript
/**
 * Full deal payload — used for Phase 2 (merge fields + payment terms).
 * Quote line items and sections are added in later phases.
 */
var PAYLOAD_FULL = {
  deal: {
    sender_first:   'Jane',
    sender_last:    'Smith',
    sender_title:   'Account Executive',
    sender_email:   'jane.smith@fullmindlearning.com',
    client_first:   'Robert',
    client_last:    'Johnson',
    client_title:   'Superintendent',
    client_company: 'Springfield Unified School District',
    client_email:   'rjohnson@springfieldusd.org',
    start_date:     '08/26/2026',
    end_date:       '06/12/2027',
    signer_first:   'Robert',
    signer_last:    'Johnson',
    signer_salut:   'Dr.',
    signer_title:   'Superintendent',
    today:          '05/29/2026',
  },
  quote: {
    include:      false,
    show_pricing: false,
    line_items:   [],
    min_amt:      5000,
    max_amt:      100000,
    order_total:  0,
  },
  payment: {
    type:          'A',
    pay_terms:     'Net 30',
    invoice_date:  'time of signing',
    contract_end:  '06/12/2027',
    unused_funds:  'expire',
    billing_name:  'Accounts Payable',
    billing_add:   '123 School Lane, Springfield, IL 62701',
    billing_email: 'ap@springfieldusd.org',
    billing_phone: '(217) 555-0100',
    po_yn:         false,
    add_terms:     null,
    imp_detail:    null,
    pay_prepost:   null,
    boces_name:    null,
    po_number:     null,
  },
  sections: {
    sow_type:           null,
    staffing_include:   false,
    pricing_ek12:       false,
    pricing_livestaff:  false,
    pricing_hourly:     false,
    pricing_boces:      false,
  },
  auto_send: false,
};
```

- [ ] **Step 2: Push and commit**

```bash
clasp push
git add scripts/document-generation/appsscript/SampleData.gs
git commit -m "feat(sea-monkey): SampleData.gs Phase 2 test payload"
```

---

## Task 8: MergeFields.gs

**Files:**
- Modify: `scripts/document-generation/appsscript/MergeFields.gs`

- [ ] **Step 1: Write `MergeFields.gs`**

```javascript
/**
 * Replaces all <<FIELD>> tokens in the document body with values from payload.
 * Uses escapeRegex() to handle special characters in field delimiters.
 * @param {GoogleAppsScript.Document.Body} body
 * @param {Object} payload  Full deal payload (deal + quote + payment)
 */
function replaceMergeFields(body, payload) {
  var d = payload.deal;
  var q = payload.quote;
  var p = payload.payment;

  var fields = {
    '<<Sender_First>>':   d.sender_first,
    '<<Sender_Last>>':    d.sender_last,
    '<<Sender_Title>>':   d.sender_title,
    '<<Sender_Email>>':   d.sender_email,
    '<<Client_First>>':   d.client_first,
    '<<Client_Last>>':    d.client_last,
    '<<Client_Title>>':   d.client_title,
    '<<Client_Company>>': d.client_company,
    '<<Client_Email>>':   d.client_email,
    '<<start_date>>':     d.start_date,
    '<<end_date>>':       d.end_date,
    '<<Signer_First>>':   d.signer_first,
    '<<Signer_Last>>':    d.signer_last,
    '<<Signer_Salut>>':   d.signer_salut,
    '<<Signer_Title>>':   d.signer_title,
    '<<today>>':          d.today,
    '<<min_amt>>':        formatCurrency(q.min_amt),
    '<<max_amt>>':        formatCurrency(q.max_amt),
    '<<ORDER_TOTAL>>':    formatCurrency(q.order_total),
    '<<pay_terms>>':      p.pay_terms,
    '<<invoice_date>>':   p.invoice_date,
    '<<contract_end>>':   p.contract_end,
    '<<unused_funds>>':   p.unused_funds,
    '<<billing_name>>':   p.billing_name,
    '<<billing_add>>':    p.billing_add,
    '<<billing_email>>':  p.billing_email,
    '<<billing_phone>>':  p.billing_phone,
    '<<po_yn>>':          p.po_yn ? '☑' : '☐',
    '<<add_terms>>':      p.add_terms   || '',
    '<<imp_detail>>':     p.imp_detail  || '',
    '<<pay_prepost>>':    p.pay_prepost || '',
    '<<boces_name>>':     p.boces_name  || '',
    '<<po_number>>':      p.po_number   || '',
  };

  for (var field in fields) {
    body.replaceText(escapeRegex(field), fields[field] != null ? String(fields[field]) : '');
  }
}
```

- [ ] **Step 2: Push and commit**

```bash
clasp push
git add scripts/document-generation/appsscript/MergeFields.gs
git commit -m "feat(sea-monkey): MergeFields.gs — replace all merge field tokens"
```

---

## Task 9: PaymentTerms.gs

**Files:**
- Modify: `scripts/document-generation/appsscript/PaymentTerms.gs`

- [ ] **Step 1: Write `PaymentTerms.gs`**

```javascript
/**
 * Keeps the payment term block matching payment.type (A, B, or C).
 * Deletes the other two blocks (markers + content) entirely.
 * Removes marker paragraphs from the kept block.
 * @param {GoogleAppsScript.Document.Body} body
 * @param {Object} payment  payload.payment
 */
function handlePaymentTerms(body, payment) {
  var type = payment.type;

  var blocks = {
    A: { start: '{{PAY_A_START}}', end: '{{PAY_A_END}}' },
    B: { start: '{{PAY_B_START}}', end: '{{PAY_B_END}}' },
    C: { start: '{{PAY_C_START}}', end: '{{PAY_C_END}}' },
  };

  for (var key in blocks) {
    var markers = blocks[key];
    if (key === type) {
      deleteMarkerParagraph(body, markers.start);
      deleteMarkerParagraph(body, markers.end);
    } else {
      deleteBetweenMarkers(body, markers.start, markers.end);
    }
  }
}
```

- [ ] **Step 2: Push and commit**

```bash
clasp push
git add scripts/document-generation/appsscript/PaymentTerms.gs
git commit -m "feat(sea-monkey): PaymentTerms.gs — select one of three payment term blocks"
```

---

## Task 10: Code.gs — Phase 2 Orchestrator + End-to-End Test

**Files:**
- Modify: `scripts/document-generation/appsscript/Code.gs`

- [ ] **Step 1: Write Phase 2 `Code.gs`**

```javascript
/**
 * Web app entry point. Receives JSON payload from Territory Planner.
 * @param {GoogleAppsScript.Events.DoPost} e
 */
function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var result  = generateContract(payload);
    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Main contract generation orchestrator.
 * Call directly from the editor with generateContract(PAYLOAD_FULL) to test.
 * @param {Object} payload  Full deal payload
 * @returns {{ success: boolean, url: string, docId: string }}
 */
function generateContract(payload) {
  var props  = PropertiesService.getScriptProperties().getProperties();
  var folder = DriveApp.getFolderById(props[PROP.OUTPUT_FOLDER_ID]);

  var docName = payload.deal.client_company + ' — Contract ' + payload.deal.today;
  var copy    = DriveApp.getFileById(props[PROP.TEMPLATE_BASE_ID]).makeCopy(docName, folder);
  var doc     = DocumentApp.openById(copy.getId());
  var body    = doc.getBody();

  try {
    replaceMergeFields(body, payload);
    handlePaymentTerms(body, payload.payment);

    doc.saveAndClose();
    return {
      success: true,
      url:     'https://docs.google.com/document/d/' + copy.getId() + '/edit',
      docId:   copy.getId(),
    };
  } catch (err) {
    // Clean up orphaned doc before re-throwing
    try { copy.setTrashed(true); } catch (e2) {}
    GmailApp.sendEmail(
      payload.deal.sender_email,
      '⚠️ Contract generation FAILED — ' + payload.deal.client_company,
      'Error: ' + err.message + '\n\nStack:\n' + err.stack
    );
    throw err;
  }
}
```

- [ ] **Step 2: Push**

```bash
clasp push
```

- [ ] **Step 3: Run the Phase 2 end-to-end test**

In the Apps Script editor:
1. Select `generateContract` from the function dropdown
2. Click **Run** — it will prompt for permissions on first run; approve all
3. Check the execution log for the doc URL

Open the doc URL and verify against this checklist:

- [ ] All `<<merge_fields>>` replaced — search for `<<` in the doc; should find zero results
- [ ] Sender name, client company, dates all appear correctly
- [ ] `<<min_amt>>` / `<<max_amt>>` show as `$5,000.00` / `$100,000.00`
- [ ] Payment type A block is present; types B and C are absent with no whitespace gap
- [ ] Billing contact fields filled in
- [ ] PO checkbox shows `☐` (unchecked)
- [ ] No `{{MARKERS}}` visible anywhere
- [ ] `[GSIGN_SIG]` present in signature block exactly as typed
- [ ] Ysiad Ferreiras / CEO on the Fullmind signature side

If any field shows as a literal `<<FIELD>>` token, the token in your template doesn't match the key in `MergeFields.gs` exactly — check for spacing or case differences.

- [ ] **Step 4: Commit**

```bash
git add scripts/document-generation/appsscript/Code.gs
git commit -m "feat(sea-monkey): Code.gs Phase 2 orchestrator — merge fields + payment terms"
```

---

## Task 11: QuoteTable.gs

**Files:**
- Modify: `scripts/document-generation/appsscript/QuoteTable.gs`

- [ ] **Step 1: Write `QuoteTable.gs`**

```javascript
/**
 * Handles the quote section. Deletes the entire block if quote.include is false.
 * Otherwise removes markers and builds the table from scratch.
 * @param {GoogleAppsScript.Document.Body} body
 * @param {Object} quote  payload.quote
 */
function handleQuoteSection(body, quote) {
  if (!quote.include) {
    deleteBetweenMarkers(body, '{{QUOTE_SECTION_START}}', '{{QUOTE_SECTION_END}}');
    return;
  }
  deleteMarkerParagraph(body, '{{QUOTE_SECTION_START}}');
  deleteMarkerParagraph(body, '{{QUOTE_SECTION_END}}');
  buildQuoteTableFromScratch(body, quote);
}

/**
 * Builds the quote table from scratch at the position of the placeholder table
 * (the one containing '[QUOTE_ROW_1_SERVICE]'), then removes the placeholder.
 * Gives full column control — no need to hide columns post-hoc.
 * @param {GoogleAppsScript.Document.Body} body
 * @param {Object} quote  payload.quote
 */
function buildQuoteTableFromScratch(body, quote) {
  var items     = quote.line_items;
  var showPrice = quote.show_pricing;
  var units     = items.map(function(i) { return i.unit; })
                       .filter(function(v, i, a) { return a.indexOf(v) === i; });
  var pureUnit  = units.length === 1 ? units[0] : null;

  // Determine column set
  var cols = [
    { key: 'service',      label: 'Service',     show: true },
    { key: 'description',  label: 'Description', show: true },
    { key: 'qty',          label: pureUnit === 'days' ? 'Days' : pureUnit === 'hrs' ? 'Hours' : pureUnit === 'sessions' ? 'Sessions' : 'Qty', show: true },
    { key: 'unit',         label: 'Unit',        show: pureUnit === null },
    { key: 'list_rate',    label: pureUnit === 'days' ? 'List $/day' : pureUnit === 'hrs' ? 'List $/hr' : 'List Rate', show: showPrice },
    { key: 'discount_pct', label: 'Disc %',      show: showPrice },
    { key: 'net_rate',     label: pureUnit === 'days' ? 'Net $/day' : pureUnit === 'hrs' ? 'Net $/hr' : 'Net Rate', show: true },
    { key: 'total',        label: 'Total',       show: true },
  ].filter(function(c) { return c.show; });

  // Find placeholder table
  var placeholderTable = null;
  var tableIdx = -1;
  for (var i = 0; i < body.getNumChildren(); i++) {
    var child = body.getChild(i);
    if (child.getType() === DocumentApp.ElementType.TABLE &&
        child.asTable().getText().indexOf('[QUOTE_ROW_1_SERVICE]') !== -1) {
      placeholderTable = child.asTable();
      tableIdx = i;
      break;
    }
  }
  if (!placeholderTable) {
    Logger.log('Warning: quote placeholder table not found — skipping quote table build');
    return;
  }

  // Build data rows
  var headerRow = cols.map(function(c) { return c.label; });
  var dataRows  = items.map(function(item) {
    return cols.map(function(col) {
      if (col.key === 'list_rate')    return formatCurrency(item.list_rate);
      if (col.key === 'discount_pct') return item.discount_pct > 0 ? item.discount_pct + '%' : '—';
      if (col.key === 'net_rate')     return formatCurrency(item.net_rate);
      if (col.key === 'total')        return formatCurrency(item.total);
      if (col.key === 'qty')          return String(item.qty);
      return String(item[col.key] != null ? item[col.key] : '');
    });
  });

  var totalRow = cols.map(function(c) { return ''; });
  totalRow[cols.length - 2] = 'TOTAL:';
  totalRow[cols.length - 1] = formatCurrency(quote.order_total);

  var allRows = [headerRow].concat(dataRows).concat([totalRow]);

  // Insert new table after placeholder position, then remove placeholder
  var newTable = body.insertTable(tableIdx + 1, allRows);

  // Style header row
  var header = newTable.getRow(0);
  for (var c = 0; c < header.getNumCells(); c++) {
    header.getCell(c).editAsText().setBold(true);
    header.getCell(c).setBackgroundColor('#d3d3d3');
  }

  // Style total row
  var totalRowEl = newTable.getRow(newTable.getNumRows() - 1);
  for (var c = 0; c < totalRowEl.getNumCells(); c++) {
    totalRowEl.getCell(c).editAsText().setBold(true);
  }

  placeholderTable.removeFromParent();
}
```

- [ ] **Step 2: Push and commit**

```bash
clasp push
git add scripts/document-generation/appsscript/QuoteTable.gs
git commit -m "feat(sea-monkey): QuoteTable.gs — build quote table from scratch"
```

---

## Task 12: Phase 3 — Wire Quote Table + End-to-End Test

**Files:**
- Modify: `scripts/document-generation/appsscript/Code.gs`
- Modify: `scripts/document-generation/appsscript/SampleData.gs`

- [ ] **Step 1: Wire `handleQuoteSection` into `generateContract` in `Code.gs`**

In `generateContract()`, add the quote call after `replaceMergeFields`:

```javascript
replaceMergeFields(body, payload);
handleQuoteSection(body, payload.quote);    // ← add this line
handlePaymentTerms(body, payload.payment);
```

- [ ] **Step 2: Update `PAYLOAD_FULL` with line items in `SampleData.gs`**

Update the `quote` section of `PAYLOAD_FULL`:

```javascript
quote: {
  include:      true,
  show_pricing: true,
  line_items: [
    {
      sku:          'HS-SS-FT-27',
      service:      'Standard Educator — Standard Subject, Full Time',
      description:  'General ed instructor, core subjects, FT',
      qty:          190,
      unit:         'days',
      list_rate:    500.23,
      discount_pct: 0,
      net_rate:     500.23,
      total:        95043.70,
    },
    {
      sku:          'BOC27-CRSG',
      service:      'Credit Recovery — Small Group',
      description:  'BOCES hourly, small group',
      qty:          40,
      unit:         'hrs',
      list_rate:    111.42,
      discount_pct: 10,
      net_rate:     100.28,
      total:        4011.20,
    },
    {
      sku:          'HS-STAFFING-27',
      service:      'Staffing Fee',
      description:  'One-time placement fee',
      qty:          1,
      unit:         'flat',
      list_rate:    5627.54,
      discount_pct: 0,
      net_rate:     5627.54,
      total:        5627.54,
    },
  ],
  min_amt:     5627.54,
  max_amt:     104682.44,
  order_total: 104682.44,
},
```

- [ ] **Step 3: Add `PAYLOAD_NO_QUOTE` to `SampleData.gs`**

Append after `PAYLOAD_FULL`:

```javascript
var PAYLOAD_NO_QUOTE = {
  deal: {
    sender_first:   'Jane',
    sender_last:    'Smith',
    sender_title:   'Account Executive',
    sender_email:   'jane.smith@fullmindlearning.com',
    client_first:   'Maria',
    client_last:    'Torres',
    client_title:   'Director of Curriculum',
    client_company: 'Riverside Instructional District',
    client_email:   'mtorres@riversideid.org',
    start_date:     '09/02/2026',
    end_date:       '06/18/2027',
    signer_first:   'Maria',
    signer_last:    'Torres',
    signer_salut:   'Ms.',
    signer_title:   'Director of Curriculum',
    today:          '05/29/2026',
  },
  quote: {
    include:      false,
    show_pricing: false,
    line_items:   [],
    min_amt:      12000,
    max_amt:      48000,
    order_total:  0,
  },
  payment: {
    type:          'B',
    pay_terms:     'Net 15',
    invoice_date:  '09/02/2026',
    contract_end:  '06/18/2027',
    unused_funds:  'roll to credit',
    billing_name:  'Finance Office',
    billing_add:   '45 Education Blvd, Riverside, CA 92501',
    billing_email: 'finance@riversideid.org',
    billing_phone: '(951) 555-0200',
    po_yn:         true,
    add_terms:     'Payment due within 15 days of invoice date.',
    imp_detail:    'Services begin on first day of school year.',
    pay_prepost:   null,
    boces_name:    null,
    po_number:     null,
  },
  sections: {
    sow_type:          'instructional_services',
    staffing_include:  false,
    pricing_ek12:      false,
    pricing_livestaff: false,
    pricing_hourly:    false,
    pricing_boces:     false,
  },
  auto_send: false,
};
```

- [ ] **Step 4: Run Phase 3 tests**

In the Apps Script editor, run `generateContract(PAYLOAD_FULL)` and `generateContract(PAYLOAD_NO_QUOTE)` separately (edit the function call for each run).

Checklist for `PAYLOAD_FULL` (quote included):
- [ ] Quote table appears with 3 data rows
- [ ] Headers show "Days", "Hours" labels (mixed units → Unit column present)
- [ ] List Rate and Disc % columns visible (`show_pricing: true`)
- [ ] 10% discount shows on BOCES row
- [ ] TOTAL row shows `$104,682.44` in bold
- [ ] `<<ORDER_TOTAL>>` in any body text replaced correctly

Checklist for `PAYLOAD_NO_QUOTE` (no quote):
- [ ] No quote table or whitespace gap where it would have been
- [ ] Payment type B block present; A and C absent
- [ ] `<<add_terms>>` and `<<imp_detail>>` fields filled in
- [ ] PO checkbox shows `☑`

- [ ] **Step 5: Commit**

```bash
clasp push
git add scripts/document-generation/appsscript/
git commit -m "feat(sea-monkey): Phase 3 — quote table wired in, PAYLOAD_NO_QUOTE added"
```

---

## Task 13: Upload Existing Sub-Templates to Drive

This task is manual. Upload the three assets you already have.

- [ ] **Step 1: Cover Page (reference only — no upload needed)**

The cover page is the **first page of the base template**, not an appended section. Your existing cover page source file is reference material — use it to confirm the base template's first page matches during Task 6 template prep.

No Drive upload or file ID needed for the cover page.

- [ ] **Step 2: Upload the MSA**

1. Upload your MSA file to `Fullmind Templates/msa/`
2. Convert to Google Doc if needed
3. Rename to `MasterServicesAgreement`
4. Record the file ID

- [ ] **Step 3: Upload the BOCES pricing sheet**

1. Upload your BOCES pricing table to `Fullmind Templates/pricing/`
2. Convert to Google Doc if needed
3. Rename to `PricingSheet_BOCES`
4. Record the file ID

- [ ] **Step 4: Update script properties with the three new IDs**

In the Apps Script editor, open the console and run:

```javascript
PropertiesService.getScriptProperties().setProperties({
  'MSA_ID':            'YOUR_MSA_DOC_ID',
  'PRICING_BOCES_ID':  'YOUR_BOCES_DOC_ID',
});
```

(Cover page is appended differently — handled in Task 14 once the section structure is confirmed.)

Run `logScriptProperties()` to verify.

---

## Task 14: AppendedSections.gs v1 — MSA and BOCES

**Files:**
- Modify: `scripts/document-generation/appsscript/AppendedSections.gs`
- Modify: `scripts/document-generation/appsscript/Code.gs`

- [ ] **Step 1: Write the first version of `AppendedSections.gs`**

```javascript
/**
 * Handles all appended sections: SOW, staffing, pricing sheets, MSA.
 * Each section is independently controlled by the sections flags in payload.
 * MSA is always appended last regardless of flags.
 * @param {GoogleAppsScript.Document.Document} doc
 * @param {Object} sections  payload.sections
 * @param {Object} props     All script properties
 */
function handleAppendedSections(doc, sections, props) {
  var body = doc.getBody();

  // SOW
  if (sections.sow_type) {
    deleteMarkerParagraph(body, '{{SOW_SECTION_START}}');
    deleteMarkerParagraph(body, '{{SOW_SECTION_END}}');
    var sowId = sections.sow_type === 'live_streaming'
      ? props[PROP.SOW_LIVESTREAM_ID]
      : props[PROP.SOW_INSTRUCTION_ID];
    if (sowId) {
      appendDocContent(doc, sowId, '[SOW content will be appended here]');
    } else {
      Logger.log('Warning: SOW doc ID not set for type: ' + sections.sow_type);
    }
  } else {
    deleteBetweenMarkers(body, '{{SOW_SECTION_START}}', '{{SOW_SECTION_END}}');
  }

  // Staffing type descriptions
  if (sections.staffing_include) {
    deleteMarkerParagraph(body, '{{STAFFING_SECTION_START}}');
    deleteMarkerParagraph(body, '{{STAFFING_SECTION_END}}');
    if (props[PROP.STAFFING_ID]) {
      appendDocContent(doc, props[PROP.STAFFING_ID], '[Staffing descriptions will be appended here]');
    } else {
      Logger.log('Warning: STAFFING_ID not set');
    }
  } else {
    deleteBetweenMarkers(body, '{{STAFFING_SECTION_START}}', '{{STAFFING_SECTION_END}}');
  }

  // Pricing sheets — each independent
  var pricingSheets = [
    { flag: 'pricing_ek12',      propKey: PROP.PRICING_EK12_ID,      marker: 'EK12',      placeholder: '[EK12 pricing sheet]'           },
    { flag: 'pricing_livestaff', propKey: PROP.PRICING_LIVESTAFF_ID, marker: 'LIVESTAFF', placeholder: '[Live Staffing pricing sheet]'   },
    { flag: 'pricing_hourly',    propKey: PROP.PRICING_HOURLY_ID,    marker: 'HOURLY',    placeholder: '[Hourly pricing sheet]'          },
    { flag: 'pricing_boces',     propKey: PROP.PRICING_BOCES_ID,     marker: 'BOCES',     placeholder: '[BOCES pricing sheet]'           },
  ];

  pricingSheets.forEach(function(sheet) {
    var startMarker = '{{PRICING_' + sheet.marker + '_START}}';
    var endMarker   = '{{PRICING_' + sheet.marker + '_END}}';
    if (sections[sheet.flag]) {
      deleteMarkerParagraph(body, startMarker);
      deleteMarkerParagraph(body, endMarker);
      if (props[sheet.propKey]) {
        appendDocContent(doc, props[sheet.propKey], sheet.placeholder);
      } else {
        Logger.log('Warning: ' + sheet.propKey + ' not set');
      }
    } else {
      deleteBetweenMarkers(body, startMarker, endMarker);
    }
  });

  // Remove outer pricing section markers
  deleteMarkerParagraph(body, '{{PRICING_SECTION_START}}');
  deleteMarkerParagraph(body, '{{PRICING_SECTION_END}}');

  // MSA — always last
  deleteMarkerParagraph(body, '{{MSA_START}}');
  deleteMarkerParagraph(body, '{{MSA_END}}');
  if (props[PROP.MSA_ID]) {
    appendDocContent(doc, props[PROP.MSA_ID], '[Master Services Agreement]');
  } else {
    Logger.log('Warning: MSA_ID not set');
  }
}
```

- [ ] **Step 2: Wire `handleAppendedSections` into `generateContract` in `Code.gs`**

In `generateContract()`, add after `handlePaymentTerms`:

```javascript
replaceMergeFields(body, payload);
handleQuoteSection(body, payload.quote);
handlePaymentTerms(body, payload.payment);
handleAppendedSections(doc, payload.sections, props);   // ← add this line
```

- [ ] **Step 3: Update `PAYLOAD_FULL` sections to enable BOCES pricing and MSA**

In `SampleData.gs`, update `PAYLOAD_FULL.sections`:

```javascript
sections: {
  sow_type:          'live_streaming',
  staffing_include:  true,
  pricing_ek12:      false,
  pricing_livestaff: false,
  pricing_hourly:    false,
  pricing_boces:     true,
},
```

- [ ] **Step 4: Push and run Phase 4 test**

```bash
clasp push
```

Run `generateContract(PAYLOAD_FULL)`. Open the doc.

Checklist:
- [ ] MSA appended at the end with page break before it
- [ ] BOCES pricing sheet appended after the signature block
- [ ] SOW, Staffing, EK12, LiveStaff, Hourly sections absent — no whitespace gaps
- [ ] No `{{MARKERS}}` visible anywhere
- [ ] Document ends cleanly after MSA

- [ ] **Step 5: Commit**

```bash
git add scripts/document-generation/appsscript/
git commit -m "feat(sea-monkey): Phase 4 — AppendedSections v1, MSA + BOCES wired"
```

---

## Task 15: Build Missing Sub-Template Google Docs (Manual)

Create six Google Docs from the PandaDoc export PDF. Source pages are listed for each. Open the PDF at `/Users/astonfurious/Downloads/FY27 - Contract Template - All Services - No Variables, No Tables.pdf`.

- [ ] **Step 1: Create `SOW_LiveStreaming`**

Source: PDF pages 8–11 (Live Streaming Educator Staffing Operations and Delivery Terms)

1. Create a new Google Doc in `Fullmind Templates/sow/`
2. Name it `SOW_LiveStreaming`
3. Recreate the two tables (Fullmind Provides / District Partner Provides) and all 12 numbered terms
4. Record the file ID

- [ ] **Step 2: Create `SOW_InstructionalServices`**

Source: PDF pages 12–15 (second variant of Live Streaming SOW — virtual/supplemental framing)

1. Create a new Google Doc in `Fullmind Templates/sow/`
2. Name it `SOW_InstructionalServices`
3. Recreate both tables and all numbered terms from that variant
4. Record the file ID

- [ ] **Step 3: Create `StaffingTypeDescriptions`**

Source: PDF page 16 (Staffing Types table — Elevate, Fullmind Live Staffing, Fullmind Instructional Services)

1. Create a new Google Doc in `Fullmind Templates/staffing/`
2. Name it `StaffingTypeDescriptions`
3. Recreate the 3-row table with descriptions
4. Record the file ID

- [ ] **Step 4: Create `PricingSheet_EK12`**

Source: PDF pages 17–18 (Elevate K12 Tier 1 LIVE Staffing Price Sheet — all period/day combinations)

1. Create a new Google Doc in `Fullmind Templates/pricing/`
2. Name it `PricingSheet_EK12`
3. Recreate both pricing tables (Tier 1 and Diverse Learners, Full Year / Semester / Trimester)
4. Record the file ID

- [ ] **Step 5: Create `PricingSheet_LiveStaffing`**

Source: PDF page 19 (LIVE Staffing Price Sheet — Standard / Premium / Specialized educator tiers)

1. Create a new Google Doc in `Fullmind Templates/pricing/`
2. Name it `PricingSheet_LiveStaffing`
3. Recreate the educator tier table and Subject Tiers Description table
4. Record the file ID

- [ ] **Step 6: Create `PricingSheet_Hourly`**

Source: PDF page 21 (Hourly Direct Instruction Pricing — note: pricing table content not rendered in export, recreate from internal source)

1. Create a new Google Doc in `Fullmind Templates/pricing/`
2. Name it `PricingSheet_Hourly`
3. Add the hourly pricing structure (use internal rate card if PandaDoc page is blank)
4. Record the file ID

- [ ] **Step 7: Update all script properties with new IDs**

In the Apps Script editor:

```javascript
PropertiesService.getScriptProperties().setProperties({
  'SOW_LIVESTREAM_ID':    'YOUR_SOW_LIVE_ID',
  'SOW_INSTRUCTION_ID':   'YOUR_SOW_INSTRUCTION_ID',
  'STAFFING_ID':          'YOUR_STAFFING_ID',
  'PRICING_EK12_ID':      'YOUR_EK12_ID',
  'PRICING_LIVESTAFF_ID': 'YOUR_LIVESTAFF_ID',
  'PRICING_HOURLY_ID':    'YOUR_HOURLY_ID',
});
```

Run `logScriptProperties()` and confirm all 10 IDs are non-empty.

---

## Task 16: AppendedSections.gs — Complete + Phase 5 Test

**Files:**
- Modify: `scripts/document-generation/appsscript/SampleData.gs`

No code changes needed in `AppendedSections.gs` — it already handles all sections generically. This task activates them all via test payloads.

- [ ] **Step 1: Update `PAYLOAD_FULL` to use all sections**

In `SampleData.gs`, update `PAYLOAD_FULL.sections`:

```javascript
sections: {
  sow_type:          'live_streaming',
  staffing_include:  true,
  pricing_ek12:      false,
  pricing_livestaff: true,
  pricing_hourly:    true,
  pricing_boces:     true,
},
```

- [ ] **Step 2: Update `PAYLOAD_NO_QUOTE` sections**

```javascript
sections: {
  sow_type:          'instructional_services',
  staffing_include:  false,
  pricing_ek12:      false,
  pricing_livestaff: false,
  pricing_hourly:    false,
  pricing_boces:     false,
},
```

- [ ] **Step 3: Add `PAYLOAD_BOCES_ONLY` to `SampleData.gs`**

```javascript
var PAYLOAD_BOCES_ONLY = {
  deal: {
    sender_first:   'Carlos',
    sender_last:    'Rivera',
    sender_title:   'Regional Account Executive',
    sender_email:   'carlos.rivera@fullmindlearning.com',
    client_first:   'Patricia',
    client_last:    'Chen',
    client_title:   'Assistant Superintendent',
    client_company: 'Nassau BOCES',
    client_email:   'pchen@nassauboces.org',
    start_date:     '09/08/2026',
    end_date:       '06/25/2027',
    signer_first:   'Patricia',
    signer_last:    'Chen',
    signer_salut:   'Dr.',
    signer_title:   'Assistant Superintendent',
    today:          '05/29/2026',
  },
  quote: {
    include:      true,
    show_pricing: false,
    line_items: [
      {
        sku:          'BOC27-CRSG',
        service:      'Credit Recovery — Small Group',
        description:  'BOCES hourly, small group, 2–10 students',
        qty:          120,
        unit:         'hrs',
        list_rate:    130,
        discount_pct: 0,
        net_rate:     111.42,
        total:        13370.40,
      },
      {
        sku:          'BOC27-HB1',
        service:      'Direct Instruction — Homebound',
        description:  'BOCES hourly, 1:1 homebound',
        qty:          60,
        unit:         'hrs',
        list_rate:    80,
        discount_pct: 0,
        net_rate:     53.06,
        total:        3183.60,
      },
    ],
    min_amt:     3183.60,
    max_amt:     16554.00,
    order_total: 16554.00,
  },
  payment: {
    type:          'C',
    pay_terms:     'Net 30',
    invoice_date:  'time of signing',
    contract_end:  '06/25/2027',
    unused_funds:  'expire',
    billing_name:  'BOCES Business Office',
    billing_add:   '71 Clinton Road, Garden City, NY 11530',
    billing_email: 'billing@nassauboces.org',
    billing_phone: '(516) 555-0300',
    po_yn:         true,
    add_terms:     null,
    imp_detail:    null,
    pay_prepost:   'post',
    boces_name:    'Nassau BOCES',
    po_number:     'PO-2026-00441',
  },
  sections: {
    sow_type:          'live_streaming',
    staffing_include:  false,
    pricing_ek12:      false,
    pricing_livestaff: false,
    pricing_hourly:    false,
    pricing_boces:     true,
  },
  auto_send: false,
};
```

- [ ] **Step 4: Push and run all three test payloads**

```bash
clasp push
```

Run `generateContract(PAYLOAD_FULL)`, then `generateContract(PAYLOAD_NO_QUOTE)`, then `generateContract(PAYLOAD_BOCES_ONLY)`.

Visual checklist for each doc:

**PAYLOAD_FULL:**
- [ ] Live Streaming SOW appended
- [ ] Staffing Type Descriptions appended
- [ ] Live Staffing, Hourly, BOCES pricing sheets appended
- [ ] EK12 pricing absent — no gap
- [ ] MSA appended last
- [ ] Correct section order throughout

**PAYLOAD_NO_QUOTE:**
- [ ] No quote table
- [ ] Instructional Services SOW appended
- [ ] No staffing, no pricing sheets — no gaps
- [ ] MSA still appended (always present)
- [ ] Payment type B with `add_terms` and `imp_detail` filled

**PAYLOAD_BOCES_ONLY:**
- [ ] Quote table with 2 rows, hours unit, List Rate / Disc % columns hidden
- [ ] Payment type C with `pay_prepost`, `boces_name`, `po_number` filled
- [ ] PO checkbox `☑`
- [ ] BOCES pricing sheet appended
- [ ] MSA appended

- [ ] **Step 5: Commit**

```bash
git add scripts/document-generation/appsscript/SampleData.gs
git commit -m "feat(sea-monkey): Phase 5 — all sections wired, all three test payloads pass"
```

---

## Task 17: Error Handling

**Files:**
- Modify: `scripts/document-generation/appsscript/Code.gs`

The `generateContract` function already has a basic try/catch from Task 10. This task hardens it.

- [ ] **Step 1: Update the catch block in `generateContract` in `Code.gs`**

Replace the existing catch block:

```javascript
  } catch (err) {
    // Delete orphaned doc so it doesn't clutter the output folder
    try { copy.setTrashed(true); } catch (cleanupErr) {
      Logger.log('Could not trash orphaned doc: ' + cleanupErr.message);
    }

    // Email sender with full error details
    try {
      GmailApp.sendEmail(
        payload.deal.sender_email,
        '⚠️ Contract generation FAILED — ' + payload.deal.client_company,
        [
          'Contract generation failed for: ' + payload.deal.client_company,
          'Error: ' + err.message,
          '',
          'Stack trace:',
          err.stack || '(no stack available)',
        ].join('\n')
      );
    } catch (emailErr) {
      Logger.log('Could not send failure email: ' + emailErr.message);
    }

    throw err;
  }
```

- [ ] **Step 2: Push and commit**

```bash
clasp push
git add scripts/document-generation/appsscript/Code.gs
git commit -m "feat(sea-monkey): harden error handling — trash orphaned doc + email on failure"
```

---

## Task 18: doPost() + auto_send Hook

**Files:**
- Modify: `scripts/document-generation/appsscript/Code.gs`

- [ ] **Step 1: Update `generateContract` to handle `auto_send` and update `doPost`**

Replace the full `Code.gs` content:

```javascript
/**
 * Web app entry point. Receives JSON payload from Territory Planner.
 */
function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var result  = generateContract(payload);
    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Main contract generation orchestrator.
 * Call directly: generateContract(PAYLOAD_FULL)
 * @param {Object} payload
 * @returns {{ success: boolean, url: string, docId: string, sent?: boolean }}
 */
function generateContract(payload) {
  var props  = PropertiesService.getScriptProperties().getProperties();
  var folder = DriveApp.getFolderById(props[PROP.OUTPUT_FOLDER_ID]);

  var docName = payload.deal.client_company + ' — Contract ' + payload.deal.today;
  var copy    = DriveApp.getFileById(props[PROP.TEMPLATE_BASE_ID]).makeCopy(docName, folder);
  var doc     = DocumentApp.openById(copy.getId());
  var body    = doc.getBody();

  try {
    replaceMergeFields(body, payload);
    handleQuoteSection(body, payload.quote);
    handlePaymentTerms(body, payload.payment);
    handleAppendedSections(doc, payload.sections, props);

    doc.saveAndClose();

    var docUrl = 'https://docs.google.com/document/d/' + copy.getId() + '/edit';
    var result = { success: true, url: docUrl, docId: copy.getId() };

    // Optional: trigger Playwright eSign automation immediately
    if (payload.auto_send && props[PROP.PLAYWRIGHT_TRIGGER_URL]) {
      try {
        UrlFetchApp.fetch(props[PROP.PLAYWRIGHT_TRIGGER_URL], {
          method:      'post',
          contentType: 'application/json',
          payload:     JSON.stringify({
            docId:       copy.getId(),
            signerEmail: payload.deal.client_email,
            signerName:  payload.deal.signer_salut + ' ' + payload.deal.signer_first + ' ' + payload.deal.signer_last,
          }),
        });
        result.sent = true;
      } catch (sendErr) {
        Logger.log('auto_send trigger failed: ' + sendErr.message);
        result.sent = false;
        result.sendError = sendErr.message;
      }
    }

    return result;

  } catch (err) {
    try { copy.setTrashed(true); } catch (e2) {}
    try {
      GmailApp.sendEmail(
        payload.deal.sender_email,
        '⚠️ Contract generation FAILED — ' + payload.deal.client_company,
        [
          'Contract generation failed for: ' + payload.deal.client_company,
          'Error: ' + err.message,
          '',
          'Stack trace:',
          err.stack || '(no stack available)',
        ].join('\n')
      );
    } catch (emailErr) {
      Logger.log('Could not send failure email: ' + emailErr.message);
    }
    throw err;
  }
}
```

- [ ] **Step 2: Push and commit**

```bash
clasp push
git add scripts/document-generation/appsscript/Code.gs
git commit -m "feat(sea-monkey): Code.gs complete — doPost + auto_send hook"
```

---

## Task 19: Web App Deployment + Phase 6 Test

- [ ] **Step 1: Deploy as web app**

Option A — via CLASP:
```bash
clasp deploy --description "Fullmind Contract Generator v1"
```

Option B — via browser (more control):
1. In script.google.com → **Deploy → New deployment**
2. Type: **Web app**
3. Execute as: **Me**
4. Who has access: **Anyone**
5. Click Deploy → copy the web app URL

Record the deployment URL — it looks like:
`https://script.google.com/macros/s/{DEPLOYMENT_ID}/exec`

- [ ] **Step 2: Test the web app endpoint with curl**

Save `PAYLOAD_FULL` as a local JSON file:

```bash
cat > /tmp/payload_full.json << 'EOF'
{
  "deal": {
    "sender_first": "Jane", "sender_last": "Smith",
    "sender_title": "Account Executive", "sender_email": "jane.smith@fullmindlearning.com",
    "client_first": "Robert", "client_last": "Johnson",
    "client_title": "Superintendent", "client_company": "Springfield Unified School District",
    "client_email": "rjohnson@springfieldusd.org",
    "start_date": "08/26/2026", "end_date": "06/12/2027",
    "signer_first": "Robert", "signer_last": "Johnson",
    "signer_salut": "Dr.", "signer_title": "Superintendent",
    "today": "05/29/2026"
  },
  "quote": { "include": false, "show_pricing": false, "line_items": [], "min_amt": 5000, "max_amt": 100000, "order_total": 0 },
  "payment": { "type": "A", "pay_terms": "Net 30", "invoice_date": "time of signing", "contract_end": "06/12/2027", "unused_funds": "expire", "billing_name": "Accounts Payable", "billing_add": "123 School Lane, Springfield, IL 62701", "billing_email": "ap@springfieldusd.org", "billing_phone": "(217) 555-0100", "po_yn": false, "add_terms": null, "imp_detail": null, "pay_prepost": null, "boces_name": null, "po_number": null },
  "sections": { "sow_type": "live_streaming", "staffing_include": false, "pricing_ek12": false, "pricing_livestaff": false, "pricing_hourly": false, "pricing_boces": false },
  "auto_send": false
}
EOF
```

```bash
curl -L -X POST "YOUR_WEB_APP_URL" \
  -H "Content-Type: application/json" \
  -d @/tmp/payload_full.json
```

Expected response:
```json
{"success":true,"url":"https://docs.google.com/document/d/...","docId":"..."}
```

- [ ] **Step 3: Verify the doc in Drive**

Open the returned URL. Confirm the doc appears in the `_output/` folder and passes the full visual checklist from Task 10.

- [ ] **Step 4: Document the endpoint URL**

Add the deployed web app URL to script properties for reference:

```javascript
PropertiesService.getScriptProperties().setProperty('WEB_APP_URL', 'YOUR_DEPLOYED_URL');
```

- [ ] **Step 5: Final commit**

```bash
git add scripts/document-generation/appsscript/
git commit -m "feat(sea-monkey): Phase 6 complete — web app deployed and tested"
```

---

## Summary of Drive IDs to Collect

| Property key | What | Where in Drive |
|---|---|---|
| `TEMPLATE_BASE_ID` | Base contract template | `base/Fullmind_Contract_Template_v1` |
| `SOW_LIVESTREAM_ID` | Live streaming SOW | `sow/SOW_LiveStreaming` |
| `SOW_INSTRUCTION_ID` | Instructional services SOW | `sow/SOW_InstructionalServices` |
| `STAFFING_ID` | Staffing type descriptions | `staffing/StaffingTypeDescriptions` |
| `PRICING_EK12_ID` | EK12 pricing sheet | `pricing/PricingSheet_EK12` |
| `PRICING_LIVESTAFF_ID` | Live staffing pricing | `pricing/PricingSheet_LiveStaffing` |
| `PRICING_HOURLY_ID` | Hourly pricing | `pricing/PricingSheet_Hourly` |
| `PRICING_BOCES_ID` | BOCES pricing | `pricing/PricingSheet_BOCES` |
| `MSA_ID` | Master Services Agreement | `msa/MasterServicesAgreement` |
| `OUTPUT_FOLDER_ID` | Generated contracts | `_output/` |
