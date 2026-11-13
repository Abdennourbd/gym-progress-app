import { test, expect } from '@playwright/test';

const PASSWORD = 'e2e-password';

async function signUp(page: import('@playwright/test').Page, username: string) {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Create an account' }).click();
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Confirm password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Create an account' }).click();
  await expect(page.getByRole('heading', { name: 'Workout' })).toBeVisible();
}

test('the responses carry the security headers', async ({ request }) => {
  const res = await request.get('/');

  expect(res.headers()['content-security-policy']).toContain("default-src 'self'");
  expect(res.headers()['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(res.headers()['x-content-type-options']).toBe('nosniff');
  expect(res.headers()['x-frame-options']).toBe('DENY');
  expect(res.headers()['referrer-policy']).toBe('strict-origin-when-cross-origin');
});

test('the api answers are never cached', async ({ request }) => {
  const res = await request.get('/api/auth/config');
  expect(res.headers()['cache-control']).toBe('no-store');
});

test('an account can be removed, with everything in it', async ({ page }) => {
  const username = `gone_${Date.now()}`;
  await signUp(page, username);

  // Something in the account worth losing.
  await page.locator('nav').getByRole('button', { name: 'Exercises' }).click();
  await page.getByRole('button', { name: 'Add all' }).click().catch(async () => {
    await page.getByRole('button', { name: /Add all/ }).first().click();
  });
  await expect(page.getByRole('button', { name: /^Barbell Squat/ }).first()).toBeVisible();

  // The account is removed from the settings panel.
  await page.getByRole('button', { name: 'Delete account' }).click();
  await page.getByRole('dialog').waitFor();
  await page.getByLabel('Your password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Delete everything' }).click();

  // The sign in screen comes back.
  await expect(page.getByRole('tab', { name: 'Sign in' })).toBeVisible();

  // And the name is free again.
  await signUp(page, username);
  await expect(page.getByRole('heading', { name: 'Workout' })).toBeVisible();
});

test('the wrong password does not remove the account', async ({ page }) => {
  const username = `stays_${Date.now()}`;
  await signUp(page, username);

  await page.locator('nav').getByRole('button', { name: 'Exercises' }).click();
  await page.getByRole('button', { name: 'Delete account' }).click();
  await page.getByRole('dialog').waitFor();
  await page.getByLabel('Your password').fill('the-wrong-password');
  await page.getByRole('button', { name: 'Delete everything' }).click();

  await expect(page.getByText('That password is not right.')).toBeVisible();

  // The account is still there, and still signed in.
  await page.getByRole('button', { name: 'Keep it' }).click();
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Workout' })).toBeVisible();
});
