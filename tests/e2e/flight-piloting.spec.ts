import { expect, test, type Page } from '@playwright/test';
import { activate } from './keyboard';

/**
 * O voo com desafio (ADR-029, REQ-FLT-025 a 029, REQ-NFR-010) de ponta a ponta, sem autopilot:
 * pilotando só pelo teclado, o C00 aprova; parado, a linha volta com o boletim de revoo.
 */

const FLIGHT = '/?debug=1&skipIntro=1&seed=4&screen=SURVEY_FLIGHT';

interface HudReading {
  done: boolean;
  phase?: string;
  crossTrack?: string;
  corridorDelta?: string;
  corridorTol?: string;
  speedRatio?: string;
}

/** O que o HUD mostra agora (os números de `data-*`), e se o voo acabou (um modal aberto). */
async function readHud(page: Page): Promise<HudReading> {
  return page.evaluate(() => {
    const done = document.querySelector('[role="dialog"]') !== null;
    const hud = document.querySelector<HTMLElement>('[data-testid="flight-hud"]');
    return hud ? { done, ...hud.dataset } : { done };
  });
}

/** Folgas do piloto: na faixa (m), na velocidade (fração da do plano) e a antecipação (s). */
const LANE_DEADBAND_M = 0.8;
const SPEED_DEADBAND = 0.06;
const LEAD_S = 0.25;

/**
 * Um jogador atento ao HUD, só com teclas seguradas (tudo ou nada, como no teclado): `A`/`D`
 * trazem o desvio da faixa para o eixo, `Q`/`E` seguem a seta de altura do corredor e `W`/`S`
 * seguram a velocidade no solo. Ele vê o HUD a 10 Hz, como qualquer um, e antecipa o desvio
 * pela velocidade com que ele muda. Pilota até o pós-voo abrir.
 */
async function pilotUntilDone(page: Page, maxMs: number): Promise<void> {
  const held = new Set<string>();
  const want = async (key: string, on: boolean) => {
    if (on && !held.has(key)) {
      await page.keyboard.down(key);
      held.add(key);
    } else if (!on && held.has(key)) {
      await page.keyboard.up(key);
      held.delete(key);
    }
  };
  let last: { x: number; t: number } | null = null;
  let vx = 0;
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const hud = await readHud(page);
    if (hud.done) break;
    const now = Date.now();
    const run = hud.phase === 'RUN';
    const x = Number(hud.crossTrack ?? 0);
    if (!last || x !== last.x) {
      if (last && run) vx = (x - last.x) / Math.max(0.05, (now - last.t) / 1000);
      last = { x, t: now };
    }
    if (!run) vx = 0;
    const ahead = x + vx * LEAD_S;
    const dz = Number(hud.corridorDelta ?? 0);
    const tol = Number(hud.corridorTol ?? 1);
    const ratio = Number(hud.speedRatio ?? 1);
    await want('a', run && ahead > LANE_DEADBAND_M);
    await want('d', run && ahead < -LANE_DEADBAND_M);
    await want('q', run && dz > tol);
    await want('e', run && dz < -tol);
    await want('s', run && ratio > 1 + SPEED_DEADBAND);
    await want('w', run && ratio < 1 - SPEED_DEADBAND);
    await page.waitForTimeout(30);
  }
  for (const key of [...held]) await page.keyboard.up(key);
}

test('C00 pilotado só pelo teclado: as linhas passam, o boletim aceita e o relatório aprova', async ({
  page,
}) => {
  test.setTimeout(480_000);
  await page.goto(FLIGHT);
  await expect(page.getByTestId('flight-hud')).toBeVisible();
  await pilotUntilDone(page, 400_000);

  const post = page.getByRole('dialog', { name: 'Voo concluído' });
  await expect(post).toBeVisible();
  // Nenhuma linha ficou para revoar e a execução da missão passa do mínimo com folga.
  await expect(post.getByTestId('post-execution')).toBeVisible();
  await expect(post.locator('li[data-refly="true"]')).toHaveCount(0);
  const pct = Number(await post.getByTestId('post-mission-execution').getAttribute('data-pct'));
  expect(pct).toBeGreaterThanOrEqual(60);

  // "Levar dados" pelo teclado (o foco já está no modal), e o processamento no escritório.
  await activate(page, post.getByTestId('post-take'));
  await expect(page.getByTestId('world-map-screen')).toBeVisible({ timeout: 5000 });
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('scan-city-save') ?? ''), {
      timeout: 5000,
    })
    .toContain('"pendingMissions":[{');
  await page.goto('/?debug=1&skipIntro=1');
  await expect(page.getByTestId('office-screen')).toBeVisible();
  await activate(page, page.getByRole('button', { name: 'Workstation' }));
  await activate(
    page,
    page.getByTestId('workstation-panel').getByRole('button', { name: 'Processar' }),
  );
  await expect(page.getByTestId('report')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('report-status')).toHaveText('APROVADO');
});

test('C00 sem nenhum comando: a primeira linha volta com o boletim de revoo', async ({ page }) => {
  test.setTimeout(150_000);
  await page.goto(FLIGHT);
  await expect(page.getByTestId('flight-hud')).toBeVisible();
  // O erro de entrada e as rajadas tiram o parado do corredor: a linha 1 fecha reprovada.
  const report = page.getByTestId('hud-line-report');
  await expect(report).toBeVisible({ timeout: 120_000 });
  await expect(report).toHaveAttribute('data-accepted', 'false');
  await expect(report).toContainText('LINHA 1');
  await expect(report).toContainText('REVOO NECESSÁRIO');

  // O retorno à base (pedido já na linha seguinte: na curva ele não vale) mostra a linha a
  // revoar e uma execução longe do mínimo.
  await expect(page.getByTestId('flight-hud')).toHaveAttribute('data-phase', 'RUN', {
    timeout: 10_000,
  });
  await page.keyboard.press('r');
  await expect(page.getByTestId('hud-rth-confirm')).toBeVisible();
  await page.keyboard.press('r');
  const post = page.getByRole('dialog', { name: 'Retorno à base' });
  await expect(post).toBeVisible({ timeout: 30_000 });
  await expect(post.locator('li[data-refly="true"]').first()).toBeVisible();
  const pct = Number(await post.getByTestId('post-mission-execution').getAttribute('data-pct'));
  expect(pct).toBeLessThan(40);
});
