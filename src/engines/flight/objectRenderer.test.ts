import { drawSceneObject, type ObjectContext, type SceneObject } from './objectRenderer';
import { makeCamera } from './projection';

const ctx2d = () => document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D;

type CanvasEvent = { type: string; props: { value?: unknown } };
const fills = (ctx: CanvasRenderingContext2D) =>
  (ctx as unknown as { __getEvents(): CanvasEvent[] })
    .__getEvents()
    .filter((e) => e.type === 'fillStyle')
    .map((e) => String(e.props.value));
const rects = (ctx: CanvasRenderingContext2D) =>
  (ctx.fillRect as unknown as { mock: { calls: number[][] } }).mock.calls;
/** `rgba(r, g, b, a)` → [r, g, b, a]. */
const parse = (fill: string) =>
  (/^rgba\((\d+), (\d+), (\d+), ([\d.]+)\)$/.exec(fill) ?? []).slice(1).map(Number);

const scene: ObjectContext = {
  cam: makeCamera(1280, 720, 0, 100, 'LOW'),
  elevation: () => 0,
  fog: 0,
  fogColor: [200, 210, 220],
  timeS: 0,
};
const beam = (over: Partial<SceneObject> = {}): SceneObject => ({
  id: 1,
  kind: 'ENERGY_BEAM',
  X: 0,
  Z: 120,
  widthM: 6,
  depthM: 6,
  heightM: 80,
  baseM: 0,
  color: [34, 211, 238],
  on: true,
  ...over,
});

describe('feixe de energia (ENERGY_BEAM)', () => {
  it('ligado: coluna na cor do feixe (ciano), translúcida, com um núcleo claro e mais estreito', () => {
    const ctx = ctx2d();
    drawSceneObject(ctx, beam(), scene);
    const [body, core] = fills(ctx).map(parse);
    expect(body?.slice(0, 3)).toEqual([34, 211, 238]);
    expect(body?.[3]).toBeCloseTo(0.45, 2);
    expect(core?.slice(0, 3)).toEqual([255, 255, 255]);
    expect(core?.[3]).toBeCloseTo(0.27, 2);
    const [wide, narrow] = rects(ctx);
    expect(rects(ctx)).toHaveLength(2);
    expect(narrow?.[2]).toBeCloseTo((wide?.[2] as number) * 0.4, 6);
    expect(narrow?.[3]).toBe(wide?.[3]);
  });

  it('a cor do objeto manda: o feixe amarelo sai amarelo', () => {
    const ctx = ctx2d();
    drawSceneObject(ctx, beam({ color: [250, 204, 21] }), scene);
    expect(parse(fills(ctx)[0] as string).slice(0, 3)).toEqual([250, 204, 21]);
  });

  it('a névoa mistura a cor do feixe com a do horizonte, como nos outros objetos', () => {
    const ctx = ctx2d();
    drawSceneObject(ctx, beam(), { ...scene, fog: 0.5 });
    expect(parse(fills(ctx)[0] as string).slice(0, 3)).toEqual([117, 211, 229]);
  });

  it('desligado: só a coluna fraca (sem núcleo); a 0,5 s de ligar, pulsa mais forte', () => {
    const off = ctx2d();
    drawSceneObject(off, beam({ on: false, pulse: 0 }), scene);
    expect(rects(off)).toHaveLength(1);
    expect(parse(fills(off)[0] as string)[3]).toBeCloseTo(0.12, 2);
    const warn = ctx2d();
    drawSceneObject(warn, beam({ on: false, pulse: 1 }), scene);
    expect(rects(warn)).toHaveLength(1);
    expect(parse(fills(warn)[0] as string)[3]).toBeCloseTo(0.42, 2);
  });

  it('a coluna pulsa com o tempo enquanto está ligada', () => {
    const alphaAt = (timeS: number) => {
      const ctx = ctx2d();
      drawSceneObject(ctx, beam(), { ...scene, timeS });
      return parse(fills(ctx)[0] as string)[3] as number;
    };
    const samples = [0, 0.03, 0.06, 0.09, 0.12].map(alphaAt);
    expect(Math.max(...samples) - Math.min(...samples)).toBeGreaterThan(0.1);
    for (const a of samples) {
      expect(a).toBeGreaterThanOrEqual(0.3);
      expect(a).toBeLessThanOrEqual(0.6);
    }
  });
});
