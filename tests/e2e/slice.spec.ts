import { expect, test, type Page } from '@playwright/test';

const hint = (page: Page) => page.getByTestId('tutorial-hint');

test('vertical slice do C00: escritório → campo → voo → recarregar → processar → museu', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.goto('/?debug=1&autopilot=1&skipIntro=1&seed=4');
  await expect(page.getByTestId('office-screen')).toBeVisible();
  await page.getByRole('button', { name: 'Porta — sair para o mapa' }).click();

  // 1. Mapa: dica do marcador.
  await expect(page.getByTestId('world-map-screen')).toBeVisible();
  await expect(hint(page)).toHaveAttribute('data-step', '0');
  await page.keyboard.press('F9');
  await page.locator('[data-teleport="C00"]').click();
  await page.keyboard.press('F9');
  await expect(page.getByTestId('world-prompt')).toContainText('Sítio do Avô');
  await page.keyboard.press('Enter');
  const briefing = page.getByRole('dialog', { name: 'Sítio do Avô' });
  await expect(briefing).toBeVisible();
  await briefing.getByRole('button', { name: 'Aceitar' }).click();

  // 2–3. Campo: GCPs pela sugestão automática; plano: mexer na altura.
  await expect(page.getByTestId('field-setup-screen')).toBeVisible();
  await expect(hint(page)).toHaveAttribute('data-step', '1');
  await page.getByTestId('suggest-gcps').click();
  await expect(hint(page)).toBeHidden();
  await page.getByRole('tab', { name: '2 · Plano de voo' }).click();
  await expect(hint(page)).toHaveAttribute('data-step', '2');
  await page.getByRole('slider', { name: 'Altura (H)' }).focus();
  await page.keyboard.press('ArrowLeft');
  await expect(hint(page)).toBeHidden();
  await page.getByRole('tab', { name: '4 · Checklist' }).click();
  await page.getByTestId('takeoff').click();

  // 4. Voo com autopilot (×8) e "Levar dados".
  await expect(page.getByTestId('survey-flight-screen')).toBeVisible();
  await expect(hint(page)).toHaveAttribute('data-step', '3');
  await expect(page.getByRole('dialog', { name: 'Voo concluído' })).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByTestId('world-map-screen')).toBeVisible({ timeout: 5000 });
  await expect(hint(page)).toBeHidden();

  // Recarregar no meio: a missão continua na fila (autosave da troca de tela).
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('scan-city-save') ?? ''), {
      timeout: 5000,
    })
    .toContain('"pendingMissions":[{');
  await page.goto('/?debug=1&skipIntro=1');
  await expect(page.getByTestId('office-screen')).toBeVisible();
  await expect(page.getByText('Há 1 missão aguardando processamento na Workstation')).toBeVisible();

  // 5. Processamento no notebook e relatório.
  await page.getByRole('button', { name: 'Workstation' }).click();
  await page.getByTestId('workstation-panel').getByRole('button', { name: 'Processar' }).click();
  await expect(page.getByTestId('pipeline')).toBeVisible();
  await expect(page.getByTestId('report')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('report-status')).toHaveText('APROVADO');
  await expect(hint(page)).toHaveAttribute('data-step', '4');
  await page.getByRole('tab', { name: 'Cobertura' }).click();
  await expect(hint(page)).toBeHidden();

  // Museu: a mesa mostra o setor do C00.
  await page.getByTestId('send-museum').click();
  await expect(page.getByTestId('holo-screen')).toBeVisible();
  await expect(page.getByTestId('sector-card')).toContainText('Sítio do Avô');
  await expect(page.getByTestId('holo-empty')).toBeHidden();
  // Nenhuma tela do fluxo usou o shell de depuração.
  await expect(page.getByTestId('debug-screen-shell')).toHaveCount(0);
  // As 5 dicas foram vistas (o autosave grava 1 s depois da troca de tela).
  await expect
    .poll(
      () =>
        page.evaluate(
          () => JSON.parse(localStorage.getItem('scan-city-save') ?? '{}').flags?.tutorialStep,
        ),
      { timeout: 5000 },
    )
    .toBe(5);
});
