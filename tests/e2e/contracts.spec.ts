import { expect, test } from '@playwright/test';

/**
 * Cada contrato do catálogo, de ponta a ponta com o autopilot (F7): voa o plano de referência
 * até o fim sem queda nem colisão, leva os dados à Workstation e confere o relatório aprovado e
 * o setor no museu. Rodar um só: `npx playwright test tests/e2e/contracts.spec.ts --grep C01`.
 *
 * `photos` é o total do plano de referência; `pec` diz se o relatório mostra a classe PEC-PCD. O autopilot cuida de várias surtidas: o C05 gasta 2
 * baterias (RTH na primeira, "Nova surtida" sozinho, e o pós-voo só aparece ao fim).
 */
const CONTRACTS = [
  {
    id: 'C01',
    title: 'Metrópole Vertical',
    lines: 10,
    photos: 190,
    pec: true,
    souvenir: 'Chave da Cidade',
  },
  {
    id: 'C05',
    title: 'Centro Histórico Colonial',
    lines: 14,
    photos: 210,
    pec: true,
    souvenir: 'Azulejo Português',
  },
  {
    id: 'C06',
    title: 'Zona Costeira e Estuário',
    lines: 7,
    photos: 224,
    pec: false,
    souvenir: 'Garrafa com Mapa',
  },
] as const;

for (const c of CONTRACTS) {
  test(`${c.id} ${c.title}: autopilot sem queda → relatório aprovado → museu`, async ({ page }) => {
    test.setTimeout(240_000);
    await page.goto(
      `/?debug=1&skipIntro=1&autopilot=1&seed=4&contract=${c.id}&screen=SURVEY_FLIGHT`,
    );
    await expect(page.getByTestId('survey-flight-screen')).toBeVisible();
    await expect(page.getByTestId('hud-line')).toContainText(`/${c.lines}`, { timeout: 30_000 });

    // "Voo concluído" (e não "Queda"): o autopilot passou por cima de tudo.
    const post = page.getByRole('dialog', { name: 'Voo concluído' });
    await expect(post).toBeVisible({ timeout: 150_000 });
    const photos = Number(await post.getByTestId('post-photos').textContent());
    expect(Math.abs(photos - c.photos) / c.photos).toBeLessThan(0.1);
    await expect(post.getByTestId('post-collisions')).toHaveText('0');
    await expect(page.getByTestId('world-map-screen')).toBeVisible({ timeout: 5000 });

    // Um passo para leste chega à porta da sede.
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(220);
    await page.keyboard.up('ArrowRight');
    await expect(page.getByTestId('world-prompt')).toContainText('Entrar na sede');
    await page.keyboard.press('Space');
    await expect(page.getByTestId('office-screen')).toBeVisible();

    const money = await page.getByTestId('top-bar').textContent();
    await page.getByRole('button', { name: 'Workstation' }).click();
    await page.getByTestId('workstation-panel').getByRole('button', { name: 'Processar' }).click();
    await expect(page.getByTestId('pipeline')).toBeVisible();

    await expect(page.getByTestId('report')).toBeVisible({ timeout: 90_000 });
    await expect(page.getByTestId('report-status')).toHaveText('APROVADO');
    // Só os contratos com PEC-PCD têm classe; os de ASPRS mostram apenas as exigências.
    const cls = page.getByTestId('report-class');
    if (c.pec) await expect(cls).toHaveText(/^Classe [ABC]$/);
    else await expect(cls).toHaveCount(0);
    await page.getByRole('tab', { name: 'Pagamento' }).click();
    await expect(page.getByTestId('payment-total')).toBeVisible();
    await expect(page.getByTestId('souvenir-card')).toContainText(c.souvenir);

    await page.getByTestId('send-museum').click();
    await expect(page.getByTestId('holo-screen')).toBeVisible();
    await expect(page.getByTestId('sector-card')).toContainText(c.title);
    await expect(page.getByTestId('top-bar')).not.toHaveText(money ?? '');
  });
}
