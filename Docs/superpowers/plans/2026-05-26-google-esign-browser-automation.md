# Google eSign Browser Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automate the Google Workspace eSignature UI flow with Playwright so that a rep can generate an order doc and send it for client e-signature without any manual browser interaction.

**Architecture:** Apps Script inserts a visible `[GSIGN_SIG]` text placeholder in the buyer signature cell before saving the Google Doc. A Node.js Playwright script receives the doc URL, opens the Google Docs eSign panel, uses Find & Replace to locate and delete the placeholder (landing the cursor at exactly the right position), clicks the Signature field button, and drives the full "Request signature" send form. Auth is a saved Playwright session file (`session.json`) created once by a setup script.

**Tech Stack:** Node.js, `@playwright/test` (Playwright), Google Apps Script (existing), Chromium (Playwright-bundled)

**Branch:** `feat/document-generation-poc` — all commits go here.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `scripts/document-generation/GSign.gs` | **CREATE** | `addGSignPlaceholders(body)` — inserts `[GSIGN_SIG]` in buyer signature cell. `testGSignPlaceholders()` — standalone test runner. |
| `scripts/document-generation/Code.gs` | **MODIFY** | Add `USE_GOOGLE_ESIGN` flag to Config.gs; refactor `generateOrderDocument()` to branch on the flag; update `runEndToEndTest()` checklist. |
| `scripts/document-generation/Config.gs` | **MODIFY** | Add `var USE_GOOGLE_ESIGN = true;` |
| `.gitignore` | **MODIFY** | Add entries for `.auth/` and `node_modules/` under `scripts/document-generation/` |
| `scripts/document-generation/package.json` | **CREATE** | Node.js project manifest; declares `@playwright/test` dependency |
| `scripts/document-generation/esign-setup.js` | **CREATE** | One-time auth: opens headed Chromium, waits for manual login, saves `session.json` |
| `scripts/document-generation/esign-request.js` | **CREATE** | Main automation: receives `--docUrl`, `--email`, `--title`; runs Steps 1–8 |
| `scripts/document-generation/.auth/session.json` | **GITIGNORED** | Playwright storage state (Google session cookies). Created at runtime by `esign-setup.js`. Never committed. |

---

## Playwright TDD Pattern

There is no unit test framework for Playwright automation against a live Google Docs session. The TDD loop for every Playwright step is:

1. Write the step function
2. Add `await page.pause();` after calling it in `main()` — this opens the Playwright Inspector
3. Run: `node esign-request.js --docUrl=... --email=... --title=...`
4. Inspect the paused browser visually — verify the step produced the right UI state
5. If a selector is wrong, use the Inspector's element picker to find the correct one, update the code
6. Remove `await page.pause()`
7. Run again without pause to confirm it still works
8. Commit

This is the standard Playwright iterative development pattern. Every task that touches `esign-request.js` follows this loop.

---

## Selector Discovery Note

Google Docs uses dynamic CSS class names. **Always prefer `aria-label`, `role`, and visible text selectors** — they survive Google UI updates. The selectors written in Tasks 7–10 are educated starting points; update them from Playwright Inspector output if they don't match.

---

## Task 1: Node.js Project Setup

**Files:**
- Create: `scripts/document-generation/package.json`
- Modify: `.gitignore`

- [ ] **Step 1: Create `package.json`**

  Create `scripts/document-generation/package.json` with this exact content:

  ```json
  {
    "name": "document-generation",
    "version": "1.0.0",
    "description": "Google eSign Playwright automation for Fullmind order documents",
    "scripts": {
      "setup": "node esign-setup.js",
      "esign": "node esign-request.js"
    },
    "dependencies": {
      "@playwright/test": "^1.44.0"
    }
  }
  ```

- [ ] **Step 2: Add gitignore entries**

  Open `.gitignore` at the repo root and add these lines at the end of the `# Local dev artifacts` section:

  ```
  # Document generation Playwright auth + deps
  scripts/document-generation/.auth/
  scripts/document-generation/node_modules/
  ```

- [ ] **Step 3: Install dependencies**

  ```bash
  cd scripts/document-generation
  npm install
  ```

  Expected: `node_modules/` appears, `package-lock.json` created.

- [ ] **Step 4: Install Playwright's Chromium browser binary**

  ```bash
  npx playwright install chromium
  ```

  Expected: Output ends with `✓ Chromium ... is already installed` or `✓ Chromium ... installed`.

- [ ] **Step 5: Commit**

  ```bash
  cd /path/to/territory-plan
  git add scripts/document-generation/package.json \
          scripts/document-generation/package-lock.json \
          .gitignore
  git commit -m "chore(document-generation): add Node.js Playwright project setup"
  ```

---

## Task 2: Apps Script — GSign.gs + Code.gs + Config.gs

**Files:**
- Create: `scripts/document-generation/GSign.gs`
- Modify: `scripts/document-generation/Code.gs`
- Modify: `scripts/document-generation/Config.gs`

> **Important:** These files are the source of truth in the repo. After each sub-step, you also need to paste/update the content into the Google Apps Script editor at [script.google.com](https://script.google.com). The repo and the Apps Script project must stay in sync.

### 2a — Create `GSign.gs`

- [ ] **Step 1: Create the file with this exact content**

  Create `scripts/document-generation/GSign.gs`:

  ```javascript
  // ─────────────────────────────────────────────────────────────────────────────
  // GSIGN
  // Inserts a findable text placeholder in the buyer signature cell.
  // Used by the Playwright esign-request.js script:
  //   1. Playwright finds [GSIGN_SIG] via Cmd+H (Find & Replace → replace with empty)
  //   2. Cursor lands at the deletion site
  //   3. Playwright clicks Signature in the eSign panel → field placed at cursor
  //
  // Parallel to addESignAnchorTags() which serves the Dropbox Sign path.
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Appends a [GSIGN_SIG] placeholder paragraph to the buyer signature cell.
   * The placeholder is visible black text — intentionally readable during
   * testing. Playwright removes it before the eSign request is sent.
   *
   * @param {GoogleAppsScript.Document.Body} body
   */
  function addGSignPlaceholders(body) {
    var tables = body.getTables();
    var placed = false;

    for (var t = 0; t < tables.length && !placed; t++) {
      var table = tables[t];
      for (var r = 0; r < table.getNumRows() && !placed; r++) {
        var row = table.getRow(r);
        for (var c = 0; c < row.getNumCells() && !placed; c++) {
          var cell = row.getCell(c);
          if (cell.getText().indexOf('Authorized Representative, Buyer') !== -1) {
            cell.appendParagraph('[GSIGN_SIG]');
            placed = true;
            Logger.log('GSign: [GSIGN_SIG] inserted in buyer signature cell.');
          }
        }
      }
    }

    if (!placed) {
      Logger.log('GSign WARNING: buyer signature cell not found. ' +
                 'Check that "Authorized Representative, Buyer" exists in the template.');
    }
  }

  /**
   * Standalone test: creates a copy of the template, runs merge fields +
   * signature block + GSign placeholder, and opens the result for inspection.
   * Run from the Apps Script editor. Delete the test copy from Drive when done.
   */
  function testGSignPlaceholders() {
    assertConfigured();
    var data     = getSampleOrderData();
    var template = DriveApp.getFileById(TEMPLATE_ID);
    var testCopy = template.makeCopy(
      'TEST — GSignPlaceholders',
      DriveApp.getFolderById(OUTPUT_FOLDER_ID)
    );
    var doc  = DocumentApp.openById(testCopy.getId());
    var body = doc.getBody();

    replaceAllMergeFields(doc, data);
    fillFullmindSignatureBlock(body, data);
    addGSignPlaceholders(body);
    doc.saveAndClose();

    Logger.log('Test doc: ' + testCopy.getUrl());
    Logger.log('Open the doc and verify:');
    Logger.log('[ ] Last line of buyer signature cell shows "[GSIGN_SIG]"');
    Logger.log('[ ] Text is normal-sized and black (visible)');
    Logger.log('Delete this test copy from Drive when done.');
  }
  ```

- [ ] **Step 2: Paste into Apps Script editor**

  In the [Apps Script editor](https://script.google.com), click **+ (Add file)** → **Script** → name it `GSign` → paste the content above → **Save**.

- [ ] **Step 3: Run `testGSignPlaceholders` and verify**

  In the Apps Script editor, select `testGSignPlaceholders` from the function dropdown and click **Run**. Open the logged URL. Confirm the buyer signature cell ends with a visible `[GSIGN_SIG]` line. Delete the test doc from Drive.

### 2b — Modify `Config.gs`

- [ ] **Step 4: Add `USE_GOOGLE_ESIGN` flag**

  Open `scripts/document-generation/Config.gs`. Add this line **after the three Drive ID variables** and before `testConfig()`:

  ```javascript
  // ── Signing path selector ──────────────────────────────────────────────────
  // true  → Google eSign: Playwright drives the UI. No PDF exported.
  // false → Dropbox Sign: exports PDF, calls Dropbox Sign REST API.
  var USE_GOOGLE_ESIGN = true;
  ```

  Also paste this line into the Apps Script editor's `Config.gs` file at the same position.

### 2c — Modify `Code.gs`

- [ ] **Step 5: Replace `generateOrderDocument` with the branched version**

  Replace the entire `generateOrderDocument` function in `scripts/document-generation/Code.gs` with:

  ```javascript
  /**
   * Generates a completed order document from a data object.
   *
   * When USE_GOOGLE_ESIGN = true (Config.gs):
   *   - Inserts [GSIGN_SIG] placeholder, saves the Doc, logs the docUrl.
   *   - No PDF is exported. Run esign-request.js to send for e-signature.
   *
   * When USE_GOOGLE_ESIGN = false:
   *   - Adds Dropbox Sign anchor tags, exports PDF, calls Dropbox Sign API.
   *
   * @param {Object} data  Shape: see getSampleOrderData() in SampleData.gs
   * @returns {{ docUrl: string, pdfUrl: string|null, signatureRequestId: string|null }}
   */
  function generateOrderDocument(data) {
    assertConfigured();
    var outputFolder = DriveApp.getFolderById(OUTPUT_FOLDER_ID);
    var pdfFolder    = DriveApp.getFolderById(PDF_FOLDER_ID);
    var template     = DriveApp.getFileById(TEMPLATE_ID);

    // 1. Copy template
    var docTitle = 'Order — ' + data.buyerCompanyName + ' — ' + data.contractRef;
    var docCopy  = template.makeCopy(docTitle, outputFolder);
    var doc      = DocumentApp.openById(docCopy.getId());
    var body     = doc.getBody();
    Logger.log('Created doc copy: ' + docCopy.getUrl());

    // 2. Replace merge fields (body + header + footer)
    replaceAllMergeFields(doc, data);
    Logger.log('Merge fields replaced.');

    // 3. Insert pricing table
    var grandTotal = insertPricingTable(body, data.lineItems);
    Logger.log('Pricing table inserted. Grand total: $' + grandTotal.toFixed(2));

    // 4. Pre-fill Fullmind signature block
    fillFullmindSignatureBlock(body, data);
    Logger.log('Fullmind signature block pre-filled.');

    // 4.5  Prepare for signing (path branches here)
    var pdfFile    = null;
    var eSignResult = null;

    if (USE_GOOGLE_ESIGN) {
      addGSignPlaceholders(body);
      Logger.log('GSign placeholder added.');
    } else {
      addESignAnchorTags(body);
      Logger.log('eSign anchor tags added (Dropbox Sign path).');
    }

    // 5. Save
    doc.saveAndClose();
    Logger.log('Document saved.');

    if (!USE_GOOGLE_ESIGN) {
      // 6. Export PDF (Dropbox Sign path only)
      var pdfBlob = DriveApp.getFileById(docCopy.getId()).getAs('application/pdf');
      pdfBlob.setName(docTitle + '.pdf');
      pdfFile = pdfFolder.createFile(pdfBlob);
      Logger.log('PDF exported: ' + pdfFile.getUrl());

      // 7. Send via Dropbox Sign API
      if (data.signerEmail && data.signerEmail !== 'test@example.com') {
        eSignResult = sendForDropboxSign(
          pdfFile.getId(), data.signerEmail, data.signerName, docTitle
        );
        Logger.log('Dropbox Sign request ID: ' + eSignResult.signatureRequestId);
      } else {
        Logger.log('⚠️  eSign SKIPPED — set a real signerEmail to trigger signing.');
      }
    }

    return {
      docUrl:             docCopy.getUrl(),
      pdfUrl:             pdfFile ? pdfFile.getUrl() : null,
      signatureRequestId: eSignResult ? eSignResult.signatureRequestId : null
    };
  }
  ```

- [ ] **Step 6: Replace `runEndToEndTest` with the updated version**

  Replace the entire `runEndToEndTest` function in `Code.gs` with:

  ```javascript
  /**
   * End-to-end test runner. Select this function in the Apps Script editor
   * and click Run to execute the full pipeline against the sample data.
   * Check the Execution log for URLs and the verification checklist.
   */
  function runEndToEndTest() {
    var data          = getSampleOrderData();
    var expectedTotal = data.lineItems.reduce(function(sum, item) {
      return sum + (item.unitPrice * item.qty);
    }, 0);
    var result = generateOrderDocument(data);

    Logger.log('');
    Logger.log('=== END-TO-END TEST COMPLETE ===');
    Logger.log('Doc URL: ' + result.docUrl);
    if (result.pdfUrl) { Logger.log('PDF URL: ' + result.pdfUrl); }
    Logger.log('');
    Logger.log('Verification checklist:');
    Logger.log('[ ] All « » tokens replaced (Ctrl+F for « — none should remain)');
    Logger.log('[ ] Pricing table: 7 rows, grand total = $' + expectedTotal.toFixed(2));
    Logger.log('[ ] Fullmind sig block shows rep name + title');

    if (USE_GOOGLE_ESIGN) {
      Logger.log('[ ] Buyer cell ends with visible "[GSIGN_SIG]" on its own line');
      Logger.log('');
      Logger.log('Next step — run Playwright:');
      Logger.log('  node esign-request.js \\');
      Logger.log('    --docUrl="' + result.docUrl + '" \\');
      Logger.log('    --email="client@example.com" \\');
      Logger.log('    --title="' + data.buyerCompanyName + ' Order"');
    } else {
      Logger.log('[ ] PDF opens correctly, layout intact');
      Logger.log('[ ] Dropbox Sign: https://app.hellosign.com — check for request');
    }
  }
  ```

- [ ] **Step 7: Paste both functions into the Apps Script editor's `Code.gs`**

  Replace `generateOrderDocument` and `runEndToEndTest` in the live Apps Script editor with the code above.

- [ ] **Step 8: Commit the repo files**

  ```bash
  git add scripts/document-generation/GSign.gs \
          scripts/document-generation/Code.gs \
          scripts/document-generation/Config.gs
  git commit -m "feat(document-generation): add GSign placeholder and USE_GOOGLE_ESIGN flag"
  ```

---

## Task 3: Verification Checkpoint — Generate a [GSIGN_SIG] Doc

> No code changes in this task. This is a manual verification gate before writing the Playwright script. You need a real doc URL with `[GSIGN_SIG]` in it for Tasks 5–10.

- [ ] **Step 1: Run `runEndToEndTest` in Apps Script editor**

  Select `runEndToEndTest` and click **Run**. Open the Execution log.

- [ ] **Step 2: Verify the checklist**

  Open the logged Doc URL. Confirm:
  - All `«FIELD»` tokens are replaced
  - Pricing table has 7 rows
  - Buyer signature cell ends with a visible `[GSIGN_SIG]` on its own line

- [ ] **Step 3: Copy the `node esign-request.js ...` command from the log**

  The log prints the exact command to run with the real `docUrl`. Copy it — you'll use it in Tasks 5–10. Replace `client@example.com` with a real test email address.

---

## Task 4: One-Time Auth Setup

**Files:**
- Create: `scripts/document-generation/esign-setup.js`

- [ ] **Step 1: Create `esign-setup.js`**

  Create `scripts/document-generation/esign-setup.js` with this exact content:

  ```javascript
  // esign-setup.js
  // Run once: npm run setup
  // Opens a Chromium window. Log in to Google manually.
  // When you see your Google Account dashboard, return here and press Enter.
  // Your session is saved to .auth/session.json for use by esign-request.js.

  const { chromium } = require('@playwright/test');
  const path = require('path');
  const fs   = require('fs');

  (async () => {
    const authDir = path.join(__dirname, '.auth');
    if (!fs.existsSync(authDir)) {
      fs.mkdirSync(authDir, { recursive: true });
    }

    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page    = await context.newPage();

    await page.goto('https://accounts.google.com');
    console.log('');
    console.log('A browser window opened. Log in to Google as aston.arcega@fullmindlearning.com.');
    console.log('When you are fully signed in (see your account dashboard), come back here.');
    console.log('');
    console.log('Press Enter to save the session and close the browser...');

    await new Promise(resolve => process.stdin.once('data', resolve));

    const sessionPath = path.join(authDir, 'session.json');
    await context.storageState({ path: sessionPath });
    console.log('Session saved to .auth/session.json');
    await browser.close();
    process.exit(0);
  })();
  ```

- [ ] **Step 2: Commit the setup script**

  ```bash
  git add scripts/document-generation/esign-setup.js
  git commit -m "feat(document-generation): add Playwright one-time auth setup script"
  ```

- [ ] **Step 3: Run the setup script**

  ```bash
  cd scripts/document-generation
  npm run setup
  ```

  A Chromium window opens. Log in to Google as `aston.arcega@fullmindlearning.com`. Return to the terminal and press Enter.

- [ ] **Step 4: Verify session file exists**

  ```bash
  ls -lh .auth/session.json
  ```

  Expected: file exists, size is several kilobytes (it contains cookies and storage state).

  > `session.json` is gitignored — do not commit it.

---

## Task 5: Selector Discovery via Playwright Codegen

> No files to create or commit. This is a discovery step. You record a manual walkthrough of the eSign UI and extract the selectors for Tasks 6–10.

- [ ] **Step 1: Run codegen against the test doc from Task 3**

  Replace `<DOC_URL>` with the URL from Task 3:

  ```bash
  cd scripts/document-generation
  npx playwright codegen \
    --load-storage=.auth/session.json \
    "<DOC_URL>"
  ```

  Two windows open: a Chromium browser (showing the Google Doc) and a code generation panel (showing recorded Playwright code).

- [ ] **Step 2: Perform the full eSign flow manually in the codegen browser**

  In the Chromium window, do each of these steps. Watch the code panel record each action:

  1. Click `Tools` in the Google Docs menu bar
  2. Click `eSignature` in the menu
  3. Wait for the eSign side panel to open
  4. Press `Cmd+H` to open Find & Replace
  5. Click into the Find field and type `[GSIGN_SIG]`
  6. Click the `Replace` button (leave Replace field empty)
  7. Press `Escape` to close Find & Replace
  8. Click the `Signature` button in the eSign side panel
  9. Click the `Request signature` button in the panel
  10. Fill in the document title field
  11. Fill in the signer email field
  12. Click the final send button

- [ ] **Step 3: Extract selectors from the generated code**

  In the code panel, copy all the generated code into a scratch file. Each recorded user action produces one line like:

  ```javascript
  // Examples of what codegen output looks like:
  await page.locator('[aria-label="Tools menu"]').click();
  await page.getByRole('menuitem', { name: 'eSignature' }).click();
  await page.locator('input[aria-label="Find"]').fill('[GSIGN_SIG]');
  await page.getByRole('button', { name: 'Replace' }).click();
  ```

  The **selector** is the argument to `locator()`, `getByRole()`, `getByLabel()`, etc. For each action below, find the corresponding line in the generated code and copy the selector string into the table:

  | Action | Selector from codegen (fill in) |
  |---|---|
  | Click Tools menu | ___________________ |
  | Click eSignature menu item | ___________________ |
  | eSign panel root (to `waitForSelector`) | ___________________ |
  | Find field in Find & Replace | ___________________ |
  | Replace button | ___________________ |
  | Signature button in panel | ___________________ |
  | Request signature button | ___________________ |
  | Document title field in form | ___________________ |
  | Signer email field in form | ___________________ |
  | Final send button | ___________________ |
  | Success confirmation element | ___________________ |

  > **If a step didn't record (e.g., `Cmd+H` keyboard shortcut):** Keyboard shortcuts are not recorded by codegen — keep the `page.keyboard.press('Meta+H')` line as written. For the dialog that opens after the shortcut, use the Inspector: in the paused browser, click the target element, then run `$0` in the browser DevTools console to see its attributes, or hover it in the Inspector panel to see the suggested Playwright selector.

  Close the codegen windows when done.

---

## Task 6: `esign-request.js` — Skeleton + Step 1 (Load Doc)

**Files:**
- Create: `scripts/document-generation/esign-request.js`

- [ ] **Step 1: Create `esign-request.js` with skeleton and `loadDoc`**

  Create `scripts/document-generation/esign-request.js` with this exact content:

  ```javascript
  // esign-request.js
  //
  // Drives the Google Workspace eSignature UI to send an order doc for
  // client signature. Requires a saved session from esign-setup.js.
  //
  // Usage:
  //   node esign-request.js \
  //     --docUrl="https://docs.google.com/document/d/..." \
  //     --email="client@district.edu" \
  //     --title="Order — Springfield Unified — FM-2026-0042"

  const { chromium } = require('@playwright/test');
  const path = require('path');
  const fs   = require('fs');

  // ── CLI args ─────────────────────────────────────────────────────────────────
  function parseArgs() {
    const args = {};
    process.argv.slice(2).forEach(arg => {
      const [key, ...rest] = arg.replace(/^--/, '').split('=');
      args[key] = rest.join('=');
    });
    return args;
  }

  // ── Step 1: Load the Google Doc ───────────────────────────────────────────────
  async function loadDoc(page, docUrl) {
    await page.goto(docUrl, { waitUntil: 'domcontentloaded' });
    // .docs-title-input is present once the Google Docs editor has fully loaded
    await page.waitForSelector('.docs-title-input', { timeout: 20000 });
    console.log('✓ Step 1: Doc loaded');
  }

  // ── Main ─────────────────────────────────────────────────────────────────────
  async function main() {
    const { docUrl, email, title } = parseArgs();
    if (!docUrl || !email || !title) {
      console.error('Usage: node esign-request.js --docUrl=... --email=... --title=...');
      process.exit(1);
    }

    const sessionPath = path.join(__dirname, '.auth', 'session.json');
    if (!fs.existsSync(sessionPath)) {
      console.error('No session found at .auth/session.json');
      console.error('Run: npm run setup');
      process.exit(1);
    }

    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({ storageState: sessionPath });
    const page    = await context.newPage();

    try {
      await loadDoc(page, docUrl);
      await page.pause(); // TEMP — verify doc loaded, then remove this line
    } catch (err) {
      await page.screenshot({ path: 'esign-error.png', fullPage: false });
      console.error('✗ eSign failed:', err.message);
      console.error('  Screenshot saved: esign-error.png');
      process.exit(1);
    } finally {
      await browser.close();
    }
  }

  main();
  ```

- [ ] **Step 2: Run and verify Step 1 works**

  ```bash
  node esign-request.js \
    --docUrl="<URL from Task 3>" \
    --email="test@example.com" \
    --title="Test Order"
  ```

  Expected: Chromium opens, the Google Doc loads, the Playwright Inspector opens (from `page.pause()`). Confirm the doc title is visible in the browser. Close the Inspector to end the run.

- [ ] **Step 3: Remove `page.pause()` and commit**

  Delete the line `await page.pause(); // TEMP...` from `main()`.

  ```bash
  git add scripts/document-generation/esign-request.js
  git commit -m "feat(document-generation): add esign-request.js skeleton with doc loading"
  ```

---

## Task 7: Step 2 — Open eSign Panel

**Files:**
- Modify: `scripts/document-generation/esign-request.js`

- [ ] **Step 1: Add `openESignPanel` function**

  Add this function to `esign-request.js` **before** `main()`. Replace the selector strings with the ones you recorded in Task 5:

  ```javascript
  // ── Step 2: Open eSignature side panel ───────────────────────────────────────
  async function openESignPanel(page) {
    // Click the Tools menu in the Google Docs menu bar
    // SELECTOR SOURCE: Task 5 codegen output → update if different
    await page.getByRole('menubar').getByText('Tools').click();

    // Click eSignature in the dropdown
    const eSignItem = page.getByRole('menuitem', { name: 'eSignature' });
    const visible   = await eSignItem.isVisible({ timeout: 3000 }).catch(() => false);
    if (!visible) {
      throw new Error(
        'eSignature option not found in Tools menu. ' +
        'Confirm Google Workspace plan is Business Standard or higher.'
      );
    }
    await eSignItem.click();

    // Wait for the side panel to appear
    // SELECTOR SOURCE: Task 5 codegen output → update with actual panel root selector
    await page.waitForSelector('[aria-label="eSignature"]', { timeout: 10000 });
    console.log('✓ Step 2: eSign panel opened');
  }
  ```

- [ ] **Step 2: Call `openESignPanel` in `main()` and add a pause**

  Inside the `try` block in `main()`, update it to:

  ```javascript
    try {
      await loadDoc(page, docUrl);
      await openESignPanel(page);
      await page.pause(); // TEMP
    } catch (err) {
  ```

- [ ] **Step 3: Run and verify**

  ```bash
  node esign-request.js --docUrl="<URL>" --email="test@example.com" --title="Test"
  ```

  Expected: doc loads, eSign side panel opens on the right side of the screen, Playwright Inspector pauses. If the selector doesn't find the Tools menu or eSignature item, use the Inspector's element picker to find the correct selector, update the code, and re-run.

- [ ] **Step 4: Remove `page.pause()` and commit**

  ```bash
  git add scripts/document-generation/esign-request.js
  git commit -m "feat(document-generation): open eSign panel (Step 2)"
  ```

---

## Task 8: Step 3 — Find & Replace `[GSIGN_SIG]`

**Files:**
- Modify: `scripts/document-generation/esign-request.js`

- [ ] **Step 1: Add `removePlaceholder` function**

  Add this function before `main()`:

  ```javascript
  // ── Step 3: Find & Replace [GSIGN_SIG] → empty (places cursor at deletion site) ─
  async function removePlaceholder(page) {
    // Open Find & Replace dialog
    await page.keyboard.press('Meta+H'); // Mac: Cmd+H. Linux/Windows: change to 'Control+H'

    // Fill the Find field with the placeholder tag
    // SELECTOR SOURCE: Task 5 codegen output → update with actual Find input selector
    const findInput = page.getByLabel('Find');
    await findInput.waitFor({ state: 'visible', timeout: 5000 });
    await findInput.fill('[GSIGN_SIG]');

    // Ensure Replace field is empty (it should be by default)
    // SELECTOR SOURCE: Task 5 codegen → update with actual Replace input selector
    const replaceInput = page.getByLabel('Replace with');
    if (await replaceInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      await replaceInput.fill('');
    }

    // Click Replace (replaces the first match with nothing)
    // SELECTOR SOURCE: Task 5 codegen → update with actual Replace button selector
    await page.getByRole('button', { name: 'Replace' }).click();

    // Close the dialog
    await page.keyboard.press('Escape');

    // Small wait for the document to settle after the replacement
    await page.waitForTimeout(500);

    console.log('✓ Step 3: [GSIGN_SIG] placeholder removed, cursor positioned');
  }
  ```

- [ ] **Step 2: Call `removePlaceholder` in `main()` and add a pause**

  ```javascript
    try {
      await loadDoc(page, docUrl);
      await openESignPanel(page);
      await removePlaceholder(page);
      await page.pause(); // TEMP
    } catch (err) {
  ```

- [ ] **Step 3: Run and verify**

  ```bash
  node esign-request.js --docUrl="<URL>" --email="test@example.com" --title="Test"
  ```

  Expected: Doc loads → eSign panel opens → Find & Replace runs → `[GSIGN_SIG]` disappears from the buyer cell → Inspector pauses. Open the doc in the paused browser and confirm:
  - The `[GSIGN_SIG]` text is gone from the buyer signature cell
  - The cursor appears to be positioned in that cell (click somewhere else and undo to check)

  If the Find & Replace dialog selectors don't match, use the Inspector to find the correct ones.

- [ ] **Step 4: Remove `page.pause()` and commit**

  ```bash
  git add scripts/document-generation/esign-request.js
  git commit -m "feat(document-generation): find-and-replace GSIGN_SIG placeholder (Step 3)"
  ```

---

## Task 9: Steps 4–5 — Insert Signature Field + Click Request Signature

**Files:**
- Modify: `scripts/document-generation/esign-request.js`

- [ ] **Step 1: Add `insertSignatureField` function**

  Add this function before `main()`:

  ```javascript
  // ── Step 4: Click Signature in the eSign side panel ──────────────────────────
  async function insertSignatureField(page) {
    // Click the Signature field button in the panel.
    // The field is placed at the current document cursor position —
    // which is where [GSIGN_SIG] was before Step 3 deleted it.
    // SELECTOR SOURCE: Task 5 codegen output → update with actual button selector
    await page.getByRole('button', { name: 'Signature' }).click();

    // Brief wait for the field to render in the document
    await page.waitForTimeout(800);
    console.log('✓ Step 4: Signature field inserted');
  }
  ```

- [ ] **Step 2: Add `clickRequestSignature` function**

  ```javascript
  // ── Step 5: Click "Request signature" to advance to the send form ─────────────
  async function clickRequestSignature(page) {
    // SELECTOR SOURCE: Task 5 codegen output → update if needed
    await page.getByRole('button', { name: 'Request signature' }).click();

    // Wait for the send form to appear (either a modal or an expanded panel)
    // SELECTOR SOURCE: Task 5 codegen → update with actual form container selector
    await page.waitForSelector('[aria-label="Request signature"]', { timeout: 8000 });
    console.log('✓ Step 5: Request signature form opened');
  }
  ```

- [ ] **Step 3: Call both functions in `main()` with a pause**

  ```javascript
    try {
      await loadDoc(page, docUrl);
      await openESignPanel(page);
      await removePlaceholder(page);
      await insertSignatureField(page);
      await clickRequestSignature(page);
      await page.pause(); // TEMP
    } catch (err) {
  ```

- [ ] **Step 4: Run and verify**

  ```bash
  node esign-request.js --docUrl="<URL>" --email="test@example.com" --title="Test"
  ```

  Expected: Signature field is visible in the buyer cell, the "Request signature" send form is open in the panel, Inspector pauses. Confirm the field landed in the correct cell (buyer, not seller).

  > If the field lands in the wrong cell, the cursor positioning in Step 3 needs adjustment. Add a `page.pause()` after `removePlaceholder()` instead to inspect where the cursor is before the click.

- [ ] **Step 5: Remove `page.pause()` and commit**

  ```bash
  git add scripts/document-generation/esign-request.js
  git commit -m "feat(document-generation): insert Signature field and open send form (Steps 4-5)"
  ```

---

## Task 10: Steps 6–8 — ToS, Form Fill, Submit + Error Handling + End-to-End

**Files:**
- Modify: `scripts/document-generation/esign-request.js`

- [ ] **Step 1: Add `acceptToSIfPresent` function**

  Add before `main()`:

  ```javascript
  // ── Step 6: Accept Terms of Service if shown (first run only) ─────────────────
  async function acceptToSIfPresent(page) {
    // Google shows a ToS dialog on the first eSign request from an account.
    // After accepting once, it doesn't appear again.
    // SELECTOR SOURCE: Task 5 codegen — if you saw a ToS dialog, fill in the selector.
    // If you didn't see one during codegen, this check will pass immediately.
    const tosButton = page.getByRole('button', { name: /accept|agree/i });
    const visible   = await tosButton.isVisible({ timeout: 2000 }).catch(() => false);
    if (visible) {
      await tosButton.click();
      console.log('✓ Step 6: ToS accepted');
    } else {
      console.log('✓ Step 6: No ToS dialog (skipped)');
    }
  }
  ```

- [ ] **Step 2: Add `fillAndSubmitForm` function**

  ```javascript
  // ── Steps 7–8: Fill the send form and submit ──────────────────────────────────
  async function fillAndSubmitForm(page, { title, email }) {
    // Fill document title
    // SELECTOR SOURCE: Task 5 codegen output
    const titleField = page.getByLabel('Document title');
    if (await titleField.isVisible({ timeout: 3000 }).catch(() => false)) {
      await titleField.clear();
      await titleField.fill(title);
    }

    // Fill signer email
    // SELECTOR SOURCE: Task 5 codegen output
    const emailField = page.getByLabel(/email/i).first();
    await emailField.waitFor({ state: 'visible', timeout: 5000 });
    await emailField.fill(email);

    // Leave reminder and locale at defaults
    console.log('✓ Step 7: Form filled');

    // Click the final send button
    // SELECTOR SOURCE: Task 5 codegen output
    await page.getByRole('button', { name: /request signature/i }).last().click();

    // Wait for success confirmation — toast, banner, or page change
    // SELECTOR SOURCE: Task 5 codegen — update with actual confirmation element
    await page.getByText(/sent|request sent|signature request/i)
      .waitFor({ timeout: 15000 });
    console.log('✓ Step 8: eSign request submitted');
  }
  ```

- [ ] **Step 3: Update `main()` to the complete final version**

  Replace the entire `main()` function with:

  ```javascript
  async function main() {
    const { docUrl, email, title } = parseArgs();
    if (!docUrl || !email || !title) {
      console.error('Usage: node esign-request.js --docUrl=... --email=... --title=...');
      process.exit(1);
    }

    const sessionPath = path.join(__dirname, '.auth', 'session.json');
    if (!fs.existsSync(sessionPath)) {
      console.error('No session found at .auth/session.json');
      console.error('Run: npm run setup');
      process.exit(1);
    }

    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({ storageState: sessionPath });
    const page    = await context.newPage();

    try {
      await loadDoc(page, docUrl);
      await openESignPanel(page);
      await removePlaceholder(page);
      await insertSignatureField(page);
      await clickRequestSignature(page);
      await acceptToSIfPresent(page);
      await fillAndSubmitForm(page, { title, email });

      await page.screenshot({ path: 'esign-success.png', fullPage: false });
      console.log('');
      console.log('✓ eSign request sent successfully.');
      console.log('  Screenshot: esign-success.png');
    } catch (err) {
      await page.screenshot({ path: 'esign-error.png', fullPage: false });
      console.error('');
      console.error('✗ eSign automation failed:', err.message);
      console.error('  Screenshot: esign-error.png');
      process.exit(1);
    } finally {
      await browser.close();
    }
  }
  ```

- [ ] **Step 4: Run the complete flow end-to-end**

  Use a real test email address (your own or a test alias) as `--email`:

  ```bash
  node esign-request.js \
    --docUrl="<URL from Task 3>" \
    --email="aston.arcega+test@fullmindlearning.com" \
    --title="Order — Springfield Unified — FM-2026-0042"
  ```

  Expected console output:
  ```
  ✓ Step 1: Doc loaded
  ✓ Step 2: eSign panel opened
  ✓ Step 3: [GSIGN_SIG] placeholder removed, cursor positioned
  ✓ Step 4: Signature field inserted
  ✓ Step 5: Request signature form opened
  ✓ Step 6: No ToS dialog (skipped)
  ✓ Step 7: Form filled
  ✓ Step 8: eSign request submitted

  ✓ eSign request sent successfully.
    Screenshot: esign-success.png
  ```

- [ ] **Step 5: Verify success criteria**

  - [ ] Open `esign-success.png` — shows Google's confirmation screen
  - [ ] Open the Google Doc — `[GSIGN_SIG]` is gone, a Signature field widget is visible in the buyer cell
  - [ ] Check `aston.arcega+test@fullmindlearning.com` inbox — Google eSign email arrived from your account
  - [ ] The email contains a "Review and sign" link

- [ ] **Step 6: Commit the final script**

  ```bash
  git add scripts/document-generation/esign-request.js
  git commit -m "feat(document-generation): complete Google eSign Playwright automation (Steps 6-8)"
  ```

- [ ] **Step 7: Final branch commit summary**

  ```bash
  git log --oneline feat/document-generation-poc | head -8
  ```

  Expected to see the new commits at the top of the log.

---

## Done

The pipeline is complete:

1. `runEndToEndTest()` in Apps Script → generates doc with `[GSIGN_SIG]`, logs the `node esign-request.js ...` command
2. Copy the command from the log, run it in the terminal
3. Playwright drives the full eSign UI → client receives signing email

**Future auth upgrade (no automation changes):** When per-rep identity is needed, swap `session.json` for a rep-specific session generated from a stored OAuth refresh token. The step functions don't change.
