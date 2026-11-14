import { C00 } from '@/data/contracts';
import { createCoverageGrid } from '@/domain/coverage';
import type { LightingId } from '@/types';
import { createTerrain } from '@/world/terrain/createTerrain';
import {
  CANOPY_BLOCKS_GROUND,
  NDVI_BINS,
  PRODUCT_KINDS,
  PRODUCT_SIZE,
  ProductJob,
  generateProduct,
  ndviColor,
  type ProductInputs,
} from './products';

const terrain = createTerrain(C00);
const grid = createCoverageGrid(C00.aoi);

function inputs(over: Partial<ProductInputs> & { counts?: number[] } = {}): ProductInputs {
  const { counts, ...rest } = over;
  return {
    terrain,
    coverage: {
      cols: grid.cols,
      rows: grid.rows,
      counts: counts ?? grid.counts.map(() => 6),
      excludedCells: [],
    },
    lighting: 'SUN_HIGH' as LightingId,
    rmseZM: 0.1,
    seed: 1234,
    ...rest,
  };
}

const pixel = (r: { rgba: Uint8ClampedArray }, i: number, j: number) =>
  Array.from(r.rgba.slice((j * PRODUCT_SIZE + i) * 4, (j * PRODUCT_SIZE + i) * 4 + 3));
const sum = (a: ArrayLike<number>) => Array.from(a).reduce((s, v) => s + v, 0);

describe('dimensões e determinismo', () => {
  it.each(PRODUCT_KINDS)('%s: 256 × 256, RGBA completo e opaco', (kind) => {
    const r = generateProduct(kind, inputs());
    expect(r).toMatchObject({ kind, width: 256, height: 256 });
    expect(r.rgba).toHaveLength(256 * 256 * 4);
    expect(r.noData).toHaveLength(256 * 256);
    for (let k = 3; k < r.rgba.length; k += 4) if (r.rgba[k] !== 255) throw new Error(`alfa ${k}`);
  });

  it.each(PRODUCT_KINDS)('%s: mesma entrada → mesmo raster; outra seed muda o ruído', (kind) => {
    const a = generateProduct(kind, inputs());
    const b = generateProduct(kind, inputs());
    expect(Array.from(a.rgba)).toEqual(Array.from(b.rgba));
    // Na orto o ruído só aparece nas células vermelhas (< 3 fotos).
    const counts = kind === 'ORTHO' ? grid.counts.map(() => 2) : undefined;
    const c = generateProduct(kind, inputs({ seed: 99, ...(counts ? { counts } : {}) }));
    const d = generateProduct(kind, inputs({ ...(counts ? { counts } : {}) }));
    expect(Array.from(c.rgba)).not.toEqual(Array.from(d.rgba));
  });

  it('fatias de tempo não alteram o resultado', () => {
    for (const kind of PRODUCT_KINDS) {
      const job = new ProductJob(kind, inputs());
      let slices = 0;
      while (!job.done) {
        job.runSlice(0); // 1 tarefa por fatia, o extremo
        slices++;
      }
      expect(slices).toBeGreaterThan(256);
      expect(Array.from(job.raster.rgba)).toEqual(Array.from(generateProduct(kind, inputs()).rgba));
    }
  });
});

describe('fatias sem travar', () => {
  /** Pior fatia de uma geração completa, em ms. */
  const worstSlice = (kind: (typeof PRODUCT_KINDS)[number]) => {
    const job = new ProductJob(kind, inputs({ lighting: 'GOLDEN_HOUR' }));
    let worst = 0;
    let last = -1;
    while (!job.done) {
      const t0 = performance.now();
      job.runSlice(4);
      worst = Math.max(worst, performance.now() - t0);
      expect(job.progress).toBeGreaterThanOrEqual(last);
      last = job.progress;
    }
    expect(job.progress).toBe(1);
    return worst;
  };

  it('cada fatia de 4 ms dura menos de 8 ms, e o progresso chega a 1', () => {
    for (const kind of PRODUCT_KINDS) {
      // Com a suíte inteira em paralelo, um pico de CPU ou de GC pode estourar uma fatia:
      // vale a melhor de 3 gerações.
      const best = Math.min(worstSlice(kind), worstSlice(kind), worstSlice(kind));
      expect(best, kind).toBeLessThan(8);
    }
  });
});

describe('máscaras de sem-dados e hachuras', () => {
  it('células sem foto ou excluídas (água) ficam em xadrez cinza, no ORTHO, MDS, MDT e NDVI', () => {
    const counts = grid.counts.map(() => 6);
    counts[0] = 0; // canto (0,0): 4 × 4 pixels
    const excluded = 5 * grid.cols + 10;
    for (const kind of PRODUCT_KINDS) {
      const r = generateProduct(
        kind,
        inputs({ counts, coverage: undefined } as never) && {
          ...inputs({ counts }),
          coverage: { ...inputs({ counts }).coverage, excludedCells: [excluded] },
        },
      );
      expect(r.noData[0], kind).toBe(1);
      expect(r.noData[1 * 256 + 1], kind).toBe(1);
      // O xadrez alterna a cada 8 pixels: os dois tons são cinza puro.
      const [r0, g0, b0] = pixel(r, 0, 0) as [number, number, number];
      expect(r0 === g0 && g0 === b0).toBe(true);
      // A célula excluída: pixel no centro dela.
      const ei = (excluded % grid.cols) * 4 + 1;
      const ej = Math.floor(excluded / grid.cols) * 4 + 1;
      expect(r.noData[ej * 256 + ei], kind).toBe(1);
      // E há dados no resto.
      expect(sum(r.noData)).toBe(2 * 16);
    }
  });

  it('MDT sem LiDAR: sob dossel > 0,6 fica hachurado; só em células com dados', () => {
    const r = generateProduct('DTM', inputs());
    let expected = 0;
    for (let j = 0; j < 256; j++) {
      for (let i = 0; i < 256; i++) {
        const u = ((i + 0.5) * C00.aoi.lengthM) / 256;
        const v = ((j + 0.5) * C00.aoi.widthM) / 256;
        const h = terrain.canopy(u, v) > CANOPY_BLOCKS_GROUND ? 1 : 0;
        expect(r.hatched[j * 256 + i]).toBe(h);
        expected += h;
      }
    }
    // O C00 tem alguma mata para a hachura aparecer.
    expect(expected).toBeGreaterThan(0);
  });

  it('MDT com LiDAR: o solo denso tira a hachura; sem retornos de solo sob a mata, mantém', () => {
    const dense = generateProduct('DTM', inputs({ lidarGroundDensity: grid.counts.map(() => 20) }));
    expect(sum(dense.hatched)).toBe(0);
    const sparse = generateProduct('DTM', inputs({ lidarGroundDensity: grid.counts.map(() => 0) }));
    expect(sum(sparse.hatched)).toBe(sum(generateProduct('DTM', inputs()).hatched));
  });

  it('MDT com pouco solo é suavizado: relevo mais liso que com solo denso', () => {
    const rough = (r: ReturnType<typeof generateProduct>) => {
      let s = 0;
      for (let k = 0; k < r.rgba.length - 8; k += 4)
        s += Math.abs((r.rgba[k] as number) - (r.rgba[k + 4] as number));
      return s;
    };
    const dense = generateProduct(
      'DTM',
      inputs({ lidarGroundDensity: grid.counts.map(() => 20), rmseZM: 2 }),
    );
    const thin = generateProduct(
      'DTM',
      inputs({ lidarGroundDensity: grid.counts.map(() => 0.2), rmseZM: 2 }),
    );
    expect(rough(thin)).toBeLessThan(rough(dense));
  });
});

describe('conteúdo de cada produto', () => {
  it('ortofoto: células vermelhas (< 3 fotos) saem borradas e ruidosas; verdes, limpas', () => {
    const base = grid.counts.map(() => 6);
    const red = base.map((c, k) => (k % grid.cols < 32 ? 2 : c));
    const clean = generateProduct('ORTHO', inputs({ counts: base }));
    const noisy = generateProduct('ORTHO', inputs({ counts: red }));
    // Metade esquerda difere; a direita é idêntica.
    let leftDiff = 0;
    let rightDiff = 0;
    for (let j = 0; j < 256; j++) {
      for (let i = 0; i < 256; i++) {
        const same = pixel(clean, i, j).join() === pixel(noisy, i, j).join();
        if (!same) {
          if (i < 128) leftDiff++;
          else rightDiff++;
        }
      }
    }
    expect(leftDiff).toBeGreaterThan(128 * 256 * 0.5);
    expect(rightDiff).toBe(0);
  });

  it('ortofoto: o pôr do sol dourado escurece (sombras longas e tom quente) frente ao sol a pino', () => {
    const lum = (r: ReturnType<typeof generateProduct>) => {
      let s = 0;
      for (let k = 0; k < r.rgba.length; k += 4)
        s += (r.rgba[k] as number) + (r.rgba[k + 1] as number) + (r.rgba[k + 2] as number);
      return s;
    };
    const high = lum(generateProduct('ORTHO', inputs({ lighting: 'SUN_HIGH' })));
    const golden = lum(generateProduct('ORTHO', inputs({ lighting: 'GOLDEN_HOUR' })));
    expect(golden).toBeLessThan(high);
  });

  it('MDS: rampa hipsométrica, com o ponto baixo azulado e o alto claro; faixa em metros', () => {
    const r = generateProduct('DSM', inputs({ rmseZM: 0 }));
    expect(r.range.max - r.range.min).toBeGreaterThan(1);
    const px = (k: number) =>
      [r.rgba[k * 4], r.rgba[k * 4 + 1], r.rgba[k * 4 + 2]] as [number, number, number];
    let bluish = 0;
    let bright = 0;
    for (let k = 0; k < 256 * 256; k++) {
      const [pr, pg, pb] = px(k);
      if (pb > pr + 40 && pb > pg) bluish++;
      if (pr + pg + pb > 600) bright++;
    }
    expect(bluish).toBeGreaterThan(0);
    expect(bright).toBeGreaterThan(0);
  });

  it('MDS reflete o RMSE_z: com ruído maior, o raster fica mais rugoso', () => {
    const rough = (r: ReturnType<typeof generateProduct>) => {
      let s = 0;
      for (let k = 0; k < r.rgba.length - 8; k += 4)
        s += Math.abs((r.rgba[k] as number) - (r.rgba[k + 4] as number));
      return s;
    };
    expect(rough(generateProduct('DSM', inputs({ rmseZM: 3 })))).toBeGreaterThan(
      rough(generateProduct('DSM', inputs({ rmseZM: 0 }))),
    );
  });

  it('NDVI: rampa vermelho → amarelo → verde; o histograma soma os pixels com dados', () => {
    const [rr, rg] = ndviColor(-0.2);
    const [yr, yg] = ndviColor(0.3);
    const [gr, gg] = ndviColor(0.9);
    expect(rr).toBeGreaterThan(rg);
    expect(yr).toBeGreaterThan(200);
    expect(yg).toBeGreaterThan(180);
    expect(gg).toBeGreaterThan(gr);
    const counts = grid.counts.map(() => 6);
    counts[0] = 0;
    const r = generateProduct('NDVI', inputs({ counts }));
    expect(r.histogram).toHaveLength(NDVI_BINS);
    expect(sum(r.histogram ?? [])).toBe(256 * 256 - sum(r.noData));
    expect(r.range.min).toBeGreaterThanOrEqual(-0.2 - 1e-6);
    expect(r.range.max).toBeLessThanOrEqual(0.9 + 1e-6);
  });
});
