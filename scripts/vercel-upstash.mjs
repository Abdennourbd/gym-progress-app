/**
 * Installs the Upstash Redis storage integration for a Vercel project through
 * the dashboard, using the browser session that is already signed in.
 *
 *   node scripts/vercel-upstash.mjs <cdpUrl>
 */
import { chromium } from '@playwright/test';

const cdpUrl = process.argv[2];
const projectUrl = process.argv[3];

if (!cdpUrl || !projectUrl) {
  console.error('usage: node scripts/vercel-upstash.mjs <cdpUrl> <projectIntegrationsUrl>');
  process.exit(1);
}

const browser = await chromium.connectOverCDP(cdpUrl);
const context = browser.contexts()[0];
const page = context.pages()[0];

async function body() {
  return (await page.locator('body').innerText()).slice(0, 900);
}

await page.goto(projectUrl, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(5000);
console.log('== at:', page.url());
console.log(await body());
await page.screenshot({ path: '/tmp/opencode/v-integrations.png' });

// Look for a storage / marketplace section.
const storageLink = page.getByText(/storage/i).first();
if (await storageLink.count()) {
  await storageLink.click().catch(() => {});
  await page.waitForTimeout(4000);
  console.log('== after storage click:', page.url());
  console.log(await body());
  await page.screenshot({ path: '/tmp/opencode/v-storage.png' });
}

// Try the marketplace listing for Upstash directly.
await page.goto('https://vercel.com/marketplace/upstash', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(5000);
console.log('== marketplace:', page.url());
console.log(await body());
await page.screenshot({ path: '/tmp/opencode/v-upstash.png' });

const install = page.getByRole('button', { name: /install|add to project|connect/i }).first();
if (await install.count()) {
  await install.click().catch(() => {});
  await page.waitForTimeout(5000);
  console.log('== after install click:', page.url());
  console.log(await body());
  await page.screenshot({ path: '/tmp/opencode/v-upstash-install.png' });
}

await browser.close();
