import { expect, test, type Page } from '@playwright/test';

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

interface CanvasStats {
  cyan: number;
  violet: number;
  corners: number[][];
}

/** Lê o canvas da mesa: pixels ciano/violeta e a cor dos quatro cantos (o fundo da cena). */
async function canvasStats(page: Page): Promise<CanvasStats> {
  return page.getByTestId('holo-canvas').evaluate((c: HTMLCanvasElement) => {
    const ctx = c.getContext('2d');
    if (!ctx) throw new Error('canvas sem contexto 2D');
    const { width, height } = c;
    const data = ctx.getImageData(0, 0, width, height).data;
    let cyan = 0;
    let violet = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i] as number;
      const g = data[i + 1] as number;
      const b = data[i + 2] as number;
      if (r < 90 && g > 150 && b > 170) cyan++;
      else if (r > 100 && g < 130 && b > 200) violet++;
    }
    const px = (x: number, y: number) => Array.from(ctx.getImageData(x, y, 1, 1).data.slice(0, 3));
    return {
      cyan,
      violet,
      corners: [px(3, 3), px(width - 4, 3), px(3, height - 4), px(width - 4, height - 4)],
    };
  });
}

const backgrounds = (stats: CanvasStats, rgb: string) =>
  stats.corners.filter((c) => c.join(',') === rgb).length;

/** FPS médio dos quadros de animação durante `seconds`. */
async function measureFps(page: Page, seconds: number): Promise<number> {
  return page.evaluate(
    (ms) =>
      new Promise<number>((resolve) => {
        let frames = 0;
        const t0 = performance.now();
        const tick = (t: number) => {
          frames++;
          if (t - t0 < ms) requestAnimationFrame(tick);
          else resolve((frames * 1000) / (t - t0));
        };
        requestAnimationFrame(tick);
      }),
    seconds * 1000,
  );
}

/** Abre a mesa com os 18 contratos mapeados (`?unlockAll=1` + F9 "Mapear tudo"). */
async function openMapped(page: Page): Promise<void> {
  await page.goto('/?debug=1&skipIntro=1&unlockAll=1&screen=HOLO_TABLE_VIEW');
  await expect(page.getByTestId('holo-screen')).toBeVisible();
  await page.keyboard.press('F9');
  await page.getByTestId('debug-map-all').click();
  await page.keyboard.press('F9');
  await expect(page.getByTestId('holo-screen')).toHaveAttribute('data-mapped', '7');
}

test('modos 1/2/3: no LiDAR Neon o fundo fica preto e o setor vira pontos e wireframe ciano', async ({
  page,
}) => {
  await page.goto('/?debug=1&skipIntro=1&screen=PROCESSING_RESULTS');
  await expect(page.getByTestId('processing-screen')).toBeVisible();
  await page.keyboard.press('F9');
  await page.locator('[data-transition="T11"]').click();
  await page.keyboard.press('F9');
  const holo = page.getByTestId('holo-screen');
  await expect(holo).toBeVisible();
  await expect(holo).toHaveAttribute('data-mode', 'ORTHO');
  await expect(page.getByRole('button', { name: '1 Ortofoto' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  // Ortofoto: fundo slate-950.
  await expect.poll(async () => backgrounds(await canvasStats(page), '2,6,23')).toBeGreaterThan(2);
  const ortho = await canvasStats(page);

  await page.keyboard.press('3');
  await expect(holo).toHaveAttribute('data-mode', 'NEON');
  await expect(page.getByRole('button', { name: '3 LiDAR Neon' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  // Preto puro, com os pontos ciano do heightmap do setor mapeado.
  await expect.poll(async () => backgrounds(await canvasStats(page), '0,0,0')).toBeGreaterThan(2);
  const neon = await canvasStats(page);
  expect(neon.cyan).toBeGreaterThan(ortho.cyan);

  await page.keyboard.press('2');
  await expect(holo).toHaveAttribute('data-mode', 'HYPSO');
  await expect.poll(async () => backgrounds(await canvasStats(page), '2,6,23')).toBeGreaterThan(2);
  await page.getByRole('button', { name: '1 Ortofoto' }).click();
  await expect(holo).toHaveAttribute('data-mode', 'ORTHO');
});

test('Tab alterna Terra Real ↔ Multiverso: com a R01 concluída, o anel tem 1 diorama esculpido e 10 em wireframe violeta', async ({
  page,
}) => {
  await page.goto('/?debug=1&skipIntro=1&screen=PROCESSING_RESULTS&contract=R01');
  await expect(page.getByTestId('processing-screen')).toBeVisible();
  await page.keyboard.press('F9');
  await page.locator('[data-transition="T11"]').click();
  await page.keyboard.press('F9');
  const holo = page.getByTestId('holo-screen');
  // A chegada de uma fenda já abre no Multiverso, com o diorama dela selecionado.
  await expect(holo).toHaveAttribute('data-dimension', 'RIFT');
  await expect(page.getByTestId('sector-card')).toContainText('Colinas Verdes dos Espinhos');
  await expect(holo).toHaveAttribute('data-sectors', '11');
  await expect(holo).toHaveAttribute('data-mapped', '1');
  await expect.poll(async () => (await canvasStats(page)).violet).toBeGreaterThan(500);

  await page.keyboard.press('Tab');
  await expect(holo).toHaveAttribute('data-dimension', 'REAL');
  await expect(holo).toHaveAttribute('data-sectors', '7');
  await expect(holo).toHaveAttribute('data-mapped', '0');
  await page.keyboard.press('Tab');
  await expect(holo).toHaveAttribute('data-dimension', 'RIFT');
  await expect(holo).toHaveAttribute('data-mapped', '1');
  await page.getByRole('tab', { name: 'Terra Real' }).click();
  await expect(holo).toHaveAttribute('data-dimension', 'REAL');
});

test('sem fendas, o Multiverso fica desabilitado ("Nenhuma anomalia registrada")', async ({
  page,
}) => {
  await page.goto('/?debug=1&skipIntro=1&screen=HOLO_TABLE_VIEW');
  const holo = page.getByTestId('holo-screen');
  await expect(holo).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Multiverso' })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
  await page.keyboard.press('Tab');
  await expect(holo).toHaveAttribute('data-dimension', 'REAL');
  await expect(page.getByText('Nenhuma anomalia registrada')).toBeVisible();
  await expect(page.getByTestId('holo-empty')).toContainText('Conclua contratos');
});

test('painel de alas: renda por ala, destaque (×2) e visitantes', async ({ page }) => {
  test.setTimeout(60_000);
  await openMapped(page);
  await page.keyboard.press('w');
  const panel = page.getByTestId('wings-panel');
  await expect(panel).toBeVisible();
  // Cada setor do depurador rende R$ 10,00/min: 7 na Real, 11 no Multiverso.
  await expect(page.getByTestId('wing-income-REAL')).toContainText('R$ 70,00/min');
  await expect(page.getByTestId('wing-income-RIFT')).toContainText('R$ 110,00/min');
  await expect(page.getByTestId('wings-visitors')).toContainText('Visitantes: 1.080/h');

  await page.getByRole('button', { name: 'Destacar Metrópole Vertical' }).click();
  await expect(page.getByTestId('wing-income-REAL')).toContainText('R$ 80,00/min');
  await expect(page.getByTestId('wing-income-RIFT')).toContainText('R$ 110,00/min');
  await expect(page.getByTestId('wings-visitors')).toContainText('Visitantes: 1.140/h');
  await page.getByRole('button', { name: 'Remover o destaque de Metrópole Vertical' }).click();
  await expect(page.getByTestId('wing-income-REAL')).toContainText('R$ 70,00/min');

  // Clicar no setor de outra ala troca a dimensão e o seleciona.
  await page
    .getByTestId('wing-row-R03')
    .getByText(/Planalto dos Guerreiros/)
    .click();
  await expect(page.getByTestId('holo-screen')).toHaveAttribute('data-dimension', 'RIFT');
  await expect(page.getByTestId('sector-card')).toContainText('Planalto dos Guerreiros');
  await page.keyboard.press('w');
  await expect(panel).toBeHidden();
});

test('com os 18 setores mapeados a mesa roda fluida nas duas dimensões e nos três modos', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await openMapped(page);
  const holo = page.getByTestId('holo-screen');
  const measured: Record<string, number> = {};
  for (const dimension of ['REAL', 'RIFT'] as const) {
    if (dimension === 'RIFT') {
      await page.keyboard.press('Tab');
      await expect(holo).toHaveAttribute('data-sectors', '11');
    }
    for (const [key, mode] of [
      ['1', 'ORTHO'],
      ['2', 'HYPSO'],
      ['3', 'NEON'],
    ] as const) {
      await page.keyboard.press(key);
      await expect(holo).toHaveAttribute('data-mode', mode);
      // Deixa a cena nova assentar (e a queda automática de qualidade agir, se precisar).
      await page.waitForTimeout(400);
      measured[`${dimension}/${mode}`] = await measureFps(page, 2);
    }
  }
  // O alvo do jogo é ≥ 55 FPS; o Chromium sem GPU do CI é bem mais lento, então aqui só se
  // garante que nenhuma combinação desaba (a medição vai no relatório do teste).
  test.info().annotations.push({ type: 'fps', description: JSON.stringify(measured) });
  for (const [combo, fps] of Object.entries(measured)) {
    expect(fps, combo).toBeGreaterThan(25);
  }
  expect(['HIGH', 'MEDIUM', 'LOW']).toContain(await holo.getAttribute('data-quality'));
});
