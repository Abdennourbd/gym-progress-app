/**
 * Accepts the marketplace terms for an integration so the install can finish.
 *
 *   node scripts/vercel-accept-terms.mjs <cdpUrl> <verificationUri>
 */
import { chromium } from '@playwright/test';

const cdpUrl = process.argv[2];
const uri = process.argv[3];

if (!cdpUrl || !uri) {
  console.error('usage: node scripts/vercel-accept-terms.mjs <cdpUrl> <uri>');
  process.exit(1);
}

const browser = await chromium.connectOverCDP(cdpUrl);
const context = browser.contexts()[0];
const page = context.pages()[0];

await page.goto(uri, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(5000);

console.log('== at:', page.url());
console.log((await page.locator('body').innerText()).slice(0, 1200));
await page.screenshot({ path: '/tmp/opencode/v-terms.png' });

const accept = page
  .getByRole('button', { name: /accept\s*&\s*install/i })
  .first();
if (!(await accept.count())) {
  const fallback = page.getByRole('button', { name: /^accept/i }).first();
  if (!(await fallback.count())) {
    console.log('NO ACCEPT BUTTON FOUND');
    await browser.close();
    process.exit(1);
  }
  await fallback.click();
} else {
  await accept.click();
}
await page.waitForTimeout(8000);

console.log('== after:', page.url());
console.log((await page.locator('body').innerText()).slice(0, 800));
await page.screenshot({ path: '/tmp/opencode/v-terms-accepted.png' });

await browser.close();
console.log('done');
