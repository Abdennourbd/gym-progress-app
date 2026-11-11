/**
 * Completes the Vercel device login in one persistent browser session.
 *
 * The emailed code is bound to the session that requested it, so the request
 * and the code entry have to happen in the same browser. The code arrives by
 * email, so this script waits for it to be written to a file.
 *
 *   node scripts/vercel-login.mjs <cdpUrl> <codeFile>
 */
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';

const cdpUrl = process.argv[2];
const codeFile = process.argv[3];

if (!cdpUrl || !codeFile) {
  console.error('usage: node scripts/vercel-login.mjs <cdpUrl> <codeFile>');
  process.exit(1);
}

const browser = await chromium.connectOverCDP(cdpUrl);
const context = browser.contexts()[0] ?? (await browser.newContext());
const page = context.pages()[0] ?? (await context.newPage());

async function waitForCode(timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const value = readFileSync(codeFile, 'utf8').trim();
      if (/^\d{6}$/.test(value)) return value;
    } catch {
      // Not written yet.
    }
    await page.waitForTimeout(1500);
  }
  throw new Error('timed out waiting for the login code');
}

console.log('page url:', page.url());
await page.goto('https://vercel.com/oauth/device?user_code=DXQM-ZDPB', {
  waitUntil: 'domcontentloaded',
});
await page.waitForTimeout(2500);

// Request the emailed code.
const emailButton = page.getByText('Continue with Email', { exact: false }).first();
await emailButton.click();
await page.waitForTimeout(1500);

const emailInput = page.locator('input[type="email"]').first();
await emailInput.fill('nounoubendji@gmail.com');
await page.keyboard.press('Enter');
console.log('requested the code');

await page.waitForTimeout(4000);
console.log('after request, page says:', (await page.locator('body').innerText()).slice(0, 300));

// Wait for the code to be delivered by email and typed out by the caller.
const code = await waitForCode(180_000);
console.log('got code:', code);

const boxes = page.locator('input[inputmode="numeric"], input[autocomplete="one-time-code"]');
const count = await boxes.count();
console.log('code boxes:', count);

if (count === 1) {
  await boxes.first().fill(code);
} else {
  for (let i = 0; i < code.length; i += 1) {
    await boxes.nth(i).fill(code[i]);
  }
}

await page.waitForTimeout(600);
await page.screenshot({ path: '/tmp/opencode/vercel-code-entered.png' });
await page.keyboard.press('Enter').catch(() => {});
await page.waitForTimeout(4000);

const submit = page.getByRole('button', { name: /continue|confirm|authorize|verify|submit/i }).first();
if (await submit.count()) {
  await submit.click().catch(() => {});
  await page.waitForTimeout(4000);
}

console.log('page now says:', (await page.locator('body').innerText()).slice(0, 600));
await page.screenshot({ path: '/tmp/opencode/vercel-after-code.png' });

await browser.close();
