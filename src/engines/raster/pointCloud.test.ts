import { C00 } from '@/data/contracts';
import { createCoverageGrid } from '@/domain/coverage';
import type { LidarSample } from '@/types';
import { COLORS } from '@/ui/tokens';
import { createTerrain } from '@/world/terrain/createTerrain';
import { OrbitCamera } from '../soft3d/OrbitCamera';
import { Soft3DRenderer } from '../soft3d/Renderer';
import {
  CloudJob,
  MAX_CLOUD_POINTS,
  RETURN_COLORS,
  TIN_GRID,
  buildCloudScene,
  type CloudInputs,
} from './pointCloud';
import { PRODUCT_SIZE, type ProductRaster } from './products';

const terrain = createTerrain(C00);
const grid = createCoverageGrid(C00.aoi);
const coverage = {
  cols: grid.cols,
  rows: grid.rows,
  counts: grid.counts.map(() => 6),
  excludedCells: [] as number[],
};

function inputs(over: Partial<CloudInputs> = {}): CloudInputs {
  return { terrain, coverage, source: 'PHOTO', seed: 7, ...over };
}

function flatOrtho(rgb: [number, number, number]): ProductRaster {
  const rgba = new Uint8ClampedArray(PRODUCT_SIZE * PRODUCT_SIZE * 4);
  for (let k = 0; k < rgba.length; k += 4) {
    rgba[k] = rgb[0];
    rgba[k + 1] = rgb[1];
    rgba[k + 2] = rgb[2];
    rgba[k + 3] = 255;
  }
  return {
    kind: 'ORTHO',
    width: PRODUCT_SIZE,
    height: PRODUCT_SIZE,
    rgba,
    noData: new Uint8Array(PRODUCT_SIZE * PRODUCT_SIZE),
    hatched: new Uint8Array(PRODUCT_SIZE * PRODUCT_SIZE),
    range: { min: 0, max: 1 },
  };
}

function lidarSamples(n: number): LidarSample[] {
  const rets = ['FIRST', 'INTERMEDIATE', 'GROUND'] as const;
  return Array.from({ length: n }, (_, k) => ({
    u: (k * 7.3) % C00.aoi.lengthM,
    v: (k * 3.1) % C00.aoi.widthM,
    z: (k % 50) / 10,
    ret: rets[k % 3] as LidarSample['ret'],
  }));
}

describe('nuvem fotogramétrica', () => {
  it('até 30.000 pontos amostrados do MDS, com a cor da orto', () => {
    const scene = buildCloudScene(inputs({ ortho: flatOrtho([255, 0, 0]) }));
    expect(scene.pointCount).toBeLessThanOrEqual(MAX_CLOUD_POINTS);
    expect(scene.pointCount).toBeGreaterThan(MAX_CLOUD_POINTS * 0.95);
    expect(scene.points.reduce((s, p) => s + p.positions.length / 3, 0)).toBe(scene.pointCount);
    // Uma única cor na orto: um único balde, com o vermelho quantizado.
    expect(scene.points).toHaveLength(1);
    expect(scene.points[0]?.color).toBe('rgb(255, 0, 0)');
  });

  it('sem orto, as cores vêm da altura (várias faixas)', () => {
    const scene = buildCloudScene(inputs());
    expect(scene.points.length).toBeGreaterThan(1);
  });

  it('só onde há dados: células sem foto ou excluídas não geram pontos', () => {
    const counts = grid.counts.map((_, k) => (k % grid.cols < 32 ? 6 : 0));
    const scene = buildCloudScene(inputs({ coverage: { ...coverage, counts } }));
    const xs = scene.points.flatMap((p) => Array.from(p.positions).filter((_, i) => i % 3 === 0));
    // Só a metade oeste (x < 0 na cena).
    expect(Math.max(...xs)).toBeLessThanOrEqual(0.001);
    expect(scene.pointCount).toBeGreaterThan(MAX_CLOUD_POINTS * 0.4);
    expect(scene.pointCount).toBeLessThan(MAX_CLOUD_POINTS * 0.6);
  });

  it('é determinística pela seed', () => {
    const a = buildCloudScene(inputs());
    const b = buildCloudScene(inputs());
    expect(Array.from(a.points[0]?.positions ?? [])).toEqual(
      Array.from(b.points[0]?.positions ?? []),
    );
    const c = buildCloudScene(inputs({ seed: 8 }));
    expect(Array.from(c.points[0]?.positions ?? [])).not.toEqual(
      Array.from(a.points[0]?.positions ?? []),
    );
  });
});

describe('nuvem LiDAR', () => {
  it('colorida por retorno: 1º ciano, intermediário violeta, solo verde', () => {
    expect(RETURN_COLORS).toEqual({
      FIRST: COLORS.radar,
      INTERMEDIATE: COLORS.rift,
      GROUND: COLORS.ok,
    });
    const scene = buildCloudScene(inputs({ source: 'LIDAR', lidarSamples: lidarSamples(300) }));
    expect(scene.points.map((p) => p.color)).toEqual([COLORS.radar, COLORS.rift, COLORS.ok]);
    expect(scene.byReturn).toEqual({ FIRST: 100, INTERMEDIATE: 100, GROUND: 100 });
    expect(scene.pointCount).toBe(300);
  });

  it('50.000 amostras (limite da missão) são reduzidas a no máximo 30.000, em passo regular', () => {
    const scene = buildCloudScene(inputs({ source: 'LIDAR', lidarSamples: lidarSamples(50_000) }));
    expect(scene.pointCount).toBeLessThanOrEqual(MAX_CLOUD_POINTS);
    expect(scene.pointCount).toBeGreaterThan(20_000);
    const { FIRST, INTERMEDIATE, GROUND } = scene.byReturn ?? {
      FIRST: 0,
      INTERMEDIATE: 0,
      GROUND: 0,
    };
    expect(FIRST + INTERMEDIATE + GROUND).toBe(scene.pointCount);
  });

  it('sem amostras: cena vazia, mas a malha TIN existe', () => {
    const scene = buildCloudScene(inputs({ source: 'LIDAR', lidarSamples: [] }));
    expect(scene.pointCount).toBe(0);
    expect(scene.points).toEqual([]);
    expect(scene.tin.segments.length).toBeGreaterThan(0);
  });
});

describe('malha TIN', () => {
  it('(64 + 1)² vértices e as arestas horizontais, verticais e diagonais de 64 × 64 células', () => {
    const { tin } = buildCloudScene(inputs());
    const n = TIN_GRID + 1;
    expect(tin.positions).toHaveLength(n * n * 3);
    expect(tin.segments).toHaveLength((n * TIN_GRID * 2 + TIN_GRID * TIN_GRID) * 2);
    expect(tin.color).toBe(COLORS.radar);
  });

  it('a elevação dos vértices é a do MDS e a cena cabe em [−1, 1]', () => {
    const scene = buildCloudScene(inputs());
    const { tin, zRange } = scene;
    for (let k = 0; k < tin.positions.length; k += 3) {
      expect(Math.abs(tin.positions[k] as number)).toBeLessThanOrEqual(1 + 1e-6);
      expect(Math.abs(tin.positions[k + 2] as number)).toBeLessThanOrEqual(1 + 1e-6);
    }
    expect(zRange.max).toBeGreaterThanOrEqual(zRange.min);
    // Vértice (0, 0): elevação do MDS no canto da AOI.
    const s = Math.max(C00.aoi.lengthM, C00.aoi.widthM) / 2;
    const mid = (zRange.min + zRange.max) / 2;
    expect(tin.positions[1]).toBeCloseTo(
      ((terrain.surface(0, 0) - mid) / s) * scene.exaggeration,
      4,
    );
  });

  it('relevo plano ganha exagero vertical para ficar visível, limitado a ×10', () => {
    const scene = buildCloudScene(inputs());
    expect(scene.exaggeration).toBeGreaterThanOrEqual(1);
    expect(scene.exaggeration).toBeLessThanOrEqual(10);
  });
});

describe('fatias', () => {
  it('cada fatia de 4 ms dura < 8 ms e o resultado não depende do fatiamento', () => {
    const worstSlice = () => {
      const job = new CloudJob(inputs());
      let worst = 0;
      while (!job.done) {
        const t0 = performance.now();
        job.runSlice(4);
        worst = Math.max(worst, performance.now() - t0);
      }
      return { worst, job };
    };
    // Com a suíte em paralelo, um pico de CPU ou de GC pode estourar uma fatia: vale a melhor de 3.
    const runs = [worstSlice(), worstSlice(), worstSlice()];
    expect(Math.min(...runs.map((r) => r.worst))).toBeLessThan(8);
    const job = (runs[0] as (typeof runs)[number]).job;
    expect(job.progress).toBe(1);
    const tiny = new CloudJob(inputs());
    while (!tiny.done) tiny.runSlice(0);
    expect(Array.from(tiny.result.tin.positions)).toEqual(Array.from(job.result.tin.positions));
    expect(tiny.result.pointCount).toBe(job.result.pointCount);
  });
});

describe('30.000 pontos a ≥ 50 FPS', () => {
  it('projetar e desenhar a nuvem cheia leva < 20 ms por quadro', () => {
    const scene = buildCloudScene(inputs({ ortho: flatOrtho([90, 140, 70]) }));
    const ctx = new Proxy(
      {},
      { get: () => () => undefined, set: () => true },
    ) as unknown as CanvasRenderingContext2D;
    const renderer = new Soft3DRenderer();
    const camera = new OrbitCamera(scene.radius);
    renderer.render(ctx, 1280, 720, camera.matrix(16 / 9), [], [scene.tin], scene.points);
    const frames = 20;
    const t0 = performance.now();
    for (let f = 0; f < frames; f++) {
      camera.orbit(0.02, 0);
      renderer.render(ctx, 1280, 720, camera.matrix(16 / 9), [], [scene.tin], scene.points);
    }
    const perFrame = (performance.now() - t0) / frames;
    expect(scene.pointCount).toBeGreaterThan(29_000);
    expect(perFrame).toBeLessThan(20);
  });
});
