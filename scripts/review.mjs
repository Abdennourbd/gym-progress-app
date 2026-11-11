/**
 * Drives the real app in a real browser and captures screenshots of every
 * screen, so the interface can be reviewed visually rather than by assertion.
 *
 *   node scripts/review.mjs [outputDir]
 */
import { chromium, devices } from '@playwright/test';
import { mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const PROJECT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
rmSync(path.join(PROJECT, '.data'), { recursive: true, force: true });

const OUT = path.resolve(process.argv[2] ?? '/tmp/opencode/shots');
const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:3000';
const EMAIL = process.env.GYM_EMAIL ?? 'test@example.com';
const PASSWORD = process.env.E2E_PASSWORD ?? 'test-password';

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ ...devices['iPhone 13'] });
const page = await context.newPage();

page.on('console', (msg) => {
  if (msg.type() === 'error') console.log('CONSOLE ERROR:', msg.text());
});
page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message));

const safeClick = async (locator, label) => {
  try {
    await locator.click({ timeout: 8000 });
  } catch (error) {
    const dump = await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find((b) =>
        (b.textContent || '').trim().startsWith('Exercises'),
      );
      const r = btn?.getBoundingClientRect();
      const hit = r ? document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) : null;
      return {
        scrollY,
        innerHeight,
        rect: r?.toJSON(),
        hit: hit ? `${hit.tagName}.${hit.className}` : null,
        hitChain: hit
          ? (() => {
              const out = [];
              let el = hit;
              while (el && el !== document.body) {
                const cs = getComputedStyle(el);
                out.push(`${el.tagName}.${(el.className || '').toString().slice(0, 40)} pos=${cs.position} z=${cs.zIndex}`);
                el = el.parentElement;
              }
              return out;
            })()
          : [],
      };
    });
    console.log('CLICK FAILED', label, JSON.stringify(dump, null, 1));
    await page.screenshot({ path: path.join(OUT, 'FAILURE.png') });
    throw error;
  }
};

const shot = async (name) => {
  await page.waitForTimeout(450);
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  console.log('shot:', name);
};

// Seed a believable history straight into the local mirror so the charts have
// something to draw. The app itself never backdates a session.
const seed = async () => {
  await page.evaluate(async () => {
    const exercises = [
      { id: 'e-bench', name: 'Flat Bench Press', muscleIds: ['chest'], targetReps: { min: 6, max: 12 }, stepKg: 2.5, createdAt: Date.now() },
      { id: 'e-incline', name: 'Incline DB Press', muscleIds: ['chest'], targetReps: { min: 6, max: 12 }, stepKg: 2.5, createdAt: Date.now() },
      { id: 'e-fly', name: 'Cable Fly', muscleIds: ['chest'], targetReps: { min: 6, max: 12 }, stepKg: 2.5, createdAt: Date.now() },
      { id: 'e-row', name: 'Barbell Row', muscleIds: ['back'], targetReps: { min: 6, max: 12 }, stepKg: 2.5, createdAt: Date.now() },
      { id: 'e-pull', name: 'Weighted Pull-ups', muscleIds: ['back'], targetReps: { min: 6, max: 12 }, stepKg: 2, createdAt: Date.now() },
      { id: 'e-press', name: 'Overhead Press', muscleIds: ['shoulders'], targetReps: { min: 6, max: 12 }, stepKg: 2.5, createdAt: Date.now() },
      { id: 'e-lateral', name: 'Lateral Raise', muscleIds: ['shoulders'], targetReps: { min: 6, max: 12 }, stepKg: 2.5, createdAt: Date.now() },
      { id: 'e-curl', name: 'EZ Curl', muscleIds: ['biceps'], targetReps: { min: 6, max: 12 }, stepKg: 2.5, createdAt: Date.now() },
      { id: 'e-skull', name: 'Skullcrusher', muscleIds: ['triceps'], targetReps: { min: 6, max: 12 }, stepKg: 2.5, createdAt: Date.now() },
      { id: 'e-squat', name: 'Squat', muscleIds: ['quads'], targetReps: { min: 6, max: 12 }, stepKg: 2.5, createdAt: Date.now() },
      { id: 'e-rdl', name: 'Romanian Deadlift', muscleIds: ['hamstrings'], targetReps: { min: 6, max: 12 }, stepKg: 2.5, createdAt: Date.now() },
      { id: 'e-calf', name: 'Calf Raise', muscleIds: ['calves'], targetReps: { min: 6, max: 12 }, stepKg: 5, createdAt: Date.now() },
      { id: 'e-plank', name: 'Plank', muscleIds: ['core'], targetReps: { min: 6, max: 12 }, stepKg: 2.5, createdAt: Date.now() },
    ];

    const plan = [
      ['e-bench', 72.5, 8], ['e-incline', 26, 10], ['e-fly', 12, 12],
      ['e-row', 52.5, 8], ['e-pull', 0, 7], ['e-press', 32.5, 8],
      ['e-curl', 22, 9], ['e-skull', 25, 9], ['e-squat', 82.5, 6],
      ['e-rdl', 70, 8], ['e-calf', 40, 12], ['e-plank', 0, 12],
    ];

    const sessions = [];
    const start = new Date();
    start.setDate(start.getDate() - 42);

    for (let i = 0; i < 13; i += 1) {
      const date = new Date(start);
      date.setDate(start.getDate() + i * 3);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const progress = i / 12;

      const entries = plan.map(([id, baseWeight, baseReps], j) => {
        if ((i + j) % 3 === 2) return null; // rest for that exercise
        const weight = id === 'e-pull' ? 0 : Number((baseWeight * (1 + progress * 0.28)).toFixed(1));
        const reps = Math.min(12, baseReps + Math.floor(progress * 5));
        return {
          id: `${id}-${i}`,
          exerciseId: id,
          weightKg: weight,
          reps,
          completedAt: date.getTime(),
        };
      }).filter(Boolean);

      sessions.push({
        id: `s-${i}`,
        date: key,
        startedAt: date.getTime(),
        endedAt: date.getTime() + 3600000,
        entries,
        updatedAt: date.getTime(),
      });
    }

    const settings = { units: 'kg', restTimerSec: 90 };

    // Write straight into IndexedDB through the same key names the app uses.
    const open = indexedDB.open('keyval-store');
    await new Promise((resolve, reject) => {
      open.onupgradeneeded = () => open.result.createObjectStore('keyval');
      open.onsuccess = resolve;
      open.onerror = () => reject(open.error);
    });
    const database = open.result;
    const tx = database.transaction('keyval', 'readwrite');
    const store = tx.objectStore('keyval');
    const put = (key, value) => store.put(value, key);
    put('gym:exercises', exercises);
    put('gym:sessions', sessions);
    put('gym:settings', settings);
    await new Promise((resolve) => { tx.oncomplete = resolve; });
  });
};

// --- login screen -----------------------------------------------------------
await page.goto(BASE);
await shot('01-login');

await page.getByPlaceholder('Email').fill(EMAIL);
await page.getByPlaceholder('Password').fill(PASSWORD);
await page.getByRole('button', { name: 'Sign in' }).click();
await page.waitForTimeout(600);
await shot('02-workout-empty');

// --- seed and reload -------------------------------------------------------
await seed();
await page.reload();
await page.waitForTimeout(900);
await shot('03-progress-empty-history');

// --- start a workout --------------------------------------------------------
await page.getByRole('button', { name: 'Start workout' }).click();
await page.waitForTimeout(300);
await shot('04-workout-started');

await page.getByRole('button', { name: '+ Add exercise' }).click();
await page.waitForTimeout(400);
await shot('05-muscle-grid');

await page.getByRole('button', { name: /Chest/ }).first().click();
await page.waitForTimeout(400);
await shot('06-exercise-list');

await page.getByRole('button', { name: '+ New exercise' }).click();
await page.waitForTimeout(400);
await shot('07-new-exercise');

await page.getByPlaceholder('Exercise name').fill('Bench Press');
await page.getByRole('button', { name: 'Create' }).click();
await page.waitForTimeout(500);
await shot('08-workout-with-exercise');

await page.getByText('Bench Press').last().click();
await page.waitForTimeout(400);
await shot('09-entry-sheet');

await page.getByRole('dialog').getByRole('button', { name: 'increase Weight' }).click();
await page.getByRole('dialog').getByRole('button', { name: 'increase Reps' }).click();
await page.waitForTimeout(300);
await shot('10-entry-sheet-edited');

await page.getByRole('button', { name: 'Done' }).click();
await page.waitForTimeout(500);
await shot('11-workout-row');

// --- progress ---------------------------------------------------------------
await safeClick(page.getByRole('button', { name: 'Progress' }), 'Progress tab');
await page.waitForTimeout(900);
await shot('12-progress-whole-body');

await page.getByRole('button', { name: '30 days' }).click();
await page.waitForTimeout(700);
await shot('13-progress-30d');

await page.getByRole('button', { name: '7 days' }).click();
await page.waitForTimeout(700);
await shot('14-progress-7d');

await page.getByRole('button', { name: '3 months' }).click();
await page.waitForTimeout(700);
await shot('15-progress-3mo');

const chestChip = page.getByRole('button', { name: /Chest/ }).first();
if (await chestChip.count()) {
  await chestChip.click();
  await page.waitForTimeout(800);
  await shot('16-progress-chest');
}

const volumeToggle = page.getByRole('button', { name: 'Volume' }).first();
if (await volumeToggle.count()) {
  await volumeToggle.click();
  await page.waitForTimeout(800);
  await shot('17-progress-volume');
}

// --- exercises --------------------------------------------------------------
await safeClick(page.getByRole('button', { name: 'Exercises' }), 'Exercises tab');
await page.waitForTimeout(600);
await shot('18-exercises');

await page.getByRole('button', { name: 'Bench Press' }).first().click();
await page.waitForTimeout(400);
await shot('19-exercise-editor');

await browser.close();
console.log('screenshots in', OUT);
