import { expect, test } from '@playwright/test';

/** A animação CSS que o quadro da tela está rodando: nome e duração. */
const animationOf = (page: import('@playwright/test').Page) =>
  page.getByTestId('screen-transition').evaluate((el) => {
    const style = getComputedStyle(el);
    return { name: style.animationName, duration: style.animationDuration };
  });

test('trocar de tela entra com fade de 200 ms', async ({ page }) => {
  await page.goto('/?debug=1&skipIntro=1');
  await expect(page.getByTestId('office-screen')).toBeVisible();
  // A abertura do jogo entra sem fade.
  await expect(page.getByTestId('screen-transition')).toHaveAttribute('data-transition', 'NONE');
  await page.locator('[data-hotspot="DOOR"]').click();
  await expect(page.getByTestId('world-map-screen')).toBeVisible();
  const frame = page.getByTestId('screen-transition');
  await expect(frame).toHaveAttribute('data-transition', 'FADE');
  expect(await animationOf(page)).toEqual({ name: 'screen-fade', duration: '0.2s' });
});

test('sair da aba Fendas do mapa ganha a distorção; com "Reduzir flashes", só o fade', async ({
  page,
}) => {
  await page.goto('/?debug=1&skipIntro=1&unlockAll=1&screen=WORLD_MAP');
  await expect(page.getByTestId('world-map-screen')).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('tab', { name: /Fendas/ })).toHaveAttribute('aria-selected', 'true');

  // Sai do mapa (pausa → "Sair para o escritório"): a transição vem da fenda.
  await page.keyboard.press('m');
  await page
    .getByRole('dialog', { name: 'Jogo pausado' })
    .getByRole('button', { name: 'Sair para o escritório' })
    .click();
  await expect(page.getByTestId('office-screen')).toBeVisible();
  await expect(page.getByTestId('screen-transition')).toHaveAttribute('data-transition', 'RIFT');
  expect(await animationOf(page)).toEqual({ name: 'screen-rift', duration: '0.2s' });

  // Mesma saída com "Reduzir flashes e tremores": o fade simples.
  await page.locator('[data-hotspot="DOOR"]').click();
  await expect(page.getByTestId('world-map-screen')).toBeVisible();
  // A aba escolhida fica guardada: o mapa reabre na aba Fendas.
  await expect(page.getByRole('tab', { name: /Fendas/ })).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('m');
  const menu = page.getByRole('dialog', { name: 'Jogo pausado' });
  await menu.getByRole('button', { name: 'Configurações' }).click();
  await page.getByTestId('setting-reduce-flashes').click();
  await page.getByTestId('pause-back').click();
  await menu.getByRole('button', { name: 'Sair para o escritório' }).click();
  await expect(page.getByTestId('office-screen')).toBeVisible();
  await expect(page.getByTestId('screen-transition')).toHaveAttribute('data-transition', 'FADE');
  expect(await animationOf(page)).toEqual({ name: 'screen-fade', duration: '0.2s' });
});
