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

async function openChestPicker(page: Page) {
  await page.getByRole('button', { name: '+ Add exercise' }).click();
  await page.getByRole('button', { name: /Chest/ }).first().click();
  await expect(page.getByRole('button', { name: '+ New exercise' })).toBeVisible();
}

async function createExercise(page: Page, name: string) {
  await openChestPicker(page);
  await page.getByRole('button', { name: '+ New exercise' }).click();
  await page.getByPlaceholder('Exercise name').fill(name);
  await page.getByRole('button', { name: 'Create' }).click();
}

async function pickExercise(page: Page, name: string) {
  await openChestPicker(page);
  await page.getByRole('button', { name }).click();
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

test('signs in, logs a set, and still has it after a reload', async ({ page }) => {
  await signIn(page);

  await page.getByRole('button', { name: 'Start workout' }).click();
  await createExercise(page, 'Bench Press');

  await expect(page.getByText('Bench Press')).toBeVisible();

  await page.getByText('Bench Press').click();

  const sheet = page.getByRole('dialog');
  await expect(sheet.getByText('Next time')).toBeVisible();

  // A brand new exercise starts at the bottom of its rep range.
  await expect(sheet.getByText('6 reps')).toBeVisible();

  await logSet(page, 1, 1);
  await sheet.getByRole('button', { name: 'Done' }).click();

  await expect(page.getByText('2.5 kg × 7')).toBeVisible();

  // The whole point: closing the app mid-workout must not lose anything.
  await page.reload();
  await expect(page.getByText('Bench Press')).toBeVisible();
  await expect(page.getByText('2.5 kg × 7')).toBeVisible();
});

test('suggests the next overload target from what you just lifted', async ({ page }) => {
  await signIn(page);

  await page.getByRole('button', { name: 'Start workout' }).click();
  await createExercise(page, 'Squat');

  await page.getByText('Squat').click();
  const sheet = page.getByRole('dialog');

  // 6 reps is the floor of the range, so the next target is one more rep.
  await expect(sheet.getByText('6 reps')).toBeVisible();

  await logSet(page, 0, 1);
  await expect(sheet.getByText('8 reps')).toBeVisible();

  // Push past the switch point at 10 reps and the target becomes heavier.
  await logSet(page, 0, 4);
  await expect(sheet.getByText('2.5 kg × 6')).toBeVisible();
  await expect(sheet.getByText('add weight')).toBeVisible();
});

test('prefills a new entry with the last time you did the exercise', async ({ page }) => {
  await signIn(page);

  await page.getByRole('button', { name: 'Start workout' }).click();
  await createExercise(page, 'Deadlift');

  await page.getByText('Deadlift').click();
  await logSet(page, 1, 1);
  await page.getByRole('dialog').getByRole('button', { name: 'Done' }).click();

  await expect(page.getByText('2.5 kg × 7')).toBeVisible();

  // Finish, then start a new workout: the entry is prefilled with last time.
  await page.getByRole('button', { name: 'Finish' }).click();
  await page.getByRole('button', { name: 'Start workout' }).click();
  await pickExercise(page, 'Deadlift');

  await expect(page.getByText('2.5 kg × 7')).toBeVisible();
});
