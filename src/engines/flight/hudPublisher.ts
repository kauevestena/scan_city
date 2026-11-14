/**
 * Snapshot do HUD (survey-flight §6), publicado a 10 Hz para o React, e os alertas com
 * prioridade (§5.17): no máximo 2 visíveis.
 */
import type { AoiPoint, RtkStatus } from '@/types';

export type FlightPhase =
  'TAKEOFF' | 'RUN' | 'TURN' | 'LANDING' | 'RETURNING' | 'CRASHED' | 'POST_FLIGHT';

export type FlightAlertId =
  | 'CRASH_IMMINENT'
  | 'RTH'
  | 'DETECTED'
  | 'WIND_LIMIT'
  | 'OVERLAP'
  | 'MOTION_BLUR'
  | 'LOW_LIGHT'
  | 'OUT_OF_LANE'
  | 'RTK_FLOAT'
  | 'ATLAS_DISTRACTED';

export interface FlightAlert {
  id: FlightAlertId;
  /** 1 = mais urgente. */
  priority: number;
  level: 'critical' | 'warn' | 'info';
  /** Valor exibido (ex.: overlap em %). */
  value?: number;
}

const PRIORITY: Readonly<Record<FlightAlertId, [number, FlightAlert['level']]>> = {
  CRASH_IMMINENT: [1, 'critical'],
  RTH: [2, 'critical'],
  DETECTED: [3, 'critical'],
  WIND_LIMIT: [4, 'warn'],
  OVERLAP: [5, 'warn'],
  MOTION_BLUR: [6, 'warn'],
  LOW_LIGHT: [6, 'warn'],
  OUT_OF_LANE: [7, 'warn'],
  RTK_FLOAT: [8, 'info'],
  ATLAS_DISTRACTED: [9, 'info'],
};

export const MAX_ALERTS = 2;

export function makeAlert(id: FlightAlertId, value?: number): FlightAlert {
  const [priority, level] = PRIORITY[id];
  return value === undefined ? { id, priority, level } : { id, priority, level, value };
}

/** Os alertas mais urgentes, no máximo 2. */
export function topAlerts(alerts: readonly FlightAlert[]): FlightAlert[] {
  return [...alerts].sort((a, b) => a.priority - b.priority).slice(0, MAX_ALERTS);
}

export interface FlightHudSnapshot {
  phase: FlightPhase;
  aircraftName: string;
  sensorName: string;
  lineIndex: number;
  nLines: number;
  lineProgress: number;
  crossTrackM: number;
  outOfLane: boolean;
  altM: number;
  aglM: number;
  speedMs: number;
  windCrossMs: number;
  crabDeg: number;
  timeScale: number;
  energy: number;
  energyUnit: 'BATTERY' | 'CORN';
  cornLeft?: number;
  timeLeftS: number;
  rthAlert: boolean;
  /** Interferência EM: glitch de scanlines no HUD. */
  emGlitch: boolean;
  hull: number;
  hullMax: number;
  rtk: RtkStatus;
  activeSensor: 'RGB' | 'LIDAR';
  gsdCm: number;
  gsdOk: boolean;
  pRealPct: number | null;
  qEstPct: number;
  photos: number;
  photosPlanned: number;
  blurPx: number;
  lidarDensity?: number;
  groundDensity?: number;
  alerts: FlightAlert[];
  minimap: {
    lines: Array<[AoiPoint, AoiPoint]>;
    shots: AoiPoint[];
    pos: AoiPoint;
    heading: number;
  };
}

export const HUD_INTERVAL_MS = 100;

/** Limita a publicação a 10 Hz de tempo real (com aceleração, a simulação corre mais). */
export class HudThrottle {
  private last = -Infinity;

  shouldPublish(nowMs: number, force = false): boolean {
    if (!force && nowMs - this.last < HUD_INTERVAL_MS) return false;
    this.last = nowMs;
    return true;
  }
}
