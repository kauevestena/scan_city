import { expect, test, type Locator, type Page } from '@playwright/test';
import { describeFocus } from './keyboard';

/**
 * REQ-INP-006: com um painel, modal ou menu aberto, o D-pad e o analógico movem o foco, A confirma
 * e B volta. O controle é emulado por `navigator.getGamepads` (layout `standard` do Xbox) e nenhum
 * teste aqui aperta uma tecla ou usa o mouse: o app lê o controle a cada quadro.
 */

const BUTTON = {
  A: 0,
  B: 1,
  X: 2,
  Y: 3,
  LB: 4,
  RB: 5,
  VIEW: 8,
  MENU: 9,
  UP: 12,
  DOWN: 13,
  LEFT: 14,
  RIGHT: 15,
} as const;
type Button = keyof typeof BUTTON;

const BASE = '/?debug=1&skipIntro=1&unlockAll=1';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const pad = {
      id: 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)',
      index: 0,
      connected: true,
      mapping: 'standard',
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
      timestamp: 0,
    };
    (window as unknown as { __pad: typeof pad }).__pad = pad;
    navigator.getGamepads = () => [pad as unknown as Gamepad];
  });
});

/** Aperta e solta um botão: segura por alguns quadros para o app ver a borda de subida. */
async function tap(page: Page, button: Button, holdMs = 90): Promise<void> {
  const index = BUTTON[button];
  await page.evaluate((i) => {
    const pad = (
      window as unknown as { __pad: { buttons: Array<{ pressed: boolean; value: number }> } }
    ).__pad;
    pad.buttons[i] = { pressed: true, value: 1 };
  }, index);
  await page.waitForTimeout(holdMs);
  await page.evaluate((i) => {
    const pad = (
      window as unknown as { __pad: { buttons: Array<{ pressed: boolean; value: number }> } }
    ).__pad;
    pad.buttons[i] = { pressed: false, value: 0 };
  }, index);
  await page.waitForTimeout(60);
}

/** Leva o foco a `target` apertando as direções em rodízio; falha dizendo onde o foco parou. */
async function padReach(
  page: Page,
  target: Locator,
  directions: readonly Button[] = ['DOWN'],
  max = 24,
): Promise<void> {
  await expect(target).toBeVisible();
  for (let step = 0; step < max; step++) {
    if (await target.evaluate((el) => el === document.activeElement)) return;
    await tap(page, directions[step % directions.length] as Button);
  }
  throw new Error(
    `o D-pad não levou o foco a ${String(target)}; parou em ${await describeFocus(page)}`,
  );
}

/** Primeiro toque: o app só reconhece o controle depois do primeiro quadro com ele ligado. */
async function wake(page: Page): Promise<void> {
  await page.waitForTimeout(250);
  await tap(page, 'VIEW');
}

test('o controle é reconhecido: a tabela de controles passa a mostrar o dispositivo e os glyphs do Xbox', async ({
  page,
}) => {
  await page.goto(BASE);
  await expect(page.getByTestId('office-screen')).toBeVisible();
  await wake(page);
  await tap(page, 'MENU');
  const pause = page.getByRole('dialog', { name: 'Jogo pausado' });
  await expect(pause).toBeVisible();
  await padReach(page, pause.getByRole('button', { name: 'Controles' }), ['DOWN']);
  await tap(page, 'A');
  const controls = page.getByTestId('controls-panel');
  await expect(controls).toBeVisible();
  await expect(page.getByTestId('controls-device')).toHaveText('Dispositivo ativo: Xbox');
  // O botão de pausa mostra o do controle ("≡ Menu"), não o `Esc` do teclado.
  await expect(controls).toContainText('≡ Menu');
});

test('pausa só com o controle: Menu abre, o D-pad chega a Configurações, A abre, B volta e B retoma', async ({
  page,
}) => {
  await page.goto(BASE);
  await expect(page.getByTestId('office-screen')).toBeVisible();
  await wake(page);
  await tap(page, 'MENU');
  const pause = page.getByRole('dialog', { name: 'Jogo pausado' });
  await expect(pause).toBeVisible();
  await padReach(page, pause.getByRole('button', { name: 'Configurações' }), ['DOWN']);
  await tap(page, 'A');
  await expect(page.getByTestId('settings-panel')).toBeVisible();
  await tap(page, 'B');
  await expect(page.getByTestId('pause-menu')).toBeVisible();
  await tap(page, 'B');
  await expect(pause).toBeHidden();
});

test('escritório só com o controle: o D-pad anda pelos hotspots e A abre o painel; B fecha e devolve o foco', async ({
  page,
}) => {
  await page.goto(BASE);
  await expect(page.getByTestId('office-screen')).toBeVisible();
  await wake(page);
  await expect(page.locator('[data-hotspot="DOOR"]')).toBeFocused();
  // O D-pad leva o foco da Porta à Garagem (a busca completa pelos nove hotspots, com as setas
  // do teclado, está em `office.spec.ts`; a navegação é a mesma `useFocusNavigation`).
  const garage = page.locator('[data-hotspot="GARAGE"]');
  await padReach(page, garage, ['RIGHT', 'DOWN', 'LEFT', 'UP'], 30);
  await tap(page, 'A');
  const panel = page.getByTestId('garage-panel');
  await expect(panel).toBeVisible();
  await expect.poll(() => panel.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  // Dentro do painel o D-pad anda pelos controles: o foco entra no ✕ e sai dele pelas direções.
  const before = await describeFocus(page);
  for (const dir of ['DOWN', 'LEFT', 'DOWN'] as const) {
    if ((await describeFocus(page)) !== before) break;
    await tap(page, dir);
  }
  expect(await describeFocus(page)).not.toBe(before);
  await tap(page, 'B');
  await expect(panel).toBeHidden();
  await expect(garage).toBeFocused();
});

test('campo só com o controle: LB e RB trocam de aba, B volta uma aba e, na primeira, pede confirmação', async ({
  page,
}) => {
  await page.goto(`${BASE}&screen=FIELD_SETUP`);
  await expect(page.getByTestId('field-setup-screen')).toBeVisible();
  await wake(page);
  const selected = () =>
    page.evaluate(
      () => document.querySelector('[role=tab][aria-selected=true]')?.textContent?.trim() ?? '',
    );
  expect(await selected()).toBe('1 · Pontos de apoio');
  await tap(page, 'RB');
  await expect.poll(selected).toBe('2 · Plano de voo');
  await tap(page, 'RB');
  await expect.poll(selected).toBe('3 · Calibração');
  await tap(page, 'LB');
  await expect.poll(selected).toBe('2 · Plano de voo');
  await tap(page, 'B');
  await expect.poll(selected).toBe('1 · Pontos de apoio');
  await tap(page, 'B');
  const confirm = page.getByRole('dialog', { name: 'Abandonar o planejamento?' });
  await expect(confirm).toBeVisible();
  // O D-pad chega a "Abandonar" e B cancela de volta ao planejamento.
  await padReach(page, confirm.getByRole('button', { name: 'Abandonar' }), ['RIGHT', 'DOWN']);
  await tap(page, 'B');
  await expect(confirm).toBeHidden();
  await expect(page.getByTestId('field-setup-screen')).toBeVisible();
});

test('mesa só com o controle: RB abre o painel de alas, o D-pad chega a um setor, A o foca e RB fecha', async ({
  page,
}) => {
  // Preparação (não é o caminho do jogador): o atalho de depuração mapeia os 18 setores.
  await page.goto(`${BASE}&screen=HOLO_TABLE_VIEW`);
  await expect(page.getByTestId('holo-screen')).toBeVisible();
  await page.keyboard.press('F9');
  await page.getByTestId('debug-map-all').evaluate((el) => (el as HTMLElement).click());
  await page.keyboard.press('F9');
  await wake(page);
  await tap(page, 'RB');
  const panel = page.getByTestId('wings-panel');
  await expect(panel).toBeVisible();
  await expect.poll(() => panel.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  const row = panel.getByTestId('wing-row-C03').getByRole('button', { name: /C03/ }).last();
  await padReach(page, row, ['DOWN'], 40);
  await tap(page, 'A');
  await expect(page.getByTestId('sector-card')).toContainText('Floresta Amazônica');
  await tap(page, 'RB');
  await expect(panel).toBeHidden();
});

test('briefing só com o controle: A interage no marcador, o D-pad chega a "Aceitar" e A aceita', async ({
  page,
}) => {
  // Pela Porta, como no jogo (com `screen=` a depuração pula o tutorial): A sai da sede e a dica
  // da etapa 0 aparece no mapa.
  await page.goto('/?debug=1&skipIntro=1&seed=4');
  await expect(page.getByTestId('office-screen')).toBeVisible();
  await wake(page);
  await tap(page, 'A');
  await expect(page.getByTestId('world-map-screen')).toBeVisible();
  // Preparação: o atalho de depuração leva o avatar ao marcador do C00.
  await page.keyboard.press('F9');
  await page.locator('[data-teleport="C00"]').evaluate((el) => (el as HTMLElement).click());
  await page.keyboard.press('F9');
  await expect(page.getByTestId('world-prompt')).toContainText('Sítio do Avô');
  // A dica do tutorial sai com o View do controle (o foco não chega a ela no mapa).
  await expect(page.getByTestId('tutorial-hint')).toBeVisible();
  await tap(page, 'VIEW');
  await expect(page.getByTestId('tutorial-hint')).toBeHidden();
  await tap(page, 'A');
  const briefing = page.getByRole('dialog', { name: 'Sítio do Avô' });
  await expect(briefing).toBeVisible();
  await padReach(page, briefing.getByRole('button', { name: 'Aceitar' }), ['DOWN', 'RIGHT']);
  await tap(page, 'A');
  await expect(page.getByTestId('field-setup-screen')).toBeVisible();
});
