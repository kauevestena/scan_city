import { expect, test, type Page } from '@playwright/test';
import { activate, hold, reach } from './keyboard';

/**
 * REQ-NFR-007 e REQ-INP-006: o jogo se joga inteiro sem mouse. Nada aqui chama `click()`,
 * `focus()` ou `hover()` num elemento: o foco chega ao controle só por `Tab`, setas e `Enter`
 * (`reach`), e o vertical slice do C00 (escritório → mapa → campo → voo → processamento →
 * museu) é percorrido com o teclado como único dispositivo.
 */

/** Posição do avatar: o store a grava a cada 1 s, e o `beforeunload` a leva ao localStorage. */
async function avatarAt(page: Page): Promise<{ x: number; y: number }> {
  await page.waitForTimeout(1100);
  return page.evaluate(() => {
    window.dispatchEvent(new Event('beforeunload'));
    const save = JSON.parse(localStorage.getItem('scan-city-save') ?? '{}') as {
      world: { avatar: { x: number; y: number } };
    };
    return save.world.avatar;
  });
}

/**
 * Anda com as setas até a coordenada `to` (em tiles) no eixo dado, medindo a posição a cada
 * rodada: o tempo de cada trecho é só uma estimativa, e a medição corrige o resto.
 */
async function walkAxis(page: Page, axis: 'x' | 'y', to: number): Promise<void> {
  const tilesPerS = 4;
  for (let round = 0; round < 8; round++) {
    const at = await avatarAt(page);
    const delta = to - at[axis];
    if (Math.abs(delta) < 0.2) return;
    const key =
      axis === 'x' ? (delta > 0 ? 'ArrowRight' : 'ArrowLeft') : delta > 0 ? 'ArrowDown' : 'ArrowUp';
    await hold(page, key, Math.max(60, (Math.abs(delta) / tilesPerS) * 1000 * 0.9));
  }
  throw new Error(`o avatar não chegou a ${axis} = ${to} com as setas`);
}

const hint = (page: Page) => page.getByTestId('tutorial-hint');

test('vertical slice do C00 só com o teclado: escritório → mapa → campo → voo → processamento → museu', async ({
  page,
}) => {
  test.setTimeout(240_000);
  await page.goto('/?debug=1&autopilot=1&skipIntro=1&seed=4');
  await expect(page.getByTestId('office-screen')).toBeVisible();

  // Escritório: o foco já está na Porta; Enter sai para o mapa.
  await expect(page.getByRole('button', { name: 'Porta — sair para o mapa' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('world-map-screen')).toBeVisible();
  // A dica do tutorial não é alcançável pelo foco (o Tab troca de dimensão): o H a dispensa.
  await expect(hint(page)).toHaveAttribute('data-step', '0');
  await page.keyboard.press('h');
  await expect(hint(page)).toBeHidden();

  // Mapa: a pé, pela rua (à porta da sede e daí ao marcador do C00), só com as setas.
  await walkAxis(page, 'x', 80.5);
  await walkAxis(page, 'y', 75.5);
  await walkAxis(page, 'x', 96.5);
  await walkAxis(page, 'y', 78.5);
  await expect(page.getByTestId('world-prompt')).toContainText('Sítio do Avô');
  await page.keyboard.press('Enter');
  const briefing = page.getByRole('dialog', { name: 'Sítio do Avô' });
  await expect(briefing).toBeVisible();
  // O foco entra no modal (no "Avançar diálogo"); o Tab anda até "Aceitar" e o Enter aceita.
  await expect(briefing.getByRole('button', { name: 'Avançar diálogo' })).toBeFocused();
  await activate(page, briefing.getByRole('button', { name: 'Aceitar' }));

  // Campo: GCPs pela sugestão automática, plano com a altura mexida por seta, checklist, decolar.
  await expect(page.getByTestId('field-setup-screen')).toBeVisible();
  await activate(page, page.getByTestId('suggest-gcps'));
  const planTab = page.getByRole('tab', { name: '2 · Plano de voo' });
  await page.keyboard.press('e');
  await expect(planTab).toHaveAttribute('aria-selected', 'true');
  await reach(page, page.getByRole('slider', { name: 'Altura (H)' }));
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('e');
  await page.keyboard.press('e');
  await expect(page.getByRole('tab', { name: '4 · Checklist' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await activate(page, page.getByTestId('takeoff'));

  // Voo com autopilot (×8), a dica do voo dispensada pelo teclado e "Levar dados" (autopilot).
  await expect(page.getByTestId('survey-flight-screen')).toBeVisible();
  await expect(hint(page)).toHaveAttribute('data-step', '3');
  await page.keyboard.press('h');
  await expect(hint(page)).toBeHidden();
  await expect(page.getByRole('dialog', { name: 'Voo concluído' })).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByTestId('world-map-screen')).toBeVisible({ timeout: 5000 });

  // Recarrega no meio: a missão continua na fila (autosave da troca de tela).
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('scan-city-save') ?? ''), {
      timeout: 5000,
    })
    .toContain('"pendingMissions":[{');
  await page.goto('/?debug=1&skipIntro=1');
  await expect(page.getByTestId('office-screen')).toBeVisible();

  // Processamento: a Workstation, "Processar", o relatório e o museu, sempre por foco e Enter.
  await activate(page, page.getByRole('button', { name: 'Workstation' }));
  await activate(
    page,
    page.getByTestId('workstation-panel').getByRole('button', { name: 'Processar' }),
  );
  await expect(page.getByTestId('pipeline')).toBeVisible();
  await expect(page.getByTestId('report')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('report-status')).toHaveText('APROVADO');
  await expect(hint(page)).toHaveAttribute('data-step', '4');
  await page.keyboard.press('h');
  await expect(hint(page)).toBeHidden();
  await activate(page, page.getByRole('tab', { name: 'Cobertura' }), 'ArrowRight');
  await activate(page, page.getByTestId('send-museum'));
  await expect(page.getByTestId('holo-screen')).toBeVisible();
  await expect(page.getByTestId('sector-card')).toContainText('Sítio do Avô');
});

test('mesa holográfica só com o teclado: o painel de alas recebe o foco, anda por seta e foca o setor', async ({
  page,
}) => {
  // Preparação (não faz parte do caminho do jogador): o atalho de depuração mapeia os 18 setores,
  // o save os guarda e a mesa abre de novo com eles. O `Tab` da mesa troca de dimensão, então o
  // painel F9 não é alcançável por foco ali.
  await page.goto('/?debug=1&skipIntro=1&unlockAll=1&screen=HOLO_TABLE_VIEW');
  await expect(page.getByTestId('holo-screen')).toBeVisible();
  await page.keyboard.press('F9');
  await page.getByTestId('debug-map-all').evaluate((el) => (el as HTMLElement).click());
  await page.evaluate(() => window.dispatchEvent(new Event('beforeunload')));
  await page.goto('/?debug=1&skipIntro=1&screen=HOLO_TABLE_VIEW');
  await expect(page.getByTestId('holo-screen')).toHaveAttribute('data-mapped', '7');

  // W abre o painel e o foco entra nele; as setas andam pelos botões (sem orbitar a câmera).
  await page.keyboard.press('w');
  const panel = page.getByTestId('wings-panel');
  await expect(panel).toBeVisible();
  const inPanel = () =>
    page.evaluate(() => document.activeElement?.closest('[data-testid="wings-panel"]') !== null);
  await expect.poll(inPanel).toBe(true);
  const row = panel.getByTestId('wing-row-C03').getByRole('button', { name: /C03/ });
  await reach(page, row.last(), 'ArrowDown', 30);
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('sector-card')).toContainText('Floresta Amazônica');
  // A estrela do mesmo setor é o botão ao lado: o Enter a ativa e o painel recalcula o destaque.
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Enter');
  await expect(
    panel.getByTestId('wing-row-C03').getByRole('button', { pressed: true }),
  ).toBeVisible();
  // W fecha o painel; o Tab volta a trocar de dimensão (sem fendas descobertas, avisa).
  await page.keyboard.press('w');
  await expect(panel).toBeHidden();
});

test('campo só com o teclado: a mira remove e coloca GCP e CP, e a vista anda com WASD', async ({
  page,
}) => {
  // A missão de depuração já traz 5 GCPs (um deles no centro da AOI, sob a mira) e 2 CPs.
  await page.goto('/?debug=1&skipIntro=1&screen=FIELD_SETUP');
  await expect(page.getByTestId('field-setup-screen')).toBeVisible();
  const distribution = page.getByTestId('distribution');
  const counts = async () => ((await distribution.textContent()) ?? '').replace(/\s+/g, ' ');
  await expect.poll(counts).toContain('GCPs5 / 3CPs2 / 0');
  // O Tab chega ao mapa e a mira aparece no centro.
  await reach(page, page.getByTestId('satellite-canvas'));
  await expect(page.getByTestId('satellite-crosshair')).toBeVisible();
  // Borracha (X) + Enter remove o GCP que está sob a mira.
  await page.keyboard.press('x');
  await page.keyboard.press('Enter');
  await expect.poll(counts).toContain('GCPs4 / 3');
  // GCP (G) + Enter o coloca de volta no mesmo lugar.
  await page.keyboard.press('g');
  await page.keyboard.press('Enter');
  await expect.poll(counts).toContain('GCPs5 / 3');
  // WASD anda a vista debaixo da mira; CP (C) + Enter coloca um CP no lugar novo e a Borracha o tira.
  await hold(page, 'd', 350);
  await page.keyboard.press('c');
  await page.keyboard.press('Enter');
  await expect.poll(counts).toContain('CPs3 / 0');
  await page.keyboard.press('x');
  await page.keyboard.press('Enter');
  await expect.poll(counts).toContain('CPs2 / 0');
});

test('relatório: o quadro da nuvem 3D recebe o foco e as setas orbitam', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/?debug=1&skipIntro=1&unlockAll=1&autopilot=1');
  await expect(page.getByTestId('office-screen')).toBeVisible();
  await page.keyboard.press('F9');
  await page
    .getByRole('button', { name: 'Gerar missão pendente' })
    .evaluate((el) => (el as HTMLElement).click());
  await page.keyboard.press('F9');
  await activate(page, page.getByRole('button', { name: 'Workstation' }));
  await activate(
    page,
    page.getByTestId('workstation-panel').getByRole('button', { name: 'Processar' }),
  );
  await expect(page.getByTestId('report')).toBeVisible({ timeout: 60_000 });
  // Q/E trocam as abas do relatório até "Produtos"; no visualizador, o Tab chega à aba ativa e a
  // seta leva o foco e a seleção até "Nuvem / TIN".
  for (let i = 0; i < 3; i++) await page.keyboard.press('e');
  await reach(page, page.getByRole('tab', { name: 'Ortofoto' }));
  await reach(page, page.getByRole('tab', { name: 'Nuvem / TIN' }), 'ArrowRight');
  const canvas = page.getByTestId('cloud-canvas');
  await expect(canvas).toBeVisible({ timeout: 30_000 });
  await reach(page, canvas);
  // As setas viram órbita (não saem do quadro): o foco continua nele depois delas.
  for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowLeft');
  await expect(canvas).toBeFocused();
});

test('voo manual só com o teclado: Espaço dispara, W/A/D pilotam, R pede o retorno e outro R o confirma', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.goto('/?debug=1&skipIntro=1&screen=SURVEY_FLIGHT');
  await expect(page.getByTestId('survey-flight-screen')).toBeVisible();
  // Espera o HUD aparecer e a decolagem (2,5 s) acabar: o voo segue na primeira linha.
  await expect(page.getByTestId('hud-line')).toBeVisible();
  await expect(page.getByTestId('hud-phase')).toBeHidden({ timeout: 10_000 });
  const photos = async () =>
    Number(
      (((await page.getByTestId('hud-photos').textContent()) ?? '').split('/')[0] ?? '').replace(
        /\D/g,
        '',
      ),
    );
  const before = await photos();
  await page.keyboard.press('Space');
  await expect.poll(photos).toBeGreaterThan(before);
  // W anda para a frente e A/D desviam: o HUD segue o avanço pela linha.
  const lineProgress = () => page.getByTestId('hud-line').textContent();
  await hold(page, 'w', 1500);
  await hold(page, 'a', 300);
  await expect(page.getByTestId('hud-line')).toBeVisible();
  expect(await lineProgress()).toContain('LINHA');
  // R pede o retorno à base; o prompt de confirmação aparece e outro R confirma.
  await page.keyboard.press('r');
  await expect(page.getByTestId('hud-rth-confirm')).toBeVisible();
  await page.keyboard.press('r');
  // O pós-voo é um modal: o foco entra nele e o Tab chega a "Levar dados", que o Enter ativa.
  const dialog = page.getByRole('dialog', { name: 'Retorno à base' });
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  await expect.poll(() => dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  await activate(page, dialog.getByTestId('post-take'));
  await expect(page.getByTestId('world-map-screen')).toBeVisible({ timeout: 5000 });
});
