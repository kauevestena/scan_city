import { COLORS } from '@/ui/tokens';
import {
  BEAMS,
  COLUMNS,
  crownHeight,
  CYCLE_S,
  groundWave,
  isCrown,
  renderCanopy,
  type CanopyView,
} from './canopyRenderer';

const view = (patch: Partial<CanopyView> = {}): CanopyView => ({
  width: 900,
  height: 640,
  canopy: 0.7,
  maxReturns: 3,
  closedGroundProbability: 0.04,
  photoVisibility: 0.09,
  labels: {
    lidar: 'LiDAR',
    camera: 'Câmera RGB',
    first: '1º retorno',
    middle: 'intermediário',
    last: 'último (solo)',
    dsm: 'MDS',
    dtm: 'MDT',
    photoDtm: 'MDT fotogramétrico (interpolado)',
  },
  ...patch,
});

function frame(v: CanopyView, tS: number) {
  const ctx = document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D;
  const texts: string[] = [];
  vi.spyOn(ctx, 'fillText').mockImplementation((t) => void texts.push(String(t)));
  const fills = new Set<string>();
  Object.defineProperty(ctx, 'fillStyle', {
    set: (c: string) => fills.add(String(c)),
    get: () => '',
    configurable: true,
  });
  const arcs: number[][] = [];
  vi.spyOn(ctx, 'arc').mockImplementation((x, y, r) => void arcs.push([x, y, r]));
  const ellipses = vi.spyOn(ctx, 'ellipse');
  renderCanopy(ctx, v, tS);
  return { texts, fills, arcs, crowns: ellipses.mock.calls.length };
}

describe('floresta do diagrama', () => {
  it('a cobertura decide quantas colunas têm copa (e o sorteio é determinístico)', () => {
    const count = (c: number) =>
      Array.from({ length: COLUMNS }, (_, i) => isCrown(i, c)).filter(Boolean).length;
    expect(count(0)).toBe(0);
    expect(count(0.98)).toBeGreaterThanOrEqual(COLUMNS - 2);
    expect(count(0.3)).toBeLessThan(count(0.7));
    expect(isCrown(3, 0.5)).toBe(isCrown(3, 0.5));
    // Subir a cobertura só acrescenta copas, nunca tira.
    for (let i = 0; i < COLUMNS; i++) if (isCrown(i, 0.4)) expect(isCrown(i, 0.8)).toBe(true);
  });

  it('copas de 46 a 92 px e solo ondulado dentro de ±14 px', () => {
    for (let i = 0; i < COLUMNS; i++) {
      expect(crownHeight(i)).toBeGreaterThanOrEqual(46);
      expect(crownHeight(i)).toBeLessThanOrEqual(92);
    }
    for (let x = 0; x <= 1; x += 0.05) expect(Math.abs(groundWave(x))).toBeLessThanOrEqual(14);
  });
});

describe('renderCanopy', () => {
  it('escreve os títulos das duas metades, a legenda e os perfis', () => {
    const { texts } = frame(view(), 2);
    for (const label of [
      'LiDAR',
      'Câmera RGB',
      '1º retorno',
      'intermediário',
      'último (solo)',
      'MDS',
      'MDT',
      'MDT fotogramétrico (interpolado)',
    ]) {
      expect(texts).toContain(label);
    }
  });

  it('desenha retornos nas cores do LiDAR: ciano (1º), violeta (intermediários) e emerald (solo)', () => {
    const { fills } = frame(view({ maxReturns: 5 }), 2);
    expect(fills.has(COLORS.radar)).toBe(true);
    expect(fills.has(COLORS.rift)).toBe(true);
    expect(fills.has(COLORS.ok)).toBe(true);
    expect(fills.has(COLORS.warn)).toBe(true);
  });

  it('sem cobertura não há copas; com cobertura cheia, quase todas as colunas têm', () => {
    expect(frame(view({ canopy: 0 }), 2).crowns).toBe(0);
    // Uma elipse por copa, nas duas metades.
    expect(frame(view({ canopy: 0.98 }), 2).crowns).toBeGreaterThanOrEqual(2 * (COLUMNS - 2));
  });

  it('um retorno só não tem intermediários: menos marcas que com 3 retornos', () => {
    const one = frame(view({ maxReturns: 1, canopy: 0.9 }), 2);
    const three = frame(view({ maxReturns: 3, canopy: 0.9 }), 2);
    expect(three.arcs.length).toBeGreaterThan(one.arcs.length);
  });

  it('os pulsos descem com o tempo e o ciclo recomeça', () => {
    const early = frame(view(), 0.1);
    const late = frame(view(), CYCLE_S * 0.8);
    expect(JSON.stringify(early.arcs)).not.toBe(JSON.stringify(late.arcs));
    // No começo do ciclo só os pulsos em voo: um ponto por raio (13 + 13).
    expect(early.arcs.length).toBeGreaterThanOrEqual(2 * BEAMS - 4);
    expect(JSON.stringify(frame(view(), CYCLE_S * 2 + 0.1).arcs)).not.toBe(
      JSON.stringify(early.arcs),
    );
  });

  it('o solo sob copa fechada só aparece com a probabilidade do domínio', () => {
    // Com probabilidade 1 todo pulso sob copa deixa o retorno de solo (mais pontos emerald).
    const certain = frame(view({ canopy: 0.95, closedGroundProbability: 1 }), 2.5);
    const never = frame(view({ canopy: 0.95, closedGroundProbability: 0 }), 2.5);
    expect(certain.arcs.length).toBeGreaterThan(never.arcs.length);
  });

  it('aguenta os extremos sem lançar', () => {
    for (const canopy of [0, 0.5, 0.98]) {
      for (const maxReturns of [1, 3, 5]) {
        expect(() =>
          frame(view({ canopy, maxReturns, photoVisibility: (1 - canopy) ** 2 }), 7.7),
        ).not.toThrow();
      }
    }
    expect(() => frame(view({ width: 240, height: 260 }), 1)).not.toThrow();
  });
});
