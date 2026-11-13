import { test, expect, type Page } from '@playwright/test';

const USERNAME = process.env.E2E_USERNAME ?? 'e2e-user';
const PASSWORD = process.env.E2E_PASSWORD ?? 'test-password';

/**
 * Deletes whatever earlier tests logged today on the shared test store,
 * straight from node, before any browser state exists. Server-side deletes
 * are the only reliable reset: the client's offline-first merge would just
 * push the loaded copy straight back.
 */
async function wipeToday() {
  const base = process.env.BASE_URL ?? 'http://127.0.0.1:3210';
  const login = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
  });
  if (!login.ok) return;
  const cookie = login.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');

  const res = await fetch(`${base}/api/state`, { headers: { cookie } });
  if (!res.ok) return;
  const state = (await res.json()) as {
    sessions?: { id: string; date: string }[];
  };

  const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);

  await Promise.all(
    (state.sessions ?? [])
      .filter((s) => s.date === today)
      .map((s) =>
        fetch(`${base}/api/sessions/${s.id}`, {
          method: 'DELETE',
          headers: { cookie },
        }),
      ),
  );
}

async function signIn(page: Page) {
  await wipeToday();
  await page.goto('/');
  await page.getByLabel('Username').fill(USERNAME);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Workout' })).toBeVisible();
}

/** The muscle grid is always on screen, so there is no button to press first. */
async function openMuscle(page: Page, muscle: string) {
  await page.locator(`[data-muscle="${muscle}"]`).click();
  await expect(page.getByTestId('exercise-list')).toBeVisible();
}
async function pickExercise(page: Page, name: string) {
  await page.locator(`[data-exercise="${name}"]`).click();
  await expect(page.getByRole('dialog')).toBeVisible();
}

async function logSet(page: Page, weightSteps: number, repSteps: number) {
  await page.getByRole('dialog').getByRole('button', { name: 'increase Weight' }).click({
    clickCount: weightSteps,
    delay: 60,
  });
  await page.getByRole('dialog').getByRole('button', { name: 'increase Reps' }).click({
    clickCount: repSteps,
    delay: 60,
  });
}

test('a visitor can look around without an account', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Look around as a visitor' }).click();
  await expect(page.getByRole('heading', { name: 'Workout' })).toBeVisible();
  await expect(page.getByText(/nothing you change is saved/)).toBeVisible();
});

test('logging again the same day picks the workout back up', async ({ page }) => {
  await signIn(page);

  await openMuscle(page, 'back');
  await pickExercise(page, 'Machine Rows');
  await page.getByRole('dialog').getByRole('button', { name: /Done/ }).click();
  await page.getByRole('button', { name: 'Finish' }).click();
  await expect(page.getByText('Pick a muscle to start')).toBeVisible();

  // The muscle list from before the finish is still open, so the next
  // exercise of the same muscle is right there.
  await pickExercise(page, 'Close Grip Pulldown');
  await page.getByRole('dialog').getByRole('button', { name: /Done/ }).click();
  await expect(page.getByText('Pick a muscle to start')).toHaveCount(0);

  await page.locator('nav').getByRole('button', { name: 'Progress' }).click();
  const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
  await expect(page.getByText(today, { exact: true })).toHaveCount(1);
});

test('picks an exercise from the muscle grid and adds it on done', async ({ page }) => {
  await signIn(page);

  // The grid is there without pressing anything first.
  await expect(page.getByTestId('muscle-grid')).toBeVisible();
  await expect(page.getByRole('button', { name: '+ Add exercise' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Start workout' })).toHaveCount(0);

  await openMuscle(page, 'back');
  await pickExercise(page, 'Machine Rows');

  // The sheet opens straight onto the weight and reps, prefilled with the
  // last time this was done: 70 kg x 7.
  await expect(page.getByRole('dialog').getByText('Weight', { exact: true })).toBeVisible();
  await expect(page.getByRole('dialog').getByText('Reps', { exact: true })).toBeVisible();
  await expect(page.getByRole('dialog').getByText('Last time: 70 kg × 7')).toBeVisible();

  await logSet(page, 1, 1);
  await page.getByRole('dialog').getByRole('button', { name: /Done/ }).click();

  // It is now in the workout.
  await expect(page.getByTestId('session-list').getByText('72.5 kg × 8')).toBeVisible();

  // The muscle stays open so the next exercise of the same muscle is one tap
  // away, and the grid is still right there.
  await expect(page.getByTestId('muscle-grid')).toBeVisible();
  await expect(page.getByTestId('exercise-list')).toBeVisible();
});

test('the exercises open below the muscle on the same page', async ({ page }) => {
  await signIn(page);

  // Nothing is open to begin with.
  await expect(page.getByTestId('exercise-list')).toHaveCount(0);

  // One tap on a muscle opens its exercises underneath the grid.
  await page.locator('[data-muscle="shoulders"]').click();
  await expect(page.getByTestId('exercise-list')).toBeVisible();
  await expect(page.getByText('DB Lateral Raise')).toBeVisible();
  await expect(page.getByTestId('muscle-grid')).toBeVisible();

  // Tapping it again closes it.
  await page.locator('[data-muscle="shoulders"]').click();
  await expect(page.getByTestId('exercise-list')).toHaveCount(0);

  // A different muscle swaps the list.
  await page.locator('[data-muscle="calves"]').click();
  await expect(page.getByText('Calf Raises')).toBeVisible();
});

test('the muscle grid has no recent section', async ({ page }) => {
  await signIn(page);
  await expect(page.getByText('Recent')).toHaveCount(0);
  await expect(page.getByTestId('muscle-grid')).toBeVisible();
});

test('only the muscles that are used are listed', async ({ page }) => {
  await signIn(page);
  for (const muscle of ['Core', 'Traps', 'Lower back', 'Neck', 'Adductors', 'Glutes']) {
    await expect(page.locator('[data-muscle]').filter({ hasText: muscle })).toHaveCount(0);
  }
  for (const muscle of [
    'Chest',
    'Back',
    'Shoulders',
    'Biceps',
    'Triceps',
    'Quads',
    'Hamstrings',
    'Calves',
    'Forearms',
  ]) {
    await expect(page.locator('[data-muscle]').filter({ hasText: muscle })).toHaveCount(1);
  }
});

test('suggests the next overload target from what you just lifted', async ({ page }) => {
  await signIn(page);

  await openMuscle(page, 'back');
  await pickExercise(page, 'Close Grip Pulldown');

  // Last time 73 kg x 8, so the target is one more rep.
  await expect(page.getByRole('dialog').getByText('73 kg × 9')).toBeVisible();

  await logSet(page, 0, 1);
  await expect(page.getByRole('dialog').getByText('73 kg × 10')).toBeVisible();

  // Push past the switch point at 10 reps and the target becomes heavier.
  await logSet(page, 0, 4);
  await expect(page.getByRole('dialog').getByText('75.5 kg × 6')).toBeVisible();
  await expect(page.getByRole('dialog').getByText('add weight')).toBeVisible();
});

test('the try this now target can be applied in one tap', async ({ page }) => {
  await signIn(page);

  await openMuscle(page, 'back');
  await pickExercise(page, 'Pull Ups');

  // Last time 14 reps, so the target is 15.
  await expect(page.getByRole('dialog').getByText('15 reps')).toBeVisible();

  await page.getByRole('dialog').getByText('Try this now').click();
  await expect(page.getByRole('dialog').getByText('16 reps')).toBeVisible();
});

test('a new exercise opens straight into its weight and reps', async ({ page }) => {
  await signIn(page);

  await openMuscle(page, 'chest');
  await page.getByRole('button', { name: '+ New exercise' }).click();
  await page.getByPlaceholder('Exercise name').fill('Sling Shot');
  await page.getByRole('button', { name: 'Create' }).click();

  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog').getByText('Sling Shot')).toBeVisible();
});

test('still has the set after a reload', async ({ page }) => {
  await signIn(page);

  await openMuscle(page, 'chest');
  await pickExercise(page, 'Pec Dec');

  // Last time 59 kg x 10.
  await logSet(page, 1, 1);
  await page.getByRole('dialog').getByRole('button', { name: /Done/ }).click();

  await expect(page.getByTestId('session-list').getByText('61.5 kg × 11')).toBeVisible();

  // The whole point: closing the app mid-workout must not lose anything.
  await page.reload();
  await expect(page.getByText('Pec Dec')).toBeVisible();
  await expect(page.getByTestId('session-list').getByText('61.5 kg × 11')).toBeVisible();
});

test('counts the sets done and shows the running totals', async ({ page }) => {
  await signIn(page);

  await openMuscle(page, 'back');
  await pickExercise(page, 'Machine Rows');

  // Three sets of the same weight and reps.
  await page.getByRole('dialog').getByRole('button', { name: '3 sets' }).click();
  await page.getByRole('dialog').getByRole('button', { name: /Done/ }).click();

  // The row shows the set count.
  await expect(page.getByTestId('session-list').getByText('· 3 sets')).toBeVisible();

  // And the workout totals count the exercise and all three sets.
  const totals = page.locator('header');
  await expect(totals).toContainText('exercise');
  await expect(totals).toContainText('sets');

  // A second exercise, from another muscle, adds one more exercise and its
  // own sets.
  await openMuscle(page, 'chest');
  await pickExercise(page, 'Machine Press');
  await page.getByRole('dialog').getByRole('button', { name: '2 sets' }).click();
  await page.getByRole('dialog').getByRole('button', { name: /Done/ }).click();

  await expect(page.getByTestId('session-list').getByText('· 2 sets')).toBeVisible();
  await expect(page.getByTestId('session-list').locator('button')).toHaveCount(2);
});

test('the set count is a minimal one two three choice', async ({ page }) => {
  await signIn(page);

  await openMuscle(page, 'back');
  await pickExercise(page, 'Machine Rows');

  const dialog = page.getByRole('dialog');
  const sets = dialog.getByRole('button', { name: /^[123] sets?$/ });
  await expect(sets).toHaveCount(3);
  await expect(dialog.getByRole('button', { name: '4 sets' })).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: '5 sets' })).toHaveCount(0);

  // One is the default, three is the most you can choose.
  await expect(dialog.getByRole('button', { name: '1 set' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await dialog.getByRole('button', { name: '3 sets' }).click();
  await expect(dialog.getByRole('button', { name: '3 sets' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  // The set picker sits where the close button used to be.
  await expect(dialog.getByRole('button', { name: 'Close' })).toHaveCount(0);
});

test('dark mode can be switched on and off', async ({ page }) => {
  await signIn(page);

  await page.locator('nav').getByRole('button', { name: 'Exercises' }).click();
  await expect(page.getByRole('heading', { name: 'Exercises' })).toBeVisible();

  const theme = () => page.evaluate(() => document.documentElement.dataset.theme ?? '');

  await page.getByRole('button', { name: 'Dark', exact: true }).click();
  await expect.poll(theme).toBe('dark');

  // The page really is dark, not just labelled as such. The background
  // transitions over 150ms, so wait for it to land.
  const background = () =>
    page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await expect.poll(background).not.toBe('rgb(250, 250, 250)');

  await page.getByRole('button', { name: 'Light', exact: true }).click();
  await expect.poll(theme).toBe('light');
});

test('the weight and reps pickers stay stacked even with a wide number', async ({ page }) => {
  await signIn(page);

  await openMuscle(page, 'chest');
  await pickExercise(page, 'Machine Press');

  const dialog = page.getByRole('dialog');

  // Pile on weight so the number gets wide.
  for (let i = 0; i < 6; i += 1) {
    await dialog.getByRole('button', { name: 'increase Weight' }).click();
  }
  await page.waitForTimeout(300);

  const weight = await dialog.getByText('Weight', { exact: true }).boundingBox();
  const reps = await dialog.getByText('Reps', { exact: true }).boundingBox();
  expect(weight).not.toBeNull();
  expect(reps).not.toBeNull();

  // Weight sits above reps, and both are centred on the same line.
  expect(weight!.y).toBeLessThan(reps!.y);
  expect(Math.abs(weight!.x + weight!.width / 2 - (reps!.x + reps!.width / 2))).toBeLessThan(40);

  // And the dialog still fits the screen without sideways scrolling.
  const overflow = await dialog.evaluate(
    (el) => el.scrollWidth - el.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

test('there is no volume metric, only strength', async ({ page }) => {
  await signIn(page);

  await page.locator('nav').getByRole('button', { name: 'Progress' }).click();
  await expect(page.getByRole('heading', { name: 'Progress' })).toBeVisible();

  await expect(page.getByRole('button', { name: 'Volume' })).toHaveCount(0);
  await expect(page.getByText('Strength', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/kg moved/)).toHaveCount(0);
  await expect(page.getByText('best set', { exact: false })).toHaveCount(0);
});

test('the sheet is keyboard friendly', async ({ page }) => {
  await signIn(page);

  await openMuscle(page, 'chest');
  await pickExercise(page, 'Dips');

  await page.waitForTimeout(300);
  const focusedInsideSheet = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    return Boolean(dialog && document.activeElement && dialog.contains(document.activeElement));
  });
  expect(focusedInsideSheet).toBe(true);

  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('the rest timer counts down', async ({ page }) => {
  await signIn(page);

  await page.getByRole('button', { name: 'Start rest timer' }).click();
  await expect(page.getByRole('button', { name: /0[0-9]:\d\d|1[0-9]:\d\d|2[0-9]:\d\d/ })).toBeVisible();
  await page.getByRole('button', { name: 'Pause rest timer' }).click();
});

test('the rest timer keeps running through a reload', async ({ page }) => {
  await signIn(page);

  await page.getByRole('button', { name: 'Start rest timer' }).click();
  await expect(page.getByRole('button', { name: /Pause rest timer/ })).toBeVisible();

  await page.reload();

  // Still counting down after the reload, straight from the stored end time.
  await expect(page.getByRole('button', { name: /Pause rest timer/ })).toBeVisible();
  await page.getByRole('button', { name: 'Reset rest timer' }).click();
  await expect(page.getByRole('button', { name: 'Start rest timer' })).toBeVisible();
});

// Last, because it takes the app offline for the rest of the run.
test('keeps working offline and syncs when the signal comes back', async ({ page, context }) => {
  await signIn(page);

  // The service worker has to be in charge before the network is cut.
  await page.waitForFunction(() => navigator.serviceWorker?.controller !== null, {
    timeout: 15000,
  });

  const countSessions = () =>
    page.evaluate(async () => {
      const r = await fetch('/api/state', { credentials: 'include' });
      const d = await r.json();
      return d.sessions.length;
    });

  const before = await countSessions();

  await context.setOffline(true);

  // The app still opens, straight into the workout, with the data it has.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Workout' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in' })).toHaveCount(0);

  // A set can be logged with no signal at all.
  await page.locator('[data-muscle="back"]').click();
  await page.locator('[data-exercise="Machine Rows"]').click();
  await page.getByRole('dialog').getByRole('button', { name: 'increase Weight' }).click();
  await page.getByRole('dialog').getByRole('button', { name: /Done/ }).click();
  await expect(page.getByTestId('session-list')).toBeVisible();

  // And it is still there after an offline reload.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('session-list')).toBeVisible();

  // Back online, it reaches the server.
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));

  await expect.poll(countSessions, { timeout: 15000 }).toBeGreaterThan(before);
});

test('opens offline even when the sign in marker is missing', async ({ page, context }) => {
  await signIn(page);
  await page.waitForFunction(() => navigator.serviceWorker?.controller !== null, {
    timeout: 15000,
  });

  // Forget that we were signed in. The data on this device should still be
  // enough to open the app with no signal.
  await page.evaluate(() => {
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith('gym:signed-in')) window.localStorage.removeItem(key);
    }
  });

  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  await expect(page.getByRole('heading', { name: 'Workout' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in' })).toHaveCount(0);
});

test('a network failure is not reported as a wrong password', async ({ page, context }) => {
  await signIn(page);
  await page.waitForFunction(() => navigator.serviceWorker?.controller !== null, {
    timeout: 15000,
  });

  // Wipe the device so there is nothing local to fall back on.
  await page.evaluate(async () => {
    window.localStorage.clear();
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase('keyval-store');
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    });
  });

  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();

  await page.getByLabel('Username').fill('someone');
  await page.getByLabel('Password').fill('whatever');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByText(/reach the server/)).toBeVisible();
  await expect(page.getByText('Wrong username or password.')).toHaveCount(0);
});
