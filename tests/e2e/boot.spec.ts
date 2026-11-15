import { expect, test } from '@playwright/test';

test('a página carrega com o título e abre no escritório', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/?debug=1&skipIntro=1');
  await expect(page).toHaveTitle('Scan City');
  await expect(page.getByTestId('office-screen')).toBeVisible();
  await expect(page.getByTestId('top-bar')).toBeVisible();
  expect(errors).toEqual([]);
});
