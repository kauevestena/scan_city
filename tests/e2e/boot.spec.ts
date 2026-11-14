import { expect, test } from '@playwright/test';

test('a página carrega com o título e abre no escritório', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/');
  await expect(page).toHaveTitle('Scan City');
  await expect(page.getByTestId('screen-name')).toHaveText('OFFICE');
  expect(errors).toEqual([]);
});
