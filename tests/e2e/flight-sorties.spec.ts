import { expect, test } from '@playwright/test';

test('RTH com confirmação mantém os dados e a nova surtida retoma na 1ª linha incompleta', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.goto('/?debug=1&skipIntro=1&screen=SURVEY_FLIGHT');
  await expect(page.getByTestId('flight-hud')).toBeVisible();
  await expect(page.getByTestId('hud-phase')).toBeHidden({ timeout: 10_000 });
  // Espera algumas fotos e pede o RTH: o 1º R abre a confirmação, o 2º confirma.
  await expect(page.getByTestId('hud-photos')).not.toContainText('FOTOS0 /', { timeout: 15_000 });
  await page.keyboard.press('r');
  await expect(page.getByTestId('hud-rth-confirm')).toBeVisible();
  await page.keyboard.press('r');
  const dialog = page.getByRole('dialog', { name: 'Retorno à base' });
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  await expect(dialog.getByTestId('post-take')).toBeVisible();
  await expect(dialog.getByTestId('post-new-sortie')).toBeVisible();
  // Nova surtida: decola de novo na linha 1 (a única incompleta é a primeira).
  await dialog.getByTestId('post-new-sortie').click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.getByTestId('hud-phase')).toHaveText('DECOLANDO');
  await expect(page.getByTestId('hud-line')).toHaveText('LINHA 1/6');
});
