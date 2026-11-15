import { expect, test } from '@playwright/test';

/**
 * Cada contrato do catálogo, de ponta a ponta com o autopilot (F7): voa o plano de referência
 * até o fim sem queda nem colisão, leva os dados à Workstation e confere o relatório aprovado e
 * o setor no museu. Rodar um só: `npx playwright test tests/e2e/contracts.spec.ts --grep C01`.
 *
 * `photos` é o total do plano de referência (`null` nos voos de LiDAR); `pec` diz se o relatório
 * mostra a classe PEC-PCD; `rift` marca as fendas, cujo setor ainda não aparece na mesa
 * holográfica (a ala do Multiverso chega com a Mesa completa, T072). O autopilot cuida de várias
 * surtidas: o C05 gasta 2 baterias (RTH na primeira, "Nova surtida" sozinho, e o pós-voo só
 * aparece ao fim).
 */
interface Entry {
  id: string;
  title: string;
  lines: number;
  photos: number | null;
  pec: boolean;
  souvenir: string;
  rift?: boolean;
}

const CONTRACTS: readonly Entry[] = [
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
  {
    id: 'C02',
    title: 'Planalto Agrícola',
    lines: 8,
    photos: 328,
    pec: true,
    souvenir: 'Espiga Dourada',
  },
  {
    id: 'C04',
    title: 'Mina a Céu Aberto',
    lines: 9,
    photos: 243,
    pec: false,
    souvenir: 'Pepita de Minério',
  },
  {
    id: 'C03',
    title: 'Floresta Amazônica',
    lines: 7,
    photos: null,
    pec: false,
    souvenir: 'Semente de Castanheira',
  },
  {
    id: 'R01',
    title: 'Colinas Verdes dos Espinhos',
    lines: 8,
    photos: 208,
    pec: true,
    souvenir: 'Anel Dourado',
    rift: true,
  },
  {
    id: 'R02',
    title: 'Reino dos Encanamentos',
    lines: 7,
    photos: 105,
    pec: true,
    souvenir: 'Cano Verde em Miniatura',
    rift: true,
  },
];

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
    // Os voos de LiDAR não contam fotos do plano (a nuvem é o dado): `photos: null`.
    if (c.photos !== null) {
      const photos = Number(await post.getByTestId('post-photos').textContent());
      expect(Math.abs(photos - c.photos) / c.photos).toBeLessThan(0.1);
    }
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
    if (!c.rift) await expect(page.getByTestId('sector-card')).toContainText(c.title);
    await expect(page.getByTestId('top-bar')).not.toHaveText(money ?? '');
  });
}
