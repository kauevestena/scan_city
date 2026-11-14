import { expect, test } from '@playwright/test';

test('modais navegam com as setas e fecham com Esc, devolvendo o foco', async ({ page }) => {
  await page.goto('/?debug=1&screen=UIKIT');
  const opener = page.getByRole('button', { name: 'Abrir modal' });
  await opener.click();
  const dialog = page.getByRole('dialog', { name: 'Briefing de exemplo' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Recusar' })).toBeFocused();

  await page.keyboard.press('ArrowRight');
  await expect(dialog.getByRole('button', { name: 'Aceitar' })).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(dialog.getByRole('button', { name: 'Recusar' })).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
});

test('Enter no botão focado ativa uma única vez (ativação nativa)', async ({ page }) => {
  await page.goto('/?debug=1&screen=UIKIT');
  await page.getByRole('button', { name: 'Novo jogo…' }).focus();
  await page.keyboard.press('Enter');
  const confirm = page.getByRole('dialog', { name: 'Novo jogo' });
  await expect(confirm).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(confirm).toBeHidden();
});

test('os glyphs seguem o dispositivo escolhido na galeria', async ({ page }) => {
  await page.goto('/?debug=1&screen=UIKIT');
  const grid = page.getByTestId('glyph-grid');
  await expect(grid).toContainText('Espaço');
  await page.getByRole('tab', { name: 'Xbox' }).click();
  await expect(grid).toContainText('≡ Menu');
  await page.getByRole('tab', { name: 'PlayStation' }).click();
  await expect(grid).toContainText('Options');
});

test('no escritório, Esc pausa e Esc de novo retoma', async ({ page }) => {
  await page.goto('/?debug=1&skipIntro=1');
  await expect(page.getByTestId('office-screen')).toBeVisible();
  await page.keyboard.press('Escape');
  const pause = page.getByRole('dialog', { name: 'Jogo pausado' });
  await expect(pause).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(pause).toBeHidden();
});
