import type { Residual } from '@/types';
import { classifyAsprs, classifyPec, pecAltimetricLimits, pecPlanimetricLimits } from './standards';

const close = (a: number, e: number, rel = 1e-3) =>
  expect(Math.abs(a - e) / Math.abs(e)).toBeLessThanOrEqual(rel);

/** Resíduos com erro resultante `r` (todo em X) e dz. */
const res = (rs: number[], dz: number[] = rs.map(() => 0)): Residual[] =>
  rs.map((r, i) => ({ pointId: `CP${i}`, kind: 'CP', dxM: r, dyM: 0, dzM: dz[i] as number }));

describe('PEC-PCD (domain-math §8.1)', () => {
  it('G18 — limites planimétricos', () => {
    const a1000 = pecPlanimetricLimits('A', 1000);
    close(a1000.epM, 0.17);
    close(a1000.pecM, 0.28);
    const a500 = pecPlanimetricLimits('A', 500);
    close(a500.epM, 0.085);
    close(a500.pecM, 0.14);
    const b500 = pecPlanimetricLimits('B', 500);
    close(b500.epM, 0.15);
    close(b500.pecM, 0.25);
  });

  it('limites altimétricos como fração da equidistância', () => {
    const a = pecAltimetricLimits('A', 0.5);
    close(a.pecM, 0.135);
    close(a.epM, 0.5 / 6);
    expect(pecAltimetricLimits('D', 1)).toEqual({ pecM: 0.75, epM: 0.5 });
  });

  it('G25 — 5 CPs [0,10; 0,12; 0,08; 0,15; 0,11] m a 1:1000 → RMSE_r 0,1144 m, classe A', () => {
    const residuals: Residual[] = [0.1, 0.12, 0.08, 0.15, 0.11].map((r, i) => ({
      pointId: `CP${i}`,
      kind: 'CP',
      dxM: r * 0.6,
      dyM: r * 0.8,
      dzM: 0,
    }));
    const result = classifyPec(residuals, 1000);
    expect(result.planimetric.achieved).toBe('A');
    expect(result.planimetric.pass).toBe(true);
    expect(result.planimetric.pct90).toBe(1);
    expect(result.altimetric).toBeUndefined();
    close(Math.sqrt(residuals.reduce((s, r) => s + r.dxM ** 2 + r.dyM ** 2, 0) / 5), 0.1144);
  });

  it('classe pior que a exigida não passa; nenhuma classe → FORA', () => {
    // RMSE ≈ 0,4 m a 1:1000: EP de B (0,30) estoura, C (0,50) passa.
    const c = classifyPec(res([0.4, 0.4, 0.4]), 1000, undefined, 'B');
    expect(c.planimetric.achieved).toBe('C');
    expect(c.planimetric.pass).toBe(false);
    expect(c.requiredClass).toBe('B');
    close(c.planimetric.epM, 0.3);
    const fora = classifyPec(res([2, 2, 2]), 1000, undefined, 'D');
    expect(fora.planimetric.achieved).toBe('FORA');
    expect(fora.planimetric.pass).toBe(false);
    expect(classifyPec([], 1000).planimetric.achieved).toBe('FORA');
  });

  it('regra dos 90 % ≤ PEC: 1 ponto fora em 10 passa; 2 fora não', () => {
    // A 1:1000: EP 0,17 e PEC 0,28. Nove pontos pequenos e um acima do PEC.
    const one = classifyPec(res([...Array<number>(9).fill(0.05), 0.3]), 1000);
    expect(one.planimetric.pct90).toBeCloseTo(0.9, 12);
    expect(one.planimetric.achieved).toBe('A');
    const two = classifyPec(res([...Array<number>(8).fill(0.05), 0.3, 0.3]), 1000);
    expect(two.planimetric.pct90).toBeCloseTo(0.8, 12);
    expect(two.planimetric.achieved).not.toBe('A');
  });

  it('altimetria separada, com |dz|', () => {
    const r = classifyPec(res([0.05, 0.05], [-0.3, 0.3]), 1000, 1, 'B');
    expect(r.altimetric?.achieved).toBe('B');
    expect(r.altimetric?.pass).toBe(true);
    close(r.altimetric?.pecM as number, 0.5);
  });
});

describe('ASPRS (domain-math §8.2)', () => {
  it('compara RMSE_r e RMSE_z em cm com as classes', () => {
    const rmse = { x: 0.03, y: 0.04, z: 0.08, r: 0.05 };
    expect(classifyAsprs(rmse, 7, 10)).toEqual({
      horizontalCm: 7,
      verticalCm: 10,
      rmseHcm: 5,
      rmseVcm: 8,
      passH: true,
      passV: true,
    });
    expect(classifyAsprs(rmse, 4, 7)).toMatchObject({ passH: false, passV: false });
  });
});
