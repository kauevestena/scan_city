import { expect, test } from '@playwright/test';

const SFX = [
  'SHUTTER',
  'RTH_BEEP',
  'PIGEON_COO',
  'CASH_REGISTER',
  'CRASH',
  'UI_CLICK',
  'UI_HOVER',
  'ALERT',
  'TAKEOFF',
  'RIFT_OPEN',
  'LEVEL_UP',
  'COLLECT',
  'DENIED',
  'STAGE_DONE',
  'GRADE',
  'GRADE_MISS',
];
const LOOPS = ['LIDAR_HUM', 'MOTOR', 'WIND', 'PROCESSING'];

test('a mesa de som toca todos os efeitos e loops na Web Audio real, sem erros', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });

  await page.goto('/?debug=1&screen=SOUNDBOARD');
  await expect(page.getByText('Clique ou aperte uma tecla para liberar o áudio.')).toBeVisible();

  for (const id of SFX) await page.getByRole('button', { name: id, exact: true }).click();
  await expect(page.getByText('Clique ou aperte uma tecla para liberar o áudio.')).toBeHidden();

  for (const variant of ['Multirrotor', 'Asa fixa', 'Atlas']) {
    await page.getByRole('tab', { name: variant }).click();
    for (const id of LOOPS) {
      const toggle = page.getByRole('button', { name: id, exact: true });
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    }
    await page.waitForTimeout(400);
    for (const id of LOOPS) await page.getByRole('button', { name: id, exact: true }).click();
  }

  await page.getByRole('button', { name: 'Som ligado' }).click();
  await expect(page.getByRole('button', { name: 'Mudo' })).toBeVisible();
  await page.waitForTimeout(800);
  expect(errors).toEqual([]);
});
