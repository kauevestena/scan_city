/**
 * Rasters de produto (processing-results §5.7): Ortofoto, MDS, MDT e NDVI, 256 × 256 sobre a
 * AOI, gerados do mesmo `TerrainSampler` do voo e mascarados pela cobertura da missão.
 * Tudo é determinístico (ruído por hash da seed da missão) e sem DOM. A geração roda em fatias
 * de tempo limitado (`ProductJob.runSlice`), para a tela não travar.
 */
import { shadowLengthM } from '@/domain/flightPhysics';
import { hash2 } from '@/lib/rng';
import { clamp } from '@/lib/math';
import type { CoverageResult, LightingId } from '@/types';
import type { TerrainSampler } from '@/world/terrain/TerrainSampler';
import { HILLSHADE, hillshadeFactor } from '@/engines/field/satellite';
import { castsShadow } from '@/engines/flight/terrainRenderer';
import { hypsometricColor } from './orthoPreview';

export const PRODUCT_SIZE = 256;
export const PRODUCT_KINDS = ['ORTHO', 'DSM', 'DTM', 'NDVI'] as const;
export type ProductKind = (typeof PRODUCT_KINDS)[number];

/** Células com menos fotos que isto ficam "vermelhas" (ruído e borrão na orto). */
const RED_BELOW = 3;
/** Dossel acima do qual o solo não é visto sem LiDAR (terrain §2). */
export const CANOPY_BLOCKS_GROUND = 0.6;
/** Densidade de solo (pts/m²) abaixo da qual o MDT do LiDAR é suavizado. */
export const SMOOTH_BELOW_GROUND_DENSITY = 1;
/** Faixa e rampa do NDVI (§5.7): vermelho (−0,2) → amarelo (0,3) → verde (0,9). */
export const NDVI_MIN = -0.2;
export const NDVI_MID = 0.3;
export const NDVI_MAX = 0.9;
export const NDVI_BINS = 22;

export interface ProductInputs {
  terrain: TerrainSampler;
  /** Contagem de fotos válidas por célula (grade 64 × 64) e células excluídas. */
  coverage: Pick<CoverageResult, 'cols' | 'rows' | 'counts' | 'excludedCells'>;
  lighting: LightingId;
  /** RMSE_z do relatório, em m: ruído do MDS. */
  rmseZM: number;
  seed: number;
  /** Densidade de solo (pts/m²) por célula da grade de cobertura, se a missão tem LiDAR. */
  lidarGroundDensity?: readonly number[];
}

export interface ProductRaster {
  kind: ProductKind;
  width: number;
  height: number;
  rgba: Uint8ClampedArray;
  /** 1 = sem dados (xadrez cinza). */
  noData: Uint8Array;
  /** 1 = interpolado / sem dados de solo (hachura). */
  hatched: Uint8Array;
  /** Faixa do valor mostrado (m para MDS/MDT; índice para o NDVI). */
  range: { min: number; max: number };
  /** NDVI: contagem por faixa (`NDVI_BINS` entre `NDVI_MIN` e `NDVI_MAX`). */
  histogram?: number[];
}

type Rgb = readonly [number, number, number];

/** Rampa NDVI: vermelho → amarelo → verde. */
const NDVI_RED: Rgb = [220, 38, 38];
const NDVI_YELLOW: Rgb = [250, 204, 21];
const NDVI_GREEN: Rgb = [22, 163, 74];
const CHECK_A: Rgb = [128, 128, 128];
const CHECK_B: Rgb = [96, 96, 96];
const HATCH: Rgb = [15, 23, 42];

const lerp3 = (a: Rgb, b: Rgb, t: number): [number, number, number] => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

export function ndviColor(value: number): [number, number, number] {
  if (value <= NDVI_MID) {
    return lerp3(NDVI_RED, NDVI_YELLOW, clamp((value - NDVI_MIN) / (NDVI_MID - NDVI_MIN), 0, 1));
  }
  return lerp3(NDVI_YELLOW, NDVI_GREEN, clamp((value - NDVI_MID) / (NDVI_MAX - NDVI_MID), 0, 1));
}

/** Ruído triangular em [−1, 1], determinístico pela posição e pela seed. */
function noise(i: number, j: number, seed: number, channel = 0): number {
  return hash2(i, j + channel * 4096, seed) + hash2(j, i + 7, seed ^ 0x9e3779b9) - 1;
}

/** Direção da sombra: oposta ao sol de NO, para SE (a mesma da vista de satélite). */
const SHADOW_DIR = (() => {
  const az = (HILLSHADE.azimuthDeg * Math.PI) / 180;
  return { u: -Math.sin(az), v: Math.cos(az) };
})();

/** O fator luminoso do relevo por iluminação: luz difusa achata o relevo. */
function reliefLight(k: number, lighting: LightingId): number {
  if (lighting === 'OVERCAST') return 0.78 + 0.22 * Math.min(1, k);
  return k;
}

const GOLDEN_TINT: Rgb = [1.06, 0.95, 0.82];

export class ProductJob {
  readonly kind: ProductKind;
  private readonly inputs: ProductInputs;
  private readonly tasks: Array<() => void> = [];
  private next = 0;
  private readonly size = PRODUCT_SIZE;
  private readonly du: number;
  private readonly dv: number;
  private readonly rgba: Uint8ClampedArray;
  private readonly noData: Uint8Array;
  private readonly hatched: Uint8Array;
  /** Altura (m) amostrada por pixel (MDS/MDT) e valor do NDVI. */
  private readonly values: Float32Array;
  private readonly shadow: Uint8Array;
  private range = { min: 0, max: 1 };
  private histogram: number[] | undefined;
  private readonly excluded: ReadonlySet<number>;

  constructor(kind: ProductKind, inputs: ProductInputs) {
    this.kind = kind;
    this.inputs = inputs;
    const { aoi } = inputs.terrain;
    const n = this.size;
    this.du = aoi.lengthM / n;
    this.dv = aoi.widthM / n;
    this.rgba = new Uint8ClampedArray(n * n * 4);
    this.noData = new Uint8Array(n * n);
    this.hatched = new Uint8Array(n * n);
    this.values = new Float32Array(n * n);
    this.shadow = new Uint8Array(n * n);
    this.excluded = new Set(inputs.coverage.excludedCells);
    this.plan();
  }

  /** Fração concluída, 0..1. */
  get progress(): number {
    return this.tasks.length === 0 ? 1 : this.next / this.tasks.length;
  }

  get done(): boolean {
    return this.next >= this.tasks.length;
  }

  /**
   * Trabalha até `budgetMs` (relógio injetável, para teste) e devolve quantas tarefas fez.
   * Cada tarefa é uma linha do raster ou um objeto de sombra, bem menor que a fatia.
   */
  runSlice(budgetMs = 4, now: () => number = () => performance.now()): number {
    const start = now();
    let ran = 0;
    while (!this.done) {
      (this.tasks[this.next] as () => void)();
      this.next++;
      ran++;
      if (now() - start >= budgetMs) break;
    }
    return ran;
  }

  /** Raster pronto; só vale com `done`. */
  get raster(): ProductRaster {
    return {
      kind: this.kind,
      width: this.size,
      height: this.size,
      rgba: this.rgba,
      noData: this.noData,
      hatched: this.hatched,
      range: this.range,
      ...(this.histogram ? { histogram: this.histogram } : {}),
    };
  }

  // --- Plano de tarefas ----------------------------------------------------------------

  private plan(): void {
    const n = this.size;
    const { kind } = this;
    if (kind === 'ORTHO') this.planShadows();
    for (let j = 0; j < n; j++) this.tasks.push(() => this.sampleRow(j));
    if (kind === 'DSM' || kind === 'DTM') {
      this.tasks.push(() => this.findRange());
      for (let j = 0; j < n; j++) this.tasks.push(() => this.paintHeightRow(j));
    } else if (kind === 'NDVI') {
      this.tasks.push(() => this.buildHistogram());
    }
  }

  /** Índice da célula da grade de cobertura sob o pixel (i, j). */
  private cellOf(i: number, j: number): number {
    const { cols, rows } = this.inputs.coverage;
    const ci = Math.min(cols - 1, Math.floor((i / this.size) * cols));
    const cj = Math.min(rows - 1, Math.floor((j / this.size) * rows));
    return cj * cols + ci;
  }

  private photoCount(cell: number): number {
    return this.excluded.has(cell) ? 0 : (this.inputs.coverage.counts[cell] ?? 0);
  }

  private put(i: number, j: number, c: Rgb): void {
    const o = (j * this.size + i) * 4;
    this.rgba[o] = c[0];
    this.rgba[o + 1] = c[1];
    this.rgba[o + 2] = c[2];
    this.rgba[o + 3] = 255;
  }

  /** Xadrez cinza das áreas sem dados. */
  private putNoData(i: number, j: number): void {
    this.noData[j * this.size + i] = 1;
    this.put(i, j, ((i >> 3) + (j >> 3)) % 2 === 0 ? CHECK_A : CHECK_B);
  }

  // --- Sombras longas da orto (só com sol) -------------------------------------------

  private planShadows(): void {
    const { terrain, lighting } = this.inputs;
    const objects = terrain.objects.filter((o) => castsShadow(o.kind));
    // Um objeto por tarefa: uma sombra longa já cobre milhares de pixels.
    for (const o of objects) {
      this.tasks.push(() => {
        const len = shadowLengthM(o.heightM + (o.baseM ?? 0), lighting);
        if (len > 0) this.castShadow(o.u, o.v, o.widthM, o.depthM, len);
      });
    }
  }

  /** Marca a sombra de uma caixa: a pegada deslocada `len` m para SE. */
  private castShadow(u: number, v: number, widthM: number, depthM: number, len: number): void {
    const { du, dv, size } = this;
    const halfW = Math.max(widthM, depthM) / 2;
    const eu = u + SHADOW_DIR.u * len;
    const ev = v + SHADOW_DIR.v * len;
    const i0 = Math.max(0, Math.floor((Math.min(u, eu) - halfW) / du));
    const i1 = Math.min(size - 1, Math.ceil((Math.max(u, eu) + halfW) / du));
    const j0 = Math.max(0, Math.floor((Math.min(v, ev) - halfW) / dv));
    const j1 = Math.min(size - 1, Math.ceil((Math.max(v, ev) + halfW) / dv));
    const sx = eu - u;
    const sy = ev - v;
    const l2 = sx * sx + sy * sy || 1;
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const pu = (i + 0.5) * du - u;
        const pv = (j + 0.5) * dv - v;
        const t = clamp((pu * sx + pv * sy) / l2, 0, 1);
        if (Math.hypot(pu - t * sx, pv - t * sy) <= halfW) this.shadow[j * size + i] = 1;
      }
    }
  }

  // --- Amostragem por linha ----------------------------------------------------------

  private sampleRow(j: number): void {
    for (let i = 0; i < this.size; i++) {
      if (this.kind === 'ORTHO') this.sampleOrtho(i, j);
      else if (this.kind === 'DSM') this.sampleDsm(i, j);
      else if (this.kind === 'DTM') this.sampleDtm(i, j);
      else this.sampleNdvi(i, j);
    }
  }

  private colorAt(u: number, v: number): Rgb {
    const { terrain } = this.inputs;
    return terrain.palette.cover[terrain.landCover(u, v)];
  }

  private sampleOrtho(i: number, j: number): void {
    const { terrain, lighting, seed } = this.inputs;
    const count = this.photoCount(this.cellOf(i, j));
    if (count === 0) return this.putNoData(i, j);
    const u = (i + 0.5) * this.du;
    const v = (j + 0.5) * this.dv;
    let [r, g, b] = this.colorAt(u, v) as [number, number, number];
    const cover = terrain.landCover(u, v);
    const dzdu =
      (terrain.surface(u + this.du, v) - terrain.surface(u - this.du, v)) / (2 * this.du);
    const dzdv =
      (terrain.surface(u, v + this.dv) - terrain.surface(u, v - this.dv)) / (2 * this.dv);
    let k = cover === 'WATER' ? 1 : reliefLight(hillshadeFactor(dzdu, dzdv), lighting);
    if (this.shadow[j * this.size + i]) k *= 0.55;
    if (count < RED_BELOW) {
      // Célula vermelha: borrão (média ao longo de u) e ruído.
      const a = this.colorAt(u - 3 * this.du, v);
      const c = this.colorAt(u + 3 * this.du, v);
      r = (r + a[0] + c[0]) / 3;
      g = (g + a[1] + c[1]) / 3;
      b = (b + a[2] + c[2]) / 3;
      const nz = 40 * noise(i, j, seed);
      r += nz;
      g += nz;
      b += nz;
    }
    const tint = lighting === 'GOLDEN_HOUR' ? GOLDEN_TINT : [1, 1, 1];
    this.put(i, j, [
      r * k * (tint[0] as number),
      g * k * (tint[1] as number),
      b * k * (tint[2] as number),
    ]);
  }

  private sampleDsm(i: number, j: number): void {
    const { terrain, rmseZM, seed } = this.inputs;
    const idx = j * this.size + i;
    if (this.photoCount(this.cellOf(i, j)) === 0) {
      this.noData[idx] = 1;
      this.values[idx] = NaN;
      return;
    }
    const u = (i + 0.5) * this.du;
    const v = (j + 0.5) * this.dv;
    this.values[idx] = terrain.surface(u, v) + rmseZM * noise(i, j, seed, 1);
  }

  private sampleDtm(i: number, j: number): void {
    const { terrain, seed, rmseZM, lidarGroundDensity } = this.inputs;
    const idx = j * this.size + i;
    const cell = this.cellOf(i, j);
    if (this.photoCount(cell) === 0) {
      this.noData[idx] = 1;
      this.values[idx] = NaN;
      return;
    }
    const u = (i + 0.5) * this.du;
    const v = (j + 0.5) * this.dv;
    this.values[idx] = terrain.elevation(u, v) + 0.5 * rmseZM * noise(i, j, seed, 2);
    const canopy = terrain.canopy(u, v);
    if (lidarGroundDensity) {
      const ground = lidarGroundDensity[cell] ?? 0;
      // Sem retornos de solo sob o dossel: o MDT é interpolado.
      if (ground < SMOOTH_BELOW_GROUND_DENSITY && canopy > CANOPY_BLOCKS_GROUND) {
        this.hatched[idx] = 1;
      }
    } else if (canopy > CANOPY_BLOCKS_GROUND) {
      this.hatched[idx] = 1;
    }
  }

  private sampleNdvi(i: number, j: number): void {
    const { terrain, seed } = this.inputs;
    const idx = j * this.size + i;
    if (this.photoCount(this.cellOf(i, j)) === 0) return this.putNoData(i, j);
    const u = (i + 0.5) * this.du;
    const v = (j + 0.5) * this.dv;
    const value = clamp(terrain.ndvi(u, v) + 0.02 * noise(i, j, seed, 3), NDVI_MIN, NDVI_MAX);
    this.values[idx] = value;
    this.put(i, j, ndviColor(value));
  }

  // --- Pintura (MDS/MDT) e histograma (NDVI) -----------------------------------------

  private findRange(): void {
    let min = Infinity;
    let max = -Infinity;
    for (const z of this.values) {
      if (Number.isNaN(z)) continue;
      if (z < min) min = z;
      if (z > max) max = z;
    }
    this.range = Number.isFinite(min) ? { min, max } : { min: 0, max: 1 };
  }

  private zAt(i: number, j: number): number {
    const n = this.size;
    return this.values[clamp(j, 0, n - 1) * n + clamp(i, 0, n - 1)] as number;
  }

  private paintHeightRow(j: number): void {
    const { range } = this;
    const span = Math.max(1e-6, range.max - range.min);
    const { lighting, lidarGroundDensity } = this.inputs;
    for (let i = 0; i < this.size; i++) {
      const idx = j * this.size + i;
      if (this.noData[idx]) {
        this.putNoData(i, j);
        continue;
      }
      let z = this.values[idx] as number;
      if (this.kind === 'DTM' && lidarGroundDensity) {
        // Abaixo de 1 pt/m² de solo, o MDT é suavizado (média 3 × 3).
        if ((lidarGroundDensity[this.cellOf(i, j)] ?? 0) < SMOOTH_BELOW_GROUND_DENSITY) {
          let sum = 0;
          let cnt = 0;
          for (let dj = -1; dj <= 1; dj++) {
            for (let di = -1; di <= 1; di++) {
              const q = this.zAt(i + di, j + dj);
              if (!Number.isNaN(q)) {
                sum += q;
                cnt++;
              }
            }
          }
          z = sum / Math.max(1, cnt);
        }
      }
      const dzdu = (this.zAt(i + 1, j) - this.zAt(i - 1, j)) / (2 * this.du);
      const dzdv = (this.zAt(i, j + 1) - this.zAt(i, j - 1)) / (2 * this.dv);
      const k = reliefLight(
        hillshadeFactor(Number.isNaN(dzdu) ? 0 : dzdu, Number.isNaN(dzdv) ? 0 : dzdv),
        lighting,
      );
      const [r, g, b] = hypsometricColor((z - range.min) / span);
      this.put(i, j, [r * k, g * k, b * k]);
      if (this.hatched[idx] && (i + j) % 6 < 2) this.put(i, j, HATCH);
    }
  }

  private buildHistogram(): void {
    const bins = new Array<number>(NDVI_BINS).fill(0);
    let min = Infinity;
    let max = -Infinity;
    this.values.forEach((value, idx) => {
      if (this.noData[idx]) return;
      const b = clamp(
        Math.floor(((value - NDVI_MIN) / (NDVI_MAX - NDVI_MIN)) * NDVI_BINS),
        0,
        NDVI_BINS - 1,
      );
      bins[b] = (bins[b] as number) + 1;
      if (value < min) min = value;
      if (value > max) max = value;
    });
    this.histogram = bins;
    this.range = Number.isFinite(min) ? { min, max } : { min: NDVI_MIN, max: NDVI_MAX };
  }
}

/** Gera o raster inteiro de uma vez (testes e uso síncrono). */
export function generateProduct(kind: ProductKind, inputs: ProductInputs): ProductRaster {
  const job = new ProductJob(kind, inputs);
  while (!job.done) job.runSlice(Infinity);
  return job.raster;
}
