import { mulberry32 } from '@/lib/rng';
import {
  collinearityIndex,
  convexHull,
  hullCoverage,
  pointInPolygon,
  polygonArea,
  polygonBounds,
} from './geometry';

describe('convexHull', () => {
  it('quadrado com ponto interno → 4 vértices (anti-horário)', () => {
    const hull = convexHull([
      { u: 0, v: 0 },
      { u: 10, v: 0 },
      { u: 5, v: 5 },
      { u: 10, v: 10 },
      { u: 0, v: 10 },
    ]);
    expect(hull).toHaveLength(4);
    expect(hull).toEqual([
      { u: 0, v: 0 },
      { u: 10, v: 0 },
      { u: 10, v: 10 },
      { u: 0, v: 10 },
    ]);
  });

  it('descarta pontos colineares nas arestas e repetidos', () => {
    const hull = convexHull([
      { u: 0, v: 0 },
      { u: 5, v: 0 },
      { u: 10, v: 0 },
      { u: 10, v: 0 },
      { u: 0, v: 10 },
    ]);
    expect(hull).toHaveLength(3);
  });

  it('com menos de 3 pontos distintos, devolve os pontos', () => {
    expect(convexHull([])).toEqual([]);
    expect(convexHull([{ u: 1, v: 1 }])).toEqual([{ u: 1, v: 1 }]);
    expect(
      convexHull([
        { u: 1, v: 1 },
        { u: 1, v: 1 },
      ]),
    ).toEqual([{ u: 1, v: 1 }]);
  });

  it('contém todos os pontos (100 nuvens seedadas)', () => {
    const rng = mulberry32(3);
    for (let t = 0; t < 100; t++) {
      const pts = Array.from({ length: rng.int(3, 30) }, () => ({
        u: rng.range(0, 100),
        v: rng.range(0, 100),
      }));
      const hull = convexHull(pts);
      for (const p of pts) expect(pointInPolygon(p, hull, true)).toBe(true);
    }
  });
});

describe('áreas e cobertura do casco', () => {
  it('shoelace e cobertura relativa à AOI', () => {
    const square = [
      { u: 0, v: 0 },
      { u: 10, v: 0 },
      { u: 10, v: 10 },
      { u: 0, v: 10 },
    ];
    expect(polygonArea(square)).toBe(100);
    expect(polygonArea([...square].reverse())).toBe(100);
    expect(polygonArea(square.slice(0, 2))).toBe(0);
    expect(hullCoverage(square, { widthM: 20, lengthM: 20 })).toBe(0.25);
    expect(hullCoverage(square, { widthM: 5, lengthM: 5 })).toBe(1);
    expect(hullCoverage(square.slice(0, 2), { widthM: 5, lengthM: 5 })).toBe(0);
  });

  it('C00: os 5 GCPs de referência cobrem 2/3 da AOI', () => {
    const gcps = [
      { u: 25, v: 20 },
      { u: 215, v: 20 },
      { u: 25, v: 140 },
      { u: 215, v: 140 },
      { u: 120, v: 80 },
    ];
    expect(hullCoverage(gcps, { widthM: 160, lengthM: 240 })).toBeCloseTo(
      (190 * 120) / (160 * 240),
      12,
    );
  });
});

describe('collinearityIndex', () => {
  it('pontos alinhados < 1e-6; quadrado ≈ 1; menos de 3 pontos → 0', () => {
    expect(
      collinearityIndex([
        { u: 0, v: 0 },
        { u: 5, v: 5 },
        { u: 10, v: 10 },
        { u: 20, v: 20 },
      ]),
    ).toBeLessThan(1e-6);
    expect(
      collinearityIndex([
        { u: 0, v: 0 },
        { u: 10, v: 0 },
        { u: 10, v: 10 },
        { u: 0, v: 10 },
      ]),
    ).toBeCloseTo(1, 12);
    expect(
      collinearityIndex([
        { u: 0, v: 0 },
        { u: 1, v: 1 },
      ]),
    ).toBe(0);
    expect(
      collinearityIndex([
        { u: 3, v: 3 },
        { u: 3, v: 3 },
        { u: 3, v: 3 },
      ]),
    ).toBe(0);
  });

  it('um triângulo achatado fica entre 0 e 1', () => {
    const c = collinearityIndex([
      { u: 0, v: 0 },
      { u: 100, v: 0 },
      { u: 50, v: 5 },
    ]);
    expect(c).toBeGreaterThan(0);
    expect(c).toBeLessThan(0.05);
  });
});

describe('pointInPolygon e limites', () => {
  const tri = [
    { u: 0, v: 0 },
    { u: 10, v: 0 },
    { u: 0, v: 10 },
  ];
  it('dentro, fora e na borda', () => {
    expect(pointInPolygon({ u: 2, v: 2 }, tri)).toBe(true);
    expect(pointInPolygon({ u: 8, v: 8 }, tri)).toBe(false);
    expect(pointInPolygon({ u: 5, v: 0 }, tri, true)).toBe(true);
    expect(pointInPolygon({ u: -1, v: 0 }, tri, true)).toBe(false);
  });

  it('caixa envolvente', () => {
    expect(polygonBounds(tri)).toEqual({ uMin: 0, uMax: 10, vMin: 0, vMax: 10 });
  });
});
