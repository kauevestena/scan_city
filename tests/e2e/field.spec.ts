import { expect, test } from '@playwright/test';

test('C00: sugestão automática de GCPs → plano padrão → checklist → decolar', async ({ page }) => {
  await page.goto('/?debug=1&skipIntro=1&seed=4');
  await page.getByRole('button', { name: 'Porta — sair para o mapa' }).click();
  await expect(page.getByTestId('world-map-screen')).toBeVisible();
  await page.keyboard.press('F9');
  await page.locator('[data-teleport="C00"]').click();
  await page.keyboard.press('F9');
  await expect(page.getByTestId('world-prompt')).toHaveText(/Sítio do Avô/);
  await page.keyboard.press('Enter');
  await page
    .getByRole('dialog', { name: 'Sítio do Avô' })
    .getByRole('button', { name: 'Aceitar' })
    .click();

  const field = page.getByTestId('field-setup-screen');
  await expect(field).toBeVisible();
  await expect(page.getByTestId('distribution-light')).toHaveAttribute('data-light', 'RED');
  await page.getByTestId('suggest-gcps').click();
  await expect(page.getByTestId('distribution-light')).toHaveAttribute('data-light', 'GREEN');
  await expect(page.getByTestId('distribution')).toContainText('5 / 3');

  // Um clique no mapa coloca um CP (tecla C).
  await page.keyboard.press('c');
  const canvas = page.getByTestId('satellite-canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('canvas sem tamanho');
  await canvas.click({ position: { x: box.width * 0.42, y: box.height * 0.45 } });
  await expect(page.getByTestId('distribution')).toContainText('1 / 0');

  await page.getByRole('tab', { name: '2 · Plano de voo' }).click();
  await expect(page.getByTestId('plan-stats')).toBeVisible();
  await expect(page.getByTestId('stat-lines')).toHaveText(/^\d+$/);

  await page.getByRole('tab', { name: '4 · Checklist' }).click();
  await expect(page.getByTestId('checklist-requirements').getByRole('listitem')).toHaveCount(7);
  // A dificuldade do voo (ADR-035): a média vem marcada; a difícil paga mais e vai para o voo.
  const difficulty = page.getByRole('radiogroup', { name: 'Dificuldade do voo' });
  await expect(difficulty.getByRole('radio', { name: /Média/ })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await difficulty.getByRole('radio', { name: /Difícil/ }).click();
  await expect(difficulty.getByRole('radio', { name: /Difícil/ })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await page.getByTestId('takeoff').click();
  await expect(page.getByTestId('survey-flight-screen')).toBeVisible();
  await expect(page.getByTestId('flight-hud')).toBeVisible();
  await expect(page.getByTestId('hud-difficulty')).toHaveText('DIFÍCIL');
});
