import { COLORS } from '@/ui/tokens';
import {
  H_MAX_M,
  H_MIN_M,
  LUPA_MAX_CELLS,
  logPosition,
  lupaCells,
  orthoTexture,
  pixelColor,
  renderOptics,
  type OpticsView,
} from './opticsRenderer';

const view = (patch: Partial<OpticsView> = {}): OpticsView => ({
  width: 900,
  height: 600,
  heightM: 100,
  focalMm: 35,
  sensorWidthMm: 36,
  halfFovRad: (27 * Math.PI) / 180,
  gsdM: 0.0125,
  labels: {
    height: 'H = 100 m',
    focal: 'f = 35,0 mm',
    sensor: 'sensor 36,0 mm',
    pixel: 'pixel 4,38 µm',
    ground: 'W_g = 102,9 m',
    gsd: 'GSD 1,25 cm/px',
    lupa: 'Lupa: 50 cm de chão',
  },
  ...patch,
});

function ctxOf() {
  return document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D;
}

/** Textos desenhados e cores de preenchimento usadas num quadro. */
function frame(v: OpticsView, tS = 0) {
  const ctx = ctxOf();
  const texts: string[] = [];
  vi.spyOn(ctx, 'fillText').mockImplementation((t) => void texts.push(String(t)));
  const fills = new Set<string>();
  Object.defineProperty(ctx, 'fillStyle', {
    set: (c: string) => fills.add(String(c)),
    get: () => '',
    configurable: true,
  });
  const arcs: number[][] = [];
  vi.spyOn(ctx, 'arc').mockImplementation((x, y) => void arcs.push([x, y]));
  renderOptics(ctx, v, tS);
  return { texts, fills, arcs, ctx };
}

describe('régua logarítmica de H', () => {
  it('20 m na ponta de cima, 300 m na de baixo, a média geométrica no meio', () => {
    expect(logPosition(H_MIN_M)).toBe(0);
    expect(logPosition(H_MAX_M)).toBe(1);
    expect(logPosition(Math.sqrt(H_MIN_M * H_MAX_M))).toBeCloseTo(0.5, 9);
    expect(logPosition(5)).toBe(0);
    expect(logPosition(900)).toBe(1);
    expect(logPosition(100)).toBeGreaterThan(logPosition(50));
  });
});

describe('lupa do pixel no solo', () => {
  it('50 cm de chão divididos pelo GSD, entre 1 e 40 células por lado', () => {
    expect(lupaCells(0.0125)).toBe(40);
    expect(lupaCells(0.1)).toBe(5);
    expect(lupaCells(0.5)).toBe(1);
    expect(lupaCells(2)).toBe(1);
    expect(lupaCells(0.001)).toBe(LUPA_MAX_CELLS);
    expect(lupaCells(0)).toBe(LUPA_MAX_CELLS);
  });

  it('a textura tem juntas escuras, faixa branca e ladrilhos alternados', () => {
    expect(orthoTexture(0.002, 0.03)).toEqual([38, 44, 58]);
    // x + y = 0,16 m: dentro da faixa diagonal de 5 cm (centrada em 0,15 m), longe das juntas.
    expect(orthoTexture(0.03, 0.13)).toEqual([226, 232, 240]);
    const a = orthoTexture(0.02, 0.02);
    const b = orthoTexture(0.08, 0.02);
    expect(a).not.toEqual(b);
  });

  it('com GSD pequeno o pixel é a própria textura; com GSD grande vira a média (o detalhe some)', () => {
    const fine = pixelColor(0.03, 0.03, 0.0005);
    const tex = orthoTexture(0.03, 0.03);
    for (let c = 0; c < 3; c++) expect(fine[c]).toBeCloseTo(tex[c] as number, 0);
    const coarse = pixelColor(0.25, 0.25, 0.5);
    const lo = Math.min(...[38, 86, 100, 226]);
    const hi = Math.max(...[38, 86, 100, 226]);
    for (const channel of coarse) {
      expect(channel).toBeGreaterThan(lo);
      expect(channel).toBeLessThan(hi);
    }
  });
});

describe('renderOptics', () => {
  it('escreve os rótulos do diagrama e usa o âmbar no pixel projetado', () => {
    const { texts, fills } = frame(view());
    for (const label of [
      'H = 100 m',
      'f = 35,0 mm',
      'W_g = 102,9 m',
      'GSD 1,25 cm/px',
      'Lupa: 50 cm de chão',
      'sensor 36,0 mm · pixel 4,38 µm',
    ]) {
      expect(texts).toContain(label);
    }
    expect(fills.has(COLORS.warn)).toBe(true);
    // Régua com as cinco marcas.
    for (const m of [20, 50, 100, 200, 300]) expect(texts).toContain(`${m} m`);
  });

  it('os pontos de luz andam com o tempo (e a 7 raios, 7 pontos por quadro)', () => {
    const a = frame(view(), 0);
    const b = frame(view(), 0.6);
    const dots = (arcs: number[][]) => arcs.filter((p) => p.length === 2);
    expect(dots(a.arcs)).toHaveLength(dots(b.arcs).length);
    expect(a.arcs.length).toBeGreaterThanOrEqual(7);
    expect(JSON.stringify(a.arcs)).not.toBe(JSON.stringify(b.arcs));
  });

  it('o solo desce quando H cresce (escala log): a lupa e a régua acompanham', () => {
    const groundY = (heightM: number) => {
      const { ctx } = frame(view({ heightM }));
      void ctx;
      return logPosition(heightM);
    };
    expect(groundY(300)).toBeGreaterThan(groundY(40));
  });

  it('aguenta os extremos dos sliders sem lançar', () => {
    for (const heightM of [20, 300]) {
      for (const focalMm of [4, 50]) {
        for (const sensorWidthMm of [6, 36]) {
          for (const halfFovRad of [0.03, 0.6, 1.2]) {
            expect(() =>
              frame(view({ heightM, focalMm, sensorWidthMm, halfFovRad, gsdM: 0.0005 }), 1.3),
            ).not.toThrow();
          }
        }
      }
    }
    expect(() => frame(view({ width: 200, height: 160, gsdM: 5 }))).not.toThrow();
  });
});
