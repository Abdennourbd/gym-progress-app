/**
 * Captures the screens used in the readme.
 *
 *   npm run build
 *   GYM_STORE=local npm start -- --port 3000
 *   node scripts/seed-demo.mjs --local
 *   node scripts/screenshots.mjs
 *
 * The pictures are taken in a phone sized browser, because that is where the
 * app is meant to be used.
 */
import { chromium, devices } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const PROJECT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.resolve(PROJECT, 'docs', 'screenshots');
const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:3000';

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  ...devices['iPhone 13'],
  // Twice the size is plenty for a readme and keeps the files small.
  deviceScaleFactor: 2,
});
const page = await context.newPage();

const shot = async (name) => {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  console.log('shot:', name);
};

// The sign in screen, before anybody has signed in.
await page.goto(BASE);
await page.getByRole('heading', { name: 'Gym Progress' }).waitFor();
await shot('login');

// The shared demo account, so the screens have a month of training in them.
await page.getByRole('button', { name: 'Look around as a visitor' }).click();
await page.getByRole('heading', { name: 'Workout' }).waitFor();

// The demo account keeps the dark theme. The rest of the pictures are taken
// in the light one, with the dark theme at the end.
await page.locator('nav').getByRole('button', { name: 'Exercises' }).click();
await page.getByRole('button', { name: 'Light', exact: true }).click();
await page.locator('nav').getByRole('button', { name: 'Workout' }).click();
await page.getByRole('heading', { name: 'Workout' }).waitFor();
await shot('workout');

// The sheet where a set is logged, with the target for next time.
await page.locator('[data-muscle="chest"]').click();
await page.locator('[data-exercise="Barbell Bench Press"]').click();
await page.getByRole('dialog').waitFor();
await shot('log-a-set');
await page.keyboard.press('Escape');

// The exercise library, and the settings underneath it.
await page.locator('nav').getByRole('button', { name: 'Exercises' }).click();
await page.getByRole('heading', { name: 'Exercises' }).waitFor();
await page.mouse.wheel(0, 700);
await shot('exercises');

await page.evaluate(() => window.scrollTo(0, 0));
await page.mouse.wheel(0, 380);
await page.waitForTimeout(400);
await shot('settings');

// The charts, in the light theme.
await page.locator('nav').getByRole('button', { name: 'Progress' }).click();
await page.getByRole('heading', { name: 'Progress' }).waitFor();
await page.waitForTimeout(900);
await shot('progress');

// And once more in the dark theme.
await page.locator('nav').getByRole('button', { name: 'Exercises' }).click();
await page.getByRole('button', { name: 'Dark', exact: true }).click();
await page.locator('nav').getByRole('button', { name: 'Progress' }).click();
await page.waitForTimeout(900);
await shot('progress-dark');

await browser.close();
console.log(`\nscreenshots written to ${OUT}`);
