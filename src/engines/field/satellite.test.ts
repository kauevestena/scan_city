import { CATALOG, getVehicle } from '@/data/catalog';
import { C00 } from '@/data/contracts';
import { buildFlightPlan } from '@/domain/flightPlanner';
import { referenceParams } from '@/test/fixtures/syntheticMission';
import { createTerrain } from '@/world/terrain/createTerrain';
import {
  accessMask,
  ACCESS_GRID,
  buildRaster,
  clampView,
  hillshadeFactor,
  initialView,
  panBy,
  pickPoint,
  rasterSize,
  scaleBarMeters,
  shotPositions,
  toScreen,
  toWorld,
  viewTransform,
  zoomAt,
} from './satellite';
import { SatelliteRenderer } from './SatelliteRenderer';

const terrain = createTerrain(C00);
const plan = buildFlightPlan(referenceParams(C00), C00, CATALOG);

describe('raster', () => {
  it('512 px no lado maior, na proporção da área (AOI + 20 %)', () => {
    expect(terrain.bounds).toEqual({ uMin: -48, uMax: 288, vMin: -32, vMax: 192 });
    expect(rasterSize(terrain)).toEqual({ width: 512, height: 341 });
    expect(rasterSize({ bounds: { uMin: 0, uMax: 10, vMin: 0, vMax: 20 } })).toEqual({
      width: 256,
      height: 512,
    });
  });

  it('cor da cobertura × hillshade: plano = 1, face voltada à luz > 1, de costas < 1', () => {
    expect(hillshadeFactor(0, 0)).toBeCloseTo(1, 9);
    // Luz de NO (−u, −v): o terreno que sobe para SE (+u, +v) tem a face voltada para ela.
    expect(hillshadeFactor(0.3, 0.3)).toBeGreaterThan(1);
    expect(hillshadeFactor(-0.3, -0.3)).toBeLessThan(1);
    const size = { width: 64, height: 43 };
    const data = buildRaster(terrain, size);
    expect(data).toHaveLength(64 * 43 * 4);
    // Determinístico: mesmo terreno, mesmo raster.
    expect(buildRaster(terrain, size)).toEqual(data);
    // A água do açude usa a cor da paleta sem sombreamento.
    let water = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] === 58 && data[i + 1] === 108 && data[i + 2] === 150) water++;
    }
    expect(water).toBeGreaterThan(0);
  });

  it('máscara 64 × 64: água e cantos fora do alcance a pé são inválidos', () => {
    const mask = accessMask(terrain, [getVehicle('FOOT_BIKE')], { paintMarkers: false });
    expect(mask).toHaveLength(ACCESS_GRID * ACCESS_GRID);
    // Canto (−48, 192): a 189 m da estrada, além dos 150 m a pé.
    expect(mask[(ACCESS_GRID - 1) * ACCESS_GRID]).toBe(1);
    const painted = accessMask(terrain, [getVehicle('FOOT_BIKE')], { paintMarkers: true });
    expect(painted.reduce((a, b) => a + b, 0)).toBeLessThan(mask.reduce((a, b) => a + b, 0));
  });
});

describe('plano sobre a vista', () => {
  it('disparos estimados: 16 por linha, a cada base, na janela AOI ± 1 base', () => {
    const line = plan.lines[0];
    if (!line) throw new Error('sem linhas');
    const shots = shotPositions(line, plan);
    expect(shots).toHaveLength(16);
    const step = Math.hypot(
      (shots[1]?.u ?? 0) - (shots[0]?.u ?? 0),
      (shots[1]?.v ?? 0) - (shots[0]?.v ?? 0),
    );
    expect(step).toBeCloseTo(plan.stats.baseM, 6);
    expect(shotPositions({ ...line, end: line.start }, plan)).toEqual([]);
  });

  it('pickPoint pega o ponto mais próximo no raio', () => {
    const pts = [
      { id: 'GCP-01', kind: 'GCP' as const, u: 10, v: 10, elevM: 0, sigmaM: 0 },
      { id: 'CP-01', kind: 'CP' as const, u: 13, v: 10, elevM: 0, sigmaM: 0 },
    ];
    expect(pickPoint(pts, 12, 10, 4)?.id).toBe('CP-01');
    expect(pickPoint(pts, 50, 50, 4)).toBeNull();
  });
});

describe('vista: enquadramento, zoom e pan', () => {
  const W = 800;
  const H = 600;

  it('ida e volta tela ↔ mundo; zoom 1×–4× mantém o ponto sob o cursor', () => {
    const view = initialView(terrain);
    const t = viewTransform(terrain, view, W, H);
    const s = toScreen(t, 100, 50);
    expect(toWorld(t, s.x, s.y)).toEqual({ u: expect.closeTo(100, 9), v: expect.closeTo(50, 9) });
    const zoomed = zoomAt(view, terrain, W, H, s.x, s.y, 2);
    expect(zoomed.zoom).toBe(2);
    const after = toWorld(viewTransform(terrain, zoomed, W, H), s.x, s.y);
    expect(after.u).toBeCloseTo(100, 6);
    expect(after.v).toBeCloseTo(50, 6);
    expect(zoomAt(zoomed, terrain, W, H, 0, 0, 10).zoom).toBe(4);
    expect(zoomAt(view, terrain, W, H, 0, 0, 0.1).zoom).toBe(1);
  });

  it('pan em pixels e centro preso à área', () => {
    const view = initialView(terrain);
    const moved = panBy(view, terrain, W, H, 100, 0);
    expect(moved.centerU).toBeLessThan(view.centerU);
    expect(clampView({ centerU: 9999, centerV: -9999, zoom: 9 }, terrain)).toEqual({
      centerU: 288,
      centerV: -32,
      zoom: 4,
    });
  });

  it('escala gráfica redonda', () => {
    expect(scaleBarMeters(2)).toBe(50);
    expect(scaleBarMeters(0.5)).toBe(200);
    expect(scaleBarMeters(10)).toBe(10);
  });
});

describe('SatelliteRenderer', () => {
  it('desenha uma linha numerada por linha do plano, pontos, máscara e casco', () => {
    const r = new SatelliteRenderer(terrain, C00);
    expect(r.terrain).toBe(createTerrain(C00));
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    const points = [
      { id: 'GCP-01', kind: 'GCP' as const, u: 25, v: 20, elevM: 0, sigmaM: 0 },
      { id: 'GCP-02', kind: 'GCP' as const, u: 215, v: 20, elevM: 0, sigmaM: 0 },
      { id: 'GCP-03', kind: 'GCP' as const, u: 120, v: 140, elevM: 0, sigmaM: 0 },
      { id: 'CP-01', kind: 'CP' as const, u: 70, v: 50, elevM: 0, sigmaM: 0 },
    ];
    const stats = r.render(ctx, 800, 600, {
      view: initialView(terrain),
      lighting: 'GOLDEN_HOUR',
      plan,
      points,
      mask: new Uint8Array(ACCESS_GRID * ACCESS_GRID).fill(1),
      flash: { u: 10, v: 10 },
      hoverId: 'CP-01',
    });
    expect(stats).toEqual({ linesDrawn: plan.lines.length, pointsDrawn: 4 });
    for (let i = 1; i <= plan.lines.length; i++) {
      expect(ctx.fillText).toHaveBeenCalledWith(String(i), expect.any(Number), expect.any(Number));
    }
    // Cada iluminação tem sua camada de objetos; a mesma é reaproveitada.
    expect(r.litCanvas('GOLDEN_HOUR')).toBe(r.litCanvas('GOLDEN_HOUR'));
    expect(r.litCanvas('OVERCAST')).not.toBe(r.litCanvas('GOLDEN_HOUR'));
    expect(
      r.render(ctx, 800, 600, {
        view: initialView(terrain),
        lighting: 'SUN_HIGH',
        plan: null,
        points: [],
        mask: null,
      }),
    ).toEqual({
      linesDrawn: 0,
      pointsDrawn: 0,
    });
  });
});
