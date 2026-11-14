// data-model §5 — Mundo, terreno e objetos
import type { Rgb } from './basics';

export type LandCover =
  | 'GRASS'
  | 'CROP'
  | 'FOREST'
  | 'WATER'
  | 'ROAD'
  | 'ROOF'
  | 'SAND'
  | 'ROCK'
  | 'SWAMP'
  | 'URBAN'
  | 'BENCH'
  | 'LAVA'
  | 'SNOW'
  | 'METAL';

export type WorldObjectKind =
  | 'BUILDING'
  | 'TREE'
  | 'POLE'
  | 'WIRE'
  | 'PIPE'
  | 'BRICK_PLATFORM'
  | 'RING'
  | 'STONE_ARCH'
  | 'CUBE_BLOCK'
  | 'ENERGY_BEAM'
  | 'SEARCHLIGHT'
  | 'GIANT_WALKER'
  | 'TOWER'
  | 'CLIFF_TEMPLE'
  | 'MOVING_HAZARD'
  | 'GCP_TARGET';

export interface WorldObject {
  id: number;
  kind: WorldObjectKind;
  /** Centro da base. */
  u: number;
  v: number;
  /** Caixa envolvente (fio: comprimento em depth). */
  widthM: number;
  depthM: number;
  heightM: number;
  /** Altura da base acima do solo (plataformas flutuantes, fios). */
  baseM?: number;
  rotationRad?: number;
  color: Rgb;
  /** Colide? */
  solid: boolean;
  /** RING. */
  collectible?: boolean;
  motion?: { axis: 'u' | 'v' | 'h'; amplitudeM: number; periodS: number; phase: number };
  /** ENERGY_BEAM. */
  activePeriod?: { onS: number; offS: number; phase: number };
  /** WIRE: extremidade 2. */
  v2?: number;
  u2?: number;
}

export interface FeatureTarget {
  id: string;
  name: string;
  u: number;
  v: number;
  radiusM: number;
  needs: 'PHOTO' | 'LIDAR';
}

export type SpecialZone =
  | { kind: 'THERMAL'; u: number; v: number; radiusM: number; liftMs: number }
  | { kind: 'RTK_CANYON'; uMin: number; uMax: number; vMin: number; vMax: number }
  | {
      kind: 'SEARCHLIGHT';
      u: number;
      v: number;
      radiusM: number;
      sweepRad: number;
      periodS: number;
    }
  | { kind: 'WATER'; uMin: number; uMax: number; vMin: number; vMax: number }
  | { kind: 'FOG'; density: number };
