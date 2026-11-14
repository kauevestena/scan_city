import { C00 } from '@/data/contracts';
import { createTerrain } from '@/world/terrain/createTerrain';
import { COLORS } from '@/ui/tokens';
import {
  LAS_BYTES_PER_POINT,
  LAS_HEADER_BYTES,
  LIDAR_STAGES,
  drawLidarStage,
  formatBytes,
  lasSizeBytes,
  type LidarVizTexts,
} from './lidarViz';
import { rasterCanvas } from './orthoPreview';
import { VIZ_H, VIZ_W, type PipelineAssets } from './pipelineViz';
import { RETURN_COLORS } from './pointCloud';

const terrain = createTerrain(C00);
const texts: LidarVizTexts = {
  trajectory: (s) => `sbet ${s}`,
  georef: (n) => `geo ${n}`,
  discrepancy: 'disc',
  discrepancyRms: (c) => `rms ${c}`,
  classes: { FIRST: 'f1', INTERMEDIATE: 'fi', GROUND: 'fg' },
  las: (s) => `las ${s}`,
};

function assets(): PipelineAssets {
  const ortho = rasterCanvas(terrain, 'ORTHO');
  const rets = ['FIRST', 'INTERMEDIATE', 'GROUND'] as const;
  return {
    ortho,
    hypso: rasterCanvas(terrain, 'HYPSO'),
    orthoW: ortho.width,
    orthoH: ortho.height,
    aoi: C00.aoi,
    shots: [],
    lines: [
      { start: { u: 20, v: 20 }, end: { u: 220, v: 20 } },
      { start: { u: 220, v: 50 }, end: { u: 20, v: 50 } },
    ],
    cloud: [],
    objects: [],
    roads: [],
    homogeneous: false,
    lidar: {
      samples: Array.from({ length: 300 }, (_, k) => ({
        u: (k * 7.7) % C00.aoi.lengthM,
        v: (k * 3.3) % C00.aoi.widthM,
        z: (k % 20) / 4,
        ret: rets[k % 3] as 'FIRST',
      })),
      sigmaCm: 2.5,
      pulses: 4_000_000,
    },
    seed: 11,
  };
}

const ctxOf = () => document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D;
const texts2 = (ctx: CanvasRenderingContext2D) =>
  (ctx.fillText as unknown as { mock: { calls: unknown[][] } }).mock.calls.map(
    (c) => c[0] as string,
  );

describe('esteira LiDAR — visuais (§5.3)', () => {
  it('desenha as 6 etapas sem erro, limpando o canvas', () => {
    expect(LIDAR_STAGES).toBe(6);
    const ctx = ctxOf();
    for (let stage = 0; stage < LIDAR_STAGES; stage++)
      drawLidarStage(ctx, assets(), stage, 0.5, texts);
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, VIZ_W, VIZ_H);
  });

  it('1 trajetória: mostra o σ do SBET; 2 georreferenciamento: o contador de pontos cresce', () => {
    const a = assets();
    const ctx = ctxOf();
    drawLidarStage(ctx, a, 0, 1, texts);
    expect(texts2(ctx)).toContain('sbet 2,5');
    const c1 = ctxOf();
    drawLidarStage(c1, a, 1, 0.25, texts);
    const c2 = ctxOf();
    drawLidarStage(c2, a, 1, 1, texts);
    expect(texts2(c1)).toContain('geo 1.000.000');
    expect(texts2(c2)).toContain('geo 4.000.000');
  });

  it('3 ajuste entre faixas: a largura do histograma cai de 12 para 3 cm', () => {
    const start = ctxOf();
    drawLidarStage(start, assets(), 2, 0, texts);
    const end = ctxOf();
    drawLidarStage(end, assets(), 2, 1, texts);
    expect(texts2(start)).toContain('rms 12,0');
    expect(texts2(end)).toContain('rms 3,0');
  });

  it('4 classificação: os pontos passam de cinza à cor do retorno conforme a varredura avança', () => {
    const fills = (p: number) => {
      const ctx = ctxOf();
      const used = new Set<string>();
      Object.defineProperty(ctx, 'fillStyle', {
        set: (v: string) => used.add(v),
        get: () => '',
        configurable: true,
      });
      drawLidarStage(ctx, assets(), 3, p, texts);
      return used;
    };
    const early = fills(0);
    const late = fills(1);
    expect(early.has(RETURN_COLORS.GROUND)).toBe(true); // legenda
    expect(early.has(COLORS.textMuted)).toBe(true);
    expect(late.has(COLORS.textMuted)).toBe(false);
  });

  it('6 exportação: o tamanho do LAS cresce até 30 bytes por ponto mais o cabeçalho', () => {
    expect(lasSizeBytes(4_000_000)).toBe(LAS_HEADER_BYTES + 4_000_000 * LAS_BYTES_PER_POINT);
    expect(formatBytes(120_000_375)).toBe('120,0 MB');
    expect(formatBytes(2048)).toBe('2,0 kB');
    expect(formatBytes(12)).toBe('12 B');
    const half = ctxOf();
    drawLidarStage(half, assets(), 5, 0.5, texts);
    expect(texts2(half)).toContain('las 60,0 MB');
  });

  it('sem dados LiDAR, não quebra', () => {
    const a = { ...assets() };
    delete a.lidar;
    const ctx = ctxOf();
    for (let stage = 0; stage < LIDAR_STAGES; stage++) drawLidarStage(ctx, a, stage, 1, texts);
  });
});
