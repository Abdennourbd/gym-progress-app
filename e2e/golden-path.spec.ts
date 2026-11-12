import { test, expect, type Page } from '@playwright/test';

const EMAIL = process.env.GYM_EMAIL ?? 'test@example.com';
const PASSWORD = process.env.E2E_PASSWORD ?? 'test-password';

async function signIn(page: Page) {
  await page.goto('/');
  await page.getByPlaceholder('Email').fill(EMAIL);
  await page.getByPlaceholder('Password').fill(PASSWORD);
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

test('the next time target can be applied in one tap', async ({ page }) => {
  await signIn(page);

  await openMuscle(page, 'back');
  await pickExercise(page, 'Pull Ups');

  // Last time 14 reps, so the target is 15.
  await expect(page.getByRole('dialog').getByText('15 reps')).toBeVisible();

  await page.getByRole('dialog').getByText('Next time').click();
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
  await page.getByRole('dialog').getByRole('button', { name: '3', exact: true }).click();
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
  await page.getByRole('dialog').getByRole('button', { name: '2', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: /Done/ }).click();

  await expect(page.getByTestId('session-list').getByText('· 2 sets')).toBeVisible();
  await expect(page.getByTestId('session-list').locator('button')).toHaveCount(2);
});

test('the set count is a minimal one two three choice', async ({ page }) => {
  await signIn(page);

  await openMuscle(page, 'back');
  await pickExercise(page, 'Machine Rows');

  const dialog = page.getByRole('dialog');
  const sets = dialog.getByRole('button', { name: /^[123]$/ });
  await expect(sets).toHaveCount(3);
  await expect(dialog.getByRole('button', { name: '4' })).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: '5' })).toHaveCount(0);

  // One is the default, three is the most you can choose.
  await expect(dialog.getByRole('button', { name: '1', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await dialog.getByRole('button', { name: '3', exact: true }).click();
  await expect(dialog.getByRole('button', { name: '3', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
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
  await expect(page.getByRole('button', { name: /0[01]:\d\d/ })).toBeVisible();
  await page.getByRole('button', { name: 'Pause rest timer' }).click();
});
