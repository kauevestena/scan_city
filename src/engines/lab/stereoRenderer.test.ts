import { COLORS } from '@/ui/tokens';
import { imageScale, renderStereo, type StereoView } from './stereoRenderer';

const view = (patch: Partial<StereoView> = {}): StereoView => ({
  width: 900,
  height: 640,
  baseM: 30,
  heightM: 100,
  objectM: 20,
  photoBaseMm: 10.5,
  parallaxDiffMm: 2.625,
  labels: {
    base: 'B = 30 m',
    height: 'H = 100 m',
    object: 'h = 20,0 m',
    photoBase: 'b = 10,50 mm',
    parallax: 'Δp = 2,625 mm',
    photo1: 'Foto 1 (C1)',
    photo2: 'Foto 2 (C2)',
    overlay: 'Sobreposição',
    top: 'topo',
    ground: 'solo',
  },
  ...patch,
});

function frame(v: StereoView, tS = 0) {
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
  vi.spyOn(ctx, 'arc').mockImplementation((x, y) => void arcs.push([x, y]));
  const rects: number[][] = [];
  vi.spyOn(ctx, 'strokeRect').mockImplementation((x, y, w, h) => void rects.push([x, y, w, h]));
  renderStereo(ctx, v, tS);
  return { texts, fills, arcs, rects };
}

describe('escala dos planos-imagem', () => {
  it('usa o sensor inteiro (36 mm) quando os pontos cabem', () => {
    expect(imageScale(360, 10.5, 2.625)).toBe(10);
  });

  it('reduz a escala quando o ponto mais afastado não caberia (B/H alto)', () => {
    const k = imageScale(360, 100, 60);
    expect(k).toBeLessThan(10);
    // O ponto mais afastado (b + Δp)/2 fica a 46 % da largura do plano.
    expect(((100 + 60) / 2) * k).toBeCloseTo(360 * 0.46, 9);
  });
});

describe('renderStereo', () => {
  it('escreve as cotas e os títulos dos planos-imagem', () => {
    const { texts } = frame(view());
    for (const label of [
      'B = 30 m',
      'H = 100 m',
      'h = 20,0 m',
      'b = 10,50 mm',
      'Δp = 2,625 mm',
      'Foto 1 (C1)',
      'Foto 2 (C2)',
      'Sobreposição',
      'C1',
      'C2',
      'topo',
    ]) {
      expect(texts).toContain(label);
    }
  });

  it('topo em âmbar e base em ciano', () => {
    const { fills, arcs } = frame(view());
    expect(fills.has(COLORS.warn)).toBe(true);
    expect(arcs.length).toBeGreaterThan(10);
  });

  it('o prédio cresce com h: o retângulo dele fica mais alto', () => {
    const building = (objectM: number) => {
      const { rects } = frame(view({ objectM }));
      // O prédio é o retângulo mais estreito e mais alto que a largura de um plano-imagem.
      return Math.max(
        ...rects.filter(([, , w]) => (w as number) < 150).map(([, , , h]) => h as number),
      );
    };
    expect(building(40)).toBeGreaterThan(building(10));
  });

  it('os pulsos de luz andam com o tempo', () => {
    const a = frame(view(), 0);
    const b = frame(view(), 0.7);
    expect(a.arcs.length).toBe(b.arcs.length);
    expect(JSON.stringify(a.arcs)).not.toBe(JSON.stringify(b.arcs));
  });

  it('aguenta os extremos: h = 0, h = 0,8·H, B/H muito alto e baixo', () => {
    const cases: Array<Partial<StereoView>> = [
      { objectM: 0, parallaxDiffMm: 0 },
      { heightM: 50, objectM: 40, baseM: 100, photoBaseMm: 100, parallaxDiffMm: 400 },
      { heightM: 300, baseM: 5, objectM: 240, photoBaseMm: 0.58, parallaxDiffMm: 2.3 },
    ];
    for (const c of cases) expect(() => frame(view(c), 2.1)).not.toThrow();
    expect(() => frame(view({ width: 240, height: 200 }))).not.toThrow();
  });
});
