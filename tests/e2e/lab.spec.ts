import { expect, test, type Page } from '@playwright/test';

/** Pixels âmbar (pixel projetado, topo do prédio) do diagrama e uma impressão do quadro. */
async function canvasProbe(page: Page): Promise<{ amber: number; cyan: number; frame: string }> {
  return page.getByTestId('lab-canvas').evaluate((c: HTMLCanvasElement) => {
    const ctx = c.getContext('2d');
    if (!ctx) throw new Error('canvas sem contexto 2D');
    const data = ctx.getImageData(0, 0, c.width, c.height).data;
    let amber = 0;
    let cyan = 0;
    let hash = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i] as number;
      const g = data[i + 1] as number;
      const b = data[i + 2] as number;
      if (r > 220 && g > 160 && b < 90) amber++;
      else if (r < 80 && g > 170 && b > 190) cyan++;
      hash = (hash * 31 + r + g * 3 + b * 7) | 0;
    }
    return { amber, cyan, frame: String(hash) };
  });
}

test('o laboratório abre pelo hotspot do escritório, reage aos sliders nas duas abas e volta com Esc', async ({
  page,
}) => {
  await page.goto('/?debug=1&skipIntro=1');
  await expect(page.getByTestId('office-screen')).toBeVisible();
  await page.locator('[data-hotspot="LAB"]').click();
  const lab = page.getByTestId('lab-screen');
  await expect(lab).toBeVisible();
  await expect(lab).toHaveAttribute('data-panel', 'OPTICS');

  // Óptica: os valores da G2 (H 100 m, f 35 mm, pixel 4,38 µm → GSD 1,25 cm/px).
  await expect(page.getByTestId('reading-gsd')).toHaveText('1,25 cm/px');
  await expect(page.getByTestId('formula-0')).toContainText('= 1,25 cm/px');
  await page.getByRole('slider', { name: 'Altura H' }).focus();
  await page.keyboard.press('PageUp');
  await expect(page.getByRole('slider', { name: 'Altura H' })).toHaveAttribute(
    'aria-valuenow',
    '110',
  );
  await expect(page.getByTestId('reading-gsd')).toHaveText('1,38 cm/px');

  // Estereoscopia: b, Δp, h reconstruído e σ_Z da G14/G15 (B 30, H 100, h 20, f 35 mm).
  await page.getByRole('tab', { name: /Estereoscopia/ }).click();
  await expect(lab).toHaveAttribute('data-panel', 'STEREO');
  await expect(page.getByTestId('reading-b')).toHaveText('10,50 mm');
  await expect(page.getByTestId('reading-dp')).toHaveText('2,625 mm');
  await expect(page.getByTestId('reading-h')).toHaveText('20,00 m');
  await expect(page.getByTestId('reading-sigma-z')).toHaveText('2,09 cm');
  await page.getByRole('slider', { name: 'Base B' }).focus();
  await page.keyboard.press('PageUp');
  await expect(page.getByTestId('reading-b')).toHaveText('14,00 mm');
  await expect(page.getByTestId('reading-h')).toHaveText('20,00 m');

  // As abas guardam os sliders de cada painel.
  await page.getByRole('tab', { name: /Óptica/ }).click();
  await expect(page.getByRole('slider', { name: 'Altura H' })).toHaveAttribute(
    'aria-valuenow',
    '110',
  );

  await page.keyboard.press('Escape');
  await expect(page.getByTestId('office-screen')).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Jogo pausado' })).toBeHidden();
});

test('"Usar valores do meu equipamento" preenche os sliders com a câmera do Atlas', async ({
  page,
}) => {
  await page.goto('/?debug=1&skipIntro=1&screen=INFOGRAPHIC_LAB');
  await expect(page.getByTestId('lab-screen')).toBeVisible();
  await page.getByTestId('use-equipment').click();
  await expect(page.getByTestId('equipment-note')).toContainText('Câmera de Peito do Avô');
  await expect(page.getByRole('slider', { name: 'Focal f' })).toHaveAttribute(
    'aria-valuenow',
    '4.5',
  );
  // 80 m (teto do Atlas) · 1,89 µm / 4,5 mm = 3,36 cm/px.
  await expect(page.getByTestId('reading-gsd')).toHaveText('3,36 cm/px');
});

test('os diagramas são desenhados e animados no canvas (óptica e estereoscopia)', async ({
  page,
}) => {
  await page.goto('/?debug=1&skipIntro=1&screen=INFOGRAPHIC_LAB');
  await expect(page.getByTestId('lab-canvas')).toBeVisible();
  // Óptica: o pixel projetado em âmbar e o cone de raios em ciano; os pontos de luz andam.
  await expect.poll(async () => (await canvasProbe(page)).amber).toBeGreaterThan(20);
  const a = await canvasProbe(page);
  expect(a.cyan).toBeGreaterThan(500);
  await page.waitForTimeout(400);
  expect((await canvasProbe(page)).frame).not.toBe(a.frame);

  await page.getByRole('tab', { name: /Estereoscopia/ }).click();
  await expect.poll(async () => (await canvasProbe(page)).amber).toBeGreaterThan(20);
  const s = await canvasProbe(page);
  await page.waitForTimeout(400);
  expect((await canvasProbe(page)).frame).not.toBe(s.frame);
});
