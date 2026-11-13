import { test, expect, type Page } from '@playwright/test';

const PASSWORD = 'e2e-password';

async function signUp(page: Page, username: string) {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Create an account' }).click();
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Confirm password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Create an account' }).click();
}

test('one account never sees another account data', async ({ browser }) => {
  const first = await browser.newContext();
  const second = await browser.newContext();

  const a = await first.newPage();
  await signUp(a, 'account-one');
  await expect(a.getByRole('heading', { name: 'Workout' })).toBeVisible();

  const b = await second.newPage();
  await signUp(b, 'account-two');
  await expect(b.getByRole('heading', { name: 'Workout' })).toBeVisible();

  // The first account adds an exercise the second one must never find.
  await a.locator('nav').getByRole('button', { name: 'Exercises' }).click();
  await a.getByRole('button', { name: /Add all \d+/ }).click();
  await expect(a.getByRole('button', { name: /^Barbell Squat/ }).first()).toBeVisible();

  await b.reload();
  await b.locator('nav').getByRole('button', { name: 'Exercises' }).click();
  await expect(b.getByRole('button', { name: /^Barbell Squat/ })).toHaveCount(0);
});

test('signing out on a shared phone leaves nothing of the last account behind', async ({
  browser,
}) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  await signUp(page, 'account-three');
  await expect(page.getByRole('heading', { name: 'Workout' })).toBeVisible();

  await page.locator('nav').getByRole('button', { name: 'Exercises' }).click();
  await page.getByRole('button', { name: /Add all \d+/ }).click();
  await expect(page.getByRole('button', { name: /^Barbell Squat/ }).first()).toBeVisible();

  // Sign out through the settings panel.
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('tab', { name: 'Sign in' })).toBeVisible();

  // A different account on the same device must not inherit the exercises.
  await signUp(page, 'account-four');
  await page.locator('nav').getByRole('button', { name: 'Exercises' }).click();
  await expect(page.getByRole('button', { name: /^Barbell Squat/ })).toHaveCount(0);
});
