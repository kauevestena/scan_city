// QA: entradas aleatórias ("macaco") e medição de memória ("soak") contra o build de produção.
//
//   npm run build && npm run preview                       # em outro terminal (porta 4173)
//   npm run qa:random -- --screen=SURVEY_FLIGHT --contract=C03 --seconds=90 --seed=7
//   npm run qa:random -- --soak --seconds=480              # mede a memória a cada 30 s
//
// Aperta teclas, clica em botões, arrasta e gira a roda nos canvases e mexe no controle emulado,
// por N segundos, e acusa: erro de console, exceção não tratada, raiz do React vazia (a tela
// "branca"), página travada ou caída. Com `--soak` amostra, depois de forçar o coletor de lixo,
// o heap do JS, os nós do DOM, os *listeners*, o ritmo dos laços de animação, os contextos de
// áudio e a memória do navegador inteiro (RSS, só no Linux). Sai com código 1 se achar algo.
//
// Opções: --url=http://localhost:4173 --seed=1 --seconds=60 --screen=<ScreenId> --contract=<id>
//         --dpr=1 --resize --soak --sample=30 --out=test-results
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .filter((a) => a.startsWith('--'))
    .map((a) => {
      const [k, v] = a.slice(2).split('=');
      return [k, v ?? 'true'];
    }),
);
const BASE_URL = args.url ?? 'http://localhost:4173';
const SEED = Number(args.seed ?? 1);
const DURATION_MS = Number(args.seconds ?? 60) * 1000;
const DPR = Number(args.dpr ?? 1);
const SOAK = args.soak === 'true';
const RESIZE = args.resize === 'true';
const SAMPLE_MS = Number(args.sample ?? 30) * 1000;
const OUT = args.out ?? 'test-results';
const LABEL = [args.screen ?? 'OFFICE', args.contract, `seed${SEED}`].filter(Boolean).join('-');

const query = new URLSearchParams({
  debug: '1',
  skipIntro: '1',
  unlockAll: '1',
  money: '900000',
  seed: String(SEED),
});
if (args.screen) query.set('screen', args.screen);
if (args.contract) query.set('contract', args.contract);
const START = `/?${query.toString()}`;

/** PRNG seedado (mulberry32): a mesma seed repete a mesma sequência de ações. */
function mulberry32(seed) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(SEED * 7919 + 13);
const pick = (list) => list[Math.floor(rnd() * list.length)];
const between = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
const weighted = (table) => {
  let r = rnd() * table.reduce((sum, [, w]) => sum + w, 0);
  for (const [value, w] of table) {
    r -= w;
    if (r <= 0) return value;
  }
  return table[0][0];
};

const KEYS = [
  ...['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd', 'Space', 'Enter'],
  ...['Escape', 'Tab', 'Shift+Tab', 'q', 'e', 'r', 't', 'v', 'm', 'h', '1', '2', '3', '+', '-'],
  ...['Backspace', 'x', 'z'],
];
const HOLD_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd', 'q', 'e'];
const PAD_BUTTONS = [0, 1, 2, 3, 4, 5, 8, 9, 12, 13, 14, 15];
const SIZES = [
  [1280, 720],
  [1366, 768],
  [1536, 864],
  [1920, 1080],
  [1100, 650],
  [2560, 1440],
  [1024, 600],
];

/** Controle `standard` do Xbox emulado: o app o lê a cada quadro (`navigator.getGamepads`). */
function installFakePad() {
  const pad = {
    id: 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)',
    index: 0,
    connected: true,
    mapping: 'standard',
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
    timestamp: 0,
  };
  window.__pad = pad;
  navigator.getGamepads = () => [pad];
}

/** Conta os callbacks de `requestAnimationFrame` e os `AudioContext` criados (para o `--soak`). */
function installCounters() {
  window.__raf = 0;
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) =>
    raf((t) => {
      window.__raf++;
      cb(t);
    });
  window.__ctx = 0;
  for (const name of ['AudioContext', 'webkitAudioContext']) {
    const Original = window[name];
    if (!Original) continue;
    window[name] = class extends Original {
      constructor(...a) {
        super(...a);
        window.__ctx++;
      }
    };
  }
}

const withTimeout = (promise, ms, what) =>
  Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`TIMEOUT ${what}`)), ms)),
  ]);

/** O que está na tela agora: raiz viva, tela atual, o que dá para clicar e os canvases. */
function readPage() {
  const root = document.getElementById('root');
  const screen = document.querySelector('[data-testid$="-screen"]');
  const w = window.innerWidth;
  const h = window.innerHeight;
  const selector =
    'button:not([disabled]), [role="tab"], [role="slider"], [role="checkbox"], [role="switch"], [data-hotspot], a[href], input, select';
  const clickables = [];
  for (const el of document.querySelectorAll(selector)) {
    // O painel de depuração tem transições que o jogo nunca faz: fora do alvo.
    if (el.closest('[data-testid="debug-overlay"], [data-testid="fps-overlay"]')) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) continue;
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    if (x < 0 || y < 0 || x > w || y > h) continue;
    const top = document.elementFromPoint(x, y);
    if (!top || !(el === top || el.contains(top))) continue;
    const text = el.getAttribute('aria-label') || el.textContent || el.tagName;
    clickables.push({ x, y, label: text.trim().slice(0, 40) });
  }
  const canvases = [...document.querySelectorAll('canvas')]
    .map((c) => c.getBoundingClientRect())
    .filter((r) => r.width > 50 && r.height > 50)
    .map((r) => ({ x: r.left, y: r.top, w: r.width, h: r.height }));
  return {
    alive: !!root && root.childElementCount > 0,
    screen: screen ? screen.getAttribute('data-testid') : null,
    clickables,
    canvases,
  };
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  let context;
  let page;
  let step = 0;
  const t0 = Date.now();
  const errors = [];
  const crashes = [];
  const recent = [];
  const screens = new Set();
  const counts = {};
  const series = [];

  const note = (text) => {
    recent.push(text);
    if (recent.length > 40) recent.shift();
  };
  const fail = (kind, message) =>
    errors.push({ kind, message: String(message).slice(0, 600), step, last: recent.slice(-14) });

  async function open() {
    if (context) await context.close().catch(() => note('context.close falhou'));
    context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      deviceScaleFactor: DPR,
    });
    await context.addInitScript(installFakePad);
    if (SOAK) await context.addInitScript(installCounters);
    page = await context.newPage();
    page.on('pageerror', (e) => fail('pageerror', `${e.message}\n${e.stack ?? ''}`));
    page.on('console', (m) => {
      if (m.type() === 'error') fail('console.error', m.text());
    });
    page.on('crash', () => fail('crash', 'a página caiu'));
    page.on('dialog', (d) => d.accept().catch(() => note('dialog.accept falhou')));
    await page.goto(BASE_URL + START, { waitUntil: 'load' });
    note(`open ${START}`);
  }

  /** Heap, nós, *listeners*, laços de animação, áudio e RSS, depois de forçar o coletor de lixo. */
  async function sample() {
    const cdp = await context.newCDPSession(page);
    await cdp.send('Performance.enable');
    await cdp.send('HeapProfiler.collectGarbage');
    const { usedSize } = await cdp.send('Runtime.getHeapUsage');
    const { metrics } = await cdp.send('Performance.getMetrics');
    const m = Object.fromEntries(metrics.map((x) => [x.name, x.value]));
    await cdp.detach();
    const r0 = await page.evaluate(() => window.__raf);
    await page.waitForTimeout(2000);
    const r1 = await page.evaluate(() => window.__raf);
    let rssMB;
    try {
      const browserCdp = await browser.newBrowserCDPSession();
      const { processInfo } = await browserCdp.send('SystemInfo.getProcessInfo');
      let kb = 0;
      for (const p of processInfo) {
        const status = readFileSync(`/proc/${p.id}/status`, 'utf8');
        kb += Number(/VmRSS:\s+(\d+) kB/.exec(status)?.[1] ?? 0);
      }
      rssMB = Math.round(kb / 1024);
      await browserCdp.detach();
    } catch {
      rssMB = null; // sem /proc (macOS, Windows): fica sem o RSS
    }
    series.push({
      t: Math.round((Date.now() - t0) / 1000),
      rssMB,
      heapMB: +(usedSize / 1048576).toFixed(1),
      nodes: m.Nodes,
      listeners: m.JSEventListeners,
      rafPerS: Math.round((r1 - r0) / 2),
      audioContexts: await page.evaluate(() => window.__ctx),
    });
  }

  async function act() {
    const snap = await withTimeout(page.evaluate(readPage), 10000, 'leitura da página');
    if (!snap.alive) {
      crashes.push({ step, last: recent.slice(-14) });
      fail('BLANK', 'a raiz do React ficou vazia');
      await open();
      return;
    }
    if (snap.screen) screens.add(snap.screen);
    const kind = weighted([
      ['key', 30],
      ['hold', 10],
      ['click', 30],
      ['canvasClick', 8],
      ['drag', 5],
      ['wheel', 3],
      ['pad', 9],
      ['wait', 5],
      ['resize', RESIZE ? 4 : 0],
    ]);
    counts[kind] = (counts[kind] ?? 0) + 1;
    const where = `[${snap.screen}]`;
    if (kind === 'key') {
      const key = pick(KEYS);
      note(`key ${key} ${where}`);
      await withTimeout(page.keyboard.press(key.replace('Space', ' ')), 10000, 'tecla');
    } else if (kind === 'hold') {
      const key = pick(HOLD_KEYS);
      const ms = between(250, 1600);
      note(`hold ${key} ${ms}ms ${where}`);
      await page.keyboard.down(key);
      await page.waitForTimeout(ms);
      await page.keyboard.up(key);
    } else if (kind === 'click' && snap.clickables.length > 0) {
      const target = pick(snap.clickables);
      note(`click "${target.label}" ${where}`);
      await withTimeout(page.mouse.click(target.x, target.y), 10000, 'clique');
    } else if (kind === 'canvasClick' && snap.canvases.length > 0) {
      const c = pick(snap.canvases);
      const x = c.x + rnd() * c.w;
      const y = c.y + rnd() * c.h;
      note(`canvasClick ${Math.round(x)},${Math.round(y)} ${where}`);
      const button = rnd() < 0.15 ? 'right' : 'left';
      await withTimeout(page.mouse.click(x, y, { button }), 10000, 'clique no canvas');
    } else if (kind === 'drag' && snap.canvases.length > 0) {
      const c = pick(snap.canvases);
      const x = c.x + rnd() * c.w;
      const y = c.y + rnd() * c.h;
      note(`drag ${Math.round(x)},${Math.round(y)} ${where}`);
      await page.mouse.move(x, y);
      await page.mouse.down();
      for (let i = 0; i < 6; i++)
        await page.mouse.move(x + between(-200, 200), y + between(-150, 150));
      await page.mouse.up();
    } else if (kind === 'wheel') {
      const c = snap.canvases.length > 0 ? pick(snap.canvases) : { x: 400, y: 300, w: 10, h: 10 };
      note(`wheel ${where}`);
      await page.mouse.move(c.x + c.w / 2, c.y + c.h / 2);
      await page.mouse.wheel(0, pick([-400, -120, 120, 400]));
    } else if (kind === 'pad') {
      if (rnd() < 0.7) {
        const button = pick(PAD_BUTTONS);
        note(`pad botão ${button} ${where}`);
        await page.evaluate((i) => (window.__pad.buttons[i] = { pressed: true, value: 1 }), button);
        await page.waitForTimeout(between(60, 200));
        await page.evaluate(
          (i) => (window.__pad.buttons[i] = { pressed: false, value: 0 }),
          button,
        );
      } else {
        const axes = [0, 0, 0, 0].map(() => between(-100, 100) / 100);
        note(`pad eixos ${axes.join(',')} ${where}`);
        await page.evaluate((a) => (window.__pad.axes = a), axes);
        await page.waitForTimeout(between(150, 700));
        await page.evaluate(() => (window.__pad.axes = [0, 0, 0, 0]));
      }
    } else if (kind === 'resize') {
      const [width, height] = pick(SIZES);
      note(`resize ${width}x${height} ${where}`);
      await page.setViewportSize({ width, height });
    } else {
      note(`espera ${where}`);
      await page.waitForTimeout(between(150, 600));
    }
    await page.waitForTimeout(between(20, 120));
  }

  await open();
  let nextSample = 0;
  while (Date.now() - t0 < DURATION_MS) {
    step++;
    try {
      await act();
    } catch (e) {
      const message = String(e?.message ?? e);
      if (message.startsWith('TIMEOUT')) {
        crashes.push({ step, last: recent.slice(-14), freeze: message });
        fail('FREEZE', message);
        await open().catch((err) => fail('reopen', err));
      } else if (/Target (page|closed)|has been closed|crashed/i.test(message)) {
        fail('closed', message);
        await open().catch((err) => fail('reopen', err));
      }
      // As demais falhas de interação (o elemento sumiu no meio do clique, por exemplo) são
      // normais num teste aleatório e não contam.
    }
    if (!SOAK && step % 120 === 0 && rnd() < 0.3) await open();
    if (SOAK && Date.now() - t0 >= nextSample) {
      try {
        await sample();
      } catch (e) {
        fail('amostra', e);
      }
      nextSample += SAMPLE_MS;
    }
  }

  const raw = await page.evaluate(() => localStorage.getItem('scan-city-save')).catch(() => null);
  let save = 'sem save';
  if (raw) {
    try {
      JSON.parse(raw);
      save = 'ok';
    } catch {
      save = 'JSON inválido';
    }
  }
  await browser.close();

  const unique = [];
  const seen = new Set();
  for (const e of errors) {
    const key = `${e.kind}|${e.message.split('\n')[0]}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(e);
    }
  }
  const result = {
    label: LABEL,
    start: START,
    dpr: DPR,
    steps: step,
    seconds: Math.round((Date.now() - t0) / 1000),
    screens: [...screens],
    counts,
    save,
    crashes: crashes.length,
    errorsTotal: errors.length,
    errors: unique.slice(0, 12),
    series,
  };
  const file = join(OUT, `qa-random-${LABEL}.json`);
  writeFileSync(file, JSON.stringify(result, null, 1));
  console.log(
    `${LABEL}: ${step} ações em ${result.seconds} s · telas: ${result.screens.join(', ')} · erros: ${errors.length} (${unique.length} distintos) · quedas ou travadas: ${crashes.length} · save: ${save}`,
  );
  if (series.length > 0) {
    console.log('  t(s)  rss(MB)  heap(MB)  nós  listeners  laços/s  áudio');
    for (const s of series) {
      console.log(
        `  ${String(s.t).padStart(4)}  ${String(s.rssMB ?? '-').padStart(7)}  ${String(s.heapMB).padStart(8)}  ${String(s.nodes).padStart(3)}  ${String(s.listeners).padStart(9)}  ${String(s.rafPerS).padStart(7)}  ${s.audioContexts}`,
      );
    }
  }
  if (unique.length > 0) {
    console.error(`detalhes em ${file}`);
    for (const e of unique.slice(0, 5)) console.error(`  ${e.kind}: ${e.message.split('\n')[0]}`);
  }
  if (errors.length > 0 || crashes.length > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error('qa-random falhou:', e);
  process.exitCode = 2;
});
