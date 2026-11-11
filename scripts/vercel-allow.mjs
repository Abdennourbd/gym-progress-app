/**
 * Clicks "Allow Access" on the Vercel device authorization screen.
 *
 *   node scripts/vercel-allow.mjs <cdpUrl>
 */
import { chromium } from '@playwright/test';

const cdpUrl = process.argv[2];
if (!cdpUrl) {
  console.error('usage: node scripts/vercel-allow.mjs <cdpUrl>');
  process.exit(1);
}

const browser = await chromium.connectOverCDP(cdpUrl);
const context = browser.contexts()[0];
const page = context.pages()[0];

console.log('url:', page.url());

const allow = page.getByRole('button', { name: /allow access/i }).first();
if (!(await allow.count())) {
  console.log('no Allow Access button found');
  console.log((await page.locator('body').innerText()).slice(0, 500));
  process.exit(1);
}

await allow.click();
await page.waitForTimeout(5000);

console.log('after click:', (await page.locator('body').innerText()).slice(0, 500));
await page.screenshot({ path: '/tmp/opencode/vercel-allowed.png' });

await browser.close();
console.log('done');
