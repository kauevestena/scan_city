import { expect, test, type Locator, type Page } from '@playwright/test';
import { activate, reach } from './keyboard';

/**
 * Auditoria de foco (REQ-NFR-007, REQ-INP-006): em cada tela, painel e modal, todo controle visível
 * tem nome acessível, é alcançável pelo teclado e mostra o anel de foco quando o foco chega por
 * teclado; modais prendem o foco, fecham com Esc e devolvem o foco a quem os abriu. A lista de
 * superfícies é a checklist de auditoria anexada à T078 em `specs/tasks.md`.
 */

const INTERACTIVE =
  'button, [role=tab], [role=switch], [role=slider], [role=checkbox], [role=radio], input, select, textarea, a[href], [data-focusable]';

interface Finding {
  element: string;
  problem: string;
}

/** Procura, nos controles visíveis de `scope`, os que falham nas três regras da auditoria. */
async function audit(page: Page, scope = 'body'): Promise<Finding[]> {
  // O `:focus-visible` só vale depois de um input de teclado.
  await page.keyboard.press('Shift');
  return page.evaluate(
    ({ scope, selector }) => {
      const root = document.querySelector(scope);
      if (!root) return [{ element: scope, problem: 'o escopo não existe na tela' }];
      const findings: { element: string; problem: string }[] = [];
      const nameOf = (el: Element): string => {
        const aria = el.getAttribute('aria-label');
        if (aria) return aria.trim();
        const by = el.getAttribute('aria-labelledby');
        if (by) {
          const text = by
            .split(/\s+/)
            .map((id) => document.getElementById(id)?.textContent ?? '')
            .join(' ')
            .trim();
          if (text) return text;
        }
        if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement) {
          const labelled = el.labels?.[0]?.textContent?.trim();
          if (labelled) return labelled;
        }
        return (el.textContent ?? el.getAttribute('title') ?? '').trim();
      };
      const describe = (el: Element) => {
        const tag = el.tagName.toLowerCase();
        const role = el.getAttribute('role');
        const id = el.getAttribute('data-testid');
        return `${tag}${role ? `[${role}]` : ''}${id ? `#${id}` : ''} "${nameOf(el).slice(0, 32)}"`;
      };
      const seenTablists = new Set<Element>();
      // A auditoria foca cada controle por código; o foco de quem estava usando volta no fim.
      const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      for (const el of Array.from(root.querySelectorAll<HTMLElement>(selector))) {
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        if (cs.display === 'none' || cs.visibility === 'hidden' || r.width === 0) continue;
        if ((el as HTMLButtonElement).disabled || el.getAttribute('aria-disabled') === 'true') {
          continue;
        }
        if (nameOf(el) === '')
          findings.push({ element: describe(el), problem: 'sem nome acessível' });
        // Alcançável: tabbable, ou membro de um grupo (abas) que tem um membro tabbable.
        let reachable = el.tabIndex >= 0;
        if (!reachable) {
          const group = el.closest('[role=tablist], [role=radiogroup]');
          if (group && !seenTablists.has(group)) {
            seenTablists.add(group);
          }
          reachable = group !== null && group.querySelector('[tabindex="0"]') !== null;
        }
        if (!reachable)
          findings.push({ element: describe(el), problem: 'não é alcançável por Tab' });
        // Anel de foco: foca por código, com o teclado como última entrada.
        el.focus({ preventScroll: true });
        if (document.activeElement === el) {
          const f = getComputedStyle(el);
          const outline = f.outlineStyle !== 'none' && parseFloat(f.outlineWidth) > 0;
          const ring = f.boxShadow !== 'none' && f.boxShadow !== '';
          if (!outline && !ring)
            findings.push({ element: describe(el), problem: 'sem anel de foco' });
          el.blur();
        }
      }
      before?.focus({ preventScroll: true });
      return findings;
    },
    { scope, selector: INTERACTIVE },
  );
}

const BASE = '/?debug=1&skipIntro=1&unlockAll=1';

test.describe('telas', () => {
  const SCREENS: ReadonlyArray<{ name: string; query: string; testId: string }> = [
    { name: 'escritório', query: '', testId: 'office-screen' },
    { name: 'mapa-múndi', query: '&screen=WORLD_MAP', testId: 'world-map-screen' },
    { name: 'planejamento de campo', query: '&screen=FIELD_SETUP', testId: 'field-setup-screen' },
    { name: 'voo', query: '&screen=SURVEY_FLIGHT&autopilot=1', testId: 'survey-flight-screen' },
    { name: 'processamento', query: '&screen=PROCESSING_RESULTS', testId: 'processing-screen' },
    { name: 'mesa holográfica', query: '&screen=HOLO_TABLE_VIEW', testId: 'holo-screen' },
    { name: 'laboratório', query: '&screen=INFOGRAPHIC_LAB', testId: 'lab-screen' },
  ];
  for (const s of SCREENS) {
    test(s.name, async ({ page }) => {
      await page.goto(BASE + s.query);
      await expect(page.getByTestId(s.testId)).toBeVisible();
      await page.waitForTimeout(400);
      expect(await audit(page)).toEqual([]);
    });
  }
});

/** O foco está dentro de `scope`? */
const focusInside = (scope: Locator) => scope.evaluate((el) => el.contains(document.activeElement));

/** Pressiona Tab `steps` vezes e devolve os elementos que ganharam foco, em ordem. */
async function tabTour(page: Page, steps: number, key = 'Tab'): Promise<string[]> {
  const seen: string[] = [];
  for (let i = 0; i < steps; i++) {
    await page.keyboard.press(key);
    seen.push(
      await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return '(corpo)';
        return `${el.tagName.toLowerCase()}:${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 30)}`;
      }),
    );
  }
  return seen;
}

test('a própria auditoria acusa o que deve: sem nome, fora do Tab e sem anel de foco', async ({
  page,
}) => {
  await page.setContent(`
    <main id="m">
      <button id="ok" style="outline: 2px solid blue">Bom</button>
      <button id="semNome" style="outline: 2px solid blue"></button>
      <button id="foraDoTab" tabindex="-1" style="outline: 2px solid blue">Fora</button>
      <button id="semAnel" style="outline: none; box-shadow: none">Sem anel</button>
    </main>`);
  const problems = (await audit(page, '#m')).map((f) => f.problem).sort();
  expect(problems).toEqual(['não é alcançável por Tab', 'sem anel de foco', 'sem nome acessível']);
});

test.describe('escritório: cada painel recebe o foco, passa na auditoria e devolve o foco ao fechar', () => {
  const PANELS = [
    ['CAREER', 'career-panel'],
    ['GARAGE', 'garage-panel'],
    ['PERCH', 'perch-panel'],
    ['SHELF', 'shelf-panel'],
    ['STAFF', 'staff-panel'],
    ['WORKSTATION', 'workstation-panel'],
  ] as const;
  for (const [hotspot, panelId] of PANELS) {
    test(`${hotspot} → ${panelId}`, async ({ page }) => {
      await page.goto(BASE);
      const spot = page.locator(`[data-hotspot="${hotspot}"]`);
      await reach(page, spot);
      await page.keyboard.press('Enter');
      const panel = page.getByTestId(panelId);
      await expect(panel).toBeVisible();
      // O foco entra no painel ao abrir (o Enter seguinte já age dentro dele).
      await expect.poll(() => focusInside(panel)).toBe(true);
      expect(await audit(page, `[data-testid="${panelId}"]`)).toEqual([]);
      // O Tab percorre o painel; para onde vai o foco (dentro ou fora) fica no relatório do teste.
      const tour = await tabTour(page, 12);
      test.info().annotations.push({ type: 'tab', description: tour.join(' | ') });
      await page.keyboard.press('Escape');
      await expect(panel).toBeHidden();
      await expect(spot).toBeFocused();
    });
  }
});

/** Pressiona Tab `steps` vezes e diz, para cada passo, se o foco continuou dentro de `scope`. */
async function trapped(page: Page, scope: Locator, steps = 14): Promise<boolean[]> {
  const out: boolean[] = [];
  for (let i = 0; i < steps; i++) {
    await page.keyboard.press(i % 5 === 4 ? 'Shift+Tab' : 'Tab');
    out.push(await focusInside(scope));
  }
  return out;
}

/**
 * Um modal de verdade (REQ-INP-006): o foco entra nele ao abrir, não escapa com Tab nem com
 * Shift+Tab, os controles passam na auditoria e, se for dispensável, o Esc o fecha e devolve o
 * foco a quem o abriu (`opener`).
 */
async function auditModal(
  page: Page,
  dialog: Locator,
  options: { dismissable?: boolean; opener?: Locator } = {},
): Promise<void> {
  const { dismissable = true, opener } = options;
  await expect(dialog).toBeVisible();
  await expect.poll(() => focusInside(dialog)).toBe(true);
  expect(await audit(page, '[role="dialog"]')).toEqual([]);
  expect(await trapped(page, dialog)).toEqual(Array.from({ length: 14 }, () => true));
  if (!dismissable) return;
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  if (opener) await expect(opener).toBeFocused();
}

test.describe('modais e menus', () => {
  test('menu de pausa → configurações → controles → novo jogo (confirmação)', async ({ page }) => {
    await page.goto(BASE);
    await expect(page.getByTestId('office-screen')).toBeVisible();
    await page.keyboard.press('m');
    const pause = page.getByRole('dialog', { name: 'Jogo pausado' });
    await expect(pause).toBeVisible();
    await expect.poll(() => focusInside(pause)).toBe(true);
    expect(await audit(page, '[data-testid="pause-menu"]')).toEqual([]);
    expect(await trapped(page, pause)).toEqual(Array.from({ length: 14 }, () => true));

    // Configurações: sliders, interruptores e qualidade, todos com nome, Tab e anel de foco.
    await activate(page, pause.getByRole('button', { name: 'Configurações' }));
    await expect(page.getByTestId('settings-panel')).toBeVisible();
    expect(await audit(page, '[data-testid="settings-panel"]')).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('pause-menu')).toBeVisible();

    // Controles: só leitura, com o botão de voltar.
    await activate(page, pause.getByRole('button', { name: 'Controles' }));
    await expect(page.getByTestId('controls-panel')).toBeVisible();
    expect(await audit(page, '[role="dialog"]')).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('pause-menu')).toBeVisible();

    // Novo jogo: a confirmação prende o foco e o Esc volta ao botão que a abriu.
    const newGame = pause.getByTestId('pause-new-game');
    await activate(page, newGame);
    const confirm = page.getByRole('dialog', { name: 'Novo jogo' });
    await auditModal(page, confirm, { opener: newGame });
    await page.keyboard.press('Escape');
    await expect(pause).toBeHidden();
  });

  test('exame de souvenir: o foco entra em Próxima, não escapa e o Esc volta ao Examinar', async ({
    page,
  }) => {
    await page.goto(`${BASE}&souvenirs=1`);
    await expect(page.getByTestId('office-screen')).toBeVisible();
    const shelf = page.locator('[data-hotspot="SHELF"]');
    await reach(page, shelf);
    await page.keyboard.press('Enter');
    const examine = page.getByTestId('shelf-examine');
    await reach(page, examine);
    await page.keyboard.press('Enter');
    const viewer = page.getByRole('dialog', { name: 'Caderneta de Campo do Avô' });
    await auditModal(page, viewer, { opener: examine });
  });

  test('intro do jogo novo: cartão não dispensável, foco preso e Enter avança', async ({
    page,
  }) => {
    await page.goto('/');
    const intro = page.getByRole('dialog', { name: 'Uma carta na mesa' });
    await auditModal(page, intro, { dismissable: false });
  });

  test('briefing do contrato: foco entra no diálogo, Tab percorre e Esc recusa', async ({
    page,
  }) => {
    await page.goto(`${BASE}&screen=WORLD_MAP&seed=4`);
    await expect(page.getByTestId('world-map-screen')).toBeVisible();
    // Preparação (não é o caminho do jogador): o atalho de depuração leva o avatar ao marcador.
    await page.keyboard.press('F9');
    await page.locator('[data-teleport="C00"]').evaluate((el) => (el as HTMLElement).click());
    await page.keyboard.press('F9');
    await expect(page.getByTestId('world-prompt')).toContainText('Sítio do Avô');
    await page.keyboard.press('Enter');
    await auditModal(page, page.getByRole('dialog', { name: 'Sítio do Avô' }));
  });

  test('planejamento de campo: Esc abre a confirmação de abandono, que prende o foco', async ({
    page,
  }) => {
    await page.goto(`${BASE}&screen=FIELD_SETUP`);
    await expect(page.getByTestId('field-setup-screen')).toBeVisible();
    await page.keyboard.press('Escape');
    await auditModal(page, page.getByRole('dialog', { name: 'Abandonar o planejamento?' }));
  });

  test('voo: o menu de pausa abandona a missão com uma confirmação que prende o foco', async ({
    page,
  }) => {
    await page.goto(`${BASE}&screen=SURVEY_FLIGHT`);
    await expect(page.getByTestId('survey-flight-screen')).toBeVisible();
    await page.keyboard.press('m');
    const pause = page.getByRole('dialog', { name: 'Jogo pausado' });
    await expect(pause).toBeVisible();
    const abandon = pause.getByRole('button', { name: 'Abandonar missão' });
    await activate(page, abandon);
    await auditModal(page, page.getByRole('dialog', { name: 'Abandonar a missão?' }), {
      opener: abandon,
    });
  });
});

test('final da campanha: a carta do avô é um modal não dispensável com o foco preso', async ({
  browser,
}) => {
  const REAL = ['C00', 'C01', 'C02', 'C03', 'C04', 'C05', 'C06'];
  const first = await browser.newContext();
  const base = await first.newPage();
  await base.goto('/?debug=1&skipIntro=1');
  await expect(base.getByTestId('office-screen')).toBeVisible();
  await base.goto('/');
  await expect(base.getByTestId('office-screen')).toBeVisible();
  const raw = await base.evaluate(() => localStorage.getItem('scan-city-save'));
  await first.close();
  const save = JSON.parse(raw as string) as {
    contracts: Record<string, unknown>;
    flags: { introSeen: boolean; finaleSeen: boolean };
  };
  for (const id of REAL)
    save.contracts[id] = { status: 'COMPLETED', completions: 1, bestScore: 0.9 };
  save.flags.introSeen = true;
  save.flags.finaleSeen = false;
  const context = await browser.newContext();
  await context.addInitScript(
    ([key, value]) => {
      if (!localStorage.getItem(key as string))
        localStorage.setItem(key as string, value as string);
    },
    ['scan-city-save', JSON.stringify(save)],
  );
  const page = await context.newPage();
  await page.goto('/');
  await auditModal(page, page.getByRole('dialog', { name: 'Museu da Terra' }), {
    dismissable: false,
  });
  await context.close();
});

test.describe('abas e painéis com mais de um estado', () => {
  test('planejamento de campo: as quatro abas (Q/E trocam) passam na auditoria', async ({
    page,
  }) => {
    await page.goto(`${BASE}&screen=FIELD_SETUP`);
    await expect(page.getByTestId('field-setup-screen')).toBeVisible();
    const tabs = page.getByRole('tab');
    for (const name of [
      '1 · Pontos de apoio',
      '2 · Plano de voo',
      '3 · Calibração',
      '4 · Checklist',
    ]) {
      await expect(page.getByRole('tab', { name })).toHaveAttribute('aria-selected', 'true');
      expect(await audit(page, '[data-testid="field-setup-screen"]'), name).toEqual([]);
      await page.keyboard.press('e');
    }
    // A volta completa fecha o ciclo na primeira aba.
    await expect(tabs.first()).toHaveAttribute('aria-selected', 'true');
  });

  test('laboratório: as quatro abas (Q/E trocam) passam na auditoria, sliders incluídos', async ({
    page,
  }) => {
    await page.goto(`${BASE}&screen=INFOGRAPHIC_LAB`);
    await expect(page.getByTestId('lab-screen')).toBeVisible();
    for (let i = 0; i < 4; i++) {
      await expect(page.getByRole('tab').nth(i)).toHaveAttribute('aria-selected', 'true');
      expect(await audit(page, '[data-testid="lab-screen"]'), `aba ${i + 1}`).toEqual([]);
      await page.keyboard.press('e');
    }
  });

  test('mesa holográfica: o painel de alas recebe o foco e passa na auditoria', async ({
    page,
  }) => {
    // Preparação (não é o caminho do jogador): o atalho de depuração mapeia os 18 setores.
    await page.goto(`${BASE}&screen=HOLO_TABLE_VIEW`);
    await expect(page.getByTestId('holo-screen')).toBeVisible();
    await page.keyboard.press('F9');
    await page.getByTestId('debug-map-all').evaluate((el) => (el as HTMLElement).click());
    await page.keyboard.press('F9');
    await page.keyboard.press('w');
    const panel = page.getByTestId('wings-panel');
    await expect(panel).toBeVisible();
    await expect.poll(() => focusInside(panel)).toBe(true);
    expect(await audit(page, '[data-testid="wings-panel"]')).toEqual([]);
    await page.keyboard.press('w');
    await expect(panel).toBeHidden();
  });

  test('relatório de processamento: as cinco abas e o visualizador de produtos passam na auditoria', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.goto(`${BASE}&autopilot=1`);
    await expect(page.getByTestId('office-screen')).toBeVisible();
    // Preparação: uma missão pendente pelo painel de depuração; o resto é o teclado.
    await page.keyboard.press('F9');
    await page
      .getByRole('button', { name: 'Gerar missão pendente' })
      .evaluate((el) => (el as HTMLElement).click());
    await page.keyboard.press('F9');
    await activate(page, page.getByRole('button', { name: 'Workstation' }));
    await activate(
      page,
      page.getByTestId('workstation-panel').getByRole('button', { name: 'Processar' }),
    );
    await expect(page.getByTestId('report')).toBeVisible({ timeout: 60_000 });
    const tabs = page.getByRole('tab');
    const count = await tabs.count();
    expect(count).toBe(5);
    for (let i = 0; i < count; i++) {
      await expect(tabs.nth(i)).toHaveAttribute('aria-selected', 'true');
      expect(await audit(page, '[data-testid="processing-screen"]'), `aba ${i + 1}`).toEqual([]);
      await page.keyboard.press('e');
    }
  });
});
