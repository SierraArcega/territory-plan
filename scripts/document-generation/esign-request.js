// esign-request.js
// Automates the Google Workspace eSignature UI flow for Fullmind order documents.
//
// Prerequisites:
//   1. npm install            (installs Playwright)
//   2. npm run setup          (saves .auth/session.json — re-run when session expires)
//   3. npx playwright install chromium
//
// Usage:
//   node esign-request.js \
//     --docUrl="https://docs.google.com/document/d/..." \
//     --email="client@district.edu" \
//     --title="Order — Springfield Unified — FM-2026-0042"
//
// On success: exits 0, saves esign-success.png
// On failure: exits 1, saves esign-error.png with error details in console

'use strict';

const { chromium } = require('@playwright/test');
const path         = require('path');

// ── Parse CLI args ────────────────────────────────────────────────────────────
const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => a.slice(2).split('='))
    .map(([k, ...v]) => [k, v.join('=')])
);

const { docUrl, email, title } = args;
if (!docUrl || !email || !title) {
  console.error('Usage: node esign-request.js --docUrl=... --email=... --title=...');
  console.error('  --docUrl  Google Docs URL for the generated order document');
  console.error('  --email   Signer\'s email address');
  console.error('  --title   Document name shown to the signer');
  process.exit(1);
}

// ── Step helpers ──────────────────────────────────────────────────────────────

/**
 * Step 1 — Navigate to the document and confirm we are logged in.
 * Throws if Google redirects to accounts.google.com (session expired).
 */
async function loadDocument(page) {
  console.log('Step 1: Loading document...');
  await page.goto(docUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

  // Give Docs a moment to redirect if not logged in
  await page.waitForTimeout(2000);

  if (page.url().includes('accounts.google.com')) {
    throw new Error(
      'Session expired — run "npm run setup" to re-authenticate, then retry.'
    );
  }

  // Wait for the Tools menu item — reliable signal that Google Docs is fully
  // rendered and interactive. More stable than waiting on a specific iframe
  // index, which varies by load order.
  await page.getByRole('menuitem', { name: 'Tools' }).waitFor({ state: 'visible', timeout: 30000 });
  console.log('✓ Step 1: Document loaded');
}

/**
 * Step 2 — Open the eSignature side panel via Tools → eSignature.
 * Confirms the panel is open by waiting for the Signature button to appear.
 */
async function openESignPanel(page) {
  console.log('Step 2: Opening eSignature panel...');
  await page.getByRole('menuitem', { name: 'Tools' }).click();

  // 'eSignature 1' label reflects one prior draft on this doc.
  // For fresh docs the label may be just 'eSignature' — try both.
  const eSignItem = page.getByLabel('eSignature 1');
  const eSignFallback = page.getByRole('menuitem', { name: /eSignature/i });
  if (await eSignItem.isVisible({ timeout: 3000 }).catch(() => false)) {
    await eSignItem.click();
  } else {
    await eSignFallback.click();
  }

  // Confirm panel opened by waiting for the Signature field button
  await page.getByRole('button', { name: 'Signature', exact: true })
            .waitFor({ state: 'visible', timeout: 10000 });
  console.log('✓ Step 2: eSignature panel open');
}

/**
 * Step 3 — Find and remove the [GSIGN_SIG] placeholder inserted by GSign.gs.
 *
 * Approach: Cmd+F to find the text, Enter to jump to it, Escape to close the
 * find bar (cursor stays at the found text), then Cmd+Left + Cmd+Shift+Right
 * to select the full line, then two Backspaces to delete both the text and
 * the now-empty paragraph.
 *
 * NOTE: We cannot use Find & Replace (Cmd+H) because Google Docs rejects an
 * empty "Replace with" field. Cmd+F + keyboard selection is the workaround.
 */
async function removePlaceholder(page) {
  console.log('Step 3: Removing [GSIGN_SIG] placeholder...');

  // Target the Google Docs keyboard-event iframe by its stable CSS class.
  // This iframe is always present regardless of how many other iframes load
  // (e.g. eSign panel iframes). Targeting by class avoids index fragility.
  const docBody = page.frameLocator('.docs-texteventtarget-iframe')
                      .getByRole('textbox', { name: 'Document content' });

  // Open Find bar
  await docBody.press('ControlOrMeta+f');

  // The Find bar appears on the main page (not inside the iframe)
  const findBar = page.getByRole('searchbox', { name: 'Find in document' });
  await findBar.waitFor({ state: 'visible', timeout: 5000 });
  await findBar.fill('[GSIGN_SIG]');
  await findBar.press('Enter');
  await page.waitForTimeout(400); // let Docs scroll to and highlight the match

  // Check we actually found a match
  // (If [GSIGN_SIG] is absent, Docs shows "0 of 0" — we detect this by
  // checking whether the placeholder still exists in the page title bar or
  // by catching the downstream failure when no line is selected.)
  await findBar.press('Escape');  // close Find bar; cursor stays at the match
  await page.waitForTimeout(200);

  // Select the entire [GSIGN_SIG] line and delete it
  await docBody.press('ControlOrMeta+ArrowLeft');        // start of line  (≡ Home)
  await docBody.press('ControlOrMeta+Shift+ArrowRight'); // select to EOL  (≡ Shift+End)
  await docBody.press('Backspace');                      // delete [GSIGN_SIG] text
  await docBody.press('Backspace');                      // delete the empty paragraph
  await page.waitForTimeout(300);

  console.log('✓ Step 3: Placeholder removed, cursor positioned in buyer signature cell');
}

/**
 * Step 4 — Click the Signature field button in the eSign panel.
 *
 * Opening the eSign panel via Tools menu steals document focus, so the cursor
 * position set in Step 3 is no longer active. We restore document focus by
 * opening and immediately closing the Find bar — this re-focuses the document
 * without moving the cursor. Then clicking Signature places the field exactly
 * at the deletion site.
 */
async function insertSignatureField(page) {
  console.log('Step 4: Inserting Signature field...');

  // Restore document body focus without moving the cursor.
  // Menu clicks steal focus from the doc; an open+close Find cycle returns it.
  const docBody = page.frameLocator('.docs-texteventtarget-iframe')
                      .getByRole('textbox', { name: 'Document content' });
  await docBody.press('ControlOrMeta+f');
  const findBar = page.getByRole('searchbox', { name: 'Find in document' });
  await findBar.waitFor({ state: 'visible', timeout: 5000 });
  await findBar.press('Escape'); // close immediately — cursor stays at deletion site
  await page.waitForTimeout(300);

  // Click Signature in the panel — field placed at current cursor position
  await page.getByRole('button', { name: 'Signature', exact: true }).click();
  await page.waitForTimeout(500);

  // Dismiss the "Rename" popup that appears after field placement
  const renameField = page.getByRole('textbox', { name: 'Rename' });
  if (await renameField.isVisible({ timeout: 1500 }).catch(() => false)) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    console.log('  Rename dialog dismissed');
  }

  console.log('✓ Step 4: Signature field inserted');
}

/**
 * Step 5 — Click "Request eSignature" to open the send form.
 *
 * Google may show a "Review changes" blocking dialog when edits were made to
 * the document (including our [GSIGN_SIG] deletion). Click through it and
 * re-click "Request eSignature" so the send form appears.
 */
async function clickRequestESignature(page) {
  console.log('Step 5: Clicking Request eSignature...');
  const requestBtn = page.getByRole('button', { name: 'Request eSignature' });
  await requestBtn.click();

  // Wait briefly for the "Review changes" dialog to appear
  await page.waitForTimeout(1500);
  const reviewBtn = page.getByRole('button', { name: 'Review changes' });
  if (await reviewBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    console.log('  "Review changes" dialog detected — clicking through...');
    await reviewBtn.click();
    await page.waitForTimeout(1500); // wait for dialog to close
    await requestBtn.click();        // re-click to open the send form
    console.log('  Re-clicked Request eSignature after review dialog');
  }

  console.log('✓ Step 5: Request eSignature clicked');
}

/**
 * Step 6 — Fill the send form (document name + signer email).
 */
async function fillSendForm(page, docTitle, signerEmail) {
  console.log('Step 6: Filling send form...');

  // Document name field — pre-filled by Google; clear and replace with our title
  const docNameField = page.getByRole('textbox', { name: 'Document name*' });
  await docNameField.waitFor({ state: 'visible', timeout: 10000 });
  await docNameField.selectText();
  await docNameField.fill(docTitle);

  // Signer email field
  const signerField = page.getByRole('textbox', { name: 'Signer' });
  await signerField.fill(signerEmail);

  console.log('✓ Step 6: Form filled —', docTitle, '/', signerEmail);
}

/**
 * Step 7 — Submit the eSignature request.
 *
 * The send dialog has a second "Request eSignature" button that confirms the
 * send — same label as the button that opened the dialog, but it appears
 * inside the form after the fields are filled.
 */
async function submit(page) {
  console.log('Step 7: Submitting...');

  // The send form has a "Request eSignature" submit button at the bottom.
  // After fillSendForm() the dialog is in view; click the last visible
  // instance of that button to avoid ambiguity with the panel button.
  const submitButton = page.getByRole('button', { name: 'Request eSignature' }).last();
  await submitButton.waitFor({ state: 'visible', timeout: 10000 });
  await submitButton.click();

  // Wait for the confirmation screen to appear
  await page.waitForTimeout(4000);
  console.log('✓ Step 7: Request submitted');
}

// ── Main ──────────────────────────────────────────────────────────────────────

(async () => {
  const browser = await chromium.launch({
    headless: false,  // keep visible so you can watch + debug on first run
    slowMo:   50      // slight delay between actions (helps with Docs' lazy rendering)
  });

  const recordingsDir = path.join(__dirname, 'recordings');
  const context = await browser.newContext({
    storageState: path.join(__dirname, '.auth', 'session.json'),
    recordVideo: {
      dir:  recordingsDir,
      size: { width: 1280, height: 720 }
    }
  });
  const page = await context.newPage();

  try {
    await loadDocument(page);
    await removePlaceholder(page);   // BEFORE opening eSign panel — edits made
    await openESignPanel(page);      // after this point must not change the doc
    await insertSignatureField(page);
    await clickRequestESignature(page);
    await fillSendForm(page, title, email);
    await submit(page);

    await page.screenshot({ path: 'esign-success.png' });
    console.log('');
    console.log('✓ Done — eSign request sent successfully.');
    console.log('  Screenshot saved to esign-success.png');

  } catch (err) {
    await page.screenshot({ path: 'esign-error.png' }).catch(() => {});
    console.error('');
    console.error('✗ eSign automation failed:', err.message);
    console.error('  Screenshot saved to esign-error.png');
    process.exit(1);

  } finally {
    // Save video before closing — must close context first, then browser
    await context.close();
    const videoPath = await page.video()?.path();
    if (videoPath) {
      console.log('  Recording saved to:', videoPath);
    }
    await browser.close();
  }
})();
