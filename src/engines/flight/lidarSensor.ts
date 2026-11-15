/**
 * Sensor LiDAR do voo (survey-flight §5.9, domain-math §4.4): acúmulo analítico dos pulsos
 * na grade 64 × 64, amostras para o visualizador (até 50.000) e o leque de feixes.
 */
import { createCoverageGrid } from '@/domain/coverage';
import { groundDensity, groundReturnProbability, lidarDensity, lidarSwathM } from '@/domain/lidar';
import { mulberry32, type Rng } from '@/lib/rng';
import type { Contract, LidarBatch, LidarGrid, LidarPayload, LidarSample } from '@/types';
import type { TerrainSampler } from '@/world/terrain/TerrainSampler';
import type { RunFrame } from './runFrame';
import { aoiPoint } from './runFrame';

export const MAX_SAMPLES = 50_000;
/** Amostras para o visualizador a cada sub-passo (8 por quadro a 60 FPS). */
export const SAMPLES_PER_STEP = 8;
export const BEAMS = 24;
export const HIT_PERSIST_S = 1.5;
export const TOGGLE_COOLDOWN_S = 0.5;

const DEG = Math.PI / 180;

/** Ângulo de varredura: `θ(t) = (FOV/2) · sin(2π f t)`. */
export function scanAngle(fovRad: number, scanHz: number, tS: number): number {
  return (fovRad / 2) * Math.sin(2 * Math.PI * scanHz * tS);
}

export interface LidarHit {
  u: number;
  v: number;
  z: number;
  ret: 'FIRST' | 'GROUND';
  /** Segundos desde que o feixe bateu. */
  age: number;
}

export interface SweepInput {
  frame: RunFrame;
  /** Posição ao longo da linha no início e no fim do passo. */
  s0: number;
  s1: number;
  x: number;
  aglM: number;
  dtS: number;
}

export class LidarSensor {
  readonly grid: LidarGrid;
  /** Variação da grade desde o último `drainBatch`. */
  private delta = new Map<number, [number, number, number]>();
  readonly samples: LidarSample[] = [];
  private pendingSamples: LidarSample[] = [];
  readonly hits: LidarHit[] = [];
  private readonly rng: Rng;
  private readonly fovRad: number;

  constructor(
    private readonly pod: Pick<LidarPayload, 'prrHz' | 'fovDeg' | 'maxReturns' | 'scanFrequencyHz'>,
    private readonly terrain: Pick<
      TerrainSampler,
      'canopy' | 'landCover' | 'surface' | 'elevation' | 'aoi'
    >,
    aoi: Contract['aoi'],
    seed = 0x11da,
  ) {
    const g = createCoverageGrid(aoi);
    this.grid = {
      cols: g.cols,
      rows: g.rows,
      pulses: new Array<number>(g.cols * g.rows).fill(0),
      firstAbove: new Array<number>(g.cols * g.rows).fill(0),
      ground: new Array<number>(g.cols * g.rows).fill(0),
      cellAreaM2: g.cellLengthM * g.cellWidthM,
    };
    this.cellL = g.cellLengthM;
    this.cellW = g.cellWidthM;
    this.rng = mulberry32(seed);
    this.fovRad = pod.fovDeg * DEG;
  }

  get scanHz(): number {
    return this.pod.scanFrequencyHz;
  }

  private readonly cellL: number;
  private readonly cellW: number;

  /** Cobertura de dossel num ponto; sobre telhados vale 1 (domain-math §4.4). */
  private canopyAt(u: number, v: number): number {
    return this.terrain.landCover(u, v) === 'ROOF' ? 1 : this.terrain.canopy(u, v);
  }

  /**
   * Varre a faixa `v·dt × swath` sob a aeronave: reparte `PRR·dt` pulsos igualmente por
   * pontos da faixa; cada um soma na célula que o contém (só dentro da AOI).
   * Devolve os pulsos que caíram na AOI neste passo.
   */
  sweep(i: SweepInput): number {
    const swath = lidarSwathM(i.aglM, this.fovRad);
    if (swath <= 0 || i.dtS <= 0) return 0;
    const alongLen = Math.max(0, i.s1 - i.s0);
    const nAcross = Math.max(1, Math.min(96, Math.ceil(swath / Math.min(this.cellL, this.cellW))));
    const nAlong = Math.max(1, Math.min(4, Math.ceil(alongLen / Math.min(this.cellL, this.cellW))));
    const share = (this.pod.prrHz * i.dtS) / (nAcross * nAlong);
    let inside = 0;
    for (let a = 0; a < nAlong; a++) {
      const s = i.s0 + ((a + 0.5) / nAlong) * alongLen;
      for (let b = 0; b < nAcross; b++) {
        const x = i.x + ((b + 0.5) / nAcross - 0.5) * swath;
        const p = aoiPoint(i.frame, s, x);
        const col = Math.floor(p.u / this.cellL);
        const row = Math.floor(p.v / this.cellW);
        if (col < 0 || row < 0 || col >= this.grid.cols || row >= this.grid.rows) continue;
        const k = row * this.grid.cols + col;
        const canopy = this.canopyAt(p.u, p.v);
        const ground = share * groundReturnProbability(canopy, this.pod.maxReturns);
        const first = share * canopy;
        this.grid.pulses[k] = (this.grid.pulses[k] as number) + share;
        this.grid.ground[k] = (this.grid.ground[k] as number) + ground;
        this.grid.firstAbove[k] = (this.grid.firstAbove[k] as number) + first;
        const d = this.delta.get(k) ?? [0, 0, 0];
        d[0] += share;
        d[1] += first;
        d[2] += ground;
        this.delta.set(k, d);
        inside += share;
      }
    }
    // Amostras para o visualizador: posições reais dos impactos.
    for (let n = 0; n < SAMPLES_PER_STEP && this.samples.length < MAX_SAMPLES; n++) {
      const s = i.s0 + this.rng.next() * alongLen;
      const x = i.x + (this.rng.next() - 0.5) * swath;
      const p = aoiPoint(i.frame, s, x);
      if (p.u < 0 || p.v < 0 || p.u > this.terrain.aoi.lengthM || p.v > this.terrain.aoi.widthM)
        continue;
      const canopy = this.canopyAt(p.u, p.v);
      const r = this.rng.next();
      const sample: LidarSample =
        r < canopy
          ? {
              u: p.u,
              v: p.v,
              z: this.terrain.surface(p.u, p.v),
              ret: r < canopy * 0.6 ? 'FIRST' : 'INTERMEDIATE',
            }
          : { u: p.u, v: p.v, z: this.terrain.elevation(p.u, p.v), ret: 'GROUND' };
      this.samples.push(sample);
      this.pendingSamples.push(sample);
    }
    return inside;
  }

  /** Lote de células e amostras acumulados desde a última chamada (e zera o delta). */
  drainBatch(): LidarBatch {
    const cells: LidarBatch['cells'] = [...this.delta].map(([k, d]) => [k, d[0], d[1], d[2]]);
    const samples = this.pendingSamples;
    this.delta = new Map();
    this.pendingSamples = [];
    return { cells, samples };
  }

  /** Densidade exibida no HUD: `lidarDensity(PRR, v, AGL, FOV)` e a de solo pelo dossel. */
  hud(speedMs: number, aglM: number, canopy: number): { density: number; ground: number } {
    const density = lidarDensity(
      this.pod.prrHz,
      Math.max(0.1, speedMs),
      Math.max(1, aglM),
      this.fovRad,
    );
    return { density, ground: groundDensity(density, canopy, this.pod.maxReturns) };
  }

  /**
   * Leque visual: 24 feixes em ângulos `θ(t − k·δ)`, `δ = 1/(24·60)`, cada um com o impacto
   * no terreno (ou na copa). Os impactos persistem 1,5 s.
   */
  beams(tS: number, s: number, x: number, altM: number, frame: RunFrame): LidarHit[] {
    const out: LidarHit[] = [];
    const delta = 1 / (BEAMS * 60);
    for (let k = 0; k < BEAMS; k++) {
      const theta = scanAngle(this.fovRad, this.pod.scanFrequencyHz, tS - k * delta);
      const lateral = (altM - this.terrain.elevation(...this.xy(frame, s, x))) * Math.tan(theta);
      const p = aoiPoint(frame, s, x + lateral);
      const canopy = this.canopyAt(p.u, p.v);
      const first = this.rng.next() < canopy;
      out.push({
        u: p.u,
        v: p.v,
        z: first ? this.terrain.surface(p.u, p.v) : this.terrain.elevation(p.u, p.v),
        ret: first ? 'FIRST' : 'GROUND',
        age: 0,
      });
    }
    return out;
  }

  private xy(frame: RunFrame, s: number, x: number): [number, number] {
    const p = aoiPoint(frame, s, x);
    return [p.u, p.v];
  }

  /** Acrescenta impactos e envelhece os antigos (1,5 s). */
  trackHits(fresh: readonly LidarHit[], dtS: number): void {
    for (const h of this.hits) h.age += dtS;
    this.hits.push(...fresh);
    while (this.hits.length > 0 && (this.hits[0] as LidarHit).age > HIT_PERSIST_S)
      this.hits.shift();
    // Limita a lista (24 feixes × 90 quadros).
    if (this.hits.length > 3000) this.hits.splice(0, this.hits.length - 3000);
  }
}
