/**
 * Snapshot do HUD (survey-flight §6), publicado a 10 Hz para o React, e os alertas com
 * prioridade (§5.17): no máximo 2 visíveis.
 */
import type { GradeAxis } from '@/domain/execution';
import type { AoiPoint, GradeCounts, RtkStatus, ShotGrade } from '@/types';

export type FlightPhase =
  'TAKEOFF' | 'RUN' | 'TURN' | 'LANDING' | 'RETURNING' | 'CRASHED' | 'POST_FLIGHT';

export type FlightAlertId =
  | 'CRASH_IMMINENT'
  | 'RTH'
  | 'DETECTED'
  | 'GUST'
  | 'WIND_LIMIT'
  | 'OFF_ALTITUDE'
  | 'SPEED_LIMITED'
  | 'OVERLAP'
  | 'MOTION_BLUR'
  | 'LOW_LIGHT'
  | 'OUT_OF_LANE'
  | 'MIN_SPEED'
  | 'RTK_FLOAT'
  | 'ATLAS_DISTRACTED';

export interface FlightAlert {
  id: FlightAlertId;
  /** 1 = mais urgente. */
  priority: number;
  level: 'critical' | 'warn' | 'info';
  /**
   * Valor exibido: o overlap em %; na rajada, os segundos até ela começar (≤ 0 quando já
   * sopra); na altura, quanto falta subir (positivo) ou descer; na velocidade limitada, o
   * sinal do vento (negativo de proa, positivo de cauda).
   */
  value?: number;
  /** Lado para onde a rajada empurra. */
  side?: -1 | 1;
}

/** Prioridades de survey-flight §5.17: o que pede ação agora vem antes do que é só estado. */
const PRIORITY: Readonly<Record<FlightAlertId, [number, FlightAlert['level']]>> = {
  CRASH_IMMINENT: [1, 'critical'],
  RTH: [2, 'critical'],
  DETECTED: [3, 'critical'],
  GUST: [4, 'warn'],
  ATLAS_DISTRACTED: [4, 'info'],
  WIND_LIMIT: [5, 'warn'],
  OUT_OF_LANE: [6, 'warn'],
  OFF_ALTITUDE: [7, 'warn'],
  OVERLAP: [8, 'warn'],
  MOTION_BLUR: [9, 'warn'],
  LOW_LIGHT: [9, 'warn'],
  SPEED_LIMITED: [10, 'info'],
  MIN_SPEED: [10, 'warn'],
  RTK_FLOAT: [11, 'info'],
};

export const MAX_ALERTS = 2;

export function makeAlert(id: FlightAlertId, value?: number, side?: -1 | 1): FlightAlert {
  const [priority, level] = PRIORITY[id];
  return {
    id,
    priority,
    level,
    ...(value === undefined ? {} : { value }),
    ...(side === undefined ? {} : { side }),
  };
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
  /** Confirmação do RTH aberta (3 s). */
  rthConfirm: boolean;
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
  /** Flashes do obturador mostrados na tela (0 com "Reduzir flashes e tremores", REQ-NFR-007). */
  flashes: number;
  blurPx: number;
  lidarDensity?: number;
  groundDensity?: number;
  alerts: FlightAlert[];
  /** Tempo seguido num cone de holofote, de 0 a 1 do limite. */
  detectedProgress?: number;
  /** Anéis coletados (regra `COLLECTIBLE_RINGS`). */
  rings?: number;
  /** Velocidade no solo de fato e a do plano (survey-flight §4). */
  groundSpeedMs: number;
  planSpeedMs: number;
  /** Altitude do corredor menos a da aeronave: positivo, falta subir. */
  corridorDeltaM: number;
  /** Abaixo desta diferença a seta de altura some (a zona da nota Perfeita, 5 % de H). */
  corridorTolM: number;
  /** Nota do instante (faixa, altura e avanço pela velocidade no solo). */
  grade: ShotGrade;
  /** A última amostra com nota; `seq` muda a cada amostra, para a marca na tela. */
  lastGrade: { grade: ShotGrade; axis: GradeAxis | null; seq: number } | null;
  /** Amostras seguidas com nota Boa ou Perfeita. */
  streak: number;
  /** Nota e letra da passada em curso; `null` antes da primeira amostra. */
  passScore: number | null;
  passLetter: string | null;
  /** A passada em curso é um revoo. */
  refly: boolean;
  /** Rajada avisada (`inS` > 0) ou em curso, com o lado para onde empurra. */
  gust: { side: -1 | 1; inS: number; active: boolean } | null;
  /** Para a biruta: para onde o vento sopra, em relação à aeronave (0 = de cauda, 90 = para a direita). */
  windRelDeg: number;
  /** Cruzeiro automático: ligado pelo jogador e o fator de tempo do momento. */
  cruise: { on: boolean; factor: number };
  /** Boletim da passada que acabou de fechar (durante a curva, o retorno e o pouso). */
  lineReport: {
    lineNumber: number;
    pass: number;
    score: number;
    letter: string;
    counts: GradeCounts;
    accepted: boolean;
  } | null;
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
