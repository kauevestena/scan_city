import { makeCamera } from './projection';
import { drawWingTrails, TRAIL_MIN_DEPTH_M, TRAIL_POINTS, TRAIL_S, WingTrails } from './trails';

const cam = makeCamera(1280, 720, 0, 100, 'HIGH');

describe('rastros das asas', () => {
  it('guardam só o último meio segundo e começam de novo numa linha nova', () => {
    const t = new WingTrails();
    for (let k = 0; k <= 60; k++) t.push(k / 60, k * 0.3, 0, 100);
    const pts = t.build(1, 18, 'MULTIROTOR', cam);
    const n = pts.length / 5;
    expect(n).toBeGreaterThan(1);
    expect(n).toBeLessThanOrEqual(TRAIL_POINTS);
    for (let i = 0; i < n; i++) expect(pts[i * 5 + 4] as number).toBeLessThanOrEqual(1);
    // O ponto mais novo tem idade 0 e os dois lados ficam um de cada lado.
    expect(pts[4]).toBe(0);
    expect(pts[0] as number).toBeLessThan(pts[2] as number);
    t.push(1 + 1 / 60, 0, 0, 100);
    expect(t.build(1 + 1 / 60, 0, 'MULTIROTOR', cam).length / 5).toBe(1);
    expect(TRAIL_S).toBeGreaterThan(0);
  });

  it('não mergulham para perto da câmera', () => {
    const t = new WingTrails();
    // Muito rápido: o rastro iria a 30 m para trás, mas para em 22 m de profundidade.
    for (let k = 0; k <= 30; k++) t.push(k / 60, k * 2, 0, 100);
    const pts = t.build(0.5, 60, 'BIRD', cam);
    const maxY = 252 + (12 * cam.focalPx) / TRAIL_MIN_DEPTH_M;
    for (let i = 0; i < pts.length / 5; i++)
      expect(pts[i * 5 + 1] as number).toBeLessThanOrEqual(maxY + 1e-6);
  });

  it('três trechos de transparência, um traço cada', () => {
    const t = new WingTrails();
    for (let k = 0; k <= 30; k++) t.push(k / 60, k * 0.3, 0, 100);
    const ctx = document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D;
    drawWingTrails(ctx, t.build(0.5, 9, 'FIXED_WING_VTOL', cam));
    expect(ctx.stroke).toHaveBeenCalledTimes(3);
    const empty = document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D;
    drawWingTrails(empty, []);
    expect(empty.stroke).not.toHaveBeenCalled();
  });
});
