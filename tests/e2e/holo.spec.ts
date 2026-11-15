import { expect, test } from '@playwright/test';

test('chega à mesa pelo envio ao museu (T11): setor focado e esculpido; orbita e volta', async ({
  page,
}) => {
  await page.goto('/?debug=1&skipIntro=1&screen=PROCESSING_RESULTS');
  await expect(page.getByTestId('processing-screen')).toBeVisible();
  await page.keyboard.press('F9');
  await page.locator('[data-transition="T11"]').click();
  await page.keyboard.press('F9');
  const holo = page.getByTestId('holo-screen');
  await expect(holo).toBeVisible();
  await expect(page.getByTestId('sector-card')).toContainText('Sítio do Avô');
  await expect(page.getByTestId('holo-empty')).toBeHidden();

  // Arrastar orbita sem trocar a seleção.
  const box = await page.getByTestId('holo-canvas').boundingBox();
  if (!box) throw new Error('canvas sem tamanho');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 150, box.y + box.height / 2, { steps: 6 });
  await page.mouse.up();
  await expect(page.getByTestId('sector-card')).toContainText('Sítio do Avô');

  await page.keyboard.press('Escape');
  await expect(page.getByTestId('office-screen')).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Jogo pausado' })).toBeHidden();
});
