import { expect, test, type Page } from '@playwright/test';

/**
 * Um navegador ou contexto que recusa uma API não pode derrubar o jogo: o controle bloqueado pela
 * Permissions Policy (o jogo num iframe de outra origem), o áudio sem dispositivo e o armazenamento
 * bloqueado (este está em `persistence.spec.ts`). O jogo segue, sem erro e sem essa função.
 */

const FLIGHT = '/?debug=1&skipIntro=1&unlockAll=1&autopilot=1&screen=SURVEY_FLIGHT&contract=C01';

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

/** Fotos tiradas, lidas do HUD ("Fotos" + "12 / 184"). */
async function photos(page: Page): Promise<number> {
  const text = (await page.getByTestId('hud-photos').textContent()) ?? '';
  return Number(/(\d+)\s*\/\s*\d+/.exec(text)?.[1] ?? 0);
}

test('com a Gamepad API bloqueada, o voo anda e o teclado segue valendo', async ({ page }) => {
  // `getGamepads` lança `SecurityError` quando a Permissions Policy bloqueia o controle.
  await page.addInitScript(() => {
    navigator.getGamepads = () => {
      throw new DOMException('Gamepad API bloqueada', 'SecurityError');
    };
  });
  const errors = collectErrors(page);
  await page.goto(FLIGHT);
  await expect(page.getByTestId('survey-flight-screen')).toBeVisible();
  // Se o loop do voo morresse no primeiro quadro, o autopilot nunca tiraria uma foto.
  await expect.poll(() => photos(page), { timeout: 30_000 }).toBeGreaterThan(0);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('pause-menu')).toBeVisible();
  expect(errors).toEqual([]);
});

test('sem dispositivo de áudio, o jogo abre e anda mudo, sem erro', async ({ page }) => {
  await page.addInitScript(() => {
    const blocked = function () {
      throw new DOMException('Audio device unavailable', 'NotSupportedError');
    };
    Object.assign(window, { AudioContext: blocked, webkitAudioContext: blocked });
  });
  const errors = collectErrors(page);
  await page.goto('/?debug=1&skipIntro=1');
  await expect(page.getByTestId('office-screen')).toBeVisible();
  // Cada gesto tenta liberar o áudio; nenhum deles pode lançar.
  await page.keyboard.press('Shift');
  await page.getByRole('button', { name: 'Porta — sair para o mapa' }).click();
  await expect(page.getByTestId('world-map-screen')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('pause-menu')).toBeVisible();
  expect(errors).toEqual([]);
});
