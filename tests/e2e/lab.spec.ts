import { expect, test, type Page } from '@playwright/test';

/** Pixels de cada cor do diagrama (âmbar, ciano, violeta, emerald) e uma impressão do quadro. */
async function canvasProbe(
  page: Page,
): Promise<{ amber: number; cyan: number; violet: number; emerald: number; frame: string }> {
  return page.getByTestId('lab-canvas').evaluate((c: HTMLCanvasElement) => {
    const ctx = c.getContext('2d');
    if (!ctx) throw new Error('canvas sem contexto 2D');
    const data = ctx.getImageData(0, 0, c.width, c.height).data;
    let amber = 0;
    let cyan = 0;
    let violet = 0;
    let emerald = 0;
    let hash = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i] as number;
      const g = data[i + 1] as number;
      const b = data[i + 2] as number;
      if (r > 220 && g > 160 && b < 90) amber++;
      else if (r < 80 && g > 170 && b > 190) cyan++;
      else if (r > 100 && r < 180 && g < 130 && b > 200) violet++;
      else if (r < 90 && g > 190 && b > 120 && b < 190) emerald++;
      hash = (hash * 31 + r + g * 3 + b * 7) | 0;
    }
    return { amber, cyan, violet, emerald, frame: String(hash) };
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
  // O Atlas sobe até 120 m: vale a altura de trabalho do laboratório, 100 m.
  // 100 m · 1,89 µm / 4,5 mm = 4,20 cm/px.
  await expect(page.getByTestId('reading-gsd')).toHaveText('4,20 cm/px');
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

test('os quatro painéis: dossel (G16) e shutter (G11) reagem aos sliders e desenham o diagrama', async ({
  page,
}) => {
  await page.goto('/?debug=1&skipIntro=1&screen=INFOGRAPHIC_LAB');
  const lab = page.getByTestId('lab-screen');
  await expect(lab).toBeVisible();
  await expect(page.getByRole('tab')).toHaveCount(4);

  // Dossel: 97 % de cobertura e 5 retornos dão P_solo = 10,76 % (G16).
  await page.getByRole('tab', { name: /LiDAR vs\. Fotogrametria/ }).click();
  await expect(lab).toHaveAttribute('data-panel', 'CANOPY');
  await page.getByRole('slider', { name: 'Cobertura do dossel' }).focus();
  await page.keyboard.press('End');
  await page.keyboard.press('ArrowLeft');
  await page.getByRole('slider', { name: 'Nº máximo de retornos' }).focus();
  await page.keyboard.press('End');
  await expect(page.getByTestId('reading-p-ground')).toHaveText('10,76 %');
  await expect(page.getByTestId('reading-verdict')).toHaveText('MDT confiável');
  // Os pulsos, os retornos (ciano, violeta, emerald) e os raios da câmera (âmbar) são desenhados.
  await expect
    .poll(async () => {
      const p = await canvasProbe(page);
      return p.cyan > 30 && p.violet > 30 && p.emerald > 30 && p.amber > 30;
    })
    .toBe(true);
  const canopy = await canvasProbe(page);
  await page.waitForTimeout(500);
  expect((await canvasProbe(page)).frame).not.toBe(canopy.frame);

  // Shutter: v 8 m/s, leitura de 30 ms e GSD de 2,74 cm dão skew de 8,76 px (G11).
  await page.getByRole('tab', { name: /Global vs\. Rolling/ }).click();
  await expect(lab).toHaveAttribute('data-panel', 'SHUTTER');
  await expect(page.getByTestId('reading-skew')).toHaveText('8,76 px');
  await expect(page.getByTestId('reading-rmse-no-rtk')).toHaveText('× 1,35');
  await expect.poll(async () => (await canvasProbe(page)).amber).toBeGreaterThan(20);
  // A varredura recomeça a cada ciclo (0,6 s de leitura em câmera lenta e uma pausa de 1,4 s):
  // amostrando por 2,5 s, o quadro muda em algum momento.
  const frames = new Set<string>();
  for (let k = 0; k < 20; k++) {
    frames.add((await canvasProbe(page)).frame);
    await page.waitForTimeout(125);
  }
  expect(frames.size).toBeGreaterThan(1);

  await page.getByRole('slider', { name: 'Velocidade v' }).focus();
  await page.keyboard.press('Home');
  await expect(page.getByTestId('reading-skew')).toHaveText('0,00 px');
  await page.getByTestId('shutter-global').click();
  await expect(page.getByTestId('shutter-global')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('reading-rmse-no-rtk')).toHaveText('× 1,00');

  // Voltando, cada painel guarda os próprios sliders.
  await page.getByRole('tab', { name: /LiDAR vs\. Fotogrametria/ }).click();
  await expect(page.getByRole('slider', { name: 'Cobertura do dossel' })).toHaveAttribute(
    'aria-valuenow',
    '97',
  );
});
