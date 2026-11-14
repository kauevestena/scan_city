import { expect, test } from '@playwright/test';

test('o saldo definido por depuração persiste depois de recarregar', async ({ page }) => {
  await page.goto('/?debug=1&skipIntro=1&money=12345');
  await expect(page.getByTestId('office-screen')).toBeVisible();
  await page.keyboard.press('F9');
  await expect(page.getByTestId('debug-money')).toHaveText(/12\.345,00/);

  // Uma troca de tela dispara o autosave (debounce de 1 s).
  await page.locator('[data-transition="T1"]').click();
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('scan-city-save')), { timeout: 5000 })
    .toContain('"money":1234500');

  await page.goto('/?debug=1&screen=WORLD_MAP');
  await expect(page.getByTestId('debug-money')).toHaveText(/12\.345,00/);
  await expect(page.getByTestId('top-bar')).toContainText('12.345,00');
});

test('fechar a aba grava o progresso (beforeunload)', async ({ page }) => {
  await page.goto('/?debug=1&skipIntro=1&money=777');
  await expect(page.getByTestId('top-bar')).toContainText('777,00');
  // Sair da página sem trocar de tela: só o beforeunload pode ter gravado.
  await page.goto('/');
  await expect(page.getByTestId('top-bar')).toContainText('777,00');
  // A intro já tinha sido vista: não volta.
  await expect(page.getByRole('dialog', { name: 'Uma carta na mesa' })).toBeHidden();
});

test('um save corrompido é descartado com aviso e vai para o backup', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('scan-city-save', '{"version":1,"player":'));
  await page.reload();
  await expect(page.getByText('Save inválido descartado')).toBeVisible();
  await expect(page.getByTestId('top-bar')).toContainText('5.000,00');
  expect(await page.evaluate(() => localStorage.getItem('scan-city-save-backup'))).toBe(
    '{"version":1,"player":',
  );
});
