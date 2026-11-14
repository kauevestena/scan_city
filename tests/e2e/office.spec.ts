import { expect, test } from '@playwright/test';

test('novo jogo: intro de 4 cartões → foco na Porta → Enter vai ao mapa', async ({ page }) => {
  await page.goto('/');
  const intro = page.getByRole('dialog', { name: 'Uma carta na mesa' });
  await expect(intro).toBeVisible();
  // Cada cartão: Enter completa a linha, Enter avança.
  for (let i = 0; i < 8; i++) await page.keyboard.press('Enter');
  await expect(intro).toBeHidden();
  const door = page.getByRole('button', { name: 'Porta — sair para o mapa' });
  await expect(door).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('world-map-screen')).toBeVisible();
});

test('só com o teclado, os 6 hotspots do escritório são alcançáveis a partir da Porta', async ({
  page,
}) => {
  await page.goto('/?debug=1&skipIntro=1');
  const focused = () =>
    page.evaluate(() => document.activeElement?.getAttribute('data-hotspot') ?? '');
  await expect.poll(focused).toBe('DOOR');
  // Busca em largura pelas setas: de cada hotspot alcançado, tenta as 4 direções.
  const seen = new Set<string>(['DOOR']);
  const queue = ['DOOR'];
  while (queue.length > 0) {
    const from = queue.shift() as string;
    for (const key of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) {
      await page.focus(`[data-hotspot="${from}"]`);
      await page.keyboard.press(key);
      const to = await focused();
      if (to && !seen.has(to)) {
        seen.add(to);
        queue.push(to);
      }
    }
  }
  expect([...seen].sort()).toEqual([
    'CAREER',
    'DOOR',
    'GARAGE',
    'HOLO_TABLE',
    'LAB',
    'WORKSTATION',
  ]);
  // E o Enter ativa o hotspot focado.
  await page.focus('[data-hotspot="WORKSTATION"]');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('workstation-panel')).toBeVisible();
});

test('Workstation → Processar leva ao processamento da missão pendente', async ({ page }) => {
  await page.goto('/?debug=1&skipIntro=1');
  await expect(page.getByTestId('office-screen')).toBeVisible();
  await page.keyboard.press('F9');
  await page.getByRole('button', { name: 'Gerar missão pendente' }).click();
  await page.keyboard.press('F9');
  await page.getByRole('button', { name: 'Workstation' }).click();
  await page.getByTestId('workstation-panel').getByRole('button', { name: 'Processar' }).click();
  await expect(page.getByTestId('processing-screen')).toBeVisible();
  await expect(page.getByTestId('pipeline')).toBeVisible();
  await expect(page.getByTestId('processing-header')).toContainText('Notebook Velho Lento');
});

test('Garagem: comprar o Drone T1 debita o saldo e o card vira "Possuído"; Esc devolve o foco', async ({
  page,
}) => {
  // Saldo de R$ 7.300 (progression §3 do critério de aceite).
  await page.goto('/?debug=1&skipIntro=1&money=7300');
  await expect(page.getByTestId('office-screen')).toBeVisible();
  await page.getByRole('button', { name: 'Garagem' }).click();
  const panel = page.getByTestId('garage-panel');
  await expect(panel).toBeVisible();
  const t1 = panel.getByTestId('shop-item-DRONE_T1');
  await expect(t1).toHaveAttribute('data-state', 'BUY');
  await t1.getByRole('button', { name: 'Comprar' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Comprar' }).click();
  await expect(t1).toHaveAttribute('data-state', 'OWNED');
  await expect(page.getByTestId('top-bar')).toContainText('1.300');
  // Esc fecha e devolve o foco à Garagem.
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expect(page.locator('[data-hotspot="GARAGE"]')).toBeFocused();
});
