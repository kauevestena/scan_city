import { expect, test, type Page } from '@playwright/test';

/**
 * REQ-NFR-007: contraste AA nos textos (4,5 : 1; 3 : 1 para texto grande). A varredura percorre o
 * DOM de cada tela, calcula a cor do texto e a do fundo efetivo (os fundos translúcidos se compõem
 * até um opaco; a base é o fundo da página) e lista o que fica abaixo do mínimo. Fora do escopo:
 * texto desenhado em canvas (as cores vêm dos mesmos tokens, conferidos em `tokens.test.ts`),
 * controles desabilitados e marcas (os emblemas, `role="img"`), isentos pela WCAG, e fundos com
 * imagem ou gradiente.
 */

interface Finding {
  element: string;
  ratio: number;
  min: number;
  fg: string;
  bg: string;
}

async function contrastFindings(page: Page, scope = 'body'): Promise<Finding[]> {
  return page.evaluate((scopeSelector) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
    type Rgba = [number, number, number, number];
    /** Qualquer cor CSS (inclusive oklch, que o Tailwind v4 usa) vira sRGB pelo canvas. */
    const toRgba = (css: string): Rgba => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = '#000';
      ctx.fillStyle = css;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
      return [r as number, g as number, b as number, (a as number) / 255];
    };
    const over = (top: Rgba, under: Rgba): Rgba => {
      const a = top[3] + under[3] * (1 - top[3]);
      if (a === 0) return [0, 0, 0, 0];
      const mix = (i: 0 | 1 | 2) => (top[i] * top[3] + under[i] * under[3] * (1 - top[3])) / a;
      return [mix(0), mix(1), mix(2), a];
    };
    const lum = ([r, g, b]: Rgba) => {
      const f = (c: number) => {
        const v = c / 255;
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const ratio = (a: Rgba, b: Rgba) => {
      const la = lum(a);
      const lb = lum(b);
      return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
    };
    const PAGE_BG = toRgba(getComputedStyle(document.body).backgroundColor || '#020617');
    const base: Rgba = PAGE_BG[3] === 0 ? [2, 6, 23, 1] : PAGE_BG;

    /** Fundo efetivo de `el`: os fundos dos ancestrais, compostos de cima para baixo. */
    const backgroundOf = (el: Element): { bg: Rgba; undetermined: boolean } => {
      const layers: Rgba[] = [];
      let undetermined = false;
      for (let node: Element | null = el; node; node = node.parentElement) {
        const cs = getComputedStyle(node);
        if (cs.backgroundImage !== 'none') undetermined = true;
        const c = toRgba(cs.backgroundColor);
        if (c[3] > 0) layers.push(c);
        if (c[3] >= 1) break;
      }
      let bg: Rgba = base;
      for (let i = layers.length - 1; i >= 0; i--) bg = over(layers[i] as Rgba, bg);
      return { bg, undetermined };
    };
    const label = (el: Element) => {
      const id = el.getAttribute('data-testid');
      const cls =
        typeof el.className === 'string' ? el.className.split(' ').slice(0, 2).join('.') : '';
      return `${el.tagName.toLowerCase()}${id ? `#${id}` : ''}${cls ? `.${cls}` : ''} "${(el.textContent ?? '').trim().slice(0, 28)}"`;
    };

    const root = document.querySelector(scopeSelector);
    const found: { element: string; ratio: number; min: number; fg: string; bg: string }[] = [];
    if (!root) return found;
    for (const el of Array.from(root.querySelectorAll('*'))) {
      // Os emblemas (`role="img"`: iniciais sobre a forma colorida) são marcas, isentas pela WCAG.
      if (el.closest('canvas, [aria-hidden="true"], svg, [role="img"]')) continue;
      const own = Array.from(el.childNodes).some(
        (n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim() !== '',
      );
      if (!own) continue;
      const cs = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      if (cs.display === 'none' || cs.visibility === 'hidden' || rect.width === 0) continue;
      if (Number(cs.opacity) < 1 && Number(cs.opacity) === 0) continue;
      const disabled = el.closest('[disabled], [aria-disabled="true"]');
      if (disabled) continue;
      const { bg, undetermined } = backgroundOf(el);
      if (undetermined) continue;
      const fgRaw = toRgba(cs.color);
      const fg = over(fgRaw, bg);
      const size = parseFloat(cs.fontSize);
      const bold = Number(cs.fontWeight) >= 700;
      const large = size >= 24 || (size >= 18.66 && bold);
      const min = large ? 3 : 4.5;
      const r = ratio(fg, bg);
      if (r < min) {
        found.push({
          element: label(el),
          ratio: Math.round(r * 100) / 100,
          min,
          fg: `rgb(${Math.round(fg[0])},${Math.round(fg[1])},${Math.round(fg[2])})`,
          bg: `rgb(${Math.round(bg[0])},${Math.round(bg[1])},${Math.round(bg[2])})`,
        });
      }
    }
    return found;
  }, scope);
}

const BASE = '/?debug=1&skipIntro=1&unlockAll=1';

test.describe('contraste AA dos textos do DOM', () => {
  const SCREENS: ReadonlyArray<{ name: string; query: string; testId: string }> = [
    { name: 'escritório', query: '', testId: 'office-screen' },
    { name: 'mapa-múndi', query: '&screen=WORLD_MAP', testId: 'world-map-screen' },
    { name: 'planejamento de campo', query: '&screen=FIELD_SETUP', testId: 'field-setup-screen' },
    { name: 'voo', query: '&screen=SURVEY_FLIGHT', testId: 'survey-flight-screen' },
    { name: 'mesa holográfica', query: '&screen=HOLO_TABLE_VIEW', testId: 'holo-screen' },
    { name: 'laboratório', query: '&screen=INFOGRAPHIC_LAB', testId: 'lab-screen' },
  ];
  for (const s of SCREENS) {
    test(s.name, async ({ page }) => {
      await page.goto(BASE + s.query);
      await expect(page.getByTestId(s.testId)).toBeVisible();
      await page.waitForTimeout(500);
      expect(await contrastFindings(page)).toEqual([]);
    });
  }

  test('menu de pausa, configurações e controles', async ({ page }) => {
    await page.goto(BASE);
    await expect(page.getByTestId('office-screen')).toBeVisible();
    await page.keyboard.press('m');
    const pause = page.getByRole('dialog', { name: 'Jogo pausado' });
    await expect(pause).toBeVisible();
    expect(await contrastFindings(page, '[role="dialog"]')).toEqual([]);
    await pause
      .getByRole('button', { name: 'Configurações' })
      .evaluate((el) => (el as HTMLElement).click());
    expect(await contrastFindings(page, '[role="dialog"]')).toEqual([]);
    await page.keyboard.press('Escape');
    await pause
      .getByRole('button', { name: 'Controles' })
      .evaluate((el) => (el as HTMLElement).click());
    expect(await contrastFindings(page, '[role="dialog"]')).toEqual([]);
  });

  test('painéis do escritório', async ({ page }) => {
    for (const [hotspot, panelId] of [
      ['CAREER', 'career-panel'],
      ['GARAGE', 'garage-panel'],
      ['PERCH', 'perch-panel'],
      ['SHELF', 'shelf-panel'],
      ['STAFF', 'staff-panel'],
      ['WORKSTATION', 'workstation-panel'],
    ] as const) {
      await page.goto(BASE);
      await expect(page.getByTestId('office-screen')).toBeVisible();
      await page
        .locator(`[data-hotspot="${hotspot}"]`)
        .evaluate((el) => (el as HTMLElement).click());
      await expect(page.getByTestId(panelId)).toBeVisible();
      expect(await contrastFindings(page, `[data-testid="${panelId}"]`), panelId).toEqual([]);
    }
  });
});

/** Varre cada aba do `scope` (clicando por código: aqui só importa o que a aba mostra). */
async function scanEachTab(page: Page, scope: string, label: string): Promise<void> {
  // Só a primeira lista de abas da tela: as de dentro (ferramentas, equipamentos) são sub-seleções.
  const tabs = page.locator(scope).locator('[role="tablist"]').first().locator('[role="tab"]');
  const count = await tabs.count();
  expect(count, `${label}: abas`).toBeGreaterThan(1);
  for (let i = 0; i < count; i++) {
    await tabs.nth(i).evaluate((el) => (el as HTMLElement).click());
    await page.waitForTimeout(250);
    expect(await contrastFindings(page, scope), `${label}, aba ${i + 1}`).toEqual([]);
  }
}

test.describe('contraste AA: telas com várias abas e estados', () => {
  test('planejamento de campo e laboratório, aba por aba', async ({ page }) => {
    await page.goto(`${BASE}&screen=FIELD_SETUP`);
    await expect(page.getByTestId('field-setup-screen')).toBeVisible();
    await scanEachTab(page, '[data-testid="field-setup-screen"]', 'campo');
    await page.goto(`${BASE}&screen=INFOGRAPHIC_LAB`);
    await expect(page.getByTestId('lab-screen')).toBeVisible();
    await scanEachTab(page, '[data-testid="lab-screen"]', 'laboratório');
  });

  test('garagem, carreira e relíquias, aba por aba', async ({ page }) => {
    for (const [hotspot, panelId] of [
      ['GARAGE', 'garage-panel'],
      ['CAREER', 'career-panel'],
      ['SHELF', 'shelf-panel'],
    ] as const) {
      await page.goto(BASE);
      await expect(page.getByTestId('office-screen')).toBeVisible();
      await page
        .locator(`[data-hotspot="${hotspot}"]`)
        .evaluate((el) => (el as HTMLElement).click());
      await expect(page.getByTestId(panelId)).toBeVisible();
      if ((await page.locator(`[data-testid="${panelId}"] [role="tablist"]`).count()) > 0) {
        await scanEachTab(page, `[data-testid="${panelId}"]`, panelId);
      } else {
        expect(await contrastFindings(page, `[data-testid="${panelId}"]`), panelId).toEqual([]);
      }
    }
  });

  test('exame de souvenir: título, origem, história, contador e botões sobre a mesa', async ({
    page,
  }) => {
    await page.goto(`${BASE}&souvenirs=1`);
    await expect(page.getByTestId('office-screen')).toBeVisible();
    await page.locator('[data-hotspot="SHELF"]').evaluate((el) => (el as HTMLElement).click());
    await page.getByTestId('shelf-examine').evaluate((el) => (el as HTMLElement).click());
    await expect(page.getByTestId('souvenir-viewer')).toBeVisible();
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(700);
    expect(await contrastFindings(page, '[data-testid="souvenir-viewer"]')).toEqual([]);
  });

  test('mesa holográfica: painel de alas com setores mapeados e em névoa', async ({ page }) => {
    await page.goto(`${BASE}&screen=HOLO_TABLE_VIEW`);
    await expect(page.getByTestId('holo-screen')).toBeVisible();
    await page.keyboard.press('F9');
    await page.getByTestId('debug-map-all').evaluate((el) => (el as HTMLElement).click());
    await page.keyboard.press('F9');
    await page.keyboard.press('w');
    await expect(page.getByTestId('wings-panel')).toBeVisible();
    expect(await contrastFindings(page, '[data-testid="wings-panel"]')).toEqual([]);
    expect(await contrastFindings(page, '[data-testid="sector-card"]')).toEqual([]);
  });

  test('briefing e dica do tutorial no mapa', async ({ page }) => {
    await page.goto('/?debug=1&skipIntro=1&seed=4');
    await expect(page.getByTestId('office-screen')).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('world-map-screen')).toBeVisible();
    await expect(page.getByTestId('tutorial-hint')).toBeVisible();
    expect(await contrastFindings(page, '[data-testid="tutorial-hint"]')).toEqual([]);
    await page.keyboard.press('F9');
    await page.locator('[data-teleport="C00"]').evaluate((el) => (el as HTMLElement).click());
    await page.keyboard.press('F9');
    await page.keyboard.press('Enter');
    const briefing = page.getByRole('dialog', { name: 'Sítio do Avô' });
    await expect(briefing).toBeVisible();
    expect(await contrastFindings(page, '[role="dialog"]')).toEqual([]);
  });

  test('processamento: esteira em andamento e o relatório aba por aba', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(`${BASE}&autopilot=1`);
    await expect(page.getByTestId('office-screen')).toBeVisible();
    await page.keyboard.press('F9');
    await page
      .getByRole('button', { name: 'Gerar missão pendente' })
      .evaluate((el) => (el as HTMLElement).click());
    await page.keyboard.press('F9');
    await page
      .locator('[data-hotspot="WORKSTATION"]')
      .evaluate((el) => (el as HTMLElement).click());
    await page
      .getByTestId('workstation-panel')
      .getByRole('button', { name: 'Processar' })
      .evaluate((el) => (el as HTMLElement).click());
    await expect(page.getByTestId('pipeline')).toBeVisible();
    expect(await contrastFindings(page, '[data-testid="processing-screen"]')).toEqual([]);
    await expect(page.getByTestId('report')).toBeVisible({ timeout: 60_000 });
    await scanEachTab(page, '[data-testid="processing-screen"]', 'relatório');
  });
});
