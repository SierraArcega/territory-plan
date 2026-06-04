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
