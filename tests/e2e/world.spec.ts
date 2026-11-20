import { expect, test, type Page } from '@playwright/test';

/** Segura uma tecla por `ms` milissegundos. */
async function hold(page: Page, key: string, ms: number) {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
}

const avatar = (page: Page) =>
  page.evaluate(() => {
    const raw = localStorage.getItem('scan-city-save');
    return raw
      ? (JSON.parse(raw) as { world: { avatar: { x: number; y: number } } }).world.avatar
      : null;
  });

test('sai pela porta, anda com setas e WASD, esbarra num prédio e volta à sede', async ({
  page,
}) => {
  await page.goto('/?debug=1&skipIntro=1');
  await page.getByRole('button', { name: 'Porta — sair para o mapa' }).click();
  const map = page.getByTestId('world-map-screen');
  await expect(map).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Contratos do Mundo Real' })).toBeVisible();
  await expect(page.getByTestId('world-vehicle')).toHaveText('Veículo: A Pé / Bicicleta');
  await expect(page.getByRole('img', { name: 'Minimapa' })).toBeVisible();
  await expect(page.getByTestId('world-prompt')).toBeHidden();

  // Ao norte do spawn há um prédio: o avatar para e a dica aparece.
  await hold(page, 'ArrowUp', 400);
  await expect(page.getByTestId('world-hint')).toHaveText('Prédio — contorne pela rua');

  // Um passo para leste (D) chega à porta: o prompt aparece com o glyph de INTERACT.
  await hold(page, 'd', 220);
  const prompt = page.getByTestId('world-prompt');
  await expect(prompt).toContainText('Entrar na sede');
  await expect(prompt.locator('[data-glyph-action="INTERACT"]')).toBeVisible();

  await page.keyboard.press('Space');
  await expect(page.getByTestId('office-screen')).toBeVisible();
  // A posição foi gravada na saída (autosave da troca de tela).
  await expect
    .poll(async () => (await avatar(page))?.x ?? 0, { timeout: 5000 })
    .toBeGreaterThan(80);
});

test('a posição do avatar é gravada e restaurada ao voltar ao mapa', async ({ page }) => {
  await page.goto('/?debug=1&skipIntro=1');
  await page.getByRole('button', { name: 'Porta — sair para o mapa' }).click();
  await expect(page.getByTestId('world-map-screen')).toBeVisible();
  // Desce pela rua ao sul da porta.
  await hold(page, 'ArrowRight', 220);
  await hold(page, 's', 600);
  // Gravada a cada 1 s; o autosave de 30 s ou o beforeunload levam ao localStorage.
  await page.waitForTimeout(1200);
  const before = await page.evaluate(() => {
    window.dispatchEvent(new Event('beforeunload'));
    return JSON.parse(localStorage.getItem('scan-city-save') ?? '{}').world.avatar as {
      x: number;
      y: number;
    };
  });
  expect(before.y).toBeGreaterThan(73);
  // O jogo sempre abre no escritório; a depuração leva direto ao mapa, no mesmo lugar.
  await page.goto('/?debug=1&screen=WORLD_MAP');
  await expect(page.getByTestId('world-map-screen')).toBeVisible();
  await expect(page.getByTestId('world-prompt')).toBeHidden();
  await page.waitForTimeout(1200);
  expect(await avatar(page)).toMatchObject(before);
});

test('teleporta até o C00, abre o briefing e aceita: vai ao planejamento de campo', async ({
  page,
}) => {
  await page.goto('/?debug=1&skipIntro=1&seed=4');
  await page.getByRole('button', { name: 'Porta — sair para o mapa' }).click();
  await expect(page.getByTestId('world-map-screen')).toBeVisible();
  await page.keyboard.press('F9');
  await page.locator('[data-teleport="C00"]').click();
  await page.keyboard.press('F9');
  const prompt = page.getByTestId('world-prompt');
  await expect(prompt).toHaveText(/Ver contrato "Sítio do Avô"/);

  await page.keyboard.press('Space');
  const briefing = page.getByRole('dialog', { name: 'Sítio do Avô' });
  await expect(briefing).toBeVisible();
  await expect(briefing.getByTestId('briefing-requirements').getByRole('listitem')).toHaveCount(7);
  // Esc recusa; INTERACT de novo reabre.
  await page.keyboard.press('Escape');
  await expect(briefing).toBeHidden();
  await page.keyboard.press('Enter');
  await expect(briefing).toBeVisible();
  await briefing.getByRole('button', { name: 'Aceitar' }).click();
  await expect(page.getByTestId('field-setup-screen')).toBeVisible();
  await expect(page.getByTestId('field-contract')).toHaveText('Sítio do Avô');
});
