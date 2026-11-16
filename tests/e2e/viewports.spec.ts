import { expect, test, type Page } from '@playwright/test';

/**
 * REQ-NFR-004: a interface funciona de 1280 × 720 a 1920 × 1080, sem rolagem horizontal, e os
 * canvases ocupam o espaço disponível e respeitam o DPR. A raiz do app é `overflow: hidden`, então
 * `scrollWidth` da página não acusaria nada: aqui se confere elemento por elemento, no navegador.
 */

const VIEWPORTS = [
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
] as const;

const BASE = '/?debug=1&skipIntro=1&unlockAll=1';

interface Screen {
  name: string;
  query: string;
  testId: string;
}

const SCREENS: readonly Screen[] = [
  { name: 'escritório', query: '', testId: 'office-screen' },
  { name: 'mapa-múndi', query: '&screen=WORLD_MAP', testId: 'world-map-screen' },
  { name: 'planejamento de campo', query: '&screen=FIELD_SETUP', testId: 'field-setup-screen' },
  {
    name: 'voo',
    query: '&screen=SURVEY_FLIGHT&autopilot=1&contract=C01',
    testId: 'survey-flight-screen',
  },
  { name: 'processamento', query: '&screen=PROCESSING_RESULTS', testId: 'processing-screen' },
  { name: 'mesa holográfica', query: '&screen=HOLO_TABLE_VIEW', testId: 'holo-screen' },
  { name: 'laboratório', query: '&screen=INFOGRAPHIC_LAB', testId: 'lab-screen' },
];

/** Elementos visíveis que passam da janela ou cortam o próprio conteúdo na horizontal. */
async function overflowing(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const vw = window.innerWidth;
    const found: string[] = [];
    const label = (el: Element) => {
      const id = el.getAttribute('data-testid');
      const cls = typeof el.className === 'string' ? el.className.split(' ')[0] : '';
      return `${el.tagName.toLowerCase()}${id ? `[${id}]` : ''}${cls ? `.${cls}` : ''}`;
    };
    for (const el of Array.from(document.querySelectorAll('#root *'))) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.right > vw + 1 || r.left < -1) {
        found.push(
          `${label(el)} vai de ${Math.round(r.left)} a ${Math.round(r.right)} (janela ${vw})`,
        );
      }
      const clipsX = cs.overflowX === 'hidden' || cs.overflowX === 'clip';
      if (
        clipsX &&
        cs.textOverflow !== 'ellipsis' &&
        !(el instanceof HTMLCanvasElement) &&
        el.scrollWidth > el.clientWidth + 1
      ) {
        found.push(`${label(el)} corta ${el.scrollWidth - el.clientWidth} px de conteúdo`);
      }
    }
    return found;
  });
}

/** Canvases visíveis (menos os de arte de pixel) cujo buffer não é `tamanho CSS × DPR`. */
async function dprMismatches(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const dpr = window.devicePixelRatio;
    const found: string[] = [];
    for (const c of Array.from(document.querySelectorAll('canvas'))) {
      const r = c.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      // Arte de pixel de 1 px por tile (o minimapa, 160 × 100): o navegador amplia sem suavizar
      // (`image-rendering: pixelated`), então um buffer maior não mudaria nada na tela.
      if (getComputedStyle(c).imageRendering === 'pixelated') continue;
      const w = Math.round(c.clientWidth * dpr);
      const h = Math.round(c.clientHeight * dpr);
      if (Math.abs(c.width - w) > 1 || Math.abs(c.height - h) > 1) {
        const id = c.getAttribute('data-testid') ?? c.className;
        found.push(`${id}: buffer ${c.width}×${c.height}, esperado ${w}×${h} (DPR ${dpr})`);
      }
    }
    return found;
  });
}

async function open(page: Page, screen: Screen): Promise<void> {
  await page.goto(BASE + screen.query);
  await expect(page.getByTestId(screen.testId)).toBeVisible();
  // Deixa o fade de entrada (200 ms) e o primeiro quadro assentarem.
  await page.waitForTimeout(450);
}

for (const vp of VIEWPORTS) {
  test.describe(`${vp.width} × ${vp.height}`, () => {
    test.use({ viewport: vp });

    for (const screen of SCREENS) {
      test(`${screen.name}: sem rolagem nem corte na horizontal`, async ({ page }) => {
        await open(page, screen);
        expect(await overflowing(page)).toEqual([]);
        // Barra superior e HUD ficam na janela: o canvas da tela cobre a largura dela.
        const root = await page.evaluate(() => {
          const r = document.getElementById('root')?.firstElementChild?.getBoundingClientRect();
          return r ? { w: Math.round(r.width), h: Math.round(r.height) } : null;
        });
        expect(root).toEqual({ w: vp.width, h: vp.height });
      });
    }

    test('mesa com o painel de alas aberto e laboratório nas quatro abas', async ({ page }) => {
      await open(page, SCREENS.find((s) => s.testId === 'holo-screen') as Screen);
      await page.keyboard.press('w');
      await expect(page.getByTestId('wings-panel')).toBeVisible();
      await page.waitForTimeout(250);
      expect(await overflowing(page)).toEqual([]);

      await open(page, SCREENS.find((s) => s.testId === 'lab-screen') as Screen);
      const tabs = page.getByRole('tab');
      const count = await tabs.count();
      expect(count).toBe(4);
      for (let i = 0; i < count; i++) {
        await tabs.nth(i).click();
        await page.waitForTimeout(250);
        expect(await overflowing(page), `aba ${i + 1} do laboratório`).toEqual([]);
      }
    });

    test('menu de pausa, configurações e controles cabem na janela', async ({ page }) => {
      await open(page, SCREENS[0] as Screen);
      await page.keyboard.press('m');
      await expect(page.getByTestId('pause-menu')).toBeVisible();
      expect(await overflowing(page), 'menu').toEqual([]);
      await page.getByRole('button', { name: 'Configurações' }).click();
      await expect(page.getByTestId('settings-panel')).toBeVisible();
      expect(await overflowing(page), 'configurações').toEqual([]);
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Controles' }).click();
      await expect(page.getByTestId('controls-panel')).toBeVisible();
      expect(await overflowing(page), 'controles').toEqual([]);
    });
  });
}

test.describe('DPR 2: o buffer dos canvases é o tamanho CSS vezes o DPR', () => {
  test.use({ viewport: VIEWPORTS[0], deviceScaleFactor: 2 });

  for (const testId of [
    'world-map-screen',
    'field-setup-screen',
    'survey-flight-screen',
    'holo-screen',
    'lab-screen',
  ]) {
    test(testId, async ({ page }) => {
      const screen = SCREENS.find((s) => s.testId === testId) as Screen;
      await open(page, screen);
      expect(await page.evaluate(() => window.devicePixelRatio)).toBe(2);
      expect(await dprMismatches(page)).toEqual([]);
    });
  }
});
