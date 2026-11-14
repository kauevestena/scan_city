import { expect, test, type Page } from '@playwright/test';

/** Clica numa transição do painel de depuração (F9 nas telas reais, embutido no shell). */
async function go(page: Page, transition: string, expected: string) {
  await page.locator(`[data-transition="${transition}"]`).click();
  if (expected === 'OFFICE') await expect(page.getByTestId('office-screen')).toBeVisible();
  else if (expected === 'WORLD_MAP')
    await expect(page.getByTestId('world-map-screen')).toBeVisible();
  else await expect(page.getByTestId('screen-name')).toHaveText(expected);
}

test('percorre as transições T1–T16 pelo painel de depuração', async ({ page }) => {
  await page.goto('/?debug=1&skipIntro=1');
  await expect(page.getByTestId('office-screen')).toBeVisible();
  await page.keyboard.press('F9');
  await expect(page.getByTestId('debug-overlay')).toBeVisible();

  await go(page, 'T1', 'WORLD_MAP');
  await go(page, 'T5', 'OFFICE');
  await go(page, 'T2', 'HOLO_TABLE_VIEW');
  await go(page, 'T14', 'OFFICE');
  await go(page, 'T3', 'INFOGRAPHIC_LAB');
  await go(page, 'T15', 'OFFICE');

  // Processamento no escritório: T4 → T12.
  await go(page, 'T4', 'PROCESSING_RESULTS');
  await expect(page.locator('[data-transition="T12"]')).toBeVisible();
  await go(page, 'T12', 'OFFICE');

  // Campo e voo: T1 → T6 → T7, T6 → T8 → T16 → T8 → T10.
  await go(page, 'T1', 'WORLD_MAP');
  await go(page, 'T6', 'FIELD_SETUP');
  await go(page, 'T7', 'WORLD_MAP');
  await go(page, 'T6', 'FIELD_SETUP');
  await go(page, 'T8', 'SURVEY_FLIGHT');
  await go(page, 'T16', 'FIELD_SETUP');
  await go(page, 'T8', 'SURVEY_FLIGHT');
  await go(page, 'T10', 'WORLD_MAP');

  // Processamento em campo (Van): T9 → T13, e depois T9 → T11 → T14.
  await go(page, 'T6', 'FIELD_SETUP');
  await go(page, 'T8', 'SURVEY_FLIGHT');
  await go(page, 'T9', 'PROCESSING_RESULTS');
  await go(page, 'T13', 'WORLD_MAP');
  await go(page, 'T6', 'FIELD_SETUP');
  await go(page, 'T8', 'SURVEY_FLIGHT');
  await go(page, 'T9', 'PROCESSING_RESULTS');
  await go(page, 'T11', 'HOLO_TABLE_VIEW');
  await go(page, 'T14', 'OFFICE');
});

test('Esc abre o overlay de pausa e Continuar retoma', async ({ page }) => {
  await page.goto('/?debug=1&skipIntro=1');
  await expect(page.getByTestId('office-screen')).toBeVisible();
  await page.keyboard.press('Escape');
  const dialog = page.getByRole('dialog', { name: 'Jogo pausado' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Continuar' }).click();
  await expect(dialog).toBeHidden();
});
