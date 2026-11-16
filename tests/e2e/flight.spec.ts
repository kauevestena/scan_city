import { expect, test } from '@playwright/test';

test('C00 com autopilot (×8): voa as linhas, mostra o pós-voo e leva os dados ao mapa', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.goto('/?debug=1&skipIntro=1&autopilot=1&screen=SURVEY_FLIGHT');
  await expect(page.getByTestId('survey-flight-screen')).toBeVisible();
  await expect(page.getByTestId('flight-hud')).toBeVisible();
  // O plano de teste tem 6 linhas; o HUD avança por elas.
  await expect(page.getByTestId('hud-line')).toHaveText('LINHA 3/6', { timeout: 30_000 });
  const post = page.getByRole('dialog', { name: 'Voo concluído' });
  await expect(post).toBeVisible({ timeout: 45_000 });
  const photos = Number(await post.getByTestId('post-photos').textContent());
  expect(Math.abs(photos - 96)).toBeLessThanOrEqual(6);
  await expect(post.getByRole('button', { name: /Levar dados/ })).toBeVisible();
  // O autopilot confirma "Levar dados" sozinho.
  await expect(page.getByTestId('world-map-screen')).toBeVisible({ timeout: 5000 });
  await expect(page.getByText('Dados salvos. Leve-os à Workstation no escritório')).toBeVisible();
});

test('a pausa congela o voo', async ({ page }) => {
  await page.goto('/?debug=1&skipIntro=1&screen=SURVEY_FLIGHT');
  const hud = page.getByTestId('flight-hud');
  await expect(hud).toBeVisible();
  // Espera a decolagem terminar e o voo andar um pouco.
  await expect(page.getByTestId('hud-phase')).toBeHidden({ timeout: 10_000 });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Jogo pausado' })).toBeVisible();
  const frozen = await hud.textContent();
  await page.waitForTimeout(1000);
  expect(await hud.textContent()).toBe(frozen);
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect.poll(() => hud.textContent(), { timeout: 3000 }).not.toBe(frozen);
});

test('o painel F9 mostra o tempo por etapa do voo, dentro do orçamento de 12 ms', async ({
  page,
}) => {
  await page.goto('/?debug=1&skipIntro=1&autopilot=1&screen=SURVEY_FLIGHT');
  await expect(page.getByTestId('survey-flight-screen')).toBeVisible();
  await page.keyboard.press('F9');
  const perf = page.locator('[data-perf="flight"]');
  await expect(perf).toBeVisible({ timeout: 5000 });
  for (const stage of [
    'simulação (update)',
    'HUD (publicação)',
    'grade do terreno (amostragem)',
    'terreno (quads e curvas)',
    'objetos, sombras e alvos',
  ]) {
    await expect(perf).toContainText(stage);
  }
  // O total aparece como "x,xx ms / 12,0 ms" e fecha o quadro na ordem de grandeza esperada: o
  // C00 é leve, então fica longe do teto mesmo num Chromium sem GPU.
  const head = (await perf.locator('p').first().textContent()) ?? '';
  const total = Number((/([\d,]+) ms \/ 12,0 ms/.exec(head)?.[1] ?? 'NaN').replace(',', '.'));
  expect(total).toBeGreaterThan(0);
  expect(total).toBeLessThan(12);
  // Fechar o painel desliga a medição: o contador para de ganhar quadros.
  await page.keyboard.press('F9');
  await expect(perf).toBeHidden();
});
