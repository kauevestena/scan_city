import { COLORS } from '@/ui/tokens';
import {
  cycleDurationS,
  HOLD_S,
  renderShutter,
  SLOW_MOTION,
  sweepAt,
  type ShutterView,
} from './shutterRenderer';

const view = (patch: Partial<ShutterView> = {}): ShutterView => ({
  width: 900,
  height: 640,
  speedMs: 8,
  readoutS: 0.03,
  spinRadS: 0,
  gsdM: 0.0274,
  global: false,
  labels: {
    scene: 'Cena em movimento',
    rolling: 'Rolling shutter: linha a linha',
    global: 'Sensor global: tudo no mesmo instante',
    slowMotion: 'Câmera lenta: a leitura é mostrada 20× mais devagar',
    skew: 'skew = 8,76 px',
    reference: 'poste na cena',
    sweep: 'varredura de leitura',
  },
  ...patch,
});

function frame(v: ShutterView, tS: number) {
  const ctx = document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D;
  const texts: string[] = [];
  vi.spyOn(ctx, 'fillText').mockImplementation((t) => void texts.push(String(t)));
  const strokes = new Set<string>();
  Object.defineProperty(ctx, 'strokeStyle', {
    set: (c: string) => strokes.add(String(c)),
    get: () => '',
    configurable: true,
  });
  const draws = vi.spyOn(ctx, 'drawImage');
  renderShutter(ctx, v, tS);
  return { texts, strokes, draws };
}

describe('ciclo da captura em câmera lenta', () => {
  it('a varredura é 20× mais lenta que a leitura e vem seguida de uma pausa', () => {
    expect(SLOW_MOTION).toBe(20);
    expect(cycleDurationS(0.03)).toBeCloseTo(0.6 + HOLD_S, 12);
    expect(sweepAt(0, 0.03)).toEqual({ progress: 0, simS: 0 });
    // Meio da varredura: 0,3 s de 0,6 s.
    const mid = sweepAt(0.3, 0.03);
    expect(mid.progress).toBeCloseTo(0.5, 12);
    expect(mid.simS).toBeCloseTo(0.015, 12);
    // Na pausa, a captura está completa.
    expect(sweepAt(1.0, 0.03)).toEqual({ progress: 1, simS: 0.03 });
    // E o ciclo recomeça.
    expect(sweepAt(cycleDurationS(0.03) + 0.3, 0.03).progress).toBeCloseTo(0.5, 9);
    expect(sweepAt(-0.1, 0.03).progress).toBeGreaterThanOrEqual(0);
  });

  it('com leitura 0 (sensor global) a captura é instantânea', () => {
    expect(sweepAt(0.2, 0).progress).toBe(1);
  });
});

describe('renderShutter', () => {
  it('escreve os títulos, a referência do poste e o skew', () => {
    const { texts } = frame(view(), 0.3);
    for (const label of [
      'Cena em movimento',
      'Rolling shutter: linha a linha',
      'skew = 8,76 px',
      'poste na cena',
      'varredura de leitura',
      'Câmera lenta: a leitura é mostrada 20× mais devagar',
    ]) {
      expect(texts).toContain(label);
    }
  });

  it('desenha as duas imagens (cena e captura) e a varredura ciano enquanto lê', () => {
    const during = frame(view(), 0.3);
    // Os pixels vão a uma tela fora da vista e dela para a mesa de desenho: cena e captura.
    expect(during.draws).toHaveBeenCalledTimes(2);
    expect(during.strokes.has(COLORS.radar)).toBe(true);
    // Na pausa, a captura está completa e não há varredura.
    const hold = frame(view(), 1.2);
    expect(hold.texts).not.toContain('varredura de leitura');
  });

  it('o sensor global troca o título e nunca varre', () => {
    const { texts } = frame(view({ global: true }), 0.3);
    expect(texts).toContain('Sensor global: tudo no mesmo instante');
    expect(texts).not.toContain('Rolling shutter: linha a linha');
    expect(texts).not.toContain('varredura de leitura');
  });

  it('aguenta os extremos: sem velocidade, leitura mínima e máxima, com giro', () => {
    const cases: Array<Partial<ShutterView>> = [
      { speedMs: 0 },
      { readoutS: 0.005, speedMs: 25 },
      { readoutS: 0.06, spinRadS: (90 * Math.PI) / 180 },
      { gsdM: 0.005 },
      { gsdM: 0.05, global: true },
    ];
    for (const c of cases) {
      for (const t of [0, 0.31, 5.7]) expect(() => frame(view(c), t)).not.toThrow();
    }
    expect(() => frame(view({ width: 260, height: 220 }), 0.2)).not.toThrow();
  });
});
