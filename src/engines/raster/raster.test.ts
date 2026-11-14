import { C00 } from '@/data/contracts';
import { mulberry32 } from '@/lib/rng';
import { createTerrain } from '@/world/terrain/createTerrain';
import {
  aoiRasterSize,
  hypsometricColor,
  hypsometricPixels,
  orthoPixels,
  rasterCanvas,
} from './orthoPreview';
import { cloudSamples, drawPipelineStage, VIZ_H, VIZ_W, type PipelineAssets } from './pipelineViz';

const terrain = createTerrain(C00);
const texts = {
  featuresPerImage: (n: string) => `f ${n}`,
  tiePoints: (n: string) => `t ${n}`,
  homogeneous: 'h',
  reprojection: 'r',
  iteration: 'i',
  points: (n: string) => `p ${n}`,
};

describe('orthoPreview', () => {
  it('256 px no lado maior da AOI; orto determinística, em cor ou cinza', () => {
    const size = aoiRasterSize(C00.aoi);
    expect(size).toEqual({ width: 256, height: 171 });
    expect(aoiRasterSize({ lengthM: 10, widthM: 20 })).toEqual({ width: 128, height: 256 });
    const small = { width: 24, height: 16 };
    const a = orthoPixels(terrain, small);
    expect(a).toHaveLength(24 * 16 * 4);
    expect(orthoPixels(terrain, small)).toEqual(a);
    const gray = orthoPixels(terrain, small, true);
    for (let k = 0; k < gray.length; k += 4) {
      expect(gray[k]).toBe(gray[k + 1]);
      expect(gray[k + 1]).toBe(gray[k + 2]);
    }
    expect(hypsometricPixels(terrain, small)).toHaveLength(24 * 16 * 4);
  });

  it('rampa hipsométrica do azul ao branco', () => {
    expect(hypsometricColor(0)).toEqual([37, 99, 235]);
    expect(hypsometricColor(1)[0]).toBeGreaterThan(240);
    expect(hypsometricColor(-1)).toEqual(hypsometricColor(0));
  });

  it('canvas em cache por terreno e tipo', () => {
    expect(rasterCanvas(terrain, 'GRAY')).toBe(rasterCanvas(terrain, 'GRAY'));
    expect(rasterCanvas(terrain, 'HYPSO')).not.toBe(rasterCanvas(terrain, 'GRAY'));
  });
});

describe('pipelineViz', () => {
  it('desenha as 7 etapas sem erro, com a nuvem 3D na etapa 4', () => {
    const ortho = rasterCanvas(terrain, 'ORTHO');
    const assets: PipelineAssets = {
      ortho,
      hypso: rasterCanvas(terrain, 'HYPSO'),
      orthoW: ortho.width,
      orthoH: ortho.height,
      aoi: C00.aoi,
      shots: [
        { u: 20, v: 20 },
        { u: 60, v: 20 },
        { u: 100, v: 20 },
      ],
      lines: [],
      cloud: cloudSamples(terrain, mulberry32(1), 200),
      objects: terrain.objects,
      roads: terrain.roads,
      homogeneous: true,
      lens: {
        fPx: 2380,
        cxPx: 1500,
        cyPx: 1125,
        k1: -0.12,
        k2: 0.03,
        p1: 0,
        p2: 0,
        reprojErrorPx: 0.4,
      },
      seed: 7,
    };
    expect(assets.cloud).toHaveLength(200);
    const ctx = document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D;
    for (let stage = 0; stage < 7; stage++) drawPipelineStage(ctx, assets, stage, 0.5, 1, texts);
    expect(ctx.fillText).toHaveBeenCalledWith('h', expect.any(Number), expect.any(Number));
    expect(ctx.fillText).toHaveBeenCalledWith('p 100', expect.any(Number), expect.any(Number));
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, VIZ_W, VIZ_H);
  });
});
