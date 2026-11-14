import { expect, test } from '@playwright/test';

// `unlockAll` entrega a Van Lab (e o resto do inventário); o autopilot faz o voo do C00.
test('Van Lab: voo → "Processar agora" em campo → esteira → relatório → volta ao mapa (T13)', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.goto('/?debug=1&skipIntro=1&autopilot=1&unlockAll=1&screen=SURVEY_FLIGHT');
  const dialog = page.getByRole('dialog', { name: 'Voo concluído' });
  await expect(dialog).toBeVisible({ timeout: 45_000 });
  // O autopilot de depuração leva os dados ao escritório sozinho depois de ~1,5 s; é preciso
  // clicar antes, ou o fluxo já terá seguido para o mapa.
  await dialog.getByRole('button', { name: /Processar agora/ }).click({ timeout: 1000 });

  await expect(page.getByTestId('processing-screen')).toBeVisible();
  await expect(page.getByTestId('pipeline')).toBeVisible();
  await expect(page.getByTestId('report')).toBeVisible({ timeout: 25_000 });
  await expect(page.getByTestId('report-status')).toHaveText('APROVADO');

  // Em campo, o fim da esteira volta ao mapa, não ao escritório.
  await page.getByRole('button', { name: 'Voltar ao mapa' }).click();
  await expect(page.getByTestId('world-map-screen')).toBeVisible();
});
