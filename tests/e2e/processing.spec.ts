import { expect, test } from '@playwright/test';

test('C00: autopilot → mapa → sede → Workstation → esteira → relatório aprovado → museu', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.goto('/?debug=1&skipIntro=1&autopilot=1&screen=SURVEY_FLIGHT');
  await expect(page.getByRole('dialog', { name: 'Voo concluído' })).toBeVisible({
    timeout: 45_000,
  });
  await expect(page.getByTestId('world-map-screen')).toBeVisible({ timeout: 5000 });

  // Um passo para leste chega à porta da sede.
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(220);
  await page.keyboard.up('ArrowRight');
  await expect(page.getByTestId('world-prompt')).toContainText('Entrar na sede');
  await page.keyboard.press('Space');
  await expect(page.getByTestId('office-screen')).toBeVisible();

  // A barra superior não aparece no processamento: o saldo é lido antes.
  const money = await page.getByTestId('top-bar').textContent();
  await page.getByRole('button', { name: 'Workstation' }).click();
  await page.getByTestId('workstation-panel').getByRole('button', { name: 'Processar' }).click();
  await expect(page.getByTestId('pipeline')).toBeVisible();

  // Notebook: 6 + 0,08 · 96 ≈ 13,7 s de esteira.
  await expect(page.getByTestId('report')).toBeVisible({ timeout: 25_000 });
  await expect(page.getByTestId('report-status')).toHaveText('APROVADO');
  await expect(page.getByTestId('report-class')).toHaveText(/^Classe [ABC]$/);
  await page.getByRole('tab', { name: 'Pagamento' }).click();
  await expect(page.getByTestId('payment-total')).toBeVisible();
  await expect(page.getByTestId('souvenir-card')).toContainText('Caderneta de Campo do Avô');

  await page.getByTestId('send-museum').click();
  await expect(page.getByTestId('holo-screen')).toBeVisible();
  await expect(page.getByTestId('sector-card')).toContainText('Sítio do Avô');
  // O saldo da barra superior subiu com o pagamento.
  await expect(page.getByTestId('top-bar')).not.toHaveText(money ?? '');
});
