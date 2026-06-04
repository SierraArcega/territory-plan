# Google eSign Browser Automation — Design Spec

**Date:** 2026-05-26  
**Branch:** `feat/document-generation-poc`  
**Status:** Approved for implementation planning  
**Goal:** Automate the Google Workspace eSignature UI flow using Playwright so that generating a document and sending it for client signature requires zero manual steps.

---

## 1. Problem & Context

The existing Apps Script pipeline (`Code.gs` → `generateOrderDocument()`) produces a completed Google Doc and — via the Dropbox Sign API path — sends it for e-signature programmatically. The Google Workspace eSignature feature (available at no extra cost on Business Standard+) has no public REST API; it is UI-only. A human rep must currently open the generated Doc, navigate to `Tools → eSignature`, place the signature field, and send — a manual step that breaks the otherwise fully automated pipeline.

This spec describes a Playwright script that performs that UI workflow automatically, making the Google eSign path fully headless from the rep's perspective.

---

## 2. Scope

**In scope:**
- `GSign.gs`: new Apps Script function that inserts a findable text placeholder in the buyer signature cell
- `esign-setup.js`: one-time session auth setup script
- `esign-request.js`: Playwright automation that drives the full eSign UI flow
- Updates to `Code.gs` to support a `USE_GOOGLE_ESIGN` flag

**Out of scope:**
- Per-rep OAuth identity (auth layer swap is designed in but not implemented now — see Section 7)
- Date Signed field placement (single Signature field only for this phase)
- Integration into the territory-plan Next.js app
- Batch / multi-document generation

---

## 3. Architecture Overview

```
Apps Script (generateOrderDocument)
  └── addGSignPlaceholders(body)
        └── inserts [GSIGN_SIG] in buyer signature cell
              │
              ▼
  Doc saved to Drive (no PDF export on this path)
              │
              ▼ (manual trigger for now: copy docUrl from logs)
              │
Node.js Playwright (esign-request.js)
  └── loads .auth/session.json  ← your saved Google session
  └── navigates to docUrl
  └── opens eSignature side panel (Tools → eSignature)
  └── Cmd+H → find [GSIGN_SIG] → replace with empty → close
  └── clicks Signature in panel  ← field placed at cursor
  └── clicks Request signature
  └── accepts ToS if present
  └── fills form (title, client email)
  └── submits → client receives signing email
```

**Trigger (now):** Manual. Apps Script logs the `docUrl`; rep runs `node esign-request.js --docUrl ... --email ... --title ...` from the terminal.

**Trigger (future):** Called automatically by the Next.js API route after `generateOrderDocument()` completes. Auth layer swaps from session file to per-rep OAuth token (see Section 7). Automation code unchanged.

---

## 4. Apps Script Changes

### 4.1 New file: `GSign.gs`

Adds a findable text placeholder in the buyer signature cell. The placeholder is normal-sized, visible black text — intentionally readable during testing to confirm placement. It is removed by the Playwright script before the eSign request is sent; it never appears in the final signed document.

```javascript
// ─────────────────────────────────────────────────────────────────────────────
// GSIGN
// Inserts a text anchor placeholder for the Playwright eSign automation.
// Playwright finds [GSIGN_SIG] via Cmd+H (Find & Replace → replace with empty),
// then inserts the Signature field at the resulting cursor position.
//
// Parallel to addESignAnchorTags() which serves the Dropbox Sign path.
// ─────────────────────────────────────────────────────────────────────────────

function addGSignPlaceholders(body) {
  var tables   = body.getTables();
  var placed   = false;

  for (var t = 0; t < tables.length && !placed; t++) {
    var table = tables[t];
    for (var r = 0; r < table.getNumRows() && !placed; r++) {
      var row = table.getRow(r);
      for (var c = 0; c < row.getNumCells() && !placed; c++) {
        var cell = row.getCell(c);
        if (cell.getText().indexOf('Authorized Representative, Buyer') !== -1) {
          cell.appendParagraph('[GSIGN_SIG]');
          placed = true;
          Logger.log('GSign placeholder inserted in buyer signature cell.');
        }
      }
    }
  }

  if (!placed) {
    Logger.log('Warning: buyer signature cell not found. ' +
               'Check "Authorized Representative, Buyer" exists in template.');
  }
}
```

### 4.2 Updated `Code.gs` — `USE_GOOGLE_ESIGN` flag

```javascript
// ── Signing path selector ──────────────────────────────────────────────────
// true  → Google eSign path: adds [GSIGN_SIG] placeholder, no PDF export.
//         Playwright esign-request.js drives the UI to send for signature.
// false → Dropbox Sign path: adds invisible anchor tags, exports PDF,
//         calls Dropbox Sign REST API (original POC behaviour).
var USE_GOOGLE_ESIGN = true;
```

In `generateOrderDocument()`, replace the existing eSign block:

```javascript
  // 4.5  Prepare for signing
  if (USE_GOOGLE_ESIGN) {
    addGSignPlaceholders(body);
    Logger.log('GSign placeholder added. Run esign-request.js with this doc URL:');
    Logger.log(docCopy.getUrl());
    // No PDF export needed — Google eSign operates on the native Google Doc.
  } else {
    addESignAnchorTags(body);
    Logger.log('eSign anchor tags added.');
  }

  doc.saveAndClose();
  Logger.log('Document saved.');

  if (!USE_GOOGLE_ESIGN) {
    // 6. Export PDF (Dropbox Sign path only)
    var pdfBlob = DriveApp.getFileById(docCopy.getId()).getAs('application/pdf');
    pdfBlob.setName(docTitle + '.pdf');
    var pdfFile = pdfFolder.createFile(pdfBlob);
    Logger.log('PDF exported: ' + pdfFile.getUrl());

    // 7. Send for e-signature via Dropbox Sign API
    if (data.signerEmail && data.signerEmail !== 'test@example.com') {
      var eSignResult = sendForDropboxSign(
        pdfFile.getId(), data.signerEmail, data.signerName, docTitle
      );
      Logger.log('Dropbox Sign request ID: ' + eSignResult.signatureRequestId);
    }
  }
```

---

## 5. Playwright Script

### 5.1 File structure

```
scripts/document-generation/
  ├── GSign.gs               ← new Apps Script file (Section 4.1)
  ├── Code.gs                ← updated (Section 4.2)
  ├── [all other .gs files]  ← unchanged
  │
  ├── package.json           ← Node.js project, Playwright dependency
  ├── esign-setup.js         ← one-time session auth setup
  ├── esign-request.js       ← main automation script
  │
  └── .auth/
        └── session.json     ← gitignored — saved Google session cookies
```

**`.gitignore` additions:**
```
scripts/document-generation/.auth/
scripts/document-generation/node_modules/
```

**`package.json`:**
```json
{
  "name": "document-generation",
  "version": "1.0.0",
  "description": "Google eSign Playwright automation",
  "scripts": {
    "setup": "node esign-setup.js",
    "esign": "node esign-request.js"
  },
  "dependencies": {
    "@playwright/test": "latest"
  }
}
```

### 5.2 `esign-setup.js` — one-time auth

Run once (and again when session cookies expire, typically weeks to months):

```javascript
// esign-setup.js
// Run: node esign-setup.js
// Opens a real browser window. Log in to Google manually. Session is saved.

const { chromium } = require('@playwright/test');
const path = require('path');
const fs   = require('fs');

(async () => {
  const authDir = path.join(__dirname, '.auth');
  if (!fs.existsSync(authDir)) fs.mkdirSync(authDir);

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page    = await context.newPage();

  await page.goto('https://accounts.google.com');
  console.log('Log in to Google in the browser window that just opened.');
  console.log('When you are fully signed in, come back here and press Enter...');

  await new Promise(resolve => process.stdin.once('data', resolve));

  await context.storageState({ path: path.join(authDir, 'session.json') });
  console.log('Session saved to .auth/session.json');
  await browser.close();
})();
```

### 5.3 `esign-request.js` — main automation

**CLI usage:**
```bash
node esign-request.js \
  --docUrl "https://docs.google.com/document/d/..." \
  --email  "dr.holloway@springfield.edu" \
  --title  "Order — Springfield Unified — FM-2026-0042"
```

**Script structure (pseudocode — selectors confirmed during implementation):**

```javascript
// esign-request.js
const { chromium } = require('@playwright/test');
const path = require('path');

// ── Parse CLI args ────────────────────────────────────────────────────────────
const args   = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => a.slice(2).split('='))
    .map(([k, ...v]) => [k, v.join('=')])
);
const { docUrl, email, title } = args;
if (!docUrl || !email || !title) {
  console.error('Usage: node esign-request.js --docUrl=... --email=... --title=...');
  process.exit(1);
}

(async () => {
  const browser = await chromium.launch({ headless: false }); // visible for debugging
  const context = await browser.newContext({
    storageState: path.join(__dirname, '.auth', 'session.json')
  });
  const page = await context.newPage();

  try {
    // Step 1 — Load the Doc
    await page.goto(docUrl);
    await page.waitForSelector('.docs-title-input', { timeout: 15000 });

    // Step 2 — Open eSignature panel
    await page.click('[aria-label="Tools menu"]');
    const eSignOption = page.locator('text=eSignature');
    if (!(await eSignOption.isVisible({ timeout: 3000 }))) {
      throw new Error('eSignature not found in Tools menu. ' +
                      'Confirm Google Workspace plan is Business Standard or higher.');
    }
    await eSignOption.click();
    await page.waitForSelector('/* eSign panel root selector */', { timeout: 10000 });

    // Step 3 — Find & delete [GSIGN_SIG] placeholder
    await page.keyboard.press('Meta+H'); // Cmd+H on Mac (Ctrl+H on Linux/Windows)
    // Fill Find field
    await page.fill('/* find input selector */', '[GSIGN_SIG]');
    // Leave Replace field empty (should default to empty)
    await page.click('/* Replace button */');
    // Confirm one match found — if zero, placeholder wasn't placed by Apps Script
    const replaceCount = await page.locator('/* match count indicator */').textContent();
    if (replaceCount === '0') {
      throw new Error('[GSIGN_SIG] placeholder not found in document. ' +
                      'Confirm addGSignPlaceholders() ran in Apps Script.');
    }
    await page.keyboard.press('Escape'); // close Find & Replace

    // Step 4 — Insert Signature field
    await page.click('/* Signature button in eSign side panel */');

    // Step 5 — Click "Request signature"
    await page.click('text=Request signature');

    // Step 6 — Accept ToS if present (first run only)
    const tos = page.locator('/* ToS accept button */');
    if (await tos.isVisible({ timeout: 2000 }).catch(() => false)) {
      await tos.click();
    }

    // Step 7 — Fill send form
    await page.fill('/* document title field */', title);
    await page.fill('/* signer email field */',   email);
    // Leave reminders and locale at defaults

    // Step 8 — Submit
    await page.click('/* final Request signature send button */');
    await page.waitForSelector('/* success confirmation */', { timeout: 10000 });

    await page.screenshot({ path: 'esign-success.png' });
    console.log('eSign request sent successfully. Screenshot: esign-success.png');

  } catch (err) {
    await page.screenshot({ path: 'esign-error.png' });
    console.error('eSign automation failed:', err.message);
    console.error('Screenshot saved: esign-error.png');
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
```

> **Note:** Selectors marked `/* ... */` are placeholders. The exact `aria-label`, `role`, and class values for the Google Docs eSignature panel are confirmed during implementation by inspecting the live UI. This is expected — Google Docs uses dynamic class names; aria-labels and roles are the reliable hook points.

---

## 6. Automation Sequence — Full Step Reference

| Step | Action | Error condition |
|---|---|---|
| 1 | Navigate to `docUrl`, wait for Docs to load | Timeout → not a Docs URL, or not logged in |
| 2 | `Tools → eSignature` | Option absent → wrong Workspace plan |
| 3a | `Cmd+H` → find `[GSIGN_SIG]` → replace with empty | Zero matches → Apps Script didn't run `addGSignPlaceholders()` |
| 3b | Close Find & Replace | — |
| 4 | Click Signature in eSign panel | Panel not visible → Step 2 failed silently |
| 5 | Click `Request signature` | Button absent → no field placed in Step 4 |
| 6 | Accept ToS if present | — (conditional, non-fatal if absent) |
| 7 | Fill title + email | — |
| 8 | Click send, wait for confirmation | Timeout → network/auth error |

---

## 7. Future: Per-Rep Identity

When eSign requests need to appear from each individual rep (not from a single shared account), the only change is in how the browser context is authenticated before Step 1. The automation code (Steps 1–8) is identical.

**Phase 1 (now):** `session.json` is your saved session. All requests come from `aston.arcega@fullmindlearning.com`.

**Phase 2 (production):** Each rep completes a one-time "Connect Google" OAuth flow in the territory-plan app (similar to the existing Calendar sync OAuth). The app stores a refresh token per user. Before running `esign-request.js` for a given rep, the server:

1. Fetches the rep's refresh token from the database
2. Exchanges it for an access token via Google's OAuth endpoint
3. Generates a rep-specific `session-{repId}.json` by injecting the resulting session cookies
4. Passes `--sessionFile session-{repId}.json` to `esign-request.js`

The `browser.newContext({ storageState: sessionFile })` line is the only line that changes. Everything else is unchanged.

---

## 8. Success Criteria

- [ ] `npm run setup` opens a browser, allows manual Google login, saves `session.json`
- [ ] Apps Script with `USE_GOOGLE_ESIGN = true` inserts `[GSIGN_SIG]` in the buyer cell and logs the doc URL
- [ ] `node esign-request.js --docUrl=... --email=... --title=...` completes without error
- [ ] `[GSIGN_SIG]` is absent from the final document (deleted by Find & Replace)
- [ ] Signature field appears in the client signature block
- [ ] Client receives a Google eSign email at the specified address
- [ ] `esign-success.png` is saved confirming the send confirmation screen
- [ ] If `[GSIGN_SIG]` is missing from the doc, the script exits with a clear error message

---

## 9. Known Unknowns (Resolved During Implementation)

| Unknown | Resolution approach |
|---|---|
| Exact `aria-label` / selector for Tools menu in Google Docs | Inspect live DOM with browser DevTools |
| eSign side panel root selector and Signature button selector | Same — inspect after `Tools → eSignature` |
| Find & Replace input selectors in Google Docs | Same — inspect after `Cmd+H` |
| Whether `Cmd+H` Replace leaves cursor at the deletion site reliably | Verify with a manual test before coding the step |
| Whether Google detects and blocks Playwright's Chromium | Test with `headless: false`; if blocked, use `chromium.launch({ channel: 'chrome' })` to use the system Chrome install |
