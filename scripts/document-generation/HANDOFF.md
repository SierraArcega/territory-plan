# Document Generation — Context Handoff

**Last updated:** 2026-05-27
**Branch:** `feat/document-generation-poc`
**Purpose:** Paste this file into a new context window to continue working on document generation.

---

## Status

**Both signing paths are fully proven end-to-end:**

| Path | Status | Notes |
|---|---|---|
| **Google eSign** (`USE_GOOGLE_ESIGN = true`) | ✅ Working | Playwright automation sends signing email |
| **Dropbox Sign** (`USE_GOOGLE_ESIGN = false`) | ✅ Working | REST API, test mode active |

**Ultimate goal:** Single button press in the territory-plan app that generates a document from an Opportunity and sends it for client signature — no manual steps. Blocked on: Opportunities need to come into the repo first.

---

## Architecture

```
Apps Script (generateOrderDocument)
  ├── Copy template from Drive
  ├── Replace «TOKEN» merge fields
  ├── Insert pricing table
  ├── Pre-fill Fullmind signature block
  └── Branch on USE_GOOGLE_ESIGN:
        true  → addGSignPlaceholders() → save Doc → log docUrl
                 ↓
                 Node.js Playwright (esign-request.js)
                   → removes [GSIGN_SIG] placeholder
                   → opens eSign panel
                   → places Signature field at cursor
                   → fills send form (title + signer email)
                   → submits → client receives signing email
        false → addESignAnchorTags() → export PDF → Dropbox Sign API
```

---

## Google Drive Configuration

| Item | Value |
|---|---|
| Template Doc ID | `1eyi6PmXOVXG0hUqzNIHozBfNPWUUYuZapNiK3WsIojM` |
| Generated Orders folder | `19ozLBWn3zyX3ZSKRRHq9n0mnhjhkaBFN` |
| Generated PDFs folder | `1etHVzYQb_xKFu6igcYyXxoYUFG8lrE7z` |

**Script Properties (Apps Script editor → ⚙ Project Settings):**

| Property | Notes |
|---|---|
| `DROPBOX_SIGN_API_KEY` | Set — Dropbox Sign path only |
| `TEST_SIGNER_EMAIL` | `aston.arcega+test@fullmindlearning.com` |
| `TEST_SIGNER_NAME` | `TAston-Marty Correa Arcega` |

---

## File Structure

```
scripts/document-generation/
  ├── Code.gs           — main orchestrator (generateOrderDocument)
  ├── Config.gs         — Drive IDs + USE_GOOGLE_ESIGN flag
  ├── GSign.gs          — inserts [GSIGN_SIG] placeholder for Playwright
  ├── ESign.gs          — Dropbox Sign path (anchor tags + API call)
  ├── MergeFields.gs    — replaces «TOKEN» fields
  ├── TableInsertion.gs — inserts dynamic pricing table
  ├── SignatureBlock.gs — pre-fills Fullmind rep signature
  ├── SampleData.gs     — test data (replace with real Opportunity data)
  ├── esign-setup.js    — one-time Playwright auth setup
  ├── esign-request.js  — Playwright automation (7-step eSign flow)
  ├── package.json      — Node.js project (@playwright/test)
  └── .auth/            — gitignored — saved Google session
      └── session.json
```

---

## Running the Google eSign Flow

### Step 1 — One-time setup (or when session expires, typically weeks)
```bash
cd scripts/document-generation
npm install                  # first time only
npm run setup                # opens browser → log in → press Enter
```

### Step 2 — Generate a document
Run `runEndToEndTest()` in the Apps Script editor with `USE_GOOGLE_ESIGN = true` in Config.gs.
Copy the doc URL from the execution log.

### Step 3 — Send for signature
```bash
node esign-request.js \
  --docUrl="https://docs.google.com/document/d/DOC_ID/edit" \
  --email="client@district.edu" \
  --title="Order — District Name — FM-2026-XXXX"
```

The browser opens, runs all 7 steps visibly, and saves `esign-success.png`.
If it fails, `esign-error.png` is saved with a clear console error.
A video recording of each run is saved to `recordings/*.webm`.

---

## How the Playwright Automation Works (step by step)

| Step | What happens | Key detail |
|---|---|---|
| 1 | Navigate to doc, wait for Tools menu | Tools menu appearing = Docs fully rendered |
| 2 | Remove `[GSIGN_SIG]` via Cmd+F | Find bar is on main page, keyboard events go to `docs-texteventtarget-iframe` |
| 3 | Open eSign panel (Tools → eSignature) | Menu clicks steal document focus |
| 4 | Restore focus + insert Signature field | Open+close Find bar restores focus without moving cursor; press Enter on Rename popup to confirm field |
| 5 | Click "Request eSignature" | Handles "Review changes" dialog if it appears |
| 6 | Fill Document name + Signer email | Tab after email to commit the value — critical |
| 7 | Click final "Request eSignature" (submit) | Uses `.last()` to target send form's button |

---

## Hard-Won Debugging Lessons

These are non-obvious — read before touching the script.

### 1. `[GSIGN_SIG]` must be removed BEFORE opening the eSign panel
Google eSign flags any document edit made during the panel session with a "Review changes" dialog. Removing the placeholder BEFORE opening the panel keeps the doc clean. The script handles the dialog anyway as a fallback.

### 2. Google Docs uses an off-screen keyboard iframe
The visible document is rendered via the canvas API. Keyboard events (Cmd+F, arrows, Backspace) must be sent to `.docs-texteventtarget-iframe` — a hidden off-screen iframe that captures text events. Do NOT target `iframe.nth(N)` — the index changes as other iframes load.

### 3. The Find bar lives on the main page, not in the iframe
After pressing Cmd+F on the `docs-texteventtarget-iframe`, the searchbox that appears is `page.getByRole('searchbox', { name: 'Find in document' })` — main page scope, not inside any frame.

### 4. Opening the eSign panel steals document focus
Clicking Tools menu and eSignature panel removes the cursor from the document body. Before clicking "Signature" in the panel, open and immediately close the Find bar to restore focus WITHOUT moving the cursor position.

### 5. The Rename popup after Signature click — press Enter, not Escape
After clicking "Signature" in the eSign panel, a "Rename" textbox appears to label the field. **Pressing Escape cancels the field placement.** Press Enter to keep the field with its default name.

### 6. Tab after the signer email field
Without `signerField.press('Tab')` after filling the email, Google's form doesn't register the value before submit and rejects with "Unable to request eSignature."

### 7. The "eSign request sent" success screen tells you where the PDF went
Google automatically converts the doc to PDF and stores it in the "Generated Orders" folder (same folder as the doc). The success dialog shows the PDF path. This is useful for future automation.

### 8. Shell URL encoding
When pasting doc URLs into the terminal, wrap in double-quotes. Bare `?`, `=`, and `&` in URLs are interpreted as shell special characters. Always strip the `?usp=drivesdk` tracking parameter — it can get corrupted in some shells.

---

## Future Integration Path — Single Button Press

**When Opportunities come into the repo**, here's the full production flow:

```
User clicks "Send Order" in territory-plan app
         ↓
POST /api/documents/generate-order
  → calls Apps Script generateOrderDocument(opportunityData)
  → Apps Script returns { docUrl, contractRef, ... }
         ↓
API route spawns esign-request.js (child_process or queue job):
  node esign-request.js \
    --docUrl="${docUrl}" \
    --email="${opportunity.signerEmail}" \
    --title="Order — ${district.name} — ${contractRef}"
         ↓
Client receives signing email
API route updates Opportunity record: status = "sent_for_signature"
```

**Auth in production:** Replace `session.json` with per-rep OAuth. The Next.js app already has a Google OAuth flow for Calendar sync. Add `https://www.googleapis.com/auth/drive` scope, store refresh tokens per user, and generate a session file before invoking the script. The automation code (Steps 1–7) is unchanged.

**Alternative:** Call the Google Docs + Drive REST API directly from the Next.js API route (no Playwright needed, no browser session). This is cleaner but requires a service account or per-rep OAuth with `https://www.googleapis.com/auth/documents` scope. The Google Workspace eSignature API is still UI-only as of 2026-05-27 — Playwright remains necessary for the eSign step regardless.

---

## Known Issues / Future Polish

| Issue | Priority | Notes |
|---|---|---|
| Session expires (weeks) | Low | Re-run `npm run setup` when it does. Future: per-rep OAuth eliminates this |
| Table styling | Low | Inserted rows inherit placeholder row style; may not match template formatting |
| `$` in ORDER_TOTAL | Low | Currently renders as `USD 3956.36` — Apps Script replaceText treats `$` as Java regex group ref |
| "Acme Industrial Supply Co." in seller header | Low | POC template artifact; production template won't have this |
| `test_mode: '1'` in ESign.gs | Must fix for prod | Remove before live Dropbox Sign sends |
| Video recordings accumulate | Low | `recordings/` is gitignored; delete manually or add a cleanup flag |

---

## Dropbox Sign Path (reference)

Still available by setting `USE_GOOGLE_ESIGN = false` in Config.gs.

- `addESignAnchorTags()` — appends invisible 1pt white `[sig|req|signer1]` / `[date|req|signer1]` tags to buyer signature cell
- `sendForDropboxSign()` — exports PDF and calls Dropbox Sign REST API
- `test_mode: '1'` is active — no real emails, requests visible at https://app.hellosign.com
- API key in Script Properties as `DROPBOX_SIGN_API_KEY`
