/**
 * Nuvem de pontos e malha TIN do visualizador de produtos (processing-results §5.7, holo-table
 * §5.1): até 30.000 pontos amostrados do MDS com a cor da orto (fotogrametria) ou as amostras
 * LiDAR coloridas por retorno, mais a malha triangulada 64 × 64 sobre o MDS. Puro e
 * determinístico; a construção roda em fatias de tempo, como os rasters.
 */
import { hash2 } from '@/lib/rng';
import { clamp } from '@/lib/math';
import type { CoverageResult, LidarSample } from '@/types';
import { COLORS } from '@/ui/tokens';
import type { TerrainSampler } from '@/world/terrain/TerrainSampler';
import type { LineSet, PointSet } from '../soft3d/Renderer';
import { hypsometricColor } from './orthoPreview';
import { PRODUCT_SIZE, type ProductRaster } from './products';

export const MAX_CLOUD_POINTS = 30_000;
/** Células do TIN por lado: a malha tem (N + 1)² vértices. */
export const TIN_GRID = 64;
/** Raio da cena: a AOI cabe em [−1, 1] no maior lado. */
export const CLOUD_RADIUS = 1.6;
/** Altura de cena do relevo quando ele é plano demais (exagero vertical automático). */
const TARGET_RELIEF = 0.45;
const MAX_EXAGGERATION = 10;
const CHUNK = 1500;

export type CloudSource = 'PHOTO' | 'LIDAR';

/** Cores dos retornos LiDAR (§5.7): 1º ciano, intermediário violeta, solo verde. */
export const RETURN_COLORS: Readonly<Record<LidarSample['ret'], string>> = {
  FIRST: COLORS.radar,
  INTERMEDIATE: COLORS.rift,
  GROUND: COLORS.ok,
};

export interface CloudInputs {
  terrain: TerrainSampler;
  coverage: Pick<CoverageResult, 'cols' | 'rows' | 'counts' | 'excludedCells'>;
  source: CloudSource;
  /** Orto pronta: dá a cor dos pontos fotogramétricos (senão, hipsometria). */
  ortho?: ProductRaster | null;
  lidarSamples?: readonly LidarSample[];
  seed: number;
}

export interface CloudScene {
  source: CloudSource;
  points: PointSet[];
  pointCount: number;
  /** Quantidade de pontos por retorno (LiDAR). */
  byReturn?: Record<LidarSample['ret'], number>;
  tin: LineSet;
  /** Raio sugerido para a `OrbitCamera`. */
  radius: number;
  exaggeration: number;
  /** Faixa de elevação em m, da malha e dos pontos. */
  zRange: { min: number; max: number };
}

interface Pt {
  x: number;
  y: number; // elevação em m
  z: number;
  r: number;
  g: number;
  b: number;
}

/** Agrupa as cores em baldes de 4 bits por canal, para poucos `PointSet`. */
const bucket = (r: number, g: number, b: number) => ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
const bucketColor = (key: number) =>
  `rgb(${((key >> 8) & 15) * 17}, ${((key >> 4) & 15) * 17}, ${(key & 15) * 17})`;

export class CloudJob {
  private readonly tasks: Array<() => void> = [];
  private next = 0;
  private readonly pts: Pt[] = [];
  private readonly tinZ: Float32Array;
  private scene: CloudScene | null = null;
  private readonly sideU: number;
  private readonly sideV: number;
  private readonly excluded: ReadonlySet<number>;

  constructor(private readonly inputs: CloudInputs) {
    const { terrain } = inputs;
    this.excluded = new Set(inputs.coverage.excludedCells);
    this.tinZ = new Float32Array((TIN_GRID + 1) * (TIN_GRID + 1));
    // Malha de amostragem do MDS: ≈ 30.000 pontos na proporção da AOI.
    const aspect = terrain.aoi.lengthM / terrain.aoi.widthM;
    this.sideU = Math.max(1, Math.round(Math.sqrt(MAX_CLOUD_POINTS * aspect)));
    this.sideV = Math.max(1, Math.floor(MAX_CLOUD_POINTS / this.sideU));
    this.plan();
  }

  get progress(): number {
    return this.tasks.length === 0 ? 1 : this.next / this.tasks.length;
  }

  get done(): boolean {
    return this.next >= this.tasks.length;
  }

  /** Trabalha até `budgetMs`; devolve quantas tarefas fez. */
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

  get result(): CloudScene {
    if (!this.scene) throw new Error('Nuvem ainda não concluída');
    return this.scene;
  }

  private plan(): void {
    for (let j = 0; j <= TIN_GRID; j++) this.tasks.push(() => this.tinRow(j));
    if (this.inputs.source === 'LIDAR') this.tasks.push(() => this.collectLidar());
    else {
      const total = this.sideU * this.sideV;
      for (let k = 0; k < total; k += CHUNK) {
        this.tasks.push(() => this.collectPhoto(k, Math.min(total, k + CHUNK)));
      }
    }
    this.tasks.push(() => this.prepareFrame());
    this.tasks.push(() => this.makeTin());
    this.tasks.push(() => this.assemble());
  }

  private tinRow(j: number): void {
    const { aoi } = this.inputs.terrain;
    const v = (j / TIN_GRID) * aoi.widthM;
    for (let i = 0; i <= TIN_GRID; i++) {
      this.tinZ[j * (TIN_GRID + 1) + i] = this.inputs.terrain.surface(
        (i / TIN_GRID) * aoi.lengthM,
        v,
      );
    }
  }

  private covered(u: number, v: number): boolean {
    const { coverage, terrain } = this.inputs;
    const ci = Math.min(coverage.cols - 1, Math.floor((u / terrain.aoi.lengthM) * coverage.cols));
    const cj = Math.min(coverage.rows - 1, Math.floor((v / terrain.aoi.widthM) * coverage.rows));
    const k = cj * coverage.cols + ci;
    return !this.excluded.has(k) && (coverage.counts[k] ?? 0) > 0;
  }

  /** Fotogrametria: pontos do MDS numa grade com jitter, só onde há dados. */
  private collectPhoto(from: number, to: number): void {
    const { terrain, ortho, seed } = this.inputs;
    const { lengthM, widthM } = terrain.aoi;
    for (let k = from; k < to; k++) {
      const i = k % this.sideU;
      const j = Math.floor(k / this.sideU);
      const u = ((i + hash2(i, j, seed)) / this.sideU) * lengthM;
      const v = ((j + hash2(j, i, seed ^ 0x51ed)) / this.sideV) * widthM;
      if (!this.covered(u, v)) continue;
      const y = terrain.surface(u, v);
      let r: number;
      let g: number;
      let b: number;
      if (ortho) {
        const px = clamp(Math.floor((u / lengthM) * PRODUCT_SIZE), 0, PRODUCT_SIZE - 1);
        const py = clamp(Math.floor((v / widthM) * PRODUCT_SIZE), 0, PRODUCT_SIZE - 1);
        const o = (py * PRODUCT_SIZE + px) * 4;
        r = ortho.rgba[o] as number;
        g = ortho.rgba[o + 1] as number;
        b = ortho.rgba[o + 2] as number;
      } else {
        // Sem orto, a cor vem da altura (normalizada ao montar a cena).
        r = g = b = -1;
      }
      this.pts.push({ x: u, y, z: v, r, g, b });
    }
  }

  /** LiDAR: amostras limitadas a 30.000, em passo regular, com a cor do retorno. */
  private collectLidar(): void {
    const samples = this.inputs.lidarSamples ?? [];
    const stride = Math.max(1, Math.ceil(samples.length / MAX_CLOUD_POINTS));
    for (let k = 0; k < samples.length && this.pts.length < MAX_CLOUD_POINTS; k += stride) {
      const s = samples[k] as LidarSample;
      this.pts.push({ x: s.u, y: s.z, z: s.v, r: RETURN_INDEX[s.ret], g: 0, b: 0 });
    }
  }

  /** Faixa de elevação e transformação do mundo para a cena. */
  private frame!: {
    min: number;
    max: number;
    exaggeration: number;
    sx: (u: number) => number;
    sy: (z: number) => number;
    sz: (v: number) => number;
  };
  private readonly groups = new Map<number, { color: string; xyz: number[] }>();
  private readonly byReturn: Record<LidarSample['ret'], number> = {
    FIRST: 0,
    INTERMEDIATE: 0,
    GROUND: 0,
  };
  private groupCursor = 0;
  private tin: LineSet | null = null;

  private prepareFrame(): void {
    const { aoi } = this.inputs.terrain;
    const { lengthM, widthM } = aoi;
    let min = Infinity;
    let max = -Infinity;
    for (const z of this.tinZ) {
      min = Math.min(min, z);
      max = Math.max(max, z);
    }
    for (const p of this.pts) {
      min = Math.min(min, p.y);
      max = Math.max(max, p.y);
    }
    const s = Math.max(lengthM, widthM) / 2;
    const exaggeration = clamp(
      TARGET_RELIEF / Math.max((max - min) / s, 1e-3),
      1,
      MAX_EXAGGERATION,
    );
    const zMid = (min + max) / 2;
    this.frame = {
      min,
      max,
      exaggeration,
      sx: (u) => (u - lengthM / 2) / s,
      sy: (z) => ((z - zMid) / s) * exaggeration,
      sz: (v) => (v - widthM / 2) / s,
    };
    // O agrupamento por cor vem a seguir, em lotes.
    this.tasks.splice(this.next + 1, 0, () => this.groupChunk());
  }

  /** Agrupa os pontos por cor (um `PointSet` por balde), em lotes de 3.000. */
  private groupChunk(): void {
    const { source } = this.inputs;
    const { min, max, sx, sy, sz } = this.frame;
    const rets = ['FIRST', 'INTERMEDIATE', 'GROUND'] as const;
    const end = Math.min(this.pts.length, this.groupCursor + 3000);
    for (; this.groupCursor < end; this.groupCursor++) {
      const p = this.pts[this.groupCursor] as Pt;
      let key: number;
      let color: string;
      if (source === 'LIDAR') {
        const ret = rets[p.r] as LidarSample['ret'];
        this.byReturn[ret]++;
        key = p.r;
        color = RETURN_COLORS[ret];
      } else {
        let { r, g, b } = p;
        if (r < 0) {
          [r, g, b] = hypsometricColor((p.y - min) / Math.max(1e-6, max - min)).map(Math.round) as [
            number,
            number,
            number,
          ];
        }
        key = bucket(r, g, b);
        color = bucketColor(key);
      }
      let group = this.groups.get(key);
      if (!group) this.groups.set(key, (group = { color, xyz: [] }));
      group.xyz.push(sx(p.x), sy(p.y), sz(p.z));
    }
    if (this.groupCursor < this.pts.length) {
      this.tasks.splice(this.next + 1, 0, () => this.groupChunk());
    }
  }

  private makeTin(): void {
    const { sx, sy, sz } = this.frame;
    this.tin = this.buildTin(sx, sy, sz);
  }

  private assemble(): void {
    const points: PointSet[] = [...this.groups.entries()]
      .sort(([a], [b]) => a - b)
      .map(([, g]) => ({ positions: new Float32Array(g.xyz), color: g.color, size: 2 }));
    const { source } = this.inputs;
    this.scene = {
      source,
      points,
      pointCount: this.pts.length,
      ...(source === 'LIDAR' ? { byReturn: this.byReturn } : {}),
      tin: this.tin as LineSet,
      radius: CLOUD_RADIUS,
      exaggeration: this.frame.exaggeration,
      zRange: { min: this.frame.min, max: this.frame.max },
    };
  }

  /** Malha 64 × 64 em wireframe ciano: arestas horizontais, verticais e uma diagonal por célula. */
  private buildTin(
    sx: (u: number) => number,
    sy: (z: number) => number,
    sz: (v: number) => number,
  ): LineSet {
    const { aoi } = this.inputs.terrain;
    const n = TIN_GRID + 1;
    const positions = new Float32Array(n * n * 3);
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const o = (j * n + i) * 3;
        positions[o] = sx((i / TIN_GRID) * aoi.lengthM);
        positions[o + 1] = sy(this.tinZ[j * n + i] as number);
        positions[o + 2] = sz((j / TIN_GRID) * aoi.widthM);
      }
    }
    const segs: number[] = [];
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const a = j * n + i;
        if (i < TIN_GRID) segs.push(a, a + 1);
        if (j < TIN_GRID) segs.push(a, a + n);
        if (i < TIN_GRID && j < TIN_GRID) segs.push(a, a + n + 1);
      }
    }
    return {
      positions,
      segments: new Uint32Array(segs),
      color: COLORS.radar,
      width: 1,
    };
  }
}

const RETURN_INDEX: Readonly<Record<LidarSample['ret'], number>> = {
  FIRST: 0,
  INTERMEDIATE: 1,
  GROUND: 2,
};

/** Constrói a cena inteira de uma vez (testes e uso síncrono). */
export function buildCloudScene(inputs: CloudInputs): CloudScene {
  const job = new CloudJob(inputs);
  while (!job.done) job.runSlice(Infinity);
  return job.result;
}
