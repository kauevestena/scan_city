import { expect, type Locator, type Page } from '@playwright/test';

/** Ajudas para os testes de teclado: o foco só chega aos controles por teclas, nunca por `focus()`. */

/** O elemento focado agora, para mensagens de erro legíveis. */
export async function describeFocus(page: Page): Promise<string> {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return 'corpo da página';
    const label = el.getAttribute('aria-label') ?? el.textContent ?? '';
    return `${el.tagName.toLowerCase()} "${label.trim().slice(0, 40)}"`;
  });
}

/**
 * Leva o foco ao elemento `target` pressionando `key` (Tab por padrão) até ele ficar focado.
 * Falha, dizendo onde o foco parou, se não chegar em `max` passos: o controle seria inalcançável.
 */
export async function reach(page: Page, target: Locator, key = 'Tab', max = 80): Promise<void> {
  await expect(target).toBeVisible();
  for (let step = 0; step < max; step++) {
    if (await target.evaluate((el) => el === document.activeElement)) return;
    await page.keyboard.press(key);
  }
  throw new Error(
    `o foco não chegou a ${String(target)} com ${key}; parou em ${await describeFocus(page)}`,
  );
}

/** Alcança o controle pelo teclado e o ativa com Enter. */
export async function activate(page: Page, target: Locator, key = 'Tab'): Promise<void> {
  await reach(page, target, key);
  await page.keyboard.press('Enter');
}

/** Segura uma tecla por `ms` milissegundos. */
export async function hold(page: Page, key: string, ms: number): Promise<void> {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
}
