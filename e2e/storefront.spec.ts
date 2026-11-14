import { expect, test } from '@playwright/test';

test('login page does not expose or prefill demo accounts', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByLabel('Email')).toHaveValue('');
  await expect(page.getByLabel('Password')).toHaveValue('');
  await expect(page.getByText(/demo customer|demo admin|shopsphere\.local/i)).toHaveCount(0);
});

test('registration form asks for a real account identity', async ({ page }) => {
  await page.goto('/register');
  await expect(page.getByLabel('Full name')).toHaveValue('');
  await expect(page.getByLabel('Email')).toHaveValue('');
  await expect(page.getByLabel(/Password/)).toHaveValue('');
});
