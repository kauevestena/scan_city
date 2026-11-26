import { GUST_WARN_S } from '@/domain/gusts';
import {
  buildGustFront,
  drawGustCut,
  drawGustFront,
  GUST_FRONT_START_M,
  GUST_IMPACT_S,
  GUST_JOLT_PX,
  gustFrontX,
  gustJoltPx,
} from './gustRenderer';
import { makeCamera } from './projection';

const cam = makeCamera(1280, 720, 0, 112, 'HIGH');
const ctx2d = () => document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D;

describe('frente de vento', () => {
  it('parte a 80 m do lado de onde a rajada vem e chega à aeronave no instante do empurrão', () => {
    // Rajada para a direita: vem da esquerda (X negativo).
    expect(gustFrontX(0, 1, GUST_WARN_S)).toBeCloseTo(-GUST_FRONT_START_M, 9);
    expect(gustFrontX(0, 1, GUST_WARN_S / 2)).toBeCloseTo(-GUST_FRONT_START_M / 2, 9);
    expect(gustFrontX(3, -1, 0)).toBeCloseTo(3, 9);
    expect(gustFrontX(0, -1, GUST_WARN_S)).toBeCloseTo(GUST_FRONT_START_M, 9);
  });

  it('só existe no aviso; fica mais forte ao chegar', () => {
    const base = { side: 1 as const, aircraftX: 0, aircraftAlt: 100, cam, timeS: 2 };
    expect(buildGustFront({ ...base, inS: 0 })).toBeNull();
    expect(buildGustFront({ ...base, inS: GUST_WARN_S + 0.1 })).toBeNull();
    const far = buildGustFront({ ...base, inS: GUST_WARN_S * 0.9 });
    const near = buildGustFront({ ...base, inS: 0.2 });
    expect(far?.sheet).not.toBeNull();
    expect(near?.progress ?? 0).toBeGreaterThan(far?.progress ?? 1);
    expect(near?.sheetAlpha ?? 0).toBeGreaterThan(far?.sheetAlpha ?? 1);
    // Os riscos correm para o lado do empurrão.
    const s = near?.streaks ?? [];
    expect(s.length).toBeGreaterThan(0);
    for (let k = 0; k < s.length; k += 4)
      expect(s[k + 2] as number).toBeGreaterThan(s[k] as number);
    const ctx = ctx2d();
    if (near) drawGustFront(ctx, near);
    expect(ctx.fill).toHaveBeenCalledTimes(1);
    expect(ctx.stroke).toHaveBeenCalledTimes(2);
  });

  it('tranco na chegada sem contragolpe; nada com a rajada cortada ou com reduceFlashes', () => {
    const hit = { side: 1 as const, cut: false, atS: 10 };
    expect(gustJoltPx(hit, 10, false)).toBe(0);
    const mid = gustJoltPx(hit, 10 + GUST_IMPACT_S / 3, false);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThanOrEqual(GUST_JOLT_PX);
    expect(gustJoltPx({ ...hit, side: -1 }, 10 + GUST_IMPACT_S / 3, false)).toBeLessThan(0);
    expect(gustJoltPx(hit, 10 + GUST_IMPACT_S, false)).toBe(0);
    expect(gustJoltPx({ ...hit, cut: true }, 10.1, false)).toBe(0);
    expect(gustJoltPx(hit, 10.1, true)).toBe(0);
    expect(gustJoltPx(null, 10.1, false)).toBe(0);
  });

  it('o arco do corte abre e some; com reduceFlashes, não abre', () => {
    const a = ctx2d();
    drawGustCut(a, 640, 600, 1, 0.1, false);
    drawGustCut(a, 640, 600, 1, 0.3, false);
    const radii = vi.mocked(a.arc).mock.calls.map((c) => c[2]);
    expect(radii[2] as number).toBeGreaterThan(radii[0] as number);
    const b = ctx2d();
    drawGustCut(b, 640, 600, 1, 0.1, true);
    drawGustCut(b, 640, 600, 1, 0.3, true);
    const still = vi.mocked(b.arc).mock.calls.map((c) => c[2]);
    expect(still[0]).toBe(still[2]);
    const c = ctx2d();
    drawGustCut(c, 640, 600, 1, GUST_IMPACT_S, false);
    expect(c.arc).not.toHaveBeenCalled();
  });
});
