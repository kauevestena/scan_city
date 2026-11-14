import { expect, test } from '@playwright/test';

test('a página carrega e mostra o título', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Scan City');
  await expect(page.getByRole('heading', { name: 'Scan City' })).toBeVisible();
});
