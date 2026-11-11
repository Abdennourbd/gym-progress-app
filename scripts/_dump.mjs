import { chromium } from '@playwright/test';

const cdpUrl = process.argv[2];
const uri = process.argv[3];

const browser = await chromium.connectOverCDP(cdpUrl);
const context = browser.contexts()[0];
const page = context.pages()[0];

await page.goto(uri, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(6000);

console.log('URL:', page.url());
console.log('--- TEXT ---');
console.log((await page.locator('body').innerText()).slice(0, 2000));

console.log('--- BUTTONS ---');
const buttons = await page.locator('button').evaluateAll((els) =>
  els
    .map((e) => ({
      text: (e.innerText || '').trim().slice(0, 60),
      visible: !!(e.offsetWidth || e.offsetHeight),
      type: e.getAttribute('type'),
      cls: (e.className || '').toString().slice(0, 50),
    }))
    .filter((b) => b.visible),
);
console.log(JSON.stringify(buttons, null, 1).slice(0, 3000));

console.log('--- INPUTS ---');
const inputs = await page.locator('input').evaluateAll((els) =>
  els.map((e) => ({ type: e.type, name: e.name, id: e.id, ph: e.placeholder })),
);
console.log(JSON.stringify(inputs, null, 1).slice(0, 1500));

await page.screenshot({ path: '/tmp/opencode/v-terms2.png', fullPage: true });
await browser.close();
